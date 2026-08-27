from django.urls import path
from .views import (
    RiskAssessView,
    RiskAlertListView,
    RiskAlertAcknowledgeView,
)

urlpatterns = [
    path("risk/assess/", RiskAssessView.as_view(), name="risk-assess"),
    path("risk/assess", RiskAssessView.as_view(), name="risk-assess-noslash"),
    path("risk/alerts/", RiskAlertListView.as_view(), name="risk-alerts-list"),
    path("risk/alerts/<str:alert_id>/acknowledge/", RiskAlertAcknowledgeView.as_view(), name="risk-alert-acknowledge"),
    path("alerts/", RiskAlertListView.as_view(), name="alerts-list"),
    path("alerts/<str:alert_id>/acknowledge/", RiskAlertAcknowledgeView.as_view(), name="alert-acknowledge"),
    path("risk/<str:shipment_id>/", RiskAssessView.as_view(), name="risk-detail"),
]
