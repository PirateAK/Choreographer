// Balance diagnostic baseline/configuration checks. Diagnostic only, not a ballet or safety criterion.
// Confirms historical defaults/margins, configurable inputs, geometry/contact isolation, fixed chassé phases,
// and that balance no longer contributes to pass/fail.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const memory = {};
globalThis.localStorage = {
  getItem: (k) => (k in memory ? memory[k] : null),
  setItem: (k, v) => { memory[k] = String(v); },
  removeItem: (k) => { delete memory[k]; },
};
const conv = await import('./src/conventions.js');
const pose = await import('./src/pose.js');
const bal = await import('./src/balance-diagnostic.js');
const { chassePhaseReadings, CHASSE_PHASES } = await import('./src/chasse-phases.js');
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const near = (a, b, msg, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} != ${b}`);
const ids = ['first', 'second', 'third', 'fourth', 'fifth', 'tendu', 'plie', 'releve', 'arabesque', 'attitude', 'pirouette', 'pas-de-bourree'];
const expected = {
  first: 0.045, second: 0.045, third: 0.045, fourth: -0.0019230833079016962,
  fifth: 0.045, tendu: -0.008611494816343962, plie: 0.045, releve: 0.045,
  arabesque: 0.00046237432630628905, attitude: 0.00046237432630628905,
  pirouette: 0.00046237432630628905, 'pas-de-bourree': -0.048519845939759124,
};

assert.equal(bal.BALANCE_DIAGNOSTIC_STATUS, 'provisional diagnostic only; not school-approved; never scored');
assert.deepEqual(bal.balanceDiagnosticSettings(), { footLength: 0.15, halfWidth: 0.05, ankleHeelFraction: 0.30 });
for (const id of ids) near(bal.stationaryBalanceDiagnostic(pose.specOf(id), id).margin, expected[id], `${id} baseline margin`);
assert.equal(conv.conventionValue('fourth.foot_length'), 0.15, 'historical fourth spacing value retained');
assert.equal(bal.balanceDiagnosticSettings().footLength, 0.15, 'new diagnostic foot length is separate');
for (const key of ['balance.diagnostic_foot_length', 'balance.diagnostic_half_width', 'balance.ankle_heel_fraction']) {
  assert.equal(conv.CONVENTIONS.find((r) => r.id === key).applied, false, `${key} diagnostic-only`);
  assert.equal(conv.statusOf(key), 'provisional', `${key} provisional by default`);
}

const spec = pose.specOf('first');
const jointsBefore = JSON.stringify(pose.joints(spec, 1, 0, null));
const anklesBefore = JSON.stringify(pose.feetPlaceOf(spec, 1, 0));
const defaultContactGaps = pose.feetPlaceOf(spec, 1, 0).map((p) => p.y - pose.FLOOR_REF);
assert.equal(conv.setConvention('balance.diagnostic_foot_length', 0.20).ok, true);
const longFoot = bal.stationaryBalanceDiagnostic(spec, 'first');
assert.notEqual(longFoot.margin, expected.first, 'foot length changes first-position balance diagnostic');
assert.equal(JSON.stringify(pose.joints(spec, 1, 0, null)), jointsBefore, 'foot-length setting leaves joints unchanged');
assert.equal(JSON.stringify(pose.feetPlaceOf(spec, 1, 0)), anklesBefore, 'foot-length setting leaves ankles unchanged');
assert.deepEqual(pose.feetPlaceOf(spec, 1, 0).map((p) => p.y - pose.FLOOR_REF), defaultContactGaps, 'contact data unchanged');
conv.resetConvention('balance.diagnostic_foot_length');
near(bal.stationaryBalanceDiagnostic(spec, 'first').margin, expected.first, 'foot length reset restores baseline');

assert.equal(conv.setConvention('balance.diagnostic_half_width', 0.06).ok, true);
assert.notEqual(bal.stationaryBalanceDiagnostic(pose.specOf('fourth'), 'fourth').margin, expected.fourth, 'half-width changes margin');
conv.resetConvention('balance.diagnostic_half_width');
assert.equal(conv.setConvention('balance.ankle_heel_fraction', 0.40).ok, true);
assert.notEqual(bal.stationaryBalanceDiagnostic(pose.specOf('tendu'), 'tendu').baseZ[0], bal.stationaryBalanceDiagnostic(pose.specOf('tendu'), 'tendu', { footLength: 0.15, halfWidth: 0.05, ankleHeelFraction: 0.30 }).baseZ[0], 'heel fraction changes bounds');
conv.resetConvention('balance.ankle_heel_fraction');

const tenduJoints = JSON.stringify(pose.joints(pose.specOf('tendu'), 1, 0, null));
const tenduDefault = bal.stationaryBalanceDiagnostic(pose.specOf('tendu'), 'tendu');
assert.deepEqual(bal.stationarySupportIndices('tendu'), [0]);
assert.equal(conv.setConvention('balance.support.tendu', 'right').ok, true);
assert.deepEqual(bal.stationarySupportIndices('tendu'), [1]);
assert.notEqual(bal.stationaryBalanceDiagnostic(pose.specOf('tendu'), 'tendu').margin, tenduDefault.margin, 'support selection changes diagnostic base');
assert.equal(JSON.stringify(pose.joints(pose.specOf('tendu'), 1, 0, null)), tenduJoints, 'support selector leaves joints unchanged');
assert.equal(conv.setConvention('balance.support.tendu', 'invalid').ok, false, 'selector accepts only listed choices');
conv.resetConvention('balance.support.tendu');

const phaseSupports = () => chassePhaseReadings(pose.specOf('chasse')).map((r) => r.supportIdx);
assert.deepEqual(phaseSupports(), [[0], [0, 1], [1]]);
assert.equal(conv.setConvention('balance.support.chasse', 'right').ok, false, 'no general chassé selector row');
const phaseBefore = phaseSupports();
assert.equal(conv.setConvention('balance.support.tendu', 'right').ok, true);
assert.equal(conv.setConvention('balance.diagnostic_half_width', 0.06).ok, true);
assert.deepEqual(phaseSupports(), phaseBefore, 'phase support mapping fixed to CHASSE_PHASES');
assert.deepEqual(CHASSE_PHASES.map((p) => p.contact), [{ left: true, right: false }, { left: true, right: true }, { left: false, right: true }]);
conv.resetConvention('balance.support.tendu');
conv.resetConvention('balance.diagnostic_half_width');

function runReview(values = {}) {
  const preload = `globalThis.localStorage={getItem:()=>${JSON.stringify(JSON.stringify({ values }))},setItem(){},removeItem(){}};`;
  return spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(preload), 'review-basic-movements.mjs'], { cwd: ROOT, encoding: 'utf8' });
}
const review = runReview();
assert.equal(review.status, 0, `review passes when only balance diagnostics are negative: ${review.stderr}`);
assert.match(review.stdout, /fourth\s+balance diagnostic only[^\n]*margin -0\.002 bu/);
assert.match(review.stdout, /tendu\s+balance diagnostic only[^\n]*margin -0\.009 bu/);
assert.match(review.stdout, /pas-de-bourree\s+balance diagnostic only[^\n]*margin -0\.049 bu/);
assert.match(review.stdout, /scored checks failing: 0/);
assert.doesNotMatch(review.stdout, /scored checks failing: [^\n]*balance/);
assert.match(review.stdout, /chasse\s+[^\n]*balance diagnostic only/);

const overriddenReview = runReview({ 'balance.diagnostic_half_width': 0.06 });
assert.equal(overriddenReview.status, 0, 'diagnostic-only setting does not fail review');
assert.doesNotMatch(overriddenReview.stdout, /scored checks failing: [^\n]*balance/);
assert.match(overriddenReview.stdout, /fourth\s+balance diagnostic only[^\n]*margin (?!-0\.002)/, 'changed setting changes reported balance margin');
assert.match(overriddenReview.stdout, /fourth\s+contact pass support gap review mm 0\.0,0\.0/, 'contact output unchanged by balance setting');
assert.match(overriddenReview.stdout, /scored checks failing: 0/);

console.log('balance diagnostics: defaults reproduce baseline; settings change diagnostics only; chassé phases fixed; balance unscored');
