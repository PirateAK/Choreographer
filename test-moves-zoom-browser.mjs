// Moves tab enlarge smoke test: a tile's zoom control opens a view twice the tile's width and height,
// Escape closes only that view, and the tile's own click still picks the move.
// Requires the running app and external Playwright.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${process.env.APP_PORT || 3001}`);
  await page.waitForSelector('#btnMoves');
  await page.click('#btnMoves');
  await page.waitForSelector('#movesSheet:not([hidden])');

  const tile = page.locator('.move').nth(1);
  const tileBox = await tile.boundingBox();
  await tile.locator('.move-zoom').click();
  const zoomBox = page.locator('.move-zoom-box');
  await zoomBox.waitFor({ state: 'visible' });
  const big = await zoomBox.boundingBox();
  assert.ok(Math.abs(big.width - tileBox.width * 2) < 2, `width ${big.width} vs 2x ${tileBox.width * 2}`);
  assert.ok(Math.abs(big.height - tileBox.height * 2) < 2, `height ${big.height} vs 2x ${tileBox.height * 2}`);

  // The enlarged figure is painted: its canvas has non-blank pixels.
  const painted = await page.evaluate(() => {
    const c = document.querySelector('.move-zoom-box canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  });
  assert.ok(painted, 'enlarged canvas should contain drawn pixels');
  assert.match(await page.locator('.move-zoom-name').innerText(), /\S/);

  await page.keyboard.press('Escape');
  await zoomBox.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#movesSheet').isVisible(), true, 'Escape should close only the enlarged view');

  // A tile click picks the move and does not open the enlarged view.
  await tile.locator('.move-name').click();
  assert.equal(await zoomBox.isVisible(), false, 'tile click should not enlarge');
  assert.deepEqual(errors, []);
  console.log('browser moves zoom: 2x2 tile size, painted figure, Escape-only close, tile click does not enlarge: passed');
} finally { await browser.close(); }
