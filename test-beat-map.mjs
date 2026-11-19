// Beat-map utilities: count translation and transient estimate on synthetic audio.
import assert from 'node:assert/strict';
import { createShow, normalise, addMusicTrack } from './src/model.js';
import { estimateBeatMarkers, makeBeatGridMarkers, translateCountToMs } from './src/beat-map.js';

const show = createShow();
show.prefs.tempo = 120;
show.prefs.beatsPerBar = 4;
show.prefs.downbeat = null;
const track = addMusicTrack(show, { key: 'music-test', name: 'Test', length: 12000, start: 5000 });
assert.equal(translateCountToMs(show, track, 1, 1), 5000);
assert.equal(translateCountToMs(show, track, 1, 8), 8500);
assert.equal(translateCountToMs(show, track, 2, 1), 9000);
assert.equal(translateCountToMs(show, track, 0, 1), null);
assert.equal(translateCountToMs(show, track, 1, 9), null);
track.beatMarkers = [0, 510, 1010, 1520, 2030, 2540, 3050, 3560, 4070];
assert.equal(translateCountToMs(show, track, 1, 3), 6010);
assert.equal(translateCountToMs(show, track, 2, 2), 9580);
// Legacy show normalization must preserve, sort, and clamp marker metadata.
const loaded = normalise({ ...show, musicTracks: [{ ...track, beatMarkers: [1000, 0, 70000, 'no'] }] });
assert.deepEqual(loaded.musicTracks[0].beatMarkers, [0, 1000, 12000]);

assert.deepEqual(makeBeatGridMarkers(2500, 120), [0, 500, 1000, 1500, 2000]);
assert.deepEqual(makeBeatGridMarkers(2500, 120, 500), [0, 500, 1000, 1500, 2000]);
assert.ok(makeBeatGridMarkers(2000, 60).every((ms, i, a) => i === 0 || ms - a[i - 1] === 1000));

// Synthetic 120 BPM transient track: one short pulse every 500ms, sample rate 10k.
const sampleRate = 10000;
const seconds = 8;
const samples = new Float32Array(sampleRate * seconds);
for (let beat = 0; beat < seconds * 2; beat++) {
  const at = beat * sampleRate / 2;
  for (let i = 0; i < 60; i++) samples[at + i] = Math.sin(i * 0.4) * 0.9;
}
const buffer = {
  duration: seconds,
  sampleRate,
  length: samples.length,
  numberOfChannels: 1,
  getChannelData: () => samples,
};
const markers = estimateBeatMarkers(buffer);
assert.ok(markers.length >= 12, `expected many beat markers, got ${markers.length}`);
const gaps = markers.slice(1).map((ms, i) => ms - markers[i]);
assert.ok(gaps.every((gap) => gap >= 490 && gap <= 510), `expected ~500ms spacing, got ${gaps.slice(0, 5)}`);
assert.deepEqual(estimateBeatMarkers(null), []);
console.log('beat map: ok');
