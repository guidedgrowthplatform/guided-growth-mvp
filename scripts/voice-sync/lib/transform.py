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
