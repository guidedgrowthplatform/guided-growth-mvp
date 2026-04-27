import os
from typing import Annotated, Optional

from line.llm_agent import LlmAgent, LlmConfig, end_call, loopback_tool
from line.voice_agent_app import VoiceAgentApp
from supabase import create_client
from config import INTRODUCTION, LLM_MAX_TOKENS, LLM_MODEL, LLM_TEMPERATURE, SYSTEM_PROMPT


def getenv_any(*names: str) -> Optional[str]:
    for name in names:
        v = os.environ.get(name)
        if v and str(v).strip():
            return str(v).strip()
    return None


SUPABASE_URL = getenv_any("SUPABASE_URL", "VITE_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = getenv_any("SUPABASE_SERVICE_ROLE_KEY")

supabase = (
    create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    else None
)


@loopback_tool
async def get_user_context(
    ctx,
    user_id: Annotated[str, "Supabase auth user id (UUID)"],
) -> str:
    """
    Fetch the user's profile + active habits from Supabase for personalization.
    If Supabase isn't configured, returns a generic message.
    """
    if not supabase:
        return "Context not available (Supabase not configured). Speak generally."

    try:
        profile = (
            supabase.table("profiles")
            .select("nickname, coaching_style")
            .eq("id", user_id)
            .single()
            .execute()
        )
        nickname = (profile.data or {}).get("nickname") or "there"
        style = (profile.data or {}).get("coaching_style") or "warm"

        habits_result = (
            supabase.table("user_habits")
            .select("name, cadence")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )
        habits = habits_result.data or []
        names = [h.get("name") for h in habits if isinstance(h, dict) and h.get("name")]
        habits_info = "Active habits: " + ", ".join(names[:10]) if names else "No active habits."

        return f'Name: "{nickname}". Coaching style: {style}. {habits_info}'
    except Exception as e:
        return f"Error fetching context: {e}"


async def get_agent(_env, _call_request):
    # NOTE: Line uses LiteLLM under the hood; provider-prefixed models work well.
    # You can swap model/provider without changing the rest of the app.
    return LlmAgent(
        model=LLM_MODEL,
        api_key=os.getenv("OPENAI_API_KEY"),
        tools=[get_user_context, end_call],
        config=LlmConfig(
            system_prompt=SYSTEM_PROMPT,
            introduction=INTRODUCTION,
            temperature=LLM_TEMPERATURE,
            max_tokens=LLM_MAX_TOKENS,
        ),
    )


app = VoiceAgentApp(get_agent=get_agent)

if __name__ == "__main__":
    # For local testing:
    #   OPENAI_API_KEY=... PORT=8000 uv run python main.py
    app.run()
