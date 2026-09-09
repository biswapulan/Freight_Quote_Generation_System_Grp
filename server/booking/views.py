"""M4 booking workflow endpoints. Phase 2: the company offers a customer compares."""

from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from audit import service as audit_service
from companies.access import (
    can_access_company,
    is_manager_of,
    is_platform_wide,
    memberships_for,
)
from quotes.auth_helper import get_current_user_and_role
from quotes.models import Quote

from . import lifecycle
from .models import (
    Booking,
    CompanyQuote,
    QuoteSelection,
    VerificationCheck,
    VerificationRequest,
)
from .offer_engine import generate_company_quotes
from .serializers import (
    BookingSerializer,
    CompanyQuoteSerializer,
    QuoteRevisionSerializer,
    QuoteSelectionSerializer,
    StatusHistorySerializer,
    VerificationCheckSerializer,
    VerificationRequestSerializer,
)
from .services import (
    BookingError,
    CustomerResponseError,
    DecisionError,
    cancel_booking,
    move_selection,
    notify_customer_of_decision,
    provide_requested_information,
    respond_to_revision,
    submit_decision,
)

STAFF_ROLES = ("admin", "agent", "customs", "customs_officer")


def _actor(request):
    user_id, role, email = get_current_user_and_role(request)
    return {"id": user_id, "role": (role or "").lower(), "email": email or ""}


class QuoteCompanyOptionsView(APIView):
    """GET /quotes/<id>/company-quotes -> every company's offer for this quote.

    Offers are created on first request and reused afterwards, so the prices a
    customer is comparing do not move under them on a page refresh.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request, quote_id):
        actor = _actor(request)

        try:
            quote = Quote.objects.select_related("shipment").get(id=quote_id)
        except Quote.DoesNotExist:
            raise NotFound("Quote not found.")

        is_staff = actor["role"] in STAFF_ROLES
        if not is_staff and quote.customer_id != actor["id"]:
            raise PermissionDenied("You cannot view another customer's quote options.")

        refresh = request.query_params.get("refresh") in ("1", "true", "True")
        offers = generate_company_quotes(quote, replace=refresh)

        # Expiry is a business rule, not a display detail: mark lapsed offers so
        # the customer cannot select one and the agent cannot confirm it.
        now = timezone.now()
        lapsed = [
            o for o in offers
            if o.valid_until and o.valid_until <= now and o.status == "AVAILABLE"
        ]
        for offer in lapsed:
            offer.status = "EXPIRED"
        if lapsed:
            CompanyQuote.objects.bulk_update(lapsed, ["status"])

        # A company agent comparing offers sees only their own company's, so a
        # competitor's pricing is never exposed through this endpoint.
        if actor["role"] == "agent" and not is_platform_wide(actor["role"]):
            own = set(memberships_for(actor["email"]).values_list("company_id", flat=True))
            if own:
                offers = [o for o in offers if o.company_id in own]

        return Response(
            {
                "quoteId": quote.id,
                "shipmentId": quote.shipment_id,
                "count": len(offers),
                "results": CompanyQuoteSerializer(offers, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class VerificationQueueView(APIView):
    """GET /verification-requests -> the caller's company verification queue.

    An agent sees their own companies' requests and nothing else. This is the
    M4 isolation rule at its sharpest: the queue is the customer's shipment,
    cargo and commercial terms, so a competitor reading it would be reading a
    customer relationship they have no part in.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        actor = _actor(request)
        role = actor["role"]

        if role not in STAFF_ROLES:
            raise PermissionDenied("Only company agents and staff may view this queue.")

        requests = VerificationRequest.objects.select_related(
            "company", "selection", "selection__company", "selection__shipment"
        ).prefetch_related("checks")

        if not is_platform_wide(role):
            company_ids = list(
                memberships_for(actor["email"]).values_list("company_id", flat=True)
            )
            if not company_ids:
                # An agent with no company membership has no queue, rather than
                # falling back to the whole platform.
                return Response(
                    {"count": 0, "results": [], "detail": "No company membership."},
                    status=status.HTTP_200_OK,
                )
            requests = requests.filter(company_id__in=company_ids)

        status_filter = request.query_params.get("status")
        if status_filter:
            requests = requests.filter(status=status_filter.upper())

        if request.query_params.get("pending") in ("1", "true", "True"):
            requests = requests.filter(status__in=sorted(lifecycle.AGENT_ACTIONABLE))

        requests = list(requests[:200])
        return Response(
            {
                "count": len(requests),
                "results": VerificationRequestSerializer(requests, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class VerificationDetailView(APIView):
    """GET /verification-requests/<ref> -> one request, if it is yours.

    Opening a request records who picked it up and when, which is what makes
    response time measurable and stops two agents deciding the same request.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request, reference):
        actor = _actor(request)

        vr = (
            VerificationRequest.objects.select_related(
                "company", "selection", "selection__shipment", "selection__quote"
            )
            .prefetch_related("checks", "selection__history")
            .filter(reference=reference)
            .first()
        )
        if not vr:
            raise NotFound("Verification request not found.")

        is_owner_agent = can_access_company(actor["email"], actor["role"], vr.company_id)
        is_the_customer = vr.selection.customer_id == actor["id"]

        if not is_owner_agent and not is_the_customer:
            # Milestone test scenario 3: another company's agent is refused.
            raise PermissionDenied(
                "This verification request belongs to another company."
            )

        # First open by an agent of the owning company starts the clock.
        if is_owner_agent and actor["role"] == "agent" and not vr.opened_at:
            vr.opened_at = timezone.now()
            vr.assigned_agent_email = vr.assigned_agent_email or actor["email"]
            vr.save(update_fields=["opened_at", "assigned_agent_email", "updated_at"])

            if vr.status == lifecycle.PENDING_COMPANY_VERIFICATION:
                move_selection(
                    vr.selection,
                    lifecycle.UNDER_VERIFICATION,
                    actor=actor,
                    reason=f"Opened by {actor['email']}.",
                )
                vr.refresh_from_db()

        payload = VerificationRequestSerializer(vr).data
        payload["history"] = StatusHistorySerializer(
            vr.selection.history.all(), many=True
        ).data
        return Response(payload, status=status.HTTP_200_OK)


class VerificationCheckUpdateView(APIView):
    """POST /verification-requests/<ref>/checks -> record one checklist result.

    The checklist is the evidence behind a decision, so only an agent of the
    owning company may write to it, and each line records who checked it.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request, reference):
        actor = _actor(request)
        vr = VerificationRequest.objects.filter(reference=reference).first()
        if not vr:
            raise NotFound("Verification request not found.")

        if not can_access_company(actor["email"], actor["role"], vr.company_id):
            raise PermissionDenied(
                "This verification request belongs to another company."
            )

        area = (request.data.get("area") or "").upper()
        result = (request.data.get("result") or "").upper()
        remarks = (request.data.get("remarks") or "").strip()

        check = vr.checks.filter(area=area).first()
        if not check:
            return Response(
                {"error": f"'{area}' is not a checklist area on this request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid = {c[0] for c in VerificationCheck.RESULT_CHOICES}
        if result not in valid:
            return Response(
                {"error": f"result must be one of: {', '.join(sorted(valid))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # A failed or flagged line has to say why: it is the evidence the
        # customer sees behind a rejection or a revision.
        if result in ("FAIL", "ATTENTION") and not remarks:
            return Response(
                {"error": f"Explain why '{check.prompt}' is marked {result}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        check.result = result
        check.remarks = remarks
        check.checked_by_email = actor["email"]
        check.checked_at = timezone.now()
        check.save(
            update_fields=["result", "remarks", "checked_by_email", "checked_at"]
        )

        checks = list(vr.checks.all())
        return Response(
            {
                "check": VerificationCheckSerializer(check).data,
                "completed": sum(1 for c in checks if c.result != "PENDING"),
                "total": len(checks),
                "blocking": [c.area for c in checks if c.result == "FAIL"],
            },
            status=status.HTTP_200_OK,
        )


class VerificationDecisionView(APIView):
    """POST /verification-requests/<ref>/decision -> the agent's decision.

    Approve, Modify, Reject, Request Info or Escalate, each with a reason that
    reaches the customer. A modification never overwrites the selected terms:
    it becomes a revision the customer can accept or decline.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request, reference):
        actor = _actor(request)

        vr = (
            VerificationRequest.objects.select_related(
                "company", "selection", "selection__company_quote"
            )
            .filter(reference=reference)
            .first()
        )
        if not vr:
            raise NotFound("Verification request not found.")

        if not can_access_company(actor["email"], actor["role"], vr.company_id):
            raise PermissionDenied(
                "You cannot decide on another company's verification request."
            )

        action = request.data.get("action")
        # Only a company manager may clear an escalation, which is the point of
        # escalating in the first place.
        if vr.status == lifecycle.ESCALATED and (action or "").upper() in (
            "APPROVE",
            "REJECT",
        ):
            if not is_manager_of(actor["email"], vr.company_id) and not is_platform_wide(
                actor["role"]
            ):
                raise PermissionDenied(
                    "This request was escalated and needs a company manager to decide."
                )

        try:
            vr, revision = submit_decision(
                vr,
                action=action,
                actor=actor,
                reason=request.data.get("reason", ""),
                revision=request.data.get("revision"),
                requested_information=request.data.get("requested_information"),
            )
        except DecisionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

        notify_customer_of_decision(vr, revision)

        audit_service.record(
            actor_id=actor["id"] or actor["email"],
            actor_role=actor["role"],
            actor_email=actor["email"],
            action=f"VERIFICATION_{(action or '').upper()}",
            entity_type="VERIFICATION_REQUEST",
            entity_id=vr.reference,
            reason=vr.decision_reason,
            changes={"status": {"to": vr.status}},
            context={
                "company": vr.company.code,
                "selection": vr.selection.reference,
                "revision": revision.reference if revision else None,
            },
        )

        vr.refresh_from_db()
        payload = VerificationRequestSerializer(vr).data
        if revision:
            payload["createdRevision"] = QuoteRevisionSerializer(revision).data
        return Response(payload, status=status.HTTP_200_OK)


def _selection_for_customer(reference, actor):
    """Fetch a selection the caller is entitled to act on."""
    selection = (
        QuoteSelection.objects.select_related(
            "company", "company_quote", "shipment", "quote"
        )
        .prefetch_related("revisions", "history")
        .filter(reference=reference)
        .first()
    )
    if not selection:
        raise NotFound("Selection not found.")

    is_owner = selection.customer_id == actor["id"]
    if not is_owner and not is_platform_wide(actor["role"]):
        raise PermissionDenied("This selection belongs to another customer.")
    return selection


class MySelectionsView(APIView):
    """GET /selections/my -> the customer's selections and where each stands."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        actor = _actor(request)
        selections = (
            QuoteSelection.objects.select_related("company", "company_quote", "shipment")
            .prefetch_related("revisions")
            .filter(customer_id=actor["id"])
        )

        if request.query_params.get("active") in ("1", "true", "True"):
            selections = selections.filter(is_active=True)

        selections = list(selections[:100])
        payload = []
        for sel in selections:
            row = QuoteSelectionSerializer(sel).data
            pending = sel.revisions.filter(status="PENDING_CUSTOMER").first()
            row["pendingRevision"] = (
                QuoteRevisionSerializer(pending).data if pending else None
            )
            row["awaitingYou"] = lifecycle.is_customer_actionable(sel.status)
            payload.append(row)

        return Response(
            {"count": len(payload), "results": payload}, status=status.HTTP_200_OK
        )


class SelectionDetailView(APIView):
    """GET /selections/<ref> -> one selection with its revisions and history."""

    authentication_classes = []
    permission_classes = []

    def get(self, request, reference):
        actor = _actor(request)
        selection = _selection_for_customer(reference, actor)

        payload = QuoteSelectionSerializer(selection).data
        payload["revisions"] = QuoteRevisionSerializer(
            selection.revisions.all(), many=True
        ).data
        payload["history"] = StatusHistorySerializer(
            selection.history.all(), many=True
        ).data
        payload["awaitingYou"] = lifecycle.is_customer_actionable(selection.status)

        request_obj = getattr(selection, "verification", None)
        if request_obj:
            payload["verification"] = {
                "reference": request_obj.reference,
                "status": request_obj.status,
                "decisionReason": request_obj.decision_reason,
                "requestedInformation": request_obj.requested_information,
                "companyName": request_obj.company.name,
            }
        return Response(payload, status=status.HTTP_200_OK)


class RevisionResponseView(APIView):
    """POST /selections/<ref>/revision-response -> accept or decline a revision.

    Declining does not cancel the shipment. It releases the customer to choose
    another company, which is the milestone's fallback rule.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request, reference):
        actor = _actor(request)
        selection = _selection_for_customer(reference, actor)

        try:
            selection, revision = respond_to_revision(
                selection,
                decision=request.data.get("decision"),
                actor=actor,
                note=request.data.get("note", ""),
            )
        except (CustomerResponseError, lifecycle.InvalidSelectionTransitionError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

        audit_service.record(
            actor_id=actor["id"] or actor["email"],
            actor_role=actor["role"],
            actor_email=actor["email"],
            action=f"REVISION_{revision.status}",
            entity_type="QUOTE_SELECTION",
            entity_id=selection.reference,
            reason=request.data.get("note", ""),
            changes={"status": {"to": selection.status}},
            context={"revision": revision.reference},
        )

        selection.refresh_from_db()
        payload = QuoteSelectionSerializer(selection).data
        payload["revision"] = QuoteRevisionSerializer(revision).data
        payload["canReselect"] = selection.status == lifecycle.RESELECT_QUOTE
        return Response(payload, status=status.HTTP_200_OK)


class ProvideInformationView(APIView):
    """POST /selections/<ref>/information -> answer the company's questions."""

    authentication_classes = []
    permission_classes = []

    def post(self, request, reference):
        actor = _actor(request)
        selection = _selection_for_customer(reference, actor)

        try:
            selection = provide_requested_information(
                selection,
                actor=actor,
                note=request.data.get("note", ""),
                provided=request.data.get("provided"),
            )
        except (CustomerResponseError, lifecycle.InvalidSelectionTransitionError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

        selection.refresh_from_db()
        return Response(
            QuoteSelectionSerializer(selection).data, status=status.HTTP_200_OK
        )


class BookingListView(APIView):
    """GET /bookings -> bookings the caller is entitled to see.

    A customer sees their own. A company agent sees their companies'. Admin and
    customs see the platform. Nobody sees a booking that belongs to neither
    their customer account nor their company.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        actor = _actor(request)
        bookings = Booking.objects.select_related(
            "company", "shipment", "selection"
        ).all()

        if is_platform_wide(actor["role"]):
            pass
        elif actor["role"] == "agent":
            company_ids = list(
                memberships_for(actor["email"]).values_list("company_id", flat=True)
            )
            bookings = bookings.filter(company_id__in=company_ids)
        else:
            bookings = bookings.filter(customer_id=actor["id"])

        status_filter = request.query_params.get("status")
        if status_filter:
            bookings = bookings.filter(status=status_filter.upper())

        bookings = list(bookings[:200])
        return Response(
            {
                "count": len(bookings),
                "results": BookingSerializer(bookings, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class BookingDetailView(APIView):
    """GET /bookings/<ref> -> one booking, if it is yours to see."""

    authentication_classes = []
    permission_classes = []

    def get(self, request, reference):
        actor = _actor(request)
        booking = (
            Booking.objects.select_related("company", "shipment", "selection")
            .filter(reference=reference)
            .first()
        )
        if not booking:
            raise NotFound("Booking not found.")

        if not _may_touch_booking(booking, actor):
            raise PermissionDenied("This booking belongs to someone else.")

        payload = BookingSerializer(booking).data
        payload["history"] = StatusHistorySerializer(
            booking.selection.history.all(), many=True
        ).data
        return Response(payload, status=status.HTTP_200_OK)


class BookingCancelView(APIView):
    """POST /bookings/<ref>/cancel -> cancel a confirmed booking, with a reason.

    Either side may cancel, because either side can find they cannot proceed,
    but never a stranger: an unauthorised attempt is refused and audited, which
    is milestone test scenario 12.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request, reference):
        actor = _actor(request)
        booking = (
            Booking.objects.select_related("company", "selection")
            .filter(reference=reference)
            .first()
        )
        if not booking:
            raise NotFound("Booking not found.")

        if not _may_touch_booking(booking, actor):
            audit_service.record(
                actor_id=actor["id"] or actor["email"],
                actor_role=actor["role"],
                actor_email=actor["email"],
                action="BOOKING_CANCEL_DENIED",
                entity_type="BOOKING",
                entity_id=booking.reference,
                reason="Caller is neither the customer nor an agent of the company.",
            )
            raise PermissionDenied("You cannot change someone else's booking.")

        try:
            booking = cancel_booking(
                booking, actor=actor, reason=request.data.get("reason", "")
            )
        except (BookingError, lifecycle.InvalidSelectionTransitionError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

        audit_service.record(
            actor_id=actor["id"] or actor["email"],
            actor_role=actor["role"],
            actor_email=actor["email"],
            action="BOOKING_CANCELLED",
            entity_type="BOOKING",
            entity_id=booking.reference,
            reason=booking.cancellation_reason,
            changes={"status": {"to": "CANCELLED"}},
        )

        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)


def _may_touch_booking(booking, actor):
    """The customer who owns it, an agent of the carrying company, or staff."""
    if is_platform_wide(actor["role"]):
        return True
    if booking.customer_id == actor["id"]:
        return True
    return can_access_company(actor["email"], actor["role"], booking.company_id)
