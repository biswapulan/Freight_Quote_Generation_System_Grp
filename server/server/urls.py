from django.contrib import admin
from django.urls import include, path
from accounts.views import LoginView

urlpatterns = [
    # Mentor Specification Root Paths & API Views (Placed before admin.site to capture /admin/quotes)
    path('login', LoginView.as_view(), name='root-login'),
    path('login/', LoginView.as_view(), name='root-login-slash'),
    path('', include('quotes.urls')),
    
    # API Prefixes
    path('api/auth/', include('accounts.urls')),
    path('api/login', LoginView.as_view(), name='api-login'),
    path('api/login/', LoginView.as_view(), name='api-login-slash'),
    path('api/', include('quotes.urls')),
    path('api/', include('pricing.urls')),
    
    path('api/v1/', include('quotes.urls')),
    path('api/v1/', include('pricing.urls')),
    path('api/v1/', include('weather.urls')),
    path('api/v1/', include('customs.urls')),
    path('api/v1/', include('risk.urls')),
    path('api/v1/', include('integrations.urls')),

    # Django Admin Site
    path('admin/', admin.site.urls),
]
