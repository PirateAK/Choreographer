import { validateFootTrajectory } from './foot-trajectory.js';

const SIDES = ['left', 'right'];
const MODES = new Set(['hold', 'linear', 'swing']);
const POSITION_EPS = 1e-9;

function point(value, label) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) ||
      !Number.isFinite(value.h) || !Number.isFinite(value.load) || value.load < 0 || value.load > 1) {
    throw new TypeError(`${label} must provide finite x/y/h and load in [0, 1]`);
  }
  const out = { x: value.x, y: value.y, h: value.h, load: value.load };
  if (value.follow != null) {
    if (!Number.isFinite(value.follow) || value.follow < 0 || value.follow > 1) {
      throw new RangeError(`${label} follow must be in [0, 1]`);
    }
    out.follow = value.follow;
  }
  return out;
}

function samePosition(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.h - b.h) <= POSITION_EPS;
}

// Compile explicit bilateral phase descriptions into the stage-space knot format consumed by
// sampleFootTrajectory(). This is a deterministic track compiler, not automatic choreography.
//
// Input:
// {
//   startTime?, startFeet: { left: {x,y,h,load}, right: {...} },
//   phases: [{ name?, duration, feet: {
//     left: { to: {x,y,h,load}, mode?, lift? }, right: {...}
//   }}]
// }
// Each phase specifies the destination and segment mode for both feet. The previous phase's
// destination is the next phase's start, so gaps, jumps, and load discontinuities cannot be inferred.
export function compileFootSchedule({ startTime = 0, startFeet, phases } = {}) {
  if (!Number.isFinite(startTime)) throw new TypeError('startTime must be finite');
  if (!Array.isArray(phases) || !phases.length) throw new TypeError('phases must be a non-empty array');
  if (!startFeet || typeof startFeet !== 'object') throw new TypeError('startFeet must specify both feet');

  const current = {};
  const tracks = { left: [], right: [] };
  for (const side of SIDES) {
    current[side] = point(startFeet[side], `startFeet.${side}`);
    tracks[side].push({ t: startTime, ...current[side] });
  }

  let time = startTime;
  const compiledPhases = [];
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    if (!phase || typeof phase !== 'object') throw new TypeError(`phase ${i} must be an object`);
    if (!Number.isFinite(phase.duration) || phase.duration <= 0) {
      throw new RangeError(`phase ${i} duration must be positive and finite`);
    }
    if (!phase.feet || typeof phase.feet !== 'object') throw new TypeError(`phase ${i} must specify both feet`);

    const start = time, end = start + phase.duration;
    if (!Number.isFinite(end) || !(end > start)) throw new RangeError(`phase ${i} end time must increase`);
    const modes = {};
    for (const side of SIDES) {
      const movement = phase.feet[side];
      if (!movement || typeof movement !== 'object') throw new TypeError(`phase ${i} must specify ${side}`);
      const mode = movement.mode || 'linear';
      if (!MODES.has(mode)) throw new TypeError(`phase ${i} ${side} has unknown mode`);
      const destination = point(movement.to, `phase ${i} ${side}.to`);
      if (mode === 'hold' && !samePosition(current[side], destination)) {
        throw new RangeError(`phase ${i} ${side} hold must keep the same ankle position`);
      }
      if (movement.lift != null && (!Number.isFinite(movement.lift) || movement.lift < 0)) {
        throw new RangeError(`phase ${i} ${side} lift must be finite and non-negative`);
      }
      const fromKnot = tracks[side][tracks[side].length - 1];
      fromKnot.toNext = mode;
      if (movement.lift != null) fromKnot.lift = movement.lift;
      tracks[side].push({ t: end, ...destination, follow: destination.follow == null ? 1 : destination.follow });
      current[side] = destination;
      modes[side] = mode;
    }
    compiledPhases.push({ name: typeof phase.name === 'string' ? phase.name : `phase-${i + 1}`, start, end, modes });
    time = end;
  }

  const trajectory = { left: tracks.left, right: tracks.right };
  validateFootTrajectory(trajectory);
  return { trajectory, phases: compiledPhases, start: startTime, end: time };
}
