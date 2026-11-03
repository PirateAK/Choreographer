import assert from 'node:assert/strict';
import { contactFrame } from './src/contact-frame.js';
import { BODY, joints, specOf, POSE_SPECS } from './src/pose.js';
import { createShow, overheadPoseAtLocal } from './src/model.js';
import { StageView } from './src/stage.js';

const near = (a, b, message) => assert(Math.abs(a - b) < 1e-8, `${message}: ${a} vs ${b}`);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.h - b.h);
for (const facing of [-1, 1]) for (const turn of [0, 45, 90, 180, 270, 360, 720, -90]) {
  const frame = contactFrame({ x: 1.2, y: 3.4 }, 1.7, facing, turn);
  const point = [0.21, 0.39, -0.26];
  const roundtrip = frame.toLocal(frame.toStage(point));
  roundtrip.forEach((n, i) => near(n, point[i], 'frame roundtrip'));
}
// A known reachable ankle and an impossible target must both preserve segment length.
for (const target of [{ x: 0.12, y: 0.12, z: 0.08, w: 1 }, { x: 3, y: 0, z: 2, w: 1 }]) {
  const figure = joints(specOf('first'), 1, 0, { left: target });
  const leg = figure.legs3[0];
  for (let i = 1; i < 3; i++) near(Math.hypot(...leg[i].map((v, k) => v - leg[i - 1][k])), BODY.leg, 'solver segment');
  if (target.x < 1) {
    assert.equal(figure.shortfall[0], null);
    leg[2].forEach((v, i) => near(v, [target.x, target.y, target.z][i], 'reachable contact'));
  } else assert(figure.shortfall[0].over > 1);
}
const show = createShow();
const beforeSpecs = JSON.stringify(POSE_SPECS);
let warnings = 0;
for (const facing of [-1, 1]) for (const turn of [0, 90, 180, 270, 360]) {
  const dancer = { keys: [
    { t: 0, x: 0, y: 2, pose: 'tendu', plant: 'left', facing, turn },
    { t: 2000, x: 4, y: 3, pose: 'tendu', plant: 'left', facing, turn },
  ] };
  const before = JSON.stringify(dancer);
  for (let t = 0; t <= 2000; t += 100) {
    const solved = overheadPoseAtLocal(show, dancer, t);
    for (const leg of solved.legs) for (let i = 1; i < 3; i++) near(distance(leg[i - 1], leg[i]), BODY.leg * show.stage.dancerH, 'world segment');
    for (const [i, side] of ['left', 'right'].entries()) {
      const foot = solved.feet[side];
      near(distance(foot, solved.legs[i][2]), 0, 'foot must be solved ankle');
      if (foot.unreachable) {
        assert.equal(foot.held, false);
        near(distance(foot, foot.target), foot.shortfall, 'gap equals solver shortfall');
        if (foot.shortfall > 0.005) warnings++;
      }
    }
    assert.equal(JSON.stringify(overheadPoseAtLocal(show, dancer, t)), JSON.stringify(solved), 'scrub determinism');
    // Capture the actual renderer's two leg paths and marker centers, not just helper output.
    for (const tilt of [0, 35, 55]) {
      const paths = [], arcs = []; let path = [];
      const ctx = new Proxy({}, { get(_, key) {
        if (key === 'beginPath') return () => { path = []; };
        if (key === 'moveTo' || key === 'lineTo') return (x, y) => path.push({ x, y });
        if (key === 'stroke') return () => paths.push(path.slice());
        if (key === 'arc') return (x, y) => arcs.push({ x, y });
        return () => {};
      }, set() { return true; } });
      const view = Object.create(StageView.prototype);
      view.ctx = ctx; view.scale = 50; view.alpha = c => c; view.tiltAngle = () => tilt * Math.PI / 180;
      view.w2s = (x, y, h = 0) => ({ x: x * 50, y: (-y * Math.cos(tilt * Math.PI / 180) - h * Math.sin(tilt * Math.PI / 180)) * 50 });
      view.drawOverhead(dancer, { x: 0, y: 0 }, t, solved);
      for (let i = 0; i < 2; i++) {
        const expected = solved.legs[i].map(j => view.w2s(j.x, j.y, j.h));
        assert.deepEqual(paths[i * 2], expected, 'renderer must not replace ankle after solve');
      }
      view.drawFeet(dancer, t, solved);
      for (const [i, side] of ['left', 'right'].entries()) {
        const f = solved.feet[side];
        assert.deepEqual(arcs[arcs.length - 2 + i], view.w2s(f.x, f.y, f.h), 'marker matches ankle, including tilt');
      }
    }
  }
  assert.equal(JSON.stringify(dancer), before, 'no choreography mutation');
}
assert(warnings > 0, 'unreachable fixture must exercise visible gaps');
assert.equal(JSON.stringify(POSE_SPECS), beforeSpecs, 'shared specs unchanged');
assert.equal(overheadPoseAtLocal(show, { keys: [] }, 0), null);
console.log('contact geometry and renderer tests passed: transforms, lengths, reach gaps, marker alignment, tilt and deterministic scrubbing');
