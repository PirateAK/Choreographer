// Header view button smoke test: while Top-down fills the centre, the button offers Elevation, and back again.
// Requires the running app and external Playwright.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${process.env.APP_PORT || 3001}`);
  await page.evaluate(() => localStorage.removeItem('choreographer.view.v1'));
  await page.reload();
  await page.waitForSelector('#btnTopDown');

  const label = () => page.locator('#btnTopDown').innerText();
  assert.equal((await label()).trim(), 'Top-down');
  await page.click('#btnTopDown');
  assert.equal((await label()).trim(), 'Elevation');
  assert.ok(await page.evaluate(() => document.body.classList.contains('fill-plan')));

  await page.click('#btnTopDown');
  assert.equal((await label()).trim(), 'Top-down');
  assert.ok(await page.evaluate(() => document.body.classList.contains('fill-elev')));

  await page.click('#btnTopDown');
  assert.equal((await label()).trim(), 'Elevation');
  assert.deepEqual(errors, []);
  console.log('browser top-down label: Top-down ⇄ Elevation switching passed');
} finally { await browser.close(); }
