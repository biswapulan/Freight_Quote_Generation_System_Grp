"""URL routing for Quote Margin, Floor Enforcement and Approvals Queue — Milestone 2.
"""

from django.urls import path
from .views import QuoteMarginView, QuoteApprovalsQueueView, QuoteApprovalDecisionView

urlpatterns = [
    path("quotes/<str:quote_id>/margin", QuoteMarginView.as_view(), name="quote-margin"),
    path("quotes/approvals/queue", QuoteApprovalsQueueView.as_view(), name="quote-approvals-queue"),
    path("quotes/approvals/<str:approval_id>/decision", QuoteApprovalDecisionView.as_view(), name="quote-approval-decision"),
]
