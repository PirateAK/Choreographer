import assert from 'node:assert/strict';
import { limbContour } from './src/limb-shape.js';

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const verifyContour = (points, radii, contour = limbContour(points, radii)) => {
  assert.equal(contour.length, points.length * 2);
  assert.ok(contour.flat().every(Number.isFinite), 'all contour coordinates are finite');
  return contour;
};

// Straight centerline preserves each requested diameter and taper profile.
const straight = [[0, 0], [0, 1], [0, 2]];
const straightRadii = [0.033, 0.029, 0.017];
const straightBefore = structuredClone(straight);
const radiiBefore = [...straightRadii];
const straightContour = verifyContour(straight, straightRadii);
for (let i = 0; i < straight.length; i++) {
  assert.ok(Math.abs(distance(straightContour[i], straightContour[2 * straight.length - 1 - i]) - 2 * straightRadii[i]) < 1e-10);
}
assert.deepEqual(straight, straightBefore, 'does not mutate points');
assert.deepEqual(straightRadii, radiiBefore, 'does not mutate radii');

// A bent limb retains finite offsets around the joint and mirrors cleanly.
const bent = [[0.2, -0.4], [0.45, 0.1], [0.8, 0.25]];
const bentRadii = [0.033, 0.029, 0.017];
const bentContour = verifyContour(bent, bentRadii);
const mirroredContour = verifyContour(bent.map(([x, y]) => [-x, y]), bentRadii);
for (const [x, y] of bentContour) {
  assert.ok(mirroredContour.some(([mx, my]) => Math.abs(mx + x) < 1e-10 && Math.abs(my - y) < 1e-10));
}

// Coincident/foreshortened samples, including an entirely collapsed limb.
const coincident = [[1, 1], [1, 1], [1, 2], [1, 2]];
const coincidentContour = verifyContour(coincident, [0.03, 0.02, 0.02, 0.01]);
assert.ok(distance(coincidentContour[0], coincidentContour[7]) > 0);
verifyContour([[2, 3], [2, 3], [2, 3]], [0.03, 0.02, 0.01]);
verifyContour([[0, 0], [1e-14, 0]], [0.03, 0.01]);

assert.throws(() => limbContour([[0, 0]], [0.1]), /at least two/);
assert.throws(() => limbContour([[0, 0], [1, 0]], [0.1]), /match/);
assert.throws(() => limbContour([[0, 0], [NaN, 0]], [0.1, 0.1]), /finite/);
assert.throws(() => limbContour([[0, 0], [1, 0]], [0.1, 0]), /positive finite/);

console.log('limb-shape tests passed');
