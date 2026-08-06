"""Promote an existing user to admin, or create one, from the command line.

Admin accounts are never created through the public signup endpoint —
this command is the only way to grant the 'admin' role.

Usage:
    python manage.py create_admin admin@example.com --password s3cret --full-name "Ops Admin"

If a user with that email already exists, it is promoted to admin (password
left untouched unless --password is given). Otherwise a new admin user is
created and --password is required.
"""

from datetime import datetime

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError

from accounts.mongo import users_collection


class Command(BaseCommand):
    help = "Create or promote a user to the admin role."

    def add_arguments(self, parser):
        parser.add_argument("email", type=str)
        parser.add_argument("--password", type=str, default=None)
        parser.add_argument("--full-name", type=str, default="Admin")

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        password = options["password"]
        full_name = options["full_name"]

        existing = users_collection.find_one({"email": email})

        if existing:
            update = {"role": "admin"}
            if password:
                update["password"] = make_password(password)
            users_collection.update_one({"_id": existing["_id"]}, {"$set": update})
            self.stdout.write(self.style.SUCCESS(f"Promoted existing user {email} to admin."))
            return

        if not password:
            raise CommandError(
                "No user found with that email — pass --password to create a new admin."
            )

        users_collection.insert_one(
            {
                "full_name": full_name,
                "email": email,
                "password": make_password(password),
                "role": "admin",
                "company_name": "",
                "gst_number": "",
                "created_at": datetime.utcnow(),
            }
        )
        self.stdout.write(self.style.SUCCESS(f"Created new admin user {email}."))
