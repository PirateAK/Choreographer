// Narration folder import and speakers in the browser: numbered files load in order, start unattached,
// and a speaker can be chosen. Requires the running app and external Playwright.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

// A tiny silent WAV, so the browser can decode a real clip with a known length.
function wav(seconds = 0.2) {
  const rate = 8000;
  const n = Math.round(rate * seconds);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  return buf;
}

const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${process.env.APP_PORT || 3001}`);
  await page.waitForSelector('#btnVoiceFolder', { state: 'attached' });

  // Dropped out of order on purpose: the import sorts them by name, numerically.
  const dir = await mkdtemp(join(tmpdir(), 'narr-'));
  for (const name of ['10 closing.wav', '02 middle.wav', '01 opening.wav']) await writeFile(join(dir, name), wav());
  await page.locator('#folderNarration').setInputFiles(dir);
  await page.waitForFunction(() => document.querySelectorAll('#voiceRow [data-voice]').length >= 3);

  const names = await page.locator('#voiceRow [data-voice] input[data-f="voice-name"]').evaluateAll((els) => els.map((e) => e.value));
  assert.deepEqual(names, ['01 opening', '02 middle', '10 closing'], `order was ${names}`);

  // Each imported clip starts unattached: silent until a speaker is chosen.
  const speakers = await page.locator('#voiceRow [data-voice] select[data-f="voice-speaker"]').evaluateAll((els) => els.map((e) => e.value));
  assert.deepEqual(speakers, ['', '', ''], 'imported clips should start unattached');
  assert.equal(await page.locator('#voiceRow .hint', { hasText: 'Unattached' }).count(), 3);

  // Choosing a cast member attaches the clip and removes the unattached note for it.
  const first = page.locator('#voiceRow [data-voice]').first();
  const options = await first.locator('select[data-f="voice-speaker"] option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
  assert.ok(options.length > 0, 'the speaker list should offer cast members');
  await first.locator('select[data-f="voice-speaker"]').selectOption(options[0]);
  await page.waitForFunction(() => {
    const row = document.querySelector('#voiceRow [data-voice]');
    return row && row.querySelector('select[data-f="voice-speaker"]').value !== '';
  });
  assert.equal(await page.locator('#voiceRow [data-voice]').first().locator('select[data-f="voice-speaker"]').inputValue(), options[0]);
  assert.equal(await page.locator('#voiceRow .hint', { hasText: 'Unattached' }).count(), 2);

  assert.deepEqual(errors, []);
  console.log('browser narration folder: numeric order, unattached start, speaker attach passed');
} finally { await browser.close(); }
