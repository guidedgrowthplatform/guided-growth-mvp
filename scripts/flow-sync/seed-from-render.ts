/**
 * Lane B seed converter: onboarding render -> designer-source Export document.
 *
 * ONE-TIME migration tool (onboarding consolidation, 2026-07-06). Reads the render
 * branch's machine truth (FlowDesigner BEATS + onboardingMetadata.json + voiceClips)
 * at a pinned sha, merges it over the current designer-source.json (which owns the
 * engine wiring: nodeIds, persist steps, tools, contexts), and emits:
 *
 *   1. designer-source.seeded.json  : the new Export document in the Step-0 schema
 *   2. seed-report.md               : beat-by-beat provenance + diffs + flags for
 *                                     the mandatory hand review (verbatim copy lock)
 *
 * Merge rules (the whole point, do not blur them):
 *   - RENDER WINS on spoken copy: props coach lines, narration, per-element lines,
 *     spokenContent, openerShowsAsBubble, expectedResponse, clips (mp3Assets).
 *     Copy is VERBATIM-LOCKED to the render; never paraphrase here.
 *   - BASE WINS on engine wiring and authoring context: meta.engine (nodeId, backId,
 *     persistStep, captureFields, tools, voice flags), allowedTools, openerMode,
 *     context, sheetStage, background, beat labels, names.
 *   - PRESERVED beats the render does not carry: qa-control (0), weekly-day-setup (9b).
 *   - DROPPED beats the render superseded: why-intro (7) (merged into state-check;
 *     it carries no engine node, so the graph is unaffected).
 *   - The women's category art variant is RENDER-TIME (Yair ruling 2026-07-06: same
 *     screenId, art switch by profile gender). No second category beat is emitted
 *     unless EMIT_WOMEN_VARIANT_BEAT is flipped.
 *
 * The emitted document targets the STEP-0 schema (narration[], hideOrb,
 * componentOwned, custom-entry componentType). It will NOT pass the pre-Step-0
 * zod parse; run flow:sync only after the schema MR is merged. Field placement
 * for the new fields is centralized in FIELD_PLACEMENT so this converter can be
 * re-aligned to the landed schema in one place.
 *
 * Run (paths are explicit so the render worktree is never touched):
 *   npx tsx scripts/flow-sync/seed-from-render.ts \
 *     --flow-designer <FlowDesigner.tsx> --metadata <onboardingMetadata.json> \
 *     --voice-clips <voiceClips.ts> --base <designer-source.json> \
 *     --clips-manifest <clips-manifest.txt> --render-sha <sha> --out-dir <dir>
 *
 * NO EM DASHES.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Step-0 schema alignment knobs. Re-check against the landed schema MR.
// ---------------------------------------------------------------------------
const FIELD_PLACEMENT = {
  // 'meta' puts narration alongside perElement/mp3Assets; 'beat' puts it top-level.
  narration: 'meta' as 'meta' | 'beat',
  // The render carries hideOrb at beat level; keep that unless the schema says meta.
  hideOrb: 'beat' as 'meta' | 'beat',
  componentOwned: 'beat' as 'meta' | 'beat',
};
// Yair ruling 2026-07-06 (handoff Q2): same screenId, render-time art switch, so no
// separate women's beat is seeded. Flip only if the landed schema models it as a beat.
const EMIT_WOMEN_VARIANT_BEAT = false;

// Component-owned beats per the handoff (greeting self-plays audio + orb; mic owns
// its orb animation while the driver speaks the line; both suppress the docked orb).
const COMPONENT_OWNED_RENDER_IDS = new Set(['coach-greeting', 'mic-permission']);

// render beat id -> base beat label. New render beats get fresh labels.
const RENDER_TO_BASE: Record<string, string> = {
  splash: '1',
  'get-started': '2',
  'coach-greeting': '3',
  'sign-up': '4',
  'mic-permission': '5',
  profile: '6',
  'state-check': '8a',
  checkin: '8b',
  reflection: '9',
  fork: '10',
  category: '11a',
  goals: '11b',
  habits: '11c',
  schedule: '11d',
  'advanced-capture': '11e',
  'advanced-frequency': '11f',
  plan: '12',
};
const RENDER_NEW_LABELS: Record<string, string> = {
  'category-women': '11a2',
  'goal-custom': '11b2',
  'habit-custom': '11c2',
};
// weekly-projection render beats match base by props.state.
const PROJECTION_LABELS: Record<string, string> = {
  blank: '13a',
  full: '13b',
  p78: '13c',
  p36: '13d',
  gaps: '13e',
};
// Base beats the render does not carry but the seed must keep.
const PRESERVED_BASE = ['0', '9b'];
// Base beats superseded by the render.
const DROPPED_BASE = ['7'];
// Final beat order of the seeded document, by label.
const OUT_ORDER = [
  '0', '1', '2', '3', '4', '5', '6', '8a', '8b', '9', '9b', '10',
  '11a', ...(EMIT_WOMEN_VARIANT_BEAT ? ['11a2'] : []),
  '11b', '11b2', '11c', '11c2', '11d', '11e', '11f', '12',
  '13a', '13b', '13c', '13d', '13e',
];

// Placeholder engine wiring for the two new custom-entry beats. Lane A's Step-0
// sample beats define the real values; re-align before the content MR goes ready.
const CUSTOM_ENTRY_ENGINE: Record<string, Record<string, unknown>> = {
  'goal-custom': {
    nodeId: 'goal-custom',
    backId: 'goals',
    voiceExpectsInput: true,
    voiceDirectLlmAllowed: true,
  },
  'habit-custom': {
    nodeId: 'habit-custom',
    backId: 'habit-select',
    voiceExpectsInput: true,
    voiceDirectLlmAllowed: true,
  },
};

// ---------------------------------------------------------------------------
// Types (loose on purpose: the source is a TS literal + JSON, the gate is zod later)
// ---------------------------------------------------------------------------
type Dict = Record<string, unknown>;
interface RenderBeat {
  id: string;
  type: string;
  props?: Dict;
  engine: 'MP3' | 'Cartesia' | 'Silent';
  mode: 'Verbatim' | null;
  screenId?: string;
  path: 'both' | 'beginner' | 'advanced';
  hideOrb?: boolean;
}
interface MetaNarrationSeg { say?: string; bubble?: number; reveal?: number; clip?: string }
interface MetaElement { elementId: string; line: string; order: number; showsAsBubble: boolean; clip?: string }
interface MetaBeat {
  screenId: string;
  engine: string;
  scripted: boolean;
  variable: boolean;
  variableNote?: string;
  opener: string;
  openerShowsAsBubble: boolean;
  secondBubble?: string;
  expectedResponse: string;
  clipNote?: string;
  narration?: MetaNarrationSeg[];
  elements?: MetaElement[];
}
interface NarrationSeg { kind: 'bubble' | 'reveal'; n: number; say?: string; clip?: string }
interface Mp3Asset {
  id: string; label: string; file: string; transcript: string;
  elementId?: string; timing: 'opener' | 'element' | 'full-beat';
}

// ---------------------------------------------------------------------------
// CLI + input loading
// ---------------------------------------------------------------------------
function arg(name: string): string {
  const i = process.argv.indexOf('--' + name);
  if (i < 0 || !process.argv[i + 1]) throw new Error('missing --' + name);
  return process.argv[i + 1];
}

/** Extract the BEATS literal from FlowDesigner.tsx and evaluate it (pure data). */
function loadRenderBeats(path: string): RenderBeat[] {
  const src = readFileSync(path, 'utf8');
  const start = src.indexOf('export const BEATS');
  if (start < 0) throw new Error('BEATS export not found in ' + path);
  const open = src.indexOf('[', start);
  const end = src.indexOf('\n];', open);
  if (open < 0 || end < 0) throw new Error('BEATS array bounds not found');
  const literal = src.slice(open, end + 2);
  // The block is a pure literal (verified: no JSX, spreads, calls, identifiers).
  const beats = new Function('"use strict"; return ' + literal)() as RenderBeat[];
  if (!Array.isArray(beats) || beats.length < 20) {
    throw new Error('BEATS eval produced ' + (beats as unknown[])?.length + ' entries; expected the full flow');
  }
  return beats;
}

/** Extract the text -> clip file map from voiceClips.ts. */
function loadVoiceClips(path: string): Map<string, string> {
  const src = readFileSync(path, 'utf8');
  const open = src.indexOf('new Map<string, string>([');
  const end = src.indexOf('\n]);', open);
  if (open < 0 || end < 0) throw new Error('CLIPS map bounds not found in ' + path);
  const literal = src.slice(src.indexOf('[', open), end + 2);
  const pairs = new Function('"use strict"; return ' + literal)() as [string, string][];
  return new Map(pairs);
}

// ---------------------------------------------------------------------------
// Lint helpers (standing rules)
// ---------------------------------------------------------------------------
const problems: string[] = [];
const FORBIDDEN_IN_SPEECH = /\b(tap|taps|tapping|scroll|scrolls|scrolling|click|clicks|clicking|press|presses|pressing|swipe|swipes|swiping)\b/i;

function lintSpoken(where: string, text: string | undefined): void {
  if (!text) return;
  if (/[–—]/.test(text)) problems.push('EM/EN DASH in spoken line at ' + where + ': ' + text.slice(0, 60));
  const hit = text.match(FORBIDDEN_IN_SPEECH);
  if (hit) problems.push('FORBIDDEN word "' + hit[0] + '" in spoken line at ' + where + ': ' + text.slice(0, 80));
}
function lintAny(where: string, value: unknown): void {
  if (typeof value === 'string' && /[—]/.test(value)) {
    problems.push('EM DASH at ' + where + ': ' + value.slice(0, 60));
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => lintAny(where + '[' + i + ']', v));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Dict)) lintAny(where + '.' + k, v);
  }
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------
function main(): void {
  const renderSha = arg('render-sha');
  const outDir = arg('out-dir');
  const renderBeats = loadRenderBeats(arg('flow-designer'));
  const metaDoc = JSON.parse(readFileSync(arg('metadata'), 'utf8')) as { beats: MetaBeat[] };
  const voiceClips = loadVoiceClips(arg('voice-clips'));
  const base = JSON.parse(readFileSync(arg('base'), 'utf8')) as { flowId: string; beats: Dict[] };
  const clipsManifest = new Set(
    readFileSync(arg('clips-manifest'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
      .map((p) => '/' + p.replace(/^public\//, '')),
  );

  const metaByScreen = new Map(metaDoc.beats.map((m) => [m.screenId, m]));
  const baseByLabel = new Map(base.beats.map((b) => [String(b.beat), b]));
  const report: string[] = [];
  const clipIdToFile = new Map<string, string>();

  /** Resolve a spoken line to its recorded clip file via the render's map. */
  function clipFor(where: string, text: string): { id: string; file: string } | null {
    const file = voiceClips.get(text.trim());
    if (!file) return null;
    if (!clipsManifest.has(file)) problems.push('CLIP FILE MISSING at ' + where + ': ' + file);
    const id = file.split('/').pop()!.replace(/\.(wav|mp3)$/, '');
    clipIdToFile.set(id, file);
    return { id, file };
  }

  /** Normalize the metadata narration into the Step-0 shape, resolving clips. */
  function buildNarration(m: MetaBeat, where: string): NarrationSeg[] | undefined {
    if (!m.narration?.length) return undefined;
    return m.narration.map((seg, i) => {
      const kind: 'bubble' | 'reveal' = seg.bubble != null ? 'bubble' : 'reveal';
      const n = (seg.bubble ?? seg.reveal)!;
      const out: NarrationSeg = { kind, n };
      if (seg.say) out.say = seg.say;
      let clipId = seg.clip;
      if (!clipId && seg.say) clipId = clipFor(where + '.narration[' + i + ']', seg.say)?.id;
      if (clipId) {
        out.clip = clipId;
        const file = clipIdToFile.get(clipId) ?? '/voice/ob/' + clipId + '.wav';
        if (!clipsManifest.has(file)) problems.push('CLIP FILE MISSING at ' + where + '.narration[' + i + ']: ' + file);
        clipIdToFile.set(clipId, file);
      }
      lintSpoken(where + '.narration[' + i + ']', seg.say);
      return out;
    });
  }

  /** mp3Assets for a beat: opener/bubble clips + element clips, id-addressed. */
  function buildMp3Assets(rb: RenderBeat, m: MetaBeat | undefined, narration: NarrationSeg[] | undefined, where: string): Mp3Asset[] {
    const assets: Mp3Asset[] = [];
    const seen = new Set<string>();
    const push = (a: Mp3Asset) => { if (!seen.has(a.id)) { seen.add(a.id); assets.push(a); } };

    if (rb.id === 'coach-greeting') {
      const opener = m?.opener ?? '';
      clipIdToFile.set('splash_welcome', '/voice/splash_welcome.mp3');
      push({ id: 'splash_welcome', label: 'splash_welcome', file: '/voice/splash_welcome.mp3', transcript: opener, timing: 'full-beat' });
      return assets;
    }
    lintSpoken(where + '.opener', m?.opener);
    lintSpoken(where + '.secondBubble', m?.secondBubble);
    const elementByClip = new Map((m?.elements ?? []).filter((e) => e.clip).map((e) => [e.clip!, e]));
    if (narration) {
      for (const seg of narration) {
        if (!seg.clip || !seg.say) continue;
        const file = clipIdToFile.get(seg.clip)!;
        const el = elementByClip.get(seg.clip);
        push({
          id: seg.clip, label: seg.clip, file, transcript: seg.say,
          ...(el ? { elementId: el.elementId } : {}),
          timing: seg.kind === 'bubble' ? 'opener' : 'element',
        });
      }
    } else if (rb.engine === 'MP3' && m?.opener) {
      const c = clipFor(where + '.opener', m.opener);
      if (c) push({ id: c.id, label: c.id, file: c.file, transcript: m.opener, timing: 'opener' });
      else problems.push('NO CLIP for MP3 opener at ' + where + ': ' + m.opener.slice(0, 60));
    }
    // Element clips outside the narration script. Elements without an explicit
    // clip id resolve by exact line text via the render's voiceClips map (the
    // profile age/gender asks are authored that way); silent visual labels that
    // match no clip are skipped.
    for (const el of m?.elements ?? []) {
      lintSpoken(where + ' element ' + el.elementId, el.line);
      let clipId = el.clip;
      let file = clipId ? '/voice/ob/' + clipId + '.wav' : voiceClips.get(el.line.trim());
      if (!clipId && file) clipId = file.split('/').pop()!.replace(/\.(wav|mp3)$/, '');
      if (!clipId || !file) continue;
      if (!clipsManifest.has(file)) { problems.push('CLIP FILE MISSING at ' + where + ' element ' + el.elementId + ': ' + file); continue; }
      clipIdToFile.set(clipId, file);
      push({ id: clipId, label: clipId, file, transcript: el.line, elementId: el.elementId, timing: 'element' });
    }
    // Spoken prop lines not covered above (the advanced close line, and any
    // bubble line on a beat with no narration script). Bubble-class lines carry
    // timing 'opener'; the seen-set keeps narration-derived assets first.
    if (rb.engine === 'MP3') {
      for (const key of ['coachLine', 'coachLine2', 'closeCoachLine', 'confirmCoachLine']) {
        const line = (rb.props as Dict | undefined)?.[key];
        if (typeof line !== 'string') continue;
        const file = voiceClips.get(line.trim());
        if (!file) continue; // missing bubbles are flagged by the narration/opener checks
        const id = file.split('/').pop()!.replace(/\.(wav|mp3)$/, '');
        if (!clipsManifest.has(file)) { problems.push('CLIP FILE MISSING at ' + where + '.props.' + key + ': ' + file); continue; }
        clipIdToFile.set(id, file);
        push({ id, label: id, file, transcript: line.trim(), timing: 'opener' });
      }
    }
    return assets;
  }

  /** Merge one render beat over its base beat (or synthesize a new one). */
  function convert(rb: RenderBeat): Dict {
    const label = rb.type === 'weekly-projection'
      ? PROJECTION_LABELS[String((rb.props as Dict)?.state)]
      : RENDER_TO_BASE[rb.id] ?? RENDER_NEW_LABELS[rb.id];
    if (!label) throw new Error('no label mapping for render beat ' + rb.id);
    const baseBeat = baseByLabel.get(label);
    const where = rb.id + ' (' + label + ')';
    const m = rb.screenId ? metaByScreen.get(rb.screenId) : undefined;
    const baseMeta = (baseBeat?.meta ?? {}) as Dict;
    const baseProps = (baseBeat?.props ?? {}) as Dict;

    // Props: base keys survive, render keys win. Copy fields are render-verbatim.
    const props: Dict = { ...baseProps, ...(rb.props ?? {}) };
    for (const k of ['coachLine', 'coachLine2', 'closeCoachLine', 'confirmCoachLine', 'greeting', 'askAge', 'askGender']) {
      if (typeof props[k] === 'string') lintSpoken(where + '.props.' + k, props[k] as string);
    }

    const narration = m ? buildNarration(m, where) : undefined;
    const mp3Assets = buildMp3Assets(rb, m, narration, where);

    // A/B cross-check (the known gotcha): bubble copy in BEATS props must match the
    // metadata narration/opener text exactly.
    const bubbleSays = (narration ?? []).filter((s) => s.kind === 'bubble' && s.say).map((s) => s.say!.trim());
    const propLines = [props.coachLine, props.coachLine2].filter((v): v is string => typeof v === 'string').map((s) => s.trim());
    if (bubbleSays.length && propLines.length) {
      propLines.forEach((line, i) => {
        if (bubbleSays[i] && bubbleSays[i] !== line) {
          problems.push('A/B COPY MISMATCH at ' + where + ' bubble ' + (i + 1) + ':\n    BEATS: ' + line + '\n    meta : ' + bubbleSays[i]);
        }
      });
    }
    // Verbatim map check: every MP3 bubble line must be a key in voiceClips.
    if (rb.engine === 'MP3') {
      for (const line of propLines) {
        if (!voiceClips.has(line)) problems.push('LINE NOT IN voiceClips (copy drift?) at ' + where + ': ' + line.slice(0, 80));
      }
    }

    const voiceEngine = rb.engine === 'Silent' ? (baseMeta.voiceEngine as string) ?? 'None' : rb.engine;
    const meta: Dict = {
      ...baseMeta,
      voiceEngine,
      ...(rb.mode ? { voiceMode: rb.mode } : {}),
      ...(m ? {
        spokenContent: m.opener,
        openerShowsAsBubble: m.openerShowsAsBubble,
        expectedResponse: m.expectedResponse,
        ...(m.variable != null ? { variable: m.variable } : {}),
        ...(m.elements?.length ? {
          perElement: m.elements.map((e) => ({
            elementId: e.elementId, line: e.line, order: e.order, showsAsBubble: e.showsAsBubble,
          })),
        } : {}),
      } : {}),
      ...(narration && FIELD_PLACEMENT.narration === 'meta' ? { narration } : {}),
      ...(mp3Assets.length ? { mp3Assets } : {}),
    };
    if (!mp3Assets.length) delete meta.mp3Assets; // stale base assets never survive
    if (m?.elements?.length === 0) delete meta.perElement;
    // New-beat engine wiring placeholders (Lane A aligns these in Step 0).
    if (!baseBeat && CUSTOM_ENTRY_ENGINE[rb.id]) meta.engine = CUSTOM_ENTRY_ENGINE[rb.id];

    const beat: Dict = {
      beat: label,
      name: (baseBeat?.name as string) ?? prettyName(rb),
      componentType: rb.type,
      variant: (baseBeat?.variant as string) ?? 'shared',
      showOnPath: baseBeat ? baseBeat.showOnPath : rb.path === 'beginner' ? 'new' : rb.path === 'advanced' ? 'exp' : null,
      background: (baseBeat?.background as string) ?? 'coach',
      sheetStage: (baseBeat?.sheetStage as string) ?? (rb.screenId ? rb.screenId + ': ' + prettyName(rb) : ''),
      transition: (baseBeat?.transition as string | null) ?? null,
      context: (baseBeat?.context as string) ?? '',
      ...(Object.keys(props).length ? { props } : {}),
      ...(rb.hideOrb && FIELD_PLACEMENT.hideOrb === 'beat' ? { hideOrb: true } : {}),
      ...(COMPONENT_OWNED_RENDER_IDS.has(rb.id) && FIELD_PLACEMENT.componentOwned === 'beat' ? { componentOwned: true } : {}),
      meta,
    };
    if (rb.hideOrb && FIELD_PLACEMENT.hideOrb === 'meta') (beat.meta as Dict).hideOrb = true;
    if (COMPONENT_OWNED_RENDER_IDS.has(rb.id) && FIELD_PLACEMENT.componentOwned === 'meta') (beat.meta as Dict).componentOwned = true;
    if (narration && FIELD_PLACEMENT.narration === 'beat') beat.narration = narration;

    // Report entry.
    const oldLine = (baseProps.coachLine as string) ?? (baseMeta.spokenContent as string) ?? '';
    const newLine = (props.coachLine as string) ?? (meta.spokenContent as string) ?? '';
    report.push([
      '### ' + label + ' ' + rb.type + (rb.screenId ? ' (' + rb.screenId + ')' : ''),
      baseBeat ? '- base: merged over beat ' + label : '- base: NEW BEAT (no base counterpart)' + (CUSTOM_ENTRY_ENGINE[rb.id] ? '; engine wiring is a PLACEHOLDER pending the Step-0 sample' : ''),
      oldLine && oldLine !== newLine ? '- copy: OLD "' + oldLine + '"\n- copy: NEW "' + newLine + '"' : '- copy: unchanged or new',
      narration ? '- narration: ' + narration.length + ' segments (' + narration.filter((s) => s.kind === 'bubble').length + ' bubbles, ' + narration.filter((s) => s.kind === 'reveal').length + ' reveals)' : '- narration: none (single-opener behavior)',
      mp3Assets.length ? '- clips: ' + mp3Assets.map((a) => a.id).join(', ') : '- clips: none' + (rb.engine === 'Cartesia' ? ' on the opener (live TTS by design)' : ''),
      baseBeat && Object.keys(baseProps).some((k) => !(rb.props ?? {})[k]) ? '- kept base props: ' + Object.keys(baseProps).filter((k) => !(rb.props ?? {})[k]).join(', ') : '',
      (baseBeat?.context as string)?.length ? '- context: kept from base (' + (baseBeat!.context as string).length + ' chars); may reference superseded copy, Sheet catch-up owns it' : '',
    ].filter(Boolean).join('\n'));
    return beat;
  }

  function prettyName(rb: RenderBeat): string {
    return rb.id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Convert every render beat (skipping the women's variant unless configured in).
  const converted = new Map<string, Dict>();
  for (const rb of renderBeats) {
    if (rb.id === 'category-women' && !EMIT_WOMEN_VARIANT_BEAT) {
      report.push('### (skipped) category-women\n- Yair ruling 2026-07-06: same screenId, render-time art switch by profile gender; no separate beat seeded. Female art: public/images/onboarding/female/*.');
      continue;
    }
    const beat = convert(rb);
    converted.set(String(beat.beat), beat);
  }
  // Preserved base beats.
  for (const label of PRESERVED_BASE) {
    const b = baseByLabel.get(label);
    if (!b) { problems.push('PRESERVED base beat missing: ' + label); continue; }
    converted.set(label, b);
    report.push('### ' + label + ' ' + b.componentType + '\n- PRESERVED from base unchanged (' + (label === '0' ? 'QA launcher, engine skips it' : 'The Weekly day setup; not in the render, kept per plan, position flagged for conductor review') + ')');
  }
  for (const label of DROPPED_BASE) {
    const b = baseByLabel.get(label);
    report.push('### (dropped) ' + label + ' ' + (b?.componentType ?? '?') + '\n- Superseded by the render (why-intro merged into state-check). No engine node on this beat, so the graph is unaffected. sheetStage "' + ((b?.sheetStage as string) ?? '') + '" retires.');
  }

  // Assemble in order.
  const beatsOut = OUT_ORDER.map((label) => {
    const b = converted.get(label);
    if (!b) throw new Error('ordered beat missing from conversion: ' + label);
    return b;
  });
  const doc = {
    flowId: base.flowId,
    source: 'lane-b seed-from-render at ' + renderSha + ' (one-time migration 2026-07-06)',
    beats: beatsOut,
  };
  lintAny('document', doc);

  // Emit.
  mkdirSync(outDir, { recursive: true });
  const outJson = resolve(outDir, 'designer-source.seeded.json');
  writeFileSync(outJson, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  const clipsUsed = [...clipIdToFile.entries()].sort();
  const header = [
    '# Lane B seed report (render -> designer-source)',
    '',
    '- render sha: ' + renderSha,
    '- beats out: ' + beatsOut.length + ' (base had ' + base.beats.length + ', render had ' + renderBeats.length + ')',
    '- clips referenced: ' + clipsUsed.length + ' of ' + clipsManifest.size + ' in the manifest',
    '- unreferenced clips: ' + [...clipsManifest].filter((f) => ![...clipIdToFile.values()].includes(f)).join(', '),
    '',
    problems.length ? '## PROBLEMS (' + problems.length + ')\n\n' + problems.map((p) => '- ' + p).join('\n') : '## PROBLEMS\n\nnone',
    '',
    '## Beat by beat',
    '',
  ].join('\n');
  writeFileSync(resolve(outDir, 'seed-report.md'), header + report.join('\n\n') + '\n', 'utf8');
  console.log('[seed] wrote ' + outJson + ' (' + beatsOut.length + ' beats)');
  console.log('[seed] problems: ' + problems.length);
  for (const p of problems) console.log('  - ' + p);
}

main();
