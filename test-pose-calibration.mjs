// Engine calibration checks: shared geometry and contacts agree. Not a ballet-correctness certification.
import assert from 'node:assert/strict';
import { BODY, POSE_SPECS, PLANT_BY_POSE, joints, feetPlaceOf } from './src/pose.js';
import { createShow, overheadPoseAtLocal } from './src/model.js';

const near = (a, b, eps, msg) => assert(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const ids = Object.keys(POSE_SPECS);

// Contacts are read from the same unpinned legs the figure draws, for every facing and turn.
for (const id of ids) {
  const spec = POSE_SPECS[id];
  const own = joints(spec, 1, 0, null).legs3;
  for (const facing of [1, -1]) {
    for (const turn of [0, 45, 90, 180, 270, -30]) {
      const a = (turn * Math.PI) / 180;
      feetPlaceOf(spec, facing, turn).forEach((place, i) => {
        const [x, y, z] = own[i][2];
        near(place.x, facing * (x * Math.cos(a) + z * Math.sin(a)), 1e-12, `${id} x`);
        near(place.y, y, 1e-12, `${id} y`);
        near(place.z, z * Math.cos(a) - x * Math.sin(a), 1e-12, `${id} z`);
      });
    }
  }
}

// Bones keep the solver's length whether pinned or not, including tipped (rocked) positions.
for (const id of ids) {
  const spec = POSE_SPECS[id];
  const len = BODY.leg + (spec.rise || 0) / 2;
  const fp = feetPlaceOf(spec);
  const plant = PLANT_BY_POSE[id] || 'both';
  const pins = {};
  if (plant !== 'right') pins.left = { ...fp[0], w: 1 };
  if (plant !== 'left') pins.right = { ...fp[1], w: 1 };
  for (const figure of [joints(spec), joints(spec, 1, 0, pins)]) {
    for (const [hip, knee, ankle] of figure.legs3) {
      near(dist(hip, knee), len, 1e-9, `${id} thigh`);
      near(dist(knee, ankle), len, 1e-9, `${id} shin`);
    }
  }
}

// A rock tips the feet behind her and does not lift the supporting foot off the floor.
for (const id of ids.filter((p) => POSE_SPECS[p].rock)) {
  const spec = POSE_SPECS[id];
  const flat = joints({ ...spec, rock: 0 }).legs3;
  const rocked = joints(spec).legs3;
  const low = (legs) => Math.min(...legs.map((l) => l[2][1]));
  near(low(rocked), low(flat), 1e-12, `${id} rock keeps support on floor`);
  rocked.forEach((l, i) => assert(l[2][2] < flat[i][2][2], `${id} rock puts foot upstage`));
}

// Weight shift keeps every standing foot on its own contact at any weight, with only a tiny settle.
for (const id of ids) {
  const plant = PLANT_BY_POSE[id];
  if (plant !== 'left' && plant !== 'right') continue;
  const spec = POSE_SPECS[id];
  const i = plant === 'left' ? 0 : 1;
  const fp = feetPlaceOf(spec)[i];
  for (const w of [0.25, 0.5, 1]) {
    const j = joints(spec, 1, 0, { [plant]: { ...fp, w } });
    assert.equal(j.shortfall[i], null, `${id} stance holds at w=${w}`);
    if (w === 1) near(dist(j.legs3[i][2], [fp.x, fp.y, fp.z]), 0, 1e-6, `${id} stance ankle on contact`);
    const settle = joints(spec).legs3[i][0][1] - j.legs3[i][0][1];
    assert(settle >= 0 && settle < 0.001, `${id} weight-shift settle stays tiny (${settle})`);
    assert(Math.sign(j.pelvis[0]) === Math.sign(fp.x), `${id} hips travel towards the supporting foot`);
  }
  // Honesty: a contact moved away is still reported, not absorbed by the settle.
  const far = joints(spec, 1, 0, { [plant]: { ...fp, x: fp.x + 0.08, w: 1 } });
  assert(far.shortfall[i] && far.shortfall[i].over > 0.001, `${id} displaced contact still reported`);
}

// Every stationary position, through the overhead evaluation, shows no missed contact.
const show = createShow();
for (const pose of ids) {
  for (const t of [0, 500]) {
    const solved = overheadPoseAtLocal(show, { keys: [{ t: 0, x: 0.4, y: 3, pose }] }, t);
    for (const [side, foot] of Object.entries(solved.feet)) {
      assert(!foot.unreachable && foot.shortfall < 1e-6, `${pose} ${side} stationary contact`);
    }
  }
}

console.log('pose calibration: ok');
