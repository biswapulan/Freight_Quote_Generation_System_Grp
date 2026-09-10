"""What the server does for itself when it starts on an empty disk."""

import pytest
from django.contrib.auth.hashers import check_password

from companies.models import CompanyRateCard, FreightCompany
from server import bootstrap


class FakeUsers:
    """Records upserts instead of talking to MongoDB, which the suite lacks."""

    def __init__(self):
        self.calls = []

    def update_one(self, query, update, upsert=False):
        self.calls.append((query, update, upsert))


@pytest.mark.django_db
def test_companies_are_seeded_once_and_admin_edits_survive_a_restart():
    bootstrap.ensure_companies()
    assert FreightCompany.objects.count() == 3

    card = CompanyRateCard.objects.get(company__code="maersk")
    card.rate_per_km = 99.0
    card.save()

    bootstrap.ensure_companies()  # the next start
    assert FreightCompany.objects.count() == 3
    assert CompanyRateCard.objects.get(company__code="maersk").rate_per_km == 99.0


def test_demo_accounts_accept_the_documented_password(monkeypatch):
    users = FakeUsers()
    monkeypatch.setattr("accounts.mongo.users_collection", users)

    bootstrap.ensure_demo_users()

    emails = {query["email"] for query, _, _ in users.calls}
    assert {
        "customer@freightai.com",
        "agent@freightai.com",
        "customs@freightai.com",
        "admin@freightai.com",
    } <= emails
    for _, update, upsert in users.calls:
        assert upsert is True
        assert check_password(bootstrap.DEMO_PASSWORD, update["$set"]["password"])
        assert update["$set"]["is_active"] is True
        # Profile fields are written on creation only, never overwritten.
        assert "full_name" not in update["$set"]
        assert "full_name" in update["$setOnInsert"]


def test_a_failing_step_does_not_stop_the_others(monkeypatch):
    monkeypatch.delenv("AUTO_BOOTSTRAP", raising=False)
    ran = []

    def broken():
        raise RuntimeError("mongo is down")

    monkeypatch.setattr(bootstrap, "STEPS", (broken, lambda: ran.append("next")))
    bootstrap.run()
    assert ran == ["next"]


def test_bootstrap_can_be_switched_off(monkeypatch):
    monkeypatch.setenv("AUTO_BOOTSTRAP", "false")
    ran = []
    monkeypatch.setattr(bootstrap, "STEPS", (lambda: ran.append("step"),))
    bootstrap.run()
    assert ran == []
