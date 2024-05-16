from django.urls import path
from . import views

urlpatterns = [
    path('allergy_visualization/', views.allergy_visualization_view, name='allergy_visualization'),
    path('api/allergy-data/', views.fetch_allergy_data_json, name='fetch_allergy_data_json'),
    path('post-allergy-data/', views.post_allergy_data, name='post_allergy_data'),  
]
