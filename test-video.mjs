import assert from 'node:assert/strict';
import {
  createShow, normalise, addVideo, removeVideo, videoSpan, videoAt, endContent,
} from './src/model.js';
import { VideoEngine } from './src/video.js';

const show = createShow();
assert.deepEqual(show.videos, []);

const legacy = normalise({ videos: [
  { key: 'old', at: '10', length: '1000' },
  { key: 'bad', at: Infinity, length: NaN, trimIn: -9, trimOut: Infinity, level: Infinity },
  null,
  { key: '', length: 100 },
] });
assert.equal(legacy.videos.length, 2);
const oldClip = legacy.videos.find((clip) => clip.key === 'old');
const badClip = legacy.videos.find((clip) => clip.key === 'bad');
assert.deepEqual(oldClip, {
  id: oldClip.id, key: 'old', name: 'Video', at: 10,
  length: 1000, trimIn: 0, trimOut: 1000, muted: false, level: 1,
});
assert.equal(videoSpan(badClip), 0);
assert.equal(badClip.at, 0);
assert.equal(badClip.trimOut, 0);
assert.equal(badClip.level, 1);

const clip = addVideo(show, { key: 'source', name: 'Source', length: 5000 }, 100);
assert.ok(clip.id);
assert.deepEqual(
  { key: clip.key, name: clip.name, at: clip.at, length: clip.length, trimIn: clip.trimIn,
    trimOut: clip.trimOut, muted: clip.muted, level: clip.level },
  { key: 'source', name: 'Source', at: 100, length: 5000, trimIn: 0,
    trimOut: 5000, muted: false, level: 1 },
);
clip.trimIn = 1200;
clip.trimOut = 4200;
assert.equal(videoSpan(clip), 3000);
assert.equal(videoAt(show, 99), null);
assert.equal(videoAt({ videos: [{ at: 0, length: 5000 }, clip] }, 200), clip,
  'a malformed/missing-media entry cannot mask playable media');
assert.equal(videoAt(show, 100), clip);
assert.equal(videoAt(show, 3099), clip);
assert.equal(videoAt(show, 3100), null);

const overlapping = addVideo(show, { key: 'top', length: 1000 }, 2000);
assert.equal(videoAt(show, 2500), overlapping, 'latest starting active clip wins');
assert.equal(videoAt(show, 2000), overlapping, 'clip start is inclusive');
assert.equal(videoAt(show, 3000), clip, 'upper boundary is exclusive; lower clip resumes');
assert.equal(videoAt(show, 3000.01), clip);
const tie = addVideo(show, { key: 'tie', length: 1000 }, 2000);
assert.equal(videoAt(show, 2500), tie, 'later stored clip wins equal-start ties');

assert.equal(endContent({ ...createShow(), acts: [], videos: [clip] }), 3100);
removeVideo(show, clip.id);
assert.equal(show.videos.includes(clip), false);
assert.equal(videoAt(show, 1500), null);

// Exercise the engine against an in-memory video element: source offset, trim end,
// playback level and muted state are applied without browser or IndexedDB dependencies.
const engine = new VideoEngine();
const fake = {
  _currentTime: 0,
  seeking: false,
  playbackRate: 1,
  muted: false,
  paused: true,
  volume: 1,
  plays: 0,
  pauses: 0,
  seeks: 0,
  get currentTime() { return this._currentTime; },
  set currentTime(value) { this.seeks++; this._currentTime = value; },
  play() { this.plays++; this.paused = false; return Promise.resolve(); },
  pause() { this.pauses++; this.paused = true; },
};
engine.element = fake;
engine.key = 'engine';
engine.objectUrl = 'blob:engine';
const engineClip = {
  key: 'engine', at: 1000, length: 10000, trimIn: 2500, trimOut: 6000,
  muted: true, level: 0.35,
};
engine.sync([engineClip], 2750, false);
assert.equal(fake.currentTime, 4.25, 'seek includes trimIn plus clip-relative elapsed time');
assert.equal(fake.muted, true);
assert.equal(fake.volume, 0.35);
assert.equal(fake.seeks, 1);
engine.sync([engineClip], 2766, true);
assert.equal(fake.seeks, 1, 'normal playback tolerates clock drift without seeking');
assert.equal(fake.plays, 1, 'normal playback requests play once');
engine.sync([engineClip], 2782, true);
assert.equal(fake.seeks, 1, 'normal playback does not seek on each render');
assert.equal(fake.plays, 1, 'normal playback does not replay on each render');
assert.equal(fake.playbackRate, 1, 'small drift keeps normal playback speed');
engine.sync([engineClip], 4000, true);
assert.equal(fake.seeks, 2, 'explicit timeline scrub seeks to the new position');
engine.sync([engineClip], 4000, false);
assert.equal(fake.pauses, 1, 'pause is synchronized');
assert.equal(fake.playbackRate, 1, 'pause restores normal playback rate');
engine.seekTo(engineClip, 10000);
assert.equal(fake.currentTime, 6, 'seek clamps to the trim out point');
engine.sync([engineClip], 6000, true);
assert.equal(engine.key, null, 'end boundary releases the source');

console.log('video model and engine tests passed');
