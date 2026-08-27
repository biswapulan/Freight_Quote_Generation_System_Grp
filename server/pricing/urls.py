"""URL routes for quote generation/history, admin rate config, and ML pricing engine."""

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
    RouteAgentView,
    MLPricingPredictView,
    MLPricingBenchmarkReportView,
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
    path("pricing/route-recommendation/", RouteAgentView.as_view(), name="route-recommendation"),
    path("pricing/ml-predict/", MLPricingPredictView.as_view(), name="pricing-ml-predict"),
    path("pricing/ml-predict", MLPricingPredictView.as_view(), name="pricing-ml-predict-noslash"),
    path("pricing/benchmarks/", MLPricingBenchmarkReportView.as_view(), name="pricing-benchmarks"),
]
