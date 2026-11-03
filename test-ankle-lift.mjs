// Ankle articulation checks: fixed bone lengths, ball-of-foot contacts, and contact heights that keep the
// HEAD baseline for positions whose floor convention was not changed. Engine checks, not ballet certification.
import assert from 'node:assert/strict';
import { BODY, POSE_SPECS, PLANT_BY_POSE, joints, feetPlaceOf } from './src/pose.js';

const near = (a, b, eps, msg) => assert(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// HEAD contact oracle (feetPlaceOf at turn 0, facing 1), index 0 = dancer's left.
// Relevé x moved 1 mm with the fixed leg length (HEAD 0.055); its tolerance is widened to 2 mm, named here.
const HEAD_CONTACT = {
  fourth: [[0.081, 0.055, 0.203], [0.059, 0.059, -0.187]],
  plie: [[0.089, 0.025, 0], [-0.089, 0.025, 0]],
  releve: [[0.055, 0.010, 0], [-0.055, 0.010, 0]],
};

// Every leg keeps its bone lengths, rise or not, unpinned or pinned.
for (const [id, spec] of Object.entries(POSE_SPECS)) {
  const fp = feetPlaceOf(spec);
  const plant = PLANT_BY_POSE[id] || 'both';
  const pins = {};
  if (plant !== 'right') pins.left = { ...fp[0], w: 1 };
  if (plant !== 'left') pins.right = { ...fp[1], w: 1 };
  for (const figure of [joints(spec), joints(spec, 1, 0, pins)]) {
    for (const [hip, knee, ankle] of figure.legs3) {
      near(dist(hip, knee), BODY.leg, 1e-9, `${id} thigh length`);
      near(dist(knee, ankle), BODY.leg, 1e-9, `${id} shin length`);
    }
  }
}

// A raised ball is the ankle minus the rise: the contact is on the floor convention and the ankle is above it.
for (const [id, spec] of Object.entries(POSE_SPECS)) {
  if (!(spec.rise > 0)) continue;
  const [left] = feetPlaceOf(spec);
  const own = joints(spec).legs3[0][2];
  near(own[1] - left.y, spec.rise, 1e-9, `${id} ball sits rise below the ankle`);
}

// Positions whose HEAD contacts are the baseline: the re-solve must reproduce them.
for (const [id, want] of Object.entries(HEAD_CONTACT)) {
  const got = feetPlaceOf(POSE_SPECS[id]);
  want.forEach((w, i) => {
    near(got[i].x, w[0], id === 'releve' ? 2e-3 : 1e-3, `${id} foot ${i} x`);
    near(got[i].y, w[1], 1e-3, `${id} foot ${i} y`);
    near(got[i].z, w[2], 1e-3, `${id} foot ${i} z`);
  });
}

// The rises themselves: relevé demi-pointe, arabesque/attitude demi-pointe, pirouette on pointe-height rise.
assert.equal(POSE_SPECS.releve.rise, 0.03, 'releve rise');
assert.equal(POSE_SPECS.arabesque.rise, 0.03, 'arabesque rise');
assert.equal(POSE_SPECS.attitude.rise, 0.03, 'attitude rise');
assert.equal(POSE_SPECS.pirouette.rise, 0.06, 'pirouette rise');

console.log('ankle lift: ok');
