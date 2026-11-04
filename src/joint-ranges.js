// Placeholder joint-range warnings. WARNINGS ONLY: the ranges are provisional placeholders in the convention
// table, not school values and not safe limits. Nothing here clamps a joint or rejects a pose.
import { joints } from './pose.js';
import { conventionValue } from './conventions.js';

export const JOINT_RANGE_STATUS = 'placeholder ranges; warnings only; not clamped, not school-approved, not safe limits';

const vec = (a, b) => [b[0] - a[0], b[1] - a[1], (b[2] || 0) - (a[2] || 0)];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const norm = (u) => Math.hypot(u[0], u[1], u[2]);
const angleDeg = (u, v) => (Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (norm(u) * norm(v))))) * 180) / Math.PI;

// The limits currently in the table (placeholders). A null entry disables that check.
export function jointRangeLimits() {
  return { thighMax: conventionValue('range.thigh_max'), kneeBendMax: conventionValue('range.knee_bend_max') };
}

// Warnings for one spec, measured on the solved legs (the same points the figure draws).
export function jointRangeWarnings(spec, limits = jointRangeLimits()) {
  const { legs3 } = joints(spec, 1, 0, null);
  const out = [];
  legs3.forEach(([hip, knee, ankle], leg) => {
    const thigh = angleDeg(vec(hip, knee), [0, -1, 0]);
    const bend = 180 - angleDeg(vec(knee, hip), vec(knee, ankle));
    if (limits.thighMax != null && thigh > limits.thighMax) {
      out.push({ leg, metric: 'thigh from straight down', value: thigh, limit: limits.thighMax });
    }
    if (limits.kneeBendMax != null && bend > limits.kneeBendMax) {
      out.push({ leg, metric: 'knee bend', value: bend, limit: limits.kneeBendMax });
    }
  });
  return out;
}
