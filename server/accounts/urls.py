"""URL routes for the authentication API."""

from django.urls import path

from .views import (
    ForgotPasswordView,
    LoginView,
    MeView,
    ResetPasswordView,
    SavedAddressDetailView,
    SavedAddressesView,
    SupportTicketsView,
    TawkIdentityView,
    SignupView,
)

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('me/', MeView.as_view(), name='me'),
    path('saved-addresses/', SavedAddressesView.as_view(), name='saved-addresses'),
    path('saved-addresses/<str:address_id>/', SavedAddressDetailView.as_view(), name='saved-address-detail'),
    path('support-tickets/', SupportTicketsView.as_view(), name='support-tickets'),
    path('tawk-identity/', TawkIdentityView.as_view(), name='tawk-identity'),
]
