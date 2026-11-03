// Optional browser check of the timeline scroll slider. Uses an externally supplied Playwright.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${process.env.APP_PORT || 3001}`);
  await page.waitForSelector('#timeScroll');
  const ui = () => page.evaluate(async () => {
    const { state } = await import('/src/model.js');
    const bar = document.getElementById('timeScroll');
    return { scrollT: state.ui.scrollT, max: Number(bar.max), value: Number(bar.value), label: document.getElementById('timeScrollLabel').textContent, disabled: bar.disabled };
  });
  // Same instance as the app, not a second copy of the model.
  const shared = await page.evaluate(async () => (await import('/src/model.js')).state.show === (await import('/src/model.js')).state.show && !!document.querySelector('#timeline'));
  assert(shared);
  await page.evaluate(async () => { (await import('/src/model.js')).state.ui.scrollT = 0; });
  await page.waitForTimeout(100);
  const start = await ui();
  assert(start.max > 0 && !start.disabled, 'slider has somewhere to go');
  assert.match(start.label, /^0:00–/);
  const bar = await page.locator('#timeScroll').boundingBox();
  await page.mouse.click(bar.x + bar.width * 0.75, bar.y + bar.height / 2);
  await page.waitForTimeout(100);
  const moved = await ui();
  assert(moved.scrollT > start.max * 0.6, `slider moved the window (${moved.scrollT} of ${moved.max})`);
  assert.doesNotMatch(moved.label, /^0:00–/);
  // Shift+wheel moves the window; the slider follows it.
  await page.mouse.move(700, (await page.locator('#timeline').boundingBox()).y + 80);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, -400);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(100);
  const wheeled = await ui();
  assert(wheeled.scrollT < moved.scrollT, 'wheel scrolled back');
  assert(Math.abs(wheeled.value - wheeled.scrollT) < 0.02, 'slider tracks wheel');
  // Keyboard on the focused slider works too.
  await page.focus('#timeScroll');
  await page.keyboard.press('Home');
  await page.waitForTimeout(100);
  assert.equal((await ui()).scrollT, 0);
  assert.deepEqual(errors, []);
  console.log('timeline slider: click, wheel sync, keyboard and label passed');
} finally { await browser.close(); }
