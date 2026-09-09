"""Administrator endpoints for freight companies and their agents.

M4 gives the platform admin the job of managing providers, mapping agents to
them and watching how each company performs. These are the only endpoints that
may change who can act for a company, so every one of them is admin-only: an
agent granting themselves access to a competitor's work would defeat the
isolation rule the rest of the milestone rests on.
"""

from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from quotes.auth_helper import get_current_user_and_role

from .access import resolve_user_id
from .models import CompanyAgent, CompanyRateCard, FreightCompany
from .serializers import (
    CompanyAgentSerializer,
    CompanyRateCardSerializer,
    FreightCompanySerializer,
)


def _actor(request):
    user_id, role, email = get_current_user_and_role(request)
    return {"id": user_id, "role": (role or "").lower(), "email": email or ""}


def _require_admin(request):
    actor = _actor(request)
    if actor["role"] != "admin":
        raise PermissionDenied("Only a platform administrator may manage companies.")
    return actor


class CompanyListCreateView(APIView):
    """GET/POST /admin/companies -> the provider register."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        _require_admin(request)
        companies = FreightCompany.objects.prefetch_related("rate_cards", "agents").all()

        status_filter = request.query_params.get("status")
        if status_filter:
            companies = companies.filter(status=status_filter.upper())

        data = FreightCompanySerializer(companies, many=True).data
        return Response({"count": len(data), "results": data}, status=status.HTTP_200_OK)

    def post(self, request):
        _require_admin(request)
        serializer = FreightCompanySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        company = serializer.save()
        return Response(
            FreightCompanySerializer(company).data, status=status.HTTP_201_CREATED
        )


class CompanyDetailView(APIView):
    """GET/PATCH /admin/companies/<code> -> one provider, and its rate card."""

    authentication_classes = []
    permission_classes = []

    def _get(self, identifier):
        company = FreightCompany.objects.filter(code__iexact=identifier).first()
        if not company:
            raise NotFound("Company not found.")
        return company

    def get(self, request, identifier):
        _require_admin(request)
        return Response(FreightCompanySerializer(self._get(identifier)).data)

    def patch(self, request, identifier):
        _require_admin(request)
        company = self._get(identifier)

        serializer = FreightCompanySerializer(company, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        company = serializer.save()

        # Rate card edits arrive alongside the company, since an administrator
        # thinks of them as one thing: what this company charges.
        card_data = request.data.get("rateCard")
        if isinstance(card_data, dict):
            card = company.rate_cards.filter(mode=card_data.get("mode", "ocean")).first()
            card_serializer = CompanyRateCardSerializer(
                card, data=card_data, partial=bool(card)
            )
            if not card_serializer.is_valid():
                return Response(
                    card_serializer.errors, status=status.HTTP_400_BAD_REQUEST
                )
            card_serializer.save(company=company)

        company.refresh_from_db()
        return Response(FreightCompanySerializer(company).data)


class CompanyAgentListCreateView(APIView):
    """GET/POST /admin/company-agents -> who may act for which company."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        _require_admin(request)
        agents = CompanyAgent.objects.select_related("company").all()

        company = request.query_params.get("company")
        if company:
            agents = agents.filter(company__code__iexact=company)

        data = CompanyAgentSerializer(agents, many=True).data
        return Response({"count": len(data), "results": data}, status=status.HTTP_200_OK)

    def post(self, request):
        _require_admin(request)

        code = request.data.get("companyCode") or request.data.get("company")
        company = FreightCompany.objects.filter(code__iexact=str(code)).first()
        if not company:
            return Response(
                {"error": f"No company with code '{code}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = (request.data.get("userEmail") or "").strip().lower()
        if not email:
            return Response(
                {"error": "An agent's email address is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if CompanyAgent.objects.filter(company=company, user_email__iexact=email).exists():
            return Response(
                {"error": f"{email} is already mapped to {company.name}."},
                status=status.HTTP_409_CONFLICT,
            )

        membership = CompanyAgent.objects.create(
            company=company,
            user_email=email,
            display_name=(request.data.get("displayName") or "").strip(),
            role=(request.data.get("role") or "AGENT").upper(),
            is_active=True,
            # Cache the platform id now so notifications reach them.
            user_id=resolve_user_id(email),
        )
        return Response(
            CompanyAgentSerializer(membership).data, status=status.HTTP_201_CREATED
        )


class CompanyAgentDetailView(APIView):
    """PATCH/DELETE /admin/company-agents/<id> -> change or revoke access."""

    authentication_classes = []
    permission_classes = []

    def _get(self, agent_id):
        membership = CompanyAgent.objects.select_related("company").filter(id=agent_id).first()
        if not membership:
            raise NotFound("Agent mapping not found.")
        return membership

    def patch(self, request, agent_id):
        _require_admin(request)
        membership = self._get(agent_id)

        if "role" in request.data:
            membership.role = (request.data["role"] or "AGENT").upper()
        if "isActive" in request.data:
            membership.is_active = bool(request.data["isActive"])
        if "displayName" in request.data:
            membership.display_name = request.data["displayName"] or ""
        membership.save()

        return Response(CompanyAgentSerializer(membership).data)

    def delete(self, request, agent_id):
        actor = _require_admin(request)
        membership = self._get(agent_id)

        from audit import service as audit_service

        audit_service.record(
            actor_id=actor["id"] or actor["email"],
            actor_role=actor["role"],
            actor_email=actor["email"],
            action="COMPANY_AGENT_REVOKED",
            entity_type="COMPANY_AGENT",
            entity_id=str(membership.id),
            reason=request.data.get("reason", "") if hasattr(request, "data") else "",
            context={
                "company": membership.company.code,
                "agent": membership.user_email,
            },
        )
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CompanyPerformanceView(APIView):
    """GET /admin/company-performance -> how each provider is actually doing.

    Approval rate, rejection rate, response time and conversion, which is the
    milestone's analytics requirement. Every figure is counted from the
    workflow records rather than stored separately, so it cannot drift.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        _require_admin(request)

        from booking.models import Booking, QuoteSelection, VerificationRequest

        rows = []
        for company in FreightCompany.objects.all():
            requests = VerificationRequest.objects.filter(company=company)
            decided = requests.exclude(decided_at=None)

            approved = decided.filter(
                status__in=["APPROVED", "BOOKING_CONFIRMED", "REVISION_ACCEPTED"]
            ).count()
            rejected = decided.filter(status="REJECTED").count()
            revised = decided.filter(status="REVISION_PENDING_CUSTOMER").count()
            total_decided = decided.count()

            # Averaged in Python from each request's own turnaround. Averaging
            # the two timestamps separately and subtracting is not the same
            # thing, and the ORM cannot express the difference portably.
            spans = [
                (r.decided_at - r.created_at).total_seconds() / 3600.0
                for r in decided
            ]
            response_hours = round(sum(spans) / len(spans), 2) if spans else None

            selections = QuoteSelection.objects.filter(company=company).count()
            bookings = Booking.objects.filter(company=company, status="CONFIRMED").count()

            rows.append(
                {
                    "companyId": str(company.id),
                    "companyCode": company.code,
                    "companyName": company.name,
                    "status": company.status,
                    "agents": company.agents.filter(is_active=True).count(),
                    "selections": selections,
                    "decided": total_decided,
                    "pending": requests.filter(decided_at=None).count(),
                    "overdue": sum(1 for r in requests if r.is_overdue),
                    "approved": approved,
                    "rejected": rejected,
                    "revised": revised,
                    "approvalRate": (
                        round(approved / total_decided * 100.0, 1)
                        if total_decided
                        else None
                    ),
                    "rejectionRate": (
                        round(rejected / total_decided * 100.0, 1)
                        if total_decided
                        else None
                    ),
                    "conversionRate": (
                        round(bookings / selections * 100.0, 1) if selections else None
                    ),
                    "bookings": bookings,
                    "avgResponseHours": response_hours,
                    "statedResponseHours": company.average_response_hours,
                }
            )

        rows.sort(key=lambda r: (-(r["selections"] or 0), r["companyName"]))
        return Response({"count": len(rows), "results": rows}, status=status.HTTP_200_OK)
