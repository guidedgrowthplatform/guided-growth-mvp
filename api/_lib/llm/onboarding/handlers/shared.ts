import type { ToolResult } from '../../tools.js';

export type OnboardingHandlerCtx = { anon_id: string; screen_id?: string };

export function invalid(message: string): ToolResult {
  return { ok: false, error: 'invalid_args', message };
}

export function handlerError(message: string): ToolResult {
  return { ok: false, error: 'handler_error', message };
}

export function ok(result: Record<string, unknown>): ToolResult {
  return { ok: true, result };
}

export function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

export function getBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const v = args[key];
  return typeof v === 'boolean' ? v : undefined;
}

export function getNumberArray(
  args: Record<string, unknown>,
  key: string,
): number[] | undefined {
  const v = args[key];
  if (!Array.isArray(v)) return undefined;
  const out: number[] = [];
  for (const item of v) {
    if (typeof item !== 'number' || !Number.isFinite(item)) return undefined;
    out.push(item);
  }
  return out;
}

export function getStringArray(
  args: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const v = args[key];
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') return undefined;
    out.push(item);
  }
  return out;
}

export const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;
// Unicode letters/marks + digits + spaces and common name punctuation.
export const NICKNAME_REGEX = /^[\p{L}\p{M}0-9 '\-_.]*$/u;
