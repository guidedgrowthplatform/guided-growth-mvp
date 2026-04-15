"""Cartesia Line Agent — Tool Definitions

These are the functions the LLM can call during a real-time conversation
to access and update user data in Supabase.

Architecture Doc Reference: Section 3.2
Voice Journey Spreadsheet: AI Coaching Framework tab
"""

import os
from datetime import date, datetime
from typing import Annotated

from line.llm_agent.tools.utils import ToolEnv
from supabase import create_client, Client

# ─── Supabase Client ─────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

_supabase: Client | None = None


def _get_supabase() -> Client | None:
    """Lazy-init Supabase client."""
    global _supabase
    if _supabase is None and SUPABASE_URL and SUPABASE_KEY:
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase


# ─── Tool: Record Onboarding Profile ───────────────────────────────────────
# Agent calls this tool as soon as the user provides profile info during
# ONBOARD-01. The tool's return string is spoken back to the user by the
# LLM; the tool_call event is also forwarded to the browser so it can
# auto-fill the form fields.

async def record_onboarding_profile(
    ctx: ToolEnv,
    user_id: Annotated[str, "The authenticated user's UUID (from system prompt)"],
    nickname: Annotated[str, "The user's preferred name or nickname"] = "",
    age: Annotated[int, "The user's age in years"] = 0,
    gender: Annotated[str, "Male | Female | Other"] = "",
    referral_source: Annotated[
        str, "Founder Invite | Webinar | Friend | Other"
    ] = "",
) -> str:
    """Record the user's profile fields during ONBOARD-01.
    Call this as soon as the user provides any of: nickname, age, gender,
    referral source. Call again as more fields become known. Don't wait
    for all four — partial calls are OK. ALWAYS pass user_id from the
    system prompt. The fields are persisted to Supabase so the web UI
    auto-fills the form as you call this tool."""
    filled = {}
    if nickname:
        filled["nickname"] = nickname
    if age:
        filled["age"] = age
    if gender:
        filled["gender"] = gender
    if referral_source:
        filled["referralSource"] = referral_source

    if not filled or not user_id:
        return "No profile fields provided yet."

    sb = _get_supabase()
    if not sb:
        return f"Captured locally: {filled} (db unavailable — user must retap to save)."

    try:
        # Merge with any existing draft data so partial calls accumulate.
        existing = (
            sb.table("onboarding_states")
            .select("data")
            .eq("user_id", user_id)
            .maybeSingle()
            .execute()
        )
        prior = (existing.data or {}).get("data") or {}
        merged = {**prior, **filled}
        sb.table("onboarding_states").upsert(
            {
                "user_id": user_id,
                "current_step": 1,
                "path": "shared",
                "status": "in_progress",
                "data": merged,
                "updated_at": datetime.utcnow().isoformat(),
            },
            on_conflict="user_id",
        ).execute()
        summary = ", ".join(f"{k}: {v}" for k, v in filled.items())
        return f"Recorded and saved: {summary}."
    except Exception as e:
        return f"Captured {filled} but save failed: {e}. User can tap to confirm."


# ─── Tool: Get User Context ─────────────────────────────────────────────────

async def get_user_context(
    ctx: ToolEnv,
    user_id: Annotated[str, "The authenticated user's UUID"],
) -> str:
    """Fetch user profile, habits, streaks, and today's check-in.
    Call this at the start of every conversation to personalize responses."""
    sb = _get_supabase()
    if not sb:
        return "Cannot access user data. Speak generally without referencing specifics."

    try:
        # Profile
        profile_res = (
            sb.table("user_profiles")
            .select("nickname, coaching_style, voice_mode")
            .eq("id", user_id)
            .single()
            .execute()
        )
        profile = profile_res.data or {}
        nickname = profile.get("nickname", "there")
        style = profile.get("coaching_style", "warm")

        # Habits with streaks
        habits_res = (
            sb.table("habits")
            .select("name, current_streak, frequency")
            .eq("user_id", user_id)
            .eq("archived", False)
            .execute()
        )
        habits = habits_res.data or []
        habits_text = ""
        if habits:
            habits_lines = []
            for h in habits:
                streak = h.get("current_streak", 0)
                freq = h.get("frequency", "daily")
                habits_lines.append(f"- {h['name']}: {streak}-day streak ({freq})")
            habits_text = "Active habits:\n" + "\n".join(habits_lines)
        else:
            habits_text = "No active habits yet."

        # Today's check-in
        today = date.today().isoformat()
        checkin_res = (
            sb.table("checkins")
            .select("mood, sleep, energy, stress")
            .eq("user_id", user_id)
            .eq("date", today)
            .limit(1)
            .execute()
        )
        checkin_text = ""
        checkins = checkin_res.data or []
        if checkins:
            c = checkins[0]
            parts = []
            if c.get("sleep") is not None:
                parts.append(f"sleep: {c['sleep']}/5")
            if c.get("mood") is not None:
                parts.append(f"mood: {c['mood']}/5")
            if c.get("energy") is not None:
                parts.append(f"energy: {c['energy']}/5")
            if c.get("stress") is not None:
                parts.append(f"stress: {c['stress']}/5")
            if parts:
                checkin_text = f"Today's check-in: {', '.join(parts)}"
        else:
            checkin_text = "No check-in recorded today."

        return f'''User context:
Name: {nickname}
Coaching style: {style}
{habits_text}
{checkin_text}'''

    except Exception as e:
        return f"Error fetching user context: {e}. Speak generally."


# ─── Tool: Log Check-in ─────────────────────────────────────────────────────

async def log_checkin(
    ctx: ToolEnv,
    user_id: Annotated[str, "The user's UUID"],
    mood: Annotated[int, "Mood rating 1-5"],
    sleep: Annotated[int, "Sleep quality 1-5"],
    energy: Annotated[int, "Energy level 1-5"],
    stress: Annotated[int, "Stress level 1-5"],
) -> str:
    """Save or update the user's daily check-in data.
    Call when the user verbally reports their mood, sleep, energy, or stress."""
    sb = _get_supabase()
    if not sb:
        return "Cannot save check-in right now. Acknowledge the user's report verbally."

    try:
        today = date.today().isoformat()

        # Upsert: update if exists, insert if not
        sb.table("checkins").upsert(
            {
                "user_id": user_id,
                "date": today,
                "mood": max(1, min(5, mood)),
                "sleep": max(1, min(5, sleep)),
                "energy": max(1, min(5, energy)),
                "stress": max(1, min(5, stress)),
                "updated_at": datetime.utcnow().isoformat(),
            },
            on_conflict="user_id,date",
        ).execute()

        return f"Check-in saved. Mood: {mood}/5, Sleep: {sleep}/5, Energy: {energy}/5, Stress: {stress}/5."

    except Exception as e:
        return f"Failed to save check-in: {e}. Let the user know it didn't save but acknowledge their report."


# ─── Tool: Get Habits ────────────────────────────────────────────────────────

async def get_habits(
    ctx: ToolEnv,
    user_id: Annotated[str, "The user's UUID"],
) -> str:
    """Get the user's active habits with completion status for today.
    Call when the user asks about their habits or you need to reference specific habits."""
    sb = _get_supabase()
    if not sb:
        return "Cannot fetch habits right now."

    try:
        habits_res = (
            sb.table("habits")
            .select("id, name, current_streak, frequency")
            .eq("user_id", user_id)
            .eq("archived", False)
            .execute()
        )
        habits = habits_res.data or []
        if not habits:
            return "User has no active habits."

        # Check today's completions
        today = date.today().isoformat()
        entries_res = (
            sb.table("entries")
            .select("habit_id, completed")
            .eq("user_id", user_id)
            .eq("date", today)
            .execute()
        )
        completed_ids = {
            e["habit_id"] for e in (entries_res.data or []) if e.get("completed")
        }

        lines = []
        for h in habits:
            status = "✓ done today" if h["id"] in completed_ids else "not yet today"
            lines.append(
                f"- {h['name']}: {h.get('current_streak', 0)}-day streak, {status}"
            )

        return "Habits:\n" + "\n".join(lines)

    except Exception as e:
        return f"Error fetching habits: {e}"


# ─── Tool: Log Goal ─────────────────────────────────────────────────────────

async def log_goal(
    ctx: ToolEnv,
    user_id: Annotated[str, "The user's UUID"],
    goal_text: Annotated[str, "The goal or intention the user stated"],
) -> str:
    """Save the user's daily goal or intention.
    Call when the user sets a goal during morning check-in or conversation."""
    sb = _get_supabase()
    if not sb:
        return "Cannot save goal right now. Acknowledge the user's goal verbally."

    try:
        today = date.today().isoformat()

        sb.table("daily_goals").upsert(
            {
                "user_id": user_id,
                "date": today,
                "goal_text": goal_text,
                "created_at": datetime.utcnow().isoformat(),
            },
            on_conflict="user_id,date",
        ).execute()

        return f"Goal saved: \"{goal_text}\". Reference this goal in evening check-in."

    except Exception as e:
        return f"Failed to save goal: {e}. Acknowledge the user's goal verbally anyway."


# ─── Tool: Navigate Next ────────────────────────────────────────────────────
# Called by the agent when the current screen's objective is complete and
# the user should be advanced to the next screen. The tool_call event is
# forwarded to the browser which performs the client-side navigation.


async def navigate_next(
    ctx: ToolEnv,
    user_id: Annotated[str, "The authenticated user's UUID"],
    from_screen: Annotated[
        str, "The screen the user is leaving, e.g. onboard_01"
    ],
    reason: Annotated[
        str,
        "Why navigation is triggered (e.g. 'profile complete', 'user confirmed')",
    ] = "",
) -> str:
    """Advance the user to the next screen in the flow.
    Call ONLY when the current screen's data capture is fully complete
    (e.g. in ONBOARD-01: nickname + age + gender + referral all recorded).
    The frontend listens for this tool call and performs the actual
    navigation. Do not call prematurely — one call per screen transition."""
    sb = _get_supabase()
    if sb and user_id:
        try:
            sb.table("onboarding_states").update(
                {
                    "status": "ready_for_next",
                    "last_completed_screen": from_screen,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("user_id", user_id).execute()
        except Exception:
            # Navigation signal is primarily via tool_call event; DB write
            # is best-effort bookkeeping.
            pass

    note = f" ({reason})" if reason else ""
    return f"Advancing from {from_screen}{note}."


# ─── Tool: Update Profile ───────────────────────────────────────────────────
# General-purpose profile field updates after onboarding. Use
# record_onboarding_profile during ONBOARD-01 itself; use update_profile for
# changes the user states later ("call me Sam", "I prefer the direct coaching
# style", etc.).


async def update_profile(
    ctx: ToolEnv,
    user_id: Annotated[str, "The authenticated user's UUID"],
    nickname: Annotated[str, "Updated preferred name"] = "",
    coaching_style: Annotated[
        str, "warm | direct | reflective"
    ] = "",
    voice_mode: Annotated[
        str, "voice | screen | always_ask"
    ] = "",
) -> str:
    """Update the user's profile fields outside of ONBOARD-01.
    Only pass fields the user explicitly asked to change. Empty strings
    are ignored. Persists to user_profiles."""
    updates: dict[str, str] = {}
    if nickname:
        updates["nickname"] = nickname
    if coaching_style in ("warm", "direct", "reflective"):
        updates["coaching_style"] = coaching_style
    if voice_mode in ("voice", "screen", "always_ask"):
        updates["voice_mode"] = voice_mode

    if not updates or not user_id:
        return "No profile changes to apply."

    sb = _get_supabase()
    if not sb:
        return f"Cannot save profile changes right now: {updates}."

    try:
        sb.table("user_profiles").update(
            {**updates, "updated_at": datetime.utcnow().isoformat()}
        ).eq("id", user_id).execute()
        summary = ", ".join(f"{k}={v}" for k, v in updates.items())
        return f"Profile updated: {summary}."
    except Exception as e:
        return f"Failed to update profile ({updates}): {e}."
