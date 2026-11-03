// Deterministic stage-space ankle trajectories. A track is an ordered list of knots:
// { t, x, y, h, load, toNext?, lift? }. Distances are metres and time is local milliseconds.
// `hold` keeps the ankle fixed, `linear` interpolates directly, and `swing` uses a smooth
// interpolation plus a sin-arc lift. Support `load` is interpolated independently of position.
const MODES = new Set(['hold', 'linear', 'swing']);
const EPS = 1e-9;

function finiteKnot(k) {
  return k && Number.isFinite(k.t) && Number.isFinite(k.x) && Number.isFinite(k.y) &&
    Number.isFinite(k.h) && Number.isFinite(k.load) && k.load >= 0 && k.load <= 1;
}

export function validateFootTrajectory(trajectory) {
  if (!trajectory || typeof trajectory !== 'object' || Array.isArray(trajectory)) {
    throw new TypeError('Foot trajectory must be an object with left/right tracks');
  }
  for (const side of ['left', 'right']) {
    const track = trajectory[side];
    if (track == null) continue;
    if (!Array.isArray(track) || !track.length) throw new TypeError(`${side} track must be a non-empty knot array`);
    for (let i = 0; i < track.length; i++) {
      const knot = track[i];
      if (!finiteKnot(knot)) throw new TypeError(`${side} knot ${i} needs finite t/x/y/h and load in [0, 1]`);
      if (i && !(knot.t > track[i - 1].t)) throw new RangeError(`${side} knot times must increase strictly`);
      if (i < track.length - 1) {
        const mode = knot.toNext || 'linear';
        if (!MODES.has(mode)) throw new TypeError(`${side} knot ${i} has unknown toNext mode`);
        if (mode === 'hold') {
          const next = track[i + 1];
          if (Math.hypot(next.x - knot.x, next.y - knot.y, next.h - knot.h) > EPS) {
            throw new RangeError(`${side} hold segment must end at the held ankle point`);
          }
        }
        if (knot.lift != null && (!Number.isFinite(knot.lift) || knot.lift < 0)) {
          throw new RangeError(`${side} knot ${i} lift must be finite and non-negative`);
        }
      }
    }
  }
  return true;
}

function smooth(u) { return u * u * (3 - 2 * u); }

function sampleTrack(track, t) {
  if (!track || !track.length) return null;
  if (t <= track[0].t) return { x: track[0].x, y: track[0].y, h: track[0].h, load: track[0].load, swing: false };
  const last = track[track.length - 1];
  if (t >= last.t) return { x: last.x, y: last.y, h: last.h, load: last.load, swing: false };
  let i = 0;
  while (i < track.length - 1 && t > track[i + 1].t) i++;
  const a = track[i], b = track[i + 1];
  if (t === a.t) return { x: a.x, y: a.y, h: a.h, load: a.load, swing: false };
  if (t === b.t) return { x: b.x, y: b.y, h: b.h, load: b.load, swing: false };
  const u = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
  const mode = a.toNext || 'linear', p = mode === 'swing' ? smooth(u) : u;
  const arc = mode === 'swing' ? (Number(a.lift) || 0) * Math.sin(Math.PI * p) : 0;
  const blend = (x, y) => x + (y - x) * p;
  return {
    x: mode === 'hold' ? a.x : blend(a.x, b.x),
    y: mode === 'hold' ? a.y : blend(a.y, b.y),
    h: (mode === 'hold' ? a.h : blend(a.h, b.h)) + arc,
    load: a.load + (b.load - a.load) * smooth(u),
    swing: mode === 'swing' && u > 0 && u < 1,
  };
}

// Sample either foot at a local time. Missing tracks remain unpinned (`null`).
export function sampleFootTrajectory(trajectory, t) {
  if (!Number.isFinite(t)) throw new TypeError('Trajectory sample time must be finite');
  validateFootTrajectory(trajectory);
  const out = {};
  for (const side of ['left', 'right']) {
    const point = sampleTrack(trajectory[side], t);
    if (point) out[side] = point;
  }
  return Object.keys(out).length ? out : null;
}
