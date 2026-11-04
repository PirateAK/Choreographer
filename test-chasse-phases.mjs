// Engine check for the provisional chassé support schedule. SUPPORT SCHEDULING ONLY: not a validated chassé,
// not ballet certification. Verifies: the schedule compiles; phase timing matches the provisional constant;
// contact flags per phase; loads transfer with a sum of 1 in double support; ankles hold pose positions; and
// the readings flag feet that float above the floor reference.
import assert from 'node:assert/strict';
import { specOf, feetPlaceOf, FLOOR_REF } from './src/pose.js';
import { chasseSchedule, chassePhaseReadings, CHASSE_PHASE_MS, CHASSE_PHASES, CHASSE_STATUS, CHASSE_CONTACT_TOL } from './src/chasse-phases.js';
import { sampleFootTrajectory } from './src/foot-trajectory.js';

const spec = specOf('chasse');
const sched = chasseSchedule(spec);
const ank = feetPlaceOf(spec, 1, 0);
const near = (a, b, label, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b}`);
const at = (t) => sampleFootTrajectory(sched.trajectory, t);
const P = sched.phases;

assert.equal(P.length, 3, 'three phases');
assert.deepEqual(P.map((p) => p.name), CHASSE_PHASES.map((p) => p.name));
for (const p of P) assert.equal(p.end - p.start, CHASSE_PHASE_MS, `${p.name} duration`);
assert.match(CHASSE_STATUS, /support scheduling only/);

// Loads at phase boundaries: left-support (1,0), double (1 -> 0 left, 0 -> 1 right), right-support (0,1).
near(at(P[0].start).left.load, 1, 'start left'); near(at(P[0].start).right.load, 0, 'start right');
near(at(P[0].end).left.load, 1, 'left-support end left'); near(at(P[0].end).right.load, 0, 'left-support end right');
near(at(P[1].end).left.load, 0, 'double end left'); near(at(P[1].end).right.load, 1, 'double end right');
near(at(P[2].end).left.load, 0, 'right-support end left'); near(at(P[2].end).right.load, 1, 'right-support end right');

// Double support: loads transfer smoothly and sum to 1 at every sample (no both-1 state).
for (let k = 0; k <= 20; k++) {
  const t = P[1].start + ((P[1].end - P[1].start) * k) / 20;
  const s = at(t);
  near(s.left.load + s.right.load, 1, `double load sum at k=${k}`, 1e-9);
}
near(at((P[1].start + P[1].end) / 2).left.load, 0.5, 'double midpoint left', 1e-9);

// Ankles hold the pose positions in every phase (no geometry change, no drift).
for (const p of P) {
  const s = at((p.start + p.end) / 2);
  near(s.left.x, ank[0].x, `${p.name} left x`); near(s.left.y, ank[0].y, `${p.name} left y`); near(s.left.h, ank[0].z, `${p.name} left h`);
  near(s.right.x, ank[1].x, `${p.name} right x`); near(s.right.y, ank[1].y, `${p.name} right y`); near(s.right.h, ank[1].z, `${p.name} right h`);
}

// Readings: contact flags, support indices, and floating flags reflect the current (unchanged) pose.
const rows = chassePhaseReadings(spec);
assert.equal(rows.length, 3);
assert.deepEqual(rows.map((r) => r.supportIdx), [[0], [0, 1], [1]]);
assert.ok(rows.every((r) => r.validated === false), 'nothing is marked validated');
near(rows[0].gaps.left, ank[0].y - FLOOR_REF, 'left-support left gap');
near(rows[2].gaps.right, ank[1].y - FLOOR_REF, 'right-support right gap');
assert.equal(rows[1].freeGap, null, 'double support has no free foot');
assert.deepEqual(rows[1].floating, ['left', 'right'], 'current pose floats both feet in double support');
assert.deepEqual(rows[0].floating, ['left'], 'left support foot floats in the current pose');
assert.ok(Math.abs(rows[0].gaps.left) > CHASSE_CONTACT_TOL, 'the floating gap is real, not hidden');

// Pelvis against the support base (diagnostic). Margins equal the review's static balance readings for the
// same support sets (left -0.194, double -0.082, right -0.082 body units), so the new reading has not drifted.
const near3 = (a, b, label) => assert.ok(Math.abs(a - b) <= 0.0005, `${label}: ${a} vs ${b}`);
near3(rows[0].pelvis.margin, -0.194, 'left-support pelvis margin');
near3(rows[1].pelvis.margin, -0.082, 'double-support pelvis margin');
near3(rows[2].pelvis.margin, -0.082, 'right-support pelvis margin');
for (const r of rows) {
  assert.equal(r.pelvis.inside, r.pelvis.margin >= 0, `${r.name} inside flag follows margin`);
  if (r.pelvis.inside) assert.equal(r.pelvis.offsetX, 0, `${r.name} no x offset when inside`);
  else assert.ok(r.pelvis.offsetX !== 0 || r.pelvis.margin < 0, `${r.name} outside reading is consistent`);
  assert.ok(Number.isFinite(r.pelvis.pelvisY) && r.pelvis.pelvisY > 0, `${r.name} pelvis height is finite and above the deck`);
  near(r.pelvis.pelvisYPhysicalMm, r.pelvis.pelvisY * 1.7 * 1000, `${r.name} physical mm conversion`, 1e-6);
}
// Transitions: the schedule holds one pose, so the pelvis does not move between phases (zero change). This
// pins the current limitation; a schedule that moves the pelvis must update this check.
assert.equal(rows[0].transitionFromPrev, null, 'first phase has no previous transition');
for (const r of rows.slice(1)) {
  near(r.transitionFromPrev.dx, 0, `${r.name} transition dx`, 1e-9);
  near(r.transitionFromPrev.dy, 0, `${r.name} transition dy`, 1e-9);
}

console.log('chasse support scheduling: ok (' + CHASSE_STATUS + ')');
for (const r of rows) {
  console.log(`${r.name.padEnd(15)} contact ${r.support.join('+').padEnd(11)} loads start L${r.loadsStart.left} R${r.loadsStart.right} end L${r.loadsEnd.left} R${r.loadsEnd.right} floating ${r.floating.join('+') || 'none'} gaps mm L ${(r.gaps.left * 1000).toFixed(1)} R ${(r.gaps.right * 1000).toFixed(1)} pelvis margin ${r.pelvis.margin.toFixed(3)} ${r.pelvis.inside ? 'inside' : 'outside'} base`);
}
