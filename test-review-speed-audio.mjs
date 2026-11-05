// Review-speed audio timing: start() duration is buffer seconds (unscaled by rate),
// while the scheduled wall-clock delay before the entry point is divided by rate.
import assert from 'node:assert/strict';
import { MusicEngine, clampReviewRate, reviewPauseWallDuration } from './src/music.js';

assert.equal(clampReviewRate(0.5), 1);
assert.equal(clampReviewRate(9), 4);
assert.equal(clampReviewRate('abc'), 1);
assert.equal(reviewPauseWallDuration(4000, 2), 2000);

function fakeEngine() {
  const started = [];
  const ctx = {
    currentTime: 0,
    createBufferSource() {
      return {
        buffer: null,
        playbackRate: { value: 1 },
        connect() {},
        start(...args) { this.args = args; started.push(this); },
        stop() {},
        disconnect() {},
      };
    },
  };
  const m = new MusicEngine();
  m.ctx = ctx;
  m.gain = { connect() {}, gain: { value: 1 } };
  m.buffer = { duration: 100 };
  m.track = { start: 0 };
  m.playbackRate = 2;
  return { m, started };
}

// Entry point already passed: plays the rest of the file from 5 s, no delay.
{
  const { m, started } = fakeEngine();
  m.startSource(5000);
  const [when, offset, duration] = started[0].args;
  assert.equal(when, 0);
  assert.equal(offset, 5);
  assert.equal(duration, 95, 'duration stays in buffer seconds, not divided by rate');
  assert.equal(started[0].playbackRate.value, 2);
}

// Before the entry point: 2 show-seconds of lead-in at 2× is 1 wall second.
{
  const { m, started } = fakeEngine();
  m.startSource(-2000);
  const [when, offset, duration] = started[0].args;
  assert.equal(when, 1, 'wall-clock delay is divided by rate');
  assert.equal(offset, 0);
  assert.equal(duration, 100);
}

console.log('test-review-speed-audio: ok');
