"""Unit tests for gen_notifications — pure grouping/render logic, no I/O."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from gen_notifications import build_variants, render_ts


def row(stage: str, n: int, title: str, body: str, surface: str = "") -> dict:
    return {"surface": surface, "stage": stage, "n": str(n), "title_en": title, "text_en": body}


def two_full_slots() -> list[dict]:
    rows = []
    for i in range(1, 8):
        rows.append(row("morning_notification", i, f"M{i}", f"morning body {i}"))
        rows.append(row("evening_notification", i, f"E{i}", f"evening body {i}"))
    return rows


def test_groups_by_stage_and_orders_by_n():
    out = build_variants(two_full_slots())
    assert [v["title"] for v in out["morning_checkin"]] == [f"M{i}" for i in range(1, 8)]
    assert [v["title"] for v in out["evening_checkin"]] == [f"E{i}" for i in range(1, 8)]


def test_orders_shuffled_rows():
    rows = [
        row("morning_notification", 3, "M3", "b3"),
        row("morning_notification", 1, "M1", "b1"),
        row("morning_notification", 2, "M2", "b2"),
        row("evening_notification", 1, "E1", "b"),
    ]
    out = build_variants(rows)
    assert [v["title"] for v in out["morning_checkin"]] == ["M1", "M2", "M3"]


def test_ignores_unrelated_stages():
    rows = two_full_slots() + [row("habit_reminder", 1, "X", "y")]
    out = build_variants(rows)
    assert len(out["morning_checkin"]) == 7


def test_raises_on_empty_copy():
    rows = [row("morning_notification", 1, "", "body"), row("evening_notification", 1, "E", "b")]
    with pytest.raises(ValueError, match="empty title/body"):
        build_variants(rows)


def test_raises_on_non_contiguous_n():
    rows = [
        row("morning_notification", 1, "M1", "b"),
        row("morning_notification", 3, "M3", "b"),
        row("evening_notification", 1, "E1", "b"),
    ]
    with pytest.raises(ValueError, match="not contiguous"):
        build_variants(rows)


def test_raises_when_a_slot_is_missing():
    rows = [row("morning_notification", 1, "M1", "b")]
    with pytest.raises(ValueError, match="no rows found for evening_checkin"):
        build_variants(rows)


def test_render_is_valid_ts_with_escaped_quotes():
    out = build_variants(
        [
            row("morning_notification", 1, "Hey, you're up", "How'd you sleep?"),
            row("evening_notification", 1, "Evening", "How did it go?"),
        ]
    )
    ts = render_ts(out)
    assert ts.startswith("// GENERATED — do not edit by hand.")
    assert "export const REMINDER_VARIANTS" in ts
    assert "morning_checkin:" in ts and "evening_checkin:" in ts
    # json.dumps escapes the apostrophe-bearing strings into valid double-quoted JS
    assert '"Hey, you\'re up"' in ts
