"""Create the freight companies and their agent memberships (M4 phase 1).

These three carriers previously existed only as hardcoded objects in the
browser bundle, with an agent email string attached. This promotes them to real
records so a quote can belong to a company and an agent's authority can be
checked rather than assumed.

The emails match the accounts created by `seed_demo_users`, so run that first.
Re-running this command is safe: it updates in place.
"""

from django.core.management.base import BaseCommand

from companies.models import CompanyAgent, FreightCompany

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

            # Put it back so a second pass over the module-level list still works.
            entry["agents"] = agents

        self.stdout.write(
            self.style.SUCCESS(
                f"\n{FreightCompany.objects.count()} companies, "
                f"{CompanyAgent.objects.count()} agent memberships."
            )
        )
