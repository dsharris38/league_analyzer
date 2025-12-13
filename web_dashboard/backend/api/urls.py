from django.urls import path
from .views import AnalysisListView, AnalysisDetailView, RunAnalysisView, DeepDiveAnalysisView, cached_meraki_items, cached_meraki_champions

urlpatterns = [
    path('analyses/', AnalysisListView.as_view(), name='analysis-list'),
    path('analyses/<str:filename>/', AnalysisDetailView.as_view(), name='analysis-detail'),
    path('analyses/<str:filename>/deep_dive/', DeepDiveAnalysisView.as_view(), name='deep-dive-analysis'),
    path('analyze/', RunAnalysisView.as_view(), name='run-analysis'),
    path('meraki/items/', cached_meraki_items, name='meraki-items'),
    path('meraki/champions/', cached_meraki_champions, name='meraki-champions'),
]
