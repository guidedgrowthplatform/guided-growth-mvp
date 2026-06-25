import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/**
 * Standalone build for the chat-native onboarding FlowDesigner.
 * Compiles the REAL app components into a hostable static page, served at
 * /onboarding-flow/ on the marketing site. Keeps the app's root so postcss /
 * tailwind / the @ alias all resolve.
 *
 * publicDir: in dev we serve the app's public/ so /images/onboarding/* render
 * in the preview. For the build it stays off, because the deployed marketing
 * site already serves those images from its own root (/images/onboarding/...),
 * so bundling the 8MB image folder into the build would just duplicate them.
 */
const APP = __dirname;

export default defineConfig(({ command }) => ({
  base: '/onboarding-flow/',
  publicDir: command === 'serve' ? path.resolve(APP, 'public') : false,
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
