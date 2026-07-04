"""Unit tests for gen_checkin_scripts — pure grouping/render logic, no I/O."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from gen_checkin_scripts import build_variants, render_ts


def row(stage: str, n: int, text: str) -> dict:
    return {"surface": "Morning", "stage": stage, "n": str(n), "text_en": text}


def stage_rows(stage: str, count: int) -> list[dict]:
    return [row(stage, i, f"{stage} line {i}") for i in range(1, count + 1)]


def test_groups_by_stage_and_orders_by_n():
    rows = stage_rows("morning_greeting", 3) + stage_rows("morning_wrap", 2)
    out = build_variants(rows)
    assert out["morning_greeting"] == [f"morning_greeting line {i}" for i in range(1, 4)]
    assert out["morning_wrap"] == [f"morning_wrap line {i}" for i in range(1, 3)]


def test_orders_shuffled_rows():
    shuffled = [row("morning_greeting", n, f"line {n}") for n in (3, 1, 2)]
    out = build_variants(shuffled)
    assert out["morning_greeting"] == ["line 1", "line 2", "line 3"]


def test_skips_notification_stages_quietly(capsys):
    rows = stage_rows("morning_greeting", 1) + [row("morning_notification", 1, "ping")]
    out = build_variants(rows)
    assert "morning_notification" not in out
    assert "unknown stage" not in capsys.readouterr().err


def test_warns_on_truly_unknown_stage(capsys):
    rows = stage_rows("morning_greeting", 1) + [row("habit_reminder", 1, "x")]
    build_variants(rows)
    assert "skipped unknown stage" in capsys.readouterr().err


def test_warns_on_missing_known_stage(capsys):
    out = build_variants(stage_rows("morning_greeting", 1))
    assert "no rows for known stage" in capsys.readouterr().err
    assert "morning_wrap" not in out


def test_raises_on_duplicate_n():
    rows = [row("morning_greeting", 1, "a"), row("morning_greeting", 1, "b")]
    with pytest.raises(ValueError, match="duplicate n"):
        build_variants(rows)


def test_raises_on_non_contiguous_n():
    rows = [row("morning_greeting", 1, "a"), row("morning_greeting", 3, "b")]
    with pytest.raises(ValueError, match="not contiguous"):
        build_variants(rows)


def test_raises_on_empty_text():
    with pytest.raises(ValueError, match="empty text_en"):
        build_variants([row("morning_greeting", 1, "")])


def test_raises_on_non_integer_n():
    with pytest.raises(ValueError, match="non-integer"):
        build_variants([{"stage": "morning_greeting", "n": "x", "text_en": "a"}])


def test_render_ts_is_valid_typescript_shape():
    ts = render_ts(build_variants(stage_rows("morning_greeting", 2)))
    assert "export const CHECKIN_SCRIPT_VARIANTS: Record<string, readonly string[]>" in ts
    assert "morning_greeting: [" in ts
    assert ts.rstrip().endswith("};")
