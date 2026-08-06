"""Mongo collection access for the pricing app.

Follows the same direct-pymongo pattern as accounts/mongo.py — no ORM
translation layer, one client shared across the process.
"""

from datetime import datetime, timedelta

from pymongo import MongoClient, ReturnDocument
from pymongo.errors import PyMongoError
from django.conf import settings

from .engine import DEFAULT_RATE_CONFIG

# See accounts/mongo.py for why this uses a short serverSelectionTimeoutMS
# and swallows index-creation errors at import time.
client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
db = client[settings.MONGO_DB_NAME]

rate_config_collection = db["rate_config"]
quotes_collection = db["quotes"]

try:
    quotes_collection.create_index("user_id")
    quotes_collection.create_index("created_at")
except PyMongoError:
    pass

# Single-document config: this fixed id is always used so the config is a
# singleton — get_active_config()/save_rate_config() upsert against it.
RATE_CONFIG_DOC_ID = "active"


def get_active_rate_config():
    """Return the current rate config, seeding it with defaults on first use."""

    doc = rate_config_collection.find_one({"_id": RATE_CONFIG_DOC_ID})
    if doc is None:
        doc = {"_id": RATE_CONFIG_DOC_ID, **DEFAULT_RATE_CONFIG, "updated_at": datetime.utcnow()}
        rate_config_collection.insert_one(doc)
    return doc


def save_rate_config(updates, updated_by_email=None):
    """Merge `updates` into the active rate config and return the new document."""

    updates = dict(updates)
    updates["updated_at"] = datetime.utcnow()
    if updated_by_email:
        updates["updated_by"] = updated_by_email

    return rate_config_collection.find_one_and_update(
        {"_id": RATE_CONFIG_DOC_ID},
        {"$set": updates},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )


def create_quote_document(user, request_payload, quote_result, validity_days=7):
    """Persist a generated quote, scoped to the requesting user."""

    created_at = datetime.utcnow()

    doc = {
        "user_id": user["_id"],
        "user_email": user.get("email", ""),
        "user_role": user.get("role", "retail"),
        "origin": request_payload["origin"],
        "destination": request_payload["destination"],
        "weight_kg": request_payload["weight_kg"],
        "volume_m3": request_payload["volume_m3"],
        "cargo_type": request_payload["cargo_type"],
        "mode": request_payload["mode"],
        "distance_km": quote_result["distance_km"],
        "chargeable_weight_kg": quote_result["chargeable_weight_kg"],
        "transit_days": quote_result["transit_days"],
        "currency": quote_result["currency"],
        "breakdown": quote_result["breakdown"],
        "rates_used": quote_result["rates_used"],
        "status": "draft",
        "created_at": created_at,
        "expires_at": created_at + timedelta(days=validity_days),
    }
    result = quotes_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def list_quotes_for_user(user_id, limit=50):
    cursor = (
        quotes_collection.find({"user_id": user_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    return list(cursor)


def get_quote_for_user(quote_id, user_id):
    return quotes_collection.find_one({"_id": quote_id, "user_id": user_id})


def set_quote_status(quote_id, user_id, new_status):
    return quotes_collection.find_one_and_update(
        {"_id": quote_id, "user_id": user_id},
        {"$set": {"status": new_status}},
        return_document=ReturnDocument.AFTER,
    )
