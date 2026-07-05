#!/usr/bin/env node
/**
 * Drives the onboarding text path (/api/llm) beat by beat against a preview
 * deploy and records each turn's coach text + tool calls, for the context-QA
 * matrix (gg-spec docs/qa/context-matrix-2026-07.md, C4). No UI — this is the
 * text path itself; card-render checks still need a human/browser walk.
 *
 * Run:
 *   PREVIEW_URL=https://<preview>.vercel.app \
 *   SUPABASE_URL=https://<staging-ref>.supabase.co \
 *   SUPABASE_ANON_KEY=... QA_PASSWORD=... \
 *     node scripts/qa/context-matrix-driver.mjs [--out /tmp/c4-out]
 *
 * Uses QA_EMAIL (default qa-onboarding-fable@guidedgrowth.test); self-resets
 * that account before each path run and once at the end, via /api/qa/self-reset
 * (QA-pattern accounts only, enforced server-side).
 */

const PREVIEW = process.env.PREVIEW_URL;
const SUPA = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const EMAIL = process.env.QA_EMAIL ?? 'qa-onboarding-fable@guidedgrowth.test';
const PASSWORD = process.env.QA_PASSWORD;
const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : '/tmp/c4-out';

if (!PREVIEW || !SUPA || !ANON || !PASSWORD) {
  console.error('Set PREVIEW_URL, SUPABASE_URL, SUPABASE_ANON_KEY, QA_PASSWORD.');
  process.exit(1);
}
if (!/^qa-onboarding-[a-z0-9-]+@guidedgrowth\.test$/.test(EMAIL)) {
  console.error('QA_EMAIL must match the qa-onboarding-*@guidedgrowth.test pattern.');
  process.exit(1);
}

import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Turn scripts. `probe` turns test the read-options boundary and carry the
// EXPECTED behavior (ruling 2026-07-05): `probe: 'recite'` = the user DIRECTLY
// asked for the options, so the coach SHOULD read the current screen's options;
// `probe: 'no-recite'` = mere uncertainty with no request, so the coach must
// NOT volunteer the list. `answer` turns supply data so state accumulates for
// later beats. Self-advancing beats must NOT fire advance_step.
const BEGINNER = [
  { screen: 'ONBOARD-01--FORM', msg: "I'm 34, and I'm a man" },
  { screen: 'ONBOARD-STATE-CHECK', msg: 'Mood is good, slept alright, energy is decent, not too stressed' },
  { screen: 'ONBOARD-MORNING-SETUP', msg: '8am every day works' },
  { screen: 'ONBOARD-BEGINNER-07', msg: 'Ask me a few questions each evening, 9pm on weekdays' },
  { screen: 'ONBOARD-FORK--FORM', msg: "This is new for me, I've never tracked habits" },
  // Uncertainty WITHOUT a request → coach grounds, does not list (default holds).
  { screen: 'ONBOARD-BEGINNER-01', msg: "Ugh, I don't even know where to start", probe: 'no-recite' },
  // Direct ask → coach reads the options (ruling flip).
  { screen: 'ONBOARD-BEGINNER-01', msg: "I'm not sure. What are my options?", probe: 'recite' },
  { screen: 'ONBOARD-BEGINNER-01', msg: 'Sleep better I guess' },
  { screen: 'ONBOARD-BEGINNER-02', msg: 'Hmm, what can I pick here?', probe: 'recite' },
  { screen: 'ONBOARD-BEGINNER-02', msg: 'Falling asleep earlier' },
  { screen: 'ONBOARD-BEGINNER-03', msg: 'Which habits are there? Read them to me', probe: 'recite' },
  { screen: 'ONBOARD-BEGINNER-03', msg: 'A wind-down routine before bed sounds right' },
  { screen: 'ONBOARD-BEGINNER-04', msg: 'Every weekday at 10pm, no reminder needed' },
  { screen: 'ONBOARD-COMPLETE', msg: 'Looks good, let’s start' },
];
const ADVANCED = [
  { screen: 'ONBOARD-01--FORM', msg: "34, male" },
  { screen: 'ONBOARD-STATE-CHECK', msg: 'Feeling fine, slept well, energy high, low stress' },
  { screen: 'ONBOARD-MORNING-SETUP', msg: '7:30 in the morning, weekdays' },
  { screen: 'ONBOARD-BEGINNER-07', msg: 'Freeform please, 10pm every day' },
  { screen: 'ONBOARD-FORK--FORM', msg: 'I already track habits in another app' },
  { screen: 'ONBOARD-ADVANCED', msg: 'I run three times a week, meditate every morning, and I want to stop doomscrolling at night' },
  { screen: 'ONBOARD-ADVANCED-FREQUENCY', msg: 'Running Monday Wednesday Friday, meditation every day, the doomscrolling one every night' },
  { screen: 'ONBOARD-COMPLETE', msg: 'Start it' },
];

async function login() {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`login failed: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

async function selfReset(token) {
  const r = await fetch(`${PREVIEW}/api/qa/self-reset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`self-reset: ${r.status}`);
}

async function turn(token, chatSessionId, screen, msg) {
  const r = await fetch(`${PREVIEW}/api/llm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: chatSessionId,
      chat_session_id: chatSessionId,
      user_turn_id: randomUUID(),
      screen_id: screen,
      mode: 'chat',
      user_message: msg,
      input_mode: 'text',
      timezone: 'Asia/Jerusalem',
    }),
  });
  const raw = await r.text();
  const events = raw
    .split('\n\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => {
      try {
        return JSON.parse(l.slice(6));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const text = events.filter((e) => e.type === 'delta').map((e) => e.content).join('');
  const tools = events
    .filter((e) => e.type === 'tool_call')
    .map((tc) => ({
      name: tc.name,
      args: tc.args,
      ok: events.find((e) => e.type === 'tool_result' && e.id === tc.id)?.result?.ok ??
        events.find((e) => e.type === 'tool_result' && e.id === tc.id)?.ok ?? null,
    }));
  const errors = events.filter((e) => e.type === 'error' || e.type === 'tool_failed');
  return { status: r.status, text, tools, errors, eventCount: events.length };
}

async function runPath(name, script, token) {
  const chatSessionId = randomUUID();
  for (let i = 0; i < script.length; i++) {
    const { screen, msg, probe } = script[i];
    // probe carries the expected behavior ('recite' | 'no-recite'); a bare true
    // stays back-compatible. A human reads the transcript against `expect`.
    const expect = typeof probe === 'string' ? probe : null;
    const res = await turn(token, chatSessionId, screen, msg);
    const file = `${OUT}/${name}-${String(i).padStart(2, '0')}-${screen}${
      probe ? `-PROBE${expect ? '-' + expect : ''}` : ''
    }.json`;
    writeFileSync(
      file,
      JSON.stringify({ screen, probe: !!probe, expect, user: msg, ...res }, null, 2),
    );
    console.log(
      `${name} ${screen}${probe ? ` [probe:${expect ?? 'yes'}]` : ''}: http=${res.status} tools=[${res.tools
        .map((t) => `${t.name}${t.ok === false ? '!FAIL' : ''}`)
        .join(',')}] errors=${res.errors.length} text="${res.text.slice(0, 70).replace(/\n/g, ' ')}"`,
    );
  }
}

mkdirSync(OUT, { recursive: true });
const token = await login();
console.log(`logged in as ${EMAIL}`);
await selfReset(token);
await runPath('beginner', BEGINNER, token);
await selfReset(token);
await runPath('advanced', ADVANCED, token);
await selfReset(token);
console.log(`done — transcripts in ${OUT}`);
