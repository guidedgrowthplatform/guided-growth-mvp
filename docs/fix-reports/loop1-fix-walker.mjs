// Loop 1 B4-fix verifier (no-write, auth-free preview route). Two modes:
//   node loop1-fix-walker.mjs <origin> allowed [tag] — autoplay allowed: walk the chain
//     from ?startAt=why-intro asserting >=1 'playing' event per MP3 beat BEFORE advancing.
//   node loop1-fix-walker.mjs <origin> blocked [tag] — default autoplay policy: land on
//     why-intro with no user activation (reload after the gate), assert the beat HOLDS
//     (no advance, no playing) until a trusted tap, then plays to the end and advances.
// Evidence: /tmp/gg-verify/loop1-fix-<mode>[-<tag>].{json,png}
import fs from 'fs';
import { launch, wirePage, probe, clickButton, sleep } from './harness.mjs';

const origin = process.argv[2];
const mode = process.argv[3] ?? 'allowed';
const tag = process.argv[4] ?? '';
const suffix = `${mode}${tag ? '-' + tag : ''}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const out = { origin, mode, checks: [], playLog: [], beats: [], events: [] };
let failures = 0;
function check(name, ok, detail) {
  out.checks.push({ name, ok: !!ok, detail: detail ?? '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
}

const MP3S = [
  'ONBOARD-WHY-INTRO.mp3', 'ONBOARD-STATE-CHECK.mp3', 'ONBOARD-MORNING-SETUP.mp3',
  'ONBOARD-BEGINNER-07.mp3', 'ONBOARD-FORK--FORM.mp3', 'ONBOARD-BEGINNER-01.mp3',
  'ONBOARD-BEGINNER-02.mp3', 'ONBOARD-BEGINNER-03.mp3', 'ONBOARD-BEGINNER-04.mp3',
  'ONBOARD-ADVANCED.mp3', 'ONBOARD-ADVANCED-FREQUENCY.mp3', 'ONBOARD-COMPLETE.mp3',
  'ONBOARD-WEEKLY-PROJECTION-BLANK.mp3', 'ONBOARD-WEEKLY-PROJECTION-FULL.mp3',
  'ONBOARD-WEEKLY-PROJECTION-P78.mp3', 'ONBOARD-WEEKLY-PROJECTION-P36.mp3',
  'ONBOARD-WEEKLY-PROJECTION-GAPS.mp3',
];
const isOnboardClip = (s) => MP3S.includes(s);
const MP3_TO_BEAT = {
  'ONBOARD-WHY-INTRO.mp3': 'why-intro', 'ONBOARD-STATE-CHECK.mp3': 'state-check',
  'ONBOARD-MORNING-SETUP.mp3': 'morning-setup', 'ONBOARD-BEGINNER-07.mp3': 'reflection-setup',
  'ONBOARD-FORK--FORM.mp3': 'path-fork', 'ONBOARD-BEGINNER-01.mp3': 'category',
  'ONBOARD-BEGINNER-02.mp3': 'goals', 'ONBOARD-BEGINNER-03.mp3': 'habit-select',
  'ONBOARD-BEGINNER-04.mp3': 'habit-schedule', 'ONBOARD-ADVANCED.mp3': 'advanced-input',
  'ONBOARD-ADVANCED-FREQUENCY.mp3': 'advanced-frequency', 'ONBOARD-COMPLETE.mp3': 'into-app',
  'ONBOARD-WEEKLY-PROJECTION-BLANK.mp3': 'weekly', 'ONBOARD-WEEKLY-PROJECTION-FULL.mp3': 'weekly',
  'ONBOARD-WEEKLY-PROJECTION-P78.mp3': 'weekly', 'ONBOARD-WEEKLY-PROJECTION-P36.mp3': 'weekly',
  'ONBOARD-WEEKLY-PROJECTION-GAPS.mp3': 'weekly',
};

const { browser, context } = await launch({ autoplayAllowed: mode === 'allowed' });
const page = await context.newPage();
const status = wirePage(page, `loop1-fix-${suffix}`);
const playLog = async () => (await probe(page)).playLog;
const hasEvt = (l, clip, evt) => l.some((e) => e.src === clip && e.outcome === evt);
async function waitFor(fn, ms, step = 500) {
  const until = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() >= until) return null;
    await sleep(step);
  }
}
const clickCta = (name) => clickButton(page, `^${name}$`);

// ---- the human-ish actor (adapted from walk-flow.mjs, preview subset) ----
async function act(p, beat) {
  if (p.buttons.some((b) => /^Get started$/.test(b.text))) {
    await clickButton(page, '^Get started$');
    return 'gate';
  }
  if (beat === 'state-check') {
    const n = await page.evaluate(() => {
      const vis = (el) => !!(el.offsetParent || el.getClientRects().length);
      const rows = [...document.querySelectorAll('div.flex.w-full.justify-between')].filter(vis);
      let clicked = 0;
      for (const row of rows) {
        const opts = [...row.querySelectorAll('button')].filter(vis);
        const target = opts[3] ?? opts[opts.length - 1];
        if (target) { target.click(); clicked++; }
      }
      return clicked;
    });
    if (n > 0) {
      await sleep(900);
      await clickCta('Continue');
      return `state-check x${n}`;
    }
    return null;
  }
  if (beat === 'path-fork') {
    if (!(await clickButton(page, 'new to habit tracking'))) return null;
    await sleep(900);
    await clickCta('Continue');
    return 'fork simple';
  }
  if (beat === 'advanced-input' || /Tell me everything on your mind/i.test(p.text)) {
    const typed = await page.evaluate(() => {
      const ta = [...document.querySelectorAll('textarea')].find((t) => t.offsetParent);
      if (!ta) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, 'I meditate every morning. I want to add daily guitar practice.');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    });
    if (typed) {
      await sleep(900);
      await clickCta('Continue');
      return 'brain dump';
    }
  }
  for (const cta of ['Continue', 'Next', 'Looks good', 'Start my plan', "Let's go", 'Save', 'Done']) {
    if (await clickCta(cta)) return `CTA ${cta}`;
  }
  const hasDisabledContinue = p.buttons.some((b) => /^Continue$/.test(b.text) && b.disabled);
  if (hasDisabledContinue || ['category', 'goals', 'habit-select'].includes(beat)) {
    const picked = await page.evaluate(() => {
      const vis = (el) => !!(el.offsetParent || el.getClientRects().length);
      const EXCLUDE = /Continue|Next|Looks good|Start my plan|Let's go|Save|Done|Allow|Not now|Skip|QA|Vapi|Tanstack|Sign out|Switch|Mute|Back|Select your age|^\d+$|^(Male|Female|Other)$/i;
      const btns = [...document.querySelectorAll('button')].filter((b) => {
        if (!vis(b) || b.disabled) return false;
        return !EXCLUDE.test((b.textContent || '').trim()) && !EXCLUDE.test(b.getAttribute('aria-label') || '') && ((b.textContent || '').trim() || b.getAttribute('aria-label'));
      });
      const labels = [];
      for (const b of btns.slice(-10)) {
        if (labels.length >= 2) break;
        b.click();
        labels.push((b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30));
      }
      return labels;
    });
    if (picked.length) {
      await sleep(900);
      await clickCta('Continue');
      return `picked ${JSON.stringify(picked)}`;
    }
  }
  return null;
}

const url = `${origin}/onboarding-flow-preview?startAt=why-intro`;
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await sleep(2500);

if (mode === 'blocked') {
  // Phase 1: pass the gate with a TRUSTED click (the intro-seen flag is set on
  // splash completion), let the splash finish, then reload: the fresh document
  // has zero user activation — the "refresh lands on a beat" shape that B4's
  // autoplay facet describes.
  await page.locator('button', { hasText: 'Get started' }).first().click();
  const splashDone = await waitFor(async () => {
    const l = await playLog();
    return hasEvt(l, 'splash_welcome.mp3', 'ended') || l.some((e) => e.src === 'ONBOARD-WHY-INTRO.mp3');
  }, 30000, 800);
  if (!splashDone) log('WARN: splash never finished in phase 1');
  await sleep(1000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const gateGone = !(await probe(page)).buttons.some((b) => /^Get started$/.test(b.text));
  check('blocked: intro gate skipped after reload (scenario valid)', gateGone, '');
  const mark = (await playLog()).length;

  await sleep(8000); // hands-off hold window (< the 12s reveal safety)
  let l = (await playLog()).slice(mark);
  const p1 = await probe(page);
  check('blocked: no playing events while hands-off', !l.some((e) => e.outcome === 'playing'),
    JSON.stringify(l.filter((e) => e.outcome === 'playing').map((e) => e.src)));
  check('blocked: why-intro not settled-as-done (no ended)', !hasEvt(l, 'ONBOARD-WHY-INTRO.mp3', 'ended'), '');
  const advanced = /how are you landing in this moment|sleep quality/i.test(p1.text) || l.some((e) => e.src === 'ONBOARD-STATE-CHECK.mp3');
  check('blocked: beat HOLDS hands-off (state-check not reached)', !advanced, `tail=${JSON.stringify(p1.text.slice(-160))}`);

  await page.mouse.click(210, 500); // trusted tap = the unlock gesture
  const played = await waitFor(async () => hasEvt((await playLog()).slice(mark), 'ONBOARD-WHY-INTRO.mp3', 'playing'), 6000);
  check('blocked: trusted tap starts why-intro playback', !!played, '');
  const endedAdv = await waitFor(async () => {
    const ll = (await playLog()).slice(mark);
    const t = (await probe(page)).text;
    return hasEvt(ll, 'ONBOARD-WHY-INTRO.mp3', 'ended') && /how are you landing in this moment|sleep quality/i.test(t);
  }, 40000, 1000);
  check('blocked: after tap, clip plays to end and beat advances', !!endedAdv, '');
  out.playLog = (await playLog()).slice(mark);
} else {
  await clickButton(page, '^Get started$');
  const verified = []; // clips with playing+ended confirmed, in order
  let lastBeat = '';
  let stuck = 0;

  for (let step = 0; step < 70; step++) {
    await sleep(2500);
    const l = await playLog();
    const attempted = [...new Set(l.filter((e) => isOnboardClip(e.src)).map((e) => e.src))];
    const current = attempted[attempted.length - 1] ?? null;
    const beat = current ? MP3_TO_BEAT[current] : 'pre-flow';
    if (beat !== lastBeat) { out.events.push({ step, beat, clip: current }); log('BEAT', beat, current ?? ''); lastBeat = beat; stuck = 0; } else stuck++;

    if (current && !verified.includes(current)) {
      const playing = await waitFor(async () => hasEvt(await playLog(), current, 'playing'), 12000);
      check(`allowed: ${current} PLAYING before advance`, !!playing, '');
      const ended = await waitFor(async () => hasEvt(await playLog(), current, 'ended'), 60000, 800);
      check(`allowed: ${current} played to end`, !!ended, '');
      verified.push(current);
      if (!playing || !ended) break;
      continue; // re-probe fresh state before acting
    }

    const p = await probe(page);
    if (/WEEKLY-PROJECTION-GAPS/.test((verified[verified.length - 1] ?? '')) || /You.re in|final/i.test(p.text)) { log('flow tail reached'); break; }
    if (beat === 'into-app' && verified.includes('ONBOARD-COMPLETE.mp3')) {
      await clickButton(page, "^Let's go$").catch(() => {});
      // keep walking: the weekly projection beats may follow into-app in this flow
    }
    const did = await act(p, beat);
    if (did) { out.events.push({ step, act: did }); log('ACT', did); stuck = 0; }
    else {
      await page.mouse.click(210, 300).catch(() => {});
      if (stuck > 14) { log('WEDGED on', beat); await page.screenshot({ path: `/tmp/gg-verify/loop1-fix-${suffix}-wedged.png` }); break; }
    }
  }

  const l = await playLog();
  out.playLog = l;
  out.beats = verified;
  // Global invariants.
  const endedNoPlay = [...new Set(l.filter((e) => isOnboardClip(e.src)).map((e) => e.src))]
    .filter((c) => hasEvt(l, c, 'ended') && !hasEvt(l, c, 'playing'));
  check('allowed: no clip ended without playing (no silent settle)', endedNoPlay.length === 0, JSON.stringify(endedNoPlay));
  // Ordering: each clip's first 'playing' precedes the NEXT clip's first attempt.
  let orderOk = true;
  const firstEvt = (clip, evt) => l.find((e) => e.src === clip && e.outcome === evt)?.t ?? null;
  const firstAny = (clip) => l.find((e) => e.src === clip)?.t ?? null;
  for (let i = 0; i + 1 < verified.length; i++) {
    const p0 = firstEvt(verified[i], 'playing');
    const n0 = firstAny(verified[i + 1]);
    if (p0 === null || n0 === null || p0 > n0) { orderOk = false; break; }
  }
  check('allowed: every beat PLAYED before the next beat armed', orderOk, JSON.stringify(verified));
  check('allowed: verified at least 6 MP3 beats', verified.length >= 6, `${verified.length} beats`);
  // Rejections that never recovered into playback = real failures.
  const rejectedNoPlay = [...new Set(l.filter((e) => isOnboardClip(e.src) && String(e.outcome).startsWith('rejected')).map((e) => e.src))]
    .filter((c) => !hasEvt(l, c, 'playing'));
  check('allowed: every rejected clip recovered to playing', rejectedNoPlay.length === 0, JSON.stringify(rejectedNoPlay));
}

await page.screenshot({ path: `/tmp/gg-verify/loop1-fix-${suffix}.png` });
status.dump(`loop1-fix-${suffix}-wire.json`);
fs.writeFileSync(`/tmp/gg-verify/loop1-fix-${suffix}.json`, JSON.stringify(out, null, 1));
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} — /tmp/gg-verify/loop1-fix-${suffix}.json`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
