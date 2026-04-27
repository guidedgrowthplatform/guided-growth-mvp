# Cartesia Line Agent Prototype
# This handles real-time conversational voice for the Guided Growth MVP using Cartesia Line SDK.
# Deploy with `cartesia deploy` when you have upgrading to the Cartesia Startup plan.

import os
from typing import Optional, TypedDict
import line
from supabase import create_client
from config import LLM_MAX_TOKENS, LLM_MODEL, LLM_TEMPERATURE, SYSTEM_PROMPT

# -- Configuration --
# (Normally loaded from Cartesia agent environment overrides during cartesia deploy)
def getenv_any(*names: str) -> Optional[str]:
    for name in names:
        v = os.environ.get(name)
        if v and str(v).strip():
            return str(v).strip()
    return None

# Prefer server-style names; keep VITE_SUPABASE_URL as a fallback because older
# docs/scripts used it even for server runtimes.
SUPABASE_URL = getenv_any("SUPABASE_URL", "VITE_SUPABASE_URL")
SUPABASE_KEY = getenv_any("SUPABASE_SERVICE_ROLE_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    supabase = None

class ContextState(TypedDict):
    user_id: str
    coaching_style: str

line_agent = line.agent(
    llm=line.llm(
        model=LLM_MODEL,
        system_prompt=SYSTEM_PROMPT,
        temperature=LLM_TEMPERATURE,
        max_tokens=LLM_MAX_TOKENS,
    ),
    voice=line.voice(
        # '694f9ed8-eb98-4842-8809-5a587930ed6b' is a sonic-english voice (e.g. Male Default or Cloned)
        model="sonic-english",
        voice_id=getenv_any("CARTESIA_VOICE_ID") or "694f9ed8-eb98-4842-8809-5a587930ed6b"
    )
)

@line_agent.tool(loopback=True)
def get_user_context(state: ContextState) -> str:
    """
    Fetch the user's habits, streaks, and profile info so the LLM can reference it.
    """
    user_id = state.get('user_id')
    if not user_id or not supabase:
        return "Context not available. Speak generally."
        
    try:
        # Fetch profile (real table in this repo's migrations is `profiles`)
        profile = (
            supabase.table("profiles")
            .select("nickname, coaching_style")
            .eq("id", user_id)
            .single()
            .execute()
        )
        nickname = (profile.data or {}).get("nickname") or "there"
        style = (profile.data or {}).get("coaching_style") or "warm"

        # Fetch active habits (real table is `user_habits`)
        habits_result = (
            supabase.table("user_habits")
            .select("name, cadence")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )
        habits = habits_result.data or []
        habit_names = [h.get("name") for h in habits if isinstance(h, dict) and h.get("name")]
        habits_info = (
            "Active habits: " + ", ".join(habit_names[:10]) if habit_names else "No active habits."
        )

        return f"User prefers to be called {nickname}. Coaching style: {style}. {habits_info}"
    except Exception as e:
        return f"Error fetching context: {e}"

# The entrypoint for cartesia line deployment
if __name__ == "__main__":
    line_agent.start()
