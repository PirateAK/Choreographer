// Core data model and time arithmetic for Choreographer.

// The positions' geometry lives in pose.js — the angles, and therefore where the feet are — so
// that a contact is measured from the same table the figures are drawn from.
import { PLANT_BY_POSE, feetPlaceOf, joints, specOf, blendSpecs } from './pose.js';
import { contactFrame } from './contact-frame.js';
import { sampleFootTrajectory, validateFootTrajectory } from './foot-trajectory.js';

// The four things a station can stand on. Kept here rather than beside the contact code so a
// show read from a file can be tidied before anything else in the module has been evaluated.
const PLANTS = ['left', 'right', 'both', 'air'];
//
// Coordinate space (metres):
//   x = 0 at the centre line, negative to stage left (as seen by the audience), positive right
//   y = 0 at the proscenium line (downstage edge), increasing upstage
//   wings begin where |x| > stage.width / 2 and extend wingDepth further
//
// Time:
//   ui.playhead is CONTENT time in ms (the show's own clock, which stops during pauses).
//   Display time = content time with pause durations inserted, which is what the
//   timeline ruler draws. Holds stop one track's local clock while content advances.

export const THEME = {
  bg: '#080b10',
  floor: '#18202d',
  floorAlt: '#1c2534',
  wing: '#0f1620',
  grid: '#232e3f',
  gridMajor: '#31405a',
  line: '#3b4a60',
  text: '#c9d4e3',
  dim: '#6f7f96',
  accent: '#ffb703',
  danger: '#ff4d6d',
};

export const PALETTE = [
  '#ff4d6d', '#ff9f1c', '#ffd166', '#8ac926', '#2ec4b6',
  '#4cc9f0', '#4361ee', '#9b5de5', '#f15bb5', '#dcdcdc',
];

export const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'star'];
export const FILLS = ['solid', 'hollow', 'half'];

// Ballet vocabulary offered at each path station. Extend by adding entries.
export const POSES = [
  ['none', '— none —'],
  ['first', '1st position'],
  ['second', '2nd position'],
  ['third', '3rd position'],
  ['fourth', '4th position'],
  ['fifth', '5th position'],
  ['tendu', 'Tendu'],
  ['plie', 'Plié'],
  ['releve', 'Relevé'],
  ['arabesque', 'Arabesque'],
  ['attitude', 'Attitude'],
  ['pirouette', 'Pirouette'],
  ['pas-de-bourree', 'Pas de bourrée'],
  ['chasse', 'Chassé'],
];
export const POSE_LABEL = Object.fromEntries(POSES);

// How a dancer meets the floor at a station. A position says what the body is doing; a
// level says how tall it stands doing it and whether the feet are on the deck at all.
// Without this the elevation drew every dancer the same height, so a rise onto the
// pointes and a jump across the stage looked like the same body sliding about.
export const LEVELS = [
  ['flat', 'flat'],
  ['demi', 'demi-pointe'],
  ['pointe', 'en pointe'],
  ['air', 'in the air'],
];
export const LEVEL_LABEL = Object.fromEntries(LEVELS);

// A standing level makes the body taller without lifting the feet: the rise lengthens the
// legs and lifts the hips, which is what standing higher actually is. A half, then full
// point for a 1.7 m dancer is about 3 cm and 8 cm. Fractions of the dancer's height, so a
// small dancer rises a small amount.
const LEVEL_RISE = { flat: 0, demi: 0.02, pointe: 0.045, air: 0 };
// A jump clears the deck rather than stretching upwards, so it is a height in metres. A
// grand jeté's apex is around a third of a metre; a small sauté can be typed in smaller.
export const AIR_LIFT = 0.35;
export const LIFT_MAX = 2.5;

// A landing has to go somewhere. A dancer coming down from a jump cannot arrive in a tall
// position: the knees give, and the body is lowest exactly at the station they land on, then
// rises into the next movement. That dip is an absorption, measured in metres of plié.
export const ABSORB_MAX = 0.6;
// How deep a landing gives, per metre of drop, with floors either side: a small sauté barely
// bends the knees and a big jump does not put the dancer on the floor in a full plié.
const ABSORB_PER_M = 0.32;
const ABSORB_MIN = 0.06;
const ABSORB_AUTO_MAX = 0.45;

// The level a station carries on its own, before any landing it has to take is counted: its
// name, how much taller it makes the body (body heights) and how far the feet are off the
// deck (metres). A height typed on the station is the height of the feet, whichever level it
// is — which is how a dancer is held aloft, and how a jump is made higher or lower than the
// default.
function baseLevel(key) {
  const name = LEVEL_LABEL[key && key.level] ? key.level : 'flat';
  const typed = Number(key && key.lift);
  const has = Number.isFinite(typed) && typed > 0;
  const lift = name === 'air' ? (has ? Math.min(LIFT_MAX, typed) : AIR_LIFT) : has ? Math.min(LIFT_MAX, typed) : 0;
  return { name, rise: LEVEL_RISE[name] || 0, lift };
}

// A station's level, including the landing it has to receive. `from` is the station the
// dancer arrives from: a station on the floor whose predecessor is in the air absorbs the
// drop, deeper for a bigger jump, unless the absorption is typed in — and typing 0 is a stiff
// landing, which is a thing a choreographer may want and the planner must not overrule. A
// station in the air absorbs nothing: there is no deck under it to give.
export function levelOf(key, from) {
  const base = baseLevel(key);
  const typed = key && key.absorb;
  const given = typed !== null && typed !== undefined && typed !== '' && Number.isFinite(Number(typed)) && Number(typed) >= 0;
  let absorb = 0;
  if (base.lift <= 0.05) {
    if (given) absorb = Math.min(ABSORB_MAX, Number(typed));
    else {
      const drop = from ? baseLevel(from).lift : 0;
      if (drop > 0.05) absorb = Math.min(ABSORB_AUTO_MAX, Math.max(ABSORB_MIN, drop * ABSORB_PER_M));
    }
  }
  return { name: base.name, rise: base.rise, lift: base.lift, absorb };
}

// A leg's height is travelled, not switched: flat to pointe rises through the step, and a
// jump that begins and ends on the floor rises and falls across the stations either side
// of its apex. Blended with the same eased count as the limbs, so the body and its height
// arrive together.
export function levelBlend(a, b, t) {
  const from = a || levelOf(null);
  const to = b || from;
  const u = Math.max(0, Math.min(1, Number(t) || 0));
  return {
    name: u >= 1 ? to.name : from.name,
    rise: from.rise + (to.rise - from.rise) * u,
    lift: from.lift + (to.lift - from.lift) * u,
    // A plié is travelled like everything else: deepest at the station it belongs to, gone by
    // the time the dancer is up in the next position.
    absorb: from.absorb + (to.absorb - from.absorb) * u,
  };
}

// How a dancer gets to a station. A walk is the plain blend the planner has always
// drawn; a named step is held while they travel, so a chassé reads as a chassé instead
// of as a body halfway between two positions. The named steps are the same vocabulary
// as the positions, because in a studio they are the same words.
export const STEPS = [
  ['walk', 'walks'],
  ['chasse', 'chassé'],
  ['pas-de-bourree', 'pas de bourrée'],
  ['pirouette', 'pirouette'],
];
export const STEP_LABEL = Object.fromEntries(STEPS);

// A leg is one length of time, but it need not be spent evenly. A step that gathers and
// arrives quickly is not the same movement as one that leaves quickly and settles, and a
// planner that can only do "even" makes every travelling step the same speed as every other
// one. `ease` on the arriving station names the shape of that count.
export const EASES = [
  ['even', 'even'],
  ['accel', 'slow out · quick in'],
  ['decel', 'quick out · slow in'],
  ['both', 'slow both ends'],
];
export const EASE_LABEL = Object.fromEntries(EASES);

// Every shape is monotonic and pinned at 0 and 1, so a shaped leg still leaves the station
// it left and arrives at the one it was aimed at — only the speed in between changes.
const EASE_CURVES = {
  even: (u) => u,
  // Leaves slowly and arrives quickly: the gather before a jump, a run-out at the end.
  accel: (u) => u * u,
  // Leaves quickly and arrives slowly: the settle after a landing, a step that is placed.
  decel: (u) => 1 - (1 - u) * (1 - u),
  // Both ends soft: a long adagio line where nothing is snatched.
  both: (u) => u * u * (3 - 2 * u),
};

// The fraction of the way along a leg at a fraction of its count. `key` is the station being
// arrived at, which is where the shape is set, the same way a step and a turn are.
export function countShape(key, u) {
  const name = EASE_LABEL[key && key.ease] ? key.ease : 'even';
  const f = EASE_CURVES[name] || EASE_CURVES.even;
  return f(Math.max(0, Math.min(1, Number(u) || 0)));
}

export const STATION_MS = 1500;

/* ---------------------------------------------------------------- the count */

// A phrase takes time out of the music, not out of its own pocket. A count is one beat at the
// show's tempo and a bar is a measure of them, so a step can be given a length in counts and
// land on the band rather than taking whatever its own idea of a second says. A show written
// before any of this counts a walking 120 in four, which changes nothing it already has.
export const DEFAULT_TEMPO = 120;
export const DEFAULT_BEATS = 4;

export function countGrid(show) {
  const prefs = (show && show.prefs) || {};
  const bpm = Number(prefs.tempo);
  const tempo = Number.isFinite(bpm) ? Math.max(20, Math.min(300, bpm)) : DEFAULT_TEMPO;
  const bpb = Number(prefs.beatsPerBar);
  const perBar = Number.isFinite(bpb) ? Math.max(1, Math.min(16, Math.round(bpb))) : DEFAULT_BEATS;
  // Bars are counted from where the band starts, which is where the first music track begins:
  // a show whose music enters after the house lights still has its bar one at the entry.
  const tracks = (show && show.musicTracks) || [];
  const first = tracks.length ? Number(tracks[0].start) : 0;
  const origin = Number.isFinite(first) ? Math.max(0, first) : 0;
  const count = 60000 / tempo;
  return { tempo, perBar, count, bar: count * perBar, origin };
}

// Where a moment falls in the music: which bar, and which count of that bar. Read from the show's
// clock, so a hold or a pause does not move the number — the band plays on through both. A moment
// before the first track begins is not in the music at all, and gets nothing.
export function countAt(show, ms) {
  const g = countGrid(show);
  const t = Number(ms);
  if (!Number.isFinite(t)) return null;
  const rel = t - g.origin;
  if (rel < -1) return null;
  const at = Math.max(0, rel);
  const bar = Math.floor(at / g.bar);
  return {
    bar: bar + 1,
    count: Math.min(g.perBar, Math.floor((at - bar * g.bar) / g.count) + 1),
    of: g.perBar,
    tempo: g.tempo,
  };
}

// The count (or bar) nearest a moment, which is what a click on the ruler means: you are pointing
// at the count you can see, not at the one after it. Never earlier than the first count, since
// there is no bar before the band starts.
export function nearestCount(show, ms, per = 1) {
  const g = countGrid(show);
  const step = g.count * (Number(per) > 0 ? Number(per) : 1);
  const t = Number(ms);
  if (!(step > 0) || !Number.isFinite(t)) return Number(ms) || 0;
  const k = Math.round((t - g.origin) / step);
  return Math.round(g.origin + Math.max(0, k) * step);
}

// The moment on a performer's own clock that a count falls on. Her clock stops during a hold, so
// a count inside one is not a moment she can be stood at all: the first count she is moving again
// on is taken instead, which keeps a point placed from the music on the music. Returns the count
// used as well as her local time, because the two differ wherever a hold has been.
export function localAtCount(show, dancer, ms, per = 1) {
  const g = countGrid(show);
  const step = g.count * (Number(per) > 0 ? Number(per) : 1);
  let ct = nearestCount(show, ms, per);
  for (let n = 0; n < 64; n++) {
    const lt = Math.max(0, localOfContent(show, dancer.id, ct));
    if (Math.abs(contentOfLocal(show, dancer.id, lt) - ct) < 1) return { ct, lt };
    ct = onCount(show, ct + step, per);
  }
  return { ct, lt: Math.max(0, localOfContent(show, dancer.id, ct)) };
}

// The first count (or bar, or whatever step is asked for) at or after a moment. A moment that
// already sits on the grid comes back untouched, so snapping into time cannot add a gap.
export function onCount(show, ms, per = 1) {
  const g = countGrid(show);
  const step = g.count * (Number(per) > 0 ? Number(per) : 1);
  const t = Number(ms);
  if (!(step > 0) || !Number.isFinite(t)) return Number(ms) || 0;
  const k = Math.ceil((t - g.origin) / step - 1e-6);
  return Math.round(g.origin + Math.max(0, k) * step);
}

/* ------------------------------------------------------------------ phrases */

// A step is more than one point. A chassé closes its feet, a pas de bourrée transfers three
// times, and a pirouette has to be prepared before it can go round — so a planner that only
// describes one point at a time makes the choreographer type the same three fields on every
// point of a sequence. A phrase is a step and the position it arrives in, laid down as the
// stations that step needs, added after wherever the dancer already is.
//
// `f` is how far along the phrase the station sits; `pose`, `level` and `turn` say either a
// literal value or 'arrive' for the one chosen with the phrase. `w` is how many counts of the
// phrase that transfer takes, so a phrase's time is divided between its stations the way the
// step is actually counted rather than into equal slices: a chassé is a close and a step, one
// count each, and a pas de bourrée is three counts, one per transfer.
const PHRASE_SHAPES = {
  walk: {
    travel: 0.9,
    stations: [{ f: 1, w: 2, step: 'walk', pose: 'arrive', level: 'arrive', ease: 'even' }],
  },
  // Gather, then the long low step that carries her: the closing transfer ends under the
  // body, so the arrival is where the weight lands and the count settles there.
  chasse: {
    travel: 1.4,
    stations: [
      { f: 0.45, w: 1, step: 'chasse', pose: 'fifth', level: 'flat', ease: 'accel' },
      { f: 1, w: 1, step: 'chasse', pose: 'arrive', level: 'arrive', ease: 'decel' },
    ],
  },
  // Back, side, front: three small transfers under the body, on the demi-pointe, which is
  // why this one travels least of the three.
  'pas-de-bourree': {
    travel: 0.7,
    stations: [
      { f: 0.34, w: 1, step: 'pas-de-bourree', pose: 'fifth', level: 'demi', ease: 'even' },
      { f: 0.68, w: 1, step: 'pas-de-bourree', pose: 'fifth', level: 'demi', ease: 'even' },
      { f: 1, w: 1, step: 'pas-de-bourree', pose: 'arrive', level: 'arrive', ease: 'decel' },
    ],
  },
  // A turn happens where she stands, so both its stations sit on the same spot and the path
  // before it is untouched: the preparation is a station in fourth, then the revolution on
  // the pointe. The turn is one revolution because a pirouette is; edit the station to make
  // it two, and it becomes a double on the same count.
  pirouette: {
    travel: 0,
    stations: [
      { f: 0, w: 1, step: 'walk', pose: 'fourth', level: 'flat', ease: 'decel' },
      { f: 0, w: 1, step: 'pirouette', pose: 'arrive', level: 'pointe', turn: 360, ease: 'accel' },
    ],
  },
};

// How many counts a phrase takes as it usually goes: the sum of its transfers. Used as the
// number in the phrase row until it is typed over.
export function phraseCounts(step) {
  const spec = PHRASE_SHAPES[step] || PHRASE_SHAPES.walk;
  return spec.stations.reduce((n, s) => n + (s.w || 1), 0);
}

// What a phrase will lay down, for the sheet to say before anything is placed.
export function phraseShape(step) {
  const name = PHRASE_SHAPES[step] ? step : 'walk';
  const s = PHRASE_SHAPES[name];
  return { step: name, travel: s.travel, counts: phraseCounts(name), count: s.stations.length };
}

// How a phrase's counts are shared out between its transfers, in milliseconds, with the last
// station taking whatever is left so a phrase always ends exactly on its own last count. This is
// the one place that division is done: the stations are timed from it, and so is the warning
// about a division that does not come out even.
export function phraseShares(step, counts, countMs = 500) {
  const shape = phraseShape(step);
  const spec = PHRASE_SHAPES[shape.step];
  const per = Number(countMs) > 0 ? Number(countMs) : 500;
  const total = Math.max(1, Math.round((Number(counts) > 0 ? Number(counts) : shape.counts) * per));
  const sumW = spec.stations.reduce((n, s) => n + (s.w || 1), 0) || 1;
  let left = total;
  return spec.stations.map((s, i) => {
    const share = i === spec.stations.length - 1 ? Math.max(0, left) : Math.round((total * (s.w || 1)) / sumW);
    left -= share;
    return share;
  });
}

// Where a phrase's arrivals sit against the count grid, counted from its own start: a whole
// number is a station exactly on a beat. Counts that do not divide into the step's transfers
// evenly leave a station between two beats — seven counts over a pas de bourrée's three is 2.33
// and 4.67 — and that is worth saying before the phrase is placed rather than hearing it after.
export function phraseOffsets(step, counts, countMs = 500) {
  const per = Number(countMs) > 0 ? Number(countMs) : 500;
  let cum = 0;
  return phraseShares(step, counts, per).map((share) => {
    cum += share;
    return cum / per;
  });
}

// How far off a beat a count is, in milliseconds. Two milliseconds is nothing: a share that is a
// whole count in arithmetic can come out a fraction of a millisecond out after rounding.
export const COUNT_EPS = 2;

function offCount(show, contentMs) {
  const off = Number(contentMs) - nearestCount(show, contentMs);
  return Math.abs(off) <= COUNT_EPS ? 0 : Math.round(off);
}

const round2 = (v) => Math.round(v * 100) / 100;

// Where a phrase begins, on the dancer's own clock. Three ways to say it: a moment on the
// show's clock (`at` — a count clicked on the ruler, with `atBar` when the click meant the
// bar), the next count or bar after where her path ends (`snap`), or simply wherever her path
// ends. A count inside one of her holds is not a moment she can move on, so `localAtCount`
// steps to the first count she is moving again on instead of starting her in a freeze.
export function phraseStart(show, dancer, opts = {}) {
  const keys = (dancer && dancer.keys) || [];
  const last = keys[keys.length - 1];
  const at = Number(opts.at);
  if (opts.at != null && Number.isFinite(at) && at >= 0) {
    const per = opts.atBar ? countGrid(show).perBar : 1;
    const spot = localAtCount(show, dancer, at, per);
    return { t: Math.max(0, spot.lt), ct: spot.ct, on: per > 1 ? 'bar' : 'count' };
  }
  if (!last) return { t: 0, ct: null, on: null };
  const snap = Number(opts.snap) > 0 ? Number(opts.snap) : 0;
  if (!snap) return { t: last.t, ct: null, on: null };
  const from = contentOfLocal(show, dancer.id, last.t);
  const snapped = onCount(show, from, snap);
  if (snapped <= from) return { t: last.t, ct: null, on: null };
  return {
    t: Math.max(last.t, localOfContent(show, dancer.id, snapped)),
    ct: snapped,
    on: snap > 1 ? 'bar' : 'count',
  };
}

// How much of a transfer the split is allowed to take: the leg after a stop keeps at least this
// share of the counts it was given. Finishing a phrase's half before a hold is paid for out of the
// movement that follows, and a transfer with a twentieth of its counted time in it is not a step
// anybody can dance — so the loss is shared between the held pose and the leg, never handed whole
// to one of them.
const PHRASE_LEG_KEEP = 0.5;

// The moments on the show's clock that a phrase's arrivals are aimed at: its start plus the counts
// it was counted to. A hold inside the phrase splits it, and the split is finished *before* the
// stop — the arrival the freeze would otherwise catch in mid-transition is moved towards the last
// instant before it, so she is standing in that position, and holding it, rather than frozen part
// way through a step. Moving it costs the transfer after it exactly what it gains, so the arrival
// only goes as far as that leg can spare (see PHRASE_LEG_KEEP): the stop's time is shared between
// the pose and the move instead of being paid for entirely by the move. Returns those moments and
// the holds that split the phrase.
export function phraseMoments(show, dancer, opts = {}) {
  const shape = phraseShape(opts.step);
  const counts = Number(opts.counts) > 0 ? Number(opts.counts) : shape.counts;
  const grid = countGrid(show);
  const startLocal = Number(opts.startLocal);
  const startContent = contentOfLocal(show, dancer.id, Number.isFinite(startLocal) ? startLocal : 0);
  let cum = 0;
  const shares = phraseShares(shape.step, counts, grid.count);
  const moments = shares.map((s) => {
    cum += s;
    return startContent + cum;
  });
  const last = moments.length ? moments[moments.length - 1] : startContent;
  const splits = holdsFor(show, dancer.id)
    .map((h) => holdSpanOf(show, dancer.id, h))
    .filter((sp) => sp.from > startContent && sp.from < last);
  for (const sp of splits) {
    // The last arrival due before the freeze is the half that has to be finished when the music
    // stops for her, so it is moved towards the stop. When no arrival is due before it the phrase
    // has not reached a station yet — the hold interrupts its opening transfer, and there is no
    // half to finish, so nothing is retimed (rushing the opening would be a worse distortion than
    // the one this rule exists to remove).
    let k = -1;
    for (let i = 0; i < moments.length; i++) if (moments[i] <= sp.from) k = i;
    if (k < 0 || moments[k] >= sp.from) continue;
    // Every millisecond the arrival moves later comes off the leg after it, so the leg is measured
    // in her own clock first — a hold already sitting in that leg has taken its share of the
    // counts, and only what is left of them is the arrival's to spend.
    const here = localOfContent(show, dancer.id, moments[k]);
    let room = Infinity;
    if (moments[k + 1] != null) {
      const there = localOfContent(show, dancer.id, moments[k + 1]);
      const keep = (shares[k + 1] || 0) * PHRASE_LEG_KEEP;
      room = Math.max(0, there - here - keep);
    }
    moments[k] = Math.min(sp.from, moments[k] + room);
  }
  return { startContent, moments, splits };
}

// Which foot a step stands on, decided by the phrase rather than by each station's position, so a
// phrase placed on a path is already dancable instead of needing a foot decision per station. These
// are the by-step rules from the footing plan: a walk alternates from the foot she was last on, a
// chassé lands the front foot of the two it gathers, a pas de bourrée lands the third of its three
// transfers, and a turn keeps the standing foot it prepared on. A preparation — the fourth before a
// pirouette, the fifth that closes a chassé — stands on both, which is what it is.
//
// `null` is an opinion the phrase does not have: nothing is written, the plant stays derived from
// the position table, and the foot drawn cannot disagree with the foot on paper. That is what
// happens under a position that already names its own side (an arabesque), under a body in the air,
// and on a turn that begins from both feet.
//
// A body standing on both feet has no foot to alternate from; the step out of it goes to the right,
// which is the answer the derived table already gives it.
function otherFoot(foot) {
  return foot === 'right' ? 'left' : 'right';
}

// The foot she is on before the phrase starts: the last station's plant, typed or derived. A path
// that has not begun is standing on both, so its first step has nothing to alternate from.
function phraseLead(dancer) {
  const plants = plantsOf(dancer);
  const last = plants.length ? plants[plants.length - 1].name : 'both';
  return last === 'air' ? 'both' : last;
}

function phrasePlant(step, i, count, lead, key) {
  // Nothing to decide for a body in the air, and nothing to contradict on a position that names its
  // own foot: a right-foot plant under an arabesque drawn on the left would print as a fault nobody
  // made.
  if (levelOf(key, null).lift > 0.05) return null;
  const byPose = PLANT_BY_POSE[key.pose || 'none'];
  let foot;
  // A turn keeps the foot she arrived on — it is the one the fourth prepared her onto. From both
  // feet there is no standing leg to keep, so the derived answer stands.
  if (key.turn) foot = lead === 'left' || lead === 'right' ? lead : null;
  else if (step === 'walk') foot = otherFoot(lead);
  else foot = i === count - 1 ? otherFoot(lead) : 'both';
  if (!foot) return null;
  if (byPose && byPose !== 'both' && byPose !== foot) return null;
  return foot;
}

// The stations a phrase needs, placed after the dancer's last one. The heading is carried
// over from the last leg she actually travelled, so three phrases in a row make a line
// across the stage instead of a zigzag — and a phrase that would walk her into the wings is
// turned round rather than placed off the deck.
export function phraseStations(show, dancer, opts = {}) {
  const keys = (dancer && dancer.keys) || [];
  const last = keys[keys.length - 1];
  if (!last) return [];
  const shape = phraseShape(opts.step);
  const spec = PHRASE_SHAPES[shape.step];
  const pose = POSE_LABEL[opts.pose] && opts.pose !== 'none' ? opts.pose : 'none';
  const level = LEVEL_LABEL[opts.level] ? opts.level : 'flat';
  const dist = Number.isFinite(Number(opts.dist)) && Number(opts.dist) >= 0 ? Number(opts.dist) : shape.travel;
  // The phrase's time comes out of the music: a count is a beat at the show's tempo, and the
  // phrase's stations divide the counts the step is given. `snap` moves the start onto the
  // count (1) or the bar, and nothing else about where the phrase goes depends on it.
  const counts = Number(opts.counts) > 0 ? Number(opts.counts) : shape.counts;
  // The grid is the music's, which runs on the show's clock, so a dancer with a hold in her
  // path starts on content time rather than by shifting her own local clock — her stations
  // land on the count the music is playing, whatever her path has done about it. A moment
  // already resolved by `phraseStart` is used as it stands, which is how a phrase put on a
  // chosen bar begins there instead of at the end of her path.
  const given = Number(opts.startLocal);
  const start = Number.isFinite(given) ? given : phraseStart(show, dancer, opts).t;

  let hx = 1;
  let hy = 0;
  for (let i = keys.length - 2; i >= 0; i--) {
    const dx = last.x - keys[i].x;
    const dy = last.y - keys[i].y;
    const len = Math.hypot(dx, dy);
    if (len > 0.2) {
      hx = dx / len;
      hy = dy / len;
      break;
    }
  }
  const st = (show && show.stage) || {};
  const w = Number.isFinite(st.width) ? st.width : 12;
  const d = Number.isFinite(st.depth) ? st.depth : 8;
  const on = (x, y) => Math.abs(x) <= w / 2 - 0.1 && y >= 0.2 && y <= d - 0.2;
  if (dist > 0 && !on(last.x + hx * dist, last.y + hy * dist) && on(last.x - hx * dist, last.y - hy * dist)) {
    hx = -hx;
    hy = -hy;
  }

  // A hold inside the phrase must not stretch what comes after it. Each station is aimed at a
  // moment on the music's clock — `phraseMoments`, which also moves the arrival before a stop
  // towards the stop, as far as the leg after it can spare — and then mapped back into her own
  // clock through the holds, so the stop falls
  // *between* two arrivals and the phrase resumes on the count after it. A count that lands inside
  // the hold itself cannot be danced at that moment at all; it takes the moment the hold releases
  // her, and the between-counts warning says that it did.
  const { moments } = phraseMoments(show, dancer, { step: shape.step, counts, startLocal: start });
  // The foot the phrase begins from, read once: every arrival in it alternates from the foot she was
  // standing on when the phrase started, not from a preparation inside it.
  const lead = phraseLead(dancer);
  let prev = start;
  return spec.stations.map((s, i) => {
    let t = Math.round(localOfContent(show, dancer.id, moments[i]));
    // Two stations cannot share a moment: a second count swallowed by the same hold sits just
    // after the first, which keeps the path a path rather than a jump.
    if (t <= prev) t = prev + 1;
    const dur = Math.max(1, t - prev);
    prev = t;
    const key = {
      t,
      x: round2(last.x + hx * dist * s.f),
      y: round2(last.y + hy * dist * s.f),
      dur,
      pose: s.pose === 'arrive' ? pose : s.pose,
      step: s.step,
      level: s.level === 'arrive' ? level : s.level,
      ease: s.ease,
    };
    if (s.turn) key.turn = s.turn;
    const foot = phrasePlant(shape.step, i, spec.stations.length, lead, key);
    if (foot) key.plant = foot;
    return key;
  });
}

// Where a phrase's stations would fall in the music if it were put on a moment now: the count it
// starts on and the count each station lands in. Built from the same `phraseStations` the
// placement uses, so a preview cannot promise a station the placement then puts somewhere else.
// Read-only — nothing on the dancer is touched, which is what makes it safe to call on every
// pointer move.
// The stretch of the music a hold freezes: from the last instant before it to the moment she is
// moving again. A count inside it is a count she cannot be standing on.
function holdSpanOf(show, trackId, hold) {
  return {
    from: contentOfLocal(show, trackId, Math.max(0, hold.t - 1)),
    to: contentOfLocal(show, trackId, hold.t),
  };
}

export function phrasePlan(show, dancer, opts = {}) {
  const keys = (dancer && dancer.keys) || [];
  if (!keys.length) return null;
  const start = phraseStart(show, dancer, opts);
  const stations = phraseStations(show, dancer, { ...opts, startLocal: start.t });
  const steps = stations.map((k) => {
    const content = contentOfLocal(show, dancer.id, k.t);
    return { t: k.t, content, at: countAt(show, content), off: offCount(show, content) };
  });
  // A station that did not land on the moment it was aimed at was pushed past a hold, which means
  // the hold is covering a beat of the phrase: the phrase can be split by a stop *between* its
  // stations, but not across one that eats an arrival.
  const shape = phraseShape(opts.step);
  const counts = Number(opts.counts) > 0 ? Number(opts.counts) : shape.counts;
  const { moments } = phraseMoments(show, dancer, { step: shape.step, counts, startLocal: start.t });
  const spans = holdsFor(show, dancer.id).map((h) => ({ h, ...holdSpanOf(show, dancer.id, h) }));
  let swallowed = 0;
  let cover = null;
  steps.forEach((s, i) => {
    const aimed = moments[i];
    if (aimed == null || Math.abs(s.content - aimed) <= COUNT_EPS) return;
    swallowed++;
    if (!cover) {
      const hit = spans.find((sp) => aimed > sp.from && aimed <= sp.to);
      cover = hit ? hit.h : null;
    }
  });
  // A hold between two of its stations freezes her mid-phrase: the arrivals after it are pushed
  // later in the music by its length, so the phrase takes more counts than the sheet promised even
  // when every arrival still lands on a beat.
  const lastLocal = steps.length ? steps[steps.length - 1].t : start.t;
  const held = holdsWithin(show, dancer.id, start.t, lastLocal);
  return {
    start: { ...start, at: start.ct == null ? null : countAt(show, start.ct) },
    steps,
    // How many arrivals sit between beats, and by how much the worst of them does.
    off: steps.filter((s) => s.off !== 0).length,
    worst: steps.reduce((n, s) => Math.max(n, Math.abs(s.off)), 0),
    // How many holds it would cross, and how much music they add inside it.
    holds: held.length,
    stretch: held.reduce((n, h) => n + (Number(h.duration) || 0), 0),
    // How many of its arrivals a hold would swallow, and the first hold that does.
    swallowed,
    cover,
  };
}

// Place a phrase on a dancer's path: the stations its step needs, appended after the last one,
// and — when the last one is where a phrase arrived — the junction between the two made into
// one movement rather than two. Returns the stations added, whether they were linked and how
// much of the music they took, so the app can say which happened.
export function addPhrase(show, dancer, opts = {}) {
  const keys = (dancer && dancer.keys) || [];
  const last = keys[keys.length - 1];
  if (!last) return { added: [], linked: false, counts: 0, ms: 0, start: null };
  // Where it begins, decided once here and handed down: a phrase put on a bar of the music may
  // begin well after her path ends, and then the leg into it is a long one rather than a join.
  const start = phraseStart(show, dancer, opts);
  const linked = last.phraseEnd === true && start.t <= last.t + 1;
  const added = phraseStations(show, dancer, { ...opts, startLocal: start.t });
  if (!added.length) return { added, linked: false, counts: 0, ms: 0, start };
  if (linked) {
    // The station is passed through: the position is reached exactly at it and left straight
    // away, instead of arriving a third of a leg early and holding.
    last.pass = true;
    // Settling into a station and then gathering out of it are both slow at both ends, which
    // is two stops back to back. The count goes through evenly so the junction is one speed.
    if (last.ease === 'decel' || last.ease === 'both') last.ease = 'even';
    if (added[0].ease === 'accel' || added[0].ease === 'both') added[0].ease = 'even';
  }
  added[added.length - 1].phraseEnd = true;
  keys.push(...added);
  const ms = added.reduce((n, k) => n + (Number(k.dur) || 0), 0);
  const grid = countGrid(show);
  // Said out loud after the fact as well as before it: a phrase that stops for a hold takes more
  // music than its counts, and the stations after the hold are late by the length of it.
  const held = holdsWithin(show, dancer.id, start.t, added[added.length - 1].t);
  return {
    added,
    linked,
    ms,
    counts: ms / grid.count,
    start,
    holds: held.length,
    stretch: held.reduce((n, h) => n + (Number(h.duration) || 0), 0),
  };
}

export const LAYERS = [['front', 'Front'], ['center', 'Centre'], ['back', 'Back']];
// Drops hang on separate pipes behind one another, forty-odd centimetres apart:
// the front one masks everything behind it, and flying it out reveals the next.
// That gap is what makes a change possible, so new drops are spaced by it.
export const DROP_GAP = 0.45;
const DROP_COLORS = ['#243b52', '#3a2f4a', '#2f4a3d', '#4a3a2f'];
// A scene card is a board, so it is a board's colour rather than a cloth's.
const CARD_COLOR = '#ded4bd';
// A card is held up in front of everything, at the front of the stage: near the
// proscenium, narrow enough for a person to carry, hip to chest high.
const CARD_SPAN = 1.6;
const CARD_H = 0.9;
// Downstage of the main curtain: a card is walked on in front of the house, not
// behind the tabs with the scene changes.
const CARD_DEPTH = 0.3;

// What a new lantern is given before it is placed: a warm open white, hung high
// enough to cover a dancer, washing a pool a little wider than two people.
const LIGHT_COLORS = ['#ffe0b0', '#8fd3ff', '#c9a6ff', '#9be07a', '#ff9b7a', '#ff7da4'];
const LIGHT_LEVEL = 0.8;
const LIGHT_SPREAD = 3.2;

// Two lanterns, because they are the two the stage actually has: a spot has a lens
// and an edge, a flood has neither. A flood is what lights a scene; a spot is what
// picks somebody out of it.
export const LIGHT_TYPES = [
  ['spot', 'Spot'],
  ['flood', 'Flood'],
];
// How wide each one washes when it is first hung, in metres.
export const LIGHT_SPREAD_BY_TYPE = { spot: 2.4, flood: 6 };

// A gobo is a template in front of the lens: the pool takes its shape, so a star
// field on the floor is a cloth a designer can see rather than a note on a cue sheet.
export const LIGHT_GOBOS = [
  ['none', 'open'],
  ['stars', 'star field'],
  ['dapple', 'dapple'],
  ['window', 'window'],
];

// The gels a lantern is most often asked for, hottest first, so most of the choosing
// is one click rather than opening a colour wheel in the dark.
export const LIGHT_GELS = [
  '#ffe0b0', '#ffd27a', '#ffac5e', '#ff7a5e', '#ff5a76',
  '#ff6bd0', '#c9a6ff', '#8f9bff', '#8fd3ff', '#9be07a',
];

// What those gels are called in a booth, so paper can say "straw" instead of a hex
// code. A colour mixed on the wheel has no name and prints as its code.
export const GEL_NAMES = {
  '#ffe0b0': 'warm white',
  '#ffd27a': 'straw',
  '#ffac5e': 'amber',
  '#ff7a5e': 'salmon',
  '#ff5a76': 'red',
  '#ff6bd0': 'magenta',
  '#c9a6ff': 'lavender',
  '#8f9bff': 'blue',
  '#8fd3ff': 'daylight',
  '#9be07a': 'green',
};

/* Costumes are the wardrobe rather than the cast: a costume is a set of colours and a
   shape, and a performer is dressed by naming one. It lives in the show file, so a show
   sent to another machine arrives wearing what it was dressed in, and a show with no
   costumes opens and plays exactly as it always did — undressed dancers are drawn in
   their own cast colour. */
const COSTUME_COLORS = ['#b8405e', '#3f7fa6', '#6d5aa8', '#2f8f6b', '#b07a2a', '#8f4a7c', '#4a6fa8', '#a8562f'];
// What the body of the costume is cut like. From above only a skirt is visible, so
// this is the one thing the plan can honestly show of it.
export const COSTUME_STYLES = [
  ['tutu', 'Tutu'],
  ['tunic', 'Tunic'],
  ['plain', 'Plain'],
];
const COSTUME_STYLE_WORD = Object.fromEntries(COSTUME_STYLES);

export const STORAGE_KEY = 'choreographer.show.v1';

let seq = 1;
export function uid(prefix = 'id') {
  return prefix + '-' + Date.now().toString(36) + '-' + (seq++).toString(36);
}

export const state = {
  show: null,
  ui: {
    selectedId: null,
    selectedTrack: null,
    // The lantern being edited, if any. A light is not a performer or a prop, so
    // it keeps its own focus rather than crowding `selectedId`.
    lightId: null,
    playhead: 0,
    playing: false,
    lastFrame: 0,
    activePause: null,
    pxPerSec: 30,
    scrollT: 0,
    vscroll: 0,
    onlyFocused: false,
    placingStations: false,
    stationIdx: null,
    // The scenery cue being edited, if any: the band on the timeline and the row
    // in the panel are the same thing, selected in either place.
    cueId: null,
    // The music fade being edited, the same way.
    musicCueId: null,
    // A phrase armed from the movement sheet and waiting for a count to be clicked on the
    // timeline ruler: `{ id, step, pose, level, counts }`. Transient, like the rest of the ui,
    // so a show reopened tomorrow has no half-placed phrase in it.
    phraseArmed: null,
    // A run-through: the stage alone, playing, with the editor's hands off it.
    watch: false,
    // Which view has been given the whole centre — `null`, `'plan'` or `'elevation'` —
    // and whether the elevation shrinks figures with their distance upstage. Both are
    // ways of looking at the show, so they are kept beside it, not inside it.
    fill: null,
    depth: true,
    pauseOnCollision: true,
    snap: true,
    collision: null,
    dirtyPanels: true,
  },
  history: [],
  future: [],
};

/* ------------------------------------------------------------------ model */

/* Wing legs stand in the wings and never cross the stage floor. Two a side is
   the usual arrangement, splitting each wing into front, middle and back. */
export function defaultWingLegs(stage) {
  return [-1, 1].flatMap((side) => [
    { id: uid('leg'), side, y: stage.depth * 0.32 },
    { id: uid('leg'), side, y: stage.depth * 0.68 },
  ]);
}

function bayNames(n) {
  if (n <= 1) return ['WING'];
  if (n === 2) return ['FRONT', 'BACK'];
  if (n === 3) return ['FRONT', 'MIDDLE', 'BACK'];
  const out = ['FRONT'];
  for (let i = 1; i < n - 1; i++) out.push(String(i));
  out.push('BACK');
  return out;
}

// Drop a new leg into the widest gap on that side, keeping clearance between
// neighbours. Returns null when the wing has no room left.
const LEG_CLEARANCE = 0.6;
function widestGap(show, side) {
  const ys = show.wingLegs
    .filter((l) => l.side === side)
    .map((l) => l.y)
    .sort((a, b) => a - b);
  const edges = [0, ...ys, show.stage.depth];
  let best = null;
  for (let i = 0; i < edges.length - 1; i++) {
    const gap = edges[i + 1] - edges[i];
    if (gap >= LEG_CLEARANCE * 2 && (!best || gap > best.gap)) {
      best = { lo: edges[i], hi: edges[i + 1], gap };
    }
  }
  return best;
}

export function canAddWingLeg(show, side) {
  return !!widestGap(show, side);
}

export function addWingLeg(show, side) {
  const best = widestGap(show, side);
  if (!best) return null;
  const leg = {
    id: uid('leg'),
    side: side === 1 ? 1 : -1,
    y: Math.round(((best.lo + best.hi) / 2) * 100) / 100,
  };
  show.wingLegs.push(leg);
  return leg;
}

export function removeWingLeg(show, id) {
  show.wingLegs = show.wingLegs.filter((l) => l.id !== id);
}

// The bays one wing is divided into, downstage first.
export function wingBays(show, side) {
  const ys = show.wingLegs
    .filter((l) => l.side === side)
    .map((l) => l.y)
    .sort((a, b) => a - b);
  const edges = [0, ...ys, show.stage.depth];
  const names = bayNames(edges.length - 1);
  return edges.slice(0, -1).map((lo, i) => ({ lo, hi: edges[i + 1], name: names[i] }));
}

/* Acts: the running order. A show is one continuous clock cut into acts, which is
   how a play runs — the set stays, performers keep their tracks, and an interval
   is a pause at the boundary. An act owns a length rather than a start time, so
   acts cannot overlap or leave gaps, and the clock reaches the end of the last
   act even before anything in it has been choreographed. */
export const ACT_MIN_MS = 10000;
export const ACT_MAX_MS = 4 * 60 * 60 * 1000;
export const DEFAULT_ACT_MS = 120000;

function clampActLength(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_ACT_MS;
  return Math.max(ACT_MIN_MS, Math.min(ACT_MAX_MS, Math.round(n)));
}

export function totalActLength(show) {
  const acts = show && Array.isArray(show.acts) ? show.acts : [];
  return acts.reduce((n, a) => n + Math.max(0, Number(a.length) || 0), 0);
}

// Each act with the stretch of the clock it owns, in content time.
export function actRanges(show) {
  let at = 0;
  return (show && Array.isArray(show.acts) ? show.acts : []).map((a) => {
    const start = at;
    at += Math.max(0, Number(a.length) || 0);
    return { id: a.id, name: a.name, start, end: at };
  });
}

// Which act a moment belongs to. Before the first act the answer is the first.
export function actAt(show, ct) {
  const ranges = actRanges(show);
  if (!ranges.length) return null;
  for (let i = ranges.length - 1; i >= 0; i--) if (ct >= ranges[i].start) return ranges[i];
  return ranges[0];
}

/* Scenes: named moments inside an act. A scene owns an offset from its act's
   start and runs until the next scene, or the end of the act, so a scene is only
   ever a label — cutting one cannot move a station, cue or hold. */
export function scenesOf(act) {
  return (act && Array.isArray(act.scenes) ? act.scenes : []).slice().sort((a, b) => a.offset - b.offset);
}

// Keep a scene inside its act, which matters when the act is shortened.
export function clampSceneOffsets(act) {
  if (!act || !Array.isArray(act.scenes)) return;
  const max = Math.max(0, Math.max(ACT_MIN_MS, Number(act.length) || 0) - 1000);
  act.scenes.forEach((s) => {
    s.offset = Math.max(0, Math.min(Math.round(Number(s.offset) || 0), max));
  });
  act.scenes.sort((a, b) => a.offset - b.offset);
}

/* Casting: what each performer is in an act. It lives on the act rather than on the
   dancer, because the same body plays a Snowflake in one act and a Flower in the next,
   and because the casting sheet is printed per act. A role is a name, not a reference:
   typing one against a dancer is the whole of casting, and a performer with no role is
   still in the company — she just is not playing anyone in that act. */
const ROLE_MAX = 60;

export function rolesOf(act) {
  const given = act && act.roles && typeof act.roles === 'object' ? act.roles : {};
  const out = {};
  for (const [id, v] of Object.entries(given)) {
    const name = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, ROLE_MAX);
    if (name) out[id] = name;
  }
  return out;
}

// What one performer is in one act, or an empty string when nobody has cast them.
export function roleOf(act, dancerId) {
  if (!act || !dancerId) return '';
  return rolesOf(act)[dancerId] || '';
}

// Cast a performer, or clear them by handing an empty name. Returns what was kept,
// so the field can be put back to what the show actually holds.
export function setRole(show, actId, dancerId, value) {
  const act = (show && Array.isArray(show.acts) ? show.acts : []).find((a) => a.id === actId);
  if (!act || !dancerId) return '';
  act.roles = act.roles && typeof act.roles === 'object' ? act.roles : {};
  const name = String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, ROLE_MAX);
  if (name) act.roles[dancerId] = name;
  else delete act.roles[dancerId];
  return name;
}

// Every scene with the stretch of the show it names, in content time.
export function sceneRanges(show) {
  const out = [];
  actRanges(show).forEach((r, i) => {
    const act = (show.acts || []).find((a) => a.id === r.id);
    const list = scenesOf(act);
    list.forEach((s, j) => {
      out.push({
        id: s.id,
        name: s.name,
        act: r.name,
        actIndex: i,
        start: r.start + s.offset,
        end: j + 1 < list.length ? r.start + list[j + 1].offset : r.end,
      });
    });
  });
  return out;
}

// The scene a moment falls in, or null when that part of the act has no scene.
export function sceneAt(show, ct) {
  const ranges = sceneRanges(show);
  for (let i = ranges.length - 1; i >= 0; i--) {
    if (ct >= ranges[i].start && ct < ranges[i].end) return ranges[i];
  }
  return null;
}

// Mark a scene at the playhead, inside whichever act that is.
export function addScene(show, ct) {
  const range = actAt(show, ct);
  if (!range) return null;
  const act = (show.acts || []).find((a) => a.id === range.id);
  if (!act) return null;
  act.scenes = Array.isArray(act.scenes) ? act.scenes : [];
  const offset = Math.max(0, Math.min(Math.round(ct - range.start), Math.max(0, act.length - 1000)));
  // Two scenes on the same moment would make an empty one.
  if (act.scenes.some((s) => Math.abs(s.offset - offset) < 500)) return null;
  const scene = { id: uid('sc'), name: 'Scene ' + (act.scenes.length + 1), offset };
  act.scenes.push(scene);
  act.scenes.sort((a, b) => a.offset - b.offset);
  return scene;
}

// Slide a scene boundary to a moment in the show. It stays inside its own act,
// and it will not cross another scene: two boundaries on one moment would leave
// an empty scene that normalise silently deletes later. Returns null when the
// move is refused, so the caller can leave the boundary where it was.
export function moveSceneTo(show, id, ct) {
  for (const act of show.acts || []) {
    const scene = (act.scenes || []).find((s) => s.id === id);
    if (!scene) continue;
    const range = actRanges(show).find((r) => r.id === act.id);
    const start = range ? range.start : 0;
    const max = Math.max(0, Math.max(ACT_MIN_MS, Number(act.length) || 0) - 1000);
    const offset = Math.max(0, Math.min(max, Math.round(ct - start)));
    const clash = (act.scenes || []).some((s) => s !== scene && Math.abs(s.offset - offset) < 500);
    if (clash) return null;
    scene.offset = offset;
    act.scenes.sort((a, b) => a.offset - b.offset);
    return scene;
  }
  return null;
}

export function removeScene(show, id) {
  for (const act of show.acts || []) {
    const i = (act.scenes || []).findIndex((s) => s.id === id);
    if (i < 0) continue;
    act.scenes.splice(i, 1);
    return true;
  }
  return false;
}

export function addAct(show) {
  const act = { id: uid('act'), name: 'Act ' + (show.acts.length + 1), length: DEFAULT_ACT_MS, roles: {} };
  show.acts.push(act);
  return act;
}

// Anything that would move if this act were cut out: stations, cues, holds,
// pauses and hand-offs that fall inside it.
export function actHasWork(show, act) {
  const ranges = actRanges(show);
  const i = ranges.findIndex((r) => r.id === act.id);
  if (i < 0) return false;
  const { start, end } = ranges[i];
  const within = (t) => t >= start && t < end;
  const onTimer = show.cast.concat(show.scenery.filter((s) => s.kind === 'prop'));
  if (onTimer.some((o) => (o.keys || []).some((k) => within(contentOfLocal(show, o.id, k.t))))) return true;
  if (show.markers.some((m) => within(m.t))) return true;
  if (show.scenery.some((s) => (s.cues || []).some((c) => within(c.at)))) return true;
  if (show.scenery.some((s) => (s.carryHandoffs || []).some((h) => within(h.at)))) return true;
  return false;
}

// Removing an act would slide everything after it earlier on the clock, so only
// an empty last act can go, and never the only one: a show always has an act.
export function removeAct(show, id) {
  const acts = show.acts || [];
  const last = acts[acts.length - 1];
  if (acts.length < 2 || !last || last.id !== id || actHasWork(show, last)) return false;
  acts.pop();
  return true;
}

export function createShow() {
  // openingH is the height of the proscenium arch; dancerH is how tall a performer
  // is drawn in the elevation. Both are the house's, not the show's, but they are
  // cheap to change and every height on stage is read against them.
  const stage = { width: 12, depth: 8, wingDepth: 4, grid: 0.5, openingH: 7.5, dancerH: 1.7 };
  return {
    name: 'Untitled show',
    stage,
    cast: [],
    // The wardrobe: costumes are named here and worn by performers, so a show with
    // none is simply undressed rather than broken.
    costumes: [],
    scenery: [],
    wingLegs: defaultWingLegs(stage),
    markers: [],
    acts: [{ id: uid('act'), name: 'Act 1', length: DEFAULT_ACT_MS, roles: {} }],
    nextNumber: 1,
    // The show's music, as a list: each entry is a track with its own entry
    // point, level and fades, listed and removed like the cast. Only the name,
    // entry point and length live here — the audio itself is far too big for a
    // show file, so the bytes sit in the browser's own store under `key`.
    musicTracks: [],
    // Video and image bytes live in media storage; show metadata keeps only keys.
    videos: [],
    images: [],
    slideCues: [],
    // How long a new cue takes when it is placed rather than drawn, in milliseconds:
    // a curtain move, a music fade, a hold and a pause. They belong to the show
    // because a company reopens a show and expects it to fly and fade the way it was
    // staged, and they are edited in the Show settings section.
    prefs: { cueDur: 1500, fadeDur: 2000, lightDur: 2000, holdDur: 1500, pauseDur: 2000, tempo: DEFAULT_TEMPO, beatsPerBar: DEFAULT_BEATS },
    // Lighting: each lantern hangs over a spot on the floor with a colour, a
    // standing level and its own cues. A show with none is dark, and everything
    // else still works.
    lights: [],
    // Narration: the spoken word, as clips on their own row. A show has as many
    // as it has voice pieces, and they are not exclusive the way music tracks are
    // — two can overlap, because a narrator can speak under a recorded line.
    narration: [],
    trackVis: { curtain: true, music: true, lights: true, narration: true },
  };
}

export function normalise(show) {
  const base = createShow();
  const out = Object.assign(base, show || {});
  out.stage = Object.assign(base.stage, (show && show.stage) || {});
  const opening = Number(out.stage.openingH);
  out.stage.openingH = Number.isFinite(opening) ? Math.max(2.5, Math.min(20, opening)) : 7.5;
  const dancerH = Number(out.stage.dancerH);
  out.stage.dancerH = Number.isFinite(dancerH) ? Math.max(1, Math.min(2.4, dancerH)) : 1.7;
  out.trackVis = Object.assign(
    { curtain: true, music: true, lights: true, narration: true },
    (show && show.trackVis) || {}
  );
  const finiteModel = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const uniqueId = (value, prefix, used) => {
    let id = typeof value === 'string' && value ? value : uid(prefix);
    if (used.has(id)) id = uid(prefix);
    while (used.has(id)) id = uid(prefix);
    used.add(id);
    return id;
  };
  out.videos = (Array.isArray(show && show.videos) ? show.videos : [])
    .filter((clip) => clip && typeof clip === 'object' && clip.key)
    .map((clip) => {
      const finite = (value, fallback) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
      };
      const length = Math.max(0, Math.round(finite(clip.length, 0)));
      const trimIn = Math.max(0, Math.min(length, Math.round(finite(clip.trimIn, 0))));
      const trimOut = Math.max(trimIn, Math.min(length, Math.round(finite(clip.trimOut, length))));
      return {
        id: clip.id || uid('vid'),
        key: String(clip.key),
        name: String(clip.name == null ? 'Video' : clip.name) || 'Video',
        at: Math.max(0, Math.round(finite(clip.at, 0))),
        length,
        trimIn,
        trimOut,
        muted: clip.muted === true,
        level: Math.max(0, Math.min(1, finite(clip.level, 1))),
      };
    })
    .sort((a, b) => a.at - b.at);
  // Image media is metadata-only: binary data stays in the media store.
  const usedImageIds = new Set();
  out.images = (Array.isArray(show && show.images) ? show.images : [])
    .filter((image) => image && typeof image === 'object' && image.key)
    .map((image) => ({
      id: uniqueId(image.id, 'img', usedImageIds),
      key: String(image.key),
      name: String(image.name == null ? 'Image' : image.name) || 'Image',
      width: Math.max(0, finiteModel(image.width, 0)),
      height: Math.max(0, finiteModel(image.height, 0)),
    }));
  const usedCueIds = new Set();
  out.slideCues = (Array.isArray(show && show.slideCues) ? show.slideCues : [])
    .filter((cue) => cue && typeof cue === 'object')
    .map((cue) => ({
      id: uniqueId(cue.id, 'slide', usedCueIds),
      at: Math.max(0, Math.round(finiteModel(cue.at, 0))),
      imageId: cue.imageId == null ? null : String(cue.imageId),
      fade: Math.max(0, Math.min(120000, Math.round(finiteModel(cue.fade, 1000)))),
    }))
    .sort((a, b) => a.at - b.at);
  // A show from before narration has an empty list, which is exactly right: a
  // show with no voice plays as it always did.
  out.narration = (Array.isArray(show && show.narration) ? show.narration.slice() : [])
    .filter((c) => c && c.key)
    .map((c) => ({
      id: c.id || uid('vo'),
      key: String(c.key),
      name: String(c.name == null ? 'Narration' : c.name) || 'Narration',
      at: Number.isFinite(Number(c.at)) ? Math.max(0, Math.round(Number(c.at))) : 0,
      length: Number.isFinite(Number(c.length)) ? Math.max(0, Math.round(Number(c.length))) : 0,
    }))
    .sort((a, b) => a.at - b.at);
  // A show used to hold one track. That becomes the first entry in the list, so
  // an existing show keeps its music and its fades without being touched.
  const legacy = show && show.music && typeof show.music === 'object' && show.music.key ? show.music : null;
  const listed = Array.isArray(show && show.musicTracks) ? show.musicTracks.slice() : [];
  if (legacy && !listed.length) listed.push(legacy);
  out.musicTracks = listed
    .filter((t) => t && t.key)
    .map((t) => {
      const start = Number(t.start);
      const length = Number(t.length);
      return {
        id: t.id || uid('trk'),
        key: String(t.key),
        name: String(t.name == null ? 'Music' : t.name) || 'Music',
        start: Number.isFinite(start) ? Math.max(0, Math.round(start)) : 0,
        length: Number.isFinite(length) ? Math.max(0, Math.round(length)) : 0,
        // Absent means "the whole file", so an old show keeps playing its track
        // to the end and a trimmed one keeps the trim across a reload.
        play: Number.isFinite(Number(t.play)) ? Math.max(0, Math.round(Number(t.play))) : undefined,
        level: Number.isFinite(Number(t.level)) ? Math.max(0, Math.min(1, Number(t.level))) : 1,
        visible: t.visible !== false,
        cues: (Array.isArray(t.cues) ? t.cues : [])
          .filter((c) => c && Number.isFinite(Number(c.level)))
          .map((c) => ({
            id: c.id || uid('f'),
            at: Math.max(0, Math.round(Number(c.at) || 0)),
            dur: Math.max(0, Math.round(Number(c.dur) || 0)),
            level: Math.max(0, Math.min(1, Number(c.level))),
          }))
          .sort((a, b) => a.at - b.at),
      };
    })
    .sort((a, b) => a.start - b.start);
  delete out.music;
  out.cast = Array.isArray(out.cast) ? out.cast : [];
  out.cast.forEach((d) => {
    if (!d || !d.footTrajectory) return;
    try {
      validateFootTrajectory(d.footTrajectory);
    } catch {
      delete d.footTrajectory;
    }
  });
  out.narration = Array.isArray(out.narration) ? out.narration : [];
  // Two minutes is the ceiling either way: a cue longer than that is a scene
  // change, not a move, and the field would be lying about what it sets.
  const prefs = (show && show.prefs) || {};
  const dur = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(120000, n)) : fallback;
  };
  out.prefs = {
    cueDur: dur(prefs.cueDur, 1500),
    fadeDur: dur(prefs.fadeDur, 2000),
    lightDur: dur(prefs.lightDur, 2000),
    // A hold or a pause of nothing would be a marker that does nothing, so these
    // two have a floor as well as the two-minute ceiling.
    holdDur: Math.max(100, dur(prefs.holdDur, 1500)),
    pauseDur: Math.max(100, dur(prefs.pauseDur, 2000)),
    // How long the show takes the music down into its end. Zero is a real choice
    // here — the music stops on the beat — so this one has no floor.
    endFade: dur(prefs.endFade, 2000),
    // The music's clock: a count is one beat and a bar is a measure of them. Phrases are
    // counted in these, so a step lands on the band instead of taking whatever length it
    // fancies. A show written before this counts a walking 120 in four.
    tempo: Number.isFinite(Number(prefs.tempo))
      ? Math.max(20, Math.min(300, Math.round(Number(prefs.tempo))))
      : DEFAULT_TEMPO,
    beatsPerBar: Number.isFinite(Number(prefs.beatsPerBar))
      ? Math.max(1, Math.min(16, Math.round(Number(prefs.beatsPerBar))))
      : DEFAULT_BEATS,
  };
  out.scenery = Array.isArray(out.scenery) ? out.scenery : [];
  out.markers = Array.isArray(out.markers) ? out.markers : [];
  // One performance has one end. A file that somehow carries two keeps the first
  // readable one rather than leaving the clock with two opinions.
  let keptEnd = false;
  out.markers = out.markers.filter((m) => {
    if (!m || m.kind !== 'end') return true;
    if (keptEnd || !Number.isFinite(Number(m.t))) return false;
    keptEnd = true;
    m.t = Math.max(0, Math.round(Number(m.t)));
    return true;
  });
  out.wingLegs =
    Array.isArray(out.wingLegs) && out.wingLegs.length ? out.wingLegs : defaultWingLegs(out.stage);
  out.wingLegs.forEach((leg) => {
    if (!leg.id) leg.id = uid('leg');
    if (leg.side !== 1) leg.side = -1;
    const y = Number(leg.y);
    leg.y = Math.min(
      Math.max(Number.isFinite(y) ? y : out.stage.depth * 0.5, 0.45),
      Math.max(0.5, out.stage.depth - 0.45)
    );
  });
  // The wardrobe. A show written before costumes has none, and its dancers are drawn
  // in their own colours exactly as they were.
  const hex = (v, fallback) => (/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : fallback);
  out.costumes = (Array.isArray(show && show.costumes) ? show.costumes : [])
    .filter((c) => c && typeof c === 'object')
    .map((c, i) => ({
      id: c.id || uid('cos'),
      name: String(c.name == null ? '' : c.name).trim() || 'Costume ' + (i + 1),
      // Body and skirt are the two colours that read at a glance; the hair is a small
      // thing that still makes a figure look dressed.
      body: hex(c.body, COSTUME_COLORS[i % COSTUME_COLORS.length]),
      skirt: hex(c.skirt, COSTUME_COLORS[(i + 3) % COSTUME_COLORS.length]),
      hair: hex(c.hair, '#3b2b26'),
      style: COSTUME_STYLES.some(([v]) => v === c.style) ? c.style : 'tutu',
    }));
  out.cast.forEach((d) => {
    d.keys = Array.isArray(d.keys) ? d.keys.sort((a, b) => a.t - b.t) : [];
    // A station written before steps existed walks in and does not turn, which is what
    // it did on screen anyway.
    d.keys.forEach((k) => {
      if (!STEPS.some(([v]) => v === k.step)) k.step = 'walk';
      const turn = Number(k.turn);
      k.turn = Number.isFinite(turn) ? Math.max(-720, Math.min(720, turn)) : 0;
      // A turn with no length of its own takes the leg into its station, which is what
      // every turn did before lengths existed.
      const ms = Number(k.turnMs);
      k.turnMs = Number.isFinite(ms) && ms > 0 ? Math.min(60000, Math.round(ms)) : null;
      // A path written before bends existed is straight, which is how it drew.
      const bend = Number(k.bend);
      k.bend = Number.isFinite(bend) ? Math.max(-BEND_LIMIT, Math.min(BEND_LIMIT, bend)) : 0;
      // A leg written before counts could be shaped was walked evenly, which is what it did.
      if (!EASE_LABEL[k.ease]) k.ease = 'even';
      // A station a linked phrase passes through, and the arrival where a phrase ends: both
      // are facts about the path, so they are kept as written and absent means neither.
      k.pass = k.pass === true;
      k.phraseEnd = k.phraseEnd === true;
      // The foot a station stands on, when it has been typed. Absent means the position decides,
      // which is what every station written before contact existed did silently.
      k.plant = PLANTS.indexOf(k.plant) >= 0 ? k.plant : null;
      // A station written before levels existed stands flat on the floor, which is how it
      // was drawn: no rise, no air, nothing to see change.
      if (!LEVEL_LABEL[k.level]) k.level = 'flat';
      const lift = Number(k.lift);
      k.lift = Number.isFinite(lift) && lift > 0 ? Math.min(LIFT_MAX, lift) : null;
      // No absorption typed means the landing gives as much as it needs to, which is what a
      // landing written before absorptions existed did not do — and what it should have.
      const absorb = Number(k.absorb);
      const given = k.absorb !== null && k.absorb !== undefined && k.absorb !== '';
      k.absorb = given && Number.isFinite(absorb) && absorb >= 0 ? Math.min(ABSORB_MAX, absorb) : null;
    });
    if (d.visible === undefined) d.visible = true;
    // A costume that has been deleted cannot still be worn: the performer goes back to
    // their own cast colour rather than to a costume nobody can see or edit.
    d.costumeId = out.costumes.some((c) => c.id === d.costumeId) ? d.costumeId : null;
  });
  out.scenery.forEach((s) => {
    // Cues apply to every piece of scenery, so they are tidied before the
    // prop-only rules below.
    const cues = Array.isArray(s.cues) ? s.cues : [];
    s.cues = cues
      .filter((c) => c && Number.isFinite(Number(c.at)))
      .map((c) => {
        const cue = {
          id: c.id || uid('c'),
          at: Math.max(0, Math.round(Number(c.at))),
          dur: Math.max(0, Math.round(Number(c.dur) || 0)),
        };
        if (Number.isFinite(Number(c.open))) cue.open = Math.max(0, Math.min(1, Number(c.open)));
        if (Number.isFinite(Number(c.fly))) cue.fly = Math.max(0, Math.min(1, Number(c.fly)));
        if (Number.isFinite(Number(c.shown))) cue.shown = Math.max(0, Math.min(1, Number(c.shown)));
        return cue;
      })
      .sort((a, b) => a.at - b.at);
    if (s.kind !== 'prop') {
      // Cloth has its own height; a show from before this existed gets the house
      // default rather than a zero-height drop.
      const ch = Number(s.h);
      s.h = Number.isFinite(ch) ? Math.max(0.5, Math.min(20, ch)) : defaultClothH(out.stage, s.kind);
      // A drop and a card are always at an exact depth; a curtain only once one
      // is typed.
      if (s.kind === 'drop' || s.kind === 'card' || s.depthSet) {
        const y = Number(s.y);
        s.y = Math.max(0.2, Math.min(out.stage.depth - 0.2, Number.isFinite(y) ? y : out.stage.depth - 0.5));
        if (s.kind === 'curtain') s.depthSet = true;
      } else {
        // Released into the stack: store the depth it actually sits at, so the
        // file never holds a stale number.
        s.depthSet = false;
        s.y = layerBase(out.stage, s);
      }
      // Span and across apply to both curtains and drops.
      const sp = Number(s.span);
      s.span = Number.isFinite(sp)
        ? Math.max(0.5, Math.min(out.stage.width, sp))
        : s.kind === 'card'
          ? Math.min(CARD_SPAN, out.stage.width)
          : out.stage.width;
      const lim = Math.max(0, (out.stage.width - s.span) / 2);
      const sx = Number(s.x);
      s.x = Math.max(-lim, Math.min(lim, Number.isFinite(sx) ? sx : 0));
      if (s.kind === 'card') {
        // A card is held up or it is not. A show written before cards existed has
        // none, so an absent state means the card is off, never half on.
        const shown = Number(s.shown);
        s.shown = Number.isFinite(shown) ? Math.max(0, Math.min(1, shown)) : 0;
        s.text = typeof s.text === 'string' && s.text.trim() ? s.text.slice(0, 40) : 'Act 1';
      }
      return;
    }
    const h = Number(s.h);
    s.h = Number.isFinite(h) ? Math.max(0.1, Math.min(6, h)) : 0.8;
    s.keys = Array.isArray(s.keys) ? s.keys.sort((a, b) => a.t - b.t) : [];
    if (s.visible === undefined) s.visible = true;
    // A prop cannot stay carried by a dancer who is no longer in the show.
    if (s.carriedBy && !out.cast.some((d) => d.id === s.carriedBy)) s.carriedBy = null;
    // Where it sits around its dancer needs two real numbers to draw at all.
    if (s.carriedBy) {
      const o = s.carryOffset;
      const ok = o && Number.isFinite(Number(o.x)) && Number.isFinite(Number(o.y));
      s.carryOffset = ok ? { x: Number(o.x), y: Number(o.y) } : { x: 0.55, y: -0.55 };
    }
    // Hand-offs name dancers too, so an importing show cannot point at a ghost.
    const handoffs = Array.isArray(s.carryHandoffs) ? s.carryHandoffs : [];
    s.carryHandoffs = handoffs
      .filter((h) => h && out.cast.some((d) => d.id === h.to))
      .map((h) => ({
        id: h.id || uid('h'),
        at: Math.max(0, Math.round(Number(h.at) || 0)),
        to: h.to,
      }))
      .sort((a, b) => a.at - b.at);
  });
  // Lighting is its own department. A show written before lights existed gets
  // none, which draws exactly as it did — a stage with no lanterns in it.
  out.lights = (Array.isArray(show && show.lights) ? show.lights : [])
    .filter((l) => l && typeof l === 'object')
    .map((l, i) => {
      const level = Number(l.level);
      const h = Number(l.h);
      const spread = Number(l.spread);
      const x = Number(l.x);
      const z = Number(l.z);
      return {
        id: l.id || uid('lt'),
        name: String(l.name == null ? '' : l.name).trim() || 'Light ' + (i + 1),
        color: /^#[0-9a-f]{6}$/i.test(String(l.color)) ? String(l.color) : LIGHT_COLORS[i % LIGHT_COLORS.length],
        // A lantern's standing level is where it sits before its first cue.
        level: Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : LIGHT_LEVEL,
        // How high the bottle hangs above the deck, which is what the elevation
        // draws the beam from.
        h: Number.isFinite(h) ? Math.max(0.5, Math.min(20, h)) : Math.max(2.5, out.stage.openingH - 1.5),
        spread: Number.isFinite(spread) ? Math.max(0.4, Math.min(out.stage.width, spread)) : LIGHT_SPREAD,
        x: Number.isFinite(x) ? Math.max(-out.stage.width / 2, Math.min(out.stage.width / 2, x)) : 0,
        z: Number.isFinite(z) ? Math.max(0, Math.min(out.stage.depth, z)) : out.stage.depth * 0.45,
        // What kind of lantern it is, and what is in front of its lens. A show from
        // before types gets a spot, which is what a lantern hung over a spot meant.
        type: LIGHT_TYPES.some(([v]) => v === l.type) ? l.type : 'spot',
        gobo: LIGHT_GOBOS.some(([v]) => v === l.gobo) ? l.gobo : 'none',
        // A follow spot cannot follow someone who has left the show.
        followId: l.followId && out.cast.some((d) => d.id === l.followId) ? l.followId : null,
        visible: l.visible !== false,
        // A cue is a level, a hand-off, or both: a cue that does neither would sit on
        // the row doing nothing, so it is not kept.
        cues: (Array.isArray(l.cues) ? l.cues : [])
          .filter((c) => c && Number.isFinite(Number(c.at)))
          .map((c) => {
            const cue = {
              id: c.id || uid('lc'),
              at: Math.max(0, Math.round(Number(c.at))),
              dur: Math.max(0, Math.round(Number(c.dur) || 0)),
            };
            if (Number.isFinite(Number(c.level))) cue.level = Math.max(0, Math.min(1, Number(c.level)));
            // A hand-off to somebody who has left the show becomes a release: the beam
            // goes back to the lantern's own place rather than following a ghost.
            if ('followId' in c) {
              cue.followId = c.followId && out.cast.some((d) => d.id === c.followId) ? c.followId : null;
            }
            return cue;
          })
          .filter((c) => c.level !== undefined || c.followId !== undefined)
          .sort((a, b) => a.at - b.at),
      };
    });
  // A show from before the running order gets one act long enough to hold
  // everything it already has, so nothing moves on the clock.
  const given = Array.isArray(show && show.acts) ? show.acts : [];
  out.acts = given
    .filter((a) => a && typeof a === 'object')
    .map((a, i) => ({
      id: a.id || uid('act'),
      name: String(a.name == null ? '' : a.name).trim() || 'Act ' + (i + 1),
      length: clampActLength(a.length),
      // Scenes and casting are tidied below, but they have to survive this rebuild first.
      scenes: Array.isArray(a.scenes) ? a.scenes : [],
      roles: a.roles && typeof a.roles === 'object' ? { ...a.roles } : {},
    }));
  if (!out.acts.length) {
    // Round the show up to the next ten seconds rather than giving it a flat
    // default: an old show should end where it ended, not a minute and a half later.
    const used = Math.max(ACT_MIN_MS, Math.ceil(lastContent(out) / 10000) * 10000);
    out.acts = [{ id: uid('act'), name: 'Act 1', length: clampActLength(used) }];
  }
  out.acts.forEach((act, i) => {
    const list = Array.isArray(act.scenes) ? act.scenes : [];
    act.scenes = list
      .filter((s) => s && typeof s === 'object')
      .map((s, j) => ({
        id: s.id || uid('sc'),
        name: String(s.name == null ? '' : s.name).trim() || 'Scene ' + (j + 1),
        offset: Math.round(Number(s.offset) || 0),
      }));
    clampSceneOffsets(act);
    // Scenes sharing a moment would leave one of them empty.
    act.scenes = act.scenes.filter((s, j) => j === 0 || s.offset - act.scenes[j - 1].offset >= 500);
    // Only the company in this show can be cast, and only with a name worth printing.
    const held = rolesOf(act);
    act.roles = {};
    for (const d of out.cast) if (held[d.id]) act.roles[d.id] = held[d.id];
  });
  return out;
}

/* Visibility. The eye is the gate: a performer with the eye shut is not drawn
   at all, body or path. "Only focused" narrows that further to the one being
   edited. Focus never points at a hidden performer, so selecting one opens
   their eye again. */
export function objectShown(obj) {
  if (!obj || obj.visible === false) return false;
  if (state.ui.onlyFocused && state.ui.selectedId) return obj.id === state.ui.selectedId;
  return true;
}

// Dancers and props are both timed objects; either can be focused by id.
export function findObject(show, id) {
  if (!show || !id) return null;
  return show.cast.find((d) => d.id === id) ||
    show.scenery.find((s) => s.kind === 'prop' && s.id === id) ||
    null;
}

export function isProp(obj) {
  return !!obj && obj.kind === 'prop';
}

// Where a carried prop sits relative to its dancer until it is dragged.
export const CARRY_OFFSET = { x: 0.55, y: -0.55 };

// Cloth never disappears entirely when a curtain opens: the legs gather into a
// stack this wide at the outer edges of the curtain's span.
export const CURTAIN_STACK = 0.55;

// How much of the opening a piece of cloth masks. A show from before spans existed
// gets the full opening, which is how it used to be drawn.
export function clothSpan(item) {
  const st = state.show && state.show.stage;
  const width = Number.isFinite(st && st.width) ? st.width : 12;
  const sp = Number(item && item.span);
  return Math.max(0.5, Math.min(width, Number.isFinite(sp) ? sp : width));
}

// Cloth stays inside the opening: it may sit anywhere its own width allows, so a
// full-width drop cannot move until it is narrowed.
export function clampClothX(x, span) {
  const st = state.show && state.show.stage;
  const width = Number.isFinite(st && st.width) ? st.width : 12;
  const v = Number(x);
  const lim = Math.max(0, (width - Math.min(width, span)) / 2);
  return Math.max(-lim, Math.min(lim, Number.isFinite(v) ? v : 0));
}

export function clothX(item) {
  return clampClothX(item && item.x, clothSpan(item));
}

// Where cloth sits upstage. A drop has always had an exact depth; a curtain follows
// its layer and stacking order until a depth is given to it, after which it stays
// put. Choosing a layer again releases it back into the stack.
export function layerBase(stage, item) {
  if (item && item.layer === 'center') return stage.depth * 0.5;
  if (item && item.layer === 'back') return Math.max(0.6, stage.depth - 0.75);
  return 0.55;
}

// The drop stack, front (nearest the audience) first. Everything about changing
// a drop — what it masks, what a fly-out reveals — is read off this order.
// How deep a piece looks from above: cloth is a fold of fabric, a card is a board.
// One rule, so the plan, the drag outline and the paper agree.
export function clothThick(item) {
  if (!item) return 0.5;
  if (item.kind === 'drop') return 0.35;
  if (item.kind === 'card') return 0.18;
  return 0.5;
}

export function dropStack(show) {
  return (show.scenery || [])
    .filter((s) => s.kind === 'drop')
    .slice()
    .sort((a, b) => clothDepth(a) - clothDepth(b));
}

export function clothDepth(item) {
  const st = state.show && state.show.stage;
  const depth = Number.isFinite(st && st.depth) ? st.depth : 8;
  const exact = item && (item.kind === 'drop' || item.depthSet);
  const y = Number(item && item.y);
  const raw = exact && Number.isFinite(y)
    ? y
    : layerBase({ depth }, item) + (Number(item && item.order) || 0) * 0.5;
  return Math.max(0.2, Math.min(depth - 0.2, raw));
}

// Each leg's width for a given opening amount: full half-span when shut, the
// stack when wide open.
export function curtainLegW(span, open) {
  const half = Math.max(0.3, span / 2);
  const stack = Math.min(CURTAIN_STACK, half);
  const o = Math.max(0, Math.min(1, Number(open) || 0));
  return Math.max(0.3, stack + (half - stack) * (1 - o));
}

// A prop on the timer has its own stations, or is carried by a dancer.
export function propOnTimer(prop) {
  return !!prop && ((prop.keys && prop.keys.length > 0) || !!prop.carriedBy);
}

// Who holds the prop at this moment: its first carrier until the first hand-off,
// then whoever the latest hand-off named.
export function carrierIdOf(prop, ct) {
  if (!prop || !prop.carriedBy) return null;
  let id = prop.carriedBy;
  for (const h of prop.carryHandoffs || []) {
    if (h.at <= ct) id = h.to;
    else break;
  }
  return id;
}

export function carrierOf(show, prop, ct) {
  const id = carrierIdOf(prop, ct);
  return id ? show.cast.find((d) => d.id === id) || null : null;
}

// A hand-off is a moment, not a span: the prop moves to the new dancer's side as
// their own clock reaches it, so it inherits their holds from then on.
export function addCarryHandoff(prop, at, to) {
  if (!prop || !to) return null;
  prop.carryHandoffs = Array.isArray(prop.carryHandoffs) ? prop.carryHandoffs : [];
  const when = Math.max(0, Math.round(at));
  const same = prop.carryHandoffs.find((h) => h.to === to && Math.abs(h.at - when) < 60);
  if (same) return same;
  const h = { id: uid('h'), at: when, to };
  prop.carryHandoffs.push(h);
  prop.carryHandoffs.sort((a, b) => a.at - b.at);
  return h;
}

export function removeCarryHandoff(prop, id) {
  if (!prop || !Array.isArray(prop.carryHandoffs)) return;
  prop.carryHandoffs = prop.carryHandoffs.filter((h) => h.id !== id);
}

// A prop with stations moves with the show; without them it is dressing. A
// carried prop borrows its dancer's clock, so a hold on that dancer freezes the
// prop with them instead of letting it drift on.
export function propPosOfContent(show, prop, ct) {
  if (!prop) return null;
  if (prop.carriedBy) {
    const carrier = carrierOf(show, prop, ct);
    const at = carrier ? posAtLocal(carrier, localOfContent(show, carrier.id, ct)) : null;
    if (at) {
      const off = prop.carryOffset || CARRY_OFFSET;
      return { x: at.x + off.x, y: at.y + off.y };
    }
  }
  if (!prop.keys || !prop.keys.length) return { x: prop.x, y: prop.y };
  return posAtLocal(prop, localOfContent(show, prop.id, ct));
}

/* ------------------------------------------------------------ scenery cues */

// A cue changes one piece of scenery at a moment, over a duration. A curtain
// uses `open` (0 shut, 1 out of the way) and a drop uses `fly` (0 flown out of
// sight, 1 hanging at the wall). Before the first cue the state is whatever the
// panel holds as that item's base value.
export function sceneryStateAt(item, ct) {
  const st = {
    open: Number.isFinite(item.open) ? item.open : 1,
    fly: Number.isFinite(item.fly) ? item.fly : 1,
    shown: Number.isFinite(item.shown) ? item.shown : 0,
  };
  for (const c of item.cues || []) {
    if (c.at > ct) break;
    const dur = Number.isFinite(c.dur) ? Math.max(0, c.dur) : 0;
    const u = dur > 0 ? Math.max(0, Math.min(1, (ct - c.at) / dur)) : 1;
    if (Number.isFinite(c.open)) st.open += (c.open - st.open) * u;
    if (Number.isFinite(c.fly)) st.fly += (c.fly - st.fly) * u;
    if (Number.isFinite(c.shown)) st.shown += (c.shown - st.shown) * u;
    // Halfway through a move the next cue has not happened yet.
    if (u < 1) break;
  }
  return st;
}

export function addSceneryCue(item, at, to, dur) {
  if (!item) return null;
  item.cues = Array.isArray(item.cues) ? item.cues : [];
  const cue = {
    id: uid('c'),
    at: Math.max(0, Math.round(at || 0)),
    dur: Math.max(0, Math.round(dur || 0)),
  };
  if (Number.isFinite(Number(to && to.open))) cue.open = Math.max(0, Math.min(1, Number(to.open)));
  if (Number.isFinite(Number(to && to.fly))) cue.fly = Math.max(0, Math.min(1, Number(to.fly)));
  if (Number.isFinite(Number(to && to.shown))) cue.shown = Math.max(0, Math.min(1, Number(to.shown)));
  if (cue.open === undefined && cue.fly === undefined && cue.shown === undefined) return null;
  item.cues.push(cue);
  item.cues.sort((a, b) => a.at - b.at);
  return cue;
}

/* --------------------------------------------------------------- lighting */

// How bright a lantern is at a moment: its standing level before the first cue,
// then each cue carries it to a new level over its own duration. A cue that has
// not finished is still on its way, the same rule a curtain follows — halfway
// through a fade the next cue has not happened yet.
export function lightLevelAt(light, ct) {
  if (!light) return 0;
  let level = Number.isFinite(light.level) ? Math.max(0, Math.min(1, light.level)) : 1;
  for (const c of light.cues || []) {
    if (c.at > ct) break;
    const dur = Number.isFinite(c.dur) ? Math.max(0, c.dur) : 0;
    const u = dur > 0 ? Math.max(0, Math.min(1, (ct - c.at) / dur)) : 1;
    if (Number.isFinite(c.level)) level += (c.level - level) * u;
    if (u < 1) break;
  }
  return Math.max(0, Math.min(1, level));
}

// Where the beam would be if it were aimed at one performer (or at the lantern's own
// place, when there is nobody to follow).
function spotOf(show, light, followId, ct) {
  if (followId) {
    const d = (show.cast || []).find((x) => x.id === followId);
    if (d) {
      const p = posOfContent(show, d, ct);
      if (p) return { x: p.x, z: p.y, follow: d };
    }
  }
  return { x: light.x, z: light.z, follow: null };
}

// Where a lantern actually points at a moment. Its own spot, unless it is a follow
// spot: then the operator has a hand on the handle and the light is wherever that
// performer is — which is the whole difference between a special and a follow.
//
// A cue can hand the spot to somebody else. That is a pan, not a cut: the beam leaves
// one performer and arrives at the other over the cue's own duration, so the two are
// on their way between the pair for the middle of it and following neither.
export function lightSpot(show, light, ct) {
  let followId = light.followId || null;
  let pos = spotOf(show, light, followId, ct);
  for (const c of light.cues || []) {
    if (c.at > ct) break;
    // A cue that only changes the level leaves the aim alone.
    if (!('followId' in c)) continue;
    const next = c.followId || null;
    const target = spotOf(show, light, next, ct);
    if (next === followId) {
      pos = target;
      continue;
    }
    const dur = Number.isFinite(c.dur) ? Math.max(0, c.dur) : 0;
    if (dur > 0 && ct < c.at + dur) {
      const u = Math.max(0, Math.min(1, (ct - c.at) / dur));
      return {
        x: pos.x + (target.x - pos.x) * u,
        z: pos.z + (target.z - pos.z) * u,
        follow: null,
        panning: true,
        from: pos.follow,
        to: target.follow,
      };
    }
    pos = target;
    followId = next;
  }
  return pos;
}

// Who the spot is on at a moment, once its cues have been walked: the name to print on
// a row, and the target a cue is changing from.
export function lightFollowAt(show, light, ct) {
  let followId = light.followId || null;
  for (const c of light.cues || []) {
    if (c.at > ct) break;
    if ('followId' in c) followId = c.followId || null;
  }
  const d = followId ? (show.cast || []).find((x) => x.id === followId) : null;
  return d || null;
}

// A new lantern hangs over the middle of the stage at a height that clears a
// dancer, washing a pool wide enough for a small group. Everything about that is
// a number in its row afterwards.
// New lanterns are spread across the stage rather than stacked in the middle: the
// second one is a different pool from the first, which is the point of having two.
const LIGHT_SPOTS = [0, -0.26, 0.26, -0.4, 0.4];

export function addLight(show, over) {
  const st = show.stage;
  const n = (show.lights || []).length;
  const light = Object.assign(
    {
      id: uid('lt'),
      name: 'Light ' + (n + 1),
      color: LIGHT_COLORS[n % LIGHT_COLORS.length],
      level: LIGHT_LEVEL,
      h: Math.max(2.5, Math.min(20, st.openingH - 1.5)),
      // New lanterns are spots: a special is the thing a choreographer reaches for
      // first, and a flood is one picker away.
      type: 'spot',
      gobo: 'none',
      spread: Math.max(1, Math.min(st.width, LIGHT_SPREAD_BY_TYPE.spot)),
      x: Math.round(st.width * LIGHT_SPOTS[n % LIGHT_SPOTS.length] * 100) / 100,
      z: Math.round(st.depth * 0.45 * 100) / 100,
      // Nothing is followed until the panel says so.
      followId: null,
      visible: true,
      cues: [],
    },
    over || {}
  );
  show.lights = Array.isArray(show.lights) ? show.lights : [];
  show.lights.push(light);
  return light;
}

export function removeLight(show, id) {
  show.lights = (show.lights || []).filter((l) => l.id !== id);
}

// A light cue changes the level, the performer a follow spot is on, or both — never the
// colour: a colour change is a different lantern, and inventing one here would mean the
// crew swaps gel mid-scene. `level` undefined leaves the brightness alone; `followId`
// undefined leaves the aim alone, and null is a deliberate release back to the lantern's
// own place, which is a different thing from not mentioning it.
export function addLightCue(light, at, level, dur, followId) {
  if (!light) return null;
  light.cues = Array.isArray(light.cues) ? light.cues : [];
  const cue = {
    id: uid('lc'),
    at: Math.max(0, Math.round(at || 0)),
    dur: Math.max(0, Math.round(dur || 0)),
  };
  if (Number.isFinite(Number(level))) cue.level = Math.max(0, Math.min(1, Number(level)));
  if (followId !== undefined) cue.followId = followId || null;
  if (cue.level === undefined && cue.followId === undefined) return null;
  light.cues.push(cue);
  light.cues.sort((a, b) => a.at - b.at);
  return cue;
}

export function updateLightCue(light, id, patch) {
  const cue = ((light && light.cues) || []).find((c) => c.id === id);
  if (!cue || !patch) return null;
  if ('at' in patch) {
    const at = Number(patch.at);
    if (Number.isFinite(at)) cue.at = Math.max(0, Math.round(at));
  }
  if ('dur' in patch) {
    const dur = Number(patch.dur);
    if (Number.isFinite(dur)) cue.dur = Math.max(0, Math.round(dur));
  }
  if ('level' in patch) {
    // 'keep' removes the level from the cue, so a cue can be a pure hand-off.
    if (patch.level === 'keep') delete cue.level;
    else if (Number.isFinite(Number(patch.level))) cue.level = Math.max(0, Math.min(1, Number(patch.level)));
  }
  // `followId` in a patch is a hand-off (a string), a release (null), or an instruction
  // to stop moving the aim at all ('keep', which deletes the field).
  if ('followId' in patch) {
    if (patch.followId === 'keep') delete cue.followId;
    else cue.followId = patch.followId || null;
  }
  light.cues.sort((a, b) => a.at - b.at);
  return cue;
}

export function removeLightCue(light, id) {
  if (!light || !Array.isArray(light.cues)) return;
  light.cues = light.cues.filter((c) => c.id !== id);
}

/* ------------------------------------------------------------ music fades */

// The end of the show brings the music down with it rather than cutting it dead:
// the last stretch before the end ramps the level to nothing, so the clock stops on
// silence. It is a property of the ending, not a cue, because it belongs to wherever
// the end is put — move the curtain call and the fade moves with it.
export function endFadeLevel(show, ct) {
  const marked = endMarker(show);
  const fade = Number(show.prefs && show.prefs.endFade);
  if (!marked || !(fade > 0)) return 1;
  const left = marked.t - ct;
  if (left <= 0) return 0;
  if (left >= fade) return 1;
  return left / fade;
}

// What is actually heard from a track: its own fades, brought down by the show's end.
export function audibleLevel(show, m, ct) {
  return musicLevelAt(m, ct) * endFadeLevel(show, ct);
}

// The track's own level at a moment: 1 is full, 0 is silent. A fade is a cue in
// the same sense a curtain's is — it moves the level from wherever it is to a
// new one over a duration — so a change of scene can take the music down under
// the cloth and bring it back afterwards.
export function musicLevelAt(m, ct) {
  if (!m) return 0;
  let level = Number.isFinite(m.level) ? Math.max(0, Math.min(1, m.level)) : 1;
  for (const c of m.cues || []) {
    if (c.at > ct) break;
    const dur = Number.isFinite(c.dur) ? Math.max(0, c.dur) : 0;
    const u = dur > 0 ? Math.max(0, Math.min(1, (ct - c.at) / dur)) : 1;
    if (Number.isFinite(c.level)) level += (c.level - level) * u;
    // Halfway through a fade the next one has not begun.
    if (u < 1) break;
  }
  return Math.max(0, Math.min(1, level));
}

// Which track is sounding at a moment: the last one to have entered that has not
// finished. A track of unknown length (an imported show) keeps playing until the
// next one starts.
// How much of a track actually plays, which is not the same as how long the file
// is: a track can be trimmed to stop before the next one starts. `length` stays the
// file's own duration — it is what "replace" and the panel report — and `play` is
// the trimmed span from the entry point. No `play` means the whole file.
export function musicSpan(t) {
  if (!t) return 0;
  const file = Number.isFinite(Number(t.length)) ? Math.max(0, Number(t.length)) : 0;
  const play = Number.isFinite(Number(t.play)) ? Math.max(0, Number(t.play)) : null;
  if (play == null) return file;
  return file > 0 ? Math.min(play, file) : play;
}

export function activeMusicAt(show, ct) {
  let found = null;
  for (const t of (show && show.musicTracks) || []) {
    if (t.start > ct) break;
    found = t;
  }
  if (!found) return null;
  const span = musicSpan(found);
  if (span > 0 && ct > found.start + span) return null;
  return found;
}

export function nextMusicAfter(show, ct) {
  for (const t of (show && show.musicTracks) || []) {
    if (t.start > ct) return t;
  }
  return null;
}

// A new track starts where it is told to; with no start given it falls back to the
// end of the last one, which is what an imported show or an older call means by
// "the next piece of music". The app passes the playhead, because that is where a
// change of music belongs.
export function addMusicTrack(show, data) {
  const list = show.musicTracks || (show.musicTracks = []);
  const last = list[list.length - 1];
  const start = Number.isFinite(Number(data && data.start))
    ? Math.max(0, Math.round(Number(data.start)))
    : last
      ? last.start + (last.length || 0)
      : 0;
  const track = {
    id: uid('trk'),
    key: String((data && data.key) || uid('audio')),
    name: String((data && data.name) || 'Music'),
    start,
    length: Math.max(0, Math.round(Number(data && data.length) || 0)),
    play: Math.max(0, Math.round(Number(data && data.length) || 0)),
    level: 1,
    visible: true,
    cues: [],
  };
  list.push(track);
  list.sort((a, b) => a.start - b.start);
  return track;
}

export function removeMusicTrack(show, id) {
  if (!show || !Array.isArray(show.musicTracks)) return;
  show.musicTracks = show.musicTracks.filter((t) => t.id !== id);
}

// Moving a track's entry point re-sorts the list, because "which track is
// playing" is read off that order.
export function setMusicStart(show, id, start) {
  const t = ((show && show.musicTracks) || []).find((x) => x.id === id);
  if (!t) return null;
  const v = Number(start);
  if (Number.isFinite(v)) t.start = Math.max(0, Math.round(v));
  show.musicTracks.sort((a, b) => a.start - b.start);
  return t;
}

export function addMusicCue(m, at, level, dur) {
  if (!m) return null;
  const v = Number(level);
  if (!Number.isFinite(v)) return null;
  m.cues = Array.isArray(m.cues) ? m.cues : [];
  const cue = {
    id: uid('f'),
    at: Math.max(0, Math.round(at || 0)),
    dur: Math.max(0, Math.round(dur || 0)),
    level: Math.max(0, Math.min(1, v)),
  };
  m.cues.push(cue);
  m.cues.sort((a, b) => a.at - b.at);
  return cue;
}

export function removeMusicCue(m, id) {
  if (!m || !Array.isArray(m.cues)) return;
  m.cues = m.cues.filter((c) => c.id !== id);
}

/* -------------------------------------------------------------- video */

// A video occupies only its selected source range on the show's clock.
export function videoSpan(clip) {
  if (!clip) return 0;
  const length = Number(clip.length);
  const trimIn = Number(clip.trimIn);
  const trimOut = Number(clip.trimOut);
  if (!Number.isFinite(length) || length < 0) return 0;
  const start = Number.isFinite(trimIn) ? Math.max(0, Math.min(length, trimIn)) : 0;
  const end = Number.isFinite(trimOut) ? Math.max(start, Math.min(length, trimOut)) : length;
  return Math.max(0, end - start);
}


export function addImage(show, media) {
  if (!show || !media || !media.key) return null;
  const image = { id: uid('img'), key: String(media.key), name: String(media.name || 'Image'), width: Math.max(0, Number.isFinite(Number(media.width)) ? Number(media.width) : 0), height: Math.max(0, Number.isFinite(Number(media.height)) ? Number(media.height) : 0) };
  (Array.isArray(show.images) ? show.images : (show.images = [])).push(image);
  return image;
}
function boundedFade(value, fallback = 1000) {
  const number = Number(value);
  return Math.max(0, Math.min(120000, Math.round(Number.isFinite(number) ? number : fallback)));
}
export function addSlideCue(show, at, imageId, fade = 1000) {
  if (!show) return null;
  const number = Number(at);
  const cue = { id: uid('slide'), at: Math.max(0, Math.round(Number.isFinite(number) ? number : 0)), imageId: imageId == null ? null : String(imageId), fade: boundedFade(fade) };
  if (!Array.isArray(show.slideCues)) show.slideCues = [];
  show.slideCues.push(cue);
  show.slideCues.sort((a, b) => a.at - b.at);
  return cue;
}
export function removeSlideCue(show, id) {
  if (show && Array.isArray(show.slideCues)) show.slideCues = show.slideCues.filter((cue) => cue.id !== id);
}
function projectionEvents(show) {
  const events = [];
  (show && show.videos || []).forEach((clip, index) => {
    const at = Number(clip && clip.at), span = videoSpan(clip);
    if (clip && typeof clip.key === 'string' && clip.key && Number.isFinite(at) && span > 0) events.push({ kind: 'video', clip, at, index, priority: 0 });
  });
  (show && show.slideCues || []).forEach((cue, index) => {
    const at = Number(cue && cue.at);
    if (cue && typeof cue === 'object' && Number.isFinite(at)) events.push({ kind: 'slide', cue, at, index, priority: 1 });
  });
  return events.sort((a, b) => a.at - b.at || a.priority - b.priority || a.index - b.index);
}
export function projectionAt(show, ct) {
  const time = Number(ct);
  if (!Number.isFinite(time)) return { kind: 'off', at: -Infinity };
  let latest = null;
  for (const event of projectionEvents(show)) { if (event.at > time) break; latest = event; }
  if (!latest) return { kind: 'off', at: -Infinity };
  if (latest.kind === 'slide') return latest.cue.imageId == null
    ? { kind: 'off', at: latest.at, cue: latest.cue }
    : { kind: 'slide', cue: latest.cue, at: latest.at, imageId: latest.cue.imageId };
  return time < latest.at + videoSpan(latest.clip) ? { kind: 'video', clip: latest.clip, at: latest.at } : { kind: 'off', at: latest.at };
}
function mixSlideLayers(from, to, fraction) {
  const weights = new Map();
  for (const layer of from) weights.set(layer.imageId, (weights.get(layer.imageId) || 0) + layer.alpha * (1 - fraction));
  for (const layer of to) weights.set(layer.imageId, (weights.get(layer.imageId) || 0) + layer.alpha * fraction);
  return [...weights].filter(([, alpha]) => alpha > 1e-12).map(([imageId, alpha]) => ({ imageId, alpha }));
}
export function slideLayersAt(show, ct) {
  const time = Number(ct);
  if (!Number.isFinite(time)) return [];
  let layers = [], transition = null;
  const valueAt = (sample) => transition ? mixSlideLayers(transition.from, transition.to, Math.max(0, Math.min(1, (sample - transition.at) / transition.duration))) : layers;
  for (const event of projectionEvents(show)) {
    if (event.at > time) break;
    if (event.kind === 'video') { layers = []; transition = null; continue; }
    const from = valueAt(event.at), to = event.cue.imageId == null ? [] : [{ imageId: event.cue.imageId, alpha: 1 }];
    const duration = boundedFade(event.cue.fade);
    if (!duration) { layers = to; transition = null; }
    else { layers = from; transition = { from, to, at: event.at, duration }; }
  }
  return valueAt(time).sort((a, b) => String(a.imageId).localeCompare(String(b.imageId)));
}

// Video is a single visual layer: where clips overlap, the most recently started
// active clip wins. Equal starts resolve to the later clip in the stored list.
export function videoAt(show, ct) {
  const time = Number(ct);
  if (!Number.isFinite(time)) return null;
  let found = null;
  for (const clip of (show && show.videos) || []) {
    const at = Number(clip && clip.at);
    const span = videoSpan(clip);
    if (!clip || typeof clip.key !== 'string' || !clip.key || !Number.isFinite(at) || time < at || span <= 0 || time >= at + span) continue;
    if (!found || at >= Number(found.at)) found = clip;
  }
  return found;
}

export function addVideo(show, media, at = 0) {
  if (!show || !media || !media.key) return null;
  const list = show.videos || (show.videos = []);
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const length = Math.max(0, Math.round(finite(media.length, 0)));
  const start = Math.max(0, Math.round(finite(at, 0)));
  const clip = {
    id: uid('vid'), key: String(media.key), name: String(media.name || 'Video'),
    at: start, length, trimIn: 0, trimOut: length, muted: false, level: 1,
  };
  show.videos = list;
  list.push(clip);
  list.sort((a, b) => a.at - b.at);
  return clip;
}

export function removeVideo(show, id) {
  if (!show || !Array.isArray(show.videos)) return;
  show.videos = show.videos.filter((clip) => clip.id !== id);
}

/* -------------------------------------------------------------- narration */

// Narration is a list of clips, each entered at a moment. Unlike the music, two
// of them may sound at once: a show can put a recording under a live line. So
// nothing here picks "the" clip — the engine starts every clip that covers the
// playhead and each one ends at its own length.
export function narrationSpan(clip) {
  if (!clip) return 0;
  const len = Number(clip.length);
  return Number.isFinite(len) ? Math.max(0, len) : 0;
}

// Every clip sounding at a moment, which is what the panel says and what the
// engine plays.
export function narrationAt(show, ct) {
  return ((show && show.narration) || []).filter(
    (c) => ct >= c.at && ct < c.at + narrationSpan(c)
  );
}

// A new clip goes where it is told to. With no moment given it follows the last
// one, which is what "another piece of narration" means by default.
export function addNarration(show, data) {
  if (!show) return null;
  const list = show.narration || (show.narration = []);
  const last = list[list.length - 1];
  const at = Number.isFinite(Number(data && data.at))
    ? Math.max(0, Math.round(Number(data.at)))
    : last
      ? last.at + narrationSpan(last)
      : 0;
  const clip = {
    id: uid('vo'),
    key: String((data && data.key) || uid('audio')),
    name: String((data && data.name) || 'Narration') || 'Narration',
    at,
    length: Math.max(0, Math.round(Number(data && data.length) || 0)),
  };
  list.push(clip);
  list.sort((a, b) => a.at - b.at);
  return clip;
}

// Moving a clip re-sorts the list, so the row draws and reads in running order.
export function setNarrationAt(show, id, at) {
  const clip = ((show && show.narration) || []).find((c) => c.id === id);
  if (!clip) return null;
  const v = Number(at);
  if (Number.isFinite(v)) clip.at = Math.max(0, Math.round(v));
  show.narration.sort((a, b) => a.at - b.at);
  return clip;
}

export function renameNarration(show, id, name) {
  const clip = ((show && show.narration) || []).find((c) => c.id === id);
  if (!clip) return null;
  const text = String(name == null ? '' : name).trim();
  clip.name = text || 'Narration';
  return clip;
}

export function removeNarration(show, id) {
  if (!show || !Array.isArray(show.narration)) return;
  show.narration = show.narration.filter((c) => c.id !== id);
}

// The name a new take is given, so three recordings are told apart in a list.
export function nextNarrationName(show) {
  const used = new Set(((show && show.narration) || []).map((c) => c.name));
  for (let i = 1; i < 999; i++) {
    const name = 'Narration ' + i;
    if (!used.has(name)) return name;
  }
  return 'Narration';
}

// Retiming a fade works the same way a scenery cue's does, and for the same
// reason: `musicLevelAt` reads the list in order, so a moved fade has to move in
// the array too.
export function updateMusicCue(m, id, patch) {
  const cue = ((m && m.cues) || []).find((c) => c.id === id);
  if (!cue || !patch) return null;
  if ('at' in patch) {
    const at = Number(patch.at);
    if (Number.isFinite(at)) cue.at = Math.max(0, Math.round(at));
  }
  if ('dur' in patch) {
    const dur = Number(patch.dur);
    if (Number.isFinite(dur)) cue.dur = Math.max(0, Math.round(dur));
  }
  if ('level' in patch) {
    const v = Number(patch.level);
    if (Number.isFinite(v)) cue.level = Math.max(0, Math.min(1, v));
  }
  m.cues.sort((a, b) => a.at - b.at);
  return cue;
}

export function removeSceneryCue(item, id) {
  if (!item || !Array.isArray(item.cues)) return;
  item.cues = item.cues.filter((c) => c.id !== id);
}

// A placed cue can be retargeted or retimed. The band is the cue, so dragging its
// ends and editing its action both come through here, and the list stays sorted
// because sceneryStateAt reads it in order.
export function updateCue(item, id, patch) {
  const cue = ((item && item.cues) || []).find((c) => c.id === id);
  if (!cue || !patch) return null;
  if ('at' in patch) {
    const at = Number(patch.at);
    if (Number.isFinite(at)) cue.at = Math.max(0, Math.round(at));
  }
  if ('dur' in patch) {
    const dur = Number(patch.dur);
    if (Number.isFinite(dur)) cue.dur = Math.max(0, Math.round(dur));
  }
  // A cue moves a piece one way or the other, never both at once: a curtain
  // opens, a drop flies.
  if ('open' in patch && Number.isFinite(Number(patch.open))) {
    cue.open = Math.max(0, Math.min(1, Number(patch.open)));
    delete cue.fly;
  } else if ('fly' in patch && Number.isFinite(Number(patch.fly))) {
    cue.fly = Math.max(0, Math.min(1, Number(patch.fly)));
    delete cue.open;
  }
  item.cues.sort((a, b) => a.at - b.at);
  return cue;
}

/* A plain click shows only that performer; ctrl/cmd-click adds or removes one
   without disturbing the others. */
export function toggleVisibility(dancer, additive) {
  const show = state.show;
  if (!show || !dancer) return;
  const othersOn = show.cast.some((x) => x !== dancer && x.visible);
  if (additive) {
    dancer.visible = !dancer.visible;
  } else if (dancer.visible && !othersOn) {
    dancer.visible = false;
  } else {
    show.cast.forEach((x) => { x.visible = x === dancer; });
  }
  // Showing one performer on its own also focuses them, so the eye and the
  // editing panel agree about who you are working on.
  if (!additive && dancer.visible) state.ui.selectedId = dancer.id;
  // Focus never rests on a hidden performer.
  const focused = show.cast.find((x) => x.id === state.ui.selectedId);
  if (focused && !focused.visible) {
    state.ui.selectedId = null;
    state.ui.stationIdx = null;
  }
}

export function addCast(show, over) {
  const number = show.nextNumber++;
  const i = number - 1;
  const d = {
    id: 'd' + number,
    number,
    name: 'Dancer ' + number,
    color: PALETTE[i % PALETTE.length],
    shape: SHAPES[Math.floor(i / PALETTE.length) % SHAPES.length],
    fill: FILLS[Math.floor(i / (PALETTE.length * SHAPES.length)) % FILLS.length],
    visible: true,
    // New dancers come out of the wings undressed, which is how the cast list has
    // always looked: the wardrobe is something you put them in.
    costumeId: null,
    keys: [],
  };
  // Start in the wings, queued in a stagger so they do not sit on top of each other.
  const side = number % 2 === 0 ? 1 : -1;
  const slot = Math.floor(i / 2) % 5;
  d.keys.push({
    t: 0,
    x: side * (show.stage.width / 2 + 1.0 + (slot % 2) * 0.9),
    y: 1.2 + slot * 1.25,
  });
  Object.assign(d, over || {});
  d.keys.sort((a, b) => a.t - b.t);
  show.cast.push(d);
  return d;
}

/* ------------------------------------------------------------- the wardrobe */

// A costume is a named set of colours and a cut. Everything that draws a performer
// reads it through `costumeOf`, so the plan, the elevation and the printed elevation
// cannot disagree about what somebody is wearing.
export function costumeOf(show, dancer) {
  if (!dancer || !dancer.costumeId) return null;
  return (show.costumes || []).find((c) => c.id === dancer.costumeId) || null;
}

export function costumeStyleWord(style) {
  return COSTUME_STYLE_WORD[style] || COSTUME_STYLE_WORD.tutu;
}

// A new costume is a colourway rather than a blank: the point of the room is to make
// a dancer look dressed in one click and then adjust.
export function addCostume(show, over) {
  show.costumes = Array.isArray(show.costumes) ? show.costumes : [];
  const n = show.costumes.length;
  const costume = Object.assign(
    {
      id: uid('cos'),
      name: 'Costume ' + (n + 1),
      body: COSTUME_COLORS[n % COSTUME_COLORS.length],
      skirt: COSTUME_COLORS[(n + 3) % COSTUME_COLORS.length],
      hair: '#3b2b26',
      style: 'tutu',
    },
    over || {}
  );
  show.costumes.push(costume);
  return costume;
}

// Taking a costume out of the wardrobe undresses whoever was wearing it: a dancer
// cannot be dressed in something that no longer exists.
export function removeCostume(show, id) {
  show.costumes = (show.costumes || []).filter((c) => c.id !== id);
  for (const d of show.cast || []) if (d.costumeId === id) d.costumeId = null;
}

/* -------------------------------------------------------- path stations */

export function addStation(dancer, x, y, opts = {}) {
  const keys = dancer.keys;
  const last = keys.length ? keys[keys.length - 1] : null;
  const gap = Number.isFinite(opts.dur) ? opts.dur : STATION_MS;
  const key = {
    t: last ? last.t + gap : 0,
    x,
    y,
    pose: opts.pose || (last && last.pose) || 'none',
    // A new station is walked to, not turned on and reached in a straight line, which is
    // the plainest case; all of it is then set on the station itself.
    step: opts.step || 'walk',
    turn: Number(opts.turn) || 0,
    turnMs: null,
    bend: 0,
    // A new station stands flat on the deck, with no height of its own, and is walked
    // into at one even speed unless its count is shaped.
    level: 'flat',
    lift: null,
    ease: 'even',
    dur: last ? gap : 0,
  };
  keys.push(key);
  keys.sort((a, b) => a.t - b.t);
  return key;
}

// Give every key after the first a concrete transition duration, so editing
// one duration does not silently reset gaps from dragged keyframes.
export function ensureDurations(dancer) {
  for (let i = 1; i < dancer.keys.length; i++) {
    if (!Number.isFinite(dancer.keys[i].dur)) {
      dancer.keys[i].dur = Math.max(0, dancer.keys[i].t - dancer.keys[i - 1].t);
    }
  }
}

// Recompute absolute times from the edited transition onwards.
export function reflowKeys(dancer, fromIndex = 1) {
  const keys = dancer.keys;
  for (let i = Math.max(1, fromIndex); i < keys.length; i++) {
    const gap = Number.isFinite(keys[i].dur) ? keys[i].dur : STATION_MS;
    keys[i].t = keys[i - 1].t + gap;
  }
}

// Delete one station. Each following move keeps its own duration, so a path
// built from stations closes up by the leg that was removed.
export function removeStation(dancer, i) {
  const keys = dancer.keys;
  if (!Number.isInteger(i) || i < 0 || i >= keys.length) return null;
  const gone = keys.splice(i, 1)[0];
  if (!keys.length) return gone;
  ensureDurations(dancer);
  keys[0].dur = 0;
  reflowKeys(dancer, Math.max(1, i));
  return gone;
}

// Delete this station and every one after it. The remaining path ends where the
// cut was made, so the performer can carry on from there.
export function removeFromStation(dancer, i) {
  const keys = dancer.keys;
  if (!Number.isInteger(i) || i < 0 || i >= keys.length) return;
  ensureDurations(dancer);
  keys.splice(i);
  if (keys.length) keys[0].dur = 0;
}

// Keep this station and drop everything after it, so building continues here.
export function truncateAfter(dancer, i) {
  const keys = dancer.keys;
  if (!Number.isInteger(i) || i < 0 || i >= keys.length) return;
  keys.splice(i + 1);
}

// A curtain hangs just under the header; a drop is a little shorter than the
// opening it masks. These are only starting points — each item's `h` is the truth.
export function defaultClothH(stage, kind) {
  const opening = Number.isFinite(stage && stage.openingH) ? stage.openingH : 7.5;
  if (kind === 'card') return CARD_H;
  const raw = kind === 'drop' ? opening * 0.8 : opening - 1.1;
  // Not rounded: an existing show should keep the exact height it was drawn at.
  return kind === 'drop' ? Math.max(1, raw) : Math.max(2, raw);
}

export function addScenery(show, kind) {
  const count = show.scenery.filter((s) => s.kind === kind).length;
  const item = {
    id: uid('s'),
    kind,
    name:
      kind === 'prop'
        ? 'Prop ' + (count + 1)
        : kind === 'drop'
          ? 'Drop ' + (count + 1)
          : kind === 'card'
            ? 'Card ' + (count + 1)
            : 'Curtain ' + (count + 1),
    layer: kind === 'drop' ? 'back' : 'front',
    order: 0,
    open: kind === 'prop' ? 1 : 1,
    color: kind === 'prop'
      ? '#5a6b8c'
      : kind === 'drop'
        ? DROP_COLORS[count % DROP_COLORS.length]
        : kind === 'card'
          ? CARD_COLOR
          : '#7b2d3b',
    x: 0,
    y: show.stage.depth * 0.5,
    w: 2,
    d: 1.2,
    cues: [],
  };
  // Height is what the elevation needs; the plan never uses it. New cloth starts
  // at a height that suits the house, and is then the item's own number.
  item.h = kind === 'prop' ? 0.8 : defaultClothH(show.stage, kind);
  // New cloth masks the whole opening until it is given a narrower span.
  if (kind === 'curtain' || kind === 'drop') item.span = show.stage.width;
  if (kind === 'card') {
    // A card is a different thing from cloth: it is not hanging anywhere, it is
    // either held up in front of the house or it is not. `shown` is that state,
    // and the cues move it between 0 and 1 like a curtain's `open`.
    item.span = Math.min(CARD_SPAN, show.stage.width);
    item.x = 0;
    item.y = CARD_DEPTH;
    item.shown = 0;
    item.text = 'Act 1';
    item.layer = 'front';
    item.order = 0;
  }
  if (kind === 'prop') {
    item.x = 0;
    item.y = 1.5;
    item.keys = [];
    item.visible = true;
  } else if (kind === 'drop') {
    item.w = show.stage.width;
    item.d = 0.3;
    // A new drop hangs behind the stack, so the one already seen stays in front
    // and flying it out is what reveals the new one. When the stack has reached
    // the back wall it is walked toward the house by one gap to make room, rather
    // than dropping two pieces on the same pipe where neither would mask the other.
    const stack = dropStack(show);
    const depth = show.stage.depth;
    if (!stack.length) {
      item.y = Math.max(0.8, depth - 0.5);
    } else {
      const back = clothDepth(stack[stack.length - 1]);
      if (back + DROP_GAP <= depth - 0.3) {
        item.y = back + DROP_GAP;
      } else {
        const shift = Math.min(DROP_GAP, Math.max(0, back - 0.6));
        if (shift > 0.02) {
          for (const d of stack) d.y = Math.max(0.6, clothDepth(d) - shift);
        }
        item.y = Math.min(depth - 0.3, back - shift + DROP_GAP);
      }
    }
  }
  show.scenery.push(item);
  return item;
}

/* ------------------------------------------------------------------- time */

export function sortedPauses(show) {
  return show.markers.filter((m) => m.kind === 'pause').sort((a, b) => a.t - b.t);
}

export function holdsFor(show, trackId) {
  return show.markers.filter((m) => m.kind === 'hold' && m.trackId === trackId).sort((a, b) => a.t - b.t);
}

// The holds that fall between two moments on a dancer's own clock: the ones a movement laid down
// across that stretch would have to stop for. `from` is exclusive — a hold exactly where the
// movement begins is what happens before it, not inside it — and `to` is inclusive, so a hold on
// the last station still freezes her there.
export function holdsWithin(show, trackId, from, to) {
  const a = Number(from);
  const b = Number(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
  return holdsFor(show, trackId).filter((h) => h.t > a + 1 && h.t <= b + 1);
}

// Where the show stops is a decision, not a consequence of the last station: a
// curtain call, a blackout or a button on the last chord all end the performance
// earlier than the running order does. It is a marker like a pause, so it moves
// with the show's own clock and there is exactly one of it.
export function endMarker(show) {
  return (show.markers || []).find((m) => m.kind === 'end') || null;
}

export function setEnd(show, t) {
  const at = Math.max(0, Math.round(t / 100) * 100);
  const existing = endMarker(show);
  if (existing) {
    existing.t = at;
    return existing;
  }
  const marker = { id: uid('m'), kind: 'end', t: at };
  show.markers.push(marker);
  return marker;
}

export function removeEnd(show) {
  show.markers = show.markers.filter((m) => m.kind !== 'end');
}

export function displayOfContent(show, ct) {
  let extra = 0;
  for (const p of sortedPauses(show)) {
    if (p.t < ct) extra += p.duration;
    else break;
  }
  return ct + extra;
}

export function contentOfDisplay(show, dt) {
  let ct = dt;
  for (const p of sortedPauses(show)) {
    if (dt >= p.t + p.duration) ct -= p.duration;
    else if (dt > p.t) ct -= dt - p.t;
    else break;
  }
  return Math.max(0, ct);
}

export function localOfContent(show, trackId, ct) {
  let out = ct;
  for (const h of holdsFor(show, trackId)) {
    if (h.t <= ct) out -= Math.min(h.duration, ct - h.t);
    else break;
  }
  return Math.max(0, out);
}

export function contentOfLocal(show, trackId, lt) {
  let out = lt;
  for (const h of holdsFor(show, trackId)) {
    if (h.t <= out) out += h.duration;
    else break;
  }
  return out;
}

/* ------------------------------------------------------------------- a bend */

// A leg between two stations can bow: `bend` is how far the path passes to the left of
// the straight line, in metres, measured at the middle of the leg (negative bows right).
// A chassé across the stage is not a straight line — the body carries its momentum and
// curves — and a path that can only turn at stations makes every sweep look like a hinge.
// The bow is a quadratic curve: its control point sits twice the bend out, which puts the
// curve's own middle exactly `bend` metres off the chord, so the number on the field is the
// number you can see.
// How deep a bow may be, in metres either side of the chord. A stage is a dozen metres
// across, so anything past this is a path through the wings rather than a crossing, and
// the number is a memory of a drag as much as a choice.
export const BEND_LIMIT = 20;

function bendOf(key) {
  const v = Number(key && key.bend);
  return Number.isFinite(v) ? Math.max(-BEND_LIMIT, Math.min(BEND_LIMIT, v)) : 0;
}

// Where the curve is at a fraction of its own parameter (not of its length).
export function curveAt(a, b, t) {
  const bend = bendOf(b);
  if (!bend) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = (a.x + b.x) / 2 - (dy / len) * bend * 2;
  const cy = (a.y + b.y) / 2 + (dx / len) * bend * 2;
  const it = 1 - t;
  return {
    x: it * it * a.x + 2 * it * t * cx + t * t * b.x,
    y: it * it * a.y + 2 * it * t * cy + t * t * b.y,
  };
}

// The point a fraction of the way through the *time* of a leg. A curve's parameter is not
// its length — a bowed leg is slower at its ends — so the arc length is measured in a dozen
// steps and the parameter found for the fraction asked for. Otherwise the equal-time ticks
// on the plan would bunch through the bend and read as a stumble.
function curveByTime(a, b, u) {
  if (!bendOf(b)) return curveAt(a, b, u);
  const N = 12;
  const cum = [0];
  let total = 0;
  let prev = curveAt(a, b, 0);
  for (let i = 1; i <= N; i++) {
    const p = curveAt(a, b, i / N);
    total += Math.hypot(p.x - prev.x, p.y - prev.y);
    cum.push(total);
    prev = p;
  }
  const target = total * Math.max(0, Math.min(1, u));
  let i = 1;
  while (i < N && cum[i] < target) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  return curveAt(a, b, (i - 1 + (target - cum[i - 1]) / seg) / N);
}

// The points of a bowed leg, for anything that has to draw or test the path rather than
// walk it: the plan, its click test and the printed sheet.
export function legPoints(a, b, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(curveAt(a, b, i / n));
  return out;
}

export function posAtLocal(dancer, lt) {
  const k = dancer.keys;
  if (!k || !k.length) return null;
  if (k.length === 1 || lt <= k[0].t) return { x: k[0].x, y: k[0].y };
  const last = k[k.length - 1];
  if (lt >= last.t) return { x: last.x, y: last.y };
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i];
    const b = k[i + 1];
    if (lt >= a.t && lt <= b.t) {
      const u = b.t === a.t ? 0 : (lt - a.t) / (b.t - a.t);
      // The count is spent along the leg by the shape the station carries, so a gathering
      // step covers less ground early and more of it late without moving the station itself.
      return curveByTime(a, b, countShape(b, u));
    }
  }
  return { x: last.x, y: last.y };
}

export function posOfContent(show, dancer, ct) {
  return posAtLocal(dancer, localOfContent(show, dancer.id, ct));
}

/* ---------------------------------------------------------- station positions */

// A dancer arriving at a station reaches the new position early and holds it, rather
// than being halfway between two of them for the whole count: a body that spends a
// three-second leg rendering half of fifth and half of arabesque is dancing neither.
const POSE_REACH = 0.68;
// Except where the station is a junction between two phrases: then the position is a peak of
// the line, reached exactly at the station and left straight away, because the movement does
// not end there. The station carries `pass` when a phrase was placed onto it.

// Which way a dancer is facing, for mirroring the position: the nearest stretch of path
// that actually crosses the stage, so someone standing still keeps the side they last
// travelled towards.
function facingAt(keys, i) {
  for (let j = i; j >= 0; j--) {
    const next = keys[j + 1] || keys[j];
    const dx = next.x - keys[j].x;
    if (Math.abs(dx) > 0.15) return dx < 0 ? -1 : 1;
  }
  return 1;
}

// How a leg travelled in a named step is spent: get into the step, travel in it, then
// take the position being arrived at. In quarters of the leg.
const STEP_IN = 0.2;
const STEP_OUT = 0.7;

// The heading a dancer has reached at a local moment: every turn finished by then, plus
// whatever part of a turn is under way. Each turn finishes at the station it belongs to
// and takes either its own length (`turnMs`) or the leg into that station, whichever is
// set; a turn given a longer length therefore starts before the leg it ends on and carries
// across the stations in between, so one slow revolution is one number to retime rather
// than four equal parts to keep in step. Turns that overlap simply add, which is the only
// thing they can honestly do.
function turnAt(keys, lt) {
  return turnsAt(keys, lt).turn;
}

// A dancer spots. The head holds the way it was facing while the body goes round, then
// whips to catch up over the last part of the turn and arrives facing the same way as the
// body — which is why an audience sees the face almost the whole way round a pirouette.
// The head is read from the same turns as the body, so a head cannot drift out of step with
// the revolution it belongs to.
const SPOT_HOLD = 0.6;
const spot = (p) => (p <= SPOT_HOLD ? 0 : smooth((p - SPOT_HOLD) / (1 - SPOT_HOLD)));

function turnsAt(keys, lt) {
  let turn = 0;
  let headTurn = 0;
  for (let j = 0; j < keys.length; j++) {
    const k = keys[j];
    const amount = Number(k.turn) || 0;
    if (!amount) continue;
    const end = k.t;
    const prev = keys[j - 1];
    const leg = prev ? Math.max(1, end - prev.t) : 1;
    const given = Number(k.turnMs);
    const span = Number.isFinite(given) && given > 0 ? given : leg;
    const start = end - span;
    const u = lt <= start ? 0 : lt >= end ? 1 : (lt - start) / span;
    turn += amount * smooth(u);
    headTurn += amount * spot(u);
  }
  return { turn, headTurn };
}

const smooth = (u) => {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
};

// The position a dancer is in at a local moment, the position they are moving towards,
// how far into the change they are, and how far round they have turned on the way here.
// `t` is eased, so limbs arrive and leave a pose without a corner, and it is already
// clamped to 1 well before the next station.
export function poseAtLocal(dancer, lt) {
  const k = dancer.keys || [];
  const standing = levelOf(null);
  const still = { pose: 'none', next: 'none', t: 0, levelT: 0, facing: 1, turn: 0, headTurn: 0, step: 'walk', level: standing, nextLevel: standing };
  if (!k.length) return still;
  const first = k[0];
  if (k.length === 1 || lt <= first.t) {
    return Object.assign(still, {
      pose: first.pose || 'none',
      next: first.pose || 'none',
      level: levelOf(first),
      nextLevel: levelOf(first),
      facing: facingAt(k, 0),
      ...turnsAt(k, lt),
    });
  }
  const last = k[k.length - 1];
  if (lt >= last.t) {
    // The last station still has a landing to receive, so it is read with the station before it.
    const lv = levelOf(last, k[k.length - 2]);
    return Object.assign(still, {
      pose: last.pose || 'none',
      next: last.pose || 'none',
      level: lv,
      nextLevel: lv,
      facing: facingAt(k, k.length - 1),
      ...turnsAt(k, lt),
    });
  }
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i];
    const b = k[i + 1];
    if (lt < a.t || lt > b.t) continue;
    // One clock for the whole leg: the shape of the count moves the dancer, the position
    // and the height together, so a body cannot be halfway into an arabesque while it is
    // still standing where the even count would have left it.
    const u = countShape(b, b.t === a.t ? 1 : (lt - a.t) / (b.t - a.t));
    const facing = facingAt(k, i);
    // Where the dancer is round at this moment, from every turn that has started — which
    // is not the same as this leg's own turn, because a turn can be longer than the leg it
    // ends on. The head keeps its own count for spotting.
    const { turn, headTurn } = turnsAt(k, lt);
    const step = STEP_LABEL[b.step] ? b.step : 'walk';
    // How much of the leg the position takes to arrive: a station rested on is reached with a
    // third of the leg to spare and held there, a station passed through is reached at it.
    const reach = b.pass ? 1 : POSE_REACH;
    // A level belongs to the leg the dancer is on, so it changes with the body: the height
    // at either end of this leg, and the same eased count the pose uses.
    const level = levelOf(a, k[i - 1]);
    const nextLevel = levelOf(b, a);
    // Height keeps the leg's own clock rather than the pose's: a dancer finishes the position
    // on the way down and touches the deck *at* the station, and a rise is complete when they
    // arrive rather than a third of a leg early with the last metre walked in a plié.
    const levelT = smooth(u);
    if (step === 'walk') {
      return { pose: a.pose || 'none', next: b.pose || 'none', t: smooth(u / reach), levelT, facing, turn, headTurn, step, level, nextLevel };
    }
    // A named step is held while the dancer travels, so the leg reads as the step rather
    // than as a slow morph between two positions.
    if (u < STEP_IN) return { pose: a.pose || 'none', next: step, t: smooth(u / STEP_IN), levelT, facing, turn, headTurn, step, level, nextLevel };
    if (u < STEP_OUT) return { pose: step, next: step, t: 0, levelT, facing, turn, headTurn, step, level, nextLevel };
    return { pose: step, next: b.pose || 'none', t: smooth((u - STEP_OUT) / (1 - STEP_OUT)), levelT, facing, turn, headTurn, step, level, nextLevel };
  }
  return Object.assign(still, { pose: last.pose || 'none', next: last.pose || 'none' });
}

export function poseOfContent(show, dancer, ct) {
  return poseAtLocal(dancer, localOfContent(show, dancer.id, ct));
}

/* ------------------------------------------------------------- foot contact */

// Which foot is on the deck, and where it is. Nothing is drawn from this yet: it is the plant a
// station carries, the check that the plant is a foot she could actually stand on, and the
// geometry the leg solve will read when the feet stop sliding.
export const PLANT_LABEL = { left: 'left', right: 'right', both: 'both', air: 'air' };
// The same fact in a sentence, for a hint or a sheet.
export const PLANT_WORDS = {
  left: 'on her left foot',
  right: 'on her right foot',
  both: 'on both feet',
  air: 'in the air',
};
// A foot more than a hand's width off the deck is not carrying anybody.
const PLANT_CLEAR = 0.15;
// A stance foot that moves further than this while the body stands still has skated.
const FOOT_SKATE = 0.05;
// A leg shorter than this did not travel, so it is a change of position rather than a step.
const STANDING_LEG = 0.15;

export function dancerHeight(show) {
  const h = Number(show && show.stage && show.stage.dancerH);
  return Number.isFinite(h) ? h : 1.7;
}

// What each station stands on, worked forward from the start of the path. A typed plant wins;
// a station off the deck has no foot under it; a position says which foot carries, because that
// is geometry and not a matter of taste; and a station with no position is a step, which leaves
// on the other foot from the one before it. `auto` says the value was worked out rather than
// typed, so the interface can show it without pretending it was chosen.
export function plantsOf(dancer) {
  const keys = (dancer && dancer.keys) || [];
  let last = 'both';
  return keys.map((k, i) => {
    const lv = levelOf(k, i ? keys[i - 1] : null);
    let name = '';
    let auto = true;
    if (PLANTS.indexOf(k.plant) >= 0) {
      name = k.plant;
      auto = false;
    } else if (lv.lift > 0.05) {
      name = 'air';
    } else {
      const byPose = PLANT_BY_POSE[k.pose || 'none'];
      // A path that begins with no position begins standing, rather than beginning on whichever
      // foot came to mind: there is nothing yet to alternate from.
      if (byPose) name = byPose;
      else if (i === 0) name = 'both';
      else name = last === 'right' ? 'left' : 'right';
    }
    last = name;
    return { name, auto };
  });
}

// One foot's place on the deck at a local moment, in stage metres: across from the centre line,
// upstage from the proscenium, and how high the ankle is above the deck. All three axes now — the
// leg's fore/aft swing puts a foot in front of her or behind her, which is what makes a fourth
// position a split rather than a stance, and what lets a skate upstage be measured instead of guessed
// at.
export function footAtLocal(show, dancer, lt, side = 'left') {
  const p = posAtLocal(dancer, lt);
  if (!p) return null;
  const h = dancerHeight(show);
  const at = poseAtLocal(dancer, lt);
  const spec = blendSpecs(specOf(at.pose), specOf(at.next), at.t);
  const i = side === 'right' ? 1 : 0;
  const place = feetPlaceOf(spec, at.facing, at.turn)[i];
  if (!place) return null;
  // The frame is rotated by the turn, so a turned stance is placed where the floor would hold it; depth
  // is positive towards the house and stage y runs upstage, so one is subtracted from the other.
  const depth = place.z * h;
  const lvl = levelBlend(at.level, at.nextLevel, at.levelT);
  return {
    x: p.x + place.x * h,
    y: p.y - depth,
    // An ankle is not a sole: this is where the joint is, and it is never quite zero.
    h: place.y * h + lvl.lift,
    depth,
  };
}

// A plant that is not a foot she can stand on: the position has that foot off the deck (an
// arabesque standing on the lifted leg), or the whole dancer is in the air and no foot is
// carrying anything. Returns the foot and how high it actually is, or null when the plant is one
// she could dance.
export function plantProblem(show, dancer, i) {
  const keys = (dancer && dancer.keys) || [];
  const k = keys[i];
  const plant = plantsOf(dancer)[i];
  if (!k || !plant || plant.name === 'air') return null;
  const sides = plant.name === 'both' ? ['left', 'right'] : [plant.name];
  let worst = null;
  for (const side of sides) {
    const foot = footAtLocal(show, dancer, k.t, side);
    if (!foot) continue;
    if (foot.h > PLANT_CLEAR && (!worst || foot.h > worst.height)) worst = { side, height: foot.h };
  }
  return worst ? { ...worst, typed: !plant.auto } : null;
}

// Where each foot is being held, for a view that draws a dancer: `{ left: { x, y, z, w }, right: … }`
// in body units relative to her own place on the stage — across, up, and towards the house — with
// `sx`/`sy` the same hold in stage metres, `w` from 0 (the position decides) to 1 (the
// foot is exactly on its contact). A leg is one continuous movement with no step inside it, so the
// foot she is leaving on is held at its contact until the middle of the leg and the foot she is
// arriving on is placed on its contact from the middle on — the transfer of weight happens between
// the two, and the crossing is blended so a foot that is swinging slides through the air instead of
// jumping. Read at her own clock, so a hold freezes the feet with her, and at the station itself the
// pin is exactly where the position already puts the foot, so nothing moves when a leg begins.
// Convert a separately evaluated stage-space ankle trajectory into solver pins. Existing authored
// shows continue through footPins() until a trajectory has been explicitly planned and validated.
// Targets are `{x, y, h}` stage metres; support `load` never weakens ankle following.
export function footPinsFromTrajectory(show, dancer, lt, trajectory) {
  const body = posAtLocal(dancer, lt);
  if (!body || !trajectory || typeof trajectory !== 'object') return null;
  const sample = sampleFootTrajectory(trajectory, lt);
  if (!sample) return null;
  const h = dancerHeight(show), at = poseAtLocal(dancer, lt);
  const frame = contactFrame(body, h, at.facing, at.turn), out = {};
  for (const side of ['left', 'right']) {
    const target = sample[side];
    if (!target) continue;
    const [x, y, z] = frame.toLocal({ x: target.x, y: target.y, h: target.h });
    out[side] = { x, y, z, sx: target.x, sy: target.y, w: 1, load: target.load, swing: target.swing };
  }
  return Object.keys(out).length ? out : null;
}

function legacyFootPins(show, dancer, lt) {
  const keys = (dancer && dancer.keys) || [];
  if (!keys.length) return null;
  let idx = 0;
  for (let i = 0; i < keys.length; i++) if (keys[i].t <= lt) idx = i;
  const a = keys[idx];
  const b = keys[idx + 1] || null;
  const body = posAtLocal(dancer, lt) || { x: a.x, y: a.y };
  const h = dancerHeight(show);
  const plants = plantsOf(dancer);
  const u = b ? Math.max(0, Math.min(1, (lt - a.t) / (b.t - a.t || 1))) : 1;
  // Weight is on the departure foot for the first third of the leg and on the arrival foot for the
  // last third, changing over in between: the same place a step's transfer sits.
  const cross = b ? Math.max(0, Math.min(1, (u - 0.35) / 0.3)) : 0;
  const out = {};
  for (const side of ['left', 'right']) {
    const depHeld = plants[idx] && (plants[idx].name === side || plants[idx].name === 'both');
    const arrHeld = b && plants[idx + 1] && (plants[idx + 1].name === side || plants[idx + 1].name === 'both');
    const dep = depHeld ? footAtLocal(show, dancer, a.t, side) : null;
    const arr = arrHeld ? footAtLocal(show, dancer, b ? b.t : a.t, side) : null;
    const wDep = dep ? 1 - cross : 0;
    const wArr = arr ? cross : 0;
    const w = Math.max(wDep, wArr);
    if (w <= 0.002) continue;
    // One contact leaving and another arriving is the same foot on its way across the floor, so the
    // hold travels between the two marks rather than switching from one to the other part-way through
    // the step: the transfer reads as a step, not as a foot that jumps.
    const spot = dep && arr
      ? { x: dep.x + (arr.x - dep.x) * cross, y: dep.y + (arr.y - dep.y) * cross, h: dep.h + (arr.h - dep.h) * cross }
      : dep || arr;
    if (!spot) continue;
    // A foot going from one contact to another is in the air on the way, not sliding along the
    // floor: it leaves the old mark as the weight goes and comes down on the new one, lifting more
    // the further it has to step.
    let y = spot.h / h;
    if (dep && arr) {
      const moved = Math.hypot(dep.x - arr.x, dep.y - arr.y);
      if (moved > 0.02) y += (Math.min(0.12, moved * 0.35) * Math.sin(Math.PI * w)) / h;
    }
    // The contact is a place on the stage, and the leg is solved in her own frame: across, up, and
    // towards the house. `z` is therefore the contact's depth in that frame, rotated back by the turn,
    // so a foot planted while she goes round keeps its mark instead of being carried along with her.
    // `sx`/`sy` keep the same mark in stage metres, for anything that measures on the floor.
    const at = poseAtLocal(dancer, lt);
    const across = (spot.x - body.x) / h;
    const house = (body.y - spot.y) / h;
    const th = ((Number(at.turn) || 0) * Math.PI) / 180;
    const mirror = at.facing < 0 ? -1 : 1;
    const z = house * Math.cos(th) + (across / mirror) * Math.sin(th);
    out[side] = { x: across, y, z, sx: spot.x, sy: spot.y, w };
  }
  return Object.keys(out).length ? out : null;
}

// Explicitly attached schedules opt into stage-space pins across the normal model/render path.
// Dancers without a schedule retain the authored-station contact behavior.
export function footPins(show, dancer, lt) {
  if (dancer && dancer.footTrajectory) {
    return footPinsFromTrajectory(show, dancer, lt, dancer.footTrajectory);
  }
  return legacyFootPins(show, dancer, lt);
}

// Where each foot is on the floor at a moment, for the two views that draw the deck: the foot she is
// standing on is on its contact and not wherever the position would have carried it, and a foot in the
// air between two contacts is drawn between them. Stage metres, `held` true when the contact is
// carrying her. With no pin — no path, or the whole dancer in the air — this is the position's own
// feet, so nothing that does not step changes.
export function feetOnFloor(show, dancer, lt) {
  const h = dancerHeight(show);
  const pins = footPins(show, dancer, lt);
  const out = {};
  for (const side of ['left', 'right']) {
    const own = footAtLocal(show, dancer, lt, side);
    const pin = pins && pins[side];
    if (!pin) {
      if (own) out[side] = { x: own.x, y: own.y, h: own.h, held: false, w: 0 };
      continue;
    }
    const w = pin.w;
    const to = { x: pin.sx, y: pin.sy, h: pin.y * h };
    out[side] = own
      ? {
          x: own.x + (to.x - own.x) * w,
          y: own.y + (to.y - own.y) * w,
          h: own.h + (to.h - own.h) * w,
          held: w > 0.5,
          w,
        }
      : { ...to, held: w > 0.5, w };
  }
  return out;
}

// Overhead geometry keeps solved ankles distinct from requested contacts.
// Preserve the current pose/rise assumptions for this bounded rendering correction.
export function overheadPoseAtLocal(show, dancer, lt) {
  const origin = posAtLocal(dancer, lt);
  if (!origin) return null;
  const at = poseAtLocal(dancer, lt);
  const spec = blendSpecs(specOf(at.pose), specOf(at.next), at.t);
  const h = dancerHeight(show);
  const frame = contactFrame(origin, h, at.facing, at.turn);
  const contacts = footPins(show, dancer, lt);
  const pins = contacts && Object.fromEntries(Object.entries(contacts).map(([side, pin]) => {
    const [x, y, z] = frame.toLocal({ x: pin.sx, y: pin.sy, h: pin.y * h });
    return [side, { ...pin, x, y, z }];
  }));
  const figure = joints(spec, 1, 0, pins);
  const legs = figure.legs3.map(leg => leg.map(frame.toStage));
  const feet = {};
  for (const [i, side] of ['left', 'right'].entries()) {
    const pin = pins && pins[side];
    const short = figure.shortfall[i];
    feet[side] = { ...legs[i][2], held: !!(pin && pin.w > 0.5 && !short),
      unreachable: !!(short && pin), target: short && pin ? frame.toStage(short.target) : null,
      shortfall: short ? short.over * h : 0 };
  }
  return { at, figure, frame, legs, feet };
}

// A single planted foot drifting during an otherwise stationary transition.
// Destination two-foot plants intentionally transfer contacts and are not skate faults.
export function footSkate(show, dancer, i) {
  const keys = (dancer && dancer.keys) || [];
  const a = keys[i - 1];
  const b = keys[i];
  if (!a || !b) return null;
  const plants = plantsOf(dancer);
  const plant = plants[i - 1];
  // Arriving in a two-foot preparation (fourth/fifth) is a deliberate replant, not a
  // single-foot stance drifting under a stationary body. footPins transfers each foot
  // from its old contact to the new position and lifts it during that transfer.
  if (!plant || plant.name === 'air' || plant.name === 'both' || plants[i].name === 'both') return null;
  if (Math.hypot(b.x - a.x, b.y - a.y) > STANDING_LEG) return null;
  const from = footAtLocal(show, dancer, a.t, plant.name);
  const to = footAtLocal(show, dancer, b.t, plant.name);
  if (!from || !to) return null;
  const away = Math.hypot(to.x - from.x, to.y - from.y);
  return away > FOOT_SKATE ? { side: plant.name, away } : null;
}

// A stance she cannot get to: the body ends up further from the contact than the leg is long, so the
// solve straightens the leg and the foot leaves its mark — the same fault as a skate, from the other
// side. Measured by walking the whole leg, because the furthest moment is usually part-way through a
// transfer rather than at either station, and read from the same joints the elevation draws, so the
// sentence and the picture cannot disagree.
// The position table's legs are at their length already — second position is a stance with the legs
// straight — so the solve is over its limit by a centimetre or two in almost any spread. What is
// worth a sentence is a foot left visibly in the wrong place: past a hand's width, the straightening
// is no longer invisible and the contact has gone.
const REACH_SLACK = 0.15;

export function legOverreach(show, dancer, i) {
  const keys = (dancer && dancer.keys) || [];
  const a = keys[i - 1];
  const b = keys[i];
  if (!a || !b) return null;
  const h = dancerHeight(show);
  let worst = null;
  const steps = 16;
  for (let s = 0; s <= steps; s++) {
    const lt = a.t + ((b.t - a.t) * s) / steps;
    const pins = footPins(show, dancer, lt);
    if (!pins) continue;
    const at = poseAtLocal(dancer, lt);
    const lvl = levelBlend(at.level, at.nextLevel, at.levelT);
    // The height the leg is actually asked for: a rise lengthens it, a landing's plié shortens it.
    const posed = blendSpecs(specOf(at.pose), specOf(at.next), at.t);
    const spec = { ...posed, rise: (posed.rise || 0) + lvl.rise - lvl.absorb / h };
    const j = joints(spec, at.facing, at.turn, pins);
    const body = posAtLocal(dancer, lt);
    for (const side of ['left', 'right']) {
      const short = j.shortfall[side === 'right' ? 1 : 0];
      if (!short || (worst && short.over <= worst.over) || !body) continue;
      // Both ends of the gap on the floor, for a plan to draw: the mark the foot is meant to be on,
      // and where the leg actually runs out — the contact pulled back along the leg towards her.
      worst = {
        side,
        over: short.over * h,
        across: Math.abs(short.overX) * h,
        at: lt,
        from: {
          x: pins[side].sx != null ? pins[side].sx : body.x + pins[side].x * h,
          y: pins[side].sy != null ? pins[side].sy : body.y - (pins[side].z || 0) * h,
        },
        // The reach pulled back along the leg towards her, in both floor axes: the gap is what the step
        // is short by, drawn where it is short. Depth runs towards the house, so it is subtracted from
        // the stage's upstage measure rather than added.
        to: {
          x: (pins[side].sx != null ? pins[side].sx : body.x + pins[side].x * h) - short.overX * h,
          y: (pins[side].sy != null ? pins[side].sy : body.y - (pins[side].z || 0) * h) + (short.overZ || 0) * h,
        },
      };
    }
  }
  return worst && worst.over > REACH_SLACK ? worst : null;
}

// The last thing actually choreographed, ignoring the running order.
function lastContent(show) {
  let end = 0;
  for (const d of show.cast) {
    if (!d.keys.length) continue;
    const last = d.keys[d.keys.length - 1].t;
    end = Math.max(end, contentOfLocal(show, d.id, last));
  }
  for (const m of show.markers) {
    end = Math.max(end, m.t + (m.duration || 0));
  }
  // A final curtain or fly-out can be the last thing in the show.
  for (const s of show.scenery) {
    for (const c of s.cues || []) end = Math.max(end, c.at + (c.dur || 0));
  }
  for (const clip of show.videos || []) end = Math.max(end, clip.at + videoSpan(clip));
  for (const cue of show.slideCues || []) {
    const at = Number(cue && cue.at);
    if (Number.isFinite(at)) end = Math.max(end, at + boundedFade(cue.fade));
  }
  return end;
}

// The running order can be longer than the work inside it: an act exists before
// it is choreographed, and the clock has to reach the end of the last act.
export function endContent(show) {
  // An end marker wins over the computed length, in both directions: the show can
  // finish before the acts do, and it can also run on past the last cue into a
  // curtain call that has been marked but not choreographed.
  const marked = endMarker(show);
  if (marked) return marked.t;
  return Math.max(lastContent(show), totalActLength(show));
}

export function endDisplay(show) {
  return displayOfContent(show, endContent(show));
}

// How far the timeline window may be slid, in display seconds. It reaches everything already
// placed — even work after an end marker, or music past the last act — plus room to keep
// building past it, and never snaps back from a view the wheel already scrolled to.
export function timelineScrollRange(show, viewSec, scrollT = 0) {
  const view = Math.max(1, Number(viewSec) || 1);
  let end = Math.max(endContent(show), lastContent(show), totalActLength(show));
  for (const t of (show && show.musicTracks) || []) end = Math.max(end, (Number(t.start) || 0) + musicSpan(t));
  for (const c of (show && show.narration) || []) end = Math.max(end, (Number(c.at) || 0) + (Number(c.length) || 0));
  const endSec = displayOfContent(show, end) / 1000;
  const room = Math.max(30, view * 0.5);
  const max = Math.max(0, endSec + room - view, Number(scrollT) || 0);
  return { endSec, max, view };
}

/* -------------------------------------------------------------- collision */

// Two bodies need this much floor between them before it reads as a pass rather than a
// collision. It is a circle where a dancer is closer to an ellipse, which is the price of a
// test that can run over the whole show without being told which way anyone is facing.
export const CLEARANCE = 0.55;

export function collisionsAt(show, ct) {
  const threshold = CLEARANCE;
  const live = [];
  for (const d of show.cast) {
    if (!d.visible) continue;
    const p = posOfContent(show, d, ct);
    if (p) live.push({ d, p });
  }
  const hits = [];
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const dx = live[i].p.x - live[j].p.x;
      const dy = live[i].p.y - live[j].p.y;
      if (Math.hypot(dx, dy) < threshold) hits.push([live[i].d, live[j].d]);
    }
  }
  return hits;
}

/* ------------------------------------------------------------- overlaps */

// Every moment of the running order where two performers are inside the clearance, worked
// out once so a list can be made of them. A run-through only notices an overlap it happens to
// play through, which is the wrong way round: the faults worth fixing are the ones you have
// not reached yet. Pairs are sampled rather than solved (a pass is a distance between two
// moving bodies, not a station), and two samples of the same pair at the same stretch of the
// show are one overlap, reported at the closest moment in it.
export function scanOverlaps(show) {
  const cast = (show.cast || []).filter((d) => d.visible !== false && (d.keys || []).length);
  if (cast.length < 2) return [];
  const end = Math.max(1000, endContent(show) + 500);
  const step = Math.max(80, Math.round(end / 5000));
  const open = new Map();
  const out = [];
  for (let ct = 0; ct <= end; ct += step) {
    const live = [];
    for (const d of cast) {
      const p = posOfContent(show, d, ct);
      if (p) live.push({ d, p });
    }
    const seen = new Set();
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        const gap = Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y);
        const key = a.d.id < b.d.id ? a.d.id + '|' + b.d.id : b.d.id + '|' + a.d.id;
        if (gap >= CLEARANCE) continue;
        seen.add(key);
        const run = open.get(key);
        if (run) {
          run.end = ct;
          if (gap < run.gap) {
            run.gap = gap;
            run.at = ct;
          }
        } else {
          open.set(key, { key, ids: [a.d.id, b.d.id], numbers: [a.d.number, b.d.number], start: ct, end: ct, at: ct, gap });
        }
      }
    }
    // A pair that has cleared finishes its overlap here.
    for (const [key, run] of [...open]) {
      if (seen.has(key)) continue;
      open.delete(key);
      out.push(run);
    }
  }
  for (const run of open.values()) out.push(run);
  return out
    .sort((a, b) => a.at - b.at)
    .map((o, i) => ({ ...o, id: 'ov' + i, at: Math.round(o.at) }));
}

// Where everybody but one dancer stands, sampled once across the running order at a fixed set of
// moments. A candidate fix changes one path and puts it back; the other bodies do not move, so their
// floor is measured once and the candidate costs one walk of her own path rather than of the whole
// show. It is dropped whenever the show changes (the revision counter in `persist`), because a
// cached floor is only good for the show it was read from.
const CHECK_STEP = 80;
const TIGHT_MARGIN = 0.08;
let sampleCache = null;

function samplesOf(show) {
  const rev = state.ui.rev || 0;
  if (sampleCache && sampleCache.rev === rev && sampleCache.show === show) return sampleCache;
  const end = Math.max(1000, endContent(show) + 600);
  const times = [];
  for (let t = 0; t <= end; t += CHECK_STEP) times.push(t);
  const byId = new Map();
  for (const d of show.cast || []) {
    if (d.visible === false || !(d.keys || []).length) continue;
    const xs = new Float32Array(times.length).fill(NaN);
    const ys = new Float32Array(times.length).fill(NaN);
    times.forEach((t, i) => {
      const p = posOfContent(show, d, t);
      if (!p) return;
      xs[i] = p.x;
      ys[i] = p.y;
    });
    byId.set(d.id, { xs, ys });
  }
  sampleCache = { rev, show, times, byId };
  return sampleCache;
}

// How tight her floor is, over the whole show, after an edit: with the body she is overlapping, and
// with everybody else. Three numbers, because a fix has to pass three ways.
//
// `pair` is the one that matters. A fix only counts if *these two* never come inside the clearance
// anywhere in the show — a local window cannot tell that a dancer retimed earlier simply meets the
// same body earlier, and "not worse overall" cannot either, because the collision merely moves to a
// moment the window does not contain. `window` is the same measure over this overlap's own stretch,
// kept so the message can say this one moment is clear. `all` is every body, and is only compared
// with what it was before the edit: a fix that pushes her into a third dancer is not a fix, but a
// separate overlap elsewhere in her path is not this fix's business.
function tightWith(show, dancerId, partnerId, from, to) {
  const d = (show.cast || []).find((x) => x.id === dancerId);
  const partner = samplesOf(show).byId.get(partnerId);
  if (!d || !partner) return { pair: 0, window: 0, all: 0 };
  const s = samplesOf(show);
  const near = CLEARANCE + TIGHT_MARGIN;
  let pair = 0;
  let window = 0;
  let all = 0;
  for (let i = 0; i < s.times.length; i++) {
    const p = posOfContent(show, d, s.times[i]);
    if (!p) continue;
    const px = partner.xs[i];
    if (px === px && Math.hypot(p.x - px, p.y - partner.ys[i]) < near) {
      pair += 1;
      if (s.times[i] >= from && s.times[i] <= to) window += 1;
    }
    for (const [id, buf] of s.byId) {
      if (id === dancerId || id === partnerId) continue;
      const x = buf.xs[i];
      if (x !== x) continue;
      if (Math.hypot(p.x - x, p.y - buf.ys[i]) < near) {
        all += 1;
        break;
      }
    }
  }
  return { pair, window, all };
}

// A signature of the paths, and only the paths. A fix names stations by their place in one, so a list
// of fixes is only good for the paths it was read from — and the revision counter cannot say that,
// because a panel rebuild writes the show to storage without changing a thing. This is read once
// when a scan is made and again when a row is clicked or drawn, so a list that describes paths which
// have since been dragged or cut cannot move a station that is no longer the one it meant.
export function pathsKey(show) {
  const cast = show.cast || [];
  let out = '';
  for (const d of cast) {
    out += (d.visible === false ? '0' : '1') + ':';
    for (const k of d.keys || []) out += `${Math.round(k.x * 100)},${Math.round(k.y * 100)},${Math.round(k.t)};`;
    out += '|';
  }
  return out;
}

// One fix, ranked, for one overlap: whichever of a small set of edits costs the dance least and
// actually clears it. Each candidate is tried on the real show and put straight back, so what is
// measured is what would happen — and the plant, skate and reach checks around the edit are re-run,
// because a nudge that clears a body and pulls a planted foot is a different fault, not a fix.
//
// Three kinds, cheapest first. A **nudge** moves one station, which is enough when she is standing
// where the other passes: a station is where a still dancer is. A **shift** moves both ends of the
// leg she is on, which is what a pass made *while travelling* needs — moving one end of a blend
// moves her by half at the moment that matters, and half is still a collision. A **retime** moves a
// station on the clock, which is one dancer waiting for the other: the cheapest thing a
// choreographer does about traffic, and the only one that leaves the picture alone.
const FIX_MARGIN = 0.12;
const FIX_RETIMES = [300, 600, 1000, 1500, 2000, 3000, 4000];
// What a metre of movement costs against a second of displaced music. A path is the dance; the
// clock is only where it sits, so moving a body is dearer than waiting a beat for a gap.
const FIX_COST_M = 3;
const FIX_COST_SHIFT = 4;
const FIX_COST_S = 0.7;

// How a move is said out loud, in the words the stage uses.
function movedWords(dx, dy) {
  const bits = [];
  if (Math.abs(dx) > 0.01) bits.push(`${dx > 0 ? 'stage right' : 'stage left'} ${Math.abs(dx).toFixed(1)} m`);
  if (Math.abs(dy) > 0.01) bits.push(`${dy > 0 ? 'upstage' : 'downstage'} ${Math.abs(dy).toFixed(1)} m`);
  return bits.join(' and ') || 'a step';
}

// Where her feet would be wrong if a station moved. Only the legs touching what was edited are
// counted: a fault further down the path was there before the fix and is not this fix's business,
// and re-measuring a whole path for every candidate would make a scan of a long show crawl.
function legFaults(show, dancer, idxs) {
  const keys = (dancer && dancer.keys) || [];
  const legs = new Set();
  let n = 0;
  for (const i of idxs) {
    if (i < 0 || i >= keys.length) continue;
    if (plantProblem(show, dancer, i)) n += 1;
    if (i >= 1) legs.add(i);
    if (i + 1 < keys.length) legs.add(i + 1);
  }
  for (const leg of legs) {
    if (footSkate(show, dancer, leg)) n += 1;
    if (legOverreach(show, dancer, leg)) n += 1;
  }
  return n;
}

// A station can be moved into the wings but not off the floor: the wings are where a dancer waits,
// and out beyond them is nowhere.
function stageRoom(show, x, y) {
  const s = show.stage;
  const halfW = s.width / 2 + (Number(s.wingDepth) || 0);
  return Math.abs(x) <= halfW + 0.01 && y >= -0.5 && y <= s.depth + 0.5;
}

export function overlapFix(show, overlap) {
  if (!overlap) return null;
  const cast = show.cast || [];
  const a = cast.find((d) => d.id === overlap.ids[0]);
  const b = cast.find((d) => d.id === overlap.ids[1]);
  if (!a || !b) return null;
  const grid = Number(show.stage.grid) || 0.5;
  const candidates = [];

  for (const [mover, other] of [
    [a, b],
    [b, a],
  ]) {
    const keys = mover.keys || [];
    if (!keys.length) continue;
    const lt = localOfContent(show, mover.id, overlap.at);
    const mine = posOfContent(show, mover, overlap.at);
    const theirs = posOfContent(show, other, overlap.at);
    if (!mine || !theirs) continue;
    // The station she is at, or the one she has just left. Before her first station she is already
    // standing on it, which is a real case: two dancers waiting in position before the show starts.
    let idx = 0;
    for (let i = 1; i < keys.length; i++) if (keys[i].t <= lt) idx = i;
    const gap = Math.hypot(mine.x - theirs.x, mine.y - theirs.y);
    const deficit = CLEARANCE + FIX_MARGIN - gap;
    if (deficit <= 0) continue;

    // Which way she could go. Away from the other body is the obvious one; across that line is the
    // one that fixes a crossing, because two dancers walking through each other are not helped by
    // being pushed along the line they are both travelling on.
    const dirs = [];
    const push = (x, y) => {
      const l = Math.hypot(x, y);
      if (l < 1e-6) return;
      const u = [x / l, y / l];
      if (dirs.some((d) => Math.abs(d[0] - u[0]) < 0.2 && Math.abs(d[1] - u[1]) < 0.2)) return;
      dirs.push(u);
    };
    push(mine.x - theirs.x, mine.y - theirs.y);
    push(-(mine.y - theirs.y), mine.x - theirs.x);
    push(mine.y - theirs.y, -(mine.x - theirs.x));
    if (!dirs.length) {
      // Standing exactly on top of each other: no line to run away along, so take her own way out —
      // across the leg she is travelling, or stage right if she is not travelling at all.
      const step = keys[idx + 1] || keys[idx - 1];
      if (step) push(-(step.y - keys[idx].y), step.x - keys[idx].x);
      push(1, 0);
      push(0, 1);
    }

    // A candidate is measured, not guessed: put into the real show, read for both faults — another
    // body too close anywhere in the show, or a foot pulled off its mark — and put straight back.
    // True when it is a fix, which is what lets the loops below stop at the first one that works.
    const windowFrom = overlap.start - 300;
    const windowTo = overlap.end + 300;
    const baseTight = tightWith(show, mover.id, other.id, windowFrom, windowTo);
    const consider = (kind, edits, cost, label, touched) => {
      const baseline = legFaults(show, mover, touched);
      const saved = edits.map((e) => ({ ...keys[e.idx] }));
      for (const e of edits) {
        const k = keys[e.idx];
        if (e.dx != null) k.x = round2(k.x + e.dx);
        if (e.dy != null) k.y = round2(k.y + e.dy);
        if (e.dt != null) k.t = Math.round(k.t + e.dt);
      }
      const tight = tightWith(show, mover.id, other.id, windowFrom, windowTo);
      // These two clear everywhere, nothing new is tight with a third body, and no foot was pulled.
      let ok = tight.pair === 0 && tight.all <= baseTight.all;
      if (ok) ok = legFaults(show, mover, touched) <= baseline;
      edits.forEach((e, n) => Object.assign(keys[e.idx], saved[n]));
      if (!ok) return false;
      candidates.push({ kind, dancerId: mover.id, edits, cost, label });
      return true;
    };

    // The leg she is on, and whether it is a stand rather than a step. This decides which fixes make
    // sense: moving one end of a stand makes her drift a metre and come back, which is not something
    // a dancer would do, so a still body is only ever carried whole.
    const pair = keys[idx + 1] ? [idx, idx + 1] : keys[idx - 1] ? [idx - 1, idx] : null;
    const stand = !pair ? true : Math.hypot(keys[pair[1]].x - keys[pair[0]].x, keys[pair[1]].y - keys[pair[0]].y) <= 0.3;

    // 1. One station. Enough when she is still and has no other station to keep her there, or when
    // the moment she is closest is a station she is passing through.
    let done = Boolean(stand && pair);
    for (const [ux, uy] of dirs) {
      for (let extra = 0; extra <= 2 && !done; extra++) {
        // A grid step is a coarse thing to need, so a move is tried at the clearance it lacks and
        // then a step further out, until one is far enough to clear the margin.
        const dist = deficit + extra * grid;
        const dx = Math.round((ux * dist) / grid) * grid;
        const dy = Math.round((uy * dist) / grid) * grid;
        if (!dx && !dy) continue;
        const k = keys[idx];
        if (!stageRoom(show, k.x + dx, k.y + dy)) continue;
        done = consider('nudge', [{ idx, dx, dy }], Math.hypot(dx, dy) * FIX_COST_M, `move ${mover.name}'s point ${movedWords(dx, dy)}`, [idx]);
      }
      if (done) break;
    }

    // 2. The whole leg she is on, carried aside. The fix for a pass made while travelling: both
    // ends move together, so she is the full distance further away at the moment that matters — and
    // the fix for a still body, which should stand somewhere else rather than sway towards it.
    if (pair) {
      for (const [ux, uy] of dirs) {
        let moved = false;
        for (let extra = 0; extra <= 2 && !moved; extra++) {
          const dist = deficit + extra * grid;
          const dx = Math.round((ux * dist) / grid) * grid;
          const dy = Math.round((uy * dist) / grid) * grid;
          if (!dx && !dy) continue;
          if (pair.some((i) => !stageRoom(show, keys[i].x + dx, keys[i].y + dy))) continue;
          moved = consider(
            'shift',
            pair.map((i) => ({ idx: i, dx, dy })),
            Math.hypot(dx, dy) * FIX_COST_SHIFT,
            `carry ${mover.name}'s path ${movedWords(dx, dy)}`,
            pair
          );
        }
        if (moved) break;
      }
    }

    // 3. Time. She waits for the other one to go through, or she gets there sooner and is gone
    // before it arrives — both are traffic, and which is cheaper depends on where she already is.
    // Tried smallest displacement first, so the least of it is the one offered.
    for (const j of [idx, idx + 1]) {
      const k = keys[j];
      if (!k) continue;
      const prev = keys[j - 1];
      const next = keys[j + 1];
      const waits = FIX_RETIMES.flatMap((ms) => [ms, -ms]).sort((x, y) => Math.abs(x) - Math.abs(y));
      for (const dt of waits) {
        const moved = k.t + dt;
        if (moved < 0) continue;
        if (prev && moved < prev.t + 120) continue;
        if (next && moved > next.t - 120) continue;
        const word = j === idx ? 'leaves' : 'arrives';
        const label = `${mover.name} ${word} ${(Math.abs(dt) / 1000).toFixed(1)} s ${dt > 0 ? 'later' : 'earlier'}`;
        if (consider('retime', [{ idx: j, dt }], (Math.abs(dt) / 1000) * FIX_COST_S, label, [j])) break;
      }
    }
  }

  candidates.sort((x, y) => x.cost - y.cost);
  const best = candidates[0] || null;
  return best ? { ...best, overlapId: overlap.id, at: overlap.at, gap: overlap.gap } : null;
}

// Put a fix into the show. Separated from choosing it so the caller can commit first: a fix is an
// edit like any other, and Undo has to bring the path back exactly as it was. A station may be moved
// on the floor, on the clock, or both, which is why a fix is a list of edits rather than one of each.
export function applyOverlapFix(show, fix) {
  if (!fix || !fix.edits) return false;
  const d = (show.cast || []).find((x) => x.id === fix.dancerId);
  const keys = d && d.keys;
  if (!keys) return false;
  let any = false;
  for (const e of fix.edits) {
    const k = keys[e.idx];
    if (!k) continue;
    if (e.dx != null) k.x = round2(k.x + e.dx);
    if (e.dy != null) k.y = round2(k.y + e.dy);
    if (e.dt != null) k.t = Math.round(k.t + e.dt);
    any = true;
  }
  return any;
}

/* --------------------------------------------------------------- history */

export function commit() {
  state.history.push(JSON.stringify(state.show));
  if (state.history.length > 80) state.history.shift();
  state.future.length = 0;
  state.ui.dirtyPanels = true;
  persist();
}

export function undo() {
  if (!state.history.length) return;
  state.future.push(JSON.stringify(state.show));
  state.show = normalise(JSON.parse(state.history.pop()));
  state.ui.dirtyPanels = true;
  persist();
}

export function redo() {
  if (!state.future.length) return;
  state.history.push(JSON.stringify(state.show));
  state.show = normalise(JSON.parse(state.future.pop()));
  state.ui.dirtyPanels = true;
  persist();
}

export function persist() {
  // Every save is a change to the show's geometry, so anything that drew the show from a
  // cache can tell its cache is old without knowing which edit it was. It is a counter rather
  // than a hash: the strip under the timeline reads it once a frame, and counting is free.
  state.ui.rev = (state.ui.rev || 0) + 1;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.show));
  } catch (e) {
    /* storage full or blocked - not fatal */
  }
}

export function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalise(JSON.parse(raw));
  } catch (e) {
    return null;
  }
}
