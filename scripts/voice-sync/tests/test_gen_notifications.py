"""Unit tests for gen_notifications — pure grouping/render logic, no I/O."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from gen_notifications import OUTPUT_PATH, build_variants, render_ts


def row(stage: str, n: int, title: str, body: str) -> dict:
    return {"stage": stage, "n": str(n), "title_en": title, "text_en": body}


def slot(stage: str, count: int = 7) -> list[dict]:
    return [row(stage, i, f"{stage[:1].upper()}{i}", f"body {i}") for i in range(1, count + 1)]


def both_slots() -> list[dict]:
    return slot("morning_notification") + slot("evening_notification")


def test_groups_by_stage_and_orders_by_n():
    out = build_variants(both_slots())
    assert [v["title"] for v in out["morning_checkin"]] == [f"M{i}" for i in range(1, 8)]
    assert [v["title"] for v in out["evening_checkin"]] == [f"E{i}" for i in range(1, 8)]


def test_orders_shuffled_rows():
    shuffled = [
        row("morning_notification", n, f"M{n}", "b")
        for n in (3, 1, 5, 2, 7, 4, 6)
    ] + slot("evening_notification")
    out = build_variants(shuffled)
    assert [v["title"] for v in out["morning_checkin"]] == [f"M{i}" for i in range(1, 8)]


def test_ignores_unrelated_stages(capsys):
    out = build_variants(both_slots() + [row("habit_reminder", 1, "X", "y")])
    assert len(out["morning_checkin"]) == 7
    assert "skipped unknown stage" in capsys.readouterr().err  # #9 diagnostic


def test_raises_on_empty_copy():
    rows = [row("morning_notification", 1, "", "body")] + slot("evening_notification")
    with pytest.raises(ValueError, match="empty title/body"):
        build_variants(rows)


def test_raises_on_duplicate_n():
    rows = slot("evening_notification") + [
        row("morning_notification", 1, "M1", "b"),
        row("morning_notification", 1, "dup", "b"),
    ] + [row("morning_notification", n, f"M{n}", "b") for n in (2, 3, 4, 5, 6)]
    with pytest.raises(ValueError, match="duplicate n"):
        build_variants(rows)


def test_raises_on_non_contiguous_n():
    rows = [row("morning_notification", n, f"M{n}", "b") for n in (1, 2, 3, 4, 5, 6, 8)]
    rows += slot("evening_notification")
    with pytest.raises(ValueError, match="not contiguous"):
        build_variants(rows)


def test_raises_on_wrong_count():
    # 6 variants — would break the `% 7` rotation; must fail loudly (#1)
    rows = slot("morning_notification", count=6) + slot("evening_notification")
    with pytest.raises(ValueError, match="must be exactly 7"):
        build_variants(rows)


def test_raises_when_a_slot_is_missing():
    with pytest.raises(ValueError, match="no rows found for evening_checkin"):
        build_variants(slot("morning_notification"))


def test_render_is_valid_ts_with_escaped_quotes():
    rows = [
        row("morning_notification", 1, "Hey, you're up", "How'd you sleep?"),
    ] + [row("morning_notification", n, f"M{n}", "b") for n in range(2, 8)]
    rows += slot("evening_notification")
    ts = render_ts(build_variants(rows))
    assert ts.startswith("// GENERATED — do not edit by hand.")
    assert "export const REMINDER_VARIANTS" in ts
    assert "morning_checkin:" in ts and "evening_checkin:" in ts
    assert '"Hey, you\'re up"' in ts  # json.dumps escapes into valid double-quoted JS


@pytest.mark.skipif(shutil.which("npx") is None, reason="needs npx/prettier")
def test_committed_artifact_is_canonical_prettier():
    """The committed file must be in the exact prettier form the generator emits (guards #6):
    a prettier pass leaves it byte-unchanged, and it carries the generator banner.
    Probe lives inside the project tree so prettier picks up the repo .prettierrc."""
    committed = OUTPUT_PATH.read_text(encoding="utf-8")
    assert committed.startswith("// GENERATED — do not edit by hand.")
    probe = OUTPUT_PATH.parent / "_parity_probe.ts"
    probe.write_text(committed, encoding="utf-8")
    try:
        subprocess.run(["npx", "prettier", "--write", str(probe)], check=True, cwd=ROOT.parent.parent)
        assert probe.read_text(encoding="utf-8") == committed, "committed artifact is not prettier-clean"
    finally:
        probe.unlink(missing_ok=True)
