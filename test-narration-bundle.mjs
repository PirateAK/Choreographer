// Narration bundle: the voice for one show travels as one file, tied to the show's
// name and ID. Round-trips the bytes, and refuses to treat a foreign file as this show.
import assert from 'node:assert/strict';
import { normalise } from './src/model.js';
import { buildBundle, bundleFileName, checkBundle, applyBundle } from './src/narration-bundle.js';

// A show with a stable ID: normalise keeps it, and a show that has none gets one.
const show = normalise({ name: 'Glass Slipper', narration: [{ id: 'v1', key: 'voice-a', name: '01', at: 0, length: 1000, speaker: 'd1' }] });
assert.ok(show.showId && show.showId.startsWith('show-'));
assert.equal(normalise(show).showId, show.showId, 'a saved show keeps its ID across loads');

// Fake browser store: keys map to records shaped like audiostore's.
const store = new Map();
store.set('voice-a', { name: '01', bytes: new Uint8Array([1, 2, 3, 250, 251]).buffer, peaks: [0.5, 0.25] });
const readAudio = async (k) => store.get(k) || null;

const bundle = await buildBundle(show, readAudio);
assert.equal(bundle.format, 'choreographer-narration');
assert.equal(bundle.showName, 'Glass Slipper');
assert.equal(bundle.showId, show.showId);
assert.deepEqual(bundle.missing, []);
assert.equal(bundleFileName(show), 'Glass-Slipper.narration.json');

// The file survives a JSON round trip (it is written as text).
const parsed = JSON.parse(JSON.stringify(bundle));

// Same show: loads. Different show: asks first. Garbage: rejected.
assert.equal(checkBundle(parsed, show).verdict, 'ok');
const other = normalise({ name: 'Other' });
const foreign = checkBundle(parsed, other);
assert.equal(foreign.verdict, 'other');
assert.equal(foreign.showName, 'Glass Slipper');
assert.equal(checkBundle({ nope: true }, show).verdict, 'invalid');
assert.equal(checkBundle(null, show).verdict, 'invalid');

// Loading writes the bytes back under their keys, byte-identical.
const restored = new Map();
const result = await applyBundle(parsed, async (k, rec) => restored.set(k, rec));
assert.deepEqual(result, { stored: 1, total: 1 });
const rec = restored.get('voice-a');
assert.deepEqual(Array.from(new Uint8Array(rec.bytes)), [1, 2, 3, 250, 251]);
assert.equal(rec.name, '01');
assert.deepEqual(rec.peaks, [0.5, 0.25]);

// A clip whose audio is missing here is reported, not fatal.
const partial = await buildBundle(show, async () => null);
assert.deepEqual(partial.missing, ['voice-a']);
assert.equal(partial.audio.length, 0);

console.log('narration bundle: ok');
