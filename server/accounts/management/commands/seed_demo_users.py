"""Seed all demo accounts required for presentation and testing."""

from datetime import datetime
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from accounts.mongo import users_collection

DEMO_USERS = [
    {
        "email": "customer@freightai.com",
        "role": "retail",
        "full_name": "Customer Shipper",
        "company_name": "Global Retail Cargo",
    },
    {
        "email": "retail@freightai.com",
        "role": "retail",
        "full_name": "Retail Customer",
        "company_name": "Swift Retailers Co",
    },
    {
        "email": "agent@freightai.com",
        "role": "agent",
        "full_name": "Freight Agent",
        "company_name": "FreightAI Operations",
    },
    {
        "email": "customs@freightai.com",
        "role": "customs",
        "full_name": "Chief Customs Officer",
        "company_name": "Port Customs Authority",
    },
    {
        "email": "admin@freightai.com",
        "role": "admin",
        "full_name": "Platform Admin",
        "company_name": "FreightAI HQ",
    },
    {
        "email": "business@freightai.com",
        "role": "business",
        "full_name": "Business User",
        "company_name": "Apex Exports Pvt Ltd",
    },
]

class Command(BaseCommand):
    help = "Seed standard demo accounts with password Password123!"

    def handle(self, *args, **options):
        password_hash = make_password("Password123!")
        for u in DEMO_USERS:
            email = u["email"].lower()
            existing = users_collection.find_one({"email": email})
            if existing:
                users_collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"password": password_hash, "role": u["role"], "full_name": u["full_name"], "company_name": u["company_name"], "is_active": True}}
                )
                self.stdout.write(self.style.SUCCESS(f"Updated {email} ({u['role']})"))
            else:
                users_collection.insert_one({
                    "email": email,
                    "password": password_hash,
                    "role": u["role"],
                    "full_name": u["full_name"],
                    "company_name": u["company_name"],
                    "gst_number": "",
                    "is_active": True,
                    "created_at": datetime.utcnow(),
                })
                self.stdout.write(self.style.SUCCESS(f"Created {email} ({u['role']})"))
