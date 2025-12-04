from django.urls import path
from .views import AnalysisListView, AnalysisDetailView, RunAnalysisView, DeepDiveAnalysisView

urlpatterns = [
    path('analyses/', AnalysisListView.as_view(), name='analysis-list'),
    path('analyses/<str:filename>/', AnalysisDetailView.as_view(), name='analysis-detail'),
    path('analyses/<str:filename>/deep_dive/', DeepDiveAnalysisView.as_view(), name='deep-dive-analysis'),
    path('analyze/', RunAnalysisView.as_view(), name='run-analysis'),
]
