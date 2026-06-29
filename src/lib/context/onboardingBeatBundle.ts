import bundle from '@/generated/beat_contexts.json';

// Frontend reader + composer for the synced onboarding beat context. The bundle
// (scripts/build-beat-bundle.ts) carries the coach copy + opener (Supabase-synced)
// and the code-owned allowedTools + step. Vapi gates tools by prose (no structural
// per-beat filtering), so the context block it receives must still carry the
// machinery — ALLOWED/FORBIDDEN tools + navigate_next(target_step). We GENERATE
// that machinery from the engine step model here, so it stays engine-consistent,
// and prepend it to the clean synced coach copy. Replaces the hand-authored
// screen_contexts machinery for ONBOARD-* screens.

interface BundleBeat {
  context: string;
  opener?: string;
  allowedTools: string[];
  step: number | null;
  // navigate_next target — the flow-builder step Vapi must reach to advance past
  // this beat (skips same-step nodes, so the habit beats target plan-review).
  targetStep: number | null;
}

const BEATS = bundle.beats as Record<string, BundleBeat>;
const ALL_TOOLS = bundle.allTools as string[];
export const BEAT_BUNDLE_VERSION = bundle.bundleVersion as number;

// The engine nav tool advance_step maps to Vapi's navigate_next(target_step).
const NAV_BEAT_TOOL = 'advance_step';
const NAV_VAPI_TOOL = 'navigate_next';

export function isBundledBeat(screenId: string): boolean {
  return screenId in BEATS;
}

export function getBundledBeat(screenId: string): BundleBeat | undefined {
  return BEATS[screenId];
}

export function getBeatOpener(screenId: string): string | null {
  return BEATS[screenId]?.opener ?? null;
}

// The verbatim-opener directive prepended to a WARM-beat context push so Vapi
// opens the beat with the authored line word-for-word (rigid, not improvised)
// instead of generating its own greeting. Null when the beat has no opener.
// NOT used on the cold-start beat — Cartesia speaks that opener instantly.
export function buildOpenerDirective(screenId: string): string | null {
  const opener = BEATS[screenId]?.opener;
  if (!opener) return null;
  return `OPENER — your first line on this beat: say it verbatim, word for word, then continue naturally. Do not paraphrase it.\n"${opener}"`;
}

// The code-generated Vapi machinery block for a beat: which tools are allowed
// (data tools + navigate_next with the engine's target_step), and which are
// forbidden. Empty string for a beat that has no tools at all.
export function buildBeatMachinery(screenId: string): string {
  const beat = BEATS[screenId];
  if (!beat) return '';

  const allowed = beat.allowedTools;
  const hasNav = allowed.includes(NAV_BEAT_TOOL);
  const allowedData = allowed.filter((t) => t !== NAV_BEAT_TOOL);

  const forbidden = ALL_TOOLS.filter((t) => t !== NAV_BEAT_TOOL && !allowed.includes(t));
  if (!hasNav) forbidden.push(NAV_VAPI_TOOL);

  const allowedLines = [...allowedData];
  if (hasNav && beat.targetStep != null) {
    allowedLines.push(
      `${NAV_VAPI_TOOL}(target_step=${beat.targetStep})  // AUTO-CALL immediately after the data tool returns; do not ask "ready?" first`,
    );
  }

  const parts: string[] = [];
  if (allowedLines.length) {
    parts.push(
      'ALLOWED TOOLS ON THIS SCREEN — call only these, do NOT call any other tool:',
      ...allowedLines.map((t) => `- ${t}`),
    );
  } else {
    parts.push('NO TOOLS ON THIS SCREEN — do not call any tool; the screen advances on its own.');
  }
  if (forbidden.length) {
    parts.push('', `FORBIDDEN ON THIS SCREEN: ${forbidden.join(', ')}.`);
  }
  return parts.join('\n');
}

// The full context block Vapi receives for an onboarding beat: generated
// machinery, then the clean synced coach copy. Returns null for non-onboarding
// screens (caller falls back to the screen_contexts bundle).
export function composeOnboardingContextBlock(screenId: string): string | null {
  const beat = BEATS[screenId];
  if (!beat) return null;
  const machinery = buildBeatMachinery(screenId);
  return machinery ? `${machinery}\n\n${beat.context}` : beat.context;
}
