# server/quotes/mongo.py
from django.conf import settings

from accounts.mongo import client

db = client[settings.MONGO_DB_NAME]

quotes_collection = db["quotes"]
