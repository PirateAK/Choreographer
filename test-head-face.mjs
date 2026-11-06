// Engine check for the head furniture: which features show at each head turn, and that the hair
// cap leaves the eyes uncovered. This checks placement numbers only, not how the face looks.
import assert from 'node:assert/strict';
import { headFace } from './src/pose.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Front: eyes, nose and mouth show, no ear.
const front = headFace(0);
assert.equal(front.eyes.length, 2);
assert.ok(front.nose && front.mouth);
assert.equal(front.ear, null);

// Profile: no front features, the ear shows.
const profile = headFace(90);
assert.equal(profile.eyes.length, 0);
assert.equal(profile.nose, null);
assert.equal(profile.mouth, null);
assert.ok(profile.ear);

// From behind: the face is gone and the cap covers the whole head.
const back = headFace(180);
assert.equal(back.eyes.length, 0);
assert.equal(back.mouth, null);
assert.ok(back.cap.r >= 1 - 1e-9 && Math.abs(back.cap.x) < 1e-9 && Math.abs(back.cap.y) < 1e-9);

// Front hairline sits above the eyes: no eye overlaps the cap.
for (const e of front.eyes) {
  assert.ok(dist(e, front.cap) > front.cap.r + e.ry, 'eye covered by hair cap');
}

// The bun stays inside the head from the front and sticks out behind in profile and from behind.
const inside = (b) => Math.hypot(b.x, b.y) + b.r <= 1 + 1e-9;
assert.ok(inside(front.bun), 'bun visible from the front');
assert.ok(!inside(profile.bun), 'bun sticks out in profile');
assert.ok(back.bun.y + back.bun.r > 1, 'bun sits at the nape from behind');

// Turning the face to the other side mirrors the features across the head.
const left = headFace(-30);
const right = headFace(30);
assert.ok(Math.sign(right.nose.x) === 1 && Math.sign(left.nose.x) === -1, 'nose follows the turn');

// Non-numeric or missing turn falls back to front.
assert.deepEqual(headFace(), headFace(0));
assert.deepEqual(headFace('x'), headFace(0));

console.log('PASS head face placement');
