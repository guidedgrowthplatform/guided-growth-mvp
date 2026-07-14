// Cross-check the authored render contract against the real onboarding backend.
// This is deliberately text-only on the backend side: importing handlers would
// execute app code and turn a static reconciliation report into an integration test.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadBeats, ownBibleBeats } from './lib/beats-ast.mjs';

const ROOT = process.cwd();
const strict = process.argv.includes('--strict');
const mismatches = [];

function lineOf(text, needle) {
  const index = text.indexOf(needle);
  return index < 0 ? 1 : text.slice(0, index).split('\n').length;
}

function locate(file, text, needle) {
  return `${file}:${lineOf(text, needle)}`;
}

async function safeRead(file) {
  try {
    return await readFile(path.join(ROOT, file), 'utf8');
  } catch (error) {
    console.log(`could not read ${file}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function safeHandlerSources(directory) {
  try {
    const names = (await readdir(path.join(ROOT, directory))).filter((name) => name.endsWith('.ts'));
    const entries = await Promise.all(
      names.sort().map(async (name) => {
        const file = `${directory}/${name}`;
        return { file, text: await safeRead(file) };
      }),
    );
    return entries.filter((entry) => entry.text !== null);
  } catch (error) {
    console.log(`could not read ${directory}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function quotedValues(source, declaration) {
  const match = source.match(new RegExp(`${declaration}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`));
  return match ? [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]) : [];
}

function dispatchTools(source) {
  return new Set([...source.matchAll(/^\s{2}([a-z_]+):\s*[A-Za-z]+,/gm)].map((item) => item[1]));
}

function vapiTools(source) {
  return new Set([...source.matchAll(/case '([^']+)':/g)].map((item) => item[1]));
}

function screenId(beat) {
  const aliases = beat.value.bible?.identity?.aliases ?? [];
  return aliases.find((alias) => alias.surface === 'screenId')?.value ?? null;
}

function advanceText(beat) {
  const row = (beat.value.bible?.flow?.rows ?? []).find((item) => item.label === 'advance condition');
  return row?.value ?? null;
}

function operationFor(beatId) {
  if (beatId === 'profile-asks') return 'profile';
  if (beatId === 'fork') return 'path';
  if (beatId.startsWith('category')) return 'category';
  if (beatId.startsWith('goals') || beatId === 'goal-custom') return 'goals';
  if (beatId === 'habits' || beatId === 'habit-custom') return 'habits';
  if (beatId === 'schedule' || beatId === 'advanced-frequency') return 'schedule';
  if (beatId === 'advanced-capture') return 'braindump';
  if (beatId === 'reflection') return 'reflection';
  if (beatId === 'plan') return 'completion';
  return 'advance';
}

function add(operation, dimension, render, backend, message) {
  mismatches.push({ operation, dimension, render, backend, message });
}

function handlerFieldWrites(handlerSources) {
  const fields = new Map();
  const add = (field, file, text, needle) => {
    if (!fields.has(field)) fields.set(field, locate(file, text, needle));
  };

  for (const { file, text } of handlerSources) {
    const objectKeys = [...text.matchAll(/JSON\.stringify\(\s*\{([\s\S]{0,400}?)\}\s*\)/g)]
      .flatMap((match) => [...match[1].matchAll(/(?:^|[,\n]\s*)([A-Za-z][A-Za-z0-9_]*)\s*(?::|,|$)/g)])
      .map((match) => match[1]);
    for (const key of objectKeys) add(`data.${key}`, file, text, key);

    for (const key of ['age', 'gender', 'category', 'goals', 'habitConfigs', 'brainDumpText', 'reflectionConfig', 'customPrompts']) {
      if (new RegExp(`\\b${key}\\b`).test(text)) add(`data.${key}`, file, text, key);
    }
    if (/\bpath\b/.test(text) && /INSERT INTO onboarding_states[\s\S]*?\bpath\b/.test(text)) {
      add('path', file, text, 'path');
    }
    if (/\bbrain_dump_raw\b/.test(text)) add('brain_dump_raw', file, text, 'brain_dump_raw');
    if (/\bcompleted_at\b/.test(text)) add('completed_at', file, text, 'completed_at');
    if (/current_step\s*=\s*GREATEST/.test(text)) {
      add('current_step', file, text, 'current_step = GREATEST');
    }
    if (/status\s*=\s*'completed'/.test(text)) add('status.completed', file, text, "status = 'completed'");
    if (/daily_checkins/.test(text)) add('daily_checkins', file, text, 'daily_checkins');
  }
  return fields;
}

function contractFields(beat) {
  const output = beat.value.io?.dataOut ?? beat.value.dataOut ?? [];
  const fields = [];
  for (const item of output) {
    const target = item.persistsTo;
    if (typeof target !== 'string') continue;
    for (const match of target.matchAll(/onboarding_states\.data\.([A-Za-z][A-Za-z0-9_]*)/g)) {
      fields.push(`data.${match[1]}`);
    }
    for (const match of target.matchAll(/onboarding_states\.(brain_dump_raw|completed_at|current_step)/g)) {
      fields.push(match[1]);
    }
    if (/daily_checkins/.test(target)) fields.push('daily_checkins');
    if (/reflection_settings\.config/.test(target)) fields.push('reflection_settings.config');
    if (/onboarding_states\.status/.test(target)) fields.push('status.completed');
    if (/\bcompleted_at\b/.test(target)) fields.push('completed_at');
    if (/\bcurrent_step\b/.test(target) && /completed/.test(target)) {
      fields.push('current_step.completed');
    }
  }
  return [...new Set(fields)];
}

function nextStepKeys(source) {
  const match = source.match(/export const NEXT_STEP[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
  return new Set(match ? [...match[1].matchAll(/'([^']+)'\s*:/g)].map((item) => item[1]) : []);
}

function selfAdvanceLocation(handlerSources, tool) {
  const handlerName = tool.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  const file = `api/_lib/llm/onboarding/handlers/${handlerName}.ts`;
  const entry = handlerSources.find((handler) => handler.file === file);
  if (!entry || !/current_step\s*=\s*GREATEST/.test(entry.text)) return null;
  return locate(file, entry.text, 'current_step = GREATEST');
}

async function main() {
  const schemasFile = 'api/_lib/llm/onboarding/schemas.ts';
  const onboardingDispatchFile = 'api/_lib/llm/onboarding/dispatch.ts';
  const confirmFile = 'api/_lib/llm/onboarding/handlers/confirmStepComplete.ts';
  const vapiDispatchFile = 'api/_lib/vapi/dispatch.ts';
  const [schemas, onboardingDispatch, confirmStepComplete, vapiDispatch, onboardingHandlers] = await Promise.all([
    safeRead(schemasFile),
    safeRead(onboardingDispatchFile),
    safeRead(confirmFile),
    safeRead(vapiDispatchFile),
    safeHandlerSources('api/_lib/llm/onboarding/handlers'),
  ]);
  await safeHandlerSources('api/_lib/vapi/handlers');

  let render;
  try {
    render = await loadBeats();
  } catch (error) {
    console.log(`could not read render beats via scripts/checks/lib/beats-ast.mjs: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const bibleBeats = ownBibleBeats(render.beats);
  const directTools = onboardingDispatch ? dispatchTools(onboardingDispatch) : new Set();
  const voiceTools = vapiDispatch ? vapiTools(vapiDispatch) : new Set();
  const backendTools = new Set([...directTools, ...voiceTools]);
  // Search ALL lanes that persist onboarding fields, not just the onboarding LLM handlers:
  // the REST completion route (api/onboarding/[...path].ts) writes status/completed_at, and the
  // check-in lane writes daily_checkins. Omitting these caused false "not written" reports
  // (caught by the cross-model committee 2026-07-14). The cross-lane divergence (e.g. completion
  // done by /complete not confirm_plan) is still surfaced via the TOOL + current_step.completed checks.
  const writeSources = [
    ...onboardingHandlers,
    ...(await safeHandlerSources('api/onboarding')),
    ...(await safeHandlerSources('api/_lib/llm/checkin/handlers')),
  ];
  const writes = handlerFieldWrites(writeSources);
  const nextSteps = confirmStepComplete ? nextStepKeys(confirmStepComplete) : new Set();
  const directAnchor = onboardingDispatch ? locate(onboardingDispatchFile, onboardingDispatch, 'const HANDLERS') : onboardingDispatchFile;
  const voiceAnchor = vapiDispatch ? locate(vapiDispatchFile, vapiDispatch, 'switch (name)') : vapiDispatchFile;

  for (const beat of bibleBeats) {
    const operation = operationFor(beat.beatId);
    const renderLocation = `src/components/flow-designer/beatsSource.ts:${beat.line}`;
    const tools = beat.value.bible?.allowedTools?.tools ?? [];

    for (const tool of tools) {
      if (backendTools.has(tool)) continue;
      const backend = tool === 'advance_step' ? `${directAnchor}; ${voiceAnchor}` : `${directAnchor}; ${voiceAnchor}`;
      const detail =
        tool === 'advance_step'
          ? 'render calls advance_step, but backend exposes confirm_step_complete (direct) and navigate_next (Vapi), not advance_step'
          : `render calls ${tool}, but neither direct onboarding nor Vapi dispatch registers it`;
      add(operation, 'TOOL', renderLocation, backend, detail);
    }

    for (const field of contractFields(beat)) {
      if (writes.has(field)) continue;
      add(
        operation,
        'PERSISTENCE',
        renderLocation,
        directAnchor,
        `render claims to write ${field}, but no onboarding, REST-completion, or check-in handler writes that field`,
      );
    }

    if (beat.beatId === 'fork' && schemas) {
      const backendPathValues = quotedValues(schemas, 'PATH_OPTIONS');
      const renderPathText = JSON.stringify(beat.value.bible?.persistence ?? {});
      if (/beginner/.test(renderPathText) && /advanced/.test(renderPathText) && backendPathValues.join('|') !== 'beginner|advanced') {
        add(
          operation,
          'PERSISTENCE',
          renderLocation,
          locate(schemasFile, schemas, 'PATH_OPTIONS'),
          `path enum differs: render uses beginner|advanced, backend PATH_OPTIONS uses ${backendPathValues.join('|') || 'no readable values'}`,
        );
      }
      if (!writes.has('data.path') && writes.has('path')) {
        add(
          operation,
          'PERSISTENCE',
          renderLocation,
          writes.get('path'),
          'path shape differs: render uses onboarding_states.data.path, backend writes the top-level onboarding_states.path column',
        );
      }
    }

    const advance = advanceText(beat);
    if (tools.includes('advance_step') && advance) {
      const id = screenId(beat);
      if (!id || !nextSteps.has(id)) {
        add(
          operation,
          'ADVANCE',
          renderLocation,
          confirmStepComplete
            ? locate(confirmFile, confirmStepComplete, 'export const NEXT_STEP')
            : confirmFile,
          `render advance condition has no confirmStepComplete NEXT_STEP mapping for ${id ?? 'no render screenId'}`,
        );
      }
    }

    for (const tool of tools) {
      const location = selfAdvanceLocation(onboardingHandlers, tool);
      if (!location) continue;
      add(
        operation,
        'ADVANCE',
        renderLocation,
        location,
        `${tool} self-advances current_step, contradicting the render model that submit is data-only and advance_step performs navigation`,
      );
    }
  }

  const order = ['path', 'category', 'profile', 'goals', 'habits', 'schedule', 'braindump', 'reflection', 'advance', 'completion'];
  console.log('Backend parity report (report mode, no backend code executed)');
  for (const operation of order) {
    const rows = mismatches.filter((mismatch) => mismatch.operation === operation);
    if (!rows.length) continue;
    console.log(`\n${operation.toUpperCase()} (${rows.length})`);
    for (const row of rows) {
      console.log(`- [${row.dimension}] ${row.message}`);
      console.log(`  render: ${row.render}`);
      console.log(`  backend: ${row.backend}`);
    }
  }
  console.log(`\nTotal mismatches: ${mismatches.length}`);
  if (strict && mismatches.length) process.exitCode = 1;
}

await main();
