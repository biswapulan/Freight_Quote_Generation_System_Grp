"""Pytest configuration shared by the whole suite."""

import pytest


@pytest.fixture(autouse=True)
def deterministic_weather(settings):
    """Keep the Weather agent off the network during tests.

    The orchestrator runs the Weather agent synchronously inside quote
    generation. Hitting Open-Meteo from the test suite would make it slow and
    dependent on connectivity, so tests use the provider's deterministic
    simulation instead. The live path is still exercised by weather's own tests.
    """
    settings.ORCHESTRATOR_LIVE_WEATHER = False
    settings.ORCHESTRATOR_WEATHER_SAMPLES = 3


@pytest.fixture(autouse=True)
def header_identity(settings):
    """Let tests declare who they are with request headers.

    Production resolves the role from the signed JWT or the stored user record;
    the suite has no Mongo user documents, so it identifies callers with
    X-Customer-Id / X-User-Role instead. This is off by default in settings.
    """
    settings.ALLOW_HEADER_ROLE_AUTH = True
