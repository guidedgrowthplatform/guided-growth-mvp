import { create } from 'zustand';
import type { ActionResult } from '@/lib/services/data-service.interface';

interface CommandState {
  isProcessing: boolean;
  lastResult: ActionResult | null;
  lastIntent: { action: string; entity: string; params: Record<string, unknown>; confidence: number } | null;
  latency: number | null;
  error: string | null;
  history: Array<{
    transcript: string;
    intent: { action: string; entity: string };
    result: ActionResult;
    timestamp: number;
  }>;

  setProcessing: (v: boolean) => void;
  setResult: (result: ActionResult, intent: CommandState['lastIntent'], latency: number) => void;
  setError: (error: string) => void;
  clearResult: () => void;
  addHistory: (transcript: string, intent: { action: string; entity: string }, result: ActionResult) => void;
}

export const useCommandStore = create<CommandState>((set) => ({
  isProcessing: false,
  lastResult: null,
  lastIntent: null,
  latency: null,
  error: null,
  history: [],

  setProcessing: (v) => set({ isProcessing: v, error: null }),
  setResult: (result, intent, latency) => set({ lastResult: result, lastIntent: intent, latency, isProcessing: false }),
  setError: (error) => set({ error, isProcessing: false }),
  clearResult: () => set({ lastResult: null, lastIntent: null, latency: null, error: null }),
  addHistory: (transcript, intent, result) =>
    set((state) => ({
      history: [...state.history.slice(-19), { transcript, intent, result, timestamp: Date.now() }],
    })),
}));
