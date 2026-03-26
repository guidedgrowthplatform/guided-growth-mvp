import { test } from '@playwright/test';

const BASE = 'https://guided-growth-mvp-six.vercel.app';
const TS = Date.now();
const EMAIL = `quicktest${TS}@test.com`;
const PASS = 'QuickTest123!';

test.use({ viewport: { width: 390, height: 844 } });

test('Full journey: signup → beginner onboarding → home → features', async ({ page }) => {
  test.setTimeout(300000);
  const shots: string[] = [];
  const snap = async (name: string) => {
    const p = `e2e/screenshots/quick/${name}.png`;
    await page.screenshot({ path: p }).catch(() => {});
    shots.push(name);
  };

  // 1. SIGNUP
  await page.goto(`${BASE}/signup`);
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"], input[placeholder*="Email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await snap('01-signup-filled');
  await page.click('button:has-text("Sign Up")');
  await page.waitForTimeout(3000);
  await snap('02-after-signup');
  console.log('After signup URL:', page.url());

  // 2. LOGIN (signup redirects to login)
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[placeholder*="Email"]', EMAIL);
    await page.fill('input[type="password"]', PASS);
    await page.click('button:has-text("Log In")');
    await page.waitForTimeout(3000);
  }
  await snap('03-after-login');
  console.log('After login URL:', page.url());

  // 3. ONBOARDING (should redirect here for new user)
  if (page.url().includes('/onboarding')) {
    // Step 1
    await page.fill('input[placeholder*="nickname" i]', 'QuickTester');
    await page.click('button:has-text("21 - 25")').catch(() => page.getByText('21 - 25').click());
    await page.click('button:has-text("Male")').catch(() => page.getByText('Male').click());
    await snap('04-step1');
    await page.click('button:has-text("Let\'s Begin")');
    await page.waitForTimeout(2000);
    await snap('05-step2');
    console.log('Step 2 URL:', page.url());

    // Step 2 - Keep it simple
    await page
      .click('text=Keep it simple')
      .catch(() => page.locator('button', { hasText: 'Keep it simple' }).click());
    await page.waitForTimeout(500);
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(2000);
    await snap('06-step3');
    console.log('Step 3 URL:', page.url());

    // Step 3 - Category selection (click first option)
    const categoryBtn = page
      .locator('button[class*="cursor-pointer"], div[class*="cursor-pointer"]')
      .first();
    if (await categoryBtn.isVisible()) await categoryBtn.click();
    await page.waitForTimeout(500);
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(2000);
    await snap('07-step4');
    console.log('Step 4 URL:', page.url());

    // Step 4 - Goal selection (click first option)
    const goalBtn = page
      .locator('button[class*="cursor-pointer"], div[class*="cursor-pointer"]')
      .first();
    if (await goalBtn.isVisible()) await goalBtn.click();
    await page.waitForTimeout(500);
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(2000);
    await snap('08-step5');
    console.log('Step 5 URL:', page.url());

    // Step 5 - Habit selection (just continue)
    await page.click('button:has-text("Continue")').catch(() => {});
    await page.waitForTimeout(2000);
    await snap('09-step6');
    console.log('Step 6 URL:', page.url());

    // Step 6 - Reflection config (just continue)
    const reviewBtn = page
      .locator('button:has-text("Review"), button:has-text("Continue")')
      .first();
    if (await reviewBtn.isVisible()) await reviewBtn.click();
    await page.waitForTimeout(2000);
    await snap('10-step7');
    console.log('Step 7 URL:', page.url());

    // Step 7 - Start plan
    const startBtn = page.locator('button:has-text("Start")').first();
    if (await startBtn.isVisible()) await startBtn.click();
    await page.waitForTimeout(3000);
    await snap('11-after-onboarding');
    console.log('After onboarding URL:', page.url());
  }

  // 4. HOME PAGE
  if (!page.url().includes('/home')) {
    await page.goto(`${BASE}/home`);
    await page.waitForTimeout(3000);
  }
  await snap('12-home');
  console.log('Home URL:', page.url());

  // Check-in
  const checkInBtn = page.locator('button:has-text("Check In")').first();
  if (await checkInBtn.isVisible()) {
    await checkInBtn.click();
    await page.waitForTimeout(1000);
    await snap('13-checkin-open');
    // Click first emoji in each row
    const emojiBtns = page.locator('button[class*="rounded-full"][class*="items-center"]');
    for (let i = 0; i < Math.min(4, await emojiBtns.count()); i++) {
      await emojiBtns
        .nth(i)
        .click()
        .catch(() => {});
    }
    await snap('14-checkin-selected');
    await page.click('button:has-text("Check In")').catch(() => {});
    await page.waitForTimeout(2000);
    await snap('15-checkin-saved');
  }

  // Journal
  const journalBtn = page.locator('button:has-text("Open Journal")').first();
  if (await journalBtn.isVisible()) {
    await journalBtn.click();
    await page.waitForTimeout(1000);
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible()) {
      await textarea.fill('Testing journal entry from automated test');
      await snap('16-journal-filled');
    }
  }

  // 5. BOTTOM NAV
  // Progress
  await page.click('text=Progress').catch(() => page.goto(`${BASE}/report`));
  await page.waitForTimeout(2000);
  await snap('17-progress');

  // Focus
  await page.click('text=Focus').catch(() => page.goto(`${BASE}/focus`));
  await page.waitForTimeout(2000);
  await snap('18-focus');

  // Profile/Settings
  await page.click('text=Profile').catch(() => page.goto(`${BASE}/settings`));
  await page.waitForTimeout(2000);
  await snap('19-settings');

  // Home
  await page.click('text=Home').catch(() => page.goto(`${BASE}/home`));
  await page.waitForTimeout(2000);

  // 6. VOICE OVERLAY
  const micBtn = page.locator('button[class*="rounded-full"][class*="bg-gradient"]').first();
  if (await micBtn.isVisible()) {
    await micBtn.click();
    await page.waitForTimeout(2000);
    await snap('20-voice-overlay');
    // Close
    await page
      .locator('button:has(svg), [class*="close"]')
      .first()
      .click()
      .catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(1000);
  }

  // 7. HABITS
  await page.goto(`${BASE}/habits`);
  await page.waitForTimeout(2000);
  await snap('21-habits');

  // 8. LOGOUT + RE-LOGIN
  await page.goto(`${BASE}/settings`);
  await page.waitForTimeout(2000);
  const deleteBtn = page.locator('button:has-text("Delete"), button:has-text("Sign Out")').last();
  if (await deleteBtn.isVisible()) {
    // Don't actually delete, just verify button exists
    await snap('22-settings-actions');
  }

  console.log('\n=== ALL SCREENSHOTS ===');
  shots.forEach((s) => console.log(' -', s));
  console.log(`\nTotal: ${shots.length} screenshots`);
  console.log('Test email:', EMAIL);
});
