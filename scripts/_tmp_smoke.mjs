import { chromium } from 'playwright';
const BASE='http://localhost:5174';
const errors=[];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));

// 1) Annotated
await page.goto(BASE, { waitUntil:'networkidle' });
await page.waitForTimeout(1200);
const hasScript = await page.getByText(/^Script \(/).first().isVisible().catch(()=>false);
const hasCtx = await page.getByText('Coach behavior context').first().isVisible().catch(()=>false);
const hasToggle = await page.getByText('Show expected user response under each coach line').first().isVisible().catch(()=>false);
// count phones (beat rows)
const beatRows = await page.locator('[data-beat-id]').count();
console.log('ANNOTATED: scriptPanel=%s coachCtx=%s expectedUserToggle=%s beatRows=%s', hasScript, hasCtx, hasToggle, beatRows);

// toggle expectedUser
await page.getByText('Show expected user response under each coach line').first().click().catch(()=>{});
await page.waitForTimeout(300);

// 2) Play - mute + step through all beats
await page.goto(BASE+'#play', { waitUntil:'networkidle' });
await page.waitForTimeout(800);
// mute voice so it runs fast
await page.getByText('Mute voice').first().click().catch(()=>{});
await page.getByText('Autoplay').first().click().catch(()=>{});
await page.waitForTimeout(200);
// read counter "N / M"
async function counter(){ const t = await page.locator('text=/\\d+ \\/ \\d+ ·/').first().textContent().catch(()=>null); return t; }
let start = await counter();
console.log('PLAY start counter:', start);
// click Next through all beats
const total = 25;
let lastCounter=start;
for (let i=0;i<total-1;i++){
  await page.getByRole('button', { name: /Next/ }).click();
  await page.waitForTimeout(180);
  lastCounter = await counter();
}
console.log('PLAY end counter:', lastCounter);
// verify the last beat rendered a phone with content
const phoneVisible = await page.locator('div', { hasText:'Coach' }).first().isVisible().catch(()=>false);
console.log('PLAY last phone visible:', phoneVisible);

console.log('CONSOLE ERRORS:', errors.length);
for(const e of errors.slice(0,20)) console.log('  -', e);
await browser.close();
process.exit(errors.length ? 2 : 0);
