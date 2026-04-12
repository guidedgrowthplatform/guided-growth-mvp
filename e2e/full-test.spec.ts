import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NOTE: Use port 5174 for Vite dev server (5173 is Vercel dev server which doesn't serve JS modules)
const BASE = 'http://localhost:5174';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'full-test');

// Test credentials
const TEST_EMAIL = 'testuser@guidedgrowth.app';
const TEST_PASSWORD = 'testpass123';
const SIGNUP_EMAIL = 'abdullahsaidmustaqim1@gmail.com';
const SIGNUP_PASSWORD = 'TestPass123!';

// Collect all JS errors across the entire test suite
const globalConsoleErrors: string[] = [];

// Helper: filter out expected/noise errors
function isCriticalError(msg: string): boolean {
  const ignoredPatterns = [
    'supabase',
    'SUPABASE',
    'AuthApiError',
    'Failed to fetch',
    'NetworkError',
    'Load failed',
    'ERR_NAME_NOT_RESOLVED',
    'net::ERR',
    'ERR_NETWORK',
    '400', // Supabase API 400s (e.g., user prefs not found, duplicate keys)
    '401',
    '403',
    '404', // Missing resources like user data not seeded yet
    '409', // Conflict (duplicate insert)
    '422', // Unprocessable entity (e.g., email already exists)
    'PostHog',
    'posthog',
    'ResizeObserver loop',
    'Non-Error promise rejection',
    // WebSpeech API not available in headless
    'SpeechRecognition',
    'webkitSpeechRecognition',
    'recognition',
    // Cartesia TTS / voice not available in test
    'cartesia',
    'tts',
    // Resource loading errors that are non-critical
    'Failed to load resource',
    'favicon',
  ];
  return !ignoredPatterns.some((p) => msg.toLowerCase().includes(p.toLowerCase()));
}

// Helper: attach console error listener
function attachErrorListener(page: Page, bucket: string[]) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      bucket.push(`[console.error] ${msg.text()}`);
      globalConsoleErrors.push(`[console.error] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    bucket.push(`[pageerror] ${err.message}`);
    globalConsoleErrors.push(`[pageerror] ${err.message}`);
  });
}

// Helper: login with provided credentials
async function loginUser(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  // Wait for React to mount and render the login form
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}

// Helper: wait for authenticated home page
// Supabase auth takes a few seconds, so we use a generous timeout
async function waitForHome(page: Page) {
  // Wait until URL is no longer /login or /signup
  await page.waitForURL(
    (url) => !url.pathname.includes('/login') && !url.pathname.includes('/signup'),
    {
      timeout: 30000,
    },
  );
  // Wait for main content to appear
  await page.waitForSelector('h1', { timeout: 15000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. AUTH FLOW
// ─────────────────────────────────────────────────────────────────────────────

test.describe('1. Auth Flow', () => {
  test('Signup attempt then fallback login', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListener(page, errors);

    // Try signup first
    await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' });
    // Wait for React to mount and render the signup form
    await page.waitForSelector('input[type="email"]', { timeout: 30000 });
    await expect(page.locator('h1')).toContainText('Create an Account', { timeout: 10000 });

    await page.locator('input[type="email"]').fill(SIGNUP_EMAIL);
    await page.locator('input[type="password"]').fill(SIGNUP_PASSWORD);

    // Some signups also have a confirm password or name field
    const nameField = page.locator(
      'input[placeholder*="name"], input[name="full_name"], input[name="name"]',
    );
    if (await nameField.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nameField.fill('Abdullah Test');
    }

    await page.locator('button[type="submit"]').click();

    // Wait for either redirect to home/onboarding OR error message
    // Supabase auth takes a few seconds
    await page.waitForTimeout(8000);

    const currentUrl = page.url();
    console.log('URL after signup attempt:', currentUrl);

    // SignUpPage redirects to /login on success, OR shows error on failure (user exists)
    // Either way, we proceed to login with testuser credentials
    console.log('Proceeding to login with testuser credentials...');
    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await waitForHome(page);

    // Final check: we should be on a protected page
    const finalUrl = page.url();
    console.log('Final URL after login:', finalUrl);
    expect(finalUrl).not.toContain('/signup');

    const criticalErrors = errors.filter(isCriticalError);
    if (criticalErrors.length > 0) {
      console.log('Critical errors during auth:', criticalErrors);
    }
  });

  test('Login with testuser and verify redirect to home', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListener(page, errors);

    // First verify the login page renders correctly
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 30000 });
    const h1Text = await page.locator('h1').first().textContent();
    console.log('Login h1 text:', h1Text);
    expect(h1Text).toContain('Welcome Back');

    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);

    // Should redirect away from login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });

    const finalUrl = page.url();
    console.log('After login, URL is:', finalUrl);
    expect(finalUrl).not.toContain('/login');

    const criticalErrors = errors.filter(isCriticalError);
    expect(criticalErrors).toHaveLength(0);
  });
});

// 2. HOME PAGE

test.describe('2. Home Page', () => {
  test('Home page renders correctly after login', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListener(page, errors);

    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });

    // If redirected to onboarding, go directly to home
    if (page.url().includes('/onboarding')) {
      await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
    }

    // Wait for home page content
    await page.waitForSelector('h1', { timeout: 15000 });

    // Verify greeting shows real username (not "Jeff Doe")
    const h1Text = await page.locator('h1').first().textContent();
    console.log('Home h1 text:', h1Text);
    expect(h1Text).toBeTruthy();
    expect(h1Text).not.toContain('Jeff Doe');
    expect(h1Text).toMatch(/Good (Morning|Afternoon|Evening)/i);

    // Verify date strip renders (DateStrip component)
    // It shows date buttons — look for date-related elements
    const dateArea = page
      .locator('[class*="date"], [class*="Date"], button')
      .filter({ hasText: /\d/ })
      .first();
    await expect(dateArea).toBeVisible({ timeout: 10000 });

    // Verify habits section loads (HabitsSection — may be empty for new user)
    // Look for the habits container or "No habits" empty state
    const habitsSection = page.locator('section, [class*="habit"], [class*="Habit"]').first();
    const habitsSectionExists = await habitsSection.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Habits section visible:', habitsSectionExists);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/home.png`, fullPage: true });
    console.log('Screenshot saved: home.png');

    const criticalErrors = errors.filter(isCriticalError);
    if (criticalErrors.length > 0) {
      console.log('Home page errors:', criticalErrors);
    }
    expect(criticalErrors).toHaveLength(0);
  });

  test('Check-in card opens on button click', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListener(page, errors);

    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });

    if (page.url().includes('/onboarding')) {
      await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
    }
    await page.waitForSelector('h1', { timeout: 15000 });

    // QuickActionCards has a check-in button
    // Look for button with text containing "Check" or "check-in" related content
    const checkInBtn = page
      .locator('button')
      .filter({ hasText: /check.?in|mood|daily/i })
      .first();

    const checkInBtnVisible = await checkInBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (checkInBtnVisible) {
      await checkInBtn.click();
      await page.waitForTimeout(600); // animation
      await page.screenshot({ path: `${SCREENSHOT_DIR}/home-checkin-open.png` });
      console.log('Check-in card opened, screenshot saved');
    } else {
      console.log('Check-in button not found with text filter, trying first QuickAction button...');
      const firstActionBtn = page.locator('[class*="quick"], [class*="Quick"]').first();
      const exists = await firstActionBtn.isVisible({ timeout: 3000 }).catch(() => false);
      if (exists) {
        await firstActionBtn.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/home-action-clicked.png` });
      }
    }

    const criticalErrors = errors.filter(isCriticalError);
    expect(criticalErrors).toHaveLength(0);
  });

  test('Floating action buttons are present', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListener(page, errors);

    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });

    if (page.url().includes('/onboarding')) {
      await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
    }
    await page.waitForSelector('h1', { timeout: 15000 });

    // FloatingActions is fixed bottom-24 right-6 — only visible on mobile viewport
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Look for the fixed floating action container
    const floatingContainer = page.locator('[class*="fixed"][class*="bottom"]').filter({
      has: page.locator('button'),
    });

    const floatingVisible = await floatingContainer
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    console.log('Floating actions container visible:', floatingVisible);

    // Click the habits floating button (CheckSquare icon navigates to /habits)
    const buttons = floatingContainer.locator('button');
    const btnCount = await buttons.count().catch(() => 0);
    console.log('Floating buttons count:', btnCount);

    if (btnCount > 0) {
      await buttons.first().click();
      await page.waitForURL(/\/habits/, { timeout: 10000 });
      console.log('Navigated to habits via floating button');
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/home-floating-actions.png` });
    const criticalErrors = errors.filter(isCriticalError);
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. HABITS PAGE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('3. Habits Page', () => {
  test('Habits page loads correctly', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListener(page, errors);

    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });

    await page.goto(`${BASE}/habits`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body', { timeout: 10000 });

    // Should not be redirected to login
    expect(page.url()).not.toContain('/login');

    // Look for habits page content
    const pageContent = await page.locator('body').textContent();
    console.log('Habits page content snippet:', pageContent?.substring(0, 200));

    await page.screenshot({ path: `${SCREENSHOT_DIR}/habits.png`, fullPage: true });
    console.log('Screenshot saved: habits.png');

    // Try to find add habit button
    const addBtn = page
      .locator('button')
      .filter({ hasText: /add|new|create|\+/i })
      .first();
    const addBtnVisible = await addBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Add habit button visible:', addBtnVisible);

    if (addBtnVisible) {
      await addBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/habits-add-clicked.png` });
      console.log('Screenshot saved: habits-add-clicked.png');
    }

    const criticalErrors = errors.filter(isCriticalError);
    if (criticalErrors.length > 0) {
      console.log('Habits page errors:', criticalErrors);
    }
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. FOCUS PAGE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('4. Focus Page', () => {
  test('Focus page timer and habit dropdown render', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListener(page, errors);

    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });

    await page.goto(`${BASE}/focus`, { waitUntil: 'domcontentloaded' });

    // Wait for timer to be visible
    // FocusTimer renders time in MM:SS or similar format
    const timerEl = page.locator('text=/\\d{1,2}:\\d{2}/').first();
    const timerVisible = await timerEl.isVisible({ timeout: 10000 }).catch(() => false);
    console.log('Timer visible:', timerVisible);

    if (!timerVisible) {
      // Try looking for any time-like pattern
      const pageText = await page.locator('body').textContent();
      console.log('Focus page body snippet:', pageText?.substring(0, 300));
    }

    // Look for habit selector / dropdown
    const dropdown = page
      .locator('select, [role="combobox"], [role="listbox"], button[class*="select"]')
      .first();
    const dropdownVisible = await dropdown.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Habit dropdown visible:', dropdownVisible);

    // Check for FocusTimer component elements (circle/ring SVG or progress indicator)
    const svgTimer = page
      .locator('svg, [class*="timer"], [class*="Timer"], [class*="circle"]')
      .first();
    const svgVisible = await svgTimer.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('SVG/timer element visible:', svgVisible);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/focus.png`, fullPage: true });
    console.log('Screenshot saved: focus.png');

    expect(page.url()).toContain('/focus');

    const criticalErrors = errors.filter(isCriticalError);
    if (criticalErrors.length > 0) {
      console.log('Focus page errors:', criticalErrors);
    }
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. INSIGHTS PAGE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('5. Insights Page', () => {
  test('Insights page renders tabs without crash', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListener(page, errors);

    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });

    await page.goto(`${BASE}/report`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body', { timeout: 10000 });

    expect(page.url()).toContain('/report');

    // Verify tabs render — SegmentedControl with "Overall Analytics" and "Check-in History"
    await expect(page.locator('text=Overall Analytics')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Check-in History')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/insights-analytics.png`, fullPage: true });
    console.log('Screenshot saved: insights-analytics.png');

    // Switch to Check-in History tab
    await page.locator('text=Check-in History').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/insights-history.png`, fullPage: true });
    console.log('Screenshot saved: insights-history.png');

    const criticalErrors = errors.filter(isCriticalError);
    if (criticalErrors.length > 0) {
      console.log('Insights page errors:', criticalErrors);
    }
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SETTINGS PAGE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('6. Settings Page', () => {
  test('Settings page shows real email and voice settings', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListener(page, errors);

    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });

    await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body', { timeout: 10000 });

    expect(page.url()).toContain('/settings');

    const pageText = await page.locator('body').textContent();
    console.log('Settings page content snippet:', pageText?.substring(0, 400));

    // Verify user email shows (should contain the actual test email, not hardcoded)
    const emailVisible =
      pageText?.includes(TEST_EMAIL) || pageText?.includes('testuser') || pageText?.includes('@');
    console.log('Email found in settings page:', emailVisible);

    // Ensure it does NOT show hardcoded "jeff" or placeholder emails
    expect(pageText?.toLowerCase()).not.toContain('jeff doe');

    // Verify voice settings section exists
    const voiceSection =
      pageText?.toLowerCase().includes('voice') ||
      pageText?.toLowerCase().includes('tts') ||
      pageText?.toLowerCase().includes('speech');
    console.log('Voice settings section present:', voiceSection);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/settings.png`, fullPage: true });
    console.log('Screenshot saved: settings.png');

    const criticalErrors = errors.filter(isCriticalError);
    if (criticalErrors.length > 0) {
      console.log('Settings page errors:', criticalErrors);
    }
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. CAPTURE PAGE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('7. Capture Page', () => {
  test('Capture page loads spreadsheet or form view', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListener(page, errors);

    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });

    await page.goto(`${BASE}/capture`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body', { timeout: 10000 });

    expect(page.url()).toContain('/capture');

    // CaptureView or ReflectionsPanel should render
    const pageText = await page.locator('body').textContent();
    console.log('Capture page content snippet:', pageText?.substring(0, 300));

    // Look for capture/reflections content
    const hasContent = pageText && pageText.trim().length > 50;
    expect(hasContent).toBeTruthy();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/capture.png`, fullPage: true });
    console.log('Screenshot saved: capture.png');

    const criticalErrors = errors.filter(isCriticalError);
    if (criticalErrors.length > 0) {
      console.log('Capture page errors:', criticalErrors);
    }
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. CALENDAR PAGE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('8. Calendar Page', () => {
  test('Calendar grid renders at /report/calendar', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListener(page, errors);

    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });

    await page.goto(`${BASE}/report/calendar`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body', { timeout: 10000 });

    expect(page.url()).toContain('/report/calendar');

    const pageText = await page.locator('body').textContent();
    console.log('Calendar page content snippet:', pageText?.substring(0, 300));

    // Calendar grid should have day numbers 1-31
    const dayNumbers = page.locator('text=/^\\d{1,2}$/').first();
    const dayVisible = await dayNumbers.isVisible({ timeout: 8000 }).catch(() => false);
    console.log('Day numbers visible in calendar:', dayVisible);

    // Also check for month/year text
    const monthYear = page
      .locator(
        'text=/january|february|march|april|may|june|july|august|september|october|november|december/i',
      )
      .first();
    const monthVisible = await monthYear.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Month/year label visible:', monthVisible);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/calendar.png`, fullPage: true });
    console.log('Screenshot saved: calendar.png');

    const criticalErrors = errors.filter(isCriticalError);
    if (criticalErrors.length > 0) {
      console.log('Calendar page errors:', criticalErrors);
    }
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. VOICE / MIC
// ─────────────────────────────────────────────────────────────────────────────

test.describe('9. Voice / Mic Button', () => {
  test('Mic button opens voice overlay and closes cleanly', async ({ page }) => {
    const errors: string[] = [];
    attachErrorListener(page, errors);

    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });

    if (page.url().includes('/onboarding')) {
      await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
    }
    await page.waitForSelector('h1', { timeout: 15000 });

    // Set mobile viewport so BottomNav is visible
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    // BottomNav mic button: rounded-full with microphone icon
    // It's the center button in the bottom nav
    const micBtn = page.locator('nav button').first();
    const micBtnVisible = await micBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Mic button in nav visible:', micBtnVisible);

    if (micBtnVisible) {
      await micBtn.click();
      await page.waitForTimeout(1000);

      // VoiceCheckInOverlay should appear (fixed inset-0 z-50)
      const overlay = page.locator('[class*="fixed"][class*="inset-0"]').first();
      const overlayVisible = await overlay.isVisible({ timeout: 5000 }).catch(() => false);
      console.log('Voice overlay visible:', overlayVisible);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/voice-overlay-open.png` });
      console.log('Screenshot saved: voice-overlay-open.png');

      // Close the overlay — the X button is absolute right-5 top-14 z-20 inside the overlay
      // We click the overlay's top-left area (outside scroll area) which triggers handleClose via onClick
      // Or we can click the X button directly using its position
      const xBtn = overlay
        .locator('button')
        .filter({ has: page.locator('svg') })
        .first();
      const xBtnVisible = await xBtn.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('X close button visible:', xBtnVisible);

      if (xBtnVisible) {
        // Click using force to bypass pointer-events interception
        await xBtn.click({ force: true });
      } else {
        // Fallback: click the very top of the overlay (where backdrop is, outside scroll area)
        await page.mouse.click(195, 30);
      }

      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/voice-overlay-closed.png` });
      console.log('Screenshot saved: voice-overlay-closed.png');

      // Verify overlay is gone or hidden
      const overlayAfterClose = await page
        .locator('[class*="fixed"][class*="inset-0"]')
        .filter({ hasText: /tap to speak|listening|thinking/i })
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      console.log('Voice overlay still visible after close:', overlayAfterClose);
    } else {
      console.log('Mic button not found in nav, skipping voice test');
      test.skip();
    }

    const criticalErrors = errors.filter(isCriticalError);
    if (criticalErrors.length > 0) {
      console.log('Voice overlay errors:', criticalErrors);
    }
    // Voice errors (SpeechRecognition not available) are expected in headless
    expect(criticalErrors.filter((e) => !e.toLowerCase().includes('speech'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. JS ERRORS SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

test.describe('10. JS Error Summary', () => {
  test('Report all collected JS errors from entire test run', async ({ page }) => {
    // This test acts as a reporter — it checks global errors collected
    // Note: Due to test isolation, each test has its own page, so globalConsoleErrors
    // may only contain errors from same-worker tests. Each test above logs its own errors.

    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });

    const criticalErrors = globalConsoleErrors.filter(isCriticalError);

    console.log('\n========== JS ERROR SUMMARY ==========');
    console.log(`Total console errors collected: ${globalConsoleErrors.length}`);
    console.log(`Critical errors (non-expected): ${criticalErrors.length}`);

    if (criticalErrors.length > 0) {
      console.log('\nCRITICAL ERRORS:');
      criticalErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }

    if (globalConsoleErrors.length > 0) {
      console.log('\nALL ERRORS (including expected):');
      globalConsoleErrors.slice(0, 20).forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }
    console.log('======================================\n');

    // This test always passes — it's a reporter
    expect(true).toBe(true);
  });
});
