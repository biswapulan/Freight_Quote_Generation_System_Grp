from django.urls import path
from .views import (
    CustomsValidateView,
    CustomsSignOffView,
    RegulationSearchView,
    DocumentUploadView,
    HSCodeListView,
)

urlpatterns = [
    path("customs/validate/", CustomsValidateView.as_view(), name="customs-validate"),
    path("customs/documents/upload/", DocumentUploadView.as_view(), name="customs-document-upload"),
    path("customs/hs-codes/", HSCodeListView.as_view(), name="customs-hs-codes"),
    path("customs/<str:shipment_id>/", CustomsValidateView.as_view(), name="customs-detail"),
    path("customs/<str:check_id>/sign-off/", CustomsSignOffView.as_view(), name="customs-sign-off"),
    path("regulations/search/", RegulationSearchView.as_view(), name="regulations-search"),
]
