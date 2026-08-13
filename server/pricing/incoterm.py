"""Incoterms 2020 Cost Responsibility Scope Matrix — Milestone 2.

Determines which leg and surcharge components belong in the seller's quote
for a given 3-letter Incoterm code (EXW, FCA, FOB, CFR, CIF, DAP, DDP).
"""

INCOTERM_SCOPE = {
    "EXW": [],
    "FCA": ["PUH", "CCO"],
    "FOB": ["PUH", "CCO", "THCO", "ISPS", "DOC"],
    "CFR": [
        "PUH", "CCO", "THCO", "ISPS", "DOC",
        "OFR", "AFR", "BAF", "CAF", "LSS", "PSS", "WRS"
    ],
    "CIF": [
        "PUH", "CCO", "THCO", "ISPS", "DOC",
        "OFR", "AFR", "BAF", "CAF", "LSS", "PSS", "WRS", "INS"
    ],
    "DAP": [
        "PUH", "CCO", "THCO", "ISPS", "DOC",
        "OFR", "AFR", "BAF", "CAF", "LSS", "PSS", "WRS", "INS",
        "THCD", "DLH"
    ],
    "DDP": [
        "PUH", "CCO", "THCO", "ISPS", "DOC",
        "OFR", "AFR", "BAF", "CAF", "LSS", "PSS", "WRS", "INS",
        "THCD", "DLH", "CCD"
    ],
}

ALL_INCOTERMS = tuple(INCOTERM_SCOPE.keys())


def filter_by_incoterm(incoterm_code):
    """Return list of component codes allowed under the specified Incoterm.
    
    If incoterm_code is invalid or empty, defaults to 'FOB' scope.
    'EXW' explicitly returns empty list [] (0 seller cost components).
    """
    code = (incoterm_code or "FOB").upper().strip()
    return INCOTERM_SCOPE.get(code, INCOTERM_SCOPE["FOB"])
