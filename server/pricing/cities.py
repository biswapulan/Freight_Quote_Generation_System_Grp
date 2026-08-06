"""Seeded city -> (lat, lon) reference table.

Milestone 1 stub: a real system resolves origin/destination through a
searchable ports/airports master table (see the Gateway Resolution spec in
the project docs). That table isn't loaded yet, so this module is the
Milestone-1-sized equivalent: a small, hand-seeded lookup of major Indian
hubs plus a handful of international ones, keyed by a normalised city name.

`resolve_city` is a pure function: same input always produces the same
output, no I/O. Swapping this out for a real ports/airports collection later
does not require touching any caller — only this module.
"""

CITY_COORDINATES = {
    # Major Indian metro & port cities
    "mumbai": (19.0760, 72.8777),
    "delhi": (28.7041, 77.1025),
    "new delhi": (28.6139, 77.2090),
    "bangalore": (12.9716, 77.5946),
    "bengaluru": (12.9716, 77.5946),
    "chennai": (13.0827, 80.2707),
    "kolkata": (22.5726, 88.3639),
    "hyderabad": (17.3850, 78.4867),
    "pune": (18.5204, 73.8567),
    "ahmedabad": (23.0225, 72.5714),
    "surat": (21.1702, 72.8311),
    "jaipur": (26.9124, 75.7873),
    "lucknow": (26.8467, 80.9462),
    "kanpur": (26.4499, 80.3319),
    "nagpur": (21.1458, 79.0882),
    "indore": (22.7196, 75.8577),
    "bhopal": (23.2599, 77.4126),
    "patna": (25.5941, 85.1376),
    "vadodara": (22.3072, 73.1812),
    "coimbatore": (11.0168, 76.9558),
    "kochi": (9.9312, 76.2673),
    "cochin": (9.9312, 76.2673),
    "visakhapatnam": (17.6868, 83.2185),
    "chandigarh": (30.7333, 76.7794),
    "guwahati": (26.1445, 91.7362),
    "bhubaneswar": (20.2961, 85.8245),
    "nashik": (19.9975, 73.7898),
    "rajkot": (22.3039, 70.8022),
    "amritsar": (31.6340, 74.8723),
    "varanasi": (25.3176, 82.9739),
    # A handful of international hubs for cross-border lanes
    "dubai": (25.2048, 55.2708),
    "singapore": (1.3521, 103.8198),
    "shanghai": (31.2304, 121.4737),
    "rotterdam": (51.9244, 4.4777),
    "london": (51.5072, -0.1276),
    "new york": (40.7128, -74.0060),
    "tokyo": (35.6762, 139.6503),
    "sydney": (-33.8688, 151.2093),
    "hong kong": (22.3193, 114.1694),
    "colombo": (6.9271, 79.8612),
}


def resolve_city(name):
    """Return (lat, lon) for a supported city name, or None if unresolved.

    Matching is case-insensitive and trims whitespace. No fuzzy matching —
    an unresolved city is reported to the caller so the UI can show a clear
    "route not serviced" style message rather than silently guessing.
    """

    if not name:
        return None
    key = name.strip().lower()
    return CITY_COORDINATES.get(key)


def supported_city_names(limit=12):
    """A short, presentable sample of supported cities for error messages."""

    names = sorted(name.title() for name in CITY_COORDINATES)
    return names[:limit]
