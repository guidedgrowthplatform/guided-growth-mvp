import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/**
 * Standalone build for the chat-native onboarding FlowDesigner.
 * Compiles the REAL app components into a hostable static page, served at
 * /onboarding-flow/ on the marketing site. Keeps the app's root so postcss /
 * tailwind / the @ alias all resolve; publicDir is off (the onboarding images
 * are copied to the site root separately).
 */
const APP = __dirname;

export default defineConfig({
  base: '/onboarding-flow/',
  publicDir: false,
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
});
