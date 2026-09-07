"""Small JWT helpers used by the Mongo authentication flow."""

from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings


def create_token(user_id, role=None, email=None, expires_in_hours=24):
    """Create a signed JWT for a user.

    The role is embedded in the signed payload so downstream services can
    authorise a request without a database round trip, and — unlike the
    ``X-User-Role`` header this replaces — the caller cannot alter it.
    """

    now = datetime.now(timezone.utc)
    payload = {
        'user_id': str(user_id),
        'iat': now,
        'exp': now + timedelta(hours=expires_in_hours),
    }
    if role:
        payload['role'] = str(role).lower()
    if email:
        payload['email'] = email

    return jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')


def decode_token(token):
    """Decode and validate a signed JWT, raising PyJWT errors on failure."""

    return jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
