// Fourth-position spacing: the heel-to-toe gap between the feet, front to back, is set by scaling each leg's
// fore/aft angle. Checks: the gap matches each reachable target, leg lengths and hip/knee angles hold,
// unreachable targets report a shortfall, and the school row reaches specOf (also with turnout).
import assert from 'node:assert/strict';
import { POSE_SPECS, specOf, joints, fourthSpacingGap, fourthSpacingSolve, toeDirection } from './src/pose.js';
import { setConvention, resetConvention, conventionValue, statusOf, previewSummary } from './src/conventions.js';

const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const L = 0.15; // the provisional foot length in conventions.js
const base = POSE_SPECS.fourth;

// 1. The preset as drawn has a positive gap, and the solver is not run without a value.
const presetGap = fourthSpacingGap(base, L);
assert(presetGap > 0, `preset has a heel-to-toe gap ${presetGap.toFixed(3)}`);
assert.equal(specOf('fourth'), POSE_SPECS.fourth, 'unset spacing leaves the shared preset');

// 2. Each reachable target is met, with leg lengths and hip/knee angles unchanged.
const boneLens = (spec, i) => {
  const [hip, knee, ank] = joints(spec, 1, 0, null).legs3[i];
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return [d(knee, hip), d(ank, knee)];
};
const targets = [0.0, 0.05, 0.15, 0.25, presetGap];
for (const S of targets) {
  const solved = fourthSpacingSolve(base, S, L);
  near(fourthSpacingGap(solved, L), S, 1e-6, `gap meets target ${S}`);
  assert.equal(solved.spacingShortfall, 0, `target ${S} is reachable`);
  for (const i of [0, 1]) {
    const [th, sh] = boneLens(solved, i);
    const [th0, sh0] = boneLens(base, i);
    near(th, th0, 1e-9, `leg ${i} thigh holds at ${S}`);
    near(sh, sh0, 1e-9, `leg ${i} shin holds at ${S}`);
    assert.equal(solved.legs[i][0], base.legs[i][0], `leg ${i} hip angle holds at ${S}`);
    assert.equal(solved.legs[i][1], base.legs[i][1], `leg ${i} knee angle holds at ${S}`);
  }
}

// 3. Unreachable targets clamp and report how far short they fall.
const tooWide = fourthSpacingSolve(base, 5, L);
assert(tooWide.spacingShortfall > 4, 'a gap of 5 body heights is reported as short');
const tooNarrow = fourthSpacingSolve(base, -5, L);
assert(tooNarrow.spacingShortfall > 4, 'a gap of −5 is reported as short');
for (const spec of [tooWide, tooNarrow]) for (const leg of spec.legs) assert(Math.abs(leg[2]) <= 90 + 1e-9, 'fore/aft stays within horizontal');

// 4. Foot length changes the solution: the same heel-to-toe gap needs a different fore/aft angle.
const withShort = fourthSpacingSolve(base, 0.2, 0.1);
const withLong = fourthSpacingSolve(base, 0.2, 0.25);
assert(Math.abs(withShort.legs[0][2] - withLong.legs[0][2]) > 1e-3, 'foot length moves the solution');
near(fourthSpacingGap(withLong, 0.25), 0.2, 1e-6, 'long foot meets the same target');

// 5. Through the convention: the school value reaches specOf, status is provisional once entered, and
// turnout and spacing combine (the gap uses the turned foot directions).
resetConvention('fourth.spacing');
resetConvention('fourth.turnout');
resetConvention('fourth.foot_length');
assert.equal(statusOf('fourth.spacing'), 'unset', 'spacing starts unset');
assert(previewSummary().unset.includes('fourth.spacing'), 'unset spacing is listed as unset');

assert.equal(setConvention('fourth.spacing', 0.2).ok, true, 'spacing accepted');
const viaSpec = specOf('fourth');
near(fourthSpacingGap(viaSpec, conventionValue('fourth.foot_length')), 0.2, 1e-6, 'school spacing reaches specOf');
assert.equal(statusOf('fourth.spacing'), 'provisional', 'an entered spacing is provisional until approved');
assert(previewSummary().provisionalInUse.includes('fourth.spacing'), 'entered spacing is listed as provisional in use');

assert.equal(setConvention('fourth.turnout', 40).ok, true, 'turnout accepted with spacing');
const turnedSpec = specOf('fourth');
near(fourthSpacingGap(turnedSpec, L), 0.2, 1e-6, 'spacing holds with turnout');
const [tx, tz] = toeDirection(turnedSpec, 0);
near(tx, Math.sin((40 * Math.PI) / 180), 1e-9, 'left toe turns out by 40° with spacing');
near(tz, Math.cos((40 * Math.PI) / 180), 1e-9, 'left toe forward component with spacing');

resetConvention('fourth.spacing');
resetConvention('fourth.turnout');
assert.equal(specOf('fourth'), POSE_SPECS.fourth, 'reset returns the shared preset');

console.log(`fourth spacing: preset gap ${presetGap.toFixed(3)}, ${targets.length} targets met, shortfall reported`);
console.log('fourth-spacing: ok');
