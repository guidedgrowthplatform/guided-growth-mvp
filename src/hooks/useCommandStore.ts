import { create } from 'zustand';
import type { CommandResult } from '../utils/commandTypes';

interface CommandState {
    /** Whether a command is being processed */
    isProcessing: boolean;
    /** Latest command result */
    lastResult: CommandResult | null;
    /** Processing latency in ms */
    latencyMs: number;
    /** Error message */
    error: string;
    /** History of processed commands */
    history: Array<{ transcript: string; result: CommandResult; latencyMs: number; timestamp: number }>;

    // Actions
    setProcessing: (val: boolean) => void;
    setResult: (result: CommandResult, latencyMs: number, transcript: string) => void;
    setError: (error: string) => void;
    clearResult: () => void;
    clearHistory: () => void;
}

export const useCommandStore = create<CommandState>((set) => ({
    isProcessing: false,
    lastResult: null,
    latencyMs: 0,
    error: '',
    history: [],

    setProcessing: (isProcessing) => set({ isProcessing }),
    setResult: (result, latencyMs, transcript) =>
        set((state) => ({
            lastResult: result,
            latencyMs,
            isProcessing: false,
            error: '',
            history: [
                { transcript, result, latencyMs, timestamp: Date.now() },
                ...state.history,
            ].slice(0, 50), // Keep last 50 commands
        })),
    setError: (error) => set({ error, isProcessing: false }),
    clearResult: () => set({ lastResult: null, latencyMs: 0, error: '' }),
    clearHistory: () => set({ history: [] }),
}));
