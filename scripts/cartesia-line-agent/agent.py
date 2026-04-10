# Cartesia Line Agent Prototype
# This handles real-time conversational voice for the Guided Growth MVP using Cartesia Line SDK.
# Deploy with `cartesia deploy` when you have upgrading to the Cartesia Startup plan.

import os
from typing import TypedDict
import line
import json
import requests
from supabase import create_client

# -- Configuration --
# (Normally loaded from Cartesia agent environment overrides during cartesia deploy)
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    supabase = None

class ContextState(TypedDict):
    user_id: str
    coaching_style: str

# Example system prompt referencing our coaching style structure.
# In a full deployment, you'd compose this from your `src/lib/coaching/systemPrompt.ts` concepts.
SYSTEM_PROMPT = """
You are the Guided Growth AI Coach. You are speaking verbally, so keep responses brief, conversational, and natural.
Never output markdown, bullet points, or emojis since the user is listening to audio.
Use the supplied context to personalize your responses. 

SAFETY RULE: If the user expresses self-harm, suicidal thoughts, or crisis, you must immediately stop coaching, express care, and provide the 988 Suicide & Crisis Lifeline (Say: "Please call or text 988").
"""

line_agent = line.agent(
    llm=line.llm(
        # We wrap GPT-4o-mini via litellm structure
        model="openai/gpt-4o-mini",
        system_prompt=SYSTEM_PROMPT,
        temperature=0.7,
        max_tokens=250
    ),
    voice=line.voice(
        # '694f9ed8-eb98-4842-8809-5a587930ed6b' is a sonic-english voice (e.g. Male Default or Cloned)
        model="sonic-english",
        voice_id=os.environ.get("CARTESIA_VOICE_ID", "694f9ed8-eb98-4842-8809-5a587930ed6b")
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
        # Fetch basic profile
        profile = supabase.table("user_profiles").select("nickname, coaching_style").eq("id", user_id).single().execute()
        nickname = profile.data.get("nickname", "there")
        style = profile.data.get("coaching_style", "warm")
        
        # Example fetching active habits (mock implementation of a real query)
        habits_result = supabase.table("habits").select("name, current_streak").eq("user_id", user_id).execute()
        habits_info = "Active habits: " + ", ".join([h["name"] for h in habits_result.data]) if habits_result.data else "No active habits."
        
        return f"User prefers to be called {nickname}. Coaching style: {style}. {habits_info}"
    except Exception as e:
        return f"Error fetching context: {e}"

# The entrypoint for cartesia line deployment
if __name__ == "__main__":
    line_agent.start()
