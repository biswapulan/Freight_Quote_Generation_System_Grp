"""
WSGI config for server project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'server.settings')

application = get_wsgi_application()

# Render starts this service on an empty disk with no shell, so the server
# applies its migrations and seeds its demo data itself (bootstrap.py), then
# keeps itself from being put to sleep (keep_awake.py).
from server import bootstrap, keep_awake  # noqa: E402

bootstrap.run()
keep_awake.start()
