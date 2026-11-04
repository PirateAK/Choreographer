// Basic-movement review (engine checks, not ballet certification).
// Covers balance, foot contact, joint continuity across pose blends, and stationary transitions.
// Values are measured on the preview's provisional presets. Fourth-position spacing is unset and is not
// scored here. Every number printed is provisional unless a school value has been approved.
// Units: "review mm" = body units × 1000 (the review's own scale); "phys mm" = body units × 1.7 × 1000 (1.7 m dancer).
// Margins are printed in body units (bu). No threshold or geometry depends on these labels.
import { PLANT_BY_POSE, specOf, blendSpecs, joints, feetPlaceOf, FLOOR_REF as FLOOR_REF_SHARED } from './src/pose.js';
import { stationaryBalanceDiagnostic, BALANCE_DIAGNOSTIC_STATUS } from './src/balance-diagnostic.js';
import { createShow, overheadPoseAtLocal } from './src/model.js';
import { conventionValue, previewSummary } from './src/conventions.js';
import { chassePhaseReadings, CHASSE_STATUS } from './src/chasse-phases.js';
import { jointRangeWarnings, jointRangeLimits } from './src/joint-ranges.js';
import { raisedFootReading } from './src/raised-foot.js';

// Geometry-only foot constants for contact checking. Balance diagnostic assumptions live separately in
// src/balance-diagnostic.js and are configurable there; neither set changes pose geometry.
const JUMP = 0.03; // a joint point moving more than this in one sample step is reported as a jump
const SAMPLES = 200;
const CONTACT_TOL = 0.002; // 2 review mm (3.4 physical mm at 1.7 m), in body units
// Floor reference: the shared flat-foot ankle height above the deck (pose.js FLOOR_REF = first-position ankle).
const FLOOR_REF = FLOOR_REF_SHARED;

const basic = ['first', 'second', 'third', 'fourth', 'fifth', 'tendu', 'plie', 'releve', 'arabesque', 'attitude', 'pirouette', 'chasse', 'pas-de-bourree'];
const scored = basic; // continuity and transitions are scored; balance is displayed separately and never scored
// Travelling steps: contact and static balance are shown as n/a/diagnostic until support phases are validated.
const travelling = new Set(['chasse']);
const findings = { contact: [], raised: [], continuity: [], transitions: [] };
// Raised-foot targets are separate from floor contact. The back ball of pas de bourrée (index 1) is measured
// against FLOOR_REF + the provisional lift target (convention pas-de-bourree.back_ball_lift) via src/raised-foot.js;
// it is not a flat-foot contact. Not school-approved: the warning stays visible in the output.
const RAISED = { 'pas-de-bourree': { foot: 1, label: 'back-ball lift' } };
const provisional = previewSummary().provisionalInUse;

// Support feet for floor-contact checking from the pose's separate plant table (both, left, right, or none).
// This mapping is not reused for the configurable balance diagnostic.
const contactSupportIdx = (id) => {
  const p = PLANT_BY_POSE[id];
  if (p === 'both') return [0, 1];
  if (p === 'left') return [0];
  if (p === 'right') return [1];
  return [];
};

// Contact: the floor reference is the standing flat-foot ankle height the model draws in first position.
// A support foot must sit on that reference (2 review mm tolerance); no foot may go below it.
function contactOf(spec, id) {
  const ank = feetPlaceOf(spec, 1, 0);
  const sup = contactSupportIdx(id).filter((i) => !(RAISED[id] && i === RAISED[id].foot));
  const gaps = sup.map((i) => ank[i].y - FLOOR_REF);
  const below = ank.filter((p) => p.y < FLOOR_REF - CONTACT_TOL).length;
  const ok = below === 0 && gaps.every((g) => Math.abs(g) <= CONTACT_TOL);
  return { ok, below, gaps };
}

// Raised-foot target: the modeled back-ankle endpoint height above the reference (proxy for the ball), against
// the provisional target. The rig has no separate anatomical ball-of-foot joint (src/raised-foot.js).
function raisedOf(spec, id) {
  const r = raisedFootReading(spec, id);
  return { ok: r.ok, gap: r.gap, target: r.target, height: r.height };
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
console.log('---- stationary balance/contact diagnostics (provisional, diagnostic only, not school-approved; balance unscored)');
for (const id of scored) {
  const spec = specOf(id);
  const bal = stationaryBalanceDiagnostic(spec, id);
  const con = contactOf(spec, id);
  if (travelling.has(id)) {
    // Chassé phase support is fixed in CHASSE_PHASES; the stationary margin is a separate legacy diagnostic.
    console.log(`${id.padEnd(15)} ${CHASSE_STATUS}; balance diagnostic only (${BALANCE_DIAGNOSTIC_STATUS}) static margin ${bal.margin == null ? '-' : bal.margin.toFixed(3)} bu   contact n/a support gap review mm ${con.gaps.map((g) => (g * 1000).toFixed(1)).join(',') || '-'} below ${con.below}`);
    const mm = (v) => `${(v * 1000).toFixed(1)} review mm`;
    const pm = (v) => `${(v * 1.7 * 1000).toFixed(1)} phys mm`;
    for (const r of chassePhaseReadings(spec)) {
      const pb = r.pelvis;
      const freeTxt = r.freeGap == null ? '' : `   free ${r.freeAboveRef ? 'at/above ref' : 'BELOW ref'} (${mm(r.freeGap)} / ${pm(r.freeGap)})`;
      const floatTxt = r.floating.length ? `   FLOATING ${r.floating.join('+')}` : '';
      const baseTxt = `pelvis x ${mm(pb.pelvisX)}, base [${mm(pb.baseX[0])}, ${mm(pb.baseX[1])}]`;
      const offTxt = pb.inside ? 'inside base' : `OUTSIDE base by ${mm(Math.abs(pb.offsetX))} / ${pm(Math.abs(pb.offsetX))}`;
      const trTxt = r.transitionFromPrev ? `   transition from prev dx ${mm(r.transitionFromPrev.dx)}, dy ${mm(r.transitionFromPrev.dy)} / ${pm(r.transitionFromPrev.dy)}` : '';
      console.log(`  phase ${r.name.padEnd(15)} contact ${r.support.join('+').padEnd(11)} gaps L ${mm(r.gaps.left)} R ${mm(r.gaps.right)}${freeTxt}${floatTxt}`);
      console.log(`    ${baseTxt}; ${offTxt}; margin ${pb.margin.toFixed(3)} bu (diagnostic, unscored)   pelvis height ${pb.pelvisY.toFixed(3)} bu${trTxt}`);
    }
    continue;
  }
  const balanceLabel = bal.margin == null ? 'no diagnostic support base' : `${bal.margin.toFixed(3)} bu (${(bal.margin * 1000).toFixed(1)} review mm; ${(bal.margin * 1.7 * 1000).toFixed(1)} phys mm) ${bal.inside ? 'inside' : 'outside'} base`;
  console.log(`${id.padEnd(15)} balance diagnostic only (${BALANCE_DIAGNOSTIC_STATUS}) margin ${balanceLabel}`);
  if (RAISED[id]) {
    // Raised-foot target (provisional, not school-approved). Not a flat-foot contact row.
    const rt = raisedOf(spec, id);
    findings.raised.push({ id, ok: rt.ok, gap: rt.gap });
    console.log(`${id.padEnd(15)} raised-foot back-ball proxy (ankle endpoint) ${rt.ok ? 'pass' : 'FAIL'}   height ${(rt.height * 1000).toFixed(1)} review mm (${(rt.height * 1.7 * 1000).toFixed(1)} phys mm) above reference vs provisional target ${(rt.target * 1000).toFixed(1)} review mm (${(rt.target * 1.7 * 1000).toFixed(1)} phys mm), gap ${(rt.gap * 1000).toFixed(2)} review mm — PROVISIONAL, not school-approved; working foot not contact-checked`);
    continue;
  }
  findings.contact.push({ id, ok: con.ok, below: con.below, gaps: con.gaps });
  console.log(`${id.padEnd(15)} contact ${con.ok ? 'pass' : 'FAIL'} support gap review mm ${con.gaps.map((g) => (g * 1000).toFixed(1)).join(',') || '-'} below ${con.below}`);
}

console.log('---- joint continuity across consecutive basic blends (provisional)');
for (let k = 0; k + 1 < scored.length; k++) {
  const a = specOf(scored[k]);
  const b = specOf(scored[k + 1]);
  const c = continuityOf(a, b);
  findings.continuity.push({ from: scored[k], to: scored[k + 1], ok: c.worst <= JUMP, worst: c.worst });
  console.log(`${scored[k].padEnd(15)} -> ${scored[k + 1].padEnd(15)} max step ${(c.worst * 1000).toFixed(1)} review mm (${(c.worst * 1.7 * 1000).toFixed(1)} phys mm) ${c.worst <= JUMP ? 'pass' : 'JUMP'}`);
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
  console.log(`${start.padEnd(8)} -> ${finish.padEnd(8)} max target shortfall ${Math.round(maxGap * 1000)} review mm (${(maxGap * 1.7 * 1000).toFixed(0)} phys mm)`);
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

// Score only contact, raised-foot targets, continuity, and stationary transitions. Balance is diagnostic-only.
const failed = [
  ...findings.contact.filter((r) => !r.ok).map((r) => `contact ${r.id}`),
  ...findings.raised.filter((r) => !r.ok).map((r) => `raised-foot target ${r.id}`),
  ...findings.continuity.filter((r) => !r.ok).map((r) => `continuity ${r.from}->${r.to}`),
];
console.log(`scored checks failing: ${failed.length}${failed.length ? ` (${failed.join('; ')})` : ''}`);
console.log(`balance diagnostics: ${basic.filter((id) => !travelling.has(id)).length} stationary readings; all unscored; settings and support selectors are provisional and not school-approved`);
console.log(`fourth-position spacing: ${conventionValue('fourth.spacing') === null ? 'unset, not scored' : 'entered, not scored here'}`);
// The review's pass/fail is reported; balance never contributes to the failure list.
if (failed.length) process.exitCode = 1;
else console.log('basic-movement-review: ok');
