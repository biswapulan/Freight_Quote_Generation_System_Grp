from django.urls import path

from .views import NotificationListView, NotificationReadAllView, NotificationReadView

urlpatterns = [
    path("notifications", NotificationListView.as_view(), name="notifications-list"),
    path("notifications/", NotificationListView.as_view(), name="notifications-list-slash"),
    path(
        "notifications/read-all",
        NotificationReadAllView.as_view(),
        name="notifications-read-all",
    ),
    path(
        "notifications/read-all/",
        NotificationReadAllView.as_view(),
        name="notifications-read-all-slash",
    ),
    path(
        "notifications/<uuid:notification_id>/read",
        NotificationReadView.as_view(),
        name="notification-read",
    ),
    path(
        "notifications/<uuid:notification_id>/read/",
        NotificationReadView.as_view(),
        name="notification-read-slash",
    ),
]
