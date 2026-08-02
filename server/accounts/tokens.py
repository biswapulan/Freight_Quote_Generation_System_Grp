"""Small JWT helpers used by the Mongo authentication flow."""

from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings


def create_token(user_id, expires_in_hours=24):
    """Create a signed JWT containing the Mongo user id as a string."""

    now = datetime.now(timezone.utc)
    payload = {
        'user_id': str(user_id),
        'iat': now,
        'exp': now + timedelta(hours=expires_in_hours),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')


def decode_token(token):
    """Decode and validate a signed JWT, raising PyJWT errors on failure."""

    return jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
