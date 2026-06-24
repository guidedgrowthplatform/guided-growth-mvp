import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Dev-only endpoint that lets each beat have its own "Ask AI" box.
 *
 * The builder posts { type, prompt, engine } to /__beat-ai. We resolve the ONE
 * beat file whose BeatDef has that `type`, then run the AI headless (Codex by
 * default, which uses the ChatGPT login and costs no metered credits; Claude
 * optional) on exactly that file. The AI edits the file in place, Vite's HMR
 * picks up the change, and the beat re-renders live in the canvas.
 *
 * Handing the AI the exact path (instead of making it search) keeps a one-line
 * edit at ~20s instead of minutes. Only runs in `serve` (local dev); it never
 * ships in the static build, so the deployed site has no AI endpoint.
 */
export function beatAiPlugin(appRoot: string): Plugin {
  const beatsDir = path.join(appRoot, 'src/components/flow-designer/beats');

  // Find the beat file whose default-exported BeatDef declares this type.
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

        if (req.method !== 'POST') {
          json(405, { ok: false, error: 'POST only' });
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
          // Relative path keeps the prompt short and the edit scoped.
          const relPath = found
            ? `src/components/flow-designer/beats/${found}`
            : null;

          const target = relPath
            ? `Edit ONLY this one file: ${relPath} (a beat with type '${type}').`
            : `No beat file has type '${type}' yet. Copy src/components/flow-designer/beats/_TEMPLATE.tsx to a new beat file in that folder, set its BeatDef type to '${type}', and build it. Edit only that one new file.`;

          const instruction = [
            'You edit ONE onboarding beat in a React flow builder. Touch only the file below.',
            target,
            'A beat returns <BeatPlayer steps={steps} /> from beatKit. Each step is one of:',
            "  { speaker:'coach', say:'...' }            white bubble the coach speaks",
            "  { speaker:'coach', say:'...', render:<X/> } speaks AND reveals a component",
            "  { speaker:'coach', render:<X/> }           a component only, no voice",
            "  { speaker:'user', say:'...' }              blue bubble the user answers in",
            'Read editable copy from props (e.g. props?.greeting). To reveal a real component, import it from @/components/... If you need an example, beats/profile.tsx is the worked one.',
            'Keep the default-exported BeatDef valid and the file compiling. No em dashes in any user-facing copy. Do not edit FlowBuilder.tsx, beatKit.tsx, index.ts, or any other beat file.',
            '',
            `Change to make: ${prompt}`,
          ].join('\n');

          // Opus is the one engine. Codex stays reachable only if a request
          // explicitly asks for it; the UI never does.
          const useClaude = engine !== 'codex';
          const cmd = useClaude ? 'claude' : 'codex';
          const claudeModel = 'opus';
          // --setting-sources project skips the huge user-level CLAUDE.md (the
          // second brain), which a scoped beat edit does not need and which alone
          // added ~80s of startup. With MCP off too, claude -p drops from ~110s to
          // ~20s. The instruction below carries everything the edit needs.
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

          let out = '';
          let done = false;
          const finish = (code: number | null, errPrefix?: string) => {
            if (done) return;
            done = true;
            // Strip ANSI color codes so the box shows clean text.
            // eslint-disable-next-line no-control-regex
            const clean = out.replace(/\u001b\[[0-9;]*m/g, '');
            const tail = clean.trim().split('\n').slice(-6).join('\n').slice(-700);
            const ok = code === 0 && !errPrefix;
            json(200, {
              ok,
              engine: cmd,
              file: relPath ?? '(new file)',
              summary: ok ? tail || 'Updated. The beat reloads automatically.' : undefined,
              error: ok ? undefined : `${errPrefix ?? ''}${tail || `exited ${code}`}`,
            });
          };

          // Strip ANTHROPIC_API_KEY / AUTH_TOKEN so `claude -p` uses the OAuth Max
          // subscription instead of an API key billed to the (empty) metered pool.
          // Otherwise it fails with "Credit balance is too low".
          const childEnv = { ...process.env };
          delete childEnv.ANTHROPIC_API_KEY;
          delete childEnv.ANTHROPIC_AUTH_TOKEN;

          // stdin: 'ignore' is critical. codex exec reads piped stdin and appends
          // it as a <stdin> block, so an open stdin pipe makes it hang waiting for
          // EOF. Giving it no stdin lets it run on the prompt arg alone (~20s).
          const child = spawn(cmd, args, {
            cwd: appRoot,
            env: childEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          const killer = setTimeout(() => {
            child.kill('SIGTERM');
            finish(null, 'timed out after 4 min. ');
          }, 240_000);

          child.stdout.on('data', (d) => (out += d.toString()));
          child.stderr.on('data', (d) => (out += d.toString()));
          child.on('error', (err) => {
            clearTimeout(killer);
            finish(null, `${cmd} failed to start: ${err.message}. `);
          });
          child.on('close', (code) => {
            clearTimeout(killer);
            finish(code);
          });
        });
      });
    },
  };
}
