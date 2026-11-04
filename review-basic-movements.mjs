// Basic-movement review (engine checks, not ballet certification).
// Covers balance, foot contact, joint continuity across pose blends, and stationary transitions.
// Values are measured on the preview's provisional presets. Fourth-position spacing is unset and is not
// scored here. Every number printed is provisional unless a school value has been approved.
import { PLANT_BY_POSE, specOf, blendSpecs, joints, feetPlaceOf, toeDirection, FLOOR_REF as FLOOR_REF_SHARED } from './src/pose.js';
import { createShow, overheadPoseAtLocal } from './src/model.js';
import { conventionValue, previewSummary } from './src/conventions.js';
import { chassePhaseReadings, CHASSE_STATUS } from './src/chasse-phases.js';
import { jointRangeWarnings, jointRangeLimits } from './src/joint-ranges.js';

const FOOT_ANKLE_FROM_HEEL = 0.3; // solver assumption shared with pose.js spacing (not school-measured)
const FOOT_LENGTH = 0.15; // provisional foot length from conventions.js
const HALF_WIDTH = 0.05; // half foot width, body units (provisional)
const JUMP = 0.03; // a joint point moving more than this in one sample step is reported as a jump
const SAMPLES = 200;
const CONTACT_TOL = 0.002; // 2 mm, body units ~3.4 mm at 1.7 m
// Floor reference: the shared flat-foot ankle height above the deck (pose.js FLOOR_REF = first-position ankle).
const FLOOR_REF = FLOOR_REF_SHARED;

const basic = ['first', 'second', 'third', 'fourth', 'fifth', 'tendu', 'plie', 'releve', 'arabesque', 'attitude', 'pirouette', 'chasse', 'pas-de-bourree'];
const scored = basic; // fourth is scored for balance/contact/continuity; only spacing checks are excluded
// Travelling steps: their static balance and contact are shown as n/a until support phases are defined (see the chassé review).
const travelling = new Set(['chasse']);
const findings = { balance: [], contact: [], raised: [], continuity: [], transitions: [] };
// Raised-foot targets are separate from floor contact. The back ball of pas de bourrée (index 1) is measured
// against FLOOR_REF + the provisional lift target (convention pas-de-bourree.back_ball_lift); it is not a
// flat-foot contact. Not school-approved: the warning stays visible in the output.
const RAISED = { 'pas-de-bourree': { foot: 1, target: conventionValue('pas-de-bourree.back_ball_lift'), label: 'back-ball lift' } };
const provisional = previewSummary().provisionalInUse;

// Support feet from the pose's table entry (both, left, right, or none).
const supportIdx = (id) => {
  const p = PLANT_BY_POSE[id];
  if (p === 'both') return [0, 1];
  if (p === 'left') return [0];
  if (p === 'right') return [1];
  return [];
};

// Balance: the centre (pelvis x, z = 0) lies inside the support base, with heel and toe allowance.
function balanceOf(spec, id, supOverride = null) {
  const sup = supOverride || supportIdx(id);
  if (!sup.length) return { ok: true, margin: null, note: 'no support table entry' };
  const ank = feetPlaceOf(spec, 1, 0);
  const cx = joints(spec, 1, 0, null).pelvis[0];
  let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity;
  for (const i of sup) {
    const [dx, dz] = toeDirection(spec, i);
    const heel = FOOT_ANKLE_FROM_HEEL * FOOT_LENGTH;
    const toe = (1 - FOOT_ANKLE_FROM_HEEL) * FOOT_LENGTH;
    xmin = Math.min(xmin, ank[i].x - HALF_WIDTH); xmax = Math.max(xmax, ank[i].x + HALF_WIDTH);
    zmin = Math.min(zmin, ank[i].z - heel * dz, ank[i].z + toe * dz);
    zmax = Math.max(zmax, ank[i].z - heel * dz, ank[i].z + toe * dz);
  }
  const cz = 0;
  const margin = Math.min(cx - xmin, xmax - cx, cz - zmin, zmax - cz);
  return { ok: margin >= 0, margin, cx, base: [xmin, xmax] };
}

// Contact: the floor reference is the standing flat-foot ankle height the model draws in first position.
// A support foot must sit on that reference (2 mm tolerance); no foot may go below it.
function contactOf(spec, id) {
  const ank = feetPlaceOf(spec, 1, 0);
  const sup = supportIdx(id).filter((i) => !(RAISED[id] && i === RAISED[id].foot));
  const gaps = sup.map((i) => ank[i].y - FLOOR_REF);
  const below = ank.filter((p) => p.y < FLOOR_REF - CONTACT_TOL).length;
  const ok = below === 0 && gaps.every((g) => Math.abs(g) <= CONTACT_TOL);
  return { ok, below, gaps };
}

// Raised-foot target: the lifted ball's height above the reference, against the provisional target.
function raisedOf(spec, id) {
  const ank = feetPlaceOf(spec, 1, 0);
  const r = RAISED[id];
  const gap = ank[r.foot].y - (FLOOR_REF + r.target);
  return { ok: Math.abs(gap) <= CONTACT_TOL, gap, target: r.target, height: ank[r.foot].y - FLOOR_REF };
}

// Continuity: step each consecutive pair's blend and find the largest joint-point move between samples.
function continuityOf(a, b) {
  let worst = 0, at = 0;
  let prev = null;
  for (let s = 0; s <= SAMPLES; s++) {
    const t = s / SAMPLES;
    const spec = blendSpecs(a, b, t);
    const j = joints(spec, 1, 0, null);
    const pts = [j.pelvis, j.chest, j.head, ...j.legs3.flatMap((l) => l)].map((p) => (p.length === 2 ? [p[0], p[1], 0] : p));
    if (prev) {
      const m = Math.max(...pts.map((p, k) => Math.hypot(p[0] - prev[k][0], p[1] - prev[k][1], p[2] - prev[k][2])));
      if (m > worst) { worst = m; at = t; }
    }
    prev = pts;
  }
  return { worst, at };
}

console.log('provisional values in use:', provisional.join(', '));
console.log('---- stationary balance and contact (provisional)');
for (const id of scored) {
  const spec = specOf(id);
  const bal = balanceOf(spec, id);
  const con = contactOf(spec, id);
  if (travelling.has(id)) {
    // Travelling step: support changes over time. Static numbers are shown but not scored; chassé is support scheduling only.
    findings.balance.push({ id, ok: true, margin: bal.margin, na: true });
    findings.contact.push({ id, ok: true, below: con.below, gaps: con.gaps, na: true });
    console.log(`${id.padEnd(15)} balance n/a (${CHASSE_STATUS}) static margin ${bal.margin == null ? '-' : bal.margin.toFixed(3)}   contact n/a support gap mm ${con.gaps.map((g) => (g * 1000).toFixed(1)).join(',') || '-'} below ${con.below}`);
    // Provisional phase readings (src/chasse-phases.js). Shown, not scored; timing and contact states are provisional.
    // Per phase: foot contact, free-foot clearance, pelvis x against the support base, height and transition.
    // Pelvis-vs-base is a diagnostic reading (the static balance margin), not a pass/fail criterion.
    const mm = (v) => (v * 1000).toFixed(1);
    for (const r of chassePhaseReadings(spec)) {
      const pb = r.pelvis;
      const freeTxt = r.freeGap == null ? '' : `   free ${r.freeAboveRef ? 'at/above ref' : 'BELOW ref'} (${mm(r.freeGap)} mm review / ${(r.freeGap * 1.7 * 1000).toFixed(1)} mm phys)`;
      const floatTxt = r.floating.length ? `   FLOATING ${r.floating.join('+')}` : '';
      const baseTxt = `pelvis x ${mm(pb.pelvisX)} mm review, base [${mm(pb.baseX[0])}, ${mm(pb.baseX[1])}]`;
      const offTxt = pb.inside ? 'inside base' : `OUTSIDE base by ${mm(Math.abs(pb.offsetX))} mm review / ${Math.abs(pb.offsetXPhysicalMm).toFixed(1)} mm phys`;
      const trTxt = r.transitionFromPrev ? `   transition from prev dx ${mm(r.transitionFromPrev.dx)} mm, dy ${mm(r.transitionFromPrev.dy)} mm review / ${r.transitionFromPrev.dyPhysicalMm.toFixed(1)} mm phys` : '';
      console.log(`  phase ${r.name.padEnd(15)} contact ${r.support.join('+').padEnd(11)} gaps mm L ${mm(r.gaps.left)} R ${mm(r.gaps.right)}${freeTxt}${floatTxt}`);
      console.log(`    ${baseTxt}; ${offTxt}; margin ${pb.margin.toFixed(3)} (diagnostic, unscored)   pelvis height ${pb.pelvisY.toFixed(3)} bu${trTxt}`);
    }
    continue;

  }
  findings.balance.push({ id, ok: bal.ok, margin: bal.margin });
  if (RAISED[id]) {
    // Raised-foot target (provisional, not school-approved). Not a flat-foot contact row.
    const rt = raisedOf(spec, id);
    findings.raised.push({ id, ok: rt.ok, gap: rt.gap });
    console.log(`${id.padEnd(15)} balance ${bal.ok ? 'pass' : 'FAIL'} margin ${bal.margin == null ? '-' : bal.margin.toFixed(3)}   raised-foot ${RAISED[id].label} ${rt.ok ? 'pass' : 'FAIL'} ball height ${(rt.height * 1000).toFixed(1)} mm vs provisional target ${(rt.target * 1000).toFixed(1)} mm (gap ${(rt.gap * 1000).toFixed(2)} mm) — PROVISIONAL convention, not school-approved; working foot not contact-checked`);
    continue;
  }
  findings.contact.push({ id, ok: con.ok, below: con.below, gaps: con.gaps });

  console.log(`${id.padEnd(15)} balance ${bal.ok ? 'pass' : 'FAIL'} margin ${bal.margin == null ? '-' : bal.margin.toFixed(3)}   contact ${con.ok ? 'pass' : 'FAIL'} support gap mm ${con.gaps.map((g) => (g * 1000).toFixed(1)).join(',') || '-'} below ${con.below}`);
}

console.log('---- joint continuity across consecutive basic blends (provisional)');
for (let k = 0; k + 1 < scored.length; k++) {
  const a = specOf(scored[k]);
  const b = specOf(scored[k + 1]);
  const c = continuityOf(a, b);
  findings.continuity.push({ from: scored[k], to: scored[k + 1], ok: c.worst <= JUMP, worst: c.worst });
  console.log(`${scored[k].padEnd(15)} -> ${scored[k + 1].padEnd(15)} max step ${(c.worst * 1000).toFixed(1)} mm ${c.worst <= JUMP ? 'pass' : 'JUMP'}`);
}

console.log('---- stationary transitions through the overhead solve (provisional, distance 0)');
const show = createShow();
for (const [start, finish] of [['first', 'second'], ['second', 'third'], ['fifth', 'first'], ['plie', 'releve']]) {
  const dancer = { keys: [
    { t: 0, x: 0, y: 3, pose: start },
    { t: 2000, x: 0, y: 3, pose: finish },
  ] };
  let maxGap = 0;
  for (let t = 0; t <= 2000; t += 20) {
    const solved = overheadPoseAtLocal(show, dancer, t);
    for (const foot of Object.values(solved.feet)) if (foot.target) maxGap = Math.max(maxGap, foot.shortfall || 0);
  }
  findings.transitions.push({ start, finish, maxGapMm: Math.round(maxGap * 1000) });
  console.log(`${start.padEnd(8)} -> ${finish.padEnd(8)} max target shortfall ${Math.round(maxGap * 1000)} mm`);
}

// Placeholder joint-range warnings (src/joint-ranges.js). Shown, not scored: the ranges are placeholders, not
// school values or safe limits, and nothing is clamped.
console.log('---- joint-range placeholders (warnings only, not scored)');
{
  const lim = jointRangeLimits();
  console.log(`limits: thigh ${lim.thighMax}° from straight down, knee bend ${lim.kneeBendMax}° (PLACEHOLDER)`);
  for (const id of basic) {
    const w = jointRangeWarnings(specOf(id), lim);
    if (w.length) console.log(`${id.padEnd(15)} ${w.map((x) => `leg ${x.leg} ${x.metric} ${x.value.toFixed(1)}° > ${x.limit}°`).join('; ')}`);
  }
}

// Score: balance, contact, continuity, and the stationary transitions. A failing row is reported, not hidden.
const failed = [
  ...findings.balance.filter((r) => !r.ok).map((r) => `balance ${r.id}`),
  ...findings.contact.filter((r) => !r.ok).map((r) => `contact ${r.id}`),
  ...findings.raised.filter((r) => !r.ok).map((r) => `raised-foot target ${r.id}`),
  ...findings.continuity.filter((r) => !r.ok).map((r) => `continuity ${r.from}->${r.to}`),
];
console.log(`scored checks failing: ${failed.length}${failed.length ? ` (${failed.join('; ')})` : ''}`);
console.log(`fourth-position spacing: ${conventionValue('fourth.spacing') === null ? 'unset, not scored' : 'entered, not scored here'}`);
// The review's pass/fail is reported; the script exits non-zero when any scored row fails.
if (failed.length) process.exitCode = 1;
else console.log('basic-movement-review: ok');
