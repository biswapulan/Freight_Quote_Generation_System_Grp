"""M4 booking workflow endpoints. Phase 2: the company offers a customer compares."""

from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from audit import service as audit_service
from companies.access import (
    can_act_for_company,
    can_view_company_work,
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
    CustomsClearance,
    QuoteSelection,
    VerificationCheck,
    VerificationRequest,
)
from .offer_engine import generate_company_quotes
from .serializers import (
    BookingSerializer,
    CompanyQuoteSerializer,
    CustomsClearanceSerializer,
    QuoteRevisionSerializer,
    QuoteSelectionSerializer,
    StatusHistorySerializer,
    VerificationCheckSerializer,
    VerificationRequestSerializer,
)
from .services import (
    CUSTOMS_ROLES,
    BookingError,
    CustomerResponseError,
    CustomsDecisionError,
    DecisionError,
    cancel_booking,
    customer_final_decision,
    decide_customs,
    move_selection,
    notify_customer_of_decision,
    notify_managers_of_escalation,
    provide_requested_information,
    respond_to_revision,
    submit_decision,
)

# M4 is the companies' workflow: their agents act in it and the administrator
# monitors it. Customs officers have their own desk for trade documents.
STAFF_ROLES = ("admin", "agent")


def _actor(request):
    user_id, role, email = get_current_user_and_role(request)
    return {"id": user_id, "role": (role or "").lower(), "email": email or ""}


def _viewer_rights(vr, actor):
    """What the caller may do with this request, so screens need not guess."""
    member = can_act_for_company(actor["email"], actor["role"], vr.company_id)
    manager = member and is_manager_of(actor["email"], vr.company_id)
    actionable = vr.status in lifecycle.AGENT_ACTIONABLE
    return {
        "viewerIsManager": manager,
        "canCheck": member and actionable,
        "canDecide": member and actionable and (vr.status != lifecycle.ESCALATED or manager),
    }


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
        # competitor's pricing is never exposed through this endpoint. An agent
        # with no company sees none, rather than every company's.
        if actor["role"] == "agent":
            own = set(memberships_for(actor["email"]).values_list("company_id", flat=True))
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
            raise PermissionDenied(
                "Only company agents and the platform administrator may view this queue."
            )

        # Which companies the caller manages, so the desk can show a manager
        # the escalations waiting for them.
        viewer = {
            "managerOf": sorted(
                {m.company.name for m in memberships_for(actor["email"]).filter(role="MANAGER")}
            )
        }

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
                    {
                        "count": 0,
                        "results": [],
                        "detail": "No company membership.",
                        "viewer": viewer,
                    },
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
                "viewer": viewer,
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

        is_owner_agent = can_act_for_company(actor["email"], actor["role"], vr.company_id)
        is_the_customer = vr.selection.customer_id == actor["id"]
        monitors = is_platform_wide(actor["role"])

        if not (is_owner_agent or is_the_customer or monitors):
            # Milestone test scenario 3: another company's agent is refused, and
            # so is anyone else who is neither party nor the administrator.
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
        payload.update(_viewer_rights(vr, actor))
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

        if not can_act_for_company(actor["email"], actor["role"], vr.company_id):
            raise PermissionDenied(
                "This verification request belongs to another company."
            )

        area =(request.data.get("area") or "").upper()
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

        if not can_act_for_company(actor["email"], actor["role"], vr.company_id):
            raise PermissionDenied(
                "You cannot decide on another company's verification request."
            )

        action = request.data.get("action")
        # Once escalated, the request is a manager's to decide, whichever way:
        # approving, revising or rejecting. That is the point of escalating.
        if vr.status == lifecycle.ESCALATED and not is_manager_of(
            actor["email"], vr.company_id
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
        if vr.status == lifecycle.ESCALATED:
            notify_managers_of_escalation(vr)

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
        payload.update(_viewer_rights(vr, actor))
        return Response(payload, status=status.HTTP_200_OK)


def _selection_for_customer(reference, actor, *, allow_admin=False):
    """Fetch a selection the caller is entitled to see, or to act on.

    The administrator may look at any selection to monitor it, but accepting a
    revision or answering a company's questions is the customer's alone.
    """
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
    if not is_owner and not (allow_admin and is_platform_wide(actor["role"])):
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
        selection = _selection_for_customer(reference, actor, allow_admin=True)

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

    A customer sees their own. A company agent sees their companies'. The
    administrator sees the platform. Nobody else sees a booking that belongs to
    neither their customer account nor their company.
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

        if not _may_view_booking(booking, actor):
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

        if not _may_cancel_booking(booking, actor):
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


def _may_view_booking(booking, actor):
    """The customer who owns it, the carrying company's agents, or the admin."""
    if booking.customer_id == actor["id"]:
        return True
    return can_view_company_work(actor["email"], actor["role"], booking.company_id)


def _may_cancel_booking(booking, actor):
    """Either party to the booking. The administrator monitors; they do not cancel."""
    if booking.customer_id == actor["id"]:
        return True
    return can_act_for_company(actor["email"], actor["role"], booking.company_id)


class FinalDecisionView(APIView):
    """POST /selections/<ref>/final-decision -> the customer books or declines.

    The company has approved the request and customs has cleared it, so this
    is the customer's last word: accepting creates the booking, declining
    closes the request and leaves them free to choose another company.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request, reference):
        actor = _actor(request)
        selection = _selection_for_customer(reference, actor)
        note = request.data.get("note", "")

        try:
            selection, booking = customer_final_decision(
                selection,
                decision=request.data.get("decision"),
                actor=actor,
                note=note,
            )
        except (
            CustomerResponseError,
            BookingError,
            lifecycle.InvalidSelectionTransitionError,
        ) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

        audit_service.record(
            actor_id=actor["id"] or actor["email"],
            actor_role=actor["role"],
            actor_email=actor["email"],
            action="BOOKING_CONFIRMED_BY_CUSTOMER" if booking else "BOOKING_DECLINED_BY_CUSTOMER",
            entity_type="QUOTE_SELECTION",
            entity_id=selection.reference,
            reason=note,
            changes={"status": {"to": selection.status}},
            context={"booking": booking.reference if booking else None},
        )

        selection.refresh_from_db()
        payload = QuoteSelectionSerializer(selection).data
        payload["booking"] = BookingSerializer(booking).data if booking else None
        payload["canReselect"] = selection.status == lifecycle.RESELECT_QUOTE
        return Response(payload, status=status.HTTP_200_OK)


def _clearances():
    return CustomsClearance.objects.select_related(
        "selection",
        "selection__company",
        "selection__company_quote",
        "selection__shipment",
        "selection__quote",
        "selection__verification",
    )


class CustomsClearanceQueueView(APIView):
    """GET /customs-clearances -> requests companies approved, for customs to clear.

    Customs is the platform's own desk, so an officer sees every company's
    approved requests. The administrator may watch the queue; deciding is the
    officer's alone.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        actor = _actor(request)
        if actor["role"] not in CUSTOMS_ROLES and not is_platform_wide(actor["role"]):
            raise PermissionDenied("Only customs officers review booking clearances.")

        clearances = _clearances()
        wanted = (request.query_params.get("status") or "").upper()
        if wanted in ("PENDING", "CLEARED", "REJECTED"):
            clearances = clearances.filter(status=wanted)

        rows = CustomsClearanceSerializer(list(clearances[:200]), many=True).data
        summary = {
            key: CustomsClearance.objects.filter(status=key).count()
            for key in ("PENDING", "CLEARED", "REJECTED")
        }
        return Response(
            {
                "count": len(rows),
                "summary": summary,
                "canDecide": actor["role"] in CUSTOMS_ROLES,
                "results": rows,
            },
            status=status.HTTP_200_OK,
        )


class CustomsClearanceDecisionView(APIView):
    """POST /customs-clearances/<ref>/decision -> clear or reject the shipment.

    A rejection needs a reason, which the customer and the company both read.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request, reference):
        actor = _actor(request)
        clearance = _clearances().filter(reference=reference).first()
        if not clearance:
            raise NotFound("Customs clearance not found.")

        if actor["role"] not in CUSTOMS_ROLES:
            raise PermissionDenied("Only a customs officer may clear or reject a shipment.")

        try:
            clearance = decide_customs(
                clearance,
                decision=request.data.get("decision"),
                actor=actor,
                reason=request.data.get("reason", ""),
            )
        except (CustomsDecisionError, lifecycle.InvalidSelectionTransitionError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

        audit_service.record(
            actor_id=actor["id"] or actor["email"],
            actor_role=actor["role"],
            actor_email=actor["email"],
            action=f"CUSTOMS_{clearance.status}",
            entity_type="CUSTOMS_CLEARANCE",
            entity_id=clearance.reference,
            reason=clearance.reason,
            changes={"status": {"to": clearance.status}},
            context={
                "selection": clearance.selection.reference,
                "company": clearance.selection.company.code,
            },
        )

        clearance = _clearances().get(pk=clearance.pk)
        return Response(
            CustomsClearanceSerializer(clearance).data, status=status.HTTP_200_OK
        )


class AdminSelectionsView(APIView):
    """GET /admin/selections -> every customer selection on the platform.

    The admin's view of who chose whom and where each request stopped, which is
    the milestone's "monitor customer selections" page. Read-only: an
    administrator watches this workflow rather than acting inside it, because
    approving on a company's behalf would make the company's verification
    meaningless.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        actor = _actor(request)
        if actor["role"] != "admin":
            raise PermissionDenied("Only a platform administrator may view this.")

        selections = (
            QuoteSelection.objects.select_related("company", "company_quote", "shipment")
            .prefetch_related("revisions")
            .all()
        )

        company = request.query_params.get("company")
        if company:
            selections = selections.filter(company__code__iexact=company)

        status_filter = request.query_params.get("status")
        if status_filter:
            selections = selections.filter(status=status_filter.upper())

        if request.query_params.get("stalled") in ("1", "true", "True"):
            selections = selections.filter(
                status__in=sorted(lifecycle.AGENT_ACTIONABLE)
            )

        selections = list(selections[:300])

        rows = []
        for sel in selections:
            row = QuoteSelectionSerializer(sel).data
            pending = sel.revisions.filter(status="PENDING_CUSTOMER").first()
            row["pendingRevision"] = (
                QuoteRevisionSerializer(pending).data if pending else None
            )
            row["revisionCount"] = sel.revisions.count()
            row["awaitingCompany"] = lifecycle.is_agent_actionable(sel.status)
            row["awaitingCustomer"] = lifecycle.is_customer_actionable(sel.status)
            rows.append(row)

        # A quick read of where the platform's work is sitting.
        summary = {
            "total": len(rows),
            "awaitingCompany": sum(1 for r in rows if r["awaitingCompany"]),
            "awaitingCustomer": sum(1 for r in rows if r["awaitingCustomer"]),
            "withCustoms": sum(
                1 for r in rows if r["status"] in lifecycle.CUSTOMS_ACTIONABLE
            ),
            "booked": sum(1 for r in rows if r["status"] == lifecycle.BOOKING_CONFIRMED),
            "lost": sum(
                1
                for r in rows
                if r["status"]
                in (lifecycle.REJECTED, lifecycle.CUSTOMS_REJECTED, lifecycle.RESELECT_QUOTE)
            ),
        }

        return Response(
            {"count": len(rows), "summary": summary, "results": rows},
            status=status.HTTP_200_OK,
        )
