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
    # ---- Carrier-specific freight agents --------------------------------
    # A customer picks a carrier at the end of their enquiry and the quote is
    # routed to that carrier's agent, who sees only their own queue. These
    # emails must match the agentEmail values in generateRouteOptions.
    {
        "email": "agent.apex@freightai.com",
        "role": "agent",
        "full_name": "John — Apex Global Logistics",
        "company_name": "Apex Global Logistics (Maersk)",
    },
    {
        "email": "agent.pacific@freightai.com",
        "role": "agent",
        "full_name": "Sarah — Pacific Ocean Forwarders",
        "company_name": "Pacific Ocean Forwarders (CMA CGM)",
    },
    {
        "email": "agent.orient@freightai.com",
        "role": "agent",
        "full_name": "David — Orient Marine Line",
        "company_name": "Orient Marine Line (Hapag-Lloyd)",
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
