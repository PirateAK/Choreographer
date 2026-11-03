// Fourth position turnout preview: an entered turnout turns each leg about its hip, outward for both
// feet, with bone lengths unchanged and the contacts following the feet. Unset turnout keeps the preset.
// Spacing stays recorded only. Engine check only; it does not certify any turnout as school-correct.
import assert from 'node:assert/strict';
import { POSE_SPECS, specOf, joints, feetPlaceOf, blendSpecs, BODY } from './src/pose.js';
import { setConvention, resetConvention, statusOf, validate, previewSummary } from './src/conventions.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const legs3 = (spec) => joints(spec, 1, 0, null).legs3;

// 1. Unset turnout returns the shared preset.
assert.equal(specOf('fourth'), POSE_SPECS.fourth, 'unset turnout returns the shared fourth preset');
const base = legs3(POSE_SPECS.fourth);

// 2. A zero turnout draws the same figure as the preset.
const zero = legs3({ ...POSE_SPECS.fourth, turnout: 0 });
for (let i = 0; i < 2; i++) for (let p = 0; p < 3; p++) for (let a = 0; a < 3; a++) {
  assert(Math.abs(zero[i][p][a] - base[i][p][a]) < 1e-12, `zero turnout matches the preset (leg ${i}, point ${p}, axis ${a})`);
}

// 3. Across the range, bone lengths hold and the feet turn outward.
let count = 0;
for (let t = 0; t <= 180; t += 1) {
  const legs = legs3({ ...POSE_SPECS.fourth, turnout: t });
  for (let i = 0; i < 2; i++) {
    const [hip, knee, ankle] = legs[i];
    assert(Math.abs(dist(hip, knee) - BODY.leg) < 1e-9, `turnout ${t}: thigh length holds`);
    assert(Math.abs(dist(knee, ankle) - BODY.leg) < 1e-9, `turnout ${t}: shin length holds`);
  }
  count++;
}
console.log(`fourth turnout sweep: ${count} angles 0–180, bone lengths hold`);

const turned = legs3({ ...POSE_SPECS.fourth, turnout: 45 });
const ankleX = (legs, i) => legs[i][2][0];
assert(Math.abs(ankleX(turned, 0)) > Math.abs(ankleX(base, 0)), 'left foot moves outward (wider) with turnout');
assert(Math.abs(ankleX(turned, 1)) > Math.abs(ankleX(base, 1)), 'right foot moves outward (wider) with turnout');
assert(Math.sign(ankleX(turned, 0)) === Math.sign(ankleX(base, 0)) && Math.sign(ankleX(turned, 1)) === Math.sign(ankleX(base, 1)), 'feet stay on their own sides');

// 4. Contacts follow the turned feet, so the planner reads the new positions.
const turnedSpec = { ...POSE_SPECS.fourth, turnout: 45 };
const [fl] = feetPlaceOf(turnedSpec, 1, 0);
const [fb] = feetPlaceOf(POSE_SPECS.fourth, 1, 0);
assert(Math.abs(fl.x - fb.x) > 1e-3, 'contact positions change with turnout');

// 5. Blends keep turnout, so a transition into or out of a turned fourth does not lose it.
const mid = blendSpecs(POSE_SPECS.first, turnedSpec, 0.5);
assert.equal(mid.turnout, 22.5, 'blend carries turnout halfway');
assert.equal(blendSpecs(POSE_SPECS.first, POSE_SPECS.second, 0.5).turnout, undefined, 'blends without turnout add no field');

// 6. The table: turnout is provisional once entered, spacing stays recorded only, and out-of-range is refused.
assert.equal(validate('fourth.turnout', 200).ok, false, 'turnout over 180 refused');
assert.equal(setConvention('fourth.turnout', 45).ok, true, 'turnout 45 accepted');
assert.equal(statusOf('fourth.turnout'), 'provisional', 'entered turnout is provisional until approved');
assert.equal(specOf('fourth').turnout, 45, 'entered turnout reaches the fourth preset');
assert(previewSummary().provisionalInUse.includes('fourth.turnout'), 'entered turnout is listed as provisional in use');
assert.equal(setConvention('fourth.spacing', 0.5).ok, true, 'spacing accepted');
assert(previewSummary().recordedOnly.includes('fourth.spacing'), 'spacing stays recorded only');
assert.equal(specOf('fourth').turnout, 45, 'spacing does not change the solver');
resetConvention('fourth.spacing');
resetConvention('fourth.turnout');
assert.equal(specOf('fourth'), POSE_SPECS.fourth, 'reset turnout returns the shared preset');

console.log('fourth-turnout: ok');
