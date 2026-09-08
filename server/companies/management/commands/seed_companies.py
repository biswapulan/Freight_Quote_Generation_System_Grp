"""Create the freight companies and their agent memberships (M4 phase 1).

These three carriers previously existed only as hardcoded objects in the
browser bundle, with an agent email string attached. This promotes them to real
records so a quote can belong to a company and an agent's authority can be
checked rather than assumed.

The emails match the accounts created by `seed_demo_users`, so run that first.
Re-running this command is safe: it updates in place.
"""

from django.core.management.base import BaseCommand

from companies.models import CompanyAgent, CompanyRateCard, FreightCompany

COMPANIES = [
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
        # Premium line haul, low fixed cost, fastest schedule.
        "rate_card": {
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
                "role": "MANAGER",
            }
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
        # Cheapest per km but slower and with higher fixed charges, so it wins
        # on long lanes and loses on short ones.
        "rate_card": {
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
            }
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
        # Weight-sensitive: competitive on light cargo, expensive on heavy.
        "rate_card": {
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
            }
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
                CompanyRateCard.objects.update_or_create(
                    company=company,
                    mode="ocean",
                    defaults={**rate_card, "currency": "INR", "is_active": True},
                )
                self.stdout.write(
                    f"  rate card: {rate_card['rate_per_km']}/km + "
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
