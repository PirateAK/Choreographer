import assert from 'node:assert/strict';
import { sampleFootTrajectory, validateFootTrajectory } from './src/foot-trajectory.js';

const track = {
  left: [
    { t: 0, x: 1, y: 2, h: 0.02, load: 1, toNext: 'hold', follow: 1 },
    { t: 400, x: 1, y: 2, h: 0.02, load: 0, toNext: 'swing', lift: 0.12, follow: 0 },
    { t: 1000, x: 2, y: 2.5, h: 0.02, load: 1, follow: 1 },
  ],
  right: [
    { t: 0, x: 0, y: 2, h: 0.02, load: 0, toNext: 'linear', follow: 0 },
    { t: 1000, x: 0.5, y: 2, h: 0.02, load: 1, follow: 0 },
  ],
};
assert.equal(validateFootTrajectory(track), true);
assert.deepEqual(sampleFootTrajectory(track, -1).left, { x: 1, y: 2, h: 0.02, load: 1, swing: false, follow: 1 }, 'clamps before first knot');
assert.deepEqual(sampleFootTrajectory(track, 200).left, { x: 1, y: 2, h: 0.02, load: 0.5, swing: false, follow: 0.5 }, 'hold fixes ankle while support load transfers');
const middle = sampleFootTrajectory(track, 700).left;
assert(middle.swing, 'swing mode is marked between knots');
assert(middle.x > 1 && middle.x < 2, 'swing travels between authored points');
assert(middle.h > 0.02, 'swing arc raises the ankle');
assert(middle.load > 0 && middle.load < 1, 'support load transitions independently');
assert(middle.follow > 0 && middle.follow < 1, 'follow blends independently during swing');
assert.deepEqual(sampleFootTrajectory(track, 1000).left, { x: 2, y: 2.5, h: 0.02, load: 1, swing: false, follow: 1 }, 'exact final knot');
assert.equal(sampleFootTrajectory({ left: track.left }, 300).right, undefined, 'missing foot is not synthesized');
assert.throws(() => sampleFootTrajectory(track, NaN), /time must be finite/);
assert.throws(() => validateFootTrajectory(null), /must be an object/);
assert.throws(() => validateFootTrajectory({ left: [{ t: 0, x: 0, y: 0, h: 0, load: 1 }, { t: 0, x: 1, y: 0, h: 0, load: 1 }] }), /increase strictly/);
assert.throws(() => validateFootTrajectory({ left: [{ t: 0, x: 0, y: 0, h: 0, load: 1, toNext: 'hold' }, { t: 1, x: 1, y: 0, h: 0, load: 1 }] }), /hold segment/);
assert.throws(() => validateFootTrajectory({ right: [{ t: 0, x: 0, y: 0, h: 0, load: 1.1 }] }), /load in \[0, 1\]/);
console.log('foot trajectory sampler: ok');
