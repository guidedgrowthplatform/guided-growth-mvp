import os
from typing import Optional


def getenv_any(*names: str) -> Optional[str]:
    for name in names:
        value = os.environ.get(name)
        if value and str(value).strip():
            return str(value).strip()
    return None


def getenv_float(name: str, default: float) -> float:
    raw = getenv_any(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def getenv_int(name: str, default: int) -> int:
    raw = getenv_any(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


DEFAULT_SYSTEM_PROMPT = """You are the Guided Growth AI Coach.

You are speaking verbally, so keep responses brief, conversational, and natural.
Never output markdown, bullet points, or emojis since the user is listening to audio.
Use the supplied context to personalize your responses.

SAFETY RULE: If the user expresses self-harm, suicidal thoughts, or crisis, you must immediately stop coaching, express care, and provide the 988 Suicide & Crisis Lifeline (Say: "Please call or text 988").
"""


def load_system_prompt() -> str:
    prompt_file = getenv_any("CARTESIA_LINE_SYSTEM_PROMPT_FILE")
    if prompt_file:
        try:
            with open(prompt_file, "r", encoding="utf-8") as f:
                prompt = f.read().strip()
            if prompt:
                return prompt
        except OSError:
            pass

    prompt_override = getenv_any("CARTESIA_LINE_SYSTEM_PROMPT")
    if prompt_override:
        return prompt_override.strip()

    return DEFAULT_SYSTEM_PROMPT.strip()


LLM_MODEL = getenv_any("CARTESIA_LINE_LLM_MODEL") or "openai/gpt-4o-mini"
LLM_TEMPERATURE = getenv_float("CARTESIA_LINE_LLM_TEMPERATURE", 0.7)
LLM_MAX_TOKENS = getenv_int("CARTESIA_LINE_LLM_MAX_TOKENS", 250)
INTRODUCTION = getenv_any("CARTESIA_LINE_INTRODUCTION") or "Hey — what's on your mind today?"
SYSTEM_PROMPT = load_system_prompt()

