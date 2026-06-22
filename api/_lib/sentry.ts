import * as Sentry from '@sentry/node';
import { dedupeIntegration } from '@sentry/node';
import { scrubPII } from './pii-scrubber.js';

const dsn = process.env.SENTRY_DSN;

// Skip init when no DSN — avoids cold-start overhead in dev/preview.
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? 'development',
    sendDefaultPii: false,
    // Errors-only: tracesSampleRate omitted (0 wouldn't disable tracing).
    defaultIntegrations: false,
    integrations: [dedupeIntegration()],
    skipOpenTelemetrySetup: true,
    // Driver errors can echo PII into message/stack — scrub the whole event.
    beforeSend(event) {
      if (event.message) event.message = scrubPII(event.message);
      for (const ex of event.exception?.values ?? []) {
        if (ex.value) ex.value = scrubPII(ex.value);
      }
      return event;
    },
  });
}

// Values redacted wholesale: structured PII the transcript scrubber can't
// catch ({"name":"Sarah"}, {"age":34}) + dense verbatim free-text (low debug
// value, high leak risk to a new vendor sink). Exact-match, case-sensitive.
const PII_KEYS = new Set([
  'name',
  'first_name',
  'nickname',
  'age',
  'age_group',
  'gender',
  'referral_source',
  'email',
  'phone',
  'dob',
  'birthdate',
  'brain_dump_raw',
  'text',
  'title',
]);

// Lower-fidelity codes — model misbehavior, high volume.
const SAMPLED_CODES = new Set(['unknown_tool', 'invalid_args']);
const SAMPLE_RATE = 0.1;

function redact(value: unknown, key?: string, seen: WeakSet<object> = new WeakSet()): unknown {
  if (key && PII_KEYS.has(key)) return '[REDACTED]';
  if (typeof value === 'string') return scrubPII(value);
  if (value && typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    if (Array.isArray(value)) return value.map((v) => redact(v, key, seen));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redact(v, k, seen);
    return out;
  }
  return value;
}

// Shared with the Vapi live-debug broadcaster — same PII rules, object form.
export function redactArgs(args: unknown): unknown {
  return redact(args);
}

function safeArgs(args: unknown): string {
  try {
    return JSON.stringify(redact(args)) ?? 'undefined';
  } catch {
    return '[unserializable]';
  }
}

interface ToolFailure {
  tool: string;
  anonId?: string | null;
  errorCode: string;
  args?: unknown;
  error?: unknown;
}

// Must never throw — instrumentation cannot break the tool loop.
export function reportToolFailure({ tool, anonId, errorCode, args, error }: ToolFailure): void {
  try {
    if (!dsn) return;
    if (SAMPLED_CODES.has(errorCode) && Math.random() > SAMPLE_RATE) return;

    const id = anonId && anonId !== 'missing' ? anonId : undefined;
    const ctx = {
      user: id ? { id } : undefined,
      tags: { tool, error_code: errorCode },
      fingerprint: [tool, errorCode],
      extra: { args: safeArgs(args) },
    };

    if (error !== undefined) {
      const err = error instanceof Error ? error : new Error(String(error));
      Sentry.captureException(err, ctx);
    } else {
      Sentry.captureMessage(`tool_failure: ${tool} (${errorCode})`, {
        level: 'warning',
        ...ctx,
      });
    }
  } catch {
    // swallow — reporting must not break the request
  }
}

// Request-level hard failure (not a tool call) — distinct tag + error level.
export function reportRequestFailure(
  scope: string,
  errorCode: string,
  anonId?: string | null,
): void {
  try {
    if (!dsn) return;
    const id = anonId && anonId !== 'missing' ? anonId : undefined;
    Sentry.captureMessage(`request_failure: ${scope} (${errorCode})`, {
      level: 'error',
      user: id ? { id } : undefined,
      tags: { scope, error_code: errorCode },
      fingerprint: [scope, errorCode],
    });
  } catch {
    // swallow — reporting must not break the request
  }
}

export function flushSentry(): Promise<boolean> {
  if (!dsn) return Promise.resolve(true);
  return Sentry.flush(2000).catch(() => false);
}
