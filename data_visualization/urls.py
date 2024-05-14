from django.urls import path
from . import views
from .views import allergy_visualization_view, allergy_intolerance_view, fetch_allergy_data_json

urlpatterns = [
    # Endpoint for the main visualization page
    path('allergy_visualization/', views.allergy_visualization_view, name='allergy_visualization'),

    # Endpoint for detailed allergy data display
    path('allergies/', views.allergy_intolerance_view, name='allergies'),

    # JSON endpoint for fetching processed allergy data
    path('api/allergy-data/', views.fetch_allergy_data_json, name='fetch_allergy_data_json'),
]
