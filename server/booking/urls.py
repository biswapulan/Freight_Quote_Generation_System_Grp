"""M4 booking workflow routes."""

from django.urls import path

from .views import QuoteCompanyOptionsView

urlpatterns = [
    path(
        "quotes/<str:quote_id>/company-quotes",
        QuoteCompanyOptionsView.as_view(),
        name="quote-company-options",
    ),
    path(
        "quotes/<str:quote_id>/company-quotes/",
        QuoteCompanyOptionsView.as_view(),
        name="quote-company-options-slash",
    ),
]
