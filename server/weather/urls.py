from django.urls import path
from .views import WeatherAssessView, WeatherAlertListView

urlpatterns = [
    path("weather/assess/", WeatherAssessView.as_view(), name="weather-assess"),
    path("weather/assess/<str:shipment_id>/", WeatherAssessView.as_view(), name="weather-assess-detail"),
    path("weather/alerts/", WeatherAlertListView.as_view(), name="weather-alerts"),
]
