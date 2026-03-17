import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: process.env.BASE_URL || 'https://guided-growth-mvp-six.vercel.app',
  },
  projects: [
    // ─── Desktop browsers ───
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'safari-desktop', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    // ─── Mobile devices ───
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
    { name: 'iphone-14-pro-max', use: { ...devices['iPhone 14 Pro Max'] } },
    { name: 'ipad-pro', use: { ...devices['iPad Pro 11'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'galaxy-s3', use: { ...devices['Galaxy S III'] } },
  ],
});
