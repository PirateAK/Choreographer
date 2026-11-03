import assert from 'node:assert/strict';
import { joints, specOf, blendSpecs } from './src/pose.js';
import { contactFrame } from './src/contact-frame.js';
import {
  createShow, evaluateMovement, footPins, overheadPoseAtLocal, levelBlend, poseAtLocal, posAtLocal, AIR_LIFT,
} from './src/model.js';

// One leap that lands on the floor: airborne at t=0, landed in a wide second position at t=800.
// Landing absorbs the drop, so the leg is asked for a shorter height than the position alone.
const show = createShow();
const dancer = { id: 'd1', keys: [
  { t: 0, x: 0, y: 2, pose: 'second', plant: 'air', level: 'air', lift: AIR_LIFT, facing: 1, turn: 0 },
  { t: 800, x: 0, y: 2, pose: 'second', plant: 'both', level: 'flat', facing: 1, turn: 0 },
  // A far travel on the floor: the leg is asked to reach 3.5 m, so the reach can fail.
  { t: 1600, x: 3.5, y: 2, pose: 'second', plant: 'left', level: 'flat', facing: 1, turn: 0 },
] };
show.cast.push(dancer);

const near = (a, b, message) => assert(Math.abs(a - b) < 1e-9, `${message}: ${a} vs ${b}`);

for (let lt = 0; lt <= 900; lt += 50) {
  const ev = evaluateMovement(show, dancer, lt);
  const at = poseAtLocal(dancer, lt);
  const lvl = levelBlend(at.level, at.nextLevel, at.levelT);
  const posed = blendSpecs(specOf(at.pose), specOf(at.next), at.t);

  // One pin source for every view.
  assert.deepEqual(ev.pins, footPins(show, dancer, lt), `pins match footPins at ${lt}`);

  // One rise/absorb formula, the same one the elevation and the reach warning use.
  near(ev.spec.rise, (posed.rise || 0) + lvl.rise - lvl.absorb / show.stage.dancerH, `rise+absorb at ${lt}`);

  // The lift is the blended height of the feet, not the start level's.
  near(ev.lift, lvl.lift, `blended lift at ${lt}`);
}

// Mid-flight the feet are off the deck by part of the jump, not all or nothing.
const mid = evaluateMovement(show, dancer, 400);
assert(mid.lift > 0 && mid.lift < AIR_LIFT, `lift between air and floor at mid-transition: ${mid.lift}`);

// Landing: the plié is in the leg, so the spec is lower than the pose alone at the landing station.
const landed = evaluateMovement(show, dancer, 800);
assert(landed.lvl.absorb > 0, 'a landing from air absorbs the drop');
assert(landed.spec.rise < landed.lvl.rise, 'absorption lowers the requested leg height');

// Overhead reach agrees with the solver run on the shared spec, at every sampled time. The check
// converts the pins into the body frame independently of overheadPoseAtLocal, then asks the solver.
let unreachableSamples = 0;
for (let lt = 0; lt <= 1600; lt += 50) {
  const ev = evaluateMovement(show, dancer, lt);
  const solved = overheadPoseAtLocal(show, dancer, lt);
  const origin = posAtLocal(dancer, lt);
  // No contacts (fully airborne) means nothing can be unreachable; the overhead must agree.
  if (!ev.pins) {
    assert(!solved.feet.left.unreachable && !solved.feet.right.unreachable, `airborne has no reach fault at ${lt}`);
    continue;
  }
  const frame = contactFrame(origin, ev.h, ev.at.facing, ev.at.turn);
  const local = Object.fromEntries(Object.entries(ev.pins).map(([side, pin]) => {
    const [x, y, z] = frame.toLocal({ x: pin.sx, y: pin.sy, h: pin.y * ev.h });
    return [side, { ...pin, x, y, z }];
  }));
  const direct = joints(ev.spec, 1, 0, local);
  ['left', 'right'].forEach((side, i) => {
    const overheadShort = !!solved.feet[side].unreachable;
    const sharedShort = !!direct.shortfall[i];
    assert.equal(overheadShort, sharedShort, `overhead reach agrees with shared spec for ${side} at ${lt}`);
    if (sharedShort) unreachableSamples++;
  });
}
assert(unreachableSamples > 0, 'the case exercises at least one unreachable contact');
console.log(`movement views: ${unreachableSamples} unreachable foot samples agree`);
console.log('test-movement-views: ok');
