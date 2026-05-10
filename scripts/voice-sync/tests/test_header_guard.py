"""Unit tests for transform.validate_headers — pure function, no I/O."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lib.transform import REQUIRED_HEADERS, validate_headers


def test_validate_headers_passes_when_all_present():
    actual = list(REQUIRED_HEADERS) + ["Notes 2", "Internal Use Only"]
    assert validate_headers(actual) == []


def test_validate_headers_returns_missing_when_one_renamed():
    actual = [h if h != "AI Context Block" else "Context Block" for h in REQUIRED_HEADERS]
    assert validate_headers(actual) == ["AI Context Block"]


def test_validate_headers_returns_all_missing_columns_at_once():
    actual = ["Screen ID"]
    missing = validate_headers(actual)
    assert "Screen ID" not in missing
    assert set(missing) == set(REQUIRED_HEADERS) - {"Screen ID"}
    assert len(missing) == len(REQUIRED_HEADERS) - 1
