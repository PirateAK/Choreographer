// Optional browser check: station-only vs whole-track arrow nudging. Uses an externally supplied Playwright.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${process.env.APP_PORT || 3001}`);
  await page.waitForSelector('#castList [data-id]');
  // Clicks go through the DOM: the timeline canvas overlaps list rows at this viewport height.
  const castClick = (dId) => page.evaluate((x) => document.querySelector(`#castList [data-id="${x}"] .label`).click(), dId);
  const stationClick = (i) => page.evaluate((n) => document.querySelector(`#inspector [data-act="pick-station"][data-i="${n}"]`).click(), i);
  const model = () => page.evaluate(async () => (await import('/src/model.js')).state);
  const snap = () => page.evaluate(async () => {
    const { state } = await import('/src/model.js');
    const d = state.show.cast.find((x) => x.id === state.ui.selectedId) || state.show.cast[0];
    return {
      id: d.id,
      stationIdx: state.ui.stationIdx,
      keys: d.keys.map((k) => ({ x: k.x, y: k.y })),
      foot: JSON.stringify(d.footTrajectory || null),
    };
  });
  // Select the first dancer, then focus its second station.
  const id = await page.evaluate(async () => (await import('/src/model.js')).state.show.cast[0].id);
  await castClick(id);
  await page.waitForTimeout(100);
  await stationClick(1);
  await page.waitForTimeout(100);
  const s0 = await snap();
  assert.notEqual(s0.stationIdx, null, 'station focused');

  // Station-only nudge: ArrowUp moves the focused key, others stay put.
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(50);
  const s1 = await snap();
  assert.equal(s1.keys[s1.stationIdx].y, s0.keys[s0.stationIdx].y + 0.5, 'focused station moved in depth');
  s0.keys.forEach((k, i) => { if (i !== s0.stationIdx) assert.deepEqual(s1.keys[i], k, `station ${i} untouched`); });
  assert.equal(s1.foot, s0.foot, 'generated foot knots untouched');

  // Re-select the same dancer from the cast list: station focus must clear.
  await castClick(id);
  await page.waitForTimeout(100);
  const s2 = await snap();
  assert.equal(s2.stationIdx, null, 'cast re-click clears station focus');

  // Whole-track nudge: ArrowLeft moves every key by one grid unit.
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(50);
  const s3 = await snap();
  s2.keys.forEach((k, i) => assert.ok(Math.abs(s3.keys[i].x - (k.x - 0.5)) < 1e-9 || Math.abs(s3.keys[i].x - k.x) < 1e-9, `key ${i} moved or clamped`));
  assert.ok(s3.keys.some((k, i) => Math.abs(k.x - s2.keys[i].x) > 1e-9), 'whole track moved');

  // Undo returns the track.
  await page.click('#btnUndo');
  await page.waitForTimeout(50);
  const s4 = await snap();
  assert.deepEqual(s4.keys, s2.keys, 'undo restores track');

  // Station focus again, then arrows move only that station.
  await stationClick(1);
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(50);
  const s5 = await snap();
  assert.equal(s5.keys[1].x, s4.keys[1].x + 0.5, 'focus restored station-only mode');
  assert.deepEqual(s5.keys[0], s4.keys[0], 'other stations untouched after refocus');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('track-nudge browser: ok');
} finally {
  await browser.close();
}
