import assert from 'node:assert/strict';
import { addCast, createShow, mirrorPathLeftRight } from './src/model.js';

const show = createShow();
const dancer = addCast(show);
dancer.keys = [
  { t: 0, x: -2.5, y: 1, step: 'walk', pose: 'first', turn: 45, dur: 0 },
  { t: 1200, x: 1.25, y: 3.5, step: 'glissade', pose: 'fifth', turn: -90, dur: 1200 },
];
dancer.footTrajectory = {
  left: [{ t: 0, x: -2, y: 1, h: 0, load: 1 }, { t: 500, x: 0.5, y: 2, h: 0.1, load: 0 }],
  right: [{ t: 0, x: -3, y: 1, h: 0, load: 0 }, { t: 500, x: -1, y: 2, h: 0, load: 1 }],
};
const before = JSON.parse(JSON.stringify(dancer));
assert.equal(mirrorPathLeftRight(dancer), true);
assert.deepEqual(dancer.keys.map(({ t, x, y, step, pose, turn, dur }) => ({ t, x, y, step, pose, turn, dur })), [
  { t: 0, x: 2.5, y: 1, step: 'walk', pose: 'first', turn: 45, dur: 0 },
  { t: 1200, x: -1.25, y: 3.5, step: 'glissade', pose: 'fifth', turn: -90, dur: 1200 },
], 'mirrors X while preserving station sequence, timestamps and choreography metadata');
assert.deepEqual(dancer.footTrajectory.left.map((k) => [k.t, k.x, k.y, k.h, k.load]), [
  [0, 2, 1, 0, 1], [500, -0.5, 2, 0.1, 0],
], 'mirrors generated stage-space foot trajectory too');
assert.deepEqual(dancer.footTrajectory.right.map((k) => [k.t, k.x]), [[0, 3], [500, 1]], 'mirrors both foot tracks');
assert.equal(mirrorPathLeftRight(dancer), true);
assert.deepEqual(dancer.keys, before.keys, 'mirroring twice restores the original path exactly');
assert.deepEqual(dancer.footTrajectory, before.footTrajectory, 'mirroring twice restores foot trajectories');
assert.equal(mirrorPathLeftRight({ keys: [] }), false, 'empty path is a no-op');
assert.equal(mirrorPathLeftRight(null), false, 'missing dancer is a no-op');
console.log('path left/right mirror: ok');
