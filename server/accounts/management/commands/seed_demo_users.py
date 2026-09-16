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
    # ---- Carrier-specific freight agents & managers ----------------------
    # A customer picks a carrier at the end of their enquiry and the quote is
    # routed to that carrier's agent, who sees only their own queue.
    # 1. Ocean
    {
        "email": "agent.apex@freightai.com",
        "role": "agent",
        "full_name": "John — Apex Global Logistics",
        "company_name": "Apex Global Logistics (Maersk)",
    },
    {
        "email": "manager.apex@freightai.com",
        "role": "agent",
        "full_name": "Priya — Maersk Operations Manager",
        "company_name": "Apex Global Logistics (Maersk)",
    },
    {
        "email": "agent.pacific@freightai.com",
        "role": "agent",
        "full_name": "Sarah — Pacific Ocean Forwarders",
        "company_name": "Pacific Ocean Forwarders (CMA CGM)",
    },
    {
        "email": "manager.pacific@freightai.com",
        "role": "agent",
        "full_name": "Arjun — CMA CGM Operations Manager",
        "company_name": "Pacific Ocean Forwarders (CMA CGM)",
    },
    {
        "email": "agent.orient@freightai.com",
        "role": "agent",
        "full_name": "David — Orient Marine Line",
        "company_name": "Orient Marine Line (Hapag-Lloyd)",
    },
    {
        "email": "manager.orient@freightai.com",
        "role": "agent",
        "full_name": "Meera — Hapag-Lloyd Operations Manager",
        "company_name": "Orient Marine Line (Hapag-Lloyd)",
    },

    # 2. Air Freight
    {
        "email": "agent.skycargo@freightai.com",
        "role": "agent",
        "full_name": "Farhan — SkyLink Aviation Logistics",
        "company_name": "SkyLink Aviation Logistics (Emirates SkyCargo)",
    },
    {
        "email": "manager.skycargo@freightai.com",
        "role": "agent",
        "full_name": "Tariq — Emirates SkyCargo Operations Director",
        "company_name": "SkyLink Aviation Logistics (Emirates SkyCargo)",
    },
    {
        "email": "agent.lufthansa@freightai.com",
        "role": "agent",
        "full_name": "Hans — AeroTrans Global Forwarding",
        "company_name": "AeroTrans Global Forwarding (Lufthansa Cargo)",
    },
    {
        "email": "manager.lufthansa@freightai.com",
        "role": "agent",
        "full_name": "Klaus — Lufthansa Cargo Regional Manager",
        "company_name": "AeroTrans Global Forwarding (Lufthansa Cargo)",
    },
    {
        "email": "agent.qatarcargo@freightai.com",
        "role": "agent",
        "full_name": "Yasmin — Al-Maha Freight Network",
        "company_name": "Al-Maha Freight Network (Qatar Airways Cargo)",
    },
    {
        "email": "manager.qatarcargo@freightai.com",
        "role": "agent",
        "full_name": "Rashid — Qatar Cargo Gateway Lead",
        "company_name": "Al-Maha Freight Network (Qatar Airways Cargo)",
    },

    # 3. Express Air
    {
        "email": "agent.dhl@freightai.com",
        "role": "agent",
        "full_name": "Marcus — DHL Express World Desk",
        "company_name": "DHL Express World Desk",
    },
    {
        "email": "manager.dhl@freightai.com",
        "role": "agent",
        "full_name": "Elena — DHL Express Hub Director",
        "company_name": "DHL Express World Desk",
    },
    {
        "email": "agent.fedex@freightai.com",
        "role": "agent",
        "full_name": "Bradley — FedEx Global Logistics",
        "company_name": "FedEx Global Logistics Hub",
    },
    {
        "email": "manager.fedex@freightai.com",
        "role": "agent",
        "full_name": "Chloe — FedEx Operations Lead",
        "company_name": "FedEx Global Logistics Hub",
    },
    {
        "email": "agent.ups@freightai.com",
        "role": "agent",
        "full_name": "Nathan — UPS Supply Chain Solutions",
        "company_name": "UPS Supply Chain Solutions",
    },
    {
        "email": "manager.ups@freightai.com",
        "role": "agent",
        "full_name": "Derek — UPS Air Hub Controller",
        "company_name": "UPS Supply Chain Solutions",
    },

    # 4. Ground & Rail
    {
        "email": "agent.concor@freightai.com",
        "role": "agent",
        "full_name": "Rajesh — Northern Rail Freight Lines",
        "company_name": "Northern Rail Freight Lines (CONCOR)",
    },
    {
        "email": "manager.concor@freightai.com",
        "role": "agent",
        "full_name": "Vikram — CONCOR Terminal General Manager",
        "company_name": "Northern Rail Freight Lines (CONCOR)",
    },
    {
        "email": "agent.dbcargo@freightai.com",
        "role": "agent",
        "full_name": "Stefan — EuroRail Intermodal",
        "company_name": "EuroRail Intermodal (DB Cargo)",
    },
    {
        "email": "manager.dbcargo@freightai.com",
        "role": "agent",
        "full_name": "Greta — DB Cargo Corridor Director",
        "company_name": "EuroRail Intermodal (DB Cargo)",
    },
    {
        "email": "agent.bnsf@freightai.com",
        "role": "agent",
        "full_name": "Cole — Prairie States Intermodal",
        "company_name": "Prairie States Intermodal Forwarders (BNSF)",
    },
    {
        "email": "manager.bnsf@freightai.com",
        "role": "agent",
        "full_name": "Hannah — BNSF Freight Operations Superintendent",
        "company_name": "Prairie States Intermodal Forwarders (BNSF)",
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
