// Engine check for the provisional chassé phase schedule. Not ballet certification.
// Verifies: the schedule compiles, phase timing matches the provisional constant, support loads are
// correct at phase midpoints, ankles hold the pose positions (no geometry change), and the readings
// match the review's static gaps.
import assert from 'node:assert/strict';
import { specOf, feetPlaceOf, FLOOR_REF } from './src/pose.js';
import { chasseSchedule, chassePhaseReadings, CHASSE_PHASE_MS, CHASSE_PHASES } from './src/chasse-phases.js';
import { sampleFootTrajectory } from './src/foot-trajectory.js';

const spec = specOf('chasse');
const sched = chasseSchedule(spec);
const ank = feetPlaceOf(spec, 1, 0);

assert.equal(sched.phases.length, 3, 'three phases');
assert.deepEqual(sched.phases.map((p) => p.name), CHASSE_PHASES.map((p) => p.name));
for (const p of sched.phases) assert.equal(p.end - p.start, CHASSE_PHASE_MS, `${p.name} duration`);
assert.equal(sched.end, 3 * CHASSE_PHASE_MS);

const near = (a, b, label, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b}`);

const mids = sched.phases.map((p) => (p.start + p.end) / 2);
const at = (t) => sampleFootTrajectory(sched.trajectory, t);
const s0 = at(mids[0]), s1 = at(mids[1]), s2 = at(mids[2]);
// Support loads ramp across each phase, so the defined states are the phase start and end values.
const P = sched.phases;
near(at(P[0].start).left.load, 1, 'left-support start: left'); near(at(P[0].start).right.load, 0, 'left-support start: right');
near(at(P[0].end).left.load, 1, 'left-support end: left'); near(at(P[0].end).right.load, 0, 'left-support end: right');
near(at(P[1].end).left.load, 1, 'double end: left'); near(at(P[1].end).right.load, 1, 'double end: right');
near(at(P[2].end).left.load, 0, 'right-support end: left'); near(at(P[2].end).right.load, 1, 'right-support end: right');
// The double-support phase starts with the right load at 0 and ramps up to 1 within the phase.
near(at(P[1].start).right.load, 0, 'double start: right'); near(at(P[1].start).left.load, 1, 'double start: left');
near(s1.right.load, 0.5, 'double midpoint: right load ramp');

// Ankles hold the pose positions in every phase (no geometry change, no drift).
for (const [t, s] of [[mids[0], s0], [mids[1], s1], [mids[2], s2]]) {
  near(s.left.x, ank[0].x, `t${t} left x`); near(s.left.y, ank[0].y, `t${t} left y`); near(s.left.h, ank[0].z, `t${t} left h`);
  near(s.right.x, ank[1].x, `t${t} right x`); near(s.right.y, ank[1].y, `t${t} right y`); near(s.right.h, ank[1].z, `t${t} right h`);
}

// Readings: one row per phase, support indices and gaps match the pose.
const rows = chassePhaseReadings(spec);
assert.equal(rows.length, 3);
assert.deepEqual(rows[0].supportIdx, [0]);
assert.deepEqual(rows[1].supportIdx, [0, 1]);
assert.deepEqual(rows[2].supportIdx, [1]);
near(rows[0].gaps.left, ank[0].y - FLOOR_REF, 'left-support left gap');
near(rows[2].gaps.right, ank[1].y - FLOOR_REF, 'right-support right gap');
assert.equal(rows[1].freeGap, null, 'double support has no free foot');
assert.equal(rows[0].freeAboveRef, rows[0].freeGap >= -0.002, 'free-foot flag matches gap');

// The phase ordering has no flight phase: every phase has at least one support foot.
for (const r of rows) assert.ok(r.support.length >= 1, `${r.name} has support`);

console.log('chasse phase schedule: ok');
for (const r of rows) {
  console.log(`${r.name.padEnd(15)} support ${r.support.join('+').padEnd(11)} gaps mm L ${(r.gaps.left * 1000).toFixed(1)} R ${(r.gaps.right * 1000).toFixed(1)}` +
    (r.freeGap == null ? '' : ` free ${r.support.length ? (r.freeAboveRef ? 'at/above ref' : 'BELOW ref') : ''}`));
}
