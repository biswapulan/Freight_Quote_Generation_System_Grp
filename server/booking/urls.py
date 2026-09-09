"""M4 booking workflow routes."""

from django.urls import path

from .views import (
    AdminSelectionsView,
    BookingCancelView,
    BookingDetailView,
    BookingListView,
    MySelectionsView,
    ProvideInformationView,
    QuoteCompanyOptionsView,
    RevisionResponseView,
    SelectionDetailView,
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

urlpatterns += [
    path("selections/my", MySelectionsView.as_view(), name="my-selections"),
    path("selections/my/", MySelectionsView.as_view(), name="my-selections-slash"),
    path(
        "selections/<str:reference>",
        SelectionDetailView.as_view(),
        name="selection-detail",
    ),
    path(
        "selections/<str:reference>/revision-response",
        RevisionResponseView.as_view(),
        name="selection-revision-response",
    ),
    path(
        "selections/<str:reference>/revision-response/",
        RevisionResponseView.as_view(),
        name="selection-revision-response-slash",
    ),
    path(
        "selections/<str:reference>/information",
        ProvideInformationView.as_view(),
        name="selection-information",
    ),
    path(
        "selections/<str:reference>/information/",
        ProvideInformationView.as_view(),
        name="selection-information-slash",
    ),
]

urlpatterns += [
    path("bookings", BookingListView.as_view(), name="bookings"),
    path("bookings/", BookingListView.as_view(), name="bookings-slash"),
    path("bookings/<str:reference>", BookingDetailView.as_view(), name="booking-detail"),
    path(
        "bookings/<str:reference>/cancel",
        BookingCancelView.as_view(),
        name="booking-cancel",
    ),
    path(
        "bookings/<str:reference>/cancel/",
        BookingCancelView.as_view(),
        name="booking-cancel-slash",
    ),
]

urlpatterns += [
    path("admin/selections", AdminSelectionsView.as_view(), name="admin-selections"),
    path(
        "admin/selections/",
        AdminSelectionsView.as_view(),
        name="admin-selections-slash",
    ),
]
