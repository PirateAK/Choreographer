// School conventions: defaults equal the values the code uses, a school value reaches the pose,
// invalid values are refused, and a reset returns the pose to the default. Engine checks only.
import assert from 'node:assert/strict';
import { CONVENTIONS, conventionValue, conventionRows, setConvention, resetConvention, riseFor, validate } from './src/conventions.js';
import { POSE_SPECS, specOf, joints, feetPlaceOf } from './src/pose.js';

const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// 1. Defaults match what the code had before the table existed.
const expectRises = { releve: 0.03, pirouette: 0.06, arabesque: 0.03, attitude: 0.03, 'pas-de-bourree': 0.02 };
for (const [pose, rise] of Object.entries(expectRises)) {
  assert.equal(POSE_SPECS[pose].rise, rise, `${pose} built-in rise is ${rise}`);
  assert.equal(riseFor(pose), rise, `${pose} default convention matches the built-in rise`);
  assert.equal(specOf(pose).rise, rise, `${pose} specOf rise with no override`);
}
assert.equal(conventionValue('level.demi'), 0.03, 'demi level default');
assert.equal(conventionValue('level.pointe'), 0.06, 'pointe level default');
assert.equal(conventionValue('plie.depth') === undefined, false, 'plié row exists');

// 2. Every row has the fields the table needs, and notes are not applied silently.
for (const c of CONVENTIONS) {
  assert(c.id && c.label && c.unit && (c.measurement_reference || c.kind === 'note'), `${c.id} has label, unit, measurement reference`);
  if (c.kind === 'note') assert.equal(c.applied, false, `${c.id} note is recorded, not applied`);
}
assert.equal(conventionRows().length, CONVENTIONS.length, 'rows cover every convention');

// 3. A school rise reaches the pose and the contact still sits on the ball of the foot.
assert.equal(setConvention('releve.rise', 0.05).ok, true, 'releve rise accepted');
assert.equal(specOf('releve').rise, 0.05, 'school releve rise reaches specOf');
assert.equal(POSE_SPECS.releve.rise, 0.03, 'shared table entry is untouched by an override');
const spec = specOf('releve');
const j = joints(spec);
const [left] = feetPlaceOf(spec, 1, 0);
near(left.y, j.legs3[0][2][1] - 0.05, 1e-9, 'contact is ankle minus the school rise');
assert.equal(setConvention('pirouette.rise', 0.04).ok, true, 'pirouette rise accepted');
assert.equal(specOf('pirouette').rise, 0.04, 'pirouette override reaches specOf');

// 4. Level rises follow the same table.
assert.equal(setConvention('level.demi', 0.04).ok, true, 'demi level accepted');
assert.equal(conventionValue('level.demi'), 0.04, 'demi level reads the school value');
assert.equal(validate('level.pointe', 0.06).ok, true, 'pointe default still valid');

// 5. Invalid values are refused with a reason, not clamped.
assert.equal(setConvention('releve.rise', 0.5).ok, false, 'out-of-range rise refused');
assert.equal(setConvention('releve.rise', 'abc').ok, false, 'non-numeric rise refused');
assert.equal(setConvention('releve.rise', '').ok, false, 'empty rise refused by setConvention (reset is separate)');
assert.equal(setConvention('no.such.id', 1).ok, false, 'unknown id refused');
assert.equal(conventionValue('releve.rise'), 0.05, 'a refused value leaves the previous school value');
assert.equal(setConvention('fourth.feet', 'Parallel, turned out').ok, true, 'note accepted');
assert.equal(setConvention('fourth.feet', 'x'.repeat(501)).ok, false, 'note over 500 characters refused');

// 6. A reset returns the row to the default and the pose to the built-in rise.
resetConvention('releve.rise');
resetConvention('pirouette.rise');
resetConvention('level.demi');
resetConvention('fourth.feet');
assert.equal(specOf('releve').rise, 0.03, 'reset releve returns to the default');
assert.equal(specOf('pirouette').rise, 0.06, 'reset pirouette returns to the default');
assert.equal(conventionValue('level.demi'), 0.03, 'reset level returns to the default');
const row = conventionRows().find((r) => r.id === 'releve.rise');
assert.equal(row.source, 'default', 'reset row reports default source');
assert.equal(row.defaultValue, 0.03, 'row carries the default for the table');

// 7. Status and measurement fields: every row declares them, and unset rows hold no value.
const STATUSES = new Set(['provisional', 'school-approved', 'unset']);
for (const c of CONVENTIONS) {
  assert(STATUSES.has(c.status), `${c.id} has a valid status`);
  assert(typeof c.measurement_reference === 'string' || c.kind === 'note', `${c.id} states its measurement reference`);
  assert(typeof c.school_method === 'string', `${c.id} states its school/method`);
  if (c.status === 'unset') assert.equal(c.value, null, `${c.id} unset holds no value`);
}
assert.equal(conventionValue('attitude.knee_height'), null, 'attitude knee height stays unset by default');
assert.equal(conventionValue('fourth.turnout'), null, 'fourth turnout stays unset by default');
assert.equal(conventionValue('plie.depth'), 42.7, 'plié depth preset is separate, not read by the solver');
assert.equal(setConvention('plie.depth', 60).ok, true, 'plié depth can be set separately');
assert.equal(specOf('plie').rise, POSE_SPECS.plie.rise, 'changing plié depth does not change its sink or rise');
resetConvention('plie.depth');

// 8. Unset numeric rows accept a school value within range and reset to unset.
assert.equal(setConvention('attitude.knee_height', -0.1).ok, true, 'knee height below the hip accepted');
assert.equal(conventionValue('attitude.knee_height'), -0.1, 'school knee height read back');
resetConvention('attitude.knee_height');
assert.equal(conventionValue('attitude.knee_height'), null, 'knee height returns to unset');
assert.equal(setConvention('fourth.turnout', 200).ok, false, 'turnout over 180 refused');

console.log('conventions: ok');
