// School conventions: defaults equal the values the code uses, a school value reaches the pose,
// invalid values are refused, and a reset returns the pose to the default. Engine checks only.
import assert from 'node:assert/strict';
import { CONVENTIONS, conventionValue, conventionRows, setConvention, resetConvention, riseFor, validate, statusOf, setApprover, getApprover, approveConvention, revokeApproval, previewSummary } from './src/conventions.js';
import { POSE_SPECS, specOf, joints, feetPlaceOf, plieSpec } from './src/pose.js';

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
assert.equal(conventionValue('plie.depth'), 42.68, 'plié depth default is the contact-constrained baseline');
assert.equal(statusOf('plie.depth'), 'provisional', 'plié depth baseline is provisional, not school-approved');
assert.equal(specOf('plie'), POSE_SPECS.plie, 'baseline plié depth returns the shared spec unchanged');

// 7b. Plié preview: a depth target re-solves shin angle and body sink, and the feet stay on the floor.
for (const depth of [20, 42.68, 60, 90]) {
  const s = plieSpec(depth);
  assert(s, `plié depth ${depth} solves`);
  assert.equal(s.legs[0][0], depth, `plié depth ${depth} sets the hip angle`);
  const [l, r] = feetPlaceOf(s, 1, 0);
  near(Math.abs(l.x), 0.089, 1e-6, `plié ${depth} left ankle x holds`);
  near(Math.abs(r.x), 0.089, 1e-6, `plié ${depth} right ankle x holds`);
  near(l.y, 0.025, 1e-6, `plié ${depth} ankle height holds`);
  assert.equal(s.rise < 0, true, `plié ${depth} sinks the body`);
}
near(plieSpec(42.68).rise, POSE_SPECS.plie.rise, 1e-4, 'closed form at the baseline matches the table rise to rounding');
assert.equal(setConvention('plie.depth', 60).ok, true, 'plié preview depth accepted');
assert.equal(specOf('plie').legs[0][0], 60, 'school plié depth reaches specOf');
assert.equal(statusOf('plie.depth'), 'provisional', 'an entered plié depth is provisional until approved');
assert.equal(setConvention('plie.depth', 10).ok, false, 'plié depth below 15 refused');
resetConvention('plie.depth');
assert.equal(specOf('plie'), POSE_SPECS.plie, 'reset plié depth returns the shared spec');

// 8. Unset numeric rows accept a school value within range and reset to unset.
assert.equal(setConvention('attitude.knee_height', -0.1).ok, true, 'knee height below the hip accepted');
assert.equal(conventionValue('attitude.knee_height'), -0.1, 'school knee height read back');
resetConvention('attitude.knee_height');
assert.equal(conventionValue('attitude.knee_height'), null, 'knee height returns to unset');
assert.equal(setConvention('fourth.turnout', 200).ok, false, 'turnout over 180 refused');

// 9. Approval lifecycle: approval needs a name and a value, records the value approved, and a
// later change withdraws it. Provisional and school-approved values are reported separately.
setApprover('');
assert.equal(approveConvention('releve.rise').ok, false, 'approve refused without an approver name');
setApprover('  Test Teacher  ');
assert.equal(getApprover(), 'Test Teacher', 'approver name is trimmed and kept');
assert.equal(statusOf('releve.rise'), 'provisional', 'a preset is provisional before approval');
assert.equal(approveConvention('releve.rise', new Date('2026-11-03T10:00:00Z')).ok, true, 'approve with name and value');
assert.equal(statusOf('releve.rise'), 'school-approved', 'approved value reports school-approved');
let approved = conventionRows().find((r) => r.id === 'releve.rise');
assert.equal(approved.approval.by, 'Test Teacher', 'approval records who approved');
assert.equal(approved.approval.at, '2026-11-03T10:00:00.000Z', 'approval records when');
assert.equal(approved.approvalWithdrawn, false, 'untouched approval is not withdrawn');
assert.equal(approveConvention('attitude.knee_height').ok, false, 'an unset row cannot be approved');

setConvention('releve.rise', 0.04);
assert.equal(statusOf('releve.rise'), 'provisional', 'changing the value withdraws approval');
const changed = conventionRows().find((r) => r.id === 'releve.rise');
assert.equal(changed.approvalWithdrawn, true, 'withdrawn approval is flagged for the table');
assert.equal(changed.approval, null, 'withdrawn approval is not shown as current');
resetConvention('releve.rise');
assert.equal(statusOf('releve.rise'), 'school-approved', 'returning to the approved value restores approval');

revokeApproval('releve.rise');
assert.equal(statusOf('releve.rise'), 'provisional', 'revoke returns the row to provisional');

approveConvention('releve.rise');
const summary = previewSummary();
assert(summary.approvedInUse.includes('releve.rise'), 'approved releve is listed as approved in use');
assert(summary.provisionalInUse.includes('pirouette.rise'), 'unapproved pirouette is listed as provisional in use');
assert(!summary.provisionalInUse.includes('releve.rise'), 'approved releve is not counted as provisional');
assert(summary.unset.includes('attitude.knee_height'), 'attitude knee height is listed as unset');
assert(summary.recordedOnly.includes('arabesque.elevation'), 'arabesque elevation is recorded, not applied');
console.log(`provisional in use (${summary.provisionalInUse.length}): ${summary.provisionalInUse.join(', ')}`);
console.log(`school-approved in use (${summary.approvedInUse.length}): ${summary.approvedInUse.join(', ')}`);
console.log(`unset (${summary.unset.length}): ${summary.unset.join(', ')}`);
revokeApproval('releve.rise');
setApprover('');

console.log('conventions: ok');
