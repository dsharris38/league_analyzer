from django.urls import path
from .views import AnalysisListView, AnalysisDetailView, RunAnalysisView

urlpatterns = [
    path('analyses/', AnalysisListView.as_view(), name='analysis-list'),
    path('analyses/<str:filename>/', AnalysisDetailView.as_view(), name='analysis-detail'),
    path('analyze/', RunAnalysisView.as_view(), name='run-analysis'),
]
