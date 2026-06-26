/**
 * Live skimmer: per-beat optimistic extraction from in-progress user speech.
 *
 * As the user speaks, this reads the interim/partial transcript and tries to
 * recognize what the ACTIVE beat is collecting, so the card can ghost-fill
 * before the LLM tool round-trip lands (a habit chip pre-selects, the age fills
 * in, with a slight lag behind the voice). The authoritative tool result still
 * runs and reconciles: committed answers win, the ghost clears.
 *
 * Design rules:
 *  1. Pure and synchronous. No network, no store. Easy to unit test and cheap to
 *     run on every partial.
 *  2. Keyed on componentType, the stable builder/engine contract (see
 *     flow-builder-export-spec.md). It mirrors serverCaptureForBeat's per-type
 *     answer mapping in useFlowOrchestrator, so a ghost has the same shape a real
 *     capture would.
 *  3. Conservative. Only emit what is clearly said. A wrong ghost flickers, so
 *     when in doubt, emit nothing and let the real tool fill it.
 *  4. Vocabulary-anchored where the beat has a fixed option set (category, goals,
 *     habit suggestions). The caller passes the candidate options; the matcher
 *     stays pure and testable without importing the data layer.
 *
 * This is the regex-first cut. A fast model per sentence can replace or refine
 * the matcher later without changing the orchestrator seam it writes into.
 */
import type { OnboardingPath, OnboardingStepData } from '@gg/shared/types';
import type { FlowComponentType } from './types';

/** One selectable option with optional extra match terms. */
export interface SkimOption {
  /** The value written into answers (e.g. the category value). */
  value: string;
  /** The human label shown on the card. */
  label: string;
  /** Extra phrases that should also match this option. */
  synonyms?: readonly string[];
}

/** A habit candidate the active beat can offer. */
export interface SkimHabit {
  name: string;
  synonyms?: readonly string[];
}

/** Candidate option sets for the active beat, resolved by the caller from componentProps. */
export interface SkimVocab {
  categories?: readonly SkimOption[];
  goals?: readonly SkimOption[];
  habits?: readonly SkimHabit[];
}

/**
 * What the skimmer recognized this pass. `data` mirrors OnboardingStepData keys
 * (so it merges into the ghost layer exactly like a real capture's data).
 * `habitNames` is surfaced separately because the habit beat's answer key is a
 * Record of configs; the orchestrator maps recognized names into minimal ghost
 * configs (it owns the default-config shape).
 */
export interface SkimResult {
  data: Partial<OnboardingStepData>;
  path?: OnboardingPath;
  habitNames?: string[];
}

const AGE_MIN = 13;
const AGE_MAX = 120;
const MAX_GOALS = 2;

/** Lowercase + collapse whitespace, for word-boundary matching. */
function norm(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** True if `needle` appears in `haystack` on word boundaries (not mid-word). */
function hasPhrase(haystack: string, needle: string): boolean {
  const n = norm(needle);
  if (!n) return false;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

/** Match an option by its label or any synonym. */
function optionMatches(text: string, opt: SkimOption | SkimHabit): boolean {
  const label = 'label' in opt ? opt.label : opt.name;
  if (hasPhrase(text, label)) return true;
  return (opt.synonyms ?? []).some((s) => hasPhrase(text, s));
}

/**
 * First plausible human age in the text, or null. Only called on the profile
 * beat (where an age is what's being collected), so after the explicit forms
 * ("I'm 34", "34 years old") it also accepts a bare number in human range
 * ("63 male", "twenty eight" not handled). Numbers below AGE_MIN (a time like
 * "at 6", "3 times") are ignored.
 */
function extractAge(text: string): number | null {
  const explicit = text.match(/\b(?:i'?m|im|age|aged)\s+(\d{1,3})\b/);
  const yearsOld = text.match(/\b(\d{1,3})\s*(?:years?\s*old|y\/?o)\b/);
  let candidate = explicit?.[1] ?? yearsOld?.[1];
  if (candidate == null) {
    // Bare number fallback: first integer in human-age range wins.
    for (const m of text.matchAll(/\b(\d{1,3})\b/g)) {
      const n = Number(m[1]);
      if (n >= AGE_MIN && n <= AGE_MAX) {
        candidate = m[1];
        break;
      }
    }
  }
  if (candidate != null) {
    const n = Number(candidate);
    if (n >= AGE_MIN && n <= AGE_MAX) return n;
  }
  return null;
}

/** Canonical gender from common phrasings, or null. Output matches card options. */
function extractGender(text: string): string | null {
  if (/\b(non[-\s]?binary|enby|nonbinary)\b/.test(text)) return 'Other';
  if (/\b(female|woman|girl|she\/her|i'?m a girl)\b/.test(text)) return 'Female';
  if (/\b(male|man|guy|boy|he\/him|i'?m a guy)\b/.test(text)) return 'Male';
  return null;
}

/** simple vs braindump from how the user wants to work, or undefined. */
function extractPath(text: string): OnboardingPath | undefined {
  if (/\b(brain ?dump|already track|i track|let me (just )?tell you everything|dump everything|experienced)\b/.test(text)) {
    return 'braindump';
  }
  if (/\b(step by step|guide me|walk me|i'?m new|new to this|beginner|take it slow)\b/.test(text)) {
    return 'simple';
  }
  return undefined;
}

/**
 * Recognize habit phrases. Anchors on the beat's offered habits first (high
 * confidence), then a conservative free-form pass for clear intent phrasings.
 */
function extractHabits(text: string, habits?: readonly SkimHabit[]): string[] {
  const found: string[] = [];
  const seen = new Set<string>(); // lowercased, for case-insensitive dedup
  const add = (name: string) => {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      found.push(name);
    }
  };

  // Offered habits first (high confidence, canonical display name).
  for (const h of habits ?? []) {
    if (optionMatches(text, h)) add(h.name);
  }

  // Free-form: "i want to <X>", "start <X>ing", "i'd like to <X>". Conservative:
  // only a short trailing phrase, only after a clear intent lead-in, and only if
  // it is not already covered by an offered habit (whose canonical name we kept).
  const intent = text.match(
    /\b(?:i want to|i'?d like to|i wanna|gonna|going to|start|begin)\s+([a-z][a-z\s]{2,28}?)(?=\s+(?:and|every|each|daily|on|at|in the|because|so)\b|[.,!?]|$)/g,
  );
  if (intent) {
    for (const m of intent) {
      const phrase = m
        .replace(/\b(?:i want to|i'?d like to|i wanna|gonna|going to|start|begin)\s+/, '')
        .trim();
      if (phrase.length < 3 || phrase.length > 28) continue;
      // Already represented by an offered habit (the vocab pass added its
      // canonical name), so skip the raw phrase to avoid a duplicate ghost.
      if ((habits ?? []).some((h) => optionMatches(phrase, h))) continue;
      add(phrase);
    }
  }
  return found;
}

/**
 * Extract a ghost capture for the active beat from a transcript. Returns null
 * when nothing is confidently recognized (the common case mid-sentence).
 */
export function extractGhostCapture(
  componentType: FlowComponentType,
  transcript: string,
  vocab?: SkimVocab,
): SkimResult | null {
  const text = norm(transcript);
  if (!text) return null;

  switch (componentType) {
    case 'profile-input': {
      const data: Partial<OnboardingStepData> = {};
      const age = extractAge(text);
      const gender = extractGender(text);
      if (age != null) data.age = age;
      if (gender != null) data.gender = gender;
      return Object.keys(data).length > 0 ? { data } : null;
    }

    case 'path-selection': {
      const path = extractPath(text);
      return path ? { data: {}, path } : null;
    }

    case 'category-grid': {
      // Single select: the first option that matches wins.
      const match = vocab?.categories?.find((c) => optionMatches(text, c));
      return match ? { data: { category: match.value } } : null;
    }

    case 'goals-list': {
      const matched = (vocab?.goals ?? [])
        .filter((g) => optionMatches(text, g))
        .slice(0, MAX_GOALS)
        .map((g) => g.value);
      return matched.length > 0 ? { data: { goals: matched } } : null;
    }

    case 'habit-picker': {
      const habitNames = extractHabits(text, vocab?.habits);
      return habitNames.length > 0 ? { data: {}, habitNames } : null;
    }

    // reflection-card, auth, mic-permission, primary-button, plan-cards,
    // coach-bubble: nothing to ghost-fill from speech in this cut.
    default:
      return null;
  }
}
