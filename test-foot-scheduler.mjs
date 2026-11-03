import assert from 'node:assert/strict';
import { generatedWalkSchedule, withGeneratedWalk, createShow, footAtLocal, footPins, footPinsFromTrajectory, legOverreach, normalise, posAtLocal, poseAtLocal } from './src/model.js';
import { compileFootSchedule } from './src/foot-scheduler.js';
import { sampleFootTrajectory, validateFootTrajectory } from './src/foot-trajectory.js';
import { joints, specOf } from './src/pose.js';

const initial = {
  left: { x: -0.08, y: 0, h: 0, load: 1 },
  right: { x: 0.08, y: 0, h: 0, load: 0 },
};
const schedule = compileFootSchedule({
  startTime: 100,
  startFeet: initial,
  phases: [
    {
      name: 'transfer-and-swing', duration: 400,
      feet: {
        left: { to: { ...initial.left, load: 0.45 }, mode: 'hold' },
        right: { to: { x: 0.08, y: 0.35, h: 0, load: 0.55 }, mode: 'swing', lift: 0.1 },
      },
    },
    {
      name: 'arrive', duration: 300,
      feet: {
        left: { to: { ...initial.left, load: 0 }, mode: 'hold' },
        right: { to: { x: 0.08, y: 0.35, h: 0, load: 1 }, mode: 'hold' },
      },
    },
  ],
});

assert.equal(schedule.start, 100);
assert.equal(schedule.end, 800);
assert.deepEqual(schedule.phases.map(({ start, end }) => [start, end]), [[100, 500], [500, 800]]);
assert.equal(validateFootTrajectory(schedule.trajectory), true);
for (const side of ['left', 'right']) {
  const knots = schedule.trajectory[side];
  assert.equal(knots[0].t, 100);
  assert.equal(knots[1].t, 500);
  assert.equal(knots[2].t, 800);
  const boundary = sampleFootTrajectory(schedule.trajectory, 500)[side];
  assert.deepEqual([boundary.x, boundary.y, boundary.h, boundary.load],
    [knots[1].x, knots[1].y, knots[1].h, knots[1].load],
    `${side} sample is exact and continuous at shared phase boundary`);
}
assert.equal(schedule.trajectory.left[0].toNext, 'hold');
assert.equal(schedule.trajectory.right[0].toNext, 'swing');
assert.equal(schedule.trajectory.right[0].lift, 0.1);
assert.equal(sampleFootTrajectory(schedule.trajectory, 300).right.swing, true);
assert.equal(sampleFootTrajectory(schedule.trajectory, 500).right.swing, false);
assert.equal(sampleFootTrajectory(schedule.trajectory, 650).right.x, 0.08);
assert.equal(sampleFootTrajectory(schedule.trajectory, 650).right.y, 0.35);

assert.throws(() => compileFootSchedule({ startFeet: { left: initial.left }, phases: [{}] }), /startFeet.right/);
assert.throws(() => compileFootSchedule({ startFeet: initial, phases: [] }), /non-empty/);
assert.throws(() => compileFootSchedule({ startFeet: initial, phases: [{ duration: 0, feet: {} }] }), /duration/);
assert.throws(() => compileFootSchedule({
  startFeet: initial,
  phases: [{ duration: 10, feet: {
    left: { to: { x: 1, y: 0, h: 0, load: 1 }, mode: 'hold' },
    right: { to: initial.right, mode: 'hold' },
  } }],
}), /hold must keep/);
assert.throws(() => compileFootSchedule({
  startFeet: initial,
  phases: [{ duration: 10, feet: {
    left: { to: { ...initial.left, load: 1.5 } }, right: { to: initial.right },
  } }],
}), /load in \[0, 1\]/);
console.log('authored foot scheduler: ok');

// Adapter + solver check: ordinary authored tracks reach attainable contacts and do not hide an
// impossible contact. This does not route into legacy show diagnostics.
const show = createShow();
const dancer = { keys: [{ t: 0, x: 0, y: 0, pose: 'first' }] };
const reachable = compileFootSchedule({
  startFeet: {
    left: { x: 0.08, y: 0, h: 0, load: 0.5 },
    right: { x: -0.08, y: 0, h: 0, load: 0.5 },
  },
  phases: [{ duration: 1000, feet: {
    left: { to: { x: 0.08, y: 0, h: 0, load: 0.5 }, mode: 'hold' },
    right: { to: { x: -0.08, y: 0, h: 0, load: 0.5 }, mode: 'hold' },
  } }],
});
const localTime = 500;
const pins = footPinsFromTrajectory(show, dancer, localTime, reachable.trajectory);
const at = poseAtLocal(dancer, localTime);
const solved = joints(specOf(at.pose), at.facing, at.turn, pins);
assert.equal(solved.shortfall[0], null, 'reachable compiled contact solves');
assert.equal(solved.shortfall[1], null, 'second reachable compiled contact solves');

const far = compileFootSchedule({
  startFeet: {
    left: { x: 0.08, y: 0, h: 0, load: 1 },
    right: { x: -0.08, y: 0, h: 0, load: 0 },
  },
  phases: [{ duration: 1000, feet: {
    left: { to: { x: 3, y: 0, h: 0, load: 1 }, mode: 'linear' },
    right: { to: { x: -0.08, y: 0, h: 0, load: 0 }, mode: 'hold' },
  } }],
});
const farPins = footPinsFromTrajectory(show, dancer, localTime, far.trajectory);
const farSolved = joints(specOf(at.pose), at.facing, at.turn, farPins);
assert(farSolved.shortfall[0] && farSolved.shortfall[0].over > 0.001,
  'deliberately unreachable scheduled contact remains visible in solver shortfall');
assert(Number.isFinite(posAtLocal(dancer, localTime).x));
console.log('authored foot scheduler adapter/solver checks: ok');

// Attaching a compiled track opts normal footPins consumers into it; unscheduled dancers keep the
// established station path. Saved-show reach diagnostics still operate on the legacy input source.
const attached = { ...dancer, footTrajectory: reachable.trajectory };
const attachedPins = footPins(show, attached, localTime);
assert.deepEqual(attachedPins, pins, 'normal footPins path uses an explicitly attached trajectory');
assert.notEqual(footPins(show, dancer, localTime).left.sx, attachedPins.left.sx,
  'unscheduled dancer remains on legacy station contacts, not attached track');
const attachedFar = { ...dancer, keys: [{ t: 0, x: 0, y: 0, pose: 'first' }, { t: 1000, x: 0, y: 0, pose: 'first' }], footTrajectory: far.trajectory };
assert(legOverreach(show, attachedFar, 1),
  'existing reach diagnostic reports an unreachable attached scheduled contact');
const attachedShow = normalise({ ...show, cast: [attached] });
assert(attachedShow.cast[0].footTrajectory, 'valid attached tracks persist through show normalization');
const invalidShow = normalise({ ...show, cast: [{ ...dancer, footTrajectory: { left: [] } }] });
assert.equal(invalidShow.cast[0].footTrajectory, undefined, 'invalid attached tracks are discarded safely');

// One generated walk keeps the start support's exact stage mark, transfers load before swing,
// lands the arriving ankle on its destination station mark, and leaves a long miss diagnosable.
const walkShow = createShow();
const walkDancer = {
  id: 'walk-prototype',
  keys: [
    { t: 0, x: 0, y: 3, pose: 'none', plant: 'left' },
    { t: 2000, x: 0.3, y: 3, pose: 'none', plant: 'right', step: 'walk' },
  ],
};
const generated = generatedWalkSchedule(walkShow, walkDancer, 1);
assert(generated, 'ordinary single walk interval compiles');
assert.deepEqual([generated.startPlant, generated.arrivalPlant], ['left', 'right']);
const startLeft = sampleFootTrajectory(generated.trajectory, 0).left;
const startRight = sampleFootTrajectory(generated.trajectory, 0).right;
const endRight = sampleFootTrajectory(generated.trajectory, 2000).right;
const expectedStartLeft = footPinsFromTrajectory(walkShow, walkDancer, 0,
  { left: [{ t: 0, x: startLeft.x, y: startLeft.y, h: startLeft.h, load: 1 }] }).left;
assert.equal(startLeft.x, footPins(walkShow, walkDancer, 0).left.sx);
assert.equal(startLeft.y, footPins(walkShow, walkDancer, 0).left.sy);
assert.equal(startLeft.follow, 1);
assert.equal(startRight.follow, 0);
assert.equal(endRight.x, footAtLocal(walkShow, walkDancer, 2000, 'right').x);
assert.equal(endRight.y, footAtLocal(walkShow, walkDancer, 2000, 'right').y);
assert.equal(endRight.follow, 1, 'arriving ankle follows its authored station contact at landing');
const endLeft = sampleFootTrajectory(generated.trajectory, 2000).left;
const inTransfer = sampleFootTrajectory(generated.trajectory, 1000);
assert.equal(endLeft.x, startLeft.x, 'the departure foot remains on its starting stage mark through the interval');
assert.equal(endLeft.y, startLeft.y);
assert.equal(endLeft.load, 0, 'the departure foot has released support at the endpoint');
assert.equal(endLeft.follow, 0, 'the released departure foot is no longer position-pinned at landing');
assert(inTransfer.left.load > 0 && inTransfer.left.load < 1);
assert(inTransfer.right.load > 0 && inTransfer.right.load < 1);
assert.equal(inTransfer.right.follow, 0, 'unweighted swing foot follows freely before lift-off');
const attachedWalk = withGeneratedWalk(walkShow, walkDancer, 1);
assert.deepEqual(footPins(walkShow, attachedWalk.dancer, 1500),
  footPinsFromTrajectory(walkShow, walkDancer, 1500, generated.trajectory),
  'generated schedule is connected to normal foot pin evaluation inside its authored interval');
assert.deepEqual(footPins(walkShow, attachedWalk.dancer, 2500), footPins(walkShow, walkDancer, 2500),
  'the generated track does not clamp over later choreography');
assert.deepEqual(footPins(walkShow, attachedWalk.dancer, -1), footPins(walkShow, walkDancer, -1),
  'the generated track does not override choreography before its interval');
assert.deepEqual(attachedWalk.dancer.footTrajectoryRange, { start: 0, end: 2000 });
const normalizedWalk = normalise({ ...walkShow, cast: [attachedWalk.dancer] }).cast[0];
assert.deepEqual(normalizedWalk.footTrajectoryRange, { start: 0, end: 2000 },
  'the generated interval boundary survives show normalization');
assert.equal(generatedWalkSchedule(walkShow, { keys: [{ t: 0 }, { t: 1000, step: 'chasse' }] }, 1), null,
  'other named moves are not rewritten as generic walks');
assert.equal(generatedWalkSchedule(walkShow, { keys: [{ t: 0 }, { t: 0, step: 'walk' }] }, 1), null,
  'zero-duration interval is rejected');
const longWalk = {
  id: 'long-walk',
  keys: [
    { t: 0, x: 0, y: 3, pose: 'first', plant: 'left' },
    { t: 2000, x: 2, y: 3, pose: 'none', plant: 'right', step: 'walk' },
  ],
};
const longSchedule = generatedWalkSchedule(walkShow, longWalk, 1);
assert(legOverreach(walkShow, { ...longWalk, footTrajectory: longSchedule.trajectory, footTrajectoryRange: { start: 0, end: 2000 } }, 1),
  'very long generated step retains honest reach warning');
assert.equal(expectedStartLeft.w, 1);
console.log('generated walk prototype: ok');

