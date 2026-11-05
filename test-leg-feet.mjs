import assert from 'node:assert/strict';
import { BODY, FLOOR_REF, POSE_SPECS, joints, footGeometry, legContours, poseSvg } from './src/pose.js';

const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-9, `${message}: ${a} != ${b}`);
for (const turn of [0, 45, 90, 180, 270, 360]) for (const facing of [-1, 1]) {
  for (const rise of [0, 0.015, 0.03, 0.045, 0.06]) {
    const spec = { ...POSE_SPECS.first, rise, turnout: 55 };
    const figure = joints(spec, facing, turn);
    const feet = footGeometry(spec, figure, facing, turn);
    for (let i = 0; i < 2; i++) {
      const [hip, knee, ankle] = figure.legs3[i];
      near(Math.hypot(...hip.map((v, k) => v - knee[k])), BODY.leg, 'thigh unchanged');
      near(Math.hypot(...knee.map((v, k) => v - ankle[k])), BODY.leg, 'shin unchanged');
      const foot = feet[i];
      near(foot.toe[1], ankle[1] - FLOOR_REF - rise, 'toe follows ankle, not requested contact');
      assert.ok(foot.heel[1] >= foot.toe[1] - 1e-9);
      if (rise === 0.06) { near(foot.toe[0], ankle[0], 'pointe toe below ankle x'); near(foot.toe[2], ankle[2], 'pointe toe below ankle depth'); }
      assert.ok(legContours(figure.legs[i]).flat().flat().every(Number.isFinite));
    }
    const svg = poseSvg({ spec, x: 0, y: 300, h: 250, body: '#fff', ink: '#111', facing, turn }).svg.join('');
    assert.ok(svg.includes('<polygon'));
    assert.ok(!/NaN|Infinity/.test(svg));
  }
}
// Feet must follow even unreachable or airborne ankles, never snap to a floor.
const spec = { ...POSE_SPECS.first, rise: 0.03 };
const figure = joints(spec);
figure.legs3[0][2][1] += 0.2;
near(footGeometry(spec, figure)[0].toe[1], figure.legs3[0][2][1] - FLOOR_REF - 0.03, 'lifted shoe follows ankle');
for (const pose of Object.values(POSE_SPECS)) for (const leg of joints(pose).legs) {
  assert.ok(legContours(leg).flat().flat().every(Number.isFinite));
}
console.log('Leg/foot geometry: fixed bones, roll, turns, lift and SVG pass');
