"""DRF authentication class for Authorization: Bearer JWTs."""

import jwt
from bson import ObjectId
from bson.errors import InvalidId
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .mongo import users_collection
from .tokens import decode_token


class MongoUser(dict):
    is_authenticated = True

class MongoJWTAuthentication(BaseAuthentication):
    """Authenticate requests by loading the Mongo user referenced by a JWT."""

    def authenticate(self, request):
        auth = get_authorization_header(request).split()

        if not auth:
            return None

        if auth[0].lower() != b'bearer':
            return None

        if len(auth) != 2:
            raise AuthenticationFailed('Invalid authorization header')

        token = auth[1].decode('utf-8')

        try:
            payload = decode_token(token)
            if not payload.get('user_id'):
                raise jwt.InvalidTokenError('Missing user_id')
            user_id = ObjectId(payload['user_id'])
        except jwt.ExpiredSignatureError as exc:
            raise AuthenticationFailed('Token has expired') from exc
        except (jwt.InvalidTokenError, InvalidId, TypeError) as exc:
            raise AuthenticationFailed('Invalid token') from exc

        user = users_collection.find_one({'_id': user_id})
        if not user:
            raise AuthenticationFailed('User not found')

        user.pop('password', None)
        return (MongoUser(user), token)
