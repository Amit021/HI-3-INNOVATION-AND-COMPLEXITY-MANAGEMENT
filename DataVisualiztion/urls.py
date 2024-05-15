from django.contrib import admin
from django.urls import path, include  
from data_visualization import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('data_visualization/', include('data_visualization.urls')),  
    path('', views.allergy_visualization_view, name='home'),
]
