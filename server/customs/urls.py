from django.urls import path

from .views import (
    CustomsSignOffView,
    CustomsValidateView,
    DocumentDeleteView,
    DocumentUploadView,
    DocumentVerifyView,
    HSCodeListView,
    RegulationSearchView,
    ShipmentDocumentListView,
)

urlpatterns = [
    path("customs/validate/", CustomsValidateView.as_view(), name="customs-validate"),
    path("customs/documents/upload/", DocumentUploadView.as_view(), name="customs-document-upload"),
    path("customs/documents/", ShipmentDocumentListView.as_view(), name="customs-documents-list"),
    path(
        "customs/documents/<uuid:document_id>",
        DocumentDeleteView.as_view(),
        name="customs-document-delete",
    ),
    path(
        "customs/documents/<uuid:document_id>/",
        DocumentDeleteView.as_view(),
        name="customs-document-delete-slash",
    ),
    path(
        "customs/documents/<uuid:document_id>/verify/",
        DocumentVerifyView.as_view(),
        name="customs-document-verify",
    ),
    path("customs/hs-codes/", HSCodeListView.as_view(), name="customs-hs-codes"),
    path("customs/<str:shipment_id>/", CustomsValidateView.as_view(), name="customs-detail"),
    path("customs/<str:check_id>/sign-off/", CustomsSignOffView.as_view(), name="customs-sign-off"),
    path("regulations/search/", RegulationSearchView.as_view(), name="regulations-search"),
]
