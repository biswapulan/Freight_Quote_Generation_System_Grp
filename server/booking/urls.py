"""M4 booking workflow routes."""

from django.urls import path

from .views import (
    QuoteCompanyOptionsView,
    VerificationCheckUpdateView,
    VerificationDecisionView,
    VerificationDetailView,
    VerificationQueueView,
)

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

urlpatterns += [
    path(
        "verification-requests",
        VerificationQueueView.as_view(),
        name="verification-queue",
    ),
    path(
        "verification-requests/",
        VerificationQueueView.as_view(),
        name="verification-queue-slash",
    ),
    path(
        "verification-requests/<str:reference>",
        VerificationDetailView.as_view(),
        name="verification-detail",
    ),
    path(
        "verification-requests/<str:reference>/",
        VerificationDetailView.as_view(),
        name="verification-detail-slash",
    ),
]

urlpatterns += [
    path(
        "verification-requests/<str:reference>/checks",
        VerificationCheckUpdateView.as_view(),
        name="verification-checks",
    ),
    path(
        "verification-requests/<str:reference>/checks/",
        VerificationCheckUpdateView.as_view(),
        name="verification-checks-slash",
    ),
    path(
        "verification-requests/<str:reference>/decision",
        VerificationDecisionView.as_view(),
        name="verification-decision",
    ),
    path(
        "verification-requests/<str:reference>/decision/",
        VerificationDecisionView.as_view(),
        name="verification-decision-slash",
    ),
]
