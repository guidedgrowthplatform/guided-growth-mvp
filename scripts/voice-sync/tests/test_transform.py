"""Unit tests for lib.transform and lib.hashing — pure functions, no I/O."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lib.hashing import canonical_hash
from lib.transform import (
    SOURCE_COLUMNS,
    extract_source,
    format_screen_context,
    is_screen_row,
    validate_row,
)


def make_row(**overrides) -> dict:
    base = {col: "" for col in SOURCE_COLUMNS}
    base["Row Type"] = "Screen"
    base["Screen ID"] = "ONBOARD-01"
    base["Screen Name"] = "Profile Setup"
    base["Route"] = "/onboarding/profile"
    base["AI Context Block"] = "SCREEN: Profile Setup\nSTATE: empty"
    base.update(overrides)
    return base


# ── is_screen_row ─────────────────────────────────────────────────────────────

def test_is_screen_row_includes_Screen():
    assert is_screen_row({"Row Type": "Screen"}) is True

def test_is_screen_row_excludes_others():
    for rt in ("Subcategory Data", "Legacy / Older Plan", "Deprecated", "", None):
        assert is_screen_row({"Row Type": rt}) is False

def test_is_screen_row_strips_whitespace():
    assert is_screen_row({"Row Type": "  Screen  "}) is True


# ── validate_row ──────────────────────────────────────────────────────────────

def test_validate_row_passes_full_row():
    assert validate_row(make_row()) is None

def test_validate_row_fails_empty_screen_id():
    assert validate_row(make_row(**{"Screen ID": ""})) == "empty Screen ID"

def test_validate_row_fails_empty_context_block():
    assert validate_row(make_row(**{"AI Context Block": ""})) == "empty AI Context Block"

def test_validate_row_handles_missing_keys():
    assert validate_row({}) == "empty Screen ID"


# ── format_screen_context ─────────────────────────────────────────────────────

def test_format_includes_metadata_header():
    out = format_screen_context(make_row())
    assert "SCREEN_ID: ONBOARD-01" in out
    assert "SCREEN_NAME: Profile Setup" in out
    assert "ROUTE: /onboarding/profile" in out

def test_format_inlines_AI_context_block_verbatim():
    block = "SCREEN: Foo\nSTATE: bar\nBEHAVIOR: baz"
    out = format_screen_context(make_row(**{"AI Context Block": block}))
    assert block in out

def test_format_drops_empty_supplementary_sections():
    out = format_screen_context(make_row())
    assert "SUPPLEMENTARY" not in out  # all empty → no supplementary block at all

def test_format_includes_supplementary_when_filled():
    out = format_screen_context(make_row(
        **{"Voice Instructions": "speak softly", "AI Response": "great choice"}
    ))
    assert "--- SUPPLEMENTARY ---" in out
    assert "VOICE INSTRUCTIONS:\nspeak softly" in out
    assert "AI RESPONSE PATTERN:\ngreat choice" in out
    # Sections that ARE empty stay dropped:
    assert "EDGE CASES:" not in out

def test_format_skips_empty_metadata_lines():
    out = format_screen_context(make_row(**{"Route": "", "Screen Name": "", "MP3?": ""}))
    assert "ROUTE:" not in out
    assert "SCREEN_NAME:" not in out
    assert "HAS_MP3:" not in out
    # Screen ID always present
    assert "SCREEN_ID: ONBOARD-01" in out


# ── canonical_hash ────────────────────────────────────────────────────────────

def test_hash_deterministic():
    a = {"x": 1, "y": "two", "z": [1, 2]}
    assert canonical_hash(a) == canonical_hash(a)

def test_hash_order_independent():
    a = {"x": 1, "y": "two"}
    b = {"y": "two", "x": 1}
    assert canonical_hash(a) == canonical_hash(b)

def test_hash_differs_on_content_change():
    a = {"x": 1}
    b = {"x": 2}
    assert canonical_hash(a) != canonical_hash(b)

def test_hash_handles_unicode():
    assert canonical_hash({"k": "café"}) == canonical_hash({"k": "café"})


# ── extract_source ────────────────────────────────────────────────────────────

def test_extract_source_returns_only_known_columns():
    row = make_row(**{"Random Extra Col": "ignored"})
    src = extract_source(row)
    assert "Random Extra Col" not in src
    assert set(src.keys()) == set(SOURCE_COLUMNS)

def test_extract_source_strips_whitespace():
    src = extract_source(make_row(**{"Screen ID": "  ONBOARD-01  "}))
    assert src["Screen ID"] == "ONBOARD-01"
