import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('Smoke Test - Public Pages Load', () => {
  test('Login page renders with form elements', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto(`${BASE}/login`);

    // Check heading
    await expect(page.locator('h1')).toContainText('Welcome Back', { timeout: 10000 });

    // Check Log In button exists
    await expect(page.locator('button[type="submit"]')).toContainText('Log In');

    // Check email and password inputs
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Check links
    await expect(page.locator('text=Forgot Password')).toBeVisible();
    await expect(page.locator('text=Sign Up')).toBeVisible();

    // Report JS errors
    if (consoleErrors.length > 0) {
      console.log('JS errors on /login:', consoleErrors);
    }
    // Allow Supabase auth errors (expected without real backend)
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('supabase') && !e.includes('SUPABASE') && !e.includes('AuthApiError'),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Signup page renders with form elements', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto(`${BASE}/signup`);

    // Check heading
    await expect(page.locator('h1')).toContainText('Create an Account', { timeout: 10000 });

    // Check Sign Up button
    await expect(page.locator('button[type="submit"]')).toContainText('Sign Up');

    // Check inputs
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Check link to login
    await expect(page.locator('text=Log In')).toBeVisible();

    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('supabase') && !e.includes('SUPABASE') && !e.includes('AuthApiError'),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Forgot password page renders', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto(`${BASE}/forgot-password`);

    await expect(page.locator('h1')).toContainText('Reset Password', { timeout: 10000 });
    await expect(page.locator('button[type="submit"]')).toContainText('Send Reset Link');
    await expect(page.locator('input[type="email"]')).toBeVisible();

    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('supabase') && !e.includes('SUPABASE') && !e.includes('AuthApiError'),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Smoke Test - Protected Pages Redirect to Login', () => {
  const protectedPaths = [
    '/',
    '/home',
    '/capture',
    '/configure',
    '/focus',
    '/report',
    '/habits',
    '/settings',
    '/onboarding',
    '/admin',
  ];

  for (const path of protectedPaths) {
    test(`${path} redirects to /login when unauthenticated`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => consoleErrors.push(err.message));

      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

      // Page should not be a white screen - login content should be visible
      await expect(page.locator('h1')).toContainText('Welcome Back');

      // Check for page crash errors (uncaught exceptions)
      const crashErrors = consoleErrors.filter(
        (e) =>
          !e.includes('supabase') &&
          !e.includes('SUPABASE') &&
          !e.includes('AuthApiError') &&
          !e.includes('Failed to fetch'),
      );

      if (crashErrors.length > 0) {
        console.log(`JS errors on ${path}:`, crashErrors);
      }
    });
  }
});

test.describe('Smoke Test - No White Screen', () => {
  test('Root page does not show blank body', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

    // The page should have actual content rendered (not empty)
    const bodyContent = await page.locator('body').innerText();
    expect(bodyContent.trim().length).toBeGreaterThan(0);
  });

  test('Non-existent route does not crash', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`${BASE}/this-route-does-not-exist`, { waitUntil: 'networkidle' });

    // Should redirect to login (catch-all goes to / which is protected)
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // No uncaught page errors
    expect(pageErrors).toHaveLength(0);
  });
});
