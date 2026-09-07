"""Read-only audit log API. Admin portal -> Audit Logs (PDF section 6)."""

from rest_framework.response import Response
from rest_framework.views import APIView

from quotes.auth_helper import get_current_user_and_role, require_admin

from .models import AuditLog
from .serializers import AuditLogSerializer

MAX_PAGE_SIZE = 200


class AuditLogListView(APIView):
    """GET /api/v1/audit/logs -> filtered audit trail (admin only)."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        require_admin(request)

        qs = AuditLog.objects.all()

        entity_type = request.query_params.get("entity_type")
        if entity_type:
            qs = qs.filter(entity_type=entity_type.upper())

        entity_id = request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)

        action = request.query_params.get("action")
        if action:
            qs = qs.filter(action=action.upper())

        actor_role = request.query_params.get("actor_role")
        if actor_role:
            qs = qs.filter(actor_role=actor_role.lower())

        try:
            limit = min(int(request.query_params.get("limit", 100)), MAX_PAGE_SIZE)
        except (TypeError, ValueError):
            limit = 100

        total = qs.count()
        rows = qs[:limit]

        return Response(
            {
                "count": total,
                "returned": len(rows),
                "results": AuditLogSerializer(rows, many=True).data,
            }
        )


class EntityAuditTrailView(APIView):
    """GET /api/v1/audit/trail/<entity_type>/<entity_id> -> history for one record.

    Available to any authenticated staff role so a Freight Agent can see who
    changed a quote without being handed the whole platform's audit log.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request, entity_type, entity_id):
        get_current_user_and_role(request)

        rows = AuditLog.objects.filter(
            entity_type=entity_type.upper(),
            entity_id=entity_id,
        )
        return Response(
            {
                "entity_type": entity_type.upper(),
                "entity_id": entity_id,
                "count": rows.count(),
                "results": AuditLogSerializer(rows, many=True).data,
            }
        )
