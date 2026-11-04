// Provisional three-phase chassé support schedule. Engine readings only: not school-approved, not
// attached to any dancer, and not part of the scored review.
// Geometry is the existing chasse pose, unchanged. This module assigns which foot carries support in
// each phase and compiles that as a foot-scheduler track. Phase timing (CHASSE_PHASE_MS) is provisional.
// Track values are body units (1 = dancer height), local to the pose; converting to stage metres is
// required before attaching the track to a dancer. No flight phase is defined (school to confirm).
import { feetPlaceOf, FLOOR_REF } from './pose.js';
import { compileFootSchedule } from './foot-scheduler.js';
import { sampleFootTrajectory } from './foot-trajectory.js';

export const CHASSE_PHASE_MS = 400; // provisional duration of each phase, milliseconds
export const CHASSE_CONTACT_TOL = 0.002; // body units, same tolerance as the basic-movement review

export const CHASSE_PHASES = [
  { name: 'left-support', support: ['left'], free: 'right' },
  { name: 'double-support', support: ['left', 'right'], free: null },
  { name: 'right-support', support: ['right'], free: 'left' },
];

const SIDE_INDEX = { left: 0, right: 1 };

const toPoint = (p, load) => ({ x: p.x, y: p.y, h: p.z, load });

// Compile the phase schedule for a chassé spec. Both ankles hold their pose positions in every phase;
// only the support load moves between phases. Holding the pose positions means any floor gap is the
// pose's own gap, reported rather than corrected.
export function chasseSchedule(spec, { phaseMs = CHASSE_PHASE_MS } = {}) {
  const ank = feetPlaceOf(spec, 1, 0);
  const startFeet = { left: toPoint(ank[0], 1), right: toPoint(ank[1], 0) };
  const phases = CHASSE_PHASES.map((ph) => ({
    name: ph.name,
    duration: phaseMs,
    feet: {
      left: { to: toPoint(ank[0], ph.support.includes('left') ? 1 : 0), mode: 'hold' },
      right: { to: toPoint(ank[1], ph.support.includes('right') ? 1 : 0), mode: 'hold' },
    },
  }));
  return compileFootSchedule({ startFeet, phases });
}

// Per-phase readings at each phase's midpoint. Support gaps are measured against FLOOR_REF (body units).
// A free foot passes when it is at or above the reference (within tolerance); a support foot's gap is
// reported but not judged here, because a floor gap in the pose is shown rather than hidden.
export function chassePhaseReadings(spec, opts = {}) {
  const sched = chasseSchedule(spec, opts);
  return CHASSE_PHASES.map((def, i) => {
    const phase = sched.phases[i];
    const s = sampleFootTrajectory(sched.trajectory, (phase.start + phase.end) / 2);
    // Loads ramp across each phase, so the defined states are the start and end values.
    const a = sampleFootTrajectory(sched.trajectory, phase.start);
    const b = sampleFootTrajectory(sched.trajectory, phase.end);
    const gaps = {
      left: s.left.y - FLOOR_REF,
      right: s.right.y - FLOOR_REF,
    };
    const freeGap = def.free ? gaps[def.free] : null;
    return {
      name: def.name,
      support: def.support,
      supportIdx: def.support.map((side) => SIDE_INDEX[side]),
      loadsStart: { left: a.left.load, right: a.right.load },
      loadsEnd: { left: b.left.load, right: b.right.load },
      gaps,
      freeGap,
      freeAboveRef: def.free ? freeGap >= -CHASSE_CONTACT_TOL : null,
    };
  });
}
