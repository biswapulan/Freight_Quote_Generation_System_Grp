"""Orchestrator API — run the agent pipeline, and report on how the agents behaved."""

from django.db.models import Avg, Count, Q
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from quotes.auth_helper import get_current_user_and_role
from quotes.models import Shipment

from .models import AgentInvocation, OrchestrationRun
from .serializers import OrchestrationRunSerializer
from .service import AIOrchestrator

# Displayed in the AI Agent Monitor alongside live telemetry.
AGENT_CATALOG = [
    {
        "agent": "ROUTE",
        "name": "Route Agent",
        "responsibility": "Route options, distance and ETA",
        "output": "Recommended route",
    },
    {
        "agent": "PRICING",
        "name": "Pricing Agent",
        "responsibility": "Rule price + ML prediction comparison",
        "output": "Recommended price",
    },
    {
        "agent": "WEATHER",
        "name": "Weather Agent",
        "responsibility": "Weather and delay analysis",
        "output": "Weather risk",
    },
    {
        "agent": "CUSTOMS",
        "name": "Customs Agent",
        "responsibility": "Documents and customs requirements",
        "output": "Customs risk",
    },
    {
        "agent": "RISK",
        "name": "Risk Agent",
        "responsibility": "Combines all risk signals",
        "output": "Overall risk + recommendation",
    },
]


class OrchestratorAnalyzeView(APIView):
    """POST /api/v1/orchestrator/analyze -> run every agent against a shipment.

    Read-only with respect to the quote: it produces the analysis, it does not
    issue a quote. The Quote Engine does that.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        user_id, role, _email = get_current_user_and_role(request)

        shipment_id = request.data.get("shipment_id")
        if not shipment_id:
            return Response(
                {"error": "shipment_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            shipment = Shipment.objects.get(id=shipment_id)
        except Shipment.DoesNotExist:
            raise NotFound("Shipment not found.")

        if role.lower() not in ("admin", "agent", "customs") and shipment.customer_id != user_id:
            raise PermissionDenied("You do not have permission to analyse this shipment.")

        result = AIOrchestrator.analyze(
            shipment,
            quote_id=request.data.get("quote_id"),
            triggered_by=f"{role}:{user_id}",
        )
        return Response(result, status=status.HTTP_200_OK)


class OrchestrationRunListView(APIView):
    """GET /api/v1/orchestrator/runs -> recent pipeline executions."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        get_current_user_and_role(request)

        qs = OrchestrationRun.objects.prefetch_related("invocations")

        shipment_id = request.query_params.get("shipment_id")
        if shipment_id:
            qs = qs.filter(shipment_id=shipment_id)

        try:
            limit = min(int(request.query_params.get("limit", 25)), 100)
        except (TypeError, ValueError):
            limit = 25

        rows = qs[:limit]
        return Response(
            {
                "count": qs.count(),
                "results": OrchestrationRunSerializer(rows, many=True).data,
            }
        )


class AgentMonitorView(APIView):
    """GET /api/v1/orchestrator/agents -> per-agent health for the Admin monitor.

    Replaces the static AGENT_SPECIFICATIONS array the React component used to
    hold, with counts and latencies measured from real invocations.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        get_current_user_and_role(request)

        stats = {
            row["agent"]: row
            for row in AgentInvocation.objects.values("agent").annotate(
                invocations=Count("id"),
                avg_duration_ms=Avg("duration_ms"),
                failures=Count("id", filter=Q(status="FAILED")),
                degraded=Count("id", filter=Q(status="DEGRADED")),
            )
        }

        agents = []
        for entry in AGENT_CATALOG:
            measured = stats.get(entry["agent"], {})
            invocations = measured.get("invocations", 0)
            failures = measured.get("failures", 0)
            degraded = measured.get("degraded", 0)
            healthy = invocations - failures - degraded

            agents.append(
                {
                    **entry,
                    "invocations": invocations,
                    "healthy": healthy,
                    "degraded": degraded,
                    "failures": failures,
                    "avg_duration_ms": round(measured.get("avg_duration_ms") or 0.0, 1),
                    "success_rate": round((healthy / invocations) * 100, 1) if invocations else None,
                    "status": _agent_status(invocations, failures, degraded),
                }
            )

        total_runs = OrchestrationRun.objects.count()
        return Response(
            {
                "orchestrator": {
                    "name": "AI Orchestrator",
                    "responsibility": "Controls workflow and calls required agents",
                    "output": "Combined analysis state",
                    "total_runs": total_runs,
                    "degraded_runs": OrchestrationRun.objects.filter(status="DEGRADED").count(),
                    "failed_runs": OrchestrationRun.objects.filter(status="FAILED").count(),
                },
                "agent_flow": [
                    "AI ORCHESTRATOR",
                    "ROUTE AGENT",
                    "PRICING AGENT",
                    "WEATHER AGENT + CUSTOMS AGENT",
                    "RISK AGENT",
                    "QUOTE ENGINE",
                ],
                "agents": agents,
            }
        )


def _agent_status(invocations: int, failures: int, degraded: int) -> str:
    if not invocations:
        return "IDLE"
    if failures:
        return "ERROR"
    if degraded:
        return "DEGRADED"
    return "HEALTHY"
