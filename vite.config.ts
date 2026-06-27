import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Vite plugin: local Cartesia TTS proxy.
 * Intercepts POST /api/cartesia-tts and proxies to Cartesia API server-side.
 * Primary TTS provider in both dev and production.
 */
function cartesiaTtsPlugin(apiKey: string): Plugin {
  return {
    name: 'cartesia-tts-proxy',
    configureServer(server) {
      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.url !== '/api/cartesia-tts' || req.method !== 'POST') {
            next();
            return;
          }

          if (!apiKey) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'CARTESIA_API_KEY not set', fallback: true }));
            return;
          }

          let body = '';
          for await (const chunk of req) body += chunk;

          try {
            const { text, voice_id, format } = JSON.parse(body);

            // Coach Yair cloned voice fallback
            const resolvedVoiceId = voice_id || '0a974815-0e4d-4dfc-b478-37a7b943da70';

            console.log(
              `[vite-tts] Cartesia TTS: "${text.substring(0, 50)}..." → voice ${resolvedVoiceId}`,
            );

            const cartesiaRes = await fetch('https://api.cartesia.ai/tts/bytes', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Cartesia-Version': '2026-03-01',
              },
              body: JSON.stringify({
                model_id: 'sonic-3',
                transcript: text,
                voice: { mode: 'id', id: resolvedVoiceId },
                output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 24000 },
                language: 'en',
                generation_config: { speed: 1, emotion: 'neutral' },
              }),
            });

            if (!cartesiaRes.ok) {
              const errText = await cartesiaRes.text();
              console.error('[vite-tts] Cartesia error:', cartesiaRes.status, errText);
              res.writeHead(cartesiaRes.status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Cartesia TTS error', fallback: true }));
              return;
            }

            // native lane: CapacitorHttp corrupts binary, base64-in-JSON survives
            if (format === 'base64') {
              const buf = Buffer.from(await cartesiaRes.arrayBuffer());
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ audio: buf.toString('base64') }));
              return;
            }

            // Stream audio through to client
            res.writeHead(200, {
              'Content-Type': 'audio/mpeg',
              'Transfer-Encoding': 'chunked',
            });
            const reader = cartesiaRes.body?.getReader();
            if (!reader) {
              res.end();
              return;
            }
            let totalBytes = 0;
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              totalBytes += value.length;
              res.write(Buffer.from(value));
            }
            console.log(`[vite-tts] Cartesia streamed: ${totalBytes} bytes`);
            res.end();
          } catch (err) {
            console.error('[vite-tts] Cartesia error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Cartesia TTS proxy failed', fallback: true }));
          }
        },
      );
    },
  };
}

/**
 * Vite plugin: local Soniox temp-key mint (dev only).
 * Intercepts POST /api/soniox-temp-key and mints a single-use realtime key
 * server-side, so the type-to-fill sim + voice-in can run on `npm run dev`
 * alone (no vercel dev, no login). Mirrors api/soniox-temp-key.ts minus auth.
 */
function sonioxTempKeyPlugin(apiKey: string): Plugin {
  return {
    name: 'soniox-temp-key-proxy',
    configureServer(server) {
      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.url !== '/api/soniox-temp-key' || req.method !== 'POST') {
            next();
            return;
          }
          if (!apiKey) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'SONIOX_API_KEY not set in .env.local' }));
            return;
          }
          try {
            const resp = await fetch('https://api.soniox.com/v1/auth/temporary-api-key', {
              method: 'POST',
              headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                usage_type: 'transcribe_websocket',
                expires_in_seconds: 300,
                single_use: true,
                max_session_duration_seconds: 3600,
              }),
            });
            if (!resp.ok) {
              console.error('[vite-soniox]', resp.status, await resp.text());
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'STT temp key failed' }));
              return;
            }
            const data = (await resp.json()) as { api_key?: string; expires_at?: string };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ apiKey: data.api_key, expiresAt: data.expires_at }));
          } catch (err) {
            console.error('[vite-soniox]', err);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'STT temp key failed' }));
          }
        },
      );
    },
  };
}

/**
 * Vite plugin: live brain-dump habit parse (dev only).
 * POST /api/sim-parse-habits { text } -> { habits: [{name, frequency, days?, time?}] }
 * via gpt-4o-mini forced function-calling. Mirrors api/_lib/llm/parseBrainDump.ts
 * so the sim can parse a spoken dump into structured habits per sentence.
 */
function simParseHabitsPlugin(openaiKey: string): Plugin {
  const INSTRUCTIONS = `Convert the user's free-text or voice "brain dump" into a list of concrete, trackable habits.
Rules:
- One habit per distinct intention the user expressed.
- NEVER invent habits the user did not mention. If nothing concrete is present, return an empty list.
- days: the specific weekdays (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday). Include days ONLY when the user gave concrete days or an unambiguous schedule:
  - "daily" / "every day" -> [0,1,2,3,4,5,6]
  - "weekdays" / "every weekday" -> [1,2,3,4,5]
  - "weekends" -> [0,6]
  - named days ("Monday and Thursday") -> those indices
  If the user said a vague count like "three times a week", "twice a week", "a few times", or "once a week" WITHOUT naming the days, OMIT days entirely (the user will pick which days). NEVER guess which days.
- Do NOT infer time of day.
- Keep habit names short and positive where natural.
Return the result by calling submit_parsed_habits.`;
  const TOOL = {
    type: 'function' as const,
    function: {
      name: 'submit_parsed_habits',
      description: 'Return the habits extracted from the user brain dump.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          habits: {
            type: 'array',
            maxItems: 50,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                days: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } },
              },
              required: ['name'],
            },
          },
        },
        required: ['habits'],
      },
    },
  };
  return {
    name: 'sim-parse-habits',
    configureServer(server) {
      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.url !== '/api/sim-parse-habits' || req.method !== 'POST') {
            next();
            return;
          }
          if (!openaiKey) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'OPENAI_API_KEY not set' }));
            return;
          }
          let body = '';
          for await (const chunk of req) body += chunk;
          let text = '';
          try {
            text = String((JSON.parse(body) as { text?: string }).text ?? '').slice(0, 5000);
          } catch {
            text = '';
          }
          if (!text.trim()) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ habits: [] }));
            return;
          }
          try {
            const r = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                temperature: 0.2,
                messages: [
                  { role: 'system', content: INSTRUCTIONS },
                  { role: 'user', content: text },
                ],
                tools: [TOOL],
                tool_choice: { type: 'function', function: { name: 'submit_parsed_habits' } },
              }),
            });
            const d = (await r.json()) as {
              choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
            };
            const args = d.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
            const habits = args ? (JSON.parse(args).habits ?? []) : [];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ habits }));
          } catch (err) {
            console.error('[vite-parse-habits]', err);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'parse failed', habits: [] }));
          }
        },
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Ignore VITE_API_URL when playing around locally with vercel dev running
  const apiTarget =
    env.VERCEL_ENV === 'production'
      ? env.VITE_API_URL || 'http://localhost:3000'
      : 'http://localhost:3000';
  console.log('[vite] API proxy target:', apiTarget);

  return {
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'query-vendor': ['@tanstack/react-query'],
            'ui-vendor': ['lucide-react', '@iconify/react'],
            'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
            supabase: ['@supabase/supabase-js'],
            sentry: ['@sentry/react'],
            posthog: ['posthog-js'],
          },
        },
      },
    },
    plugins: [
      // Cartesia TTS proxy (primary)
      cartesiaTtsPlugin(env.CARTESIA_API_KEY || ''),
      // Soniox temp-key mint (dev only) so voice-in runs on `npm run dev`
      sonioxTempKeyPlugin(env.SONIOX_API_KEY || ''),
      // Live brain-dump habit parse (dev only) for the sim
      simParseHabitsPlugin(env.OPENAI_API_KEY || ''),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        workbox: {
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,svg,png,webp,ico}'],
          // On version bump (chunk hashes change), wipe stale precache
          // entries. Without this, a prior install's service worker
          // happily serves 404s for the new chunk filenames and crashes
          // dynamic imports (saw this on APK v5 → v6 upgrade).
          cleanupOutdatedCaches: true,
          // Never serve index.html (the SPA navigateFallback) in place of a
          // missing /assets chunk. On Android (https://localhost) the SW
          // would return HTML for a .js request -> "Failed to fetch
          // dynamically imported module". 404 lets Suspense recover instead.
          navigateFallbackDenylist: [/^\/assets\//],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
              },
            },
            {
              // Supabase Storage voice-assets bucket — the Phase 1 MP3s
              // (splash_hook, pref_can_i_talk, mic_*, welcome_*). Without
              // this rule the SW intercepts the fetch, finds no precache
              // match, and the Audio element fails with DOMException
              // (observed on APK v6 signup → PREF-01 flow).
              urlPattern:
                /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/voice-assets\/.*\.mp3$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'voice-assets',
                expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@gg/shared': path.resolve(__dirname, './packages/shared/src'),
      },
    },
    server: {
      port: parseInt(env.PORT || '5173'),
      watch: {
        ignored: ['**/ios/**', '**/android/**'],
      },
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          // Skip proxy for TTS endpoints (handled by plugin middleware)
          bypass(req: { url?: string }) {
            if (req.url?.startsWith('/api/cartesia-tts')) return req.url;
          },
        },
        '/auth': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/ingest/static': {
          target: 'https://us-assets.i.posthog.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/ingest\/static/, '/static'),
        },
        '/ingest': {
          target: env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/ingest/, ''),
        },
      },
    },
    test: {
      environment: 'node',
      include: [
        'src/**/*.test.{ts,tsx}',
        'api/**/*.test.{ts,tsx}',
        'packages/shared/**/*.test.{ts,tsx}',
      ],
      setupFiles: ['./src/test/setup-storage.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'cobertura'],
        include: ['src/**/*.{ts,tsx}', 'api/**/*.{ts,tsx}', 'packages/shared/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'api/**/*.test.{ts,tsx}',
          'packages/shared/**/*.test.{ts,tsx}',
          'src/**/*.d.ts',
        ],
      },
    },
  };
});
