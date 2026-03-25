import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  // Global timeout per test
  timeout: 90000,

  // Assertion timeout
  expect: { timeout: 15000 },

  // Do NOT run tests in parallel — we share auth state across tests
  fullyParallel: false,
  workers: 1,

  // Retry flaky tests up to 2 times (per task requirement)
  retries: 2,

  // Verbose reporter so every step is visible in CI
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
  ],

  // Artifacts on failure
  use: {
    // Default to production target for journey tests
    baseURL: 'https://guided-growth-mvp-six.vercel.app',

    // iPhone viewport (matches Figma design)
    viewport: { width: 390, height: 844 },

    // Capture trace on first retry for debugging
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',

    // Slower actions so the mobile UI has time to react
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    // Primary: Chrome (matches --channel=chrome requirement)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        // Override viewport to mobile
        viewport: { width: 390, height: 844 },
        // User-agent stays desktop Chrome but viewport is mobile — matches Figma iPhone design
        isMobile: false,
        hasTouch: true,
      },
    },

    // Secondary: true iPhone simulation (for reference)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['iPhone 14'],
        channel: 'chrome',
      },
    },
  ],

  // Output directories
  outputDir: 'test-results/',
});
