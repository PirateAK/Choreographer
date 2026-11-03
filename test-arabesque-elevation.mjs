// Arabesque elevation preview: the drawn working leg sits at the target angle from straight down (after
// the body's tip), the baseline 90° returns the shared spec, and the table refuses out-of-range values.
// Engine check only; it does not certify any elevation as the school's arabesque.
import assert from 'node:assert/strict';
import { arabesqueSpec, specOf, joints, POSE_SPECS, ARABESQUE_BASELINE_ELEVATION } from './src/pose.js';
import { setConvention, resetConvention, statusOf, validate } from './src/conventions.js';

// Angle of the working leg's hip-to-ankle line from straight down, as drawn.
function drawnElevation(spec) {
  const [hip, , ankle] = joints(spec, 1, 0, null).legs3[1];
  const dy = ankle[1] - hip[1];
  const dz = ankle[2] - hip[2];
  return (Math.atan2(Math.abs(dz), -dy) * 180) / Math.PI;
}

// 1. The drawn leg matches the target across the declared range.
let count = 0;
for (let e = 0; e <= 180; e += 1) {
  const got = drawnElevation(arabesqueSpec(e));
  assert(Math.abs(got - e) < 1e-6, `arabesque ${e}° draws at ${got.toFixed(6)}°`);
  count++;
}
console.log(`arabesque sweep: ${count} elevations 0–180 drawn at the target`);

// 2. The baseline is the shared table entry, and it draws 90°.
assert.equal(ARABESQUE_BASELINE_ELEVATION, 90, 'baseline elevation is 90');
assert.equal(specOf('arabesque'), POSE_SPECS.arabesque, 'baseline arabesque spec is the shared table entry');
assert(Math.abs(drawnElevation(POSE_SPECS.arabesque) - 90) < 1e-6, 'the shared arabesque draws 90°');

// 3. The table reads the value, refuses out-of-range entries, and reports provisional.
assert.equal(validate('arabesque.elevation', 200).ok, false, 'elevation over 180 refused');
assert.equal(setConvention('arabesque.elevation', 120).ok, true, 'elevation 120 accepted');
assert(Math.abs(drawnElevation(specOf('arabesque')) - 120) < 1e-6, 'school-entered elevation reaches the drawn leg');
assert.equal(statusOf('arabesque.elevation'), 'provisional', 'an entered elevation is provisional until approved');
resetConvention('arabesque.elevation');
assert.equal(specOf('arabesque'), POSE_SPECS.arabesque, 'reset elevation returns the shared spec');

// 4. An elevation changes only the working leg: the body tip and the standing leg are unchanged.
assert.equal(arabesqueSpec(60).rock, POSE_SPECS.arabesque.rock, 'elevation keeps the body tip');
assert.equal(arabesqueSpec(60).legs[0][0], POSE_SPECS.arabesque.legs[0][0], 'standing leg is unchanged');

console.log('arabesque-elevation: ok');
