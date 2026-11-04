// Provisional three-phase chassé support scheduling. SUPPORT SCHEDULING ONLY: not a validated chassé.
// Geometry is the existing chasse pose, unchanged. The feet float 33–40 mm above the floor reference in
// this pose, so the load schedule does not establish valid physical contact or balance until the geometry
// is addressed. Phase timing (CHASSE_PHASE_MS) is provisional. Not school-approved. No flight phase.
//
// Contact state and support load are separate. Contact is a per-phase flag: a foot in contact must sit on
// the floor reference. Load is the support weight, transferred smoothly across the track; in the double
// support phase both feet are in contact and the load moves from left to right (the two loads sum to 1).
// Track values are body units (1 = dancer height), local to the pose; conversion to stage metres is required
// before attaching the track to a dancer.
import { feetPlaceOf, FLOOR_REF } from './pose.js';
import { compileFootSchedule } from './foot-scheduler.js';
import { sampleFootTrajectory } from './foot-trajectory.js';

export const CHASSE_STATUS = 'support scheduling only; not a validated chassé (feet float above the floor reference)';
export const CHASSE_PHASE_MS = 400; // provisional duration of each phase, milliseconds
export const CHASSE_CONTACT_TOL = 0.002; // body units, same tolerance as the basic-movement review

// `load` is the support weight at the phase's end; `contact` is the floor-contact state for the phase.
export const CHASSE_PHASES = [
  { name: 'left-support', contact: { left: true, right: false }, load: { left: 1, right: 0 }, free: 'right' },
  { name: 'double-support', contact: { left: true, right: true }, load: { left: 0, right: 1 }, free: null },
  { name: 'right-support', contact: { left: false, right: true }, load: { left: 0, right: 1 }, free: 'left' },
];

const SIDE_INDEX = { left: 0, right: 1 };
const SIDES = ['left', 'right'];

const toPoint = (p, load) => ({ x: p.x, y: p.y, h: p.z, load });

// Compile the phase schedule for a chassé spec. Both ankles hold their pose positions in every phase; only
// the support load moves between phases. Any floor gap is the pose's own gap, reported rather than corrected.
export function chasseSchedule(spec, { phaseMs = CHASSE_PHASE_MS } = {}) {
  const ank = feetPlaceOf(spec, 1, 0);
  const pos = { left: ank[0], right: ank[1] };
  // Start loads are the first phase's start state (left carries weight, right is free).
  const startFeet = {
    left: toPoint(pos.left, CHASSE_PHASES[0].load.left),
    right: toPoint(pos.right, CHASSE_PHASES[0].load.right),
  };
  const phases = CHASSE_PHASES.map((ph) => ({
    name: ph.name,
    duration: phaseMs,
    feet: {
      left: { to: toPoint(pos.left, ph.load.left), mode: 'hold' },
      right: { to: toPoint(pos.right, ph.load.right), mode: 'hold' },
    },
  }));
  return compileFootSchedule({ startFeet, phases });
}

// Per-phase readings. Gaps are measured against FLOOR_REF (body units). Loads are reported at the phase's
// start and end because they ramp across the phase. Contacted feet are checked against the reference and
// flagged `floating` when they are not on it; that flag is the result the pose must answer, not a fault
// to hide. A free foot passes when it is at or above the reference.
export function chassePhaseReadings(spec, opts = {}) {
  const sched = chasseSchedule(spec, opts);
  return CHASSE_PHASES.map((def, i) => {
    const phase = sched.phases[i];
    const s = sampleFootTrajectory(sched.trajectory, (phase.start + phase.end) / 2);
    const a = sampleFootTrajectory(sched.trajectory, phase.start);
    const b = sampleFootTrajectory(sched.trajectory, phase.end);
    const gaps = { left: s.left.y - FLOOR_REF, right: s.right.y - FLOOR_REF };
    const contacted = SIDES.filter((side) => def.contact[side]);
    const floating = contacted.filter((side) => Math.abs(gaps[side]) > CHASSE_CONTACT_TOL);
    const freeGap = def.free ? gaps[def.free] : null;
    return {
      name: def.name,
      contact: def.contact,
      support: contacted,
      supportIdx: contacted.map((side) => SIDE_INDEX[side]),
      loadsStart: { left: a.left.load, right: a.right.load },
      loadsEnd: { left: b.left.load, right: b.right.load },
      gaps,
      floating,
      freeGap,
      freeAboveRef: def.free ? freeGap >= -CHASSE_CONTACT_TOL : null,
      validated: false,
    };
  });
}
