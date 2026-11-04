// Placeholder joint-range checks: warnings only. Verifies the warnings detect out-of-range legs, the ranges
// flow from the convention table, the table refuses out-of-range entries, and no joint is clamped or changed.
// The ranges are placeholders, not school values, and not safe limits.
import assert from 'node:assert/strict';

const memory = {};
globalThis.localStorage = {
  getItem: (k) => (k in memory ? memory[k] : null),
  setItem: (k, v) => { memory[k] = String(v); },
  removeItem: (k) => { delete memory[k]; },
};

const conv = await import('./src/conventions.js');
const pose = await import('./src/pose.js');
const jr = await import('./src/joint-ranges.js');

// Placeholders are in the table, marked provisional, and not applied to the solver.
assert.equal(conv.statusOf('range.thigh_max'), 'provisional');
assert.equal(conv.statusOf('range.knee_bend_max'), 'provisional');
assert.match(jr.JOINT_RANGE_STATUS, /warnings only/);
assert.equal(conv.CONVENTIONS.find((c) => c.id === 'range.thigh_max').applied, false, 'placeholder not applied to the solver');
const defaults = jr.jointRangeLimits();
assert.equal(defaults.thighMax, 120);
assert.equal(defaults.kneeBendMax, 150);

// Detection: tight limits flag legs that are known to be far from straight down / straight at the knee.
const tight = { thighMax: 30, kneeBendMax: 60 };
const attitude = jr.jointRangeWarnings(pose.specOf('attitude'), tight);
assert.ok(attitude.some((w) => w.leg === 1 && w.metric === 'thigh from straight down'), 'attitude back thigh flagged at a tight limit');
const plie = jr.jointRangeWarnings(pose.specOf('plie'), tight);
assert.ok(plie.some((w) => w.metric === 'knee bend'), 'plié knee bend flagged at a tight limit');
assert.deepEqual(jr.jointRangeWarnings(pose.specOf('first'), tight), [], 'first position is inside tight limits');
assert.deepEqual(jr.jointRangeWarnings(pose.specOf('attitude'), { thighMax: null, kneeBendMax: null }), [], 'null limits disable the checks');

// No clamp: the solved joints are identical before and after a warning pass.
const jointsOf = (id) => JSON.stringify(pose.joints(pose.specOf(id), 1, 0, null));
const beforeJ = jointsOf('attitude');
const beforeSpec = JSON.stringify(pose.specOf('attitude'));
jr.jointRangeWarnings(pose.specOf('attitude'), tight);
assert.equal(jointsOf('attitude'), beforeJ, 'joints unchanged by warnings');
assert.equal(JSON.stringify(pose.specOf('attitude')), beforeSpec, 'pose spec unchanged by warnings');

// Table flow: a limit entered in the table reaches the warnings; out-of-range entries are refused, not clamped.
assert.equal(conv.setConvention('range.thigh_max', 200).ok, false, 'above the row maximum refused');
assert.equal(conv.conventionValue('range.thigh_max'), 120, 'refused value leaves the table unchanged');
assert.equal(conv.setConvention('range.thigh_max', 30).ok, true, 'in-range value accepted');
assert.ok(jr.jointRangeWarnings(pose.specOf('attitude')).some((w) => w.metric === 'thigh from straight down'), 'table value reaches the warnings');
conv.resetConvention('range.thigh_max');
assert.deepEqual(jr.jointRangeWarnings(pose.specOf('attitude')).filter((w) => w.metric === 'thigh from straight down'), [], 'reset restores the placeholder');

console.log('joint-range placeholders: ok (' + jr.JOINT_RANGE_STATUS + ')');
console.log('attitude at tight limits:', attitude.map((w) => `leg ${w.leg} ${w.metric} ${w.value.toFixed(1)} > ${w.limit}`).join('; '));
