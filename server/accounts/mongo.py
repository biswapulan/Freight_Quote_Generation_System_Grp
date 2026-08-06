# server/accounts/mongo.py
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from django.conf import settings

# A short server-selection timeout means a missing/unreachable MongoDB fails
# fast (a few seconds) instead of blocking every process that imports this
# module — including `manage.py check`/`test` — for pymongo's 30s default.
client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
db = client[settings.MONGO_DB_NAME]

users_collection = db["users"]

try:
    users_collection.create_index("email", unique=True)
except PyMongoError:
    # Mongo isn't reachable at import time (e.g. local dev without it
    # running yet, or a management command that doesn't need the DB).
    # Don't crash the whole process for this — the index is created lazily
    # the next time Mongo is reachable and this module is re-imported, and
    # any real query against an unreachable DB will raise its own clear
    # error at the call site instead.
    pass