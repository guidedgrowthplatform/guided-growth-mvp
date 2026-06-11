// Session trace viewer (dev tool, read-only).
//
// Stitches the data that's already recorded into one readable page: the text
// conversation + tools (chat_messages), per-turn latency/tokens (session_log),
// and recent voice calls (Vapi). The console trace is for live web debugging;
// this is for reading sessions after the fact, including app/native ones.
//
// Run:  set -a && . ./.env.local && set +a && node scripts/session-viewer.mjs [chat_session_id]
// Then: open session-viewer.html  (defaults to the most recent text session)
//
// Needs DATABASE_URL and VAPI_PRIVATE_KEY in the environment (.env.local).

import pg from 'pg';
import { writeFileSync } from 'node:fs';

const esc = (s) =>
  String(s ?? '').replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
const short = (s, n = 90) => {
  const t = String(s ?? '');
  return t.length > n ? t.slice(0, n) + '…' : t;
};

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// Recent text sessions
const sessions = (
  await client.query(`
    SELECT chat_session_id, count(*)::int AS turns, max(created_at) AS last,
           (array_agg(screen_id ORDER BY turn_index DESC))[1] AS screen
    FROM chat_messages
    GROUP BY chat_session_id
    ORDER BY last DESC
    LIMIT 20`)
).rows;

const target = process.argv[2] || sessions[0]?.chat_session_id;

const msgs = target
  ? (
      await client.query(
        `SELECT turn_index, role, content, tool_name, tool_calls, screen_id, created_at
         FROM chat_messages WHERE chat_session_id = $1 ORDER BY turn_index`,
        [target],
      )
    ).rows
  : [];

// Per-turn latency/tokens (most recent across sessions; session_log is keyed by
// the app session_id, not chat_session_id, so this is a recent-activity panel).
const perf = (
  await client.query(`
    SELECT screen_id, payload, timestamp
    FROM session_log
    WHERE event_type = 'llm_call' AND payload->>'phase' = 'end'
    ORDER BY timestamp DESC LIMIT 30`)
).rows.map((r) => ({ screen: r.screen_id, ts: r.timestamp, ...r.payload }));

await client.end();

// Recent voice calls (Vapi)
let voice = [];
try {
  const res = await fetch('https://api.vapi.ai/call?limit=12', {
    headers: { Authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}` },
  });
  const calls = await res.json();
  voice = (Array.isArray(calls) ? calls : []).map((c) => {
    const cb = c.costBreakdown || {};
    const pt = cb.llmPromptTokens || 0;
    const ct = cb.llmCachedPromptTokens || 0;
    return {
      id: String(c.id || '').slice(0, 8),
      ended: c.endedReason,
      cost: c.cost,
      cachePct: pt ? Math.round((100 * ct) / pt) : 0,
      promptTokens: pt,
    };
  });
} catch (e) {
  voice = [{ id: 'error', ended: String(e), cost: 0, cachePct: 0, promptTokens: 0 }];
}

// Build the conversation: collapse tool result rows onto the message before them.
const convo = [];
for (const m of msgs) {
  if (m.role === 'tool') {
    let ok = null;
    try {
      ok = JSON.parse(m.content || '{}').ok;
    } catch {
      /* ignore */
    }
    convo.push({ kind: 'toolresult', name: m.tool_name, ok, raw: short(m.content, 160) });
    continue;
  }
  const calls = Array.isArray(m.tool_calls) ? m.tool_calls : [];
  convo.push({
    kind: m.role,
    text: m.content || '',
    tools: calls.map((c) => ({
      name: c.function?.name ?? c.name,
      args: short(c.function?.arguments ?? JSON.stringify(c.args ?? {}), 120),
    })),
  });
}

const sessRows = sessions
  .map(
    (s) =>
      `<tr class="${s.chat_session_id === target ? 'sel' : ''}"><td><code>${String(
        s.chat_session_id,
      ).slice(0, 8)}</code></td><td>${s.turns}</td><td>${esc(s.screen)}</td><td>${new Date(
        s.last,
      ).toLocaleString()}</td></tr>`,
  )
  .join('');

const convoHtml = convo
  .map((c) => {
    if (c.kind === 'toolresult')
      return `<div class="row tr"><span class="tag ${c.ok ? 'ok' : 'bad'}">tool result · ${esc(
        c.name,
      )} · ${c.ok ? 'ok' : 'fail'}</span><span class="snip">${esc(c.raw)}</span></div>`;
    const tools = c.tools
      .map((t) => `<span class="tag tool">→ ${esc(t.name)} <span class="args">${esc(t.args)}</span></span>`)
      .join('');
    return `<div class="row ${c.kind}"><div class="who">${c.kind}</div><div class="msg">${esc(
      c.text,
    )}${tools ? `<div class="tools">${tools}</div>` : ''}</div></div>`;
  })
  .join('');

const perfRows = perf
  .map(
    (p) =>
      `<tr><td>${esc(p.screen)}</td><td>${p.latency_ms ?? ''}ms</td><td>${
        p.total_tokens ?? ''
      }</td><td>${p.tool_rounds ?? ''}</td><td class="${p.status === 'ok' ? '' : 'bad'}">${esc(
        p.status,
      )}</td></tr>`,
  )
  .join('');

const voiceRows = voice
  .map(
    (v) =>
      `<tr><td><code>${esc(v.id)}</code></td><td>$${v.cost ?? 0}</td><td>${v.cachePct}%</td><td>${
        v.promptTokens
      }</td><td>${esc(v.ended)}</td></tr>`,
  )
  .join('');

const html = `<!doctype html><meta charset="utf-8"><title>GG Session Viewer</title>
<style>
  body{font:14px/1.5 system-ui,sans-serif;margin:0;background:#0f1115;color:#e6e6e6}
  h1{font-size:18px;margin:0} h2{font-size:14px;color:#9aa0a6;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.5px}
  .wrap{max-width:920px;margin:0 auto;padding:24px}
  table{width:100%;border-collapse:collapse;font-size:13px} td,th{padding:6px 10px;border-bottom:1px solid #232732;text-align:left}
  tr.sel{background:#1a2230} code{color:#7fb3ff}
  .row{display:flex;gap:10px;margin:6px 0;align-items:flex-start}
  .who{width:74px;flex:0 0 74px;color:#9aa0a6;text-transform:uppercase;font-size:11px;padding-top:8px}
  .msg{background:#171a21;border:1px solid #232732;border-radius:10px;padding:8px 12px;flex:1}
  .row.user .msg{background:#15233a} .row.assistant .msg{background:#171a21}
  .tools{margin-top:6px;display:flex;flex-wrap:wrap;gap:6px}
  .tag{font-size:11px;padding:2px 8px;border-radius:999px;display:inline-block}
  .tag.tool{background:#26314a;color:#9ec1ff} .tag.ok{background:#16341f;color:#7fdca0} .tag.bad{background:#3a1d1d;color:#f0a0a0}
  .args{color:#8aa0c0} .tr{padding-left:84px;color:#9aa0a6} .snip{font-size:12px;color:#8a909a}
  .bad{color:#f0a0a0}
</style>
<div class="wrap">
  <h1>GG Session Viewer</h1>
  <p style="color:#9aa0a6;margin:4px 0 0">Reads what's already recorded: text conversations (chat_messages), per-turn latency/tokens (session_log), and voice calls (Vapi). Read-only.</p>

  <h2>Recent text sessions</h2>
  <table><tr><th>session</th><th>turns</th><th>screen</th><th>last</th></tr>${sessRows}</table>
  <p style="color:#9aa0a6;font-size:12px">Showing session <code>${esc(
    String(target).slice(0, 8),
  )}</code>. Run with a session id to pick another.</p>

  <h2>Conversation (${convo.filter((c) => c.kind !== 'toolresult').length} turns)</h2>
  ${convoHtml || '<p style="color:#9aa0a6">No messages.</p>'}

  <h2>Recent turn performance (latency / tokens)</h2>
  <table><tr><th>screen</th><th>latency</th><th>tokens</th><th>rounds</th><th>status</th></tr>${perfRows}</table>

  <h2>Recent voice calls (Vapi)</h2>
  <table><tr><th>call</th><th>cost</th><th>cache hit</th><th>prompt tokens</th><th>ended</th></tr>${voiceRows}</table>
</div>`;

writeFileSync('session-viewer.html', html);
console.log(
  `Wrote session-viewer.html — ${sessions.length} sessions, ${convo.length} messages, ${perf.length} perf rows, ${voice.length} voice calls.`,
);
console.log(`Showing session: ${String(target).slice(0, 8)}`);
