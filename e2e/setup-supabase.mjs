import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const SUPABASE_PROJECT = process.env.SUPABASE_PROJECT || 'yqnppwsbedpeebffmaev';
const sql = readFileSync('supabase/migrations/002_api_tables.sql', 'utf-8');

async function main() {
  console.log('Launching Chrome... Please log in to Supabase when the browser opens.');

  // Use OS temp directory instead of hardcoded path
  const userDataDir = join(tmpdir(), 'pw-supabase-v3');

  const context = await chromium.launchPersistentContext(
    userDataDir,
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
    console.log('  PLEASE LOG IN NOW IN THE BROWSER!');
    console.log('  Waiting up to 10 minutes...');
    console.log('========================================\n');

    try {
      await page.waitForURL('**/project/**', { timeout: 600000 });
      console.log('Login successful!');
      await page.waitForTimeout(2000);

      // Navigate to SQL editor
      console.log('Opening SQL Editor...');
      await page.goto(
        `https://supabase.com/dashboard/project/${SUPABASE_PROJECT}/sql/new`,
        { waitUntil: 'domcontentloaded', timeout: 60000 }
      );
      await page.waitForTimeout(5000);
    } catch {
      console.log('Timeout — closing browser.');
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
    console.log('\nDONE! Check the result in the browser. Close when ready.');
  } else {
    console.log('Editor not found automatically.');
    console.log('SQL is in your clipboard — paste with Ctrl+V in the editor, then Ctrl+Enter to run.');
  }

  // Keep open for user
  await page.waitForTimeout(300000);
  await context.close();
}

main().catch(console.error);
