import { test, expect } from '@playwright/test';
import type { ConsoleMessage } from '@playwright/test';
import { BASE } from './config';

// QA-only smoke. Refuses to run against anything but the QA host so it can
// never accidentally target prod. Login-free (Phase 1); the authenticated
// journey is added in Phase 2 once the universal-login endpoint exists.
const QA_HOST = /^https:\/\/guided-growth-qa\.vercel\.app/;

// Unlock Vercel Deployment Protection (Password Protection) for automation.
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
if (bypass) {
  test.use({
    extraHTTPHeaders: {
      'x-vercel-protection-bypass': bypass,
      'x-vercel-set-bypass-cookie': 'true',
    },
  });
}

test.beforeAll(() => {
  if (!QA_HOST.test(BASE)) {
    throw new Error(`qa-smoke must target the QA host; got BASE=${BASE}. Set E2E_BASE_URL.`);
  }
});

function trackConsole(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e: Error) => errors.push(e.message));
  return errors;
}

// Same expected-noise allowlist as smoke-test.spec.ts.
function critical(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !e.includes('supabase') &&
      !e.includes('SUPABASE') &&
      !e.includes('AuthApiError') &&
      !e.includes('Failed to fetch'),
  );
}

test.describe('QA smoke', () => {
  test('QA banner is visible (proves staging surface is live)', async ({ page }) => {
    const errors = trackConsole(page);
    await page.goto(`${BASE}/login`);
    await expect(page.getByText(/STAGING \/ QA/)).toBeVisible({ timeout: 15000 });
    expect(critical(errors)).toHaveLength(0);
  });

  test('Login page renders', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('h1')).toContainText('Welcome Back', { timeout: 15000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Protected route redirects to login', async ({ page }) => {
    await page.goto(`${BASE}/home`);
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
