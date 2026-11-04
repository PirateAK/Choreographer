// Back-ball path check. The lift target (pas-de-bourree.back_ball_lift) is a reference: changing it changes the
// gap between the measured ball height and the target, and does NOT change the measured height. The rise
// (pas-de-bourree.rise) lifts the body: it changes the pelvis and leaves the measured ball height unchanged.
// Engine check only; no value here is school-approved, and no geometry changes.
import assert from 'node:assert/strict';

const memory = {};
globalThis.localStorage = {
  getItem: (k) => (k in memory ? memory[k] : null),
  setItem: (k, v) => { memory[k] = String(v); },
  removeItem: (k) => { delete memory[k]; },
};

const conv = await import('./src/conventions.js');
const pose = await import('./src/pose.js');
const { raisedFootReading } = await import('./src/raised-foot.js');

const POSE = 'pas-de-bourree';
const TARGET = 'pas-de-bourree.back_ball_lift';
const RISE = 'pas-de-bourree.rise';
const read = () => raisedFootReading(pose.specOf(POSE), POSE);
const TOL = 1e-12;

// Separate settings, each with its own row and status.
assert.notEqual(TARGET, RISE);
assert.equal(conv.CONVENTIONS.find((c) => c.id === TARGET).kind, 'rise', 'target row kind (reference)');
assert.equal(conv.CONVENTIONS.find((c) => c.id === TARGET).applied, false, 'target is not applied to the solver');
assert.equal(conv.CONVENTIONS.find((c) => c.id === RISE).applied, true, 'rise is applied to the pose');

const base = read();
assert.equal(base.target, 0.02, 'default provisional target');
assert.ok(base.ok, 'default preset is at its own target');

// Target change: the measured height is the same; only the target and the gap move.
assert.equal(conv.setConvention(TARGET, 0.03).ok, true);
const t = read();
assert.ok(Math.abs(t.height - base.height) <= TOL, 'target change does not change the measured back-ball height');
assert.ok(Math.abs(t.target - 0.03) <= TOL, 'target change is used as the reference');
assert.ok(Math.abs(t.gap - (base.gap - 0.01)) <= TOL, 'gap moves by the target change');
assert.equal(t.ok, false, 'the preset is now outside the new target');
assert.equal(conv.statusOf(TARGET), 'provisional', 'an entered target is provisional until approved');
conv.resetConvention(TARGET);
assert.ok(Math.abs(read().gap - base.gap) <= TOL, 'reset restores the gap');

// Rise change: the body moves (pelvis) and the measured ball height does not.
assert.equal(conv.setConvention(RISE, 0.03).ok, true);
const r = read();
assert.ok(Math.abs(r.height - base.height) <= TOL, 'rise change does not change the measured back-ball height');
assert.ok(Math.abs(r.pelvisY - base.pelvisY - 0.01) <= 1e-9, 'rise change moves the pelvis by the rise change');
assert.ok(Math.abs(r.target - base.target) <= TOL, 'rise change does not change the lift target');
conv.resetConvention(RISE);
assert.ok(Math.abs(read().pelvisY - base.pelvisY) <= TOL, 'reset restores the pelvis');

// Range: the target row refuses out-of-range entries.
assert.equal(conv.setConvention(TARGET, 0.2).ok, false, 'target above its row maximum refused');
assert.equal(read().target, 0.02, 'refused target leaves the reference unchanged');

console.log(`back-foot ankle-endpoint proxy: ${(base.height * 1000).toFixed(2)} review mm (${(base.height * 1.7 * 1000).toFixed(2)} phys mm) above the flat-foot reference`);
console.log(`target ${(base.target * 1000).toFixed(1)} review mm -> gap ${(base.gap * 1000).toFixed(2)} review mm; target 30 review mm -> gap ${((base.gap - 0.01) * 1000).toFixed(2)} review mm; height unchanged`);
console.log(`rise 0.02 -> 0.03 moves the pelvis by ${(0.01 * 1000).toFixed(1)} review mm; ankle-endpoint proxy height unchanged`);
console.log('back-ball path: ok');
