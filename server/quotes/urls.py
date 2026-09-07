from django.urls import path, re_path

from .views import (
    AdminQuoteApproveView,
    AdminQuoteListView,
    AdminQuoteStatusUpdateView,
    CustomerCarrierSelectionView,
    CustomerQuoteDecisionView,
    CustomerQuoteListView,
    QuoteApprovalDecisionView,
    QuoteApprovalsQueueView,
    QuoteMarginView,
    QuoteReviewView,
    ShipmentCreateView,
    ShipmentDetailView,
    ShipmentQuoteGenerateView,
)

urlpatterns = [
    # ---- Shipments -------------------------------------------------------
    path("shipments", ShipmentCreateView.as_view(), name="shipment-create"),
    path("shipments/", ShipmentCreateView.as_view(), name="shipment-create-slash"),
    path("shipments/my", ShipmentCreateView.as_view(), name="shipment-my-list"),
    path("shipments/my/", ShipmentCreateView.as_view(), name="shipment-my-list-slash"),
    path(
        "shipments/<str:shipment_id>/quote",
        ShipmentQuoteGenerateView.as_view(),
        name="shipment-generate-quote",
    ),
    path(
        "shipments/<str:shipment_id>/quote/",
        ShipmentQuoteGenerateView.as_view(),
        name="shipment-generate-quote-slash",
    ),
    path("shipments/<str:shipment_id>", ShipmentDetailView.as_view(), name="shipment-detail"),
    path("shipments/<str:shipment_id>/", ShipmentDetailView.as_view(), name="shipment-detail-slash"),

    # ---- Customer quote views -------------------------------------------
    path("quotes/my", CustomerQuoteListView.as_view(), name="quotes-my-list"),
    path("quotes/my/", CustomerQuoteListView.as_view(), name="quotes-my-list-slash"),
    path(
        "quotes/<str:quote_id>/select-carrier",
        CustomerCarrierSelectionView.as_view(),
        name="quote-select-carrier",
    ),
    path(
        "quotes/<str:quote_id>/select-carrier/",
        CustomerCarrierSelectionView.as_view(),
        name="quote-select-carrier-slash",
    ),
    path(
        "quotes/<str:quote_id>/decision",
        CustomerQuoteDecisionView.as_view(),
        name="quote-customer-decision",
    ),
    path(
        "quotes/<str:quote_id>/decision/",
        CustomerQuoteDecisionView.as_view(),
        name="quote-customer-decision-slash",
    ),

    # ---- Freight agent review (PDF section 3, step 10) -------------------
    path("quotes/<str:quote_id>/review", QuoteReviewView.as_view(), name="quote-review"),
    path("quotes/<str:quote_id>/review/", QuoteReviewView.as_view(), name="quote-review-slash"),

    # ---- Milestone 2 legacy endpoints -----------------------------------
    path("quotes/<str:quote_id>/margin", QuoteMarginView.as_view(), name="quote-margin"),
    path("quotes/approvals/queue", QuoteApprovalsQueueView.as_view(), name="quote-approvals-queue"),
    path(
        "quotes/approvals/<str:approval_id>/decision",
        QuoteApprovalDecisionView.as_view(),
        name="quote-approval-decision",
    ),

    # Catch-all quote detail, declared last so the specific routes above win.
    #
    # This app and the pricing app are both mounted under /api/ and /api/v1/, and
    # this app is included first. A plain <str:quote_id> therefore swallowed the
    # pricing app's /quotes/estimate/ and /quotes/cost-breakdown/ endpoints,
    # treating "estimate" as a quote id and 404ing. The negative lookahead keeps
    # those verbs reachable.
    re_path(
        r"^quotes/(?!estimate|cost-breakdown|approvals|my)(?P<quote_id>[^/]+)/?$",
        CustomerQuoteListView.as_view(),
        name="quote-detail-by-id",
    ),

    # ---- Staff quote administration --------------------------------------
    path("admin/quotes", AdminQuoteListView.as_view(), name="admin-quotes-list"),
    path("admin/quotes/", AdminQuoteListView.as_view(), name="admin-quotes-list-slash"),
    path(
        "admin/quotes/<str:quote_id>/status",
        AdminQuoteStatusUpdateView.as_view(),
        name="admin-quote-status-update",
    ),
    path(
        "admin/quotes/<str:quote_id>/status/",
        AdminQuoteStatusUpdateView.as_view(),
        name="admin-quote-status-update-slash",
    ),
    path(
        "admin/quotes/<str:quote_id>/approve",
        AdminQuoteApproveView.as_view(),
        name="admin-quote-approve",
    ),
    path(
        "admin/quotes/<str:quote_id>/approve/",
        AdminQuoteApproveView.as_view(),
        name="admin-quote-approve-slash",
    ),
]
