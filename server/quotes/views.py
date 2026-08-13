"""API views for Quote Margin adjustment, Floor Enforcement, and Approvals Queue — Milestone 2.
"""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.permissions import IsAuthenticatedMongoUser, IsAdminRole

from .margin_policy import resolve_margin_policy, enforce_margin_floor, MarginFloorViolationError
from .approval_rules import evaluate_approval_rules

# In-memory approval queue for development / demo state
MOCK_APPROVAL_QUEUE = [
    {
        "id": "app_99120",
        "quote_number": "QT-2026-00934",
        "customer_name": "Sharma Textiles Pvt Ltd",
        "rule_name": "Deep discount — margin below floor by >5 percentage points",
        "breach_reason": "Margin 8.0% is 5.0 points below the lane floor of 13.0%",
        "requested_margin_pct": 8.0,
        "floor_pct": 13.0,
        "gap_points": 5.0,
        "quote_value_inr": 398400.0,
        "approver_role": "PRICING_MANAGER",
        "decision": "PENDING",
        "requested_at": "2026-08-13T10:15:00Z",
    },
    {
        "id": "app_99121",
        "quote_number": "QT-2026-00941",
        "customer_name": "Apex Electronics Ltd",
        "rule_name": "Any component sourced as PREDICTED",
        "breach_reason": "Quote contains base ocean freight rate sourced as PREDICTED (no active rate card found).",
        "requested_margin_pct": 14.5,
        "floor_pct": 12.0,
        "gap_points": 0.0,
        "quote_value_inr": 620000.0,
        "approver_role": "SENIOR_BROKER",
        "decision": "PENDING",
        "requested_at": "2026-08-13T11:30:00Z",
    },
]


class QuoteMarginView(APIView):
    """PATCH /api/v1/quotes/{id}/margin — Server-side deterministic floor enforcement (HTTP 409 on breach)."""

    def patch(self, request, quote_id):
        requested_margin = request.data.get("requested_margin_pct")
        total_buy_cost = request.data.get("total_buy_cost", 300000.0)
        lane_key = request.data.get("lane_key", "INNSA-AEJEA")
        cargo_type = request.data.get("cargo_type", "general")
        customer_tier = request.data.get("customer_tier", "STRATEGIC")

        policy = resolve_margin_policy(
            lane_key=lane_key,
            cargo_type=cargo_type,
            customer_tier=customer_tier,
        )

        try:
            sell_price, margin_amount, applied_pct, _ = enforce_margin_floor(
                requested_margin, total_buy_cost, policy
            )
            return Response({
                "quote_id": quote_id,
                "status": "UPDATED",
                "applied_margin_pct": applied_pct,
                "margin_amount": margin_amount,
                "total_sell_price": sell_price,
                "policy_scope": policy["scope"],
                "policy_floor": policy["floor_pct"],
            }, status=status.HTTP_200_OK)

        except MarginFloorViolationError as err:
            # Create pending approval record for breach queue
            approval_rec = {
                "id": f"app_{quote_id}",
                "quote_number": f"QT-2026-{quote_id}",
                "customer_name": request.data.get("customer_name", "Valued Customer"),
                "rule_name": "Margin below floor violation",
                "breach_reason": str(err),
                "requested_margin_pct": err.requested_margin_pct,
                "floor_pct": err.floor_pct,
                "gap_points": err.gap_points,
                "quote_value_inr": total_buy_cost * (1 + err.requested_margin_pct / 100.0),
                "approver_role": "PRICING_MANAGER" if err.gap_points > 5.0 else "SENIOR_BROKER",
                "decision": "PENDING",
                "requested_at": "2026-08-13T12:00:00Z",
            }
            MOCK_APPROVAL_QUEUE.append(approval_rec)

            return Response({
                "error": "QUOTE_BELOW_MARGIN_FLOOR",
                "detail": str(err),
                "requested_margin_pct": err.requested_margin_pct,
                "floor_pct": err.floor_pct,
                "gap_points": err.gap_points,
                "policy_scope": err.scope,
                "approval_required": True,
                "approval_id": approval_rec["id"],
                "approver_role": approval_rec["approver_role"],
            }, status=status.HTTP_409_CONFLICT)


class QuoteApprovalsQueueView(APIView):
    """GET /api/v1/quotes/approvals/queue — Returns pending approvals for approver dashboard."""

    def get(self, request):
        role = request.query_params.get("role")
        pending = [a for a in MOCK_APPROVAL_QUEUE if a["decision"] == "PENDING"]
        if role:
            pending = [a for a in pending if a["approver_role"] == role]
        return Response({"results": pending, "count": len(pending)}, status=status.HTTP_200_OK)


class QuoteApprovalDecisionView(APIView):
    """POST /api/v1/quotes/approvals/{id}/decision — Approves or rejects a pending quote breach."""

    def post(self, request, approval_id):
        decision = (request.data.get("decision") or "").upper()
        comment = request.data.get("comment", "")

        if decision not in ("APPROVED", "REJECTED"):
            return Response(
                {"detail": "Decision must be APPROVED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if decision == "REJECTED" and not comment:
            return Response(
                {"detail": "Comment is mandatory when rejecting an approval request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for item in MOCK_APPROVAL_QUEUE:
            if item["id"] == approval_id:
                item["decision"] = decision
                item["comment"] = comment
                return Response({
                    "id": approval_id,
                    "status": decision,
                    "comment": comment,
                    "message": f"Approval request {approval_id} set to {decision}.",
                })

        return Response({"detail": "Approval request not found."}, status=status.HTTP_404_NOT_FOUND)
