"""Administrator routes for freight companies and agent mappings."""

from django.urls import path

from .views import (
    CompanyAgentDetailView,
    CompanyAgentListCreateView,
    CompanyDetailView,
    CompanyListCreateView,
    CompanyPerformanceView,
)

urlpatterns = [
    path("admin/companies", CompanyListCreateView.as_view(), name="admin-companies"),
    path("admin/companies/", CompanyListCreateView.as_view(), name="admin-companies-slash"),
    path(
        "admin/companies/<str:identifier>",
        CompanyDetailView.as_view(),
        name="admin-company-detail",
    ),
    path(
        "admin/company-agents",
        CompanyAgentListCreateView.as_view(),
        name="admin-company-agents",
    ),
    path(
        "admin/company-agents/",
        CompanyAgentListCreateView.as_view(),
        name="admin-company-agents-slash",
    ),
    path(
        "admin/company-agents/<uuid:agent_id>",
        CompanyAgentDetailView.as_view(),
        name="admin-company-agent-detail",
    ),
    path(
        "admin/company-performance",
        CompanyPerformanceView.as_view(),
        name="admin-company-performance",
    ),
    path(
        "admin/company-performance/",
        CompanyPerformanceView.as_view(),
        name="admin-company-performance-slash",
    ),
]
