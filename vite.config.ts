import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Vite plugin: local ElevenLabs TTS proxy.
 * Intercepts POST /api/elevenlabs-tts and proxies to ElevenLabs API server-side.
 * This avoids CORS and keeps the API key private.
 */
function elevenLabsTtsPlugin(apiKey: string): Plugin {
  return {
    name: 'openai-tts-proxy',
    configureServer(server) {
      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.url !== '/api/elevenlabs-tts' || req.method !== 'POST') {
            next();
            return;
          }

          let body = '';
          for await (const chunk of req) body += chunk;

          try {
            const { text, voice_id } = JSON.parse(body);
            // Map ElevenLabs voice IDs to OpenAI voices
            const VOICE_MAP: Record<string, string> = {
              pNInz6obpgDQGcFmaJgB: 'onyx',
              EXAVITQu4vr4xnSDxMaL: 'nova',
            };
            const openaiVoice = VOICE_MAP[voice_id] || 'nova';

            console.log(
              `[vite-tts] OpenAI TTS: "${text.substring(0, 50)}..." → voice ${openaiVoice}`,
            );

            const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: 'tts-1',
                input: text,
                voice: openaiVoice,
                response_format: 'mp3',
              }),
            });

            if (!openaiRes.ok) {
              const errText = await openaiRes.text();
              console.error('[vite-tts] OpenAI error:', openaiRes.status, errText);
              res.writeHead(openaiRes.status, { 'Content-Type': 'application/json' });
              res.end(errText);
              return;
            }

            // Stream audio through to client for faster first-byte
            res.writeHead(200, {
              'Content-Type': 'audio/mpeg',
              'Transfer-Encoding': 'chunked',
            });
            const reader = openaiRes.body?.getReader();
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
            console.log(`[vite-tts] Streamed audio: ${totalBytes} bytes`);
            res.end();
          } catch (err) {
            console.error('[vite-tts] Error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'TTS proxy failed' }));
          }
        },
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://localhost:3000';
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
            mixpanel: ['mixpanel-browser'],
          },
        },
      },
    },
    plugins: [
      // OpenAI TTS proxy (ElevenLabs blocked on this IP)
      elevenLabsTtsPlugin(env.OPENAI_API_KEY || ''),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, './packages/shared/src'),
      },
    },
    server: {
      port: parseInt(env.PORT || '5173'),
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          // Skip proxy for elevenlabs-tts (handled by plugin middleware)
          bypass(req: { url?: string }) {
            if (req.url?.startsWith('/api/elevenlabs-tts')) return req.url;
          },
        },
        '/auth': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'cobertura'],
        include: ['src/**/*.{ts,tsx}', 'api/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
      },
    },
  };
});
