"""URL routes for quote generation/history and admin rate config."""

from django.urls import path

from .views import (
    EstimateQuoteView,
    QuoteConfirmView,
    QuoteDetailView,
    QuoteListView,
    RateConfigView,
    CostBreakdownView,
    ValidateRateCardView,
    CommitRateCardView,
)

urlpatterns = [
    path("quotes/estimate/", EstimateQuoteView.as_view(), name="quote-estimate"),
    path("quotes/cost-breakdown/", CostBreakdownView.as_view(), name="cost-breakdown"),
    path("quotes/", QuoteListView.as_view(), name="quote-list"),
    path("quotes/<str:quote_id>/", QuoteDetailView.as_view(), name="quote-detail"),
    path("quotes/<str:quote_id>/confirm/", QuoteConfirmView.as_view(), name="quote-confirm"),
    path("admin/rate-config/", RateConfigView.as_view(), name="rate-config"),
    path("pricing/rate-cards/validate", ValidateRateCardView.as_view(), name="rate-cards-validate"),
    path("pricing/rate-cards/commit", CommitRateCardView.as_view(), name="rate-cards-commit"),
]
