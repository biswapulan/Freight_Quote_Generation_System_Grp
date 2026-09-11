"""Keep the live backend from falling asleep on Render's free tier.

Render stops a free web service after 15 minutes without an inbound request,
and the next visitor waits over a minute for it to start again. A scheduled
GitHub workflow pings it as well, but GitHub starts scheduled runs late or
drops them when busy, so it cannot hold a 15-minute window on its own.

Instead the server calls its own public address every few minutes. That
request comes back in through Render's edge, which counts as traffic, so a
server that is awake stays awake.

Render sets RENDER_EXTERNAL_URL for every web service. Anywhere else, local
development included, this does nothing.
"""

import logging
import os
import threading
import urllib.request

logger = logging.getLogger(__name__)

# Comfortably inside Render's 15-minute idle window.
INTERVAL_SECONDS = 10 * 60

_started = False


def _ping_forever(url, stop):
    while not stop.wait(INTERVAL_SECONDS):
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                response.read(64)
        except Exception:  # noqa: BLE001 - a missed ping is retried next interval
            logger.warning("Keep-awake ping to %s failed", url, exc_info=True)


def start():
    """Start pinging this server's public address; returns the stop event."""
    global _started

    base = os.environ.get("RENDER_EXTERNAL_URL", "").strip().rstrip("/")
    switched_off = os.environ.get("KEEP_AWAKE", "true").strip().lower() in ("0", "false", "no")
    if _started or not base or switched_off:
        return None

    _started = True
    stop = threading.Event()
    threading.Thread(
        target=_ping_forever,
        args=(f"{base}/", stop),
        name="keep-awake",
        daemon=True,
    ).start()
    return stop
