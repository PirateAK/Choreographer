import assert from 'node:assert/strict';
import { joints, specOf } from './src/pose.js';
import { createShow, footPinsFromTrajectory, posAtLocal, poseAtLocal, dancerHeight } from './src/model.js';
import { contactFrame } from './src/contact-frame.js';
import { sampleFootTrajectory } from './src/foot-trajectory.js';

const spec = specOf('first');
const target = { x: 0.08, y: 0.04, z: 0.02, w: 1 };
const distance = (a, b) => Math.hypot(a[0] - b.x, a[1] - b.y, a[2] - b.z);

// Legacy pins continue to use their position-following weight as support weight.
const legacy = joints(spec, 1, 0, { left: { ...target, w: 0.6 } });
const explicitLegacy = joints(spec, 1, 0, { left: { ...target, w: 0.6, load: 0.6 } });
assert.deepEqual(explicitLegacy.legs3, legacy.legs3, 'explicit matching load preserves legacy geometry');
assert.deepEqual(explicitLegacy.pelvis, legacy.pelvis, 'explicit matching load preserves legacy support');

// A swing ankle can follow its path exactly without carrying the dancer.
const swing = joints(spec, 1, 0, { left: { ...target, w: 1, load: 0 } });
assert.equal(swing.shortfall[0], null, 'reachable swing target is solved');
assert(distance(swing.legs3[0][2], target) < 1e-10, 'zero-load pin still follows target');
const planted = joints(spec, 1, 0, { left: { ...target, w: 1, load: 1 } });
assert(distance(planted.legs3[0][2], target) < 1e-10, 'loaded pin follows same target');
assert.notDeepEqual(swing.pelvis, planted.pelvis, 'support load affects body support independently of pin following');

// Both pins may follow their targets while support shifts smoothly from one to the other.
const transfer = (left, right) => joints(spec, 1, 0, {
  left: { x: 0.08, y: 0.04, z: 0.02, w: 1, load: left },
  right: { x: -0.08, y: 0.04, z: 0.02, w: 1, load: right },
});
const early = transfer(0.2, 0.8);
const late = transfer(0.8, 0.2);
assert(early.pelvis[0] * late.pelvis[0] < 0, 'support transfer moves hips across between supporting feet');
for (const [figure, side, point] of [[early, 0, [0.08, 0.04, 0.02]], [early, 1, [-0.08, 0.04, 0.02]], [late, 0, [0.08, 0.04, 0.02]], [late, 1, [-0.08, 0.04, 0.02]]]) {
  assert(distance(figure.legs3[side][2], { x: point[0], y: point[1], z: point[2] }) < 1e-10,
    'load changes must not change the ankle target');
}

// Stage-space trajectories convert to solver pins without losing the world mark,
// for mirrored and turned bodies alike.
const show = createShow();
const local = [0.07, 0.03, -0.04];
for (const facing of [1, -1]) for (const turn of [0, 90, 270]) {
  const dancer = { keys: [{ t: 0, x: 1.2, y: 2.8, pose: 'first', facing, turn }] };
  const t = 0, h = dancerHeight(show), body = posAtLocal(dancer, t), at = poseAtLocal(dancer, t);
  const frame = contactFrame(body, h, at.facing, at.turn);
  const point = frame.toStage(local);
  const trajectory = {
    left: [
      { t: 0, x: point.x, y: point.y, h: point.h, load: 0, toNext: 'hold' },
      { t: 1000, x: point.x, y: point.y, h: point.h, load: 0 },
    ],
    right: [
      { t: 0, x: point.x, y: point.y, h: point.h, load: 1, toNext: 'hold' },
      { t: 1000, x: point.x, y: point.y, h: point.h, load: 1 },
    ],
  };
  const evaluated = sampleFootTrajectory(trajectory, t);
  assert.deepEqual([evaluated.left.x, evaluated.left.y, evaluated.left.h], [point.x, point.y, point.h],
    `sampled left ankle stays on stage mark, facing ${facing}, turn ${turn}`);

  const pins = footPinsFromTrajectory(show, dancer, t, trajectory);
  const label = `facing ${facing}, turn ${turn}`;
  assert.equal(pins.left.load, 0, `left load ${label}`);
  assert.equal(pins.left.w, 1, `left w ${label}`);
  assert.equal(pins.left.swing, false, `hold segment is not a swing ${label}`);
  assert.equal(pins.right.load, 1, `right load ${label}`);
  assert.equal(pins.right.w, 1, `right w ${label}`);
  for (const side of ['left', 'right']) {
    const [x, y, z] = [pins[side].x, pins[side].y, pins[side].z];
    assert(Math.abs(x - local[0]) < 1e-10 && Math.abs(y - local[1]) < 1e-10 && Math.abs(z - local[2]) < 1e-10,
      `${side} trajectory round-trip ${label}`);
  }
}

assert.equal(footPinsFromTrajectory(show, { keys: [] }, 0, { left: [] }), null,
  'a trajectory without a dancer body has no solver frame');
console.log('pose contact-load separation: ok');
