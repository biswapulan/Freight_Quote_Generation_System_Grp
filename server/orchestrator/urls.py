from django.urls import path

from .views import AgentMonitorView, OrchestrationRunListView, OrchestratorAnalyzeView

urlpatterns = [
    path("orchestrator/analyze", OrchestratorAnalyzeView.as_view(), name="orchestrator-analyze"),
    path("orchestrator/analyze/", OrchestratorAnalyzeView.as_view(), name="orchestrator-analyze-slash"),
    path("orchestrator/runs", OrchestrationRunListView.as_view(), name="orchestrator-runs"),
    path("orchestrator/runs/", OrchestrationRunListView.as_view(), name="orchestrator-runs-slash"),
    path("orchestrator/agents", AgentMonitorView.as_view(), name="orchestrator-agents"),
    path("orchestrator/agents/", AgentMonitorView.as_view(), name="orchestrator-agents-slash"),
]
