// Tap tempo and the count-one downbeat: pure model checks, no browser.
import assert from 'node:assert/strict';
import { tempoFromTaps, countGrid, countAt, createShow } from './src/model.js';

// Steady taps at 120 bpm (500 ms gaps).
assert.equal(tempoFromTaps([0, 500, 1000, 1500]), 120);
// One late tap barely moves the median.
assert.equal(tempoFromTaps([0, 500, 1000, 1500, 1900]), 120);
// A single tap is not yet a tempo; taps too close together are not beats.
assert.equal(tempoFromTaps([0]), null);
assert.equal(tempoFromTaps([0, 50]), null);
assert.equal(tempoFromTaps([]), null);
// Only the latest taps count, so a slow start does not drag the tempo for long.
assert.equal(tempoFromTaps([0, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000]), 120);
// Clamped to the tempo field's range.
assert.equal(tempoFromTaps([0, 200]), 300);

// Count one at a set downbeat: that moment is bar 1, count 1, and nothing before it is in the music.
const show = createShow();
show.prefs.tempo = 120;
show.prefs.beatsPerBar = 4;
show.prefs.downbeat = 2000;
assert.equal(countGrid(show).origin, 2000);
assert.deepEqual(countAt(show, 2000), { bar: 1, count: 1, of: 4, tempo: 120 });
assert.deepEqual(countAt(show, 2500), { bar: 1, count: 2, of: 4, tempo: 120 });
assert.equal(countAt(show, 1000), null);

// Cleared downbeat falls back to the first music track's entry.
show.prefs.downbeat = null;
show.musicTracks = [{ id: 'm1', start: 3000, length: 60000 }];
assert.equal(countGrid(show).origin, 3000);
assert.deepEqual(countAt(show, 3000), { bar: 1, count: 1, of: 4, tempo: 120 });

// With no downbeat and no track, bars count from zero.
const bare = createShow();
assert.equal(countGrid(bare).origin, 0);

console.log('tap tempo: ok');
