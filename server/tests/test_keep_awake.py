"""The live server's ping to itself that stops Render putting it to sleep."""

import threading

from server import keep_awake


class Reply:
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self, size):
        return b"ok"


def test_does_nothing_off_render(monkeypatch):
    monkeypatch.delenv("RENDER_EXTERNAL_URL", raising=False)
    monkeypatch.setattr(keep_awake, "_started", False)
    assert keep_awake.start() is None


def test_pings_its_own_public_address_on_render(monkeypatch):
    pinged = threading.Event()
    seen = []

    def fake_urlopen(url, timeout):
        seen.append(url)
        pinged.set()
        return Reply()

    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://example.onrender.com/")
    monkeypatch.delenv("KEEP_AWAKE", raising=False)
    monkeypatch.setattr(keep_awake, "_started", False)
    monkeypatch.setattr(keep_awake, "INTERVAL_SECONDS", 0.01)
    monkeypatch.setattr(keep_awake.urllib.request, "urlopen", fake_urlopen)

    stop = keep_awake.start()
    try:
        assert pinged.wait(2), "no ping within 2 seconds"
    finally:
        stop.set()
    assert seen[0] == "https://example.onrender.com/"


def test_starts_only_once_per_process(monkeypatch):
    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://example.onrender.com")
    monkeypatch.delenv("KEEP_AWAKE", raising=False)
    monkeypatch.setattr(keep_awake, "_started", False)
    monkeypatch.setattr(keep_awake, "INTERVAL_SECONDS", 3600)

    first = keep_awake.start()
    try:
        assert first is not None
        assert keep_awake.start() is None
    finally:
        first.set()


def test_can_be_switched_off(monkeypatch):
    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://example.onrender.com")
    monkeypatch.setenv("KEEP_AWAKE", "false")
    monkeypatch.setattr(keep_awake, "_started", False)
    assert keep_awake.start() is None
