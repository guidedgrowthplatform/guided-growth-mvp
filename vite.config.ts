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
            const { text, voice_id } = JSON.parse(body);

            // Default to Katie (warm female) if no voice ID provided
            const resolvedVoiceId = voice_id || 'f786b574-daa5-4673-aa0c-cbe3e8534c02';

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
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        workbox: {
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          // On version bump (chunk hashes change), wipe stale precache
          // entries. Without this, a prior install's service worker
          // happily serves 404s for the new chunk filenames and crashes
          // dynamic imports (saw this on APK v5 → v6 upgrade).
          cleanupOutdatedCaches: true,
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
