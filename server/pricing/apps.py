import os
import sys
import threading

from django.apps import AppConfig


class PricingConfig(AppConfig):
    name = 'pricing'

    def ready(self):
        """Warm the ML pricing model on a background thread.

        Importing scikit-learn and deserialising the pipeline takes several
        seconds. Doing it here means the cost is paid during boot rather than by
        whichever customer happens to request the first quote. It runs off the
        main thread so worker start-up is not blocked, and is skipped for
        management commands and tests where it would be pure overhead.
        """
        if not self._should_warm_up():
            return

        from .ml_service import MLPricingService

        threading.Thread(
            target=MLPricingService.warm_up,
            name="ml-pricing-warmup",
            daemon=True,
        ).start()

    @staticmethod
    def _should_warm_up() -> bool:
        from django.conf import settings

        if not getattr(settings, "ML_WARM_UP_ON_START", True):
            return False

        # Django's autoreloader runs ready() twice; only warm in the child process.
        if os.environ.get("RUN_MAIN") == "false":
            return False

        management_commands = {
            "migrate", "makemigrations", "collectstatic", "shell",
            "createsuperuser", "test", "check", "showmigrations",
        }
        if any(arg in management_commands for arg in sys.argv):
            return False

        # Under pytest the tests decide for themselves whether the model is
        # loaded, so a background warm-up is just noise.
        return "pytest" not in sys.modules
