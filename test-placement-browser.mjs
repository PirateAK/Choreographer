// Optional browser smoke check. Uses an externally supplied Playwright installation.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${process.env.APP_PORT || 3001}`);
  await page.waitForSelector('#btnMoves');
  await page.evaluate(async () => {
    const { state } = await import('/src/model.js');
    const dancer = state.show.cast[0];
    state.ui.selectedId = dancer.id;
    state.ui.stationIdx = dancer.keys.length - 1;
    state.ui.fill = 'plan';
    state.ui.planTilt = 45;
    state.ui.dirtyPanels = true;
    window.beforeGuide = JSON.stringify(dancer.keys);
  });
  await page.click('#btnMoves');
  await page.selectOption('#phraseStep', 'chasse');
  await page.selectOption('#phrasePose', 'first');
  await page.fill('#phraseCounts', '3');
  await page.click('#btnStationGuide');
  const armed = await page.evaluate(async () => {
    const { state } = await import('/src/model.js');
    return { guide: state.ui.stationGuide, unchanged: JSON.stringify(state.show.cast[0].keys) === window.beforeGuide, placing: state.ui.placingStations };
  });
  assert(armed.unchanged && armed.placing);
  assert.equal(armed.guide.step, 'chasse');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(async () => (await import('/src/model.js')).state.ui.stationGuide), null);
  await page.click('#btnMoves');
  await page.click('#btnStationGuide');
  // Call the real stage pointer handler at an empty, tilted floor point.
  const result = await page.evaluate(async () => {
    const { state } = await import('/src/model.js');
    const { StageView } = await import('/src/stage.js');
    const dancer = state.show.cast[0];
    const count = dancer.keys.length;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:1000px;height:600px'; document.body.append(canvas);
    const view = new StageView(canvas, { focusStation() {}, rebuild() {} });
    view.draw();
    const p = view.w2s(4.5, 6.5);
    const rect = canvas.getBoundingClientRect();
    view.onDown({ clientX: rect.left + p.x, clientY: rect.top + p.y, button: 0, altKey: true, preventDefault() {} });
    const key = dancer.keys.at(-1);
    return { added: dancer.keys.length - count, key, guide: state.ui.stationGuide, priorUnchanged: JSON.stringify(dancer.keys.slice(0, -1)) === window.beforeGuide };
  });
  assert.equal(result.added, 1);
  assert(result.priorUnchanged);
  assert.equal(result.key.step, 'chasse');
  assert.equal(result.key.pose, 'first');
  assert(Math.abs(result.key.x - 4.5) < 1e-9);
  assert(Math.abs(result.key.y - 6.5) < 1e-9);
  assert.equal(result.key.dur, armed.guide.durationMs);
  assert.equal(result.guide, null);
  assert.deepEqual(errors, []);
  console.log('browser placement: tilt, selection, cancellation, unchanged prior stations, exact chosen point and duration passed');
} finally { await browser.close(); }
