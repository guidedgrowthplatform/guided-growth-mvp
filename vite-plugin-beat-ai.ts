import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Dev-only endpoint that lets each beat have its own "Ask AI" box.
 *
 * The work runs as a BACKGROUND JOB so it survives the hot-reload that the AI's
 * own file edit triggers:
 *   POST /__beat-ai { type, prompt, engine } -> { jobId }   (returns at once)
 *   GET  /__beat-ai?jobId=<id>              -> { status, summary, error }
 * The spawned process keeps running regardless of the browser, and the box polls
 * the job by id, so a reload mid-build just reconnects instead of losing it.
 *
 * The AI is told to BUILD, never to ask questions, because the box is one-shot.
 *
 * Opus by default (engine 'claude' / 'claude-opus') on the OAuth Max subscription.
 * Only runs in `serve`; never ships in the static build.
 */
type Job = {
  status: 'running' | 'done' | 'error';
  summary?: string;
  error?: string;
  file: string;
  startedAt: number;
};

export function beatAiPlugin(appRoot: string): Plugin {
  const beatsDir = path.join(appRoot, 'src/components/flow-designer/beats');
  const jobs = new Map<string, Job>();
  let seq = 0;

  const resolveFile = (type: string): string | null => {
    let files: string[] = [];
    try {
      files = readdirSync(beatsDir).filter((f) => f.endsWith('.tsx') && !f.startsWith('_'));
    } catch {
      return null;
    }
    const re = new RegExp(`type:\\s*['"]${type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
    for (const f of files) {
      try {
        if (re.test(readFileSync(path.join(beatsDir, f), 'utf8'))) return f;
      } catch {
        /* skip unreadable */
      }
    }
    return null;
  };

  // Drop finished jobs after 15 min so the map cannot grow unbounded.
  const prune = (now: number) => {
    for (const [id, j] of jobs) {
      if (j.status !== 'running' && now - j.startedAt > 15 * 60_000) jobs.delete(id);
    }
  };

  return {
    name: 'beat-ai',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__beat-ai', (req, res) => {
        const json = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        const now = Date.now();
        prune(now);

        // Poll a job's status.
        if (req.method === 'GET') {
          const q = new URL(req.url ?? '', 'http://localhost').searchParams;
          const job = jobs.get(q.get('jobId') ?? '');
          if (!job) {
            json(404, { ok: false, status: 'gone', error: 'job not found' });
            return;
          }
          json(200, {
            ok: job.status !== 'error',
            status: job.status,
            summary: job.summary,
            error: job.error,
            file: job.file,
          });
          return;
        }

        if (req.method !== 'POST') {
          json(405, { ok: false, error: 'POST or GET only' });
          return;
        }

        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => {
          let parsed: { type?: string; prompt?: string; engine?: string } = {};
          try {
            parsed = JSON.parse(raw || '{}');
          } catch {
            json(400, { ok: false, error: 'bad json' });
            return;
          }
          const { type, prompt, engine } = parsed;
          if (!type || !prompt) {
            json(400, { ok: false, error: 'type and prompt required' });
            return;
          }

          const found = resolveFile(type);
          const relPath = found ? `src/components/flow-designer/beats/${found}` : null;

          const target = relPath
            ? `Edit ONLY this one file: ${relPath} (a beat with type '${type}').`
            : `No beat file has type '${type}' yet. Copy src/components/flow-designer/beats/_TEMPLATE.tsx to a new beat file in that folder, set its BeatDef type to '${type}', and build it. Edit only that one new file.`;

          const instruction = [
            'You edit ONE onboarding beat in a React flow builder. Touch only the file below.',
            target,
            'IMPORTANT: this is a one-shot headless edit. The user CANNOT reply to you. Do NOT ask any questions, do NOT request clarification, do NOT propose options. Make the most natural assumption and just implement it. If something is ambiguous, pick the most sensible choice and add one short note about what you assumed.',
            'A beat returns <BeatPlayer steps={steps} /> from beatKit. Each step is one of:',
            "  { speaker:'coach', say:'...' }            white bubble the coach speaks",
            "  { speaker:'coach', say:'...', render:<X/> } speaks AND reveals a component",
            "  { speaker:'coach', render:<X/> }           a component only, no voice",
            "  { speaker:'user', say:'...' }              blue bubble the user answers in",
            'Read editable copy from props (e.g. props?.greeting). To reveal a real component, import it from @/components/... If you need an example, beats/profile.tsx is the worked one.',
            'Keep the default-exported BeatDef valid and the file compiling. No em dashes in any user-facing copy. Do not edit FlowBuilder.tsx, beatKit.tsx, index.ts, or any other beat file.',
            'End with one or two sentences describing exactly what you changed.',
            '',
            `Change to make: ${prompt}`,
          ].join('\n');

          const useClaude = engine !== 'codex';
          const cmd = useClaude ? 'claude' : 'codex';
          const claudeModel = 'opus';
          const args = useClaude
            ? [
                '-p',
                instruction,
                '--permission-mode',
                'acceptEdits',
                '--model',
                claudeModel,
                '--setting-sources',
                'project',
                '--strict-mcp-config',
                '--mcp-config',
                '{"mcpServers":{}}',
                '--add-dir',
                appRoot,
              ]
            : ['exec', instruction, '--cd', appRoot, '--sandbox', 'workspace-write', '--skip-git-repo-check'];

          // Strip ANTHROPIC_API_KEY / AUTH_TOKEN so `claude -p` uses the OAuth Max
          // subscription instead of an API key billed to the (empty) metered pool.
          const childEnv = { ...process.env };
          delete childEnv.ANTHROPIC_API_KEY;
          delete childEnv.ANTHROPIC_AUTH_TOKEN;

          const jobId = `job_${now}_${++seq}`;
          jobs.set(jobId, { status: 'running', file: relPath ?? '(new file)', startedAt: now });
          // Return the id immediately; the box polls from here on.
          json(200, { ok: true, jobId, file: relPath ?? '(new file)' });

          // stdin: 'ignore' so codex exec does not hang waiting for piped stdin.
          const child = spawn(cmd, args, {
            cwd: appRoot,
            env: childEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let out = '';
          let settled = false;
          const settle = (code: number | null, errPrefix?: string) => {
            if (settled) return;
            settled = true;
            // eslint-disable-next-line no-control-regex
            const clean = out.replace(/\u001b\[[0-9;]*m/g, '');
            const tail = clean.trim().split('\n').slice(-6).join('\n').slice(-900);
            const job = jobs.get(jobId);
            if (!job) return;
            if (code === 0 && !errPrefix) {
              job.status = 'done';
              job.summary = tail || 'Updated. The beat reloads automatically.';
            } else {
              job.status = 'error';
              job.error = `${errPrefix ?? ''}${tail || `exited ${code}`}`;
            }
          };

          const killer = setTimeout(() => {
            child.kill('SIGTERM');
            settle(null, 'timed out after 4 min. ');
          }, 240_000);
          child.stdout.on('data', (d) => (out += d.toString()));
          child.stderr.on('data', (d) => (out += d.toString()));
          child.on('error', (err) => {
            clearTimeout(killer);
            settle(null, `${cmd} failed to start: ${err.message}. `);
          });
          child.on('close', (code) => {
            clearTimeout(killer);
            settle(code);
          });
        });
      });
    },
  };
}
