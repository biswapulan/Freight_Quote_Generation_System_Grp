from django.urls import path
from .views import DataFreshnessListView, IntegrationSyncLogListView

urlpatterns = [
    path("integrations/freshness/", DataFreshnessListView.as_view(), name="integrations-freshness"),
    path("integrations/sync-logs/", IntegrationSyncLogListView.as_view(), name="integrations-sync-logs"),
]
