import assert from 'node:assert/strict';
import { joints, specOf } from './src/pose.js';

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
console.log('pose contact-load separation: ok');
