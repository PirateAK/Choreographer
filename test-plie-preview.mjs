// Plié preview: across the whole accepted depth range, the ankles stay on the floor at the baseline
// contact, the knees bend the right way, and a deeper target lowers the body monotonically.
// Engine check only; it does not certify the depth as school-correct.
import assert from 'node:assert/strict';
import { plieSpec, POSE_SPECS, specOf, joints, feetPlaceOf, PLIE_BASELINE_DEPTH, FLOOR_REF } from './src/pose.js';
import { setConvention, resetConvention, validate } from './src/conventions.js';

// The flat-foot limit is 17.86°; the table's minimum is 17.9°. Below it the ankle would lift.
const MIN = 17.9;
const STEP = 0.1;
let prev = null;
let count = 0;
for (let depth = MIN; depth <= 90 + 1e-9; depth += STEP) {
  const s = plieSpec(depth);
  assert(s, `plié ${depth.toFixed(1)} solves`);
  const [hip, knee] = s.legs[0];
  assert.equal(hip, depth, `plié ${depth.toFixed(1)} hip angle is the target`);
  assert(knee < 0 && knee > -90, `plié ${depth.toFixed(1)} knee bends forward within limits (${knee})`);
  const [left, right] = feetPlaceOf(s, 1, 0);
  assert(Math.abs(left.y - FLOOR_REF) < 1e-6 && Math.abs(right.y - FLOOR_REF) < 1e-6, `plié ${depth.toFixed(1)} ankles on the shared flat-foot reference (${FLOOR_REF})`);
  assert(Math.abs(Math.abs(left.x) - 0.089) < 1e-6 && Math.abs(Math.abs(right.x) - 0.089) < 1e-6, `plié ${depth.toFixed(1)} ankle x holds`);
  if (prev) {
    assert(s.rise < prev.rise, `plié ${depth.toFixed(1)} lowers the body further`);
    assert(Math.abs(knee) > Math.abs(prev.legs[0][1]), `plié ${depth.toFixed(1)} bends the knee further`);
  }
  prev = s;
  count++;
}
console.log(`plié sweep: ${count} depths ${MIN}–90 checked, contacts hold, knees bend forward, sink is monotonic`);

// The table refuses a depth that would lift the ankle, and accepts the minimum.
assert.equal(validate('plie.depth', 17.8).ok, false, 'depth just below the flat-foot limit refused');
assert.equal(validate('plie.depth', MIN).ok, true, 'table minimum accepted');
assert.equal(setConvention('plie.depth', MIN).ok, true, 'table minimum sets');
resetConvention('plie.depth');

// The baseline returns the shared spec, and its drawn ankles match the table's contact.
assert.equal(specOf('plie'), POSE_SPECS.plie, 'baseline plié spec is the shared table entry');
const base = joints(specOf('plie'));
assert(base && base.legs3, 'baseline plié joints are built');
const [bl] = feetPlaceOf(specOf('plie'), 1, 0);
assert(Math.abs(bl.y - FLOOR_REF) < 1e-3, `baseline plié ankle at floor contact (${bl.y})`);
assert.equal(PLIE_BASELINE_DEPTH, 42.68, 'baseline depth constant');

console.log('plie-preview: ok');
