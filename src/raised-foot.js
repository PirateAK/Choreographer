// Raised-foot reading for the pas de bourrée back-foot endpoint. Separate from floor contact.
// Landmark limitation: the rig has no separate ball-of-foot joint; this reads the modeled back ankle endpoint
// (feetPlaceOf, legs3[1][2]) above the flat-foot reference as a proxy for the back ball. It is not an anatomical
// ball measurement. The lift target is a REFERENCE value from the convention table: compared against the proxy
// height, never fed into the solver. The rise (pas-de-bourree.rise) is a separate, applied body setting;
// feetPlaceOf removes it from ankle height, so the proxy reading does not depend on rise.
// Provisional target, not school-approved. Units: body units (1 = dancer height); review mm = body units × 1000.
import { feetPlaceOf, FLOOR_REF, joints } from './pose.js';
import { conventionValue } from './conventions.js';

export const RAISED_CONTACT_TOL = 0.002; // body units, same tolerance as the basic-movement review (2 review mm)
const BACK_BALL = { 'pas-de-bourree': { foot: 1, key: 'pas-de-bourree.back_ball_lift', label: 'back-ball lift' } };

// The raised-foot entry for a pose id, or null when the pose has no raised foot.
export function raisedFootOf(id) {
  return BACK_BALL[id] || null;
}

// The reading for a pose: modeled back-ankle endpoint height above the flat-foot reference (proxy for the ball),
// the lift target in use, and the gap. `pelvisY` shows that rise lifts the body without changing the proxy height.
export function raisedFootReading(spec, id) {
  const r = BACK_BALL[id];
  if (!r) return null;
  const ank = feetPlaceOf(spec, 1, 0);
  const target = conventionValue(r.key);
  const height = ank[r.foot].y - FLOOR_REF;
  const gap = height - target;
  return {
    foot: r.foot,
    label: r.label,
    height,
    target,
    gap,
    ok: Math.abs(gap) <= RAISED_CONTACT_TOL,
    pelvisY: joints(spec, 1, 0, null).pelvis[1],
  };
}
