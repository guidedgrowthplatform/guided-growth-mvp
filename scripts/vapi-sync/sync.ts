/**
 * Vapi tool registrar — idempotent.
 *
 * Reads ONBOARDING_TOOLS from api/_lib/llm/tools.onboarding.ts, wraps each in
 * Vapi's envelope, then for each tool: skip if hash unchanged, PATCH if
 * mutated, POST only if it exists in neither the lockfile nor live Vapi
 * (matched by name — so a stale/empty lockfile adopts existing tools instead
 * of duplicating them). Finally PATCHes the configured assistant to attach
 * the union of (existing-on-assistant) ∪ (our-managed) tool IDs.
 *
 * Lockfile (vapi.lock.json) holds {tools: {name → {id, hash}}, assistant: {…}}
 * so subsequent runs can diff against last-known state. Only written on full
 * success; partial failures abort before write.
 *
 * Usage:
 *   VAPI_PRIVATE_KEY=… \
 *   VAPI_WEBHOOK_SECRET=… \
 *   VAPI_WEBHOOK_BASE_URL=https://guided-growth-mvp.vercel.app \
 *   VITE_VAPI_ASSISTANT_ID=… \
 *   npm run vapi:sync
 *
 * Env vars are validated at start; missing values throw before any API call.
 *
 * The Weekly (a SEPARATE, dedicated Vapi assistant — see
 * gg-spec/docs/the-weekly.md) syncs its own tools.weekly.ts +
 * WEEKLY_GLOBAL_CONTEXT the same way, gated behind one extra optional env var:
 *
 *   VAPI_WEEKLY_ASSISTANT_ID=… \
 *   npm run vapi:sync
 *
 * Absent → the weekly sync step is skipped entirely (logged, not silent) and
 * the onboarding sync above runs completely unchanged.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { ONBOARDING_TOOLS } from '../../api/_lib/llm/tools.onboarding.js';
import { WEEKLY_TOOLS } from '../../api/_lib/llm/tools.weekly.js';
import { WEEKLY_GLOBAL_CONTEXT } from '../../api/_lib/weekly/globalContext.js';
import {
  BLOCK_START,
  BLOCK_END,
  SYSTEM_PROMPT_ADDENDUM,
  WEEKLY_BLOCK_START,
  WEEKLY_BLOCK_END,
} from './assistant.js';
import { wrapTool, type VapiToolEnvelope, type WrappableTool } from './wrap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IS_DEV = process.argv.includes('--dev');
// --staging: separate Vapi org + lockfile; same tunnel guard as prod
const IS_STAGING = process.argv.includes('--staging');
const IS_DRY = process.argv.includes('--dry-run');
const LOCKFILE = resolve(
  __dirname,
  IS_DEV ? 'vapi.lock.dev.json' : IS_STAGING ? 'vapi.lock.staging.json' : 'vapi.lock.json',
);
const VAPI_BASE = 'https://api.vapi.ai';

// Safety: never let a tunnel/localhost URL get baked into the prod lockfile.
// Prod sync against ngrok would silently point the live tool at a developer's
// laptop, and the moment ngrok dies, prod tools 404. Hard abort.
const TUNNEL_HOSTS = /ngrok|localhost|127\.0\.0\.1|0\.0\.0\.0/i;

interface LockToolEntry {
  id: string;
  hash: string;
  updatedAt: string;
}
interface LockAssistantEntry {
  id: string | null;
  hash: string | null;
  updatedAt?: string;
}
interface Lockfile {
  tools: Record<string, LockToolEntry>;
  assistant: LockAssistantEntry;
  // The Weekly's own tool + assistant tracking, separate from onboarding's
  // above. Optional — absent entirely when VAPI_WEEKLY_ASSISTANT_ID has never
  // been synced from this lockfile, so existing lockfiles stay valid as-is.
  weeklyTools?: Record<string, LockToolEntry>;
  weeklyAssistant?: LockAssistantEntry;
}

function hash(x: unknown): string {
  return createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(
      `Missing required env var: ${name}. ` +
        `Run with: ${name}=… npm run vapi:sync (or source .env.local first).`,
    );
  }
  return v.trim();
}

function loadLock(): Lockfile {
  try {
    const raw = readFileSync(LOCKFILE, 'utf8');
    const parsed = JSON.parse(raw) as Lockfile;
    if (!parsed.tools) parsed.tools = {};
    if (!parsed.assistant) parsed.assistant = { id: null, hash: null };
    // weeklyTools/weeklyAssistant stay undefined until the first weekly sync
    // touches this lockfile — populated lazily in syncOneAssistant(), not here.
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // First dev run — there's no committed dev lockfile. Start fresh.
      return { tools: {}, assistant: { id: null, hash: null } };
    }
    throw err;
  }
}

function saveLock(lock: Lockfile): void {
  writeFileSync(LOCKFILE, JSON.stringify(lock, null, 2) + '\n', 'utf8');
}

async function vapiFetch<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  apiKey: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${VAPI_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Vapi ${method} ${path} failed: ${res.status} ${res.statusText}\n${text}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

// PATCH /tool/{id}: some Vapi endpoints reject `type` on PATCH. Try with first,
// retry without on 400.
async function patchTool(id: string, envelope: VapiToolEnvelope, apiKey: string): Promise<void> {
  try {
    await vapiFetch('PATCH', `/tool/${id}`, apiKey, envelope);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes(' 400 ')) throw err;
    // Strip `type` and retry.
    const { type: _type, ...rest } = envelope;
    await vapiFetch('PATCH', `/tool/${id}`, apiKey, rest);
  }
}

interface VapiAssistantMessage {
  role?: string;
  content?: string;
  [k: string]: unknown;
}
interface VapiAssistant {
  id: string;
  model?: {
    toolIds?: string[] | null;
    messages?: VapiAssistantMessage[] | null;
    [k: string]: unknown;
  } | null;
  [k: string]: unknown;
}

/**
 * Apply a managed, sentinel-bracketed block to a system-prompt string.
 * - If sentinel markers exist → replace content between them.
 * - If neither marker exists → append a fresh block.
 * - If only one marker exists → corruption; leave the prompt alone and warn.
 * Idempotent. Shared by both the onboarding tool-calling addendum and The
 * Weekly's base system prompt — same mechanism, different markers/content.
 */
function applyManagedBlock(
  content: string,
  blockStart: string,
  blockEnd: string,
  managedContent: string,
): string {
  const startIdx = content.indexOf(blockStart);
  const endIdx = content.indexOf(blockEnd);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx + blockEnd.length);
    return `${before}${managedContent}${after}`;
  }
  if (startIdx === -1 && endIdx === -1) {
    return `${content.trimEnd()}\n\n${managedContent}\n`;
  }
  console.warn(
    '[warn] system prompt has only one sentinel marker — managed block not applied. Fix manually in the Vapi dashboard or delete the orphan marker.',
  );
  return content;
}

function applyAddendum(content: string): string {
  return applyManagedBlock(content, BLOCK_START, BLOCK_END, SYSTEM_PROMPT_ADDENDUM);
}

// The Weekly's managed block wraps WEEKLY_GLOBAL_CONTEXT itself (the coach's
// full base prompt for this assistant), not just a tool-calling addendum —
// see assistant.ts's WEEKLY_BLOCK_START/END doc comment.
function applyWeeklyContext(content: string): string {
  return applyManagedBlock(content, WEEKLY_BLOCK_START, WEEKLY_BLOCK_END, WEEKLY_GLOBAL_CONTEXT);
}

interface VapiToolCreated {
  id: string;
  [k: string]: unknown;
}

interface VapiToolListItem {
  id: string;
  function?: { name?: string; description?: string; parameters?: unknown };
  server?: { url?: string };
  async?: boolean;
}

// Live tools indexed by function-name. Lets the loop adopt tools made by a
// prior run or by hand (so an empty/stale lockfile never duplicates them), and
// backs the --dry-run field diff.
async function fetchRemoteToolsByName(apiKey: string): Promise<Map<string, VapiToolListItem[]>> {
  const tools = await vapiFetch<VapiToolListItem[]>('GET', '/tool?limit=1000', apiKey);
  const byName = new Map<string, VapiToolListItem[]>();
  for (const t of Array.isArray(tools) ? tools : []) {
    const name = t.function?.name;
    if (!name || !t.id) continue;
    byName.set(name, [...(byName.get(name) ?? []), t]);
  }
  return byName;
}

// Fields a PATCH would overwrite on an existing tool (secret excluded — GET
// never returns it; it always rotates here).
function diffEnvelope(live: VapiToolListItem | undefined, env: VapiToolEnvelope): string[] {
  if (!live) return [];
  const changed: string[] = [];
  if ((live.function?.description ?? '') !== env.function.description) changed.push('description');
  if (JSON.stringify(live.function?.parameters ?? null) !== JSON.stringify(env.function.parameters))
    changed.push('parameters');
  if ((live.server?.url ?? '') !== env.server.url) changed.push('server.url');
  if ((live.async ?? false) !== (env.async ?? false)) changed.push('async');
  return changed;
}

function dedupe(ids: ReadonlyArray<string>): string[] {
  return Array.from(new Set(ids));
}

function arraysEqualAsSets(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  for (const x of a) if (!setB.has(x)) return false;
  return true;
}

interface SyncOneAssistantArgs {
  /** Log label, e.g. "onboarding" or "The Weekly". */
  label: string;
  tools: readonly WrappableTool[];
  assistantId: string;
  apiKey: string;
  baseUrl: string;
  secret: string;
  remoteByName: Map<string, VapiToolListItem[]>;
  lockTools: Record<string, LockToolEntry>;
  /** Applies this assistant's managed block (tool-calling addendum, or The
   * Weekly's base system prompt) to the assistant's current first system
   * message content. */
  applyManaged: (content: string) => string;
}

/**
 * Syncs one assistant's tool set + managed system-prompt block. Shared by
 * both the onboarding assistant (always synced) and The Weekly's dedicated
 * assistant (synced only when VAPI_WEEKLY_ASSISTANT_ID is set — see main()).
 * Extracted, not rewritten: this is the same logic that used to live inline
 * in main() for onboarding, now parameterized so a second assistant can run
 * through it without duplicating the tool-diff/attach/addendum flow.
 */
async function syncOneAssistant(args: SyncOneAssistantArgs): Promise<void> {
  const {
    label,
    tools,
    assistantId,
    apiKey,
    baseUrl,
    secret,
    remoteByName,
    lockTools,
    applyManaged,
  } = args;

  console.log(`\nSyncing ${tools.length} ${label} tool(s) to Vapi… (assistant ${assistantId})`);

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const tool of tools) {
    const envelope = wrapTool(tool, baseUrl, secret);
    const h = hash(envelope);
    const prev = lockTools[tool.name];

    if (prev?.hash === h) {
      console.log(`  ✓ unchanged  ${tool.name}  (${prev.id})`);
      unchangedCount++;
      continue;
    }

    // Existing tool: lockfile first, else adopt by name from live Vapi.
    const liveMatches = remoteByName.get(tool.name) ?? [];
    if (!prev && liveMatches.length > 1) {
      throw new Error(
        `Vapi already has ${liveMatches.length} tools named "${tool.name}" ` +
          `(${liveMatches.map((t) => t.id).join(', ')}). ` +
          `Resolve the duplicates in the Vapi dashboard before syncing.`,
      );
    }
    const liveItem = liveMatches[0];
    const existingId = prev?.id ?? liveItem?.id;

    if (IS_DRY) {
      if (existingId) {
        const changed = diffEnvelope(liveItem, envelope);
        const detail = changed.length
          ? `def changes: ${changed.join(', ')} (+secret)`
          : 'secret only';
        console.log(`  ↻ would update  ${tool.name}  (${existingId})  — ${detail}`);
        updatedCount++;
      } else {
        console.log(`  + would create  ${tool.name}`);
        createdCount++;
      }
      continue;
    }

    if (existingId) {
      await patchTool(existingId, envelope, apiKey);
      console.log(`  ↻ updated    ${tool.name}  (${existingId})`);
      lockTools[tool.name] = {
        id: existingId,
        hash: h,
        updatedAt: new Date().toISOString(),
      };
      updatedCount++;
    } else {
      const created = await vapiFetch<VapiToolCreated>('POST', '/tool', apiKey, envelope);
      if (!created?.id) {
        throw new Error(
          `Vapi POST /tool returned no id for ${tool.name}: ${JSON.stringify(created)}`,
        );
      }
      console.log(`  + created    ${tool.name}  (${created.id})`);
      lockTools[tool.name] = {
        id: created.id,
        hash: h,
        updatedAt: new Date().toISOString(),
      };
      createdCount++;
    }
  }

  if (IS_DRY) {
    console.log(
      `  [dry-run] ${label}: no changes written. Would: ${createdCount} create, ${updatedCount} update.`,
    );
    return;
  }

  // Attach to assistant — UNION semantics so we never strip IDs the user
  // configured manually in Vapi's dashboard.
  console.log(`  Fetching assistant ${assistantId}…`);
  const assistant = await vapiFetch<VapiAssistant>('GET', `/assistant/${assistantId}`, apiKey);

  const existingModel = assistant.model ?? {};
  const existingToolIds: string[] = Array.isArray(existingModel.toolIds)
    ? (existingModel.toolIds as string[])
    : [];
  const managedToolIds = Object.values(lockTools).map((t) => t.id);

  const union = dedupe([...existingToolIds, ...managedToolIds]);

  const alreadyAttached = managedToolIds.filter((id) => existingToolIds.includes(id));
  const newlyAttached = managedToolIds.filter((id) => !existingToolIds.includes(id));
  const externalOnAssistant = existingToolIds.filter((id) => !managedToolIds.includes(id));

  console.log(`  managed tools already on assistant: ${alreadyAttached.length}`);
  console.log(`  managed tools to attach now:        ${newlyAttached.length}`);
  console.log(`  unmanaged tools left intact:        ${externalOnAssistant.length}`);

  // Managed system-prompt block: keep the first system message in sync with
  // whatever applyManaged() owns for this assistant (tool-calling addendum
  // for onboarding, or the full WEEKLY_GLOBAL_CONTEXT for The Weekly). The
  // rest of the system prompt (persona, product content) is product-owned
  // and untouched.
  const existingMessages: VapiAssistantMessage[] = Array.isArray(existingModel.messages)
    ? (existingModel.messages as VapiAssistantMessage[])
    : [];
  const firstSystem =
    existingMessages[0]?.role === 'system' && typeof existingMessages[0].content === 'string'
      ? (existingMessages[0].content as string)
      : '';
  const newSystemContent = applyManaged(firstSystem);
  const promptChanged = newSystemContent !== firstSystem;

  const toolsChanged = !arraysEqualAsSets(existingToolIds, union);

  let attachedCount = 0;
  if (!toolsChanged && !promptChanged) {
    console.log(`  ✓ assistant unchanged`);
  } else {
    const updatedMessages: VapiAssistantMessage[] = promptChanged
      ? [
          { ...(existingMessages[0] ?? { role: 'system' }), content: newSystemContent },
          ...existingMessages.slice(1),
        ]
      : existingMessages;
    await vapiFetch('PATCH', `/assistant/${assistantId}`, apiKey, {
      model: { ...existingModel, toolIds: union, messages: updatedMessages },
    });
    const parts: string[] = [];
    if (toolsChanged) parts.push(`${union.length} total tool ids`);
    if (promptChanged) parts.push('managed block applied');
    console.log(`  ↻ assistant updated  (${parts.join(', ')})`);
    attachedCount = newlyAttached.length;
  }

  console.log(
    `  Summary (${label}): ${createdCount} created, ${updatedCount} updated, ${unchangedCount} unchanged. ` +
      `${attachedCount} newly attached to assistant.`,
  );

  // Caller (main()) writes lock.assistant / lock.weeklyAssistant + saves —
  // this function only mutates the lockTools map it was handed (already a
  // reference into lock.tools / lock.weeklyTools).
}

async function main(): Promise<void> {
  const apiKey = requireEnv('VAPI_PRIVATE_KEY');
  const secret = requireEnv('VAPI_WEBHOOK_SECRET');
  const baseUrl = requireEnv('VAPI_WEBHOOK_BASE_URL');
  const assistantId = requireEnv('VITE_VAPI_ASSISTANT_ID');
  // Optional. The Weekly runs on its OWN dedicated Vapi assistant, separate
  // from onboarding's — approved decision, see gg-spec/docs/the-weekly.md.
  // Absent → weekly sync is skipped entirely; onboarding sync below is
  // completely unchanged either way.
  const weeklyAssistantId = process.env.VAPI_WEEKLY_ASSISTANT_ID?.trim();

  if (!IS_DEV && TUNNEL_HOSTS.test(baseUrl)) {
    throw new Error(
      `Refusing to sync prod with tunnel URL "${baseUrl}". ` +
        `Re-run with --dev (writes vapi.lock.dev.json) or set VAPI_WEBHOOK_BASE_URL to the prod Vercel URL.`,
    );
  }
  if (IS_DEV && !TUNNEL_HOSTS.test(baseUrl)) {
    console.warn(
      `[warn] --dev set but VAPI_WEBHOOK_BASE_URL=${baseUrl} doesn't look like a tunnel/localhost. ` +
        `Continuing — but make sure you really mean to point the dev assistant at a non-local URL.`,
    );
  }

  console.log(
    `Vapi sync starting… (mode: ${IS_DEV ? 'DEV' : IS_STAGING ? 'STAGING' : 'PROD'}, lockfile: ${LOCKFILE.split('/').pop()})`,
  );

  const lock = loadLock();
  const remoteByName = await fetchRemoteToolsByName(apiKey);
  if (IS_DRY) console.log('[dry-run] no writes will be made.\n');

  await syncOneAssistant({
    label: 'onboarding',
    tools: ONBOARDING_TOOLS,
    assistantId,
    apiKey,
    baseUrl,
    secret,
    remoteByName,
    lockTools: lock.tools,
    applyManaged: applyAddendum,
  });

  if (!IS_DRY) {
    const managedToolIds = Object.values(lock.tools).map((t) => t.id);
    lock.assistant = {
      id: assistantId,
      hash: hash({ toolIds: managedToolIds.sort(), addendumHash: hash(SYSTEM_PROMPT_ADDENDUM) }),
      updatedAt: new Date().toISOString(),
    };
  }

  if (weeklyAssistantId) {
    if (!lock.weeklyTools) lock.weeklyTools = {};
    await syncOneAssistant({
      label: 'The Weekly',
      tools: WEEKLY_TOOLS,
      assistantId: weeklyAssistantId,
      apiKey,
      baseUrl,
      secret,
      remoteByName,
      lockTools: lock.weeklyTools,
      applyManaged: applyWeeklyContext,
    });

    if (!IS_DRY) {
      const managedWeeklyToolIds = Object.values(lock.weeklyTools).map((t) => t.id);
      lock.weeklyAssistant = {
        id: weeklyAssistantId,
        hash: hash({
          toolIds: managedWeeklyToolIds.sort(),
          contextHash: hash(WEEKLY_GLOBAL_CONTEXT),
        }),
        updatedAt: new Date().toISOString(),
      };
    }
  } else {
    console.log(
      '\n[skip] VAPI_WEEKLY_ASSISTANT_ID not set — skipping The Weekly assistant sync. ' +
        'Set it to sync tools.weekly.ts + WEEKLY_GLOBAL_CONTEXT to a dedicated Vapi assistant.',
    );
  }

  if (IS_DRY) return;

  saveLock(lock);
}

main().catch((err) => {
  console.error('\nvapi:sync failed:');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
