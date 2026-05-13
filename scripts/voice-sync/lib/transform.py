"""Pure transformations from sheet row → screen_contexts payload.

No I/O. All inputs are dicts keyed by sheet column header.
Spec: see /Users/mintesnotm/.claude/plans/okay-let-s-plan-on-luminous-frog.md (context_block format).
"""

from __future__ import annotations

from typing import Optional

# Columns we read off the Screens tab. Order here is the canonical hash order.
SOURCE_COLUMNS = (
    "Screen ID",
    "Screen Name",
    "Route",
    "AI Context Block",
    "Voice Instructions",
    "Expected User Response",
    "AI Response",
    "System Action",
    "Edge Cases",
    "Notes",
)

REQUIRED_HEADERS = ("Row Type",) + SOURCE_COLUMNS

# Mapping of supplementary section label → source column. Order is stable.
SUPPLEMENTARY_SECTIONS = (
    ("VOICE INSTRUCTIONS",     "Voice Instructions"),
    ("EXPECTED USER RESPONSE", "Expected User Response"),
    ("AI RESPONSE PATTERN",    "AI Response"),
    ("SYSTEM ACTION",          "System Action"),
    ("EDGE CASES",             "Edge Cases"),
    ("NOTES",                  "Notes"),
)

# ROUTE_OVERRIDES mapping (sheet → router canonical paths)
ROUTE_OVERRIDES = {
    # SPLASH lives at /splash in the router; the canonical HomePage is "/"
    # (router uses <Route index element={<HomePage/>}/>). "/home" is a
    # legacy alias but "/" is the source of truth.
    "/": "/splash",
    "/home": "/",
    "/auth/login": "/login",
    "/auth/signup": "/signup",
    "/onboard/preference": "/onboarding/voice-preference",
    "/onboard/mic": "/onboarding/mic-permission",
    "/onboard/01": "/onboarding/step-1",
    "/onboard/02": "/onboarding/step-2",
    "/onboard/03": "/onboarding/step-3",
    "/onboard/04": "/onboarding/step-4",
    "/onboard/05": "/onboarding/step-5",
    "/onboard/06": "/onboarding/step-6",
    "/onboard/07": "/onboarding/step-7",
    "/onboard/08": "/onboarding/step-7",
    "/onboard/09": "/onboarding/step-7",
    "/onboard/advanced/01": "/onboarding/advanced-input",
    "/onboard/advanced/02": "/onboarding/advanced-results",
    "/onboard/advanced": None,
    "/onboard/beginner/05": None,
    "/onboard/beginner/08": None,
    "/onboard/beginner/09": None,
    "/insights": "/report",
    "/habits/create/template": "/add-habit",
    "/journal": "/reflections",
    "/journal/freeform": None,
    "/journal/guided": None,
    "/journal/:id": "/reflections/:id",
    "/habits/:id/reflection": "/habit/:habitId/reflection",
    "/habit/:id": "/habit/:habitId",
    "/habit/:id/edit": None,
    "/home (state: checkin-expanded)": None,
    "/home/reflection": None,
}



def validate_headers(actual: list[str]) -> list[str]:
    """Return required headers missing from `actual`. Extra columns are ignored."""
    actual_set = set(actual)
    return [h for h in REQUIRED_HEADERS if h not in actual_set]


def is_screen_row(row: dict) -> bool:
    return (row.get("Row Type") or "").strip() == "Screen"


def validate_row(row: dict) -> Optional[str]:
    """Return None if the row is seedable, else a short skip reason."""
    if not (row.get("Screen ID") or "").strip():
        return "empty Screen ID"
    if not (row.get("AI Context Block") or "").strip():
        return "empty AI Context Block"
    return None



def normalize_route(value: str | None) -> str | None:
    """Apply ROUTE_OVERRIDES to translate sheet-route values to router-canonical paths.
    
    If a value maps to None, return None (drop it).
    Anything not in the override map passes through unchanged.
    """
    if value is None:
        return None
    
    value = value.strip()
    if not value:
        return None
    
    # Check for exact match first
    if value in ROUTE_OVERRIDES:
        return ROUTE_OVERRIDES[value]
    
    # Pass through unchanged if not in overrides
    return value

def extract_source(row: dict) -> dict:
    """Subset of the row used for hashing and source_row storage. Order-stable."""
    return {col: (row.get(col) or "").strip() for col in SOURCE_COLUMNS}


def format_screen_context(row: dict) -> str:
    """Build the context_block string the LLM consumes.

    Format: metadata header + AI Context Block verbatim + supplementary fields.
    Empty supplementary fields are dropped (label + content).
    """
    src = extract_source(row)

    lines = [
        f"SCREEN_ID: {src['Screen ID']}",
        f"SCREEN_NAME: {src['Screen Name']}" if src["Screen Name"] else None,
        f"ROUTE: {src['Route']}"             if src["Route"] else None,
        "",
        src["AI Context Block"],
    ]

    supplementary = [
        f"\n{label}:\n{src[col]}"
        for label, col in SUPPLEMENTARY_SECTIONS
        if src.get(col)
    ]
    if supplementary:
        lines.append("\n--- SUPPLEMENTARY ---")
        lines.extend(supplementary)

    return "\n".join(line for line in lines if line is not None)
