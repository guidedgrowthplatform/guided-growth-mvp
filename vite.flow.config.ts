import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/**
 * Standalone build for the chat-native onboarding FlowDesigner.
 * Compiles the REAL app components into a hostable static page, served at
 * /onboarding-flow/ on the marketing site. Keeps the app's root so postcss /
 * tailwind / the @ alias all resolve.
 *
 * publicDir: bundle the app's public/ in BOTH dev and the build, so the category
 * images (/images/onboarding/*) render. The build is now served standalone at the
 * clean root (localhost:7333) with no marketing site behind it to supply those
 * images, so they have to ship inside the build.
 */
const APP = __dirname;

export default defineConfig(() => ({
  base: '/onboarding-flow/',
  publicDir: path.resolve(APP, 'public'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(APP, 'src'),
      '@gg/shared': path.resolve(APP, 'packages/shared/src'),
    },
  },
  build: {
    outDir: path.resolve(APP, 'dist-flow'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(APP, 'flow-standalone/index.html'),
    },
  },
}));
