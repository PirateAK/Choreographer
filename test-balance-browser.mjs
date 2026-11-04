// School modal smoke test for provisional balance diagnostics. Requires the running app and external Playwright.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${process.env.APP_PORT || 3001}`);
  await page.waitForSelector('#btnSchool');
  await page.click('#btnSchool');
  await page.waitForSelector('#schoolSheet:not([hidden])');
  assert.match(await page.locator('#schoolBody').innerText(), /Balance settings below are provisional diagnostic assumptions only/);
  assert.match(await page.locator('#schoolBody').innerText(), /Chassé phase supports remain fixed by CHASSE_PHASES/);

  const support = page.getByLabel('Provisional diagnostic setting: Balance diagnostic support — tendu (PLACEHOLDER)');
  await support.selectOption('right');
  assert.equal(await page.evaluate(async () => (await import('/src/conventions.js')).conventionValue('balance.support.tendu')), 'right');
  await page.locator('tr').filter({ hasText: 'Balance diagnostic support — tendu' }).getByRole('button', { name: 'Reset' }).click();
  assert.equal(await page.evaluate(async () => (await import('/src/conventions.js')).conventionValue('balance.support.tendu')), 'left');

  const foot = page.getByLabel('Provisional diagnostic setting: Balance diagnostic foot length (PLACEHOLDER)');
  await foot.fill('0.2');
  await foot.dispatchEvent('change');
  assert.equal(await page.evaluate(async () => (await import('/src/conventions.js')).conventionValue('balance.diagnostic_foot_length')), 0.2);
  assert.deepEqual(errors, []);
  console.log('browser balance diagnostics: banner, fixed chassé note, selector edit/reset, numeric edit passed');
} finally { await browser.close(); }
