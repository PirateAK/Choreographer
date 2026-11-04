// Provisional three-phase chassé support analysis. SUPPORT ANALYSIS ONLY: not motion, not a pelvis path,
// not a validated chassé. The track holds one pose; it does not describe travel between phases.
// Geometry is the existing chasse pose, unchanged. The feet float 33–40 mm above the floor reference in
// this pose, so the load schedule does not establish valid physical contact or balance until the geometry
// is addressed. Phase timing (CHASSE_PHASE_MS) is provisional. Not school-approved. No flight phase.
//
// Contact state and support load are separate. Contact is a per-phase flag: a foot in contact must sit on
// the floor reference. Load is the support weight, transferred smoothly across the track; in the double
// support phase both feet are in contact and the load moves from left to right (the two loads sum to 1).
// Track values are body units (1 = dancer height), local to the pose; conversion to stage metres is required
// before attaching the track to a dancer.
import { feetPlaceOf, FLOOR_REF, joints, toeDirection } from './pose.js';
import { compileFootSchedule } from './foot-scheduler.js';
import { sampleFootTrajectory } from './foot-trajectory.js';

export const CHASSE_STATUS = 'support analysis only; not motion, not a validated chassé (feet float above the floor reference)';
export const CHASSE_PHASE_MS = 400; // provisional duration of each phase, milliseconds
export const CHASSE_CONTACT_TOL = 0.002; // body units, same tolerance as the basic-movement review
// Base geometry, same solver assumptions as the basic-movement review (not school-measured).
const FOOT_ANKLE_FROM_HEEL = 0.3;
const FOOT_LENGTH = 0.15;
const HALF_WIDTH = 0.05;
const PHYSICAL_HEIGHT_M = 1.7; // body units to metres (1 = dancer height)

// Diagnostic only: the pelvis centre (z = 0, as in the review) against the support base of the given feet.
// `offsetX` is the signed distance from the nearest x-edge of the base (0 when inside in x); `margin` is the
// minimum of the four edge distances, identical to the review's static balance margin. Not a pass/fail gate.
export function pelvisAgainstBase(spec, supportIdx) {
  const ank = feetPlaceOf(spec, 1, 0);
  const j = joints(spec, 1, 0, null);
  const cx = j.pelvis[0];
  const cy = j.pelvis[1];
  let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity;
  for (const i of supportIdx) {
    const [dx, dz] = toeDirection(spec, i);
    const heel = FOOT_ANKLE_FROM_HEEL * FOOT_LENGTH;
    const toe = (1 - FOOT_ANKLE_FROM_HEEL) * FOOT_LENGTH;
    xmin = Math.min(xmin, ank[i].x - HALF_WIDTH); xmax = Math.max(xmax, ank[i].x + HALF_WIDTH);
    zmin = Math.min(zmin, ank[i].z - heel * dz, ank[i].z + toe * dz);
    zmax = Math.max(zmax, ank[i].z - heel * dz, ank[i].z + toe * dz);
  }
  const margin = Math.min(cx - xmin, xmax - cx, 0 - zmin, zmax - 0);
  const offsetX = cx < xmin ? cx - xmin : cx > xmax ? cx - xmax : 0;
  return {
    pelvisX: cx,
    pelvisY: cy,
    pelvisYPhysicalMm: cy * PHYSICAL_HEIGHT_M * 1000,
    baseX: [xmin, xmax],
    baseZ: [zmin, zmax],
    offsetX,
    offsetXPhysicalMm: offsetX * PHYSICAL_HEIGHT_M * 1000,
    inside: margin >= 0,
    margin,
  };
}

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
  const rows = CHASSE_PHASES.map((def, i) => {
    const phase = sched.phases[i];
    const s = sampleFootTrajectory(sched.trajectory, (phase.start + phase.end) / 2);
    const a = sampleFootTrajectory(sched.trajectory, phase.start);
    const b = sampleFootTrajectory(sched.trajectory, phase.end);
    const gaps = { left: s.left.y - FLOOR_REF, right: s.right.y - FLOOR_REF };
    const contacted = SIDES.filter((side) => def.contact[side]);
    const floating = contacted.filter((side) => Math.abs(gaps[side]) > CHASSE_CONTACT_TOL);
    const freeGap = def.free ? gaps[def.free] : null;
    const supportIdx = contacted.map((side) => SIDE_INDEX[side]);
    return {
      name: def.name,
      contact: def.contact,
      support: contacted,
      supportIdx,
      loadsStart: { left: a.left.load, right: a.right.load },
      loadsEnd: { left: b.left.load, right: b.right.load },
      gaps,
      floating,
      freeGap,
      freeAboveRef: def.free ? freeGap >= -CHASSE_CONTACT_TOL : null,
      pelvis: pelvisAgainstBase(spec, supportIdx),
      transitionFromPrev: null,
      validated: false,
    };
  });
  // Pelvis change at each phase boundary. The track holds one pose, so the zero change follows from that
  // construction; it is not evidence of a travelling movement, and no pelvis path is defined here.
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].pelvis;
    const cur = rows[i].pelvis;
    rows[i].transitionFromPrev = {
      dx: cur.pelvisX - prev.pelvisX,
      dy: cur.pelvisY - prev.pelvisY,
      dyPhysicalMm: (cur.pelvisY - prev.pelvisY) * PHYSICAL_HEIGHT_M * 1000,
    };
  }
  return rows;
}
