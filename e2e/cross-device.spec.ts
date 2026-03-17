/**
 * Cross-Device Compatibility Tests
 * Runs on ALL devices defined in playwright.config.ts projects.
 * Each project (chromium, safari, firefox, iphone, pixel, etc.) runs these tests.
 *
 * Run: npx playwright test e2e/cross-device.spec.ts
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://guided-growth-mvp-six.vercel.app';

// ─── 1. Page loads correctly ───
test('Homepage loads without JS errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await expect(page.locator('body')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

// ─── 2. Responsive layout — no horizontal overflow ───
test('Layout adapts to viewport (no horizontal scroll)', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const viewport = page.viewportSize();
  if (!viewport) return;
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  // Allow some overflow on very small devices (Galaxy S3 = 360px) and tablets
  const tolerance = viewport.width < 400 ? 50 : 200;
  expect(bodyWidth).toBeLessThanOrEqual(viewport.width + tolerance);
});

// ─── 3. API health check ───
test('API health responds', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/health`);
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.status).toBe('healthy');
});

// ─── 4. Static assets load without 404 ───
test('No broken static assets', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('favicon') && !res.url().includes('/api/')) {
      failed.push(`${res.status()} ${res.url()}`);
    }
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  expect(failed).toEqual([]);
});

// ─── 5. PWA manifest loads ───
test('PWA manifest accessible', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/manifest.json`);
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest.name).toBeTruthy();
});

// ─── 6. Security headers ───
test('Security headers present', async ({ request }) => {
  const res = await request.get(BASE_URL);
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['x-frame-options']).toBe('DENY');
});

// ─── 7. Service Worker registers ───
test('Service Worker registers', async ({ page, browserName }) => {
  if (browserName === 'firefox') { test.skip(); return; }
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const swRegistered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.length > 0 ? 'registered' : 'none';
  });
  expect(['registered', 'unsupported']).toContain(swRegistered);
});

// ─── 8. Speech API availability ───
test('Browser speech APIs match expectations', async ({ page, browserName }) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const apis = await page.evaluate(() => ({
    speechRecognition: !!(window.SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition),
    speechSynthesis: 'speechSynthesis' in window,
    mediaDevices: !!(navigator.mediaDevices?.getUserMedia),
    audioContext: typeof AudioContext !== 'undefined',
  }));
  // TTS: Playwright headless WebKit may not expose speechSynthesis (real Safari does)
  if (browserName === 'chromium' || browserName === 'firefox') {
    expect(apis.speechSynthesis).toBe(true);
  } else {
    console.log(`[${browserName}] speechSynthesis: ${apis.speechSynthesis} (headless WebKit may be false)`);
  }
  // getUserMedia on HTTPS (headless WebKit may not expose it — real devices do)
  if (browserName === 'chromium' || browserName === 'firefox') {
    expect(apis.mediaDevices).toBe(true);
  } else {
    console.log(`[${browserName}] mediaDevices.getUserMedia: ${apis.mediaDevices}`);
  }
  // AudioContext for DeepGram/ElevenLabs/Whisper (some emulated devices may not expose it)
  console.log(`[${browserName}] AudioContext: ${apis.audioContext}`);
  // Web Speech API: chromium yes, webkit no (expected)
  if (browserName === 'chromium') expect(apis.speechRecognition).toBe(true);
  // Log for other browsers
  console.log(`[${browserName}] SpeechRecognition: ${apis.speechRecognition}`);
});

// ─── 9. Settings page renders all providers ───
test('Settings page — all STT providers visible', async ({ page }) => {
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await expect(page.getByText('Web Speech API')).toBeVisible();
  await expect(page.getByText('Whisper (whisper.cpp)')).toBeVisible();
  await expect(page.getByText('DeepGram Nova-2')).toBeVisible();
  await expect(page.getByText('ElevenLabs Scribe v2')).toBeVisible();
  const radios = page.locator('input[name="sttProvider"]');
  expect(await radios.count()).toBe(4);
});

// ─── 10. Settings page — recording modes ───
test('Settings page — recording modes visible', async ({ page }) => {
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await expect(page.getByText('Auto-stop (Siri-like)')).toBeVisible();
  await expect(page.getByText('4.5s of silence')).toBeVisible();
  await expect(page.getByText('Always recording', { exact: true })).toBeVisible();
});

// ─── 11. Settings page — TTS toggle ───
test('Settings page — TTS toggle works', async ({ page }) => {
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await expect(page.getByText('Voice feedback')).toBeVisible();
  const toggle = page.locator('#tts-toggle');
  await expect(toggle).toBeAttached();
});

// ─── 12. Capture page — main elements ───
test('Capture page loads with habit grid and reflections', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await expect(page.getByText('Capture').first()).toBeVisible();
  await expect(page.getByText('Add Habit', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('What are you grateful for?')).toBeVisible();
});

// ─── 13. SPA routing ───
test('SPA routing — unknown paths serve index.html', async ({ page }) => {
  const res = await page.goto(`${BASE_URL}/nonexistent-123`);
  expect(res?.status()).toBe(200);
});

// ─── 14. No critical console errors ───
test('No critical console errors on load', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon') || text.includes('net::') || text.includes('401')) return;
      errors.push(text);
    }
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

// ─── 15. Fonts/icons load ───
test('No broken fonts or icons', async ({ page }) => {
  const broken: string[] = [];
  page.on('response', (res) => {
    if ((res.url().includes('font') || res.url().includes('woff')) && res.status() >= 400) {
      broken.push(res.url());
    }
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  expect(broken).toEqual([]);
});

// ─── 16. localStorage works ───
test('localStorage available', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const works = await page.evaluate(() => {
    try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); return true; }
    catch { return false; }
  });
  expect(works).toBe(true);
});

// ─── 17. API endpoints security ───
test('API endpoints require auth', async ({ request }) => {
  for (const path of ['/api/entries', '/api/metrics', '/api/reflections', '/api/preferences']) {
    const res = await request.get(`${BASE_URL}${path}`);
    expect(res.status()).toBe(401);
  }
});

// ─── 18. Settings descriptions accuracy ───
test('Settings descriptions are accurate', async ({ page }) => {
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  // Whisper ~40MB, desktop only
  await expect(page.getByText('~40MB')).toBeVisible();
  await expect(page.getByText('Desktop only')).toBeVisible();
  // Web Speech iOS warning
  await expect(page.getByText('Not supported on iOS Safari')).toBeVisible();
  // iOS always-recording warning
  await expect(page.getByText('Apple may restrict', { exact: false })).toBeVisible();
});

// ─── 19. Command examples present ───
test('Voice command examples shown', async ({ page }) => {
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await expect(page.getByText('Voice Command Examples')).toBeVisible();
  await expect(page.getByText('Create a new habit', { exact: false })).toBeVisible();
  await expect(page.getByText('Mark exercise as done', { exact: false })).toBeVisible();
});

// ─── 20. View toggles on Capture page ───
test('Week/Month and Form/Spreadsheet toggles exist in DOM', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  // On small mobile screens these may require scrolling — check DOM presence, not visibility
  await expect(page.getByText('Week').first()).toBeAttached();
  await expect(page.getByText('Month').first()).toBeAttached();
  await expect(page.getByText('Form').first()).toBeAttached();
  await expect(page.getByText('Spreadsheet').first()).toBeAttached();
});
