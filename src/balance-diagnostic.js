// Provisional balance diagnostic assumptions. Diagnostic only: not school-approved and not a safety or ballet criterion.
// This calculation does not feed pose geometry, contact checks, or choreography. Current defaults reproduce the
// review's historical constants exactly: foot length 0.15 bu, half-width 0.05 bu, heel fraction 0.30.
import { conventionValue } from './conventions.js';
import { feetPlaceOf, joints, toeDirection, PLANT_BY_POSE } from './pose.js';

export const BALANCE_DIAGNOSTIC_STATUS = 'provisional diagnostic only; not school-approved; never scored';
export const BALANCE_MARGIN_REFERENCE = 0; // body units; informational inside/outside reference only
export const STATIONARY_SUPPORT_IDS = [
  'first', 'second', 'third', 'fourth', 'fifth', 'tendu', 'plie', 'releve',
  'arabesque', 'attitude', 'pirouette', 'pas-de-bourree',
];
const SIDE_INDEX = { left: 0, right: 1 };

export function balanceDiagnosticSettings() {
  return {
    footLength: conventionValue('balance.diagnostic_foot_length'),
    halfWidth: conventionValue('balance.diagnostic_half_width'),
    ankleHeelFraction: conventionValue('balance.ankle_heel_fraction'),
  };
}

export function stationarySupportIndices(id) {
  // Chassé's stationary legacy diagnostic keeps its historical left base. Phase readings never call this;
  // they pass the fixed supports from CHASSE_PHASES directly to balanceDiagnosticOf.
  if (id === 'chasse') return PLANT_BY_POSE.chasse === 'left' ? [0] : [];
  const side = conventionValue(`balance.support.${id}`);
  if (side === 'both') return [0, 1];
  if (side === 'left' || side === 'right') return [SIDE_INDEX[side]];
  return [];
}

// Same axis-aligned x/z support rectangle and pelvis point as the prior review calculation.
// `supportIdx` is explicit so callers (especially chassé phase readings) retain their own fixed support schedule.
export function balanceDiagnosticOf(spec, supportIdx, settings = balanceDiagnosticSettings()) {
  if (!supportIdx.length) return { hasSupport: false, inside: null, margin: null, pelvisX: joints(spec, 1, 0, null).pelvis[0], pelvisZ: 0, baseX: null, baseZ: null };
  const ank = feetPlaceOf(spec, 1, 0);
  const pelvisX = joints(spec, 1, 0, null).pelvis[0];
  const pelvisZ = 0;
  let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity;
  for (const i of supportIdx) {
    const [, dz] = toeDirection(spec, i);
    const heel = settings.ankleHeelFraction * settings.footLength;
    const toe = (1 - settings.ankleHeelFraction) * settings.footLength;
    xmin = Math.min(xmin, ank[i].x - settings.halfWidth);
    xmax = Math.max(xmax, ank[i].x + settings.halfWidth);
    zmin = Math.min(zmin, ank[i].z - heel * dz, ank[i].z + toe * dz);
    zmax = Math.max(zmax, ank[i].z - heel * dz, ank[i].z + toe * dz);
  }
  const margin = Math.min(pelvisX - xmin, xmax - pelvisX, pelvisZ - zmin, zmax - pelvisZ);
  return {
    hasSupport: true,
    pelvisX,
    pelvisZ,
    baseX: [xmin, xmax],
    baseZ: [zmin, zmax],
    margin,
    inside: margin >= BALANCE_MARGIN_REFERENCE,
    criterion: 'diagnostic only',
  };
}

export function stationaryBalanceDiagnostic(spec, id, settings = balanceDiagnosticSettings()) {
  return balanceDiagnosticOf(spec, stationarySupportIndices(id), settings);
}
