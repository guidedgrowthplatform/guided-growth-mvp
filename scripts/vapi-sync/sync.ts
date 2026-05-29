/**
 * Vapi tool registrar — idempotent.
 *
 * Reads ONBOARDING_TOOLS from api/_lib/llm/tools.onboarding.ts, wraps each in
 * Vapi's envelope, then for each tool: skip if hash unchanged, PATCH if
 * mutated, POST if new. Finally PATCHes the configured assistant to attach
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
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { ONBOARDING_TOOLS } from '../../api/_lib/llm/tools.onboarding.js';
import { BLOCK_START, BLOCK_END, SYSTEM_PROMPT_ADDENDUM } from './assistant.js';
import { wrapTool, type VapiToolEnvelope } from './wrap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IS_DEV = process.argv.includes('--dev');
const LOCKFILE = resolve(__dirname, IS_DEV ? 'vapi.lock.dev.json' : 'vapi.lock.json');
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
 * Apply the managed tool-calling addendum to a system-prompt string.
 * - If sentinel markers exist → replace content between them.
 * - If neither marker exists → append a fresh block.
 * - If only one marker exists → corruption; leave the prompt alone and warn.
 * Idempotent.
 */
function applyAddendum(content: string): string {
  const startIdx = content.indexOf(BLOCK_START);
  const endIdx = content.indexOf(BLOCK_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx + BLOCK_END.length);
    return `${before}${SYSTEM_PROMPT_ADDENDUM}${after}`;
  }
  if (startIdx === -1 && endIdx === -1) {
    return `${content.trimEnd()}\n\n${SYSTEM_PROMPT_ADDENDUM}\n`;
  }
  console.warn(
    '[warn] system prompt has only one sentinel marker — addendum not applied. Fix manually in the Vapi dashboard or delete the orphan marker.',
  );
  return content;
}

interface VapiToolCreated {
  id: string;
  [k: string]: unknown;
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

async function main(): Promise<void> {
  const apiKey = requireEnv('VAPI_PRIVATE_KEY');
  const secret = requireEnv('VAPI_WEBHOOK_SECRET');
  const baseUrl = requireEnv('VAPI_WEBHOOK_BASE_URL');
  const assistantId = requireEnv('VITE_VAPI_ASSISTANT_ID');

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
    `Syncing ${ONBOARDING_TOOLS.length} tool(s) to Vapi… (mode: ${IS_DEV ? 'DEV' : 'PROD'}, lockfile: ${LOCKFILE.split('/').pop()})`,
  );

  const lock = loadLock();

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const tool of ONBOARDING_TOOLS) {
    const envelope = wrapTool(tool, baseUrl, secret);
    const h = hash(envelope);
    const prev = lock.tools[tool.name];

    if (prev?.hash === h) {
      console.log(`  ✓ unchanged  ${tool.name}  (${prev.id})`);
      unchangedCount++;
      continue;
    }

    if (prev) {
      await patchTool(prev.id, envelope, apiKey);
      console.log(`  ↻ updated    ${tool.name}  (${prev.id})`);
      lock.tools[tool.name] = {
        id: prev.id,
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
      lock.tools[tool.name] = {
        id: created.id,
        hash: h,
        updatedAt: new Date().toISOString(),
      };
      createdCount++;
    }
  }

  // Attach to assistant — UNION semantics so we never strip IDs the user
  // configured manually in Vapi's dashboard.
  console.log(`\nFetching assistant ${assistantId}…`);
  const assistant = await vapiFetch<VapiAssistant>('GET', `/assistant/${assistantId}`, apiKey);

  const existingModel = assistant.model ?? {};
  const existingToolIds: string[] = Array.isArray(existingModel.toolIds)
    ? (existingModel.toolIds as string[])
    : [];
  const managedToolIds = Object.values(lock.tools).map((t) => t.id);

  const union = dedupe([...existingToolIds, ...managedToolIds]);

  const alreadyAttached = managedToolIds.filter((id) => existingToolIds.includes(id));
  const newlyAttached = managedToolIds.filter((id) => !existingToolIds.includes(id));
  const externalOnAssistant = existingToolIds.filter((id) => !managedToolIds.includes(id));

  console.log(`  managed tools already on assistant: ${alreadyAttached.length}`);
  console.log(`  managed tools to attach now:        ${newlyAttached.length}`);
  console.log(`  unmanaged tools left intact:        ${externalOnAssistant.length}`);

  // System-prompt addendum: keep the first system message in sync with
  // SYSTEM_PROMPT_ADDENDUM. Other messages (and the rest of the system
  // message content) are product-owned and untouched.
  const existingMessages: VapiAssistantMessage[] = Array.isArray(existingModel.messages)
    ? (existingModel.messages as VapiAssistantMessage[])
    : [];
  const firstSystem =
    existingMessages[0]?.role === 'system' && typeof existingMessages[0].content === 'string'
      ? (existingMessages[0].content as string)
      : '';
  const newSystemContent = applyAddendum(firstSystem);
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
    if (promptChanged) parts.push('tool-calling addendum applied');
    console.log(`  ↻ assistant updated  (${parts.join(', ')})`);
    attachedCount = newlyAttached.length;
  }

  lock.assistant = {
    id: assistantId,
    hash: hash({ toolIds: union, addendumHash: hash(SYSTEM_PROMPT_ADDENDUM) }),
    updatedAt: new Date().toISOString(),
  };

  saveLock(lock);

  console.log(
    `\nSummary: ${createdCount} created, ${updatedCount} updated, ${unchangedCount} unchanged. ` +
      `${attachedCount} newly attached to assistant.`,
  );
}

main().catch((err) => {
  console.error('\nvapi:sync failed:');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
