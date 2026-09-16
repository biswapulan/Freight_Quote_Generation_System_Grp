"""Create the freight companies and their agent memberships (M4 phase 1 & multi-modal expansion).

These carriers promote freight forwarders to real records so a quote can belong
to a company and an agent's authority can be checked rather than assumed.
Includes dedicated real carrier companies across Ocean Freight, Air Freight,
Express Air, and Ground & Rail transport modes.

The emails match the accounts created by `seed_demo_users`, so run that first.
Re-running this command is safe: it updates in place.
"""

from django.core.management.base import BaseCommand

from companies.models import CompanyAgent, CompanyRateCard, FreightCompany

COMPANIES = [
    # =========================================================================
    # 1. OCEAN FREIGHT CARRIERS
    # =========================================================================
    {
        "code": "maersk",
        "name": "Maersk",
        "legal_name": "A.P. Moller - Maersk A/S",
        "modes": ["ocean"],
        "service_name": "MECL Service - weekly sailing",
        "headquarters": "Copenhagen, Denmark",
        "contact_email": "ops@maersk.example",
        "on_time_performance": 94.0,
        "average_response_hours": 4.0,
        "manager_approval_threshold": 200000.0,
        "manager_approval_high_risk": True,
        "rate_card": {
            "mode": "ocean",
            "base_booking_fee": 8000.0,
            "rate_per_km": 22.0,
            "rate_per_kg": 1.6,
            "fuel_surcharge_pct": 11.0,
            "handling_fee": 21000.0,
            "documentation_fee": 3000.0,
            "minimum_charge": 45000.0,
            "transit_days_delta": 0,
            "validity_days": 14,
        },
        "agents": [
            {
                "email": "agent.apex@freightai.com",
                "name": "John - Apex Global Logistics",
                "role": "AGENT",
            },
            {
                "email": "manager.apex@freightai.com",
                "name": "Priya - Maersk Operations Manager",
                "role": "MANAGER",
            },
        ],
    },
    {
        "code": "cma-cgm",
        "name": "CMA CGM",
        "legal_name": "CMA CGM S.A.",
        "modes": ["ocean"],
        "service_name": "via Salalah - biweekly",
        "headquarters": "Marseille, France",
        "contact_email": "ops@cma-cgm.example",
        "on_time_performance": 88.0,
        "average_response_hours": 6.0,
        "manager_approval_threshold": 175000.0,
        "manager_approval_high_risk": True,
        "rate_card": {
            "mode": "ocean",
            "base_booking_fee": 15000.0,
            "rate_per_km": 16.5,
            "rate_per_kg": 1.15,
            "fuel_surcharge_pct": 13.5,
            "handling_fee": 18500.0,
            "documentation_fee": 3500.0,
            "minimum_charge": 40000.0,
            "transit_days_delta": -2,
            "validity_days": 10,
        },
        "agents": [
            {
                "email": "agent.pacific@freightai.com",
                "name": "Sarah - Pacific Ocean Forwarders",
                "role": "AGENT",
            },
            {
                "email": "manager.pacific@freightai.com",
                "name": "Arjun - CMA CGM Operations Manager",
                "role": "MANAGER",
            },
        ],
    },
    {
        "code": "hapag-lloyd",
        "name": "Hapag-Lloyd",
        "legal_name": "Hapag-Lloyd AG",
        "modes": ["ocean"],
        "service_name": "IMEX Service - fortnightly",
        "headquarters": "Hamburg, Germany",
        "contact_email": "ops@hapag-lloyd.example",
        "on_time_performance": 91.0,
        "average_response_hours": 5.0,
        "manager_approval_threshold": 190000.0,
        "manager_approval_high_risk": True,
        "rate_card": {
            "mode": "ocean",
            "base_booking_fee": 6000.0,
            "rate_per_km": 19.0,
            "rate_per_kg": 2.4,
            "fuel_surcharge_pct": 9.0,
            "handling_fee": 24000.0,
            "documentation_fee": 2500.0,
            "minimum_charge": 42000.0,
            "transit_days_delta": 2,
            "validity_days": 21,
        },
        "agents": [
            {
                "email": "agent.orient@freightai.com",
                "name": "David - Orient Marine Line",
                "role": "AGENT",
            },
            {
                "email": "manager.orient@freightai.com",
                "name": "Meera - Hapag-Lloyd Operations Manager",
                "role": "MANAGER",
            },
        ],
    },

    # =========================================================================
    # 2. AIR FREIGHT CARRIERS
    # =========================================================================
    {
        "code": "emirates-skycargo",
        "name": "Emirates SkyCargo",
        "legal_name": "Emirates SkyCargo LLC",
        "modes": ["air"],
        "service_name": "SkyCargo Priority Cargo — Daily Scheduled Flights",
        "headquarters": "Dubai, United Arab Emirates",
        "contact_email": "ops@emirates-skycargo.example",
        "on_time_performance": 94.5,
        "average_response_hours": 3.0,
        "manager_approval_threshold": 250000.0,
        "manager_approval_high_risk": True,
        "rate_card": {
            "mode": "air",
            "base_booking_fee": 5000.0,
            "rate_per_km": 8.5,
            "rate_per_kg": 22.0,
            "fuel_surcharge_pct": 15.0,
            "handling_fee": 8500.0,
            "documentation_fee": 4000.0,
            "minimum_charge": 35000.0,
            "transit_days_delta": -9,
            "validity_days": 7,
        },
        "agents": [
            {
                "email": "agent.skycargo@freightai.com",
                "name": "Farhan - SkyLink Aviation Logistics",
                "role": "AGENT",
            },
            {
                "email": "manager.skycargo@freightai.com",
                "name": "Tariq - Emirates SkyCargo Operations Director",
                "role": "MANAGER",
            },
        ],
    },
    {
        "code": "lufthansa-cargo",
        "name": "Lufthansa Cargo",
        "legal_name": "Lufthansa Cargo AG",
        "modes": ["air"],
        "service_name": "td.Pro Air Cargo — Direct European Hub Feeder",
        "headquarters": "Frankfurt, Germany",
        "contact_email": "ops@lufthansa-cargo.example",
        "on_time_performance": 92.0,
        "average_response_hours": 3.5,
        "manager_approval_threshold": 220000.0,
        "manager_approval_high_risk": True,
        "rate_card": {
            "mode": "air",
            "base_booking_fee": 7500.0,
            "rate_per_km": 7.8,
            "rate_per_kg": 24.5,
            "fuel_surcharge_pct": 14.0,
            "handling_fee": 9200.0,
            "documentation_fee": 4500.0,
            "minimum_charge": 38000.0,
            "transit_days_delta": -9,
            "validity_days": 10,
        },
        "agents": [
            {
                "email": "agent.lufthansa@freightai.com",
                "name": "Hans - AeroTrans Global Forwarding",
                "role": "AGENT",
            },
            {
                "email": "manager.lufthansa@freightai.com",
                "name": "Klaus - Lufthansa Cargo Regional Manager",
                "role": "MANAGER",
            },
        ],
    },
    {
        "code": "qatar-cargo",
        "name": "Qatar Airways Cargo",
        "legal_name": "Qatar Airways Cargo Q.C.S.C.",
        "modes": ["air"],
        "service_name": "QR Global Cargo Connect — Scheduled Freighter Network",
        "headquarters": "Doha, Qatar",
        "contact_email": "ops@qatar-cargo.example",
        "on_time_performance": 93.0,
        "average_response_hours": 4.0,
        "manager_approval_threshold": 230000.0,
        "manager_approval_high_risk": True,
        "rate_card": {
            "mode": "air",
            "base_booking_fee": 6000.0,
            "rate_per_km": 7.2,
            "rate_per_kg": 20.5,
            "fuel_surcharge_pct": 16.0,
            "handling_fee": 8000.0,
            "documentation_fee": 3800.0,
            "minimum_charge": 32000.0,
            "transit_days_delta": -8,
            "validity_days": 7,
        },
        "agents": [
            {
                "email": "agent.qatarcargo@freightai.com",
                "name": "Yasmin - Al-Maha Freight Network",
                "role": "AGENT",
            },
            {
                "email": "manager.qatarcargo@freightai.com",
                "name": "Rashid - Qatar Cargo Gateway Lead",
                "role": "MANAGER",
            },
        ],
    },

    # =========================================================================
    # 3. EXPRESS AIR CARRIERS
    # =========================================================================
    {
        "code": "dhl-express",
        "name": "DHL Express",
        "legal_name": "DHL Express International GmbH",
        "modes": ["express"],
        "service_name": "Time Definite International (TDI 12:00)",
        "headquarters": "Bonn, Germany",
        "contact_email": "ops@dhl-express.example",
        "on_time_performance": 97.5,
        "average_response_hours": 1.5,
        "manager_approval_threshold": 300000.0,
        "manager_approval_high_risk": True,
        "rate_card": {
            "mode": "express",
            "base_booking_fee": 12000.0,
            "rate_per_km": 12.0,
            "rate_per_kg": 38.0,
            "fuel_surcharge_pct": 18.0,
            "handling_fee": 12500.0,
            "documentation_fee": 5000.0,
            "minimum_charge": 55000.0,
            "transit_days_delta": -12,
            "validity_days": 5,
        },
        "agents": [
            {
                "email": "agent.dhl@freightai.com",
                "name": "Marcus - DHL Express World Desk",
                "role": "AGENT",
            },
            {
                "email": "manager.dhl@freightai.com",
                "name": "Elena - DHL Express Hub Director",
                "role": "MANAGER",
            },
        ],
    },
    {
        "code": "fedex-express",
        "name": "FedEx Express",
        "legal_name": "Federal Express Corporation",
        "modes": ["express"],
        "service_name": "FedEx International Priority (IP Direct)",
        "headquarters": "Memphis, Tennessee, USA",
        "contact_email": "ops@fedex-express.example",
        "on_time_performance": 96.0,
        "average_response_hours": 2.0,
        "manager_approval_threshold": 280000.0,
        "manager_approval_high_risk": True,
        "rate_card": {
            "mode": "express",
            "base_booking_fee": 10500.0,
            "rate_per_km": 11.5,
            "rate_per_kg": 36.0,
            "fuel_surcharge_pct": 17.5,
            "handling_fee": 11800.0,
            "documentation_fee": 4800.0,
            "minimum_charge": 52000.0,
            "transit_days_delta": -12,
            "validity_days": 5,
        },
        "agents": [
            {
                "email": "agent.fedex@freightai.com",
                "name": "Bradley - FedEx Global Logistics",
                "role": "AGENT",
            },
            {
                "email": "manager.fedex@freightai.com",
                "name": "Chloe - FedEx Operations Lead",
                "role": "MANAGER",
            },
        ],
    },
    {
        "code": "ups-express",
        "name": "UPS Express",
        "legal_name": "United Parcel Service, Inc.",
        "modes": ["express"],
        "service_name": "UPS Worldwide Express Saver",
        "headquarters": "Atlanta, Georgia, USA",
        "contact_email": "ops@ups-express.example",
        "on_time_performance": 95.5,
        "average_response_hours": 2.0,
        "manager_approval_threshold": 270000.0,
        "manager_approval_high_risk": True,
        "rate_card": {
            "mode": "express",
            "base_booking_fee": 9800.0,
            "rate_per_km": 11.0,
            "rate_per_kg": 34.5,
            "fuel_surcharge_pct": 16.5,
            "handling_fee": 11000.0,
            "documentation_fee": 4500.0,
            "minimum_charge": 48000.0,
            "transit_days_delta": -11,
            "validity_days": 5,
        },
        "agents": [
            {
                "email": "agent.ups@freightai.com",
                "name": "Nathan - UPS Supply Chain Solutions",
                "role": "AGENT",
            },
            {
                "email": "manager.ups@freightai.com",
                "name": "Derek - UPS Air Hub Controller",
                "role": "MANAGER",
            },
        ],
    },

    # =========================================================================
    # 4. GROUND & RAIL CARRIERS
    # =========================================================================
    {
        "code": "concor-rail",
        "name": "CONCOR Rail Express",
        "legal_name": "Container Corporation of India Ltd.",
        "modes": ["ground", "rail", "road"],
        "service_name": "CONCOR Liner Rail Express — Daily Scheduled Rakes",
        "headquarters": "New Delhi, India",
        "contact_email": "ops@concor-rail.example",
        "on_time_performance": 89.0,
        "average_response_hours": 4.5,
        "manager_approval_threshold": 160000.0,
        "manager_approval_high_risk": True,
        "rate_card": {
            "mode": "ground",
            "base_booking_fee": 4500.0,
            "rate_per_km": 11.5,
            "rate_per_kg": 0.85,
            "fuel_surcharge_pct": 8.0,
            "handling_fee": 7500.0,
            "documentation_fee": 2000.0,
            "minimum_charge": 25000.0,
            "transit_days_delta": -7,
            "validity_days": 21,
        },
        "agents": [
            {
                "email": "agent.concor@freightai.com",
                "name": "Rajesh - Northern Rail Freight Lines",
                "role": "AGENT",
            },
            {
                "email": "manager.concor@freightai.com",
                "name": "Vikram - CONCOR Terminal General Manager",
                "role": "MANAGER",
            },
        ],
    },
    {
        "code": "db-cargo",
        "name": "DB Cargo",
        "legal_name": "DB Cargo AG",
        "modes": ["ground", "rail", "road"],
        "service_name": "DB Trans-Eurasia Intermodal Rail Shuttle",
        "headquarters": "Mainz, Germany",
        "contact_email": "ops@db-cargo.example",
        "on_time_performance": 87.5,
        "average_response_hours": 5.0,
        "manager_approval_threshold": 180000.0,
        "manager_approval_high_risk": True,
        "rate_card": {
            "mode": "ground",
            "base_booking_fee": 6000.0,
            "rate_per_km": 13.0,
            "rate_per_kg": 0.95,
            "fuel_surcharge_pct": 9.0,
            "handling_fee": 8500.0,
            "documentation_fee": 2500.0,
            "minimum_charge": 28000.0,
            "transit_days_delta": -6,
            "validity_days": 18,
        },
        "agents": [
            {
                "email": "agent.dbcargo@freightai.com",
                "name": "Stefan - EuroRail Intermodal",
                "role": "AGENT",
            },
            {
                "email": "manager.dbcargo@freightai.com",
                "name": "Greta - DB Cargo Corridor Director",
                "role": "MANAGER",
            },
        ],
    },
    {
        "code": "bnsf-rail",
        "name": "BNSF Railway Intermodal",
        "legal_name": "BNSF Railway Company",
        "modes": ["ground", "rail", "road"],
        "service_name": "BNSF Coast-to-Coast Rail Shuttle",
        "headquarters": "Fort Worth, Texas, USA",
        "contact_email": "ops@bnsf-rail.example",
        "on_time_performance": 90.0,
        "average_response_hours": 4.0,
        "manager_approval_threshold": 195000.0,
        "manager_approval_high_risk": True,
        "rate_card": {
            "mode": "ground",
            "base_booking_fee": 5200.0,
            "rate_per_km": 12.2,
            "rate_per_kg": 0.90,
            "fuel_surcharge_pct": 8.5,
            "handling_fee": 8000.0,
            "documentation_fee": 2200.0,
            "minimum_charge": 27000.0,
            "transit_days_delta": -6,
            "validity_days": 20,
        },
        "agents": [
            {
                "email": "agent.bnsf@freightai.com",
                "name": "Cole - Prairie States Intermodal Forwarders",
                "role": "AGENT",
            },
            {
                "email": "manager.bnsf@freightai.com",
                "name": "Hannah - BNSF Freight Operations Superintendent",
                "role": "MANAGER",
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Seed freight companies and map their agent accounts."

    def handle(self, *args, **options):
        for entry in COMPANIES:
            agents = entry.pop("agents", [])
            rate_card = entry.pop("rate_card", None)
            code = entry["code"]

            company, created = FreightCompany.objects.update_or_create(
                code=code,
                defaults={**entry, "status": "ACTIVE"},
            )
            verb = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{verb} company {company.name}"))

            for agent in agents:
                membership, made = CompanyAgent.objects.update_or_create(
                    company=company,
                    user_email=agent["email"],
                    defaults={
                        "display_name": agent["name"],
                        "role": agent["role"],
                        "is_active": True,
                    },
                )
                verb = "linked" if made else "refreshed"
                self.stdout.write(
                    f"  {verb} {membership.user_email} as {membership.role}"
                )

            if rate_card:
                card_mode = rate_card.get("mode") or (entry.get("modes") or ["ocean"])[0]
                card_data = {k: v for k, v in rate_card.items() if k != "mode"}
                CompanyRateCard.objects.update_or_create(
                    company=company,
                    mode=card_mode,
                    defaults={**card_data, "currency": "INR", "is_active": True},
                )
                self.stdout.write(
                    f"  rate card ({card_mode}): {rate_card['rate_per_km']}/km + "
                    f"{rate_card['rate_per_kg']}/kg + {rate_card['fuel_surcharge_pct']}% fuel"
                )

            # Put them back so a second pass over the module-level list works.
            entry["agents"] = agents
            if rate_card:
                entry["rate_card"] = rate_card

        self.stdout.write(
            self.style.SUCCESS(
                f"\n{FreightCompany.objects.count()} companies, "
                f"{CompanyAgent.objects.count()} agent memberships, "
                f"{CompanyRateCard.objects.count()} rate cards."
            )
        )
