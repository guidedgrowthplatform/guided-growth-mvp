/**
 * useLiveSkimmer — drives optimistic ghost-fill from in-progress user speech.
 *
 * Mounted for the ACTIVE beat only (BeatView). It listens to the user's interim
 * transcript, resolves the candidate options THIS beat collects (from flowData,
 * scoped by what is already answered), runs the pure extractor, and publishes the
 * recognized fills to the ghost bus. The active beat's adapter pre-fills its card
 * from those, with a slight lag behind the voice. The real LLM tool result still
 * arrives on the normal voice-action bus and is what commits + advances.
 *
 * Active-beat gating is automatic: this hook is only mounted while the beat is
 * active (see BeatView), so it never ghost-fills a non-active beat even when the
 * in-feed fork keeps other beats in the scroll.
 */
import { useCallback, useRef } from 'react';
import type { OnboardingVoiceResult } from '@/contexts/useOnboardingVoiceSession';
import { useOnboardingTranscripts } from '@/contexts/useOnboardingVoiceSession';
import type { RealtimeTranscriptEvent } from '@/hooks/useRealtimeVoice';
import { FLOW_CATEGORIES, goalsByCategory, habitsByGoal } from './flowData';
import { publishGhostFill } from './ghostFillBus';
import { extractGhostCapture, type SkimHabit, type SkimVocab } from './liveSkimmer';
import type { FlowAnswers, FlowNode } from './types';

const STOPWORDS = new Set([
  'after',
  'before',
  'target',
  'their',
  'your',
  'every',
  'daily',
  'morning',
  'evening',
  'night',
  'time',
  'bedtime',
  'minutes',
  'minute',
]);

/** Light keyword synonyms for a long habit label, so "cut caffeine" matches
 *  "No caffeine after 2 PM". Significant words only (length >= 4, not stopwords). */
function habitSynonyms(label: string): string[] {
  return label
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

/** The option set the active beat collects, scoped by what is already answered. */
function buildVocab(componentType: FlowNode['componentType'], answers: FlowAnswers): SkimVocab {
  switch (componentType) {
    case 'category-grid':
      return { categories: FLOW_CATEGORIES.map((c) => ({ value: c.label, label: c.label })) };
    case 'goals-list': {
      const category = (answers.category as string) ?? 'Sleep better';
      const goals = goalsByCategory[category] ?? goalsByCategory['Sleep better'] ?? [];
      return { goals: goals.map((g) => ({ value: g, label: g })) };
    }
    case 'habit-picker': {
      const goals = (answers.goals as string[] | undefined)?.length
        ? (answers.goals as string[])
        : [];
      const habits: SkimHabit[] = goals
        .flatMap((g) => habitsByGoal[g] ?? [])
        .map((name) => ({ name, synonyms: habitSynonyms(name) }));
      return { habits };
    }
    default:
      return {};
  }
}

function ghostResult(action: string, params: Record<string, unknown>): OnboardingVoiceResult {
  return { success: true, action, params, message: 'ghost', confidence: 0.5 };
}

export function useLiveSkimmer(node: FlowNode | null, answers: FlowAnswers): void {
  // De-dupe published fills so a growing partial does not re-emit the same value.
  // Reset whenever the active beat changes (a new beat = a fresh slate).
  const seenRef = useRef<Set<string>>(new Set());
  const lastNodeRef = useRef<string | null>(null);

  const handleTranscript = useCallback(
    (evt: RealtimeTranscriptEvent) => {
      if (!node) return;
      if (evt.role !== 'user') return;
      const text = evt.text?.trim();
      if (!text) return;

      if (lastNodeRef.current !== node.id) {
        lastNodeRef.current = node.id;
        seenRef.current = new Set();
      }

      const result = extractGhostCapture(node.componentType, text, buildVocab(node.componentType, answers));
      if (!result) return;

      const emit = (sig: string, action: string, params: Record<string, unknown>) => {
        if (seenRef.current.has(sig)) return;
        seenRef.current.add(sig);
        publishGhostFill(ghostResult(action, params));
      };

      if (result.data.age != null) {
        emit(`age:${result.data.age}`, 'fill_field', { fieldName: 'age', value: result.data.age });
      }
      if (result.data.gender != null) {
        emit(`gender:${result.data.gender}`, 'select_option', {
          fieldName: 'gender',
          value: result.data.gender,
        });
      }
      if (result.path) {
        emit(`path:${result.path}`, 'set_path', { value: result.path });
      }
      if (result.data.category != null) {
        emit(`category:${result.data.category}`, 'select_option', {
          fieldName: 'category',
          value: result.data.category,
        });
      }
      if (result.data.goals?.length) {
        emit(`goals:${result.data.goals.join(',')}`, 'select_multiple', {
          fieldName: 'goals',
          values: result.data.goals,
        });
      }
      if (result.habitNames?.length) {
        for (const name of result.habitNames) {
          emit(`habit:${name}`, 'add_habit', { name });
        }
      }
    },
    [node, answers],
  );

  // Only listen while a beat is active (node present).
  useOnboardingTranscripts(handleTranscript, node != null);
}
