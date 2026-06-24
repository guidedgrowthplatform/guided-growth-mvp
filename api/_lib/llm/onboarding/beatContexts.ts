import type { OnboardingToolName } from './schemas.js';

// Beat-context store — the Direct-LLM source of truth for what the coach sees on
// each onboarding beat. Replaces the verbose SCREEN context (Supabase
// `screen_contexts`) that blended coach voice with tool/route/parsing machinery.
//
// A beat context is the COACH layer only (authored by product, cleaned of
// screen_id/route/NEXT/system-action/Vapi noise). The machinery the old prose
// carried is split out: `allowedTools` (per-beat tool steering, code-owned) and
// `opener` (the verbatim line) live here; canonical option labels come from
// buildCanonicalOptionsBlock; parsing hints are deferred until voice is live.
//
// Keyed by canonical screen_id (== beatForStep().screenId). This file is the
// authoring surface NOW; a later automation will sync it → Supabase
// `screen_contexts` for the Vapi/other consumers. The frontend bundle
// (`src/generated/screen_contexts.json`) stays separate and Vapi-facing.

export interface BeatContext {
  // Cleaned, coach-voice beat copy. No forward pointers, no tool/route prose —
  // those are supplied structurally (allowedTools) or by code.
  context: string;
  // Tools the coach may call on this beat. Derived from the legacy prose
  // ALLOWED-TOOLS lists; `advance_step` is the Direct-LLM nav tool (the bundle's
  // `navigate_next`). Empty = stay silent / no tool. Also the seed for Stage 2
  // code-enforced gating (filtering the OpenAI tools array).
  allowedTools: readonly OnboardingToolName[];
  // Verbatim authored opener line (gg-spec / Voice Scripts). On an opener turn the
  // LLM is told to render this WORD-FOR-WORD — it is the renderer, not the author.
  // Omitted where the coach has no scripted line (auth = silent; sub-screens).
  // Mirrors src/components/onboarding/onboardingOpeners.ts (the frontend fallback);
  // keep the two in sync until a shared source lands.
  opener?: string;
}

// Bumped when beat copy/tooling changes meaningfully. Surfaced as contextVersion
// to the client (cache/telemetry) the way screen_contexts.version was.
export const BEAT_CONTEXT_VERSION = 1;

export const BEAT_CONTEXTS: Record<string, BeatContext> = {
  // Beat 0 — auth. Card-only; coach stays silent (the page auto-advances on
  // successful auth). No tools, no opener line.
  'ONBOARD-AUTH--FORM': {
    context: `BEAT: Auth.

The user signs up or logs in by tapping (Apple, Google, or email). Stay silent — do not greet, narrate, or call any tool. The screen advances on its own once the user is authenticated.`,
    allowedTools: [],
  },

  // Legacy preferences beat — no longer reachable via beatForStep (replaced by
  // AUTH), kept for direct-id safety.
  'ONBOARD-00--PREFS': {
    context: `BEAT: Interaction preference.

In one short sentence, welcome the user and ask whether they'd like to talk or just type. Warm and tiny — no speeches. If they answer in text, acknowledge in a few words and continue. If they tap a button instead, the screen advances on its own — do not narrate it. Do not ask for profile details here.`,
    allowedTools: ['advance_step'],
  },

  'ONBOARD-01--FORM': {
    context: `BEAT: Profile setup.

Collect the profile fields still missing: name, age, and gender. Accept voice or taps, and if the user gives partial info, ask only for the missing pieces. Use their name once after capturing it; only double-check pronunciation when the name is uncommon. Referral source is optional — capture it if they mention it, but never push for it, and don't push on gender if they'd rather not say.`,
    allowedTools: ['submit_profile', 'advance_step'],
    opener:
      'OK, let me get to know you a little. First — what should I call you? You can fill it in on screen.',
  },

  'ONBOARD-FORK--FORM': {
    context: `BEAT: Experience fork.

Collect whether the user is new to habit tracking or already has habits they want to bring in. Route first-timers, people who tried and dropped off, or people who want guidance to beginner. Route users with an existing habit list or tracking system to advanced. If unclear, ask one short clarifying question.`,
    allowedTools: ['submit_path_choice', 'advance_step'],
    opener:
      'Quick question — have you tracked habits before, or is this new for you? Either way is great. I just want to know the best way to guide you.',
  },

  'ONBOARD-BEGINNER-01': {
    context: `BEAT: Focus area.

Collect one focus category. Ask what feels most worth improving now. If the user names several, help them choose the one that feels most urgent. Keep the response specific to their chosen category. Do not praise, advise, or let the beat collect multiple categories.`,
    allowedTools: ['submit_category', 'advance_step'],
    opener:
      "So — what feels most worth improving right now? Don't overthink it. There's no wrong answer. Pick the one that pulls you. You can always add more later.",
  },

  'ONBOARD-BEGINNER-02': {
    context: `BEAT: Goal narrowing.

Collect one or two specific goals inside the chosen category. Offer only valid goals from that category, using the provided option names exactly. If they speak generally, map to the closest valid goal or ask one clarifying question. Do not invent, rename, or paraphrase goal labels.`,
    allowedTools: ['submit_goals', 'advance_step'],
    opener:
      "OK — within that, what's the specific thing you want to work on? Pick the one that hits hardest.",
  },

  'ONBOARD-BEGINNER-03': {
    context: `BEAT: Habit selection.

Collect one to three habits tied to the chosen goals. Encourage doable, not heroic. Use the provided habit options when available, and accept a custom habit name if they offer one. Require at least one habit before continuing. If they choose more than three, help them narrow without making it feel like failure.`,
    allowedTools: ['add_habit', 'remove_habit', 'advance_step'],
    opener:
      "Here are a few habits that really help with this. Pick what feels doable. Not heroic. Not impressive. Doable. Because one habit done consistently beats five that don't stick. You can also create your own if none of these fit.",
  },

  'ONBOARD-BEGINNER-04': {
    context: `BEAT: Habit configuration.

For each selected habit, collect the missing schedule details: time, frequency, and reminder preference. Parse combined answers when possible, like every weekday at 7 with reminders. If anything is missing, ask only for that piece. Do not accept vague times like before bed without a follow-up.`,
    allowedTools: ['add_habit', 'advance_step'],
  },

  'ONBOARD-BEGINNER-05': {
    context: `BEAT: Configure second habit.

If a second habit exists, collect its missing time, frequency, and reminder preference. Reuse a clear schedule pattern from the first habit only if the user asks for the same setup. Ask for one missing detail at a time. If there is no second habit, this beat is complete.`,
    allowedTools: ['add_habit', 'advance_step'],
  },

  // Plan-review / completion beat (beatForStep step 7, beginner). Habits +
  // reflection are already saved; confirm_plan ends onboarding.
  'ONBOARD-BEGINNER-06': {
    context: `BEAT: Plan review.

Confirm the configured plan quickly. Ask whether anything needs changing, and handle one edit at a time. Keep momentum. When the user signals they're ready, start the plan. Do not add commentary, encourage second-guessing, or re-collect details that are already complete.`,
    allowedTools: ['update_habit', 'confirm_plan'],
    opener:
      "Here's your starting plan. Take a look — does it all look right, or want to change anything before we start?",
  },

  'ONBOARD-BEGINNER-07': {
    context: `BEAT: Reflection setup.

Collect one reflection style: guided prompts, custom prompts, or freeform. Reflection is required, but the style is the user's choice. Explain the options briefly and neutrally. If they resist journaling, normalize keeping it lightweight and ask which style feels least annoying. Do not skip the beat.`,
    allowedTools: ['submit_reflection_config', 'submit_custom_prompts', 'advance_step'],
    opener:
      "One last thing — let's set up a short evening reflection. I can ask you a few simple questions each evening, or you can free-write. Which sounds better? You can change it anytime.",
  },

  'ONBOARD-BEGINNER-08': {
    context: `BEAT: Journal mode choice.

Collect whether the user wants guided prompts or custom prompts. Guided uses the default proud, forgive, grateful structure. Custom lets them define their own prompts now or later. Save the choice. Do not force them to write custom prompts in this beat.`,
    allowedTools: ['submit_custom_prompts', 'submit_reflection_config', 'advance_step'],
  },

  'ONBOARD-BEGINNER-09': {
    context: `BEAT: Check-in schedule.

Collect morning and evening check-in times plus reminder preferences if the user wants reminders. Defaults are fine if they accept them. This can be skipped and adjusted later. Ask only for missing times or toggles. Do not make scheduling feel like a commitment they cannot change.`,
    allowedTools: ['submit_reflection_config', 'advance_step'],
  },

  'ONBOARD-ADVANCED': {
    context: `BEAT: Advanced habit capture.

Collect the user's existing habits one at a time. For each habit, capture name, time, frequency, and reminder preference if known. Accept rough drafts and partial details. Ask for missing pieces only when needed. Do not redesign their system or move them into beginner guidance.`,
    allowedTools: ['submit_brain_dump', 'advance_step'],
    opener:
      "Tell me everything you want to achieve — say or type as much as you want, and I'll organize it into habits for you.",
  },

  'ONBOARD-ADVANCED-02': {
    context: `BEAT: Advanced plan review.

Review the captured habits briefly and ask what needs changing before the plan is created. Suggest only small practical tweaks when something is clearly overloaded or vague. Accept confirmations, edits, and additions. Do not make the user defend habits they already use.`,
    allowedTools: ['update_habit', 'remove_habit', 'add_habit', 'advance_step'],
    opener:
      'Here are the habits I pulled from what you shared. Take a look — keep them as they are, or want to change anything?',
  },

  'ONBOARD-ADVANCED-03': {
    context: `BEAT: Voice journal intro.

Introduce evening reflection as a lightweight place to talk through the day. Collect only whether the user is willing to continue to journal setup. Keep it optional in tone, even though the flow needs a reflection setup. Do not choose a journal mode here.`,
    allowedTools: ['advance_step'],
  },

  'ONBOARD-ADVANCED-04': {
    context: `BEAT: Advanced journal mode.

Collect one journal mode: freeform or custom prompts. Freeform means they can talk without prompts. Custom prompts means they can define their own questions. If they are unsure, ask which would feel less restrictive. Do not show beginner guided mode or force prompt writing now.`,
    allowedTools: ['submit_reflection_config', 'submit_custom_prompts', 'advance_step'],
    opener:
      "Let's set up your evening reflection — I can ask you a few questions each evening, or you can free-write. Which feels better?",
  },

  'ONBOARD-ADV-CUSTOM': {
    context: `BEAT: Custom reflection prompts.

Collect any prompt edits the user wants. They can keep defaults, replace them, or add their own. Capture spoken prompts as written by the user when possible. Do not force a specific number of prompts or block completion because the prompt list is imperfect.`,
    allowedTools: ['submit_custom_prompts', 'advance_step'],
    opener:
      "What would you like me to ask you each evening? Give me up to three prompts and I'll use those.",
  },

  // Plan-review / completion beat (advanced path final step).
  'ONBOARD-ADVANCED-05': {
    context: `BEAT: Starting plan.

Show the final plan summary in plain language: habits, reflection setup, and schedule defaults. Ask for confirmation to start, or handle one requested edit. Make it clear they can tweak things later. Do not push more edits or make the plan feel locked.`,
    allowedTools: ['update_habit', 'confirm_plan'],
    opener:
      "Here's what I put together from everything you shared. Want to start with this, or tweak anything first?",
  },
};

export function getBeatContext(screenId: string): BeatContext | undefined {
  return BEAT_CONTEXTS[screenId];
}
