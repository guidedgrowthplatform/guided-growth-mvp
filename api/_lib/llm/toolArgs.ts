// Shared arg getters + ToolResult ctors for onboarding/checkin tools.
// tools.ts keeps its own — its getString returns null, not undefined.
import type { ToolResult } from './tools.js';

export function ok(result: Record<string, unknown>): ToolResult {
  return { ok: true, result };
}

export function invalid(message: string): ToolResult {
  return { ok: false, error: 'invalid_args', message };
}

export function notFound(message: string): ToolResult {
  return { ok: false, error: 'not_found', message };
}

export function handlerError(message: string): ToolResult {
  return { ok: false, error: 'handler_error', message };
}

export function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

export function getBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const v = args[key];
  return typeof v === 'boolean' ? v : undefined;
}

export function getNumber(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  // LLMs sometimes send numerics as strings.
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

export function getNumberArray(args: Record<string, unknown>, key: string): number[] | undefined {
  const v = args[key];
  if (!Array.isArray(v)) return undefined;
  const out: number[] = [];
  for (const item of v) {
    if (typeof item !== 'number' || !Number.isFinite(item)) return undefined;
    out.push(item);
  }
  return out;
}

export function getStringArray(args: Record<string, unknown>, key: string): string[] | undefined {
  const v = args[key];
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') return undefined;
    out.push(item);
  }
  return out;
}
