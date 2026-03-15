import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'https://guided-growth-mvp-six.vercel.app',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
