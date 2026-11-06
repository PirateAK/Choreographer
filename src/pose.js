import { riseFor, conventionValue } from './conventions.js';
import { limbContour } from './limb-shape.js';

// Ballet positions, drawn as a jointed figure rather than a symbol. A station has
// always carried a position — first, arabesque, pirouette — but nothing drew it, so a
// dancer looked the same standing in fifth as in a split. Here the position is geometry:
// a few angles per limb, held in one table that the screen and the printed sheet both
// read, so paper and picture cannot disagree about what a dancer is doing.
//
// Angles are degrees measured from straight down, positive away from the body's centre
// line, and every pose is authored facing the house — the elevation's own view. The left
// side is the right side mirrored, which is what makes the table half as long as it
// looks and keeps symmetric positions exactly symmetric.
//
// A leg carries a third angle besides the two the elevation can draw: `front`, how far it
// swings towards the house or away from it. That depth is the axis the elevation loses and
// the plan is read on, and it is projected two ways — shortened in the elevation by its
// cosine (a swung leg drawn shorter, which is what the house sees) and turned into width
// there once she turns, and rotated into the floor's own axes for the plan. `feetPlaceOf` is
// the body-frame pair both views start from.

export const BODY = {
  hip: 0.53,
  shoulder: 0.82,
  head: 0.925,
  headR: 0.057,
  hipW: 0.045,
  shoulderW: 0.055,
  leg: 0.26,
  upper: 0.2,
  fore: 0.19,
};

// Rising onto the pointes raises the body, not the legs: bone lengths are fixed, so a rise lifts the hips
// and the ball of the supporting foot leaves the floor by the rise while the ankle stays a shoe's height up.
// Contacts are taken at the ball (see feetPlaceOf), which keeps the legs at their true length.
const NEUTRAL = { arms: [[8, 4], [8, 4]], legs: [[3, 2], [3, 2]], lean: 0, rise: 0 };

// A leg is three numbers: the hip's angle, the knee's, and how far the whole leg swings forward or back
// — `front`, in degrees, positive towards the house. The first two live in the elevation's plane; the
// third is the axis that plane cannot draw and a plan is read on, and it is the one that makes fourth
// position a split fore and aft rather than two legs squeezed together. A body can also `rock`, which
// tips the whole weight line forward over the toes so her feet sit behind her instead of under her.

export const POSE_SPECS = {
  none: NEUTRAL,
  // Feet together, arms curved low in front: the pose a class starts from.
  first: { arms: [[32, -8], [32, -8]], legs: [[2, 1], [2, 1]], lean: 0, rise: 0 },
  // The wide one: arms open at shoulder height, feet a stride apart.
  // Provisional preview: rise −0.0282072 sinks the body so both ankles sit on the first-position floor reference (0.010198). Not school-approved.
  second: { arms: [[72, 80], [72, 80]], legs: [[20, 18], [20, 18]], lean: 0, rise: -0.0282072 },
  // One arm raised in a curve over the head, the other out, the feet crossed behind.
  third: { arms: [[140, 200], [75, 72]], legs: [[2, 1], [-3, 6]], lean: 0, rise: 0 },
  // As third, but the low arm reaches forward and the legs are split fore and aft: the whole point of
  // the position is the axis the elevation has never had. The hips come down to pay for it, which is
  // what a dancer does — a fore-and-aft split cannot be made with the legs at their length.
  // Provisional preview (Root A): rise −0.0648006 and back knee −28.53349 level both feet at the 0.010198 floor reference. Balance −2 mm stays a provisional warning. Not school-approved.
  fourth: { arms: [[140, 200], [45, 30]], legs: [[22.087, -13.04, 22.978], [4.483, -28.53349, -21.077]], lean: 0, rise: -0.0648006 },
  // Both arms rounded above the head, feet crossed tightly: the closed position.
  // Provisional preview: near-mirror legs (hip −2/−1.9, knee 1.5/1.6) bring both ankles within 0.05 mm of FLOOR_REF. Not school-approved.
  fifth: { arms: [[138, 196], [138, 196]], legs: [[-2, 1.5], [-1.9, 1.6]], lean: 0, rise: 0 },
  // One foot stretched out to touch the floor, the other carrying the weight. Devant: the working leg
  // goes forward, out to the audience's side of her.
  tendu: { arms: [[40, 45], [40, 45]], legs: [[2, 1], [22, 20, 16]], lean: 0, rise: 0 },
  // Both knees out over the toes, the whole body a hand's width lower.
  plie: { arms: [[30, -6], [30, -6]], legs: [[42.68, -30.5754], [42.68, -30.5754]], lean: 0, rise: -0.104813 },
  releve: { arms: [[60, 64], [60, 64]], legs: [[1, 1], [1, 1]], lean: 0, rise: 0.03 },
  // The long line: one leg carried back at hip height, one arm forward, one back — and the body tipped
  // forward over the standing foot, which is what a balance is. The working leg is straight and reads as
  // 90 degrees (horizontal behind) relative to the tipped body: the six degrees of rock are cancelled so
  // the line is level in the front view, not lifted by the tip.
  arabesque: { arms: [[95, 70], [-60, -30]], legs: [[1, 0], [180, 180, -96]], lean: -6, rise: 0.03, rock: 6 },
  // Attitude: the thigh at hip height behind, the knee bent to 90 degrees and the lower leg folded straight
  // down from it. The shin has its own fore-and-aft, so the fold does not swing the thigh with it.
  attitude: { arms: [[130, 190], [70, 66]], legs: [[1, 0], [180, 0, -87, 0]], lean: 3, rise: 0.03, rock: 3 },
  // Up on one pointe, the other foot at the knee, arms rounded to make a hoop.
  pirouette: { arms: [[35, -15], [35, -15]], legs: [[1, 0], [40, -35]], lean: 0, rise: 0.06 },
  // The travelling step that links two poses: crossed feet, one on the pointe behind.
  // Provisional preview (P2): back knee −16.0432 puts the back-ball lift at the 20 mm provisional target (FLOOR_REF + 0.020). Body rise unchanged. Not school-approved.
  'pas-de-bourree': { arms: [[58, 62], [58, 62]], legs: [[-6, -10], [-16, -16.0432]], lean: 0, rise: 0.02 },
  // A lunge carrying the dancer across the stage, leaning the way they travel, and the weight going
  // forward over the front foot.
  chasse: { arms: [[55, 50], [55, 50]], legs: [[25, 20], [-25, -15]], lean: 6, rise: 0, rock: 5 },
};

// The plié preview. The hip-depth target is solved into the knee angle and the body sink, with the foot
// placement and flat-foot ankle height held at the baseline contact. Thigh and shin keep BODY.leg, and
// the hips stay at hipW from the centre line, so the solution is closed-form: the knee follows from the
// horizontal foot position, and the sink from the ankle height. At the baseline depth the result is the
// POSE_SPECS.plie entry itself, so the default drawing is unchanged.
export const PLIE_BASELINE_DEPTH = 42.68;
// Flat-foot ankle-height reference above the deck, body units. It is the first-position ankle height
// (specOf('first') in this rig), not the floor plane, which is y = 0. Plié, second, fourth, and the review
// all use this one constant; test-ankle-lift.mjs checks it against first position.
export const FLOOR_REF = 0.010198;
const PLIE_FOOT_X = 0.089; // ankle distance from the centre line at the baseline contact

export function plieSpec(depth) {
  const h = (Number(depth) * Math.PI) / 180;
  const sinK = (PLIE_FOOT_X - BODY.hipW) / BODY.leg - Math.sin(h);
  if (!Number.isFinite(sinK) || Math.abs(sinK) > 1) return null;
  const k = Math.asin(sinK);
  const kDeg = (k * 180) / Math.PI;
  const rise = FLOOR_REF - BODY.hip + BODY.leg * (Math.cos(h) + Math.cos(k));
  return { ...POSE_SPECS.plie, legs: [[depth, kDeg], [depth, kDeg]], rise };
}

// Arabesque elevation: the working leg's angle from straight down as drawn, after the body's tip (rock)
// is applied. 0 hangs, 90 is horizontal behind, 180 is straight up. Measured on the drawn leg
// (front = elevation − 180 − rock, which gives 90 at the baseline −96). The baseline returns the shared entry.
export const ARABESQUE_BASELINE_ELEVATION = 90;
export function arabesqueSpec(elevation) {
  const e = Number(elevation);
  if (!Number.isFinite(e)) return null;
  const base = POSE_SPECS.arabesque;
  const front = e - 180 - (base.rock || 0);
  return { ...base, legs: base.legs.map((leg, i) => (i === 1 ? [leg[0], leg[1], front] : leg)) };
}

// Fourth-position spacing: the heel-to-toe gap, front to back, between the front foot's heel and the back
// foot's toe. The feet's fore/aft angles are scaled together (k) and bisected until the gap matches. Each leg
// keeps its length and its hip and knee angles; only the fore/aft angle moves. ANKLE_FROM_HEEL is a solver
// assumption (the ankle sits about 0.3 of the foot length from the heel), not a school measurement.
const ANKLE_FROM_HEEL = 0.3;
const spacingCache = new Map();
export function fourthSpacingGap(spec, footLength) {
  const heel = ANKLE_FROM_HEEL * footLength;
  const toe = (1 - ANKLE_FROM_HEEL) * footLength;
  const ank = feetPlaceOf(spec, 1, 0);
  const dir = [0, 1].map((i) => toeDirection(spec, i));
  const f = ank[0].z >= ank[1].z ? 0 : 1;
  const b = 1 - f;
  return (ank[f].z - heel * dir[f][1]) - (ank[b].z + toe * dir[b][1]);
}
function fourthAtScale(spec, k) {
  return { ...spec, legs: spec.legs.map((leg) => [leg[0], leg[1], leg[2] * k]) };
}
export function fourthSpacingSolve(spec, spacing, footLength) {
  const L = Number(footLength);
  const S = Number(spacing);
  if (!Number.isFinite(S) || !Number.isFinite(L) || L <= 0) return spec;
  const key = `${S}|${L}|${spec.turnout || 0}`;
  if (spacingCache.has(key)) return spacingCache.get(key);
  // fore/aft angles may not pass 90° (horizontal); the scale stops where the larger one reaches it
  const maxFront = Math.max(...spec.legs.map((leg) => Math.abs(leg[2] || 0)));
  const kMax = maxFront > 0 ? 90 / maxFront : 1;
  const gMin = fourthSpacingGap(fourthAtScale(spec, 0), L);
  const gMax = fourthSpacingGap(fourthAtScale(spec, kMax), L);
  let k;
  let shortfall = 0;
  if (S <= gMin) { k = 0; shortfall = gMin - S; }
  else if (S >= gMax) { k = kMax; shortfall = S - gMax; }
  else {
    let lo = 0;
    let hi = kMax;
    for (let n = 0; n < 60; n++) {
      const mid = (lo + hi) / 2;
      if (fourthSpacingGap(fourthAtScale(spec, mid), L) < S) lo = mid;
      else hi = mid;
    }
    k = (lo + hi) / 2;
  }
  const out = { ...fourthAtScale(spec, k), spacingShortfall: shortfall };
  spacingCache.set(key, out);
  return out;
}

// The school's rise for a position replaces the built-in one when a school has set it (see
// conventions.js). Without an override the shared table entry is returned, as before. A plié depth
// other than the baseline is re-solved for the preview.
export function specOf(id) {
  const base = POSE_SPECS[id] || NEUTRAL;
  if (id === 'plie') {
    const depth = conventionValue('plie.depth');
    if (typeof depth === 'number' && depth !== PLIE_BASELINE_DEPTH) return plieSpec(depth) || base;
    return base;
  }
  let shaped = base;
  if (id === 'arabesque') {
    const elevation = conventionValue('arabesque.elevation');
    if (typeof elevation === 'number' && elevation !== ARABESQUE_BASELINE_ELEVATION) shaped = arabesqueSpec(elevation) || base;
  }
  if (id === 'fourth') {
    // Unset turnout leaves the preset as drawn; an entered value turns each leg out by that angle.
    const turnout = conventionValue('fourth.turnout');
    if (typeof turnout === 'number') shaped = { ...base, turnout };
    // An entered spacing sets the heel-to-toe gap between the feet, once the foot length is known.
    const spacing = conventionValue('fourth.spacing');
    if (typeof spacing === 'number') shaped = fourthSpacingSolve(shaped, spacing, conventionValue('fourth.foot_length'));
  }
  const rise = riseFor(id);
  return rise === undefined || rise === shaped.rise ? shaped : { ...shaped, rise };
}

// Which foot carries the weight in each position, read off the angle table rather than
// decided: a tendu stands on the leg that is not reaching, an arabesque on the one that is not
// lifted, a chassé on the front leg that has just taken the weight, a pas de bourrée on the ball
// of the foot behind. `legs[0]` is the dancer's left as an audience sees a body facing the house
// — the +x side of the elevation — and that is the name every view uses for a foot. `null` is a
// station with no position at all: it is a plain step, and the model alternates the feet.
export const PLANT_BY_POSE = {
  none: null,
  first: 'both',
  second: 'both',
  third: 'both',
  fourth: 'both',
  fifth: 'both',
  tendu: 'left',
  plie: 'both',
  releve: 'both',
  arabesque: 'left',
  attitude: 'left',
  pirouette: 'left',
  'pas-de-bourree': 'right',
  chasse: 'left',
};

// A darker mix of a colour, for the head of a dancer with no costume: a hair tone has to
// come from somewhere, and taking it from the performer's own colour keeps the plan's
// "this is who" reading while still giving the head a front and a back.
export function darker(hex, f = 0.55) {
  const n = String(hex || '#888888').replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const part = (i) => Math.max(0, Math.min(255, Math.round(parseInt(full.slice(i, i + 2), 16) * f)));
  return '#' + [0, 2, 4].map((i) => part(i).toString(16).padStart(2, '0')).join('');
}

const lerp = (a, b, t) => a + (b - a) * t;

// A dancer arriving at a new position passes through the one they were in, so the
// two are blended. `t` is already eased by the caller (see poseOfContent): the position
// is reached well before the next station, and held, rather than shimmering all the way.
export function blendSpecs(a, b, t) {
  if (!t || t <= 0) return a;
  if (t >= 1) return b;
  return {
    arms: [0, 1].map((i) => [lerp(a.arms[i][0], b.arms[i][0], t), lerp(a.arms[i][1], b.arms[i][1], t)]),
    legs: [0, 1].map((i) => [
      lerp(a.legs[i][0], b.legs[i][0], t),
      lerp(a.legs[i][1], b.legs[i][1], t),
      lerp(a.legs[i][2] || 0, b.legs[i][2] || 0, t),
      // The shin's own fore-and-aft, when it has one, else it follows the thigh as it always did.
      lerp(a.legs[i][3] ?? a.legs[i][2] ?? 0, b.legs[i][3] ?? b.legs[i][2] ?? 0, t),
    ]),
    lean: lerp(a.lean, b.lean, t),
    rise: lerp(a.rise || 0, b.rise || 0, t),
    rock: lerp(a.rock || 0, b.rock || 0, t),
    ...(a.turnout || b.turnout ? { turnout: lerp(a.turnout || 0, b.turnout || 0, t) } : {}),
  };
}

// Joints in body units, one unit tall with the floor at zero. `facing` mirrors the
// whole figure, so a dancer travelling stage left extends the other arm.
//
// `turn` is how far round the dancer has gone, in degrees. A flat drawing cannot show a
// rotation, but it can show what the eye reads as one: the body narrowing as it goes
// into profile, then widening again mirrored as it comes round to the back, then
// narrowing, then front again. That is enough for a pirouette to read as a turn rather
// than as someone standing with a bent leg.
// Weight is not a fifth line in the position table: it is which foot the figure is standing on, which
// the pins already know. How far the hips travel over that foot, and how far the free hip sags below
// it, both in body units so they scale with the dancer. A dancer on one leg is not a figure standing
// square — most of what "her weight is over here" looks like from the house is these two numbers.
const HIP_SHIFT = 0.035;
const HIP_DROP = 0.022;
// The deepest the body lowers to keep weighted contacts through a travelling step. Pinned at the sink the
// plié had before the floor reference moved to 0.010 (0.090), so reconciling the plié does not widen travel
// allowances. Do not derive it from POSE_SPECS.plie.rise again.
const STEP_SINK_MAX = 0.09;

// Which foot carries her, as a leg index, and how much: 0 is the left, 1 the right, `null` when both
// are planted, because the weight is then between them and the hips stay square.
function weightOf(pins) {
  if (!pins) return { leg: null, w: 0 };
  // Pin strength (`w`) controls where the ankle is solved; optional `load` controls support
  // independently. Legacy pins omit load and retain their previous w-based behavior.
  const carried = (pin) => (Number.isFinite(pin.load) ? Math.max(0, Math.min(1, pin.load)) : pin.w);
  if (pins.left && pins.right) {
    const d = carried(pins.left) - carried(pins.right);
    return Math.abs(d) < 1e-9 ? { leg: null, w: 0 } : { leg: d > 0 ? 0 : 1, w: Math.abs(d) };
  }
  if (pins.left) return { leg: 0, w: carried(pins.left) };
  if (pins.right) return { leg: 1, w: carried(pins.right) };
  return { leg: null, w: 0 };
}

// `pins` asks for an ankle to be held somewhere instead of wherever the angles put it:
// `{ left: { x, y, w }, right: { … } }` in body units, with `w` from 0 (the pose decides) to 1 (the
// foot is exactly where the stage says). A blended pin is a foot in the air, travelling from one to
// the other — which is what a swing is. A leg that cannot reach its pin is reported in `reach`
// rather than only drawn straight, so the planner can say it in words as well as show it.
export function joints(spec, facing = 1, turn = 0, pins = null) {
  const angle = ((Number(turn) || 0) * Math.PI) / 180;
  const around = Math.cos(angle);
  const squash = 0.42 + 0.58 * Math.abs(around);
  const m = (facing < 0 ? -1 : 1) * (around < 0 ? -1 : 1);
  // A foot swung forward is a foot the audience sees to one side once she has turned: the depth a leg
  // carries has to come back into this view as width, or a fourth position at a quarter turn would
  // still be drawn square to the house. Zero at the front and the back, all of it in profile.
  const spin = Math.sin(angle) * (facing < 0 ? -1 : 1);
  const rise = spec.rise || 0;
  const leg = BODY.leg;
  // A rock is the lower body tipped forward over the supporting foot: each leg turns rigidly about its
  // hip so the feet go upstage of the pelvis, and the whole figure sinks by what that tipping lifts
  // the lowest ankle, so the supporting foot stays on the floor at the length the leg already has.
  const rockAngle = (Math.max(-30, Math.min(30, Number(spec.rock) || 0)) * Math.PI) / 180;
  const rc = Math.cos(rockAngle);
  const rs = Math.sin(rockAngle);
  const tip = (base, p) => {
    const dy = p[1] - base[1];
    const dz = p[2] - base[2];
    return [p[0], base[1] + dy * rc - dz * rs, base[2] + dz * rc + dy * rs];
  };
  const rockSink = (() => {
    if (!rockAngle) return 0;
    // Compare the lowest ankle before and after tipping, whichever leg each one is.
    let before = Infinity, after = Infinity;
    for (const [hip, knee, front = 0, shinFront = front] of spec.legs) {
      const swing = (Number(front) * Math.PI) / 180;
      const shinSwing = (Number(shinFront) * Math.PI) / 180;
      const flat = leg * Math.cos(swing);
      const flatShin = leg * Math.cos(shinSwing);
      const dy = -Math.cos((hip * Math.PI) / 180) * flat - Math.cos((knee * Math.PI) / 180) * flatShin;
      const dz = (Math.sin(swing) + Math.sin(shinSwing)) * leg;
      before = Math.min(before, dy);
      after = Math.min(after, dy * rc - dz * rs);
    }
    return after - before;
  })();
  const hipY = BODY.hip + rise - rockSink;
  const shoulderY = BODY.shoulder + rise - rockSink;
  const headY = BODY.head + rise - rockSink;
  const leanX = Math.sin((spec.lean * Math.PI) / 180) * (BODY.shoulder - BODY.hip);
  // Over the foot that carries her, and the free hip dropped below it: read from the pins, so it
  // follows the transfer of weight through a leg instead of being a constant of the position.
  const wt = weightOf(pins);
  const hipDrop = wt.leg == null ? 0 : HIP_DROP * wt.w;
  // A rock (see `tip` above) turns each leg about its own hip, so the feet go upstage of her without
  // any bone changing length; the figure, its free foot's home and every contact read the same legs.

  const reach = (angle, len, side) => [
    Math.sin((angle * Math.PI) / 180) * len * side,
    -Math.cos((angle * Math.PI) / 180) * len,
  ];

  // A leg in three dimensions: [x her left, y above the floor, z towards the house]. `front` swings the
  // whole leg fore and aft, which is the depth it has to spend, and the two frontal angles place it in
  // the other plane. The position's own answer and the solved one are both built here, so they can never
  // be measuring different figures.
  const squareBase = (i) => [(i === 0 ? 1 : -1) * m * BODY.hipW, hipY, 0];
  const limbFrom = (i, base) => {
    const side = (i === 0 ? 1 : -1) * m;
    const [hip, knee, front = 0, shinFront = front] = spec.legs[i];
    const swing = (Number(front) * Math.PI) / 180;
    const shinSwing = (Number(shinFront) * Math.PI) / 180;
    const flat = leg * Math.cos(swing);
    const flatShin = leg * Math.cos(shinSwing);
    const [kx, ky] = reach(hip, flat, side);
    const K0 = [base[0] + kx, base[1] + ky, base[2] + Math.sin(swing) * leg];
    const [ax, ay] = reach(knee, flatShin, side);
    const A0 = [K0[0] + ax, K0[1] + ay, K0[2] + Math.sin(shinSwing) * leg];
    // Turnout: each leg turns about its own hip (vertical axis), outward for both sides, bones unchanged.
    // Measured in a frame where both legs mirror onto the same side, so one sign serves both feet.
    const yaw = (Number(spec.turnout) || 0) * Math.PI / 180;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const yawTo = (p) => {
      if (!yaw) return p;
      const dx = (p[0] - base[0]) * side;
      const dz = p[2] - base[2];
      return [base[0] + (dx * cy + dz * sy) * side, p[1], base[2] + dz * cy - dx * sy];
    };
    const kneePoint = yawTo(K0);
    const ankle = yawTo(A0);
    return [base, tip(base, kneePoint), tip(base, ankle)];
  };

  // The hips travel towards the foot that carries her — outward for a foot under its own hip, inward for
  // one crossed behind (a pas de bourrée) — never past it, and no further than HIP_SHIFT.
  const hipShift = (() => {
    if (wt.leg == null || !wt.w) return 0;
    // Measured from the socket it starts at, not the origin: a foot already under the hip has nothing to
    // travel to, and an overshoot past it is what straightens a standing leg and sinks the body.
    const start = squareBase(wt.leg)[0];
    const delta = limbFrom(wt.leg, squareBase(wt.leg))[2][0] - start;
    return Math.sign(delta) * Math.min(HIP_SHIFT, 0.7 * Math.abs(delta)) * wt.w;
  })();

  // Carrying the hip out over a nearly straight standing leg moves the socket away from that leg's own
  // foot, which no leg of fixed length can follow. The body settles by exactly the height that shift
  // costs, measured against the position's own foot rather than any requested contact, so a standing
  // foot stays down while a contact the body has travelled away from is still reported as missed.
  const shiftSink = (() => {
    if (wt.leg == null || !hipShift) return 0;
    const square = squareBase(wt.leg);
    const own = limbFrom(wt.leg, square)[2];
    const across = own[0] - (square[0] + hipShift);
    const r = Math.hypot(across, own[2] - square[2]);
    const v = square[1] - own[1];
    const L = 2 * leg;
    if (!(v > 0) || r >= L || Math.hypot(r, v) <= L) return 0;
    return v - Math.sqrt(L * L - r * r) + 1e-9;
  })();

  // The position's own ankle hung from a socket, carried down with a lowering body but never through the
  // deck: a foot on the floor stays on it and its knee takes the bend, and a lifted foot can come down at
  // most to the floor. Every hold blends from this, so no lowering can push a lightly held foot under.
  const floorY = Math.min(...[0, 1].map((i) => limbFrom(i, squareBase(i))[2][1]));
  const ownAnkle = (i, base) => {
    const a = limbFrom(i, base)[2];
    return [a[0], Math.max(a[1], floorY), a[2]];
  };

  // A travelling step spreads the feet the body is standing on, and a straight leg cannot reach a
  // contact that is beside or behind the pelvis as well as below it: a dancer bends her knees and the
  // whole body lowers through the transfer, rising again over the new foot. The body lowers by what
  // the weighted contacts require, never more than the gallery's own demi-plié, so a contact still out
  // of reach at that depth stays a reported miss rather than being absorbed. Stationary contacts on a
  // position's own feet need none of it.
  const contactSink = (() => {
    if (!pins) return 0;
    const L = 2 * leg;
    let sink = 0;
    for (let pass = 0; pass < 4; pass++) {
      let more = 0;
      for (const i of [0, 1]) {
        const pin = pins[i === 0 ? 'left' : 'right'];
        if (!pin || !(pin.w > 0)) continue;
        const sag = wt.leg != null && i === 1 - wt.leg ? hipDrop : 0;
        const base = [squareBase(i)[0] + (i === wt.leg ? hipShift : 0), hipY - shiftSink - sink - sag, 0];
        const own = ownAnkle(i, base);
        const lifted = pin.y + Math.max(0, spec.rise || 0);
        const t = [own[0] + (pin.x - own[0]) * pin.w, own[1] + (lifted - own[1]) * pin.w, own[2] + ((pin.z || 0) - own[2]) * pin.w];
        const r = Math.hypot(t[0] - base[0], t[2] - base[2]);
        const v = base[1] - t[1];
        if (Math.hypot(r, v) <= L) continue;
        more = Math.max(more, r >= L ? STEP_SINK_MAX : v - Math.sqrt(L * L - r * r) + 1e-9);
      }
      if (more <= 1e-9) break;
      sink = Math.min(STEP_SINK_MAX, sink + more);
      if (sink >= STEP_SINK_MAX) break;
    }
    return sink;
  })();
  const bodySink = shiftSink + contactSink;
  const pelvisY = hipY - bodySink;

  const arms = spec.arms.map(([sh, el], i) => {
    const side = (i === 0 ? 1 : -1) * m;
    const shoulder = [side * BODY.shoulderW + leanX, shoulderY - bodySink];
    const [ex, ey] = reach(sh, BODY.upper, side);
    const elbow = [shoulder[0] + ex, shoulder[1] + ey];
    const [hx, hy] = reach(el, BODY.fore, side);
    return [shoulder, elbow, [elbow[0] + hx, elbow[1] + hy]];
  });

  // Where a knee has to go for an ankle to be at a point in space. Two equal segments from a fixed hip
  // reach anything inside the leg's sphere, and there is a circle of knees for each of those; the one
  // nearest the position's own knee is the bend a dancer's leg would take. This is what holds a foot
  // upstage as well as across, and it is the same solve it always was with a third term.
  const kneeTo = (hipPoint, target, prefer) => {
    const dx = target[0] - hipPoint[0];
    const dy = target[1] - hipPoint[1];
    const dz = target[2] - hipPoint[2];
    const D = Math.hypot(dx, dy, dz);
    if (!(D > 1e-6) || D > 2 * leg) return null;
    const u = [dx / D, dy / D, dz / D];
    const mid = [hipPoint[0] + dx / 2, hipPoint[1] + dy / 2, hipPoint[2] + dz / 2];
    const off = Math.sqrt(Math.max(0, leg * leg - (D / 2) * (D / 2)));
    // The position's own knee with its part along the leg taken out: what is left points at the knee.
    const px = prefer[0] - mid[0];
    const py = prefer[1] - mid[1];
    const pz = prefer[2] - mid[2];
    const along = px * u[0] + py * u[1] + pz * u[2];
    let ox = px - u[0] * along;
    let oy = py - u[1] * along;
    let oz = pz - u[2] * along;
    let len = Math.hypot(ox, oy, oz);
    if (len < 1e-6) {
      // Straight through the hip, where every perpendicular is as good as another: take the one in the
      // frontal plane, which is the plane this drawing is read in.
      ox = 0;
      oy = -u[2];
      oz = u[1];
      len = Math.hypot(oy, oz) || 1;
    }
    return [mid[0] + (ox / len) * off, mid[1] + (oy / len) * off, mid[2] + (oz / len) * off];
  };

  // The free leg's own place, read from a square pelvis: the mark it keeps when the hip above it
  // sags, so the drop bends that knee instead of pushing the foot through the deck.
  const freeIdx = wt.leg == null ? null : 1 - wt.leg;
  // The free foot keeps the mark a square pelvis gives it, lowered with the body but not below the deck.
  const freeHome = freeIdx == null ? null : ownAnkle(freeIdx, [squareBase(freeIdx)[0], pelvisY, 0]);

  // Which legs had to give up their contact to stay the length they are: `null` per leg, or how far
  // past its reach the foot was asked to be — `over` along the leg, `overX` across the floor — in
  // body units. This is what the planner says out loud, and what the plan draws as a gap.
  const shortfall = [null, null];
  const legs3 = [0, 1].map((i) => {
    // The stance socket goes out over the foot that carries her and the free one only sags: a pelvis
    // tilts, it does not slide, and moving the free socket would pull her extended leg out of reach
    // of a place the position already put it.
    const base = [squareBase(i)[0] + (i === wt.leg ? hipShift : 0), pelvisY - (freeIdx === i ? hipDrop : 0), 0];
    const [root, kneePoint, ankle] = limbFrom(i, base);
    const pin = pins && pins[i === 0 ? 'left' : 'right'];
    // What the floor asks of this ankle: the pin, in all three axes, or — for a free leg under a dropped
    // hip — the place it already had. Either way the knee bends to make up the difference and the foot
    // stays where it is, upstage as much as across.
    const hold = pin && pin.w > 0 ? pin : freeIdx === i && hipDrop > 0 ? { x: freeHome[0], y: freeHome[1], z: freeHome[2], w: 1 } : null;
    if (!hold) return [root, kneePoint, ankle];
    // Where the foot is asked to be: the hold, or a blend of it and where the position would have put
    // it. Everything here is in the body's own frame, before the turn projects it.
    const heldZ = hold.z || 0;
    const from = ownAnkle(i, base);
    const target = [
      from[0] + (hold.x - from[0]) * hold.w,
      from[1] + (hold.y + (pin ? Math.max(0, rise) : 0) - from[1]) * hold.w,
      from[2] + (heldZ - from[2]) * hold.w,
    ];
    let bend = kneeTo(root, target, kneePoint);
    let toe = target;
    if (!bend) {
      // Out of reach: the leg straightens toward the spot and the foot stops at its length, so the
      // contact visibly goes instead of the leg visibly breaking.
      const dx = target[0] - root[0];
      const dy = target[1] - root[1];
      const dz = target[2] - root[2];
      const D = Math.hypot(dx, dy, dz) || 1;
      bend = [root[0] + (dx / D) * leg, root[1] + (dy / D) * leg, root[2] + (dz / D) * leg];
      toe = [root[0] + (dx / D) * 2 * leg, root[1] + (dy / D) * 2 * leg, root[2] + (dz / D) * 2 * leg];
      // How much further than the leg the foot was asked to be, and how much of that lies across the
      // floor and upstage: a plan is read from above, so it needs the floor part of the same figure.
      const over = D - 2 * leg;
      shortfall[i] = { over, overX: (over * dx) / D, overZ: (over * dz) / D, target };
    }
    return [root, bend, toe];
  });

  // Seen at an angle, everything across the body narrows; heights do not change, and what a limb
  // carries in depth comes back as width.
  const narrow = (p) => [p[0] * squash, p[1]];
  const projected = (p) => [p[0] * squash + p[2] * spin, p[1]];

  return {
    // The pelvis travels with the weight and the torso follows less than half as far, which is what
    // keeps her standing over the path while her hips are over her foot.
    pelvis: [hipShift * 0.6, pelvisY - hipDrop * 0.5],
    chest: narrow([leanX + hipShift * 0.6, shoulderY - bodySink]),
    arms: arms.map((arm) => arm.map(narrow)),
    // The hip is the pivot and has no depth of its own; the knee and the ankle are solved in space and
    // then projected onto this plane.
    legs: legs3.map((leg) => leg.map(projected)),
    // Unprojected joints for the overhead plan; never reconstruct depth from elevation.
    legs3,
    head: narrow([leanX * 1.05, headY - bodySink]),
    headR: BODY.headR,
    rise,
    turn: Number(turn) || 0,
    shortfall,
    // How far each ankle is upstage of the hip, in body units, positive towards the house: the axis
    // this view cannot draw, and the one the plan is read on.
    depth: [legs3[0][2][2], legs3[1][2][2]],
  };
}

// The two ankles in body units, index 0 the dancer's left: the point a toe is drawn from, and
// the point a contact is measured at. An ankle is not a sole — it sits a couple of centimetres
// above the deck in every position — so anything that plants a foot carries that offset.
// Where each ankle stands on the floor, in the body's own frame with no projection at all: `x` her
// left, `y` above the deck, `z` towards the house, index 0 the dancer's left. This is the pair both
// views start from, and the reason they cannot disagree: the elevation takes x and y (flattened by the
// turn, which is what the house loses), the plan takes x and z (rotated by the turn, which is what the
// floor keeps — a fourth position at a quarter turn stands side by side rather than front and back).
// A `rock` tips the weight line over the toes, so every foot ends up further upstage of the pelvis than
// the legs alone would put it.
// Which way a toe points on the floor, in the body's frame (x her left, z towards the house): forward when
// the feet are parallel, turned outward by the turnout for each foot. This is the same yaw joints() gives the
// leg, so a foot's toe and its ankle always agree. side 0 is the dancer's left.
export const TOE_LENGTH = 0.05; // body units, the length the elevation already draws
export function toeDirection(spec, side) {
  const t = ((Number(spec && spec.turnout) || 0) * Math.PI) / 180;
  const s = side === 0 ? 1 : -1;
  return [s * Math.sin(t), Math.cos(t)];
}

export function feetPlaceOf(spec, facing = 1, turn = 0) {
  // The figure's own unpinned ankles, square to the house: the same legs the views draw, so a contact
  // taken from a position is exactly where that position's foot already is.
  const own = joints(spec, 1, 0, null).legs3;
  const angle = ((Number(turn) || 0) * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const mirror = facing < 0 ? -1 : 1;
  return [0, 1].map((i) => {
    const [x, y, z] = own[i][2];
    return { x: mirror * (x * c + z * s), y: y - Math.max(0, spec.rise || 0), z: z * c - x * s };
  });
}

// Foot roll is appearance geometry around the solved ankle, not another contact solver.
// The existing rise lifts hip AND ankle equally: thigh/shin lengths are already fixed.
// Model a heel, metatarsal/ball and toe beneath that ankle so the rise is visible.
// For lifted/unreachable ankles the entire shoe follows the ankle; it never snaps to a floor target.
export function footGeometry(spec, figure, facing = 1, turn = 0) {
  const a = (Number(turn) || 0) * Math.PI / 180;
  const squash = 0.42 + 0.58 * Math.abs(Math.cos(a));
  const mirror = (facing < 0 ? -1 : 1) * (Math.cos(a) < 0 ? -1 : 1);
  const spin = Math.sin(a) * (facing < 0 ? -1 : 1);
  const lift = Math.max(0, Number(spec.rise) || 0);
  const roll = Math.min(1, lift / 0.06);
  const project = p => [p[0] * squash + p[2] * spin, p[1]];
  return figure.legs3.map((leg, i) => {
    const ankle = leg[2];
    const [dx, dz] = toeDirection(spec, i);
    const point = (distance, height) => [ankle[0] + dx * mirror * distance,
      ankle[1] - FLOOR_REF - lift + height, ankle[2] + dz * distance];
    const heel = point(-0.025 * (1 - roll), lift * 0.88);
    const ball = point(0.027 * (1 - roll), Math.max(0, lift - 0.03) * 0.55);
    const toe = point(TOE_LENGTH * (1 - roll), 0);
    return { ankle, heel, ball, toe, points: [heel, ankle, ball, toe].map(project), roll };
  });
}

// Shared silhouette samples for screen and print. Radii are body units, independent
// of costume, zoom and contact solving; the knee/ankle centers stay untouched.
export function legContours(leg) {
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const [hip, knee, ankle] = leg;
  return [
    limbContour([hip, mix(hip, knee, 0.34), mix(hip, knee, 0.7), knee], [0.034, 0.037, 0.029, 0.017]),
    limbContour([knee, mix(knee, ankle, 0.3), mix(knee, ankle, 0.62), ankle], [0.017, 0.026, 0.02, 0.01]),
  ];
}

// Shaped arms, same method as the legs: a tapered upper arm, a forearm, and a short
// hand carried on the forearm's line. Radii are body units and sit well inside the old
// uniform stroke, so the arm reads as an arm rather than a rod. Also returns the elbow
// and wrist discs that cover the two seams, as the knee disc does for the leg.
export function armContours(arm) {
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const [shoulder, elbow, wrist] = arm;
  const len = Math.hypot(wrist[0] - elbow[0], wrist[1] - elbow[1]) || 1;
  const dir = [(wrist[0] - elbow[0]) / len, (wrist[1] - elbow[1]) / len];
  const hand = [wrist[0] + dir[0] * 0.07, wrist[1] + dir[1] * 0.07];
  return {
    shapes: [
      limbContour([shoulder, mix(shoulder, elbow, 0.32), mix(shoulder, elbow, 0.68), elbow], [0.021, 0.019, 0.015, 0.012]),
      limbContour([elbow, mix(elbow, wrist, 0.32), mix(elbow, wrist, 0.68), wrist], [0.012, 0.011, 0.009, 0.0075]),
      limbContour([wrist, mix(wrist, hand, 0.5), hand], [0.0075, 0.0068, 0.0045]),
    ],
    discs: [elbow, wrist],
  };
}

// Torso and neck from the same joints as the rest: hips, a narrower waist and a fuller chest,
// tapering into a neck under the head. Radii are body units; the chest sits at the shoulder
// line so the arms root inside its outline. Returned as [neck, torso]: draw the neck first so
// the torso's fill covers its base and no seam shows.
export function torsoShapes(j) {
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const pelvis = j.pelvis;
  const chest = j.chest;
  const head = j.head;
  return [
    limbContour([chest, mix(chest, head, 0.5), head], [0.022, 0.019, 0.02]),
    limbContour([pelvis, mix(pelvis, chest, 0.34), mix(pelvis, chest, 0.68), mix(pelvis, chest, 0.88), chest], [0.047, 0.043, 0.036, 0.045, 0.054]),
  ];
}

/* ------------------------------------------------------------------ drawing */

// Pointe shoes, drawn from the same foot points as the bare foot: a satin shoe over heel to toe,
// a darker box at the tip, and one ribbon running up the shin from the ankle. A foot that rises
// onto the pointe lengthens into the box, so the shoe follows the foot rather than a separate pose.
export const POINTE_SHOE = { satin: '#f2b5c6', box: '#e291aa', ribbon: '#d9869f' };
export function pointeShoeShapes(foot, knee) {
  // The contact points are the centreline of the shoe, so the sole hangs below the floor by about its
  // thickness. Lift the whole shoe by the sole radius so its underside rests on the floor line.
  const SOLE = 0.0095;
  const [heel, ankle, ball, toe] = foot.points.map(([x, y]) => [x, y + SOLE]);
  const kneeUp = [knee[0], knee[1] + SOLE];
  const along = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  return [
    { shape: limbContour([heel, ankle, ball, toe], [0.012, 0.0105, 0.0095, 0.0068]), fill: POINTE_SHOE.satin },
    { shape: limbContour([ball, toe], [0.0098, 0.0072]), fill: POINTE_SHOE.box },
    { shape: limbContour([ankle, along(ankle, kneeUp, 0.42)], [0.0028, 0.0022]), fill: POINTE_SHOE.ribbon },
  ];
}

// Head furniture in head units: origin at the head centre, radius 1, y down. One function for
// the screen and the print so the hair and face cannot disagree. The face turns with the head
// (headTurn, degrees): eyes, nose and mouth show only while the face looks towards the viewer,
// the ear shows in profile, and the hair is a pulled-back cap with a bun at the nape.
export function headFace(headTurn = 0) {
  const ha = ((Number(headTurn) || 0) * Math.PI) / 180;
  const fwd = Math.sin(ha);
  const front = Math.cos(ha);
  const eye = (u) => ({ x: fwd * 0.25 + u * front, y: -0.05, rx: 0.13 * front, ry: 0.065 });
  const facing = front > 0.2;
  return {
    cap: { x: -fwd * 0.35, y: -1 + (1 - front) / 2, r: 0.75 + (0.25 * (1 - front)) / 2 },
    bun: { x: -fwd * 0.9, y: -0.15 + 0.85 * Math.max(0, -front), r: 0.36 },
    ear: front < 0.5 ? { x: -fwd * 0.15, y: 0.05, rx: 0.13, ry: 0.22 } : null,
    eyes: facing ? [eye(-0.38), eye(0.38)] : [],
    nose: facing ? { x: fwd * 0.25, y: 0.12, rx: 0.05 * front, ry: 0.07 } : null,
    mouth: facing ? { x: fwd * 0.25, y: 0.42, rx: 0.2 * front, ry: 0.045 } : null,
  };
}

// The figure uses shaped, articulated legs around the solved skeleton; arms and torso
// retain the simple jointed drawing for now. Returns the head box for labels.
export function drawPose(ctx, o) {
  const { spec, x, y, h, facing = 1, turn = 0, headTurn = turn, body, skirt, hair, pins } = o;
  const j = joints(spec, facing, turn, pins);
  const X = (bx) => x + bx * h;
  const Y = (by) => y - by * h;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const outline = 'rgba(0,0,0,.45)';
  const polygon = (points, fill = body) => {
    ctx.beginPath();
    points.forEach(([bx, by], i) => i ? ctx.lineTo(X(bx), Y(by)) : ctx.moveTo(X(bx), Y(by)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(0.6, h * 0.006);
    ctx.fill();
    ctx.stroke();
  };
  for (const leg of j.legs) {
    for (const shape of legContours(leg)) polygon(shape);
    // Cover the two segment end seams with the same rounded joint in canvas and print.
    ctx.beginPath();
    ctx.arc(X(leg[1][0]), Y(leg[1][1]), h * 0.016, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
  }
  for (const arm of j.arms) {
    const { shapes, discs } = armContours(arm);
    for (const shape of shapes) polygon(shape);
    ctx.beginPath();
    ctx.arc(X(discs[0][0]), Y(discs[0][1]), h * 0.012, 0, Math.PI * 2);
    ctx.arc(X(discs[1][0]), Y(discs[1][1]), h * 0.0075, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
  }
  for (const shape of torsoShapes(j)) polygon(shape);
  footGeometry(spec, j, facing, turn).forEach((foot, i) => {
    for (const { shape, fill } of pointeShoeShapes(foot, j.legs[i][1])) polygon(shape, fill);
  });
  const headR = j.headR * h;
  const hx = X(j.head[0]);
  const hy = Y(j.head[1]);
  const face = headFace(headTurn);
  // The bun sits behind the head: drawn first, it only shows where it sticks out (profile, nape).
  if (hair) {
    const b = face.bun;
    ctx.beginPath();
    ctx.arc(hx + b.x * headR, hy + b.y * headR, b.r * headR * 1.06, 0, Math.PI * 2);
    ctx.fillStyle = outline;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx + b.x * headR, hy + b.y * headR, b.r * headR, 0, Math.PI * 2);
    ctx.fillStyle = hair;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(hx, hy, headR * 1.06, 0, Math.PI * 2);
  ctx.fillStyle = outline;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx, hy, headR, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  if (face.ear) {
    const e = face.ear;
    ctx.beginPath();
    ctx.ellipse(hx + e.x * headR, hy + e.y * headR, e.rx * headR * 1.12, e.ry * headR * 1.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = outline;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hx + e.x * headR, hy + e.y * headR, e.rx * headR, e.ry * headR, 0, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
  }
  if (hair) {
    // The cap is clipped to the head: from the front a hairline across the forehead, in profile
    // the top and back, and from behind the whole head.
    const c = face.cap;
    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, hy, headR, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(hx + c.x * headR, hy + c.y * headR, c.r * headR, 0, Math.PI * 2);
    ctx.fillStyle = hair;
    ctx.fill();
    ctx.restore();
  }
  const features = [...face.eyes, face.nose, face.mouth].filter(Boolean);
  features.forEach((f, i) => {
    ctx.beginPath();
    ctx.ellipse(hx + f.x * headR, hy + f.y * headR, f.rx * headR, f.ry * headR, 0, 0, Math.PI * 2);
    ctx.fillStyle = i < face.eyes.length ? '#1d1714' : f === face.mouth ? '#a1505f' : outline;
    ctx.fill();
  });

  // The skirt last, at the hip: a tutu disc, a tunic to mid-thigh, or a plain sash.
  if (skirt) {
    const hipPx = Y(j.pelvis[1]);
    const hipX = X(j.pelvis[0]);
    ctx.fillStyle = skirt.color;
    ctx.strokeStyle = skirt.color;
    ctx.beginPath();
    if (skirt.style === 'tutu') {
      ctx.ellipse(hipX, hipPx, 0.34 * h, 0.1 * h, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (skirt.style === 'tunic') {
      const top = Y(j.chest[1]);
      const bottom = Y(j.pelvis[1] + 0.1);
      ctx.moveTo(hipX - 0.17 * h, top);
      ctx.lineTo(hipX + 0.17 * h, top);
      ctx.lineTo(hipX + 0.22 * h, bottom);
      ctx.lineTo(hipX - 0.22 * h, bottom);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.rect(hipX - 0.16 * h, Y(j.pelvis[1] + 0.06), 0.32 * h, 0.05 * h);
      ctx.fill();
    }
  }

  ctx.restore();
  return { headX: hx, headY: hy, headR, hipX: X(j.pelvis[0]), hipY: Y(j.pelvis[1]) };
}

/* --------------------------------------------------------------- print (SVG) */

// Clip paths need an id of their own, or every head on a sheet would be masked by the
// first one's circle.
let headClipSeq = 0;

// The same joints as SVG, in the caller's own units. `f` maps body units to the
// sheet: k pixels per metre, and the feet on a known line.
export function poseSvg(o) {
  const { spec, x, y, h, facing = 1, turn = 0, headTurn = turn, body, skirt, hair, ink, focused, pins } = o;
  const j = joints(spec, facing, turn, pins);
  const X = (bx) => x + bx * h;
  const Y = (by) => y - by * h;
  const out = [];
  const polygon = (points, fill = body) => `<polygon points="${points.map(([bx, by]) => X(bx).toFixed(2) + ',' + Y(by).toFixed(2)).join(' ')}" fill="${fill}" stroke="${ink}" stroke-width="${Math.max(0.6, h * 0.006).toFixed(2)}" stroke-linejoin="round" />`;
  for (const leg of j.legs) {
    for (const shape of legContours(leg)) out.push(polygon(shape));
    out.push(`<circle cx="${X(leg[1][0]).toFixed(2)}" cy="${Y(leg[1][1]).toFixed(2)}" r="${(h * 0.016).toFixed(2)}" fill="${body}" />`);
  }
  for (const arm of j.arms) {
    const { shapes, discs } = armContours(arm);
    for (const shape of shapes) out.push(polygon(shape));
    out.push(`<circle cx="${X(discs[0][0]).toFixed(2)}" cy="${Y(discs[0][1]).toFixed(2)}" r="${(h * 0.012).toFixed(2)}" fill="${body}" />`);
    out.push(`<circle cx="${X(discs[1][0]).toFixed(2)}" cy="${Y(discs[1][1]).toFixed(2)}" r="${(h * 0.0075).toFixed(2)}" fill="${body}" />`);
  }
  for (const shape of torsoShapes(j)) out.push(polygon(shape));
  footGeometry(spec, j, facing, turn).forEach((foot, i) => {
    for (const { shape, fill } of pointeShoeShapes(foot, j.legs[i][1])) out.push(polygon(shape, fill));
  });

  const headR = j.headR * h;
  const hx = X(j.head[0]);
  const hy = Y(j.head[1]);
  const face = headFace(headTurn);
  const ell = (cx, cy, rx, ry, fill) =>
    `<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="${fill}" stroke="none" />`;
  // The bun first, behind the head, as on screen.
  if (hair) {
    const b = face.bun;
    out.push(
      `<circle cx="${(hx + b.x * headR).toFixed(2)}" cy="${(hy + b.y * headR).toFixed(2)}" r="${(b.r * headR * 1.06).toFixed(2)}" fill="${ink}" stroke="none" />`,
      `<circle cx="${(hx + b.x * headR).toFixed(2)}" cy="${(hy + b.y * headR).toFixed(2)}" r="${(b.r * headR).toFixed(2)}" fill="${hair}" stroke="none" />`
    );
  }
  out.push(`<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${(headR * 1.06).toFixed(1)}" fill="${ink}" stroke="none" />`);
  out.push(`<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${headR.toFixed(1)}" fill="${body}" stroke="none" />`);
  if (face.ear) {
    const e = face.ear;
    out.push(ell(hx + e.x * headR, hy + e.y * headR, e.rx * headR * 1.12, e.ry * headR * 1.12, ink));
    out.push(ell(hx + e.x * headR, hy + e.y * headR, e.rx * headR, e.ry * headR, body));
  }
  if (hair) {
    // The same cap as on screen, clipped to the head.
    const c = face.cap;
    const id = 'head' + ++headClipSeq;
    out.push(
      `<defs><clipPath id="${id}"><circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${headR.toFixed(1)}" /></clipPath></defs>`,
      `<circle cx="${(hx + c.x * headR).toFixed(2)}" cy="${(hy + c.y * headR).toFixed(2)}" r="${(c.r * headR).toFixed(2)}" fill="${hair}" stroke="none" clip-path="url(#${id})" />`
    );
  }
  for (const [i, f] of [...face.eyes, face.nose, face.mouth].filter(Boolean).entries()) {
    const fill = i < face.eyes.length ? '#1d1714' : f === face.mouth ? '#a1505f' : ink;
    out.push(ell(hx + f.x * headR, hy + f.y * headR, f.rx * headR, f.ry * headR, fill));
  }

  if (skirt) {
    const hipPx = Y(j.pelvis[1]);
    const hipX = X(j.pelvis[0]);
    if (skirt.style === 'tutu') {
      out.push(
        `<ellipse cx="${hipX.toFixed(1)}" cy="${hipPx.toFixed(1)}" rx="${(0.34 * h).toFixed(1)}" ry="${(0.1 * h).toFixed(1)}" fill="${skirt.color}" stroke="${focused ? '#ff8a5c' : ink}" stroke-width="0.8" />`
      );
    } else if (skirt.style === 'tunic') {
      const top = Y(j.chest[1]);
      const bottom = Y(j.pelvis[1] + 0.1);
      out.push(
        `<polygon points="${(hipX - 0.17 * h).toFixed(1)},${top.toFixed(1)} ${(hipX + 0.17 * h).toFixed(1)},${top.toFixed(1)} ${(hipX + 0.22 * h).toFixed(1)},${bottom.toFixed(1)} ${(hipX - 0.22 * h).toFixed(1)},${bottom.toFixed(1)}" fill="${skirt.color}" stroke="${ink}" stroke-width="0.8" />`
      );
    } else {
      out.push(
        `<rect x="${(hipX - 0.16 * h).toFixed(1)}" y="${Y(j.pelvis[1] + 0.06).toFixed(1)}" width="${(0.32 * h).toFixed(1)}" height="${Math.max(1.2, 0.05 * h).toFixed(1)}" fill="${skirt.color}" stroke="none" />`
      );
    }
  }

  return { svg: out, headX: hx, headY: hy, headR };
}
