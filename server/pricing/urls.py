"""URL routes for quote generation/history and admin rate config."""

from django.urls import path

from .views import (
    EstimateQuoteView,
    QuoteConfirmView,
    QuoteDetailView,
    QuoteListView,
    RateConfigView,
)

urlpatterns = [
    path("quotes/estimate/", EstimateQuoteView.as_view(), name="quote-estimate"),
    path("quotes/", QuoteListView.as_view(), name="quote-list"),
    path("quotes/<str:quote_id>/", QuoteDetailView.as_view(), name="quote-detail"),
    path("quotes/<str:quote_id>/confirm/", QuoteConfirmView.as_view(), name="quote-confirm"),
    path("admin/rate-config/", RateConfigView.as_view(), name="rate-config"),
]
