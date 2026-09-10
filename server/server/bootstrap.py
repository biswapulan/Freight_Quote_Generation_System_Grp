"""Bring a freshly started server to a usable state.

The backend runs on Render's free tier, where the disk is ephemeral: every
deploy, and every restart after the service sleeps, begins with an empty SQLite
file, and there is no shell to run manage.py in. Nothing ever seeded the live
MongoDB either, so the demo accounts printed on the login page did not exist
there; the old client-side login shortcut hid that by letting anyone in.

So the server prepares itself when it starts: apply migrations, make sure the
demo accounts accept the documented password, and create the freight companies
if there are none. Every step is safe to repeat and leaves correct data alone.
"""

import io
import logging
import os
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone

from django.contrib.auth.hashers import make_password
from django.core.management import call_command

logger = logging.getLogger(__name__)

DEMO_PASSWORD = "Password123!"


def apply_migrations():
    call_command("migrate", interactive=False, verbosity=0)


def ensure_demo_users():
    """Every demo account exists, is active and accepts the documented password.

    Profile fields are written only when an account is created, so a name
    somebody changed during a demo survives the next restart.
    """
    from accounts.management.commands.seed_demo_users import DEMO_USERS
    from accounts.mongo import users_collection

    password = make_password(DEMO_PASSWORD)
    for account in DEMO_USERS:
        users_collection.update_one(
            {"email": account["email"].lower()},
            {
                "$set": {"password": password, "role": account["role"], "is_active": True},
                "$setOnInsert": {
                    "full_name": account["full_name"],
                    "company_name": account["company_name"],
                    "gst_number": "",
                    "created_at": datetime.now(timezone.utc),
                },
            },
            upsert=True,
        )


def ensure_companies():
    """Create the freight companies, but only when there are none.

    Re-seeding on every start would reset rate cards an administrator edited.
    """
    from companies.models import FreightCompany

    if not FreightCompany.objects.exists():
        call_command("seed_companies", stdout=io.StringIO())


STEPS = (apply_migrations, ensure_demo_users, ensure_companies)


@contextmanager
def _one_process_at_a_time():
    """gunicorn can boot several workers at once; only one should migrate."""
    try:
        import fcntl
    except ImportError:  # Windows has no fcntl, and local dev there is one process.
        yield
        return

    path = os.path.join(tempfile.gettempdir(), "freightai-bootstrap.lock")
    with open(path, "w") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def run():
    if os.environ.get("AUTO_BOOTSTRAP", "true").strip().lower() in ("0", "false", "no"):
        return

    with _one_process_at_a_time():
        for step in STEPS:
            try:
                step()
            except Exception:  # noqa: BLE001 - a failed step must not stop the server
                # Mongo being unreachable, say, should leave an API that answers
                # and logs why, rather than a service that never comes up.
                logger.exception("Start-up step %s failed", step.__name__)
