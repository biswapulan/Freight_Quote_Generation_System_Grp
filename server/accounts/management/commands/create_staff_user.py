"""Create or promote a user into a staff role from the command line.

Public signup can only create 'retail' accounts (SELF_SIGNUP_ROLES), so agent,
customs and admin users have to be provisioned deliberately. create_admin
already covered the admin role; this covers the rest, which matters most for
'customs' — without a customs user the Customs Officer portal cannot be opened
by anyone.

Usage:
    python manage.py create_staff_user officer@freightai.com --role customs \\
        --password s3cret --full-name "Officer Sharma"

An existing user is promoted in place; their password is left alone unless
--password is given.
"""

from datetime import datetime

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError

from accounts.mongo import users_collection
from accounts.serializers import ACCOUNT_ROLES


class Command(BaseCommand):
    help = "Create or promote a user into a staff role (agent, customs, admin, business)."

    def add_arguments(self, parser):
        parser.add_argument("email", type=str)
        parser.add_argument(
            "--role",
            type=str,
            required=True,
            choices=sorted(ACCOUNT_ROLES),
            help="Role to grant.",
        )
        parser.add_argument("--password", type=str, default=None)
        parser.add_argument("--full-name", type=str, default=None)
        parser.add_argument("--company", type=str, default="")

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        role = options["role"].strip().lower()
        password = options["password"]
        full_name = options["full_name"] or email.split("@")[0].title()

        existing = users_collection.find_one({"email": email})

        if existing:
            update = {"role": role}
            if password:
                update["password"] = make_password(password)
            if options["full_name"]:
                update["full_name"] = full_name
            users_collection.update_one({"_id": existing["_id"]}, {"$set": update})
            self.stdout.write(
                self.style.SUCCESS(
                    f"Promoted {email} to '{role}'"
                    + (" and reset the password." if password else " (password unchanged).")
                )
            )
            return

        if not password:
            raise CommandError(
                f"No user found with {email} — pass --password to create a new '{role}' user."
            )

        users_collection.insert_one(
            {
                "full_name": full_name,
                "email": email,
                "password": make_password(password),
                "role": role,
                "company_name": options["company"],
                "gst_number": "",
                "is_active": True,
                "created_at": datetime.utcnow(),
            }
        )
        self.stdout.write(self.style.SUCCESS(f"Created '{role}' user {email}."))
