/**
 * READ-ONLY. Compares the NEW code-generated Vapi machinery (from the beat
 * bundle + engine step model) against the OLD hand-authored screen_contexts
 * machinery, per onboarding beat. Proves the unification preserves nav/gating
 * before flipping getScreenContext. Changes nothing.
 *
 *   npx tsx scripts/diff-beat-machinery.ts
 */
import { buildBeatMachinery, getBundledBeat } from '../src/lib/context/onboardingBeatBundle.ts';
import screenBundle from '../src/generated/screen_contexts.json';

const screens = (screenBundle as any).screens ?? screenBundle;

function oldMachinery(screenId: string): { target: string | null; tools: string[] } {
  const blk: string = screens[screenId]?.context_block ?? screens[screenId]?.contextBlock ?? '';
  const target = (blk.match(/navigate_next\(target_step=(\d+)\)/) || [])[1] ?? null;
  const allowed = (blk.match(/ALLOWED TOOLS[^\n]*\n((?:- [^\n]*\n?)*)/) || [])[1] || '';
  const tools = [...allowed.matchAll(/- (\w+)/g)].map((m) => m[1]).filter((t) => t !== 'navigate_next');
  return { target, tools };
}

function newMachinery(screenId: string): { target: string | null; tools: string[] } {
  const m = buildBeatMachinery(screenId);
  const target = (m.match(/navigate_next\(target_step=(\d+)\)/) || [])[1] ?? null;
  const tools = [...m.matchAll(/^- (\w+)/gm)].map((x) => x[1]).filter((t) => t !== 'navigate_next');
  return { target, tools };
}

const beat = getBundledBeat;
const ids = Object.keys(screens).filter((k) => k.startsWith('ONBOARD') && beat(k));

console.log('beat'.padEnd(22), 'old→target', 'new→target', 'tools(old | new)', 'match');
let mismatches = 0;
for (const id of ids) {
  const o = oldMachinery(id);
  const n = newMachinery(id);
  const oldTools = [...o.tools].sort().join(',');
  const newTools = [...n.tools].sort().join(',');
  // Match = same target_step AND same data-tool set (where old declared them).
  const oldDeclared = o.target !== null || o.tools.length > 0;
  const targetMatch = !oldDeclared || o.target === n.target;
  const toolsMatch = !oldDeclared || oldTools === newTools;
  const ok = targetMatch && toolsMatch;
  if (oldDeclared && !ok) mismatches++;
  console.log(
    id.padEnd(22),
    String(o.target ?? '-').padEnd(10),
    String(n.target ?? '-').padEnd(10),
    `${oldTools || '(none)'}  |  ${newTools || '(none)'}`,
    oldDeclared ? (ok ? 'OK' : 'MISMATCH') : '(old: none → new adds)',
  );
}
console.log(`\n${ids.length} beats compared, ${mismatches} mismatches where old declared machinery.`);
