from django.conf import settings
from django.conf.urls.static import static
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
    path('api/', include('booking.urls')),
    path('api/', include('companies.urls')),
    path('api/', include('pricing.urls')),
    
    path('api/v1/', include('quotes.urls')),
    path('api/v1/', include('booking.urls')),
    path('api/v1/', include('companies.urls')),
    path('api/v1/', include('pricing.urls')),
    path('api/v1/', include('weather.urls')),
    path('api/v1/', include('customs.urls')),
    path('api/v1/', include('risk.urls')),
    path('api/v1/', include('integrations.urls')),
    path('api/v1/', include('orchestrator.urls')),
    path('api/v1/', include('audit.urls')),
    path('api/v1/', include('notifications.urls')),

    # Django Admin Site
    path('admin/', admin.site.urls),
]

# Uploaded trade documents. In production these are served by the web server or
# object store; this keeps them reachable during local development.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
