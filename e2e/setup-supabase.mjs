import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';

const SUPABASE_PROJECT = 'yqnppwsbedpeebffmaev';
const sql = readFileSync('supabase/migrations/002_api_tables.sql', 'utf-8');

async function main() {
  console.log('Launching Chrome... LOGIN KE SUPABASE BEGITU BROWSER MUNCUL!');

  const context = await chromium.launchPersistentContext(
    'C:\\Users\\abdul\\AppData\\Local\\Temp\\pw-supabase-v3',
    {
      headless: false,
      viewport: { width: 1400, height: 900 },
      args: ['--start-maximized'],
    }
  );

  const page = context.pages()[0] || await context.newPage();

  await page.goto(
    `https://supabase.com/dashboard/project/${SUPABASE_PROJECT}/sql/new`,
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );

  await page.waitForTimeout(3000);
  const url = page.url();
  console.log('URL:', url);

  if (url.includes('sign-in') || url.includes('sign-up') || url.includes('auth')) {
    console.log('\n========================================');
    console.log('  LOGIN SEKARANG DI BROWSER YANG MUNCUL!');
    console.log('  Menunggu max 10 menit...');
    console.log('========================================\n');

    try {
      await page.waitForURL('**/project/**', { timeout: 600000 });
      console.log('Login berhasil!');
      await page.waitForTimeout(2000);

      // Navigate to SQL editor
      console.log('Opening SQL Editor...');
      await page.goto(
        `https://supabase.com/dashboard/project/${SUPABASE_PROJECT}/sql/new`,
        { waitUntil: 'domcontentloaded', timeout: 60000 }
      );
      await page.waitForTimeout(5000);
    } catch {
      console.log('Timeout. Browser ditutup.');
      await context.close();
      return;
    }
  }

  console.log('SQL Editor loaded. Pasting migration...');

  // Copy SQL to clipboard via page context
  await page.evaluate((sqlText) => {
    navigator.clipboard.writeText(sqlText).catch(() => {});
  }, sql);

  // Try to find editor and paste
  await page.waitForTimeout(3000);

  const editorSelectors = [
    '.monaco-editor .view-lines',
    '.cm-editor .cm-content',
    '.cm-editor',
    '[role="textbox"]',
    '.monaco-editor textarea',
  ];

  let found = false;
  for (const sel of editorSelectors) {
    const el = page.locator(sel).first();
    if (await el.count() > 0) {
      console.log(`Editor found: ${sel}`);
      await el.click({ force: true });
      await page.waitForTimeout(500);
      await page.keyboard.press('Control+A');
      await page.waitForTimeout(200);
      await page.keyboard.press('Control+V');
      found = true;
      break;
    }
  }

  if (found) {
    console.log('SQL pasted! Running with Ctrl+Enter...');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(8000);

    // Screenshot result
    await page.screenshot({ path: 'e2e/screenshots/supabase-result.png', fullPage: true });
    console.log('Screenshot saved. Check e2e/screenshots/supabase-result.png');
    console.log('\nDONE! Cek result di browser. Tutup browser kalo udah OK.');
  } else {
    console.log('Editor ga ketemu otomatis.');
    console.log('SQL UDAH DI CLIPBOARD — tinggal Ctrl+V di editor, terus Ctrl+Enter');
  }

  // Keep open for user
  await page.waitForTimeout(300000);
  await context.close();
}

main().catch(console.error);
