// Browser integration check for draft isolation, beat sampling, cancellation, send and undo.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 980 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://localhost:${process.env.APP_PORT || 3001}`);
  await page.click('#btnStudio');
  await page.waitForSelector('#studioDraftDancer');
  const dancerId = await page.locator('#studioDraftDancer option').nth(1).getAttribute('value');
  assert.ok(dancerId, 'sample show has a dancer');
  const before = await page.evaluate(async (id) => {
    const { state } = await import('/src/model.js');
    const d = state.show.cast.find((item) => item.id === id);
    return { keys: d.keys.length, scenery: state.show.scenery.map((s) => s.id), history: state.history.length };
  }, dancerId);
  await page.selectOption('#studioDraftDancer', dancerId);
  await page.click('[data-tool="obstacle"]');
  const box = await page.locator('#studioCanvas').boundingBox();
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
  await page.click('[data-tool="route"]');
  for (const [x, y] of [[0.34, 0.66], [0.5, 0.48], [0.68, 0.66]]) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  }
  await page.click('#studioSampleRoute');
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('choreographer.path-studio.draft.v1')));
  assert.equal(draft.route.length, 3);
  assert.equal(draft.stations.length, 9);
  assert.equal(draft.obstacles.length, 1);
  assert.ok(draft.stations.every((station) => station.contentMs >= 0));
  const isolated = await page.evaluate(async (id) => {
    const { state } = await import('/src/model.js');
    const d = state.show.cast.find((item) => item.id === id);
    return { keys: d.keys.length, scenery: state.show.scenery.map((s) => s.id), history: state.history.length };
  }, dancerId);
  assert.deepEqual(isolated, before, 'draft route and scenery do not change the show or undo history');
  await page.click('#draftSaveKeyframe');
  await page.evaluate(() => { window.prompt = () => null; });
  await page.click('#studioSendDraft');
  const canceled = await page.evaluate(async (id) => {
    const { state } = await import('/src/model.js');
    const d = state.show.cast.find((item) => item.id === id);
    return { keys: d.keys.length, scenery: state.show.scenery.map((s) => s.id), history: state.history.length };
  }, dancerId);
  assert.deepEqual(canceled, before, 'canceling replacement leaves show unchanged');
  await page.evaluate(() => { window.prompt = () => 'REPLACE'; window.confirm = () => true; });
  await page.click('#studioSendDraft');
  const sent = await page.evaluate(async (id) => {
    const { state } = await import('/src/model.js');
    const d = state.show.cast.find((item) => item.id === id);
    return { keys: d.keys.length, scenery: state.show.scenery.map((s) => s.id), history: state.history.length };
  }, dancerId);
  assert.equal(sent.keys, 9, 'send installs stations as dancer keys');
  assert.equal(sent.scenery.length, before.scenery.length + 1, 'send adds staged obstacle');
  assert.equal(sent.history, before.history + 1, 'send is one undoable operation');
  await page.click('#btnUndo');
  const undone = await page.evaluate(async (id) => {
    const { state } = await import('/src/model.js');
    const d = state.show.cast.find((item) => item.id === id);
    return { keys: d.keys.length, scenery: state.show.scenery.map((s) => s.id), history: state.history.length };
  }, dancerId);
  assert.deepEqual(undone, before, 'one undo restores original keys and scenery');
  assert.deepEqual(errors, [], 'no browser page errors');
  console.log('routine staging browser: ok');
} finally {
  await browser.close();
}
