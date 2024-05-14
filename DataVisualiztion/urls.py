from django.contrib import admin
from django.urls import path, include  # Include the 'include' function

urlpatterns = [
    path('admin/', admin.site.urls),
    path('data_visualization/', include('data_visualization.urls')),  # Delegate URLs under 'data/' to the app
]
