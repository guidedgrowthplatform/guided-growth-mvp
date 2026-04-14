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
