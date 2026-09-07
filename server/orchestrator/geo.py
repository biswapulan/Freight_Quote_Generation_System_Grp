"""Free-text location resolution for the orchestrator.

Origin/destination arrive from the UI in many shapes — "Chennai",
"Chennai, India (INMAA)", "Port of Rotterdam", or a bare UN/LOCODE. The Customs
agent needs a country, the Route agent needs a port code, and the Weather agent
needs coordinates, so everything funnels through resolve() first.
"""

import re
from typing import Any, Dict

# keyword -> (city, country, ISO-2, UN/LOCODE, lat, lon)
_GAZETTEER = [
    ("nhava sheva", "Nhava Sheva", "India", "IN", "INNSA", 18.9490, 72.9490),
    ("jnpt", "Nhava Sheva", "India", "IN", "INNSA", 18.9490, 72.9490),
    ("mumbai", "Mumbai", "India", "IN", "INNSA", 18.9490, 72.9490),
    ("bombay", "Mumbai", "India", "IN", "INNSA", 18.9490, 72.9490),
    ("chennai", "Chennai", "India", "IN", "INMAA", 13.0827, 80.2707),
    ("madras", "Chennai", "India", "IN", "INMAA", 13.0827, 80.2707),
    ("mundra", "Mundra", "India", "IN", "INMUN", 22.7400, 69.7000),
    ("kochi", "Kochi", "India", "IN", "INCOK", 9.9312, 76.2673),
    ("cochin", "Kochi", "India", "IN", "INCOK", 9.9312, 76.2673),
    ("visakhapatnam", "Visakhapatnam", "India", "IN", "INVTZ", 17.6868, 83.2185),
    ("kolkata", "Kolkata", "India", "IN", "INCCU", 22.5726, 88.3639),
    ("delhi", "Delhi", "India", "IN", "INDEL", 28.7041, 77.1025),
    ("bengaluru", "Bengaluru", "India", "IN", "INBLR", 12.9716, 77.5946),
    ("bangalore", "Bengaluru", "India", "IN", "INBLR", 12.9716, 77.5946),
    ("hyderabad", "Hyderabad", "India", "IN", "INHYD", 17.3850, 78.4867),
    ("ahmedabad", "Ahmedabad", "India", "IN", "INAMD", 23.0225, 72.5714),
    ("pune", "Pune", "India", "IN", "INPNQ", 18.5204, 73.8567),
    ("nagpur", "Nagpur", "India", "IN", "INNAG", 21.1458, 79.0882),
    ("ludhiana", "Ludhiana", "India", "IN", "INLUH", 30.8700, 75.9200),
    ("singapore", "Singapore", "Singapore", "SG", "SGSIN", 1.2644, 103.8198),
    ("jebel ali", "Dubai", "United Arab Emirates", "AE", "AEJEA", 25.0110, 55.0272),
    ("dubai", "Dubai", "United Arab Emirates", "AE", "AEJEA", 25.0110, 55.0272),
    ("rotterdam", "Rotterdam", "Netherlands", "NL", "NLRTM", 51.9490, 4.1420),
    ("amsterdam", "Amsterdam", "Netherlands", "NL", "NLAMS", 52.3676, 4.9041),
    ("antwerp", "Antwerp", "Belgium", "BE", "BEANR", 51.2194, 4.4025),
    ("hamburg", "Hamburg", "Germany", "DE", "DEHAM", 53.5511, 9.9937),
    ("frankfurt", "Frankfurt", "Germany", "DE", "DEFRA", 50.1109, 8.6821),
    ("shanghai", "Shanghai", "China", "CN", "CNSHA", 31.2304, 121.4737),
    ("shenzhen", "Shenzhen", "China", "CN", "CNSZX", 22.5431, 114.0579),
    ("ningbo", "Ningbo", "China", "CN", "CNNGB", 29.8683, 121.5440),
    ("hong kong", "Hong Kong", "Hong Kong", "HK", "HKHKG", 22.3193, 114.1694),
    ("los angeles", "Los Angeles", "United States", "US", "USLAX", 33.7432, -118.2673),
    ("long beach", "Long Beach", "United States", "US", "USLGB", 33.7550, -118.2160),
    ("new york", "New York", "United States", "US", "USNYC", 40.7128, -74.0060),
    ("houston", "Houston", "United States", "US", "USHOU", 29.7604, -95.3698),
    ("savannah", "Savannah", "United States", "US", "USSAV", 32.0809, -81.0912),
    ("colombo", "Colombo", "Sri Lanka", "LK", "LKCMB", 6.9271, 79.8612),
    ("tokyo", "Tokyo", "Japan", "JP", "JPTYO", 35.6762, 139.6503),
    ("yokohama", "Yokohama", "Japan", "JP", "JPYOK", 35.4437, 139.6380),
    ("busan", "Busan", "South Korea", "KR", "KRPUS", 35.1796, 129.0756),
    ("sydney", "Sydney", "Australia", "AU", "AUSYD", -33.8688, 151.2093),
    ("fremantle", "Fremantle", "Australia", "AU", "AUFRE", -32.0569, 115.7439),
    ("melbourne", "Melbourne", "Australia", "AU", "AUMEL", -37.8136, 144.9631),
    ("london", "London", "United Kingdom", "GB", "GBLON", 51.5074, -0.1278),
    ("felixstowe", "Felixstowe", "United Kingdom", "GB", "GBFXT", 51.9640, 1.3510),
    ("santos", "Santos", "Brazil", "BR", "BRSSZ", -23.9608, -46.3336),
    ("durban", "Durban", "South Africa", "ZA", "ZADUR", -29.8587, 31.0218),
    ("jeddah", "Jeddah", "Saudi Arabia", "SA", "SAJED", 21.4858, 39.1925),
    ("port klang", "Port Klang", "Malaysia", "MY", "MYPKG", 3.0000, 101.4000),
    ("laem chabang", "Laem Chabang", "Thailand", "TH", "THLCH", 13.0827, 100.8833),
    ("ho chi minh", "Ho Chi Minh City", "Vietnam", "VN", "VNSGN", 10.8231, 106.6297),
    ("jakarta", "Jakarta", "Indonesia", "ID", "IDJKT", -6.2088, 106.8456),
]

# Direct UN/LOCODE lookup, derived from the gazetteer above.
_BY_CODE: Dict[str, tuple] = {row[4]: row for row in _GAZETTEER}

# Airport / IATA codes used by the frontend port master that differ from the seaport code.
_ALIAS_CODES = {
    "MAA": "INMAA",
    "BOM": "INNSA",
    "DEL": "INDEL",
    "BLR": "INBLR",
    "HYD": "INHYD",
    "SIN": "SGSIN",
    "DXB": "AEJEA",
    "FRA": "DEFRA",
    "LHR": "GBLON",
    "JFK": "USNYC",
    "PVG": "CNSHA",
    "INBOM": "INNSA",
    "IN-TKD": "INDEL",
    "IN-BHI": "INNSA",
    "IN-WFD": "INBLR",
    "IN-SNF": "INHYD",
    "IN-ACT": "INAMD",
    "IN-LUD": "INLUH",
    "IN-CHN": "INMAA",
    "IN-NAG": "INNAG",
    "IN-PUN": "INPNQ",
}

_UNKNOWN = {
    "city": "",
    "country": "",
    "country_code": "",
    "port_code": "",
    "lat": None,
    "lon": None,
    "resolved": False,
}


def resolve(raw: str) -> Dict[str, Any]:
    """Best-effort resolution of a free-text location.

    Always returns a dict; `resolved` is False when nothing matched, which lets
    callers fall back without having to catch an exception.
    """
    if not raw:
        return dict(_UNKNOWN)

    text = str(raw).strip()
    lowered = text.lower()

    # 1. An explicit UN/LOCODE, either bare ("NLRTM") or bracketed ("... (NLRTM)").
    for token in re.findall(r"[A-Za-z][A-Za-z0-9-]{1,7}", text):
        code = token.upper()
        code = _ALIAS_CODES.get(code, code)
        if code in _BY_CODE:
            return _row_to_dict(_BY_CODE[code])

    # 2. Keyword match on the city/port name. Longest keyword wins so
    #    "nhava sheva" beats a stray "mumbai" later in the same string.
    best = None
    for row in _GAZETTEER:
        if row[0] in lowered and (best is None or len(row[0]) > len(best[0])):
            best = row
    if best:
        return _row_to_dict(best)

    return dict(_UNKNOWN)


def _row_to_dict(row: tuple) -> Dict[str, Any]:
    _keyword, city, country, country_code, port_code, lat, lon = row
    return {
        "city": city,
        "country": country,
        "country_code": country_code,
        "port_code": port_code,
        "lat": lat,
        "lon": lon,
        "resolved": True,
    }


def country_of(raw: str, default: str = "India") -> str:
    """Country name for a location, falling back to `default` when unknown."""
    return resolve(raw).get("country") or default


def port_code_of(raw: str, default: str = "") -> str:
    """UN/LOCODE for a location, falling back to `default` when unknown."""
    return resolve(raw).get("port_code") or default
