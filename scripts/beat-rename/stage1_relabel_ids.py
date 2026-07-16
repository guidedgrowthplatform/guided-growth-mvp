#!/usr/bin/env python3
"""Stage 1 of the beat-id rename: relabel each render beat entry's `id` field
in beatsSource.ts to the locked scheme. Keeps name / order / screenId / type
untouched (those are later stages). Deterministic: keyed on the current slug.

Mapping source: the App Master Sheet "Beat Rename Map" tab, validated against
the live screenId/slug values in beatsSource.ts on 2026-07-16.
"""
import re
import sys
import pathlib

SRC = pathlib.Path("src/components/flow-designer/beatsSource.ts")

# current render slug -> new beat id (colon form where the entry is a variant)
MAPPING = {
    "splash": "onboarding-beat-1-splash",
    "get-started": "onboarding-beat-2-get-started",
    "coach-greeting": "onboarding-beat-3-coach-greeting",
    "sign-up": "onboarding-beat-4-sign-up",
    "mic-permission": "onboarding-beat-5-mic-permission",
    "profile-greeting": "onboarding-beat-6-profile:greeting",
    "profile-asks": "onboarding-beat-6-profile:asks",
    "state-check": "onboarding-beat-7-state-check",
    "checkin": "onboarding-beat-8-morning-checkin-setup",
    "reflection": "onboarding-beat-9-evening-reflection-setup",
    "fork": "onboarding-beat-10-experience-fork",
    "category": "onboarding-beginner-beat-11-pick-category",
    "category-women": "onboarding-beginner-beat-11-pick-category:women",
    "goals-sleep": "onboarding-beginner-beat-12-pick-goals:sleep",
    "goals-move": "onboarding-beginner-beat-12-pick-goals:move",
    "goals-eat": "onboarding-beginner-beat-12-pick-goals:eat",
    "goals-energy": "onboarding-beginner-beat-12-pick-goals:energy",
    "goals-stress": "onboarding-beginner-beat-12-pick-goals:stress",
    "goals-focus": "onboarding-beginner-beat-12-pick-goals:focus",
    "goals-break": "onboarding-beginner-beat-12-pick-goals:break",
    "goals-organize": "onboarding-beginner-beat-12-pick-goals:organize",
    "goal-custom": "onboarding-beginner-beat-12-pick-goals:custom",
    "habits": "onboarding-beginner-beat-13-pick-habits",
    "habits-fall-asleep-earlier": "onboarding-beginner-beat-13-pick-habits:fall-asleep-earlier",
    "habits-wake-earlier": "onboarding-beginner-beat-13-pick-habits:wake-earlier",
    "habits-sleep-consistently": "onboarding-beginner-beat-13-pick-habits:sleep-consistently",
    "habits-sleep-deeply": "onboarding-beginner-beat-13-pick-habits:sleep-deeply",
    "habits-walk-more": "onboarding-beginner-beat-13-pick-habits:walk-more",
    "habits-exercise-consistently": "onboarding-beginner-beat-13-pick-habits:exercise-consistently",
    "habits-mobility": "onboarding-beginner-beat-13-pick-habits:mobility",
    "habits-eat-intentionally": "onboarding-beginner-beat-13-pick-habits:eat-intentionally",
    "habits-reduce-overeating": "onboarding-beginner-beat-13-pick-habits:reduce-overeating",
    "habits-plan-food": "onboarding-beginner-beat-13-pick-habits:plan-food",
    "habits-morning-energy": "onboarding-beginner-beat-13-pick-habits:morning-energy",
    "habits-avoid-crashes": "onboarding-beginner-beat-13-pick-habits:avoid-crashes",
    "habits-stable-energy": "onboarding-beginner-beat-13-pick-habits:stable-energy",
    "habits-calmer-day": "onboarding-beginner-beat-13-pick-habits:calmer-day",
    "habits-evening-stress": "onboarding-beginner-beat-13-pick-habits:evening-stress",
    "habits-less-overwhelmed": "onboarding-beginner-beat-13-pick-habits:less-overwhelmed",
    "habits-start-work": "onboarding-beginner-beat-13-pick-habits:start-work",
    "habits-deeper-work": "onboarding-beginner-beat-13-pick-habits:deeper-work",
    "habits-procrastinate-less": "onboarding-beginner-beat-13-pick-habits:procrastinate-less",
    "habits-smoking": "onboarding-beginner-beat-13-pick-habits:smoking",
    "habits-weed": "onboarding-beginner-beat-13-pick-habits:weed",
    "habits-alcohol": "onboarding-beginner-beat-13-pick-habits:alcohol",
    "habits-porn": "onboarding-beginner-beat-13-pick-habits:porn",
    "habits-phone-use": "onboarding-beginner-beat-13-pick-habits:phone-use",
    "habits-late-snacking": "onboarding-beginner-beat-13-pick-habits:late-snacking",
    "habits-caffeine": "onboarding-beginner-beat-13-pick-habits:caffeine",
    "habits-stay-on-tasks": "onboarding-beginner-beat-13-pick-habits:stay-on-tasks",
    "habits-tidy-spaces": "onboarding-beginner-beat-13-pick-habits:tidy-spaces",
    "habits-life-admin": "onboarding-beginner-beat-13-pick-habits:life-admin",
    "habit-custom": "onboarding-beginner-beat-13-pick-habits:custom",
    "schedule": "onboarding-beginner-beat-14-schedule-habits",
    "advanced-capture": "onboarding-advanced-beat-15-capture-existing-habits",
    "advanced-frequency": "onboarding-advanced-beat-16-schedule-existing-habits",
    "plan": "onboarding-beat-17-plan-review",
    "weekly-blank": "onboarding-beat-18-week-projection:empty",
    "weekly-full": "onboarding-beat-18-week-projection:best",
    "weekly-p78": "onboarding-beat-18-week-projection:likely",
    "weekly-p36": "onboarding-beat-18-week-projection:some",
    "weekly-gaps": "onboarding-beat-18-week-projection:avoid",
}

# match a top-level entry id line only: exactly 4 spaces, id: '<slug>',
LINE_RE = re.compile(r"^(    id: ')([^']+)(',)$")

def main():
    text = SRC.read_text()
    out_lines = []
    seen = []
    for line in text.split("\n"):
        m = LINE_RE.match(line)
        if m:
            slug = m.group(2)
            if slug not in MAPPING:
                print(f"ERROR: unmapped beat id slug found: {slug!r}", file=sys.stderr)
                sys.exit(2)
            new_id = MAPPING[slug]
            seen.append(slug)
            out_lines.append(f"{m.group(1)}{new_id}{m.group(3)}")
        else:
            out_lines.append(line)

    # every mapping key must be hit exactly once
    missing = [k for k in MAPPING if k not in seen]
    dupes = [k for k in set(seen) if seen.count(k) > 1]
    if missing:
        print(f"ERROR: {len(missing)} mapping keys never matched: {missing}", file=sys.stderr)
        sys.exit(3)
    if dupes:
        print(f"ERROR: duplicate id lines matched: {dupes}", file=sys.stderr)
        sys.exit(4)
    if len(seen) != 62:
        print(f"ERROR: expected 62 id lines, matched {len(seen)}", file=sys.stderr)
        sys.exit(5)

    SRC.write_text("\n".join(out_lines))
    print(f"OK: relabeled {len(seen)} beat ids in {SRC}")

if __name__ == "__main__":
    main()
