import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, setUserContext, handlePreflight } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { getClientIp } from './_lib/validation.js';

// PII scrubber — strips sensitive data before sending to OpenAI
function scrubPII(text: string): string {
  let scrubbed = text;

  // Replace email addresses
  scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

  // Replace phone numbers
  scrubbed = scrubbed.replace(
    /(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}/g,
    '[PHONE]',
  );

  // Replace gender words
  scrubbed = scrubbed.replace(
    /\b(male|female|man|woman|boy|girl|non-binary|nonbinary|gender-neutral|genderqueer|agender)\b/gi,
    '[GENDER]',
  );

  // Replace age numbers and ranges
  scrubbed = scrubbed.replace(
    /\b(?:([0-9]{1,3})(?:\s*(?:to|or|-)\s*[0-9]{1,3})?)\b(?!\s*[a-z])/gi,
    (match) => {
      const nums = match.match(/[0-9]{1,3}/g);
      if (nums && nums.every((n) => parseInt(n, 10) >= 1 && parseInt(n, 10) <= 120)) {
        return '[AGE]';
      }
      return match;
    },
  );

  // Replace names ONLY after explicit name patterns (not all capitalized words)
  // "my name is Sarah" → "my name is [NAME]", "I'm John" → "I'm [NAME]"
  // "call me Alex" → "call me [NAME]"
  scrubbed = scrubbed.replace(
    /\b(?:my name is|i'm|i am|call me|name's|it's)\s+([A-Z][a-z]+)/gi,
    (match, _name) => match.replace(/[A-Z][a-z]+$/, '[NAME]'),
  );

  return scrubbed;
}

// NOTE: Prompt is inlined here because Vercel serverless functions cannot
// import from ../src/lib/. The canonical version lives in
// src/lib/prompts/voice-command-system.ts — keep them in sync.

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  'twenty-first': 21,
  'twenty-second': 22,
  'twenty-third': 23,
  'twenty-fourth': 24,
  'twenty-fifth': 25,
  'twenty-sixth': 26,
  'twenty-seventh': 27,
  'twenty-eighth': 28,
  'twenty-ninth': 29,
  thirtieth: 30,
  'thirty-first': 31,
  'twenty first': 21,
  'twenty second': 22,
  'twenty third': 23,
  'twenty fourth': 24,
  'twenty fifth': 25,
  'twenty sixth': 26,
  'twenty seventh': 27,
  'twenty eighth': 28,
  'twenty ninth': 29,
};

const YEAR_WORDS: Record<string, number> = {
  'two thousand twenty-five': 2025,
  'two thousand twenty five': 2025,
  'two thousand twenty-six': 2026,
  'two thousand twenty six': 2026,
  'two thousand twenty-seven': 2027,
  'two thousand twenty seven': 2027,
  'two thousand twenty-eight': 2028,
  'two thousand twenty eight': 2028,
  'twenty twenty-five': 2025,
  'twenty twenty five': 2025,
  'twenty twenty-six': 2026,
  'twenty twenty six': 2026,
  'twenty twenty-seven': 2027,
  'twenty twenty seven': 2027,
  'twenty twenty-eight': 2028,
  'twenty twenty eight': 2028,
};

/** Convert word or digit to day number: "fifteenth" → 15, "5" → 5, "5th" → 5 */
function parseDay(s: string): number | null {
  const trimmed = s.trim().toLowerCase();
  if (ORDINALS[trimmed]) return ORDINALS[trimmed];
  const n = parseInt(trimmed, 10);
  return !isNaN(n) && n >= 1 && n <= 31 ? n : null;
}

/** Try to extract a year from remaining text: "two thousand twenty six" → 2026 */
function parseYear(s: string): number {
  const trimmed = s.trim().toLowerCase();
  // Numeric year
  const numMatch = trimmed.match(/\d{4}/);
  if (numMatch) return parseInt(numMatch[0], 10);
  // Word year
  for (const [words, year] of Object.entries(YEAR_WORDS)) {
    if (trimmed.includes(words)) return year;
  }
  return new Date().getFullYear();
}

/**
 * Safety net: extract an explicit date from the transcript when GPT misses it.
 * Handles: "12 march 2026", "march 12th", "fifteenth of march",
 *          "03/05/2026", "fifteenth march two thousand twenty six"
 */
function extractDateFromTranscript(transcript: string): string | null {
  const t = transcript.toLowerCase();

  // Numeric date: "03/05/2026" or "3/5/2026" (MM/DD/YYYY)
  const numericMatch = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (numericMatch) {
    const m = parseInt(numericMatch[1], 10);
    const d = parseInt(numericMatch[2], 10);
    const y = parseInt(numericMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Build ordinal alternatives for regex: "first|second|...|thirty-first|\d{1,2}(?:st|nd|rd|th)?"
  const ordinalWords = Object.keys(ORDINALS).join('|');
  const dayPattern = `(${ordinalWords}|\\d{1,2}(?:st|nd|rd|th)?)`;
  const monthNames = Object.keys(MONTHS).join('|');
  const monthPattern = `(${monthNames})`;

  // Pattern: "for|on DAY [of] MONTH [YEAR]"
  const p1 = new RegExp(`(?:for|on)\\s+${dayPattern}\\s+(?:of\\s+)?${monthPattern}(.*)`, 'i');
  // Pattern: "for|on MONTH DAY [YEAR]"
  const p2 = new RegExp(`(?:for|on)\\s+${monthPattern}\\s+${dayPattern}(.*)`, 'i');

  for (const pattern of [p1, p2]) {
    const match = t.match(pattern);
    if (match) {
      let dayStr: string, monthStr: string, rest: string;
      // Determine which group is day vs month
      if (match[1] && MONTHS[match[1].toLowerCase()]) {
        // p2: month first
        monthStr = match[1];
        dayStr = match[2];
        rest = match[3] || '';
      } else {
        // p1: day first
        dayStr = match[1];
        monthStr = match[2];
        rest = match[3] || '';
      }
      const day = parseDay(dayStr);
      const month = MONTHS[monthStr.toLowerCase()];
      const year = parseYear(rest);
      if (day && month) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }

  return null;
}

const SYSTEM_PROMPT = `You are the voice command processor for "Life Tracker", a habit-tracking and self-improvement app. Your job is to:
1. CORRECT any misspoken, misheard, or garbled words from the speech-to-text transcript
2. PARSE the corrected transcript into a single structured JSON command

## Transcript Correction Rules
- **CRITICAL**: The transcript comes from Cartesia Scribe STT which SEVERELY garbles short voice commands (2-5 words). Common failure patterns:
  - Command words get turned into names/sentences: "mark meditation done" → "Mark made a champagne toast" or "Mark, what is on your mind today?"
  - Single-word commands get expanded into full sentences by the STT engine
  - Habit names get replaced with phonetically similar but unrelated phrases
  - The STT may hallucinate entire sentences that the user never said
- **ALWAYS assume the user is giving a short command** to their habit tracker, not having a conversation
- If the transcript sounds like a random sentence but contains words phonetically similar to habit-tracking commands (mark, done, create, delete, log, meditation, exercise, reading, etc.), reconstruct the most likely command
- Fix obvious STT errors: "meditatoin" → "meditation", "exorcise" → "exercise"
- Fix phonetic mishearing: "mark done reading on me" → "mark reading done"
- Remove filler words: "um", "uh", "like", "so", "you know"
- DO NOT change proper nouns or custom habit names the user may have created
- DO NOT change the user's intent — only fix transcription artifacts
- Include the corrected transcript in your response as "corrected_transcript"

## Available Actions
| Action   | When to use                                                |
|----------|------------------------------------------------------------|
| create   | User wants to ADD a new habit or metric                    |
| complete | User wants to MARK a habit as done for a date or range    |
| delete   | User wants to REMOVE a habit or metric                     |
| update   | User wants to RENAME or change settings of a habit/metric  |
| query    | User wants to SEE data, stats, streaks, or summaries       |
| log      | User wants to RECORD a numeric value for a metric          |
| reflect  | User shares feelings, moods, or journal-like statements    |
| suggest  | User asks for a RECOMMENDATION or new habit idea           |
| checkin  | User wants to RECORD a daily check-in (sleep, mood, energy, stress) |
| focus    | User wants to START a focus/pomodoro timer session         |
| help     | User asks for HELP, available commands, or what they can do|

## Available Entities
| Entity  | Description                                           |
|---------|-------------------------------------------------------|
| habit   | A trackable behavior (e.g., meditation, exercise)     |
| metric  | A measurable value (e.g., sleep quality, mood 1-10)   |
| journal | A reflective/journal entry                            |
| summary | An aggregated report across habits and metrics        |
| checkin | A daily wellbeing check-in (sleep, mood, energy, stress) |
| focus   | A focus/pomodoro timer session                          |

## Parse Rules
1. Extract EXACTLY ONE action and entity per transcript.
2. Default date is "today" if the user doesn't specify one.
3. IMPORTANT: When user specifies ANY date (e.g., "8th March 2026", "March 10", "26 march 2026", "January 5th", "march 15"), you MUST convert it to ISO format YYYY-MM-DD in the "date" param. If no year is given, assume 2026. NEVER default to "today" when a specific date is mentioned.
4. Day names (monday, tuesday, etc.) = the most recent past occurrence of that day.
4. Convert spoken numbers to numeric values ("eight" → 8, "seven out of ten" → 7).
5. If the user says "habits" (plural) treat it the same as "habit".
6. Strip filler words: "um", "uh", "like", "please", "can you", "could you", "I want to", "I'd like to".
7. "mark X done" / "I did X" / "completed X" / "finished X" = complete action.
8. "how am I doing" / "how's my X" / "what's my streak" = query action.
9. "I feel" / "I'm feeling" / "I slept" / emotional/reflective statements = reflect action.
10. "suggest" / "recommend" / "what should I" = suggest action.
11. "show" / "list" / "what are my" = query action.
12. "log X as Y" / "record X Y" / "my X was Y" = log action for metrics.
13. "rename X to Y" / "change X to Y" = update action with newName param.
14. "scale 1 to 10" / "from 1 to 10" = scale metric with \`scale: [1, 10]\`.
15. "help" / "what can I say" / "what can I do" / "what are the commands" = help action. This takes PRIORITY over suggest.
15. Return confidence 0.0–1.0:
    - 0.9+ = very clear intent
    - 0.7–0.89 = likely correct but slightly ambiguous
    - 0.5–0.69 = best guess
    - Below 0.5 = unclear, but still try
16. "check in" / "check-in" with sleep/mood/energy/stress values = checkin action. Extract numeric values for each dimension.
17. "start focus" / "begin focus" / "focus session" = focus action. Extract duration in minutes and optional habit name.
18. NEVER return "unknown" action. Always make your best guess from the available actions.
17. If the name is empty or cannot be determined for create/complete/delete, set confidence ≤ 0.3.
18. For multi-day completions ("past five days", "last three days"), use a "dates" array in params instead of a single "date". Each entry should be a relative phrase like "today", "1 days ago", "2 days ago", etc.
19. **STT GARBLING**: Transcripts may come from speech-to-text engines that add punctuation, reorder words, or capitalize randomly. You MUST reconstruct the user's original intent:
    - "Reading on me, Mark Done. For 03/05/2026." = user said "mark reading on me done for 5 march 2026" → complete habit "reading on me" for 2026-03-05
    - "Create a new habit. Painting." = user said "create a new habit painting" → create habit "painting"
    - "Mark Done. Meditation." = user said "mark meditation done" → complete habit "meditation"
    - Words like "Mark", "Done", "Log", "Delete" are COMMANDS, not names — even when capitalized
    - Dates like "03/05/2026" = March 5th 2026 (MM/DD/YYYY format)

## Response Format
Return ONLY a JSON object (no markdown, no code fences, no explanation):
{
  "corrected_transcript": "the cleaned-up version of what the user said",
  "action": "create|complete|delete|update|query|log|reflect|suggest|help",
  "entity": "habit|metric|journal|summary",
  "params": { ... },
  "confidence": 0.85
}

## Few-Shot Examples

### Tier 1 — Simple CRUD
User: "Create a habit called meditation"
{"action":"create","entity":"habit","params":{"name":"meditation"},"confidence":0.95}

User: "Add a metric called sleep quality"
{"action":"create","entity":"metric","params":{"name":"sleep quality","inputType":"binary"},"confidence":0.9}

User: "Mark meditation done for today"
{"action":"complete","entity":"habit","params":{"name":"meditation","date":"today"},"confidence":0.95}

User: "Delete the exercise habit"
{"action":"delete","entity":"habit","params":{"name":"exercise"},"confidence":0.9}

User: "Show my habits"
{"action":"query","entity":"habit","params":{},"confidence":0.9}

### Tier 2 — Parameterized
User: "Create a habit called exercise, three times a week"
{"action":"create","entity":"habit","params":{"name":"exercise","frequency":"3x/week"},"confidence":0.9}

User: "Add a metric for mood, scale 1 to 10, tracked daily"
{"action":"create","entity":"metric","params":{"name":"mood","inputType":"scale","scale":[1,10],"frequency":"daily"},"confidence":0.9}

User: "Log my sleep quality as 8 out of 10"
{"action":"log","entity":"metric","params":{"name":"sleep quality","value":8},"confidence":0.9}

User: "Mark reading done for Monday"
{"action":"complete","entity":"habit","params":{"name":"reading","date":"monday"},"confidence":0.9}

User: "Mark meditation done for 8th March 2026"
{"action":"complete","entity":"habit","params":{"name":"meditation","date":"2026-03-08"},"confidence":0.95}

User: "Mark painting done for 26 march 2026"
{"action":"complete","entity":"habit","params":{"name":"painting","date":"2026-03-26"},"confidence":0.95}

User: "Mark exercise done for march 15"
{"action":"complete","entity":"habit","params":{"name":"exercise","date":"2026-03-15"},"confidence":0.9}

User: "Log mood as 7 for March 10th"
{"action":"log","entity":"metric","params":{"name":"mood","value":7,"date":"2026-03-10"},"confidence":0.9}

User: "Mark meditation done for the past five days"
{"action":"complete","entity":"habit","params":{"name":"meditation","dates":["today","1 days ago","2 days ago","3 days ago","4 days ago"]},"confidence":0.9}

User: "I did exercise for the last three days"
{"action":"complete","entity":"habit","params":{"name":"exercise","dates":["today","1 days ago","2 days ago"]},"confidence":0.85}

User: "Rename my exercise habit to morning workout"
{"action":"update","entity":"habit","params":{"name":"exercise","newName":"morning workout"},"confidence":0.9}

### Tier 3 — Contextual / Analytical
User: "How am I doing with meditation this month?"
{"action":"query","entity":"habit","params":{"name":"meditation","period":"month"},"confidence":0.85}

User: "What's my longest streak?"
{"action":"query","entity":"habit","params":{"metric":"streak","sort":"longest"},"confidence":0.85}

User: "I slept terribly and I'm feeling stressed"
{"action":"reflect","entity":"journal","params":{"mood":"low","themes":["sleep","stress"]},"confidence":0.8}

User: "Suggest a new habit for me"
{"action":"suggest","entity":"habit","params":{},"confidence":0.9}

User: "Give me a weekly summary"
{"action":"query","entity":"summary","params":{"period":"week"},"confidence":0.9}

### Tier 4 — Check-in & Focus
User: "Check in sleep 4 mood 3 energy 5 stress 2"
{"corrected_transcript":"check in sleep 4 mood 3 energy 5 stress 2","action":"checkin","entity":"checkin","params":{"sleep":4,"mood":3,"energy":5,"stress":2},"confidence":0.9}

User: "Check-in mood 7 energy 6"
{"corrected_transcript":"check-in mood 7 energy 6","action":"checkin","entity":"checkin","params":{"sleep":null,"mood":7,"energy":6,"stress":null},"confidence":0.85}

User: "Start focus session for 25 minutes"
{"corrected_transcript":"start focus session for 25 minutes","action":"focus","entity":"focus","params":{"duration":25,"habit":null},"confidence":0.9}

User: "Start focus on meditation for 25 minutes"
{"corrected_transcript":"start focus on meditation for 25 minutes","action":"focus","entity":"focus","params":{"duration":25,"habit":"meditation"},"confidence":0.9}

User: "Begin focus session on reading for 15 minutes"
{"corrected_transcript":"begin focus session on reading for 15 minutes","action":"focus","entity":"focus","params":{"duration":15,"habit":"reading"},"confidence":0.9}

User: "Journal I had a productive morning"
{"corrected_transcript":"journal I had a productive morning","action":"reflect","entity":"journal","params":{"mood":"neutral","themes":[],"content":"I had a productive morning"},"confidence":0.8}

### Edge Cases
User: "um create new habits playing guitar"
{"action":"create","entity":"habit","params":{"name":"playing guitar"},"confidence":0.85}

User: "I did meditation"
{"action":"complete","entity":"habit","params":{"name":"meditation","date":"today"},"confidence":0.85}

User: "mark reading is done"
{"action":"complete","entity":"habit","params":{"name":"reading","date":"today"},"confidence":0.9}

User: "my mood was 7 today"
{"action":"log","entity":"metric","params":{"name":"mood","value":7,"date":"today"},"confidence":0.85}

User: "creat a habbit called yoga"
{"action":"create","entity":"habit","params":{"name":"yoga"},"confidence":0.8}

User: "what habits do I have"
{"action":"query","entity":"habit","params":{},"confidence":0.9}

### Help
User: "Help"
{"action":"help","entity":"summary","params":{},"confidence":0.95}

User: "What can I say?"
{"action":"help","entity":"summary","params":{},"confidence":0.95}

User: "What are the available commands?"
{"action":"help","entity":"summary","params":{},"confidence":0.95}

### STT-Garbled Transcripts (Cartesia / auto-punctuated)
User: "Reading on me, Mark Done. For 03/05/2026."
{"action":"complete","entity":"habit","params":{"name":"reading on me","date":"2026-03-05"},"confidence":0.85}

User: "Create a new habit. Painting."
{"action":"create","entity":"habit","params":{"name":"painting"},"confidence":0.85}

User: "Mark Done. Meditation."
{"action":"complete","entity":"habit","params":{"name":"meditation","date":"today"},"confidence":0.85}

User: "Log. My mood. At 8."
{"action":"log","entity":"metric","params":{"name":"mood","value":8,"date":"today"},"confidence":0.85}

User: "Exercise, Mark Done. For 03/17/2026."
{"action":"complete","entity":"habit","params":{"name":"exercise","date":"2026-03-17"},"confidence":0.85}

User: "Painting, Mark Done. For 03/26/2026."
{"action":"complete","entity":"habit","params":{"name":"painting","date":"2026-03-26"},"confidence":0.85}

### STT-Severely-Garbled (Cartesia Scribe hallucinations on short commands)
User: "Mark made a champagne toast"
{"corrected_transcript":"mark meditation done today","action":"complete","entity":"habit","params":{"name":"meditation","date":"today"},"confidence":0.7}

User: "Mark, what is on your mind today?"
{"corrected_transcript":"mark meditation done today","action":"complete","entity":"habit","params":{"name":"meditation","date":"today"},"confidence":0.65}

User: "Marguerite reading"
{"corrected_transcript":"mark reading done","action":"complete","entity":"habit","params":{"name":"reading","date":"today"},"confidence":0.7}

User: "Marquette, a song today"
{"corrected_transcript":"mark exercise done today","action":"complete","entity":"habit","params":{"name":"exercise","date":"today"},"confidence":0.6}

User: "Create a hobbit. Meditating."
{"corrected_transcript":"create a habit meditation","action":"create","entity":"habit","params":{"name":"meditation"},"confidence":0.8}

User: "Deli, the exercise."
{"corrected_transcript":"delete exercise","action":"delete","entity":"habit","params":{"name":"exercise"},"confidence":0.7}

User: "Lock my mood at seven."
{"corrected_transcript":"log my mood at 7","action":"log","entity":"metric","params":{"name":"mood","value":7,"date":"today"},"confidence":0.8}

User: "Marc done yoga."
{"corrected_transcript":"mark done yoga","action":"complete","entity":"habit","params":{"name":"yoga","date":"today"},"confidence":0.8}`;

/** Build a system prompt for onboarding steps. Returns JSON with step-specific parsing rules. */
function buildOnboardingPrompt(ctx: Record<string, unknown>): string {
  const step = typeof ctx.step === 'number' ? ctx.step : 0;
  const options = Array.isArray(ctx.options) ? ctx.options : [];
  const prompt = typeof ctx.prompt === 'string' ? ctx.prompt : '';

  const optionsStr = options.join(', ');

  return `You are an onboarding assistant helping users configure their life-tracking settings.

## Current Step: ${step}
## User Prompt: "${prompt}"
## Available Options: ${optionsStr}

Your job is to extract the user's choices from their spoken input and return a JSON object.

IMPORTANT: Always scrub any PII (names, emails, phone numbers, ages) that appear in the user's speech before processing. Replace names with [NAME], ages with [AGE], emails with [EMAIL], etc.

Return ONLY valid JSON in this format:
{
  "action": "onboarding_select",
  "params": {
    ... step-specific fields (see below) ...
  },
  "confidence": 0.0-1.0,
  "message": "Human-friendly response"
}

## Step-Specific Instructions:

### Step 1: Demographics
Parse: nickname, ageRange (from options), gender (Male/Female/Other)
Example: "I'm Alex, 25 to 34, male"
Output: {"nickname": "Alex", "ageRange": "25 - 34", "gender": "Male"}

### Step 2: Path Selection
Parse: "simple" or "braindump" (keep it simple vs brain dump)
Example: "I want to keep it simple"
Output: {"path": "simple"}

### Step 3: Category Selection
Parse: One category from options
Example: "I want to focus on sleep"
Output: {"category": "Sleep better"}

### Step 4: Goal Selection
Parse: Up to 2 goals from options
Example: "I want to fall asleep earlier and sleep more deeply"
Output: {"goals": ["Fall asleep earlier", "Sleep more deeply"]}

### Step 5: Habit Selection
Parse: Up to 2 habits from options
Example: "No screens after 10 PM and cool room temperature"
Output: {"habits": ["No screens after 10 PM", "Cool room temperature"]}

### Step 6: Reflection Schedule
Parse: time (HH:MM format) and schedule (Weekday/Weekend/Every day)
Example: "I want to reflect at 9 PM on weekdays"
Output: {"time": "21:00", "schedule": "Weekday"}

## Matching Strategy:
- Match user input against the available options using fuzzy matching
- If confidence is below 0.5, return success: false with a helpful error message
- Always return a message that acknowledges what was understood`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Always rate-limit by IP regardless of auth mode
  const ip = getClientIp(req.headers);
  const ipRl = checkRateLimit(ip, {
    windowMs: 60_000,
    maxRequests: 30,
    keyPrefix: 'process-command-ip',
  });
  if (ipRl.limited)
    return res.status(429).json({ error: 'Too many requests', retryAfter: ipRl.retryAfter });

  // Auth guard — skip only when server-side AUTH_BYPASS_MODE is explicitly set AND not in production
  const bypassAuth =
    process.env.AUTH_BYPASS_MODE === 'true' && process.env.NODE_ENV !== 'production';
  if (!bypassAuth) {
    const user = await requireUser(req, res);
    if (!user) return;
    await setUserContext(user.id);
    const rl = checkRateLimit(user.id, {
      windowMs: 60_000,
      maxRequests: 20,
      keyPrefix: 'process-command',
    });
    if (rl.limited) {
      return res
        .status(429)
        .json({ error: 'Too many requests. Try again later.', retryAfter: rl.retryAfter });
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const { transcript, existingHabits, onboarding_context } = req.body;
  if (!transcript || typeof transcript !== 'string') {
    return res.status(400).json({ error: 'Missing transcript' });
  }
  if (transcript.length > 2000) {
    return res.status(400).json({ error: 'Transcript too long (max 2000 chars)' });
  }

  // Check if this is an onboarding request
  const isOnboarding = !!(onboarding_context && typeof onboarding_context === 'object');
  const onboardingCtx = isOnboarding ? (onboarding_context as Record<string, unknown>) : null;

  // Sanitize existingHabits: limit count and per-item length to prevent prompt injection / cost abuse
  const sanitizedHabits: string[] = [];
  if (Array.isArray(existingHabits)) {
    for (const h of existingHabits.slice(0, 50)) {
      if (typeof h === 'string' && h.length <= 100) {
        sanitizedHabits.push(h.replace(/[^\w\s\-']/g, '').trim());
      }
    }
  }

  const habitContext =
    sanitizedHabits.length > 0
      ? `\n\n## User's Existing Habits\n${sanitizedHabits.join(', ')}\n\nOnly correct a habit name to an existing one when the spoken name is PHONETICALLY ALMOST IDENTICAL (e.g. "playing pedal" → "playing paddle"). If the user says a clearly different name (e.g. "playing laptop" vs "playing game"), treat it as a NEW habit — do NOT match to the existing one. When in doubt, use the name exactly as spoken.`
      : '';

  // For onboarding, build a custom system prompt and sanitize options
  const systemPrompt = isOnboarding
    ? buildOnboardingPrompt(onboardingCtx as Record<string, unknown>)
    : SYSTEM_PROMPT + habitContext;

  // Scrub PII from transcript before sending to OpenAI
  // EXCEPTION: onboarding Step 1 needs the user's real name, so skip scrubbing for onboarding
  const sanitizedTranscript = isOnboarding ? transcript : scrubPII(transcript);

  try {
    const startTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: sanitizedTranscript },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error:', response.status, errText);
      return res.status(502).json({ error: `OpenAI API error: ${response.status}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({ error: 'Empty response from GPT' });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('GPT returned invalid JSON:', content);
      return res.status(502).json({ error: 'GPT returned invalid JSON response' });
    }

    if (!parsed.action) {
      console.error('GPT response missing action:', parsed);
      return res.status(502).json({ error: 'GPT response missing required field (action)' });
    }

    // Different validation for onboarding vs home voice commands
    if (isOnboarding) {
      // Onboarding only allows "onboarding_select" action
      if (String(parsed.action) !== 'onboarding_select') {
        console.error('Invalid onboarding action:', parsed.action);
        return res.status(502).json({ error: 'Invalid onboarding action' });
      }
    } else {
      // Home voice commands need both action and entity
      if (!parsed.entity) {
        console.error('GPT response missing entity:', parsed);
        return res.status(502).json({ error: 'GPT response missing required field (entity)' });
      }

      // Allowlist validation — prevent prompt injection from returning unexpected actions
      const VALID_ACTIONS = new Set([
        'create',
        'complete',
        'delete',
        'update',
        'query',
        'log',
        'reflect',
        'suggest',
        'help',
        'checkin',
        'focus',
      ]);
      const VALID_ENTITIES = new Set(['habit', 'metric', 'journal', 'summary', 'checkin', 'focus']);
      if (!VALID_ACTIONS.has(String(parsed.action)) || !VALID_ENTITIES.has(String(parsed.entity))) {
        console.error('GPT returned invalid action/entity:', parsed.action, parsed.entity);
        return res.status(502).json({ error: 'Unexpected command type returned' });
      }
    }

    const latency = Date.now() - startTime;

    // ─── Post-processing: extract date from transcript if GPT missed it (home voice only) ───
    const params = (parsed.params || {}) as Record<string, unknown>;
    if (!isOnboarding) {
      const needsDate = ['complete', 'log'].includes(String(parsed.action));
      const gptDateIsToday = !params.date || params.date === 'today';

      if (needsDate && gptDateIsToday) {
        const extractedDate = extractDateFromTranscript(transcript);
        if (extractedDate) {
          params.date = extractedDate;
          parsed.params = params;
        }
      }
    }

    // Sanitize: only allow expected keys to prevent prototype pollution
    const safeParams = Object.create(null);
    if (parsed.params && typeof parsed.params === 'object') {
      for (const [k, v] of Object.entries(parsed.params as Record<string, unknown>)) {
        if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') {
          safeParams[k] = v;
        }
      }
    }
    const sanitized = {
      corrected_transcript:
        typeof parsed.corrected_transcript === 'string' ? parsed.corrected_transcript : transcript,
      action: parsed.action,
      entity: parsed.entity,
      params: safeParams,
      confidence: parsed.confidence,
    };

    return res.status(200).json({
      ...sanitized,
      latency,
      model: 'gpt-4o-mini',
    });
  } catch (err) {
    console.error('Process command error:', err);
    return res.status(500).json({
      error: 'An internal error occurred while processing the command.',
    });
  }
}
