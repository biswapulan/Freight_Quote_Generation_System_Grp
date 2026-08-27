from django.urls import path
from .views import (
    ShipmentCreateView,
    ShipmentQuoteGenerateView,
    CustomerQuoteListView,
    AdminQuoteListView,
    AdminQuoteStatusUpdateView,
    QuoteMarginView,
    QuoteApprovalsQueueView,
    QuoteApprovalDecisionView,
)

urlpatterns = [
    # Mentor Specification Core APIs
    path("shipments", ShipmentCreateView.as_view(), name="shipment-create"),
    path("shipments/", ShipmentCreateView.as_view(), name="shipment-create-slash"),
    path("shipments/my", ShipmentCreateView.as_view(), name="shipment-my-list"),
    path("shipments/my/", ShipmentCreateView.as_view(), name="shipment-my-list-slash"),
    path("shipments/<str:shipment_id>/quote", ShipmentQuoteGenerateView.as_view(), name="shipment-generate-quote"),
    path("shipments/<str:shipment_id>/quote/", ShipmentQuoteGenerateView.as_view(), name="shipment-generate-quote-slash"),
    
    path("quotes/my", CustomerQuoteListView.as_view(), name="quotes-my-list"),
    path("quotes/my/", CustomerQuoteListView.as_view(), name="quotes-my-list-slash"),
    path("quotes/<str:quote_id>", CustomerQuoteListView.as_view(), name="quote-detail-by-id"),
    path("quotes/<str:quote_id>/", CustomerQuoteListView.as_view(), name="quote-detail-by-id-slash"),
    
    path("admin/quotes", AdminQuoteListView.as_view(), name="admin-quotes-list"),
    path("admin/quotes/", AdminQuoteListView.as_view(), name="admin-quotes-list-slash"),
    path("admin/quotes/<str:quote_id>/status", AdminQuoteStatusUpdateView.as_view(), name="admin-quote-status-update"),
    path("admin/quotes/<str:quote_id>/status/", AdminQuoteStatusUpdateView.as_view(), name="admin-quote-status-update-slash"),

    # Milestone 2 Legacy endpoints
    path("quotes/<str:quote_id>/margin", QuoteMarginView.as_view(), name="quote-margin"),
    path("quotes/approvals/queue", QuoteApprovalsQueueView.as_view(), name="quote-approvals-queue"),
    path("quotes/approvals/<str:approval_id>/decision", QuoteApprovalDecisionView.as_view(), name="quote-approval-decision"),
]
