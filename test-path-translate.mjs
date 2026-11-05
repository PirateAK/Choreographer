import assert from 'node:assert/strict';
import { addCast, createShow, pathStationTranslationDelta, translatePathStation, pathTranslationDelta, translatePathTrack } from './src/model.js';

const show = createShow();
show.stage.width = 10;
show.stage.depth = 8;
show.stage.wingDepth = 2;
const dancer = addCast(show);
dancer.keys = [
  { t: 0, x: -1, y: 1, pose: 'first', bend: 0.2 },
  { t: 1200, x: 2, y: 5, pose: 'second', turn: 90 },
];
dancer.footTrajectory = {
  left: [{ t: 0, x: -1.5, y: 1.2, h: 0, load: 1 }],
  right: [{ t: 600, x: 1.5, y: 4, h: 0.1, load: 0 }],
};
const original = structuredClone(dancer);
assert.deepEqual(pathTranslationDelta(dancer, 0.5, 0, show), { x: 0.5, y: 0 });
assert.equal(translatePathTrack(dancer, 0.5, 0, show), true);
assert.deepEqual(dancer.keys.map((k) => [k.t, k.x, k.y]), [[0, -0.5, 1], [1200, 2.5, 5]]);
assert.deepEqual(dancer.footTrajectory.left.map((k) => [k.t, k.x, k.y]), [[0, -1, 1.2]]);

// Single-station nudges move only the selected arrival mark; foot knots remain absolute until the phase is explicitly recalculated.
const single = structuredClone(original);
assert.deepEqual(pathStationTranslationDelta(single, 1, -0.5, 0.5, show), { x: -0.5, y: 0.5 });
assert.equal(translatePathStation(single, 1, -0.5, 0.5, show), true);
assert.deepEqual(single.keys.map((k) => [k.x, k.y]), [[-1, 1], [1.5, 5.5]]);
assert.deepEqual(single.footTrajectory, original.footTrajectory, 'station nudge does not move separate foot trajectory knots');
assert.deepEqual(single.keys[1].turn, original.keys[1].turn);
assert.equal(pathStationTranslationDelta(single, 1, 20, 0, show).x, 5.5, 'station clamps independently at the wing edge');
assert.equal(translatePathStation(single, 99, 1, 0, show), false);

assert.deepEqual(dancer.footTrajectory.right.map((k) => [k.t, k.x, k.y]), [[600, 2, 4]]);
assert.equal(dancer.keys[0].pose, original.keys[0].pose);
assert.equal(dancer.keys[1].turn, original.keys[1].turn);
assert.equal(dancer.footTrajectory.right[0].h, original.footTrajectory.right[0].h);

// Clamp a common delta at the boundary without changing path shape or the generated foot tracks.
assert.deepEqual(pathTranslationDelta(dancer, 6, 6, show), { x: 4.5, y: 3.5 });
assert.equal(translatePathTrack(dancer, 6, 6, show), true);
assert.deepEqual(dancer.keys.map((k) => [k.x, k.y]), [[4, 4.5], [7, 8.5]]);
assert.deepEqual(dancer.footTrajectory.left[0] && [dancer.footTrajectory.left[0].x, dancer.footTrajectory.left[0].y], [3.5, 4.7]);
assert.equal(pathTranslationDelta(dancer, 1, 0, show), null, 'track cannot be shifted beyond the common boundary');
assert.equal(translatePathTrack(dancer, 0, 0, show), false);
assert.equal(translatePathTrack({ keys: [] }, 1, 0, show), false);
assert.equal(translatePathTrack(null, 1, 0, show), false);
console.log('whole-track translation: ok');
