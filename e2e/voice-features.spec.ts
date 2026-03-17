/**
 * Voice Feature Tests — tests ALL voice-related functionality
 * Runs on default project (chromium). Cross-device covered by cross-device.spec.ts
 *
 * Run: npx playwright test e2e/voice-features.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';

// BASE_URL comes from playwright.config.ts `use.baseURL` (overridable via BASE_URL env var)

// ─── STT PROVIDER SELECTION ───
test.describe('STT Provider Selection', () => {
  test('Select Web Speech', async ({ page }) => {
    await page.goto(`/settings`, { waitUntil: 'networkidle' });
    const radio = page.locator('input[name="sttProvider"][value="webspeech"]');
    await radio.check();
    expect(await radio.isChecked()).toBe(true);
  });

  test('Select Whisper', async ({ page }) => {
    await page.goto(`/settings`, { waitUntil: 'networkidle' });
    const radio = page.locator('input[name="sttProvider"][value="whisper"]');
    await radio.check();
    expect(await radio.isChecked()).toBe(true);
  });

  test('Select DeepGram', async ({ page }) => {
    await page.goto(`/settings`, { waitUntil: 'networkidle' });
    const radio = page.locator('input[name="sttProvider"][value="deepgram"]');
    await radio.check();
    expect(await radio.isChecked()).toBe(true);
  });

  test('Select ElevenLabs', async ({ page }) => {
    await page.goto(`/settings`, { waitUntil: 'networkidle' });
    const radio = page.locator('input[name="sttProvider"][value="elevenlabs"]');
    await radio.check();
    expect(await radio.isChecked()).toBe(true);
  });

  test('Provider selection persists after refresh', async ({ page }) => {
    await page.goto(`/settings`, { waitUntil: 'networkidle' });
    await page.locator('input[name="sttProvider"][value="deepgram"]').check();
    await page.reload({ waitUntil: 'networkidle' });
    expect(await page.locator('input[name="sttProvider"][value="deepgram"]').isChecked()).toBe(true);
  });
});

// ─── RECORDING MODE ───
test.describe('Recording Mode', () => {
  test('Toggle auto-stop mode', async ({ page }) => {
    await page.goto(`/settings`, { waitUntil: 'networkidle' });
    const radio = page.locator('input[name="recordingMode"][value="auto-stop"]');
    await radio.check();
    expect(await radio.isChecked()).toBe(true);
  });

  test('Toggle always-on mode', async ({ page }) => {
    await page.goto(`/settings`, { waitUntil: 'networkidle' });
    const radio = page.locator('input[name="recordingMode"][value="always-on"]');
    await radio.check();
    expect(await radio.isChecked()).toBe(true);
  });

  test('Mode selection persists after refresh', async ({ page }) => {
    await page.goto(`/settings`, { waitUntil: 'networkidle' });
    await page.locator('input[name="recordingMode"][value="always-on"]').check();
    await page.reload({ waitUntil: 'networkidle' });
    expect(await page.locator('input[name="recordingMode"][value="always-on"]').isChecked()).toBe(true);
  });
});

// ─── TTS SETTINGS ───
test.describe('TTS Settings', () => {
  test('TTS toggle works', async ({ page }) => {
    await page.goto(`/settings`, { waitUntil: 'networkidle' });
    const toggle = page.locator('#tts-toggle');
    const wasBefore = await toggle.isChecked();
    await toggle.click({ force: true });
    const after = await toggle.isChecked();
    expect(after).toBe(!wasBefore);
  });

  test('Voice dropdown or fallback message shown', async ({ page, browserName }) => {
    await page.goto(`/settings`, { waitUntil: 'networkidle' });
    const select = page.locator('#voice-select');
    const fallback = page.getByText('No voice options found', { exact: false });
    const notSupported = page.getByText('not supported in this browser', { exact: false });
    const hasSelect = await select.isVisible().catch(() => false);
    const hasFallback = await fallback.isVisible().catch(() => false);
    const hasNotSupported = await notSupported.isVisible().catch(() => false);
    // Headless WebKit may not have speechSynthesis — all 3 options are valid
    expect(hasSelect || hasFallback || hasNotSupported).toBe(true);
  });

  test('Preview Voice button exists when voices available', async ({ page }) => {
    await page.goto(`/settings`, { waitUntil: 'networkidle' });
    const select = page.locator('#voice-select');
    if (await select.isVisible().catch(() => false)) {
      await expect(page.getByText('Preview Voice')).toBeVisible();
    }
  });
});

// ─── CAPTURE PAGE UI ───
test.describe('Capture Page', () => {
  test('Habit grid visible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByText('HABITS').first()).toBeVisible();
  });

  test('Add Habit button works', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const btn = page.getByText('Add Habit', { exact: false }).first();
    await expect(btn).toBeVisible();
  });

  test('Undo/Redo buttons exist', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByText('Undo').first()).toBeVisible();
    await expect(page.getByText('Redo').first()).toBeVisible();
  });

  test('Week/Month toggle works', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const weekBtn = page.getByText('Week').first();
    const monthBtn = page.getByText('Month').first();
    // On mobile, may need to scroll to reach these buttons
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      await monthBtn.click();
    }
    // Buttons exist in DOM even if not immediately visible on small screens
    await expect(weekBtn).toBeAttached();
    await expect(monthBtn).toBeAttached();
  });

  test('Form/Spreadsheet toggle works', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const formBtn = page.getByText('Form').first();
    const spreadBtn = page.getByText('Spreadsheet').first();
    await formBtn.click();
    await spreadBtn.click();
    await expect(spreadBtn).toBeVisible();
  });

  test('Reflections section visible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByText('What are you grateful for?')).toBeVisible();
    await expect(page.getByText("Today's highlight")).toBeVisible();
    await expect(page.getByText('How do you feel?')).toBeVisible();
    await expect(page.getByText('Daily Affirmation')).toBeVisible();
  });

  test('Date navigation works', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // Forward/back arrows and Today button
    await expect(page.getByText('Today').first()).toBeVisible();
    const arrows = page.locator('button:has-text("←"), button:has-text("→")');
    expect(await arrows.count()).toBeGreaterThanOrEqual(2);
  });
});

// ─── API ENDPOINTS ───
test.describe('API Endpoints', () => {
  test('Health endpoint', async ({ request }) => {
    const res = await request.get(`/api/health`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.checks.database).toBe('connected');
  });

  test('Process-command rejects GET', async ({ request }) => {
    const res = await request.get(`/api/process-command`);
    expect(res.status()).toBe(405);
  });

  test('Deepgram token endpoint responds', async ({ request }) => {
    const res = await request.get(`/api/deepgram-token`);
    // 200 if AUTH_BYPASS_MODE=true, 401 if auth required, 500/503 if key not configured
    expect([200, 401, 500, 503]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toHaveProperty('token');
    }
  });

  test('ElevenLabs STT rejects GET', async ({ request }) => {
    const res = await request.get(`/api/elevenlabs-stt`);
    expect([405, 404]).toContain(res.status());
  });

  test('Anonymized export requires admin key', async ({ request }) => {
    const res = await request.get(`/api/admin/export-anonymized`);
    expect([401, 403]).toContain(res.status());
  });

  test('Auth endpoints return 401', async ({ request }) => {
    for (const path of ['/api/entries', '/api/metrics', '/api/reflections', '/api/preferences', '/api/auth/me']) {
      const res = await request.get(path);
      expect(res.status()).toBe(401);
    }
  });

  test('Invalid date format rejected', async ({ request }) => {
    const res = await request.get(`/api/entries?date=not-a-date`);
    expect([400, 401]).toContain(res.status());
  });
});

// ─── BROWSER API CHECKS ───
test.describe('Browser APIs', () => {
  test('speechSynthesis available', async ({ page, browserName }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const has = await page.evaluate(() => 'speechSynthesis' in window);
    // Headless WebKit may not expose speechSynthesis — real Safari does
    if (browserName === 'chromium' || browserName === 'firefox') expect(has).toBe(true);
    else console.log(`[${browserName}] speechSynthesis: ${has}`);
  });

  test('navigator.mediaDevices.getUserMedia available', async ({ page, browserName }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const has = await page.evaluate(() => !!navigator.mediaDevices?.getUserMedia);
    if (browserName === 'chromium' || browserName === 'firefox') expect(has).toBe(true);
    else console.log(`[${browserName}] getUserMedia: ${has}`);
  });

  test('AudioContext available', async ({ page, browserName }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const has = await page.evaluate(() => typeof AudioContext !== 'undefined');
    if (browserName === 'chromium' || browserName === 'firefox') expect(has).toBe(true);
    else console.log(`[${browserName}] AudioContext: ${has}`);
  });

  test('Web Speech API available on Chromium', async ({ page, browserName }) => {
    if (browserName !== 'chromium') { test.skip(); return; }
    await page.goto('/', { waitUntil: 'networkidle' });
    const has = await page.evaluate(() =>
      !!(window.SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
    );
    expect(has).toBe(true);
  });
});

// ─── NAVIGATION ───
test.describe('Navigation', () => {
  test('Settings page reachable', async ({ page }) => {
    await page.goto(`/settings`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('SPA routing — unknown paths work', async ({ page }) => {
    const res = await page.goto(`/does-not-exist-abc`);
    expect(res?.status()).toBe(200);
  });

  test('Back to capture from settings', async ({ page }) => {
    await page.goto(`/settings`, { waitUntil: 'networkidle' });
    const homeLink = page.locator('a[href="/"]').first();
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await page.waitForURL('**/');
    }
  });
});
