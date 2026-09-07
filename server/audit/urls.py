from django.urls import path

from .views import AuditLogListView, EntityAuditTrailView

urlpatterns = [
    path("audit/logs", AuditLogListView.as_view(), name="audit-logs"),
    path("audit/logs/", AuditLogListView.as_view(), name="audit-logs-slash"),
    path(
        "audit/trail/<str:entity_type>/<str:entity_id>",
        EntityAuditTrailView.as_view(),
        name="audit-trail",
    ),
    path(
        "audit/trail/<str:entity_type>/<str:entity_id>/",
        EntityAuditTrailView.as_view(),
        name="audit-trail-slash",
    ),
]
