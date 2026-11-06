// Draft routines live independently of show JSON until the explicit send boundary.
export const ROUTINE_DRAFT_VERSION = 1;
export const ROUTINE_DRAFT_KEY = 'choreographer.path-studio.draft.v1';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const id = () => `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const ALLOWED_OBSTACLES = new Set(['prop', 'curtain', 'drop']);

export function createRoutineDraft({ name = 'Untitled routine', dancerId = null, obstacles = [] } = {}) {
  return normalizeRoutineDraft({
    version: ROUTINE_DRAFT_VERSION,
    id: id(), name, dancerId, obstacles, route: [], stations: [],
  });
}

// Only known, JSON-safe draft fields cross the persistence boundary. A malformed draft
// becomes an empty draft rather than being allowed to leak into or corrupt the live show.
export function normalizeRoutineDraft(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const points = (Array.isArray(raw.route) ? raw.route : [])
    .filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
    .slice(0, 512)
    .map((p, i) => ({ u: clamp(finite(p.u, i / Math.max(1, raw.route.length - 1)), 0, 1), x: clamp(Number(p.x), -100, 100), y: clamp(Number(p.y), -100, 100) }));
  const obstacles = (Array.isArray(raw.obstacles) ? raw.obstacles : [])
    .filter((o) => o && ALLOWED_OBSTACLES.has(o.kind))
    .slice(0, 256)
    .map((o, i) => ({
      ...copyJsonObject(o),
      id: typeof o.id === 'string' && o.id ? o.id : `draft-obstacle-${i + 1}`,
      kind: o.kind,
      x: clamp(finite(o.x), -100, 100), y: clamp(finite(o.y), -100, 100),
      w: clamp(finite(o.w, 1), 0.1, 100), d: clamp(finite(o.d, 1), 0.1, 100),
    }));
  const stations = (Array.isArray(raw.stations) ? raw.stations : [])
    .filter((s) => s && Number.isFinite(Number(s.contentMs)) && Number.isFinite(Number(s.x)) && Number.isFinite(Number(s.y)))
    .slice(0, 2048)
    .map((s, i) => ({
      id: typeof s.id === 'string' && s.id ? s.id : `station-${i + 1}`,
      count: Math.max(0, finite(s.count, i)),
      contentMs: Math.max(0, Math.round(Number(s.contentMs))),
      x: clamp(Number(s.x), -100, 100), y: clamp(Number(s.y), -100, 100),
      keyframe: normalizeKeyframe(s.keyframe),
    }))
    .sort((a, b) => a.contentMs - b.contentMs);
  return {
    version: ROUTINE_DRAFT_VERSION,
    id: typeof raw.id === 'string' && raw.id ? raw.id : id(),
    name: typeof raw.name === 'string' ? raw.name.slice(0, 120) : 'Untitled routine',
    dancerId: typeof raw.dancerId === 'string' && raw.dancerId ? raw.dancerId : null,
    obstacles,
    route: points,
    stations: points.length < 2 ? [] : stations,
  };
}

function copyJsonObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  try { return JSON.parse(JSON.stringify(value)); } catch { return {}; }
}

const KEY_STRING_FIELDS = new Set(['pose','step','level','plant','ease','port','notes']);
const KEY_BOOLEAN_FIELDS = new Set(['phraseEnd','pass']);
const KEY_NUMBER_FIELDS = new Set(['turn','turnMs','bend','lift','absorb','dur']);
function normalizeKeyframe(value) {
  const raw = copyJsonObject(value), out = {};
  for (const key of KEY_STRING_FIELDS) if (typeof raw[key] === 'string' && raw[key].length <= 240) out[key] = raw[key];
  for (const key of KEY_BOOLEAN_FIELDS) if (raw[key] === true) out[key] = true;
  for (const key of KEY_NUMBER_FIELDS) if (raw[key] !== '' && Number.isFinite(Number(raw[key]))) out[key] = Number(raw[key]);
  return out;
}

// Catmull-Rom interpolation gives a smooth, endpoint-pinned route through authored points.
// `u` is normalized route progress, not stage distance; deterministic stations use time progress.
export function createRoutineRouteSampler(route) {
  const points = (Array.isArray(route) ? route : []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!points.length) return () => null;
  if (points.length === 1) return () => ({ x: points[0].x, y: points[0].y });
  const raw = (segment, t) => {
    const p0 = points[Math.max(0, segment - 1)];
    const p1 = points[segment];
    const p2 = points[segment + 1];
    const p3 = points[Math.min(points.length - 1, segment + 2)];
    const curve = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    return { x: curve(p0.x, p1.x, p2.x, p3.x), y: curve(p0.y, p1.y, p2.y, p3.y) };
  };
  // Build a deterministic arc-length lookup so beats follow distance along the drawn
  // curve instead of changing speed merely because control points are unevenly spaced.
  const table = [];
  let length = 0, previous = raw(0, 0);
  table.push({ distance: 0, segment: 0, t: 0 });
  const steps = 32;
  for (let segment = 0; segment < points.length - 1; segment++) {
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const p = raw(segment, t);
      length += Math.hypot(p.x - previous.x, p.y - previous.y);
      table.push({ distance: length, segment, t });
      previous = p;
    }
  }
  if (!length) return () => ({ x: points[0].x, y: points[0].y });
  return (progress) => {
    const u = clamp(finite(progress), 0, 1);
    if (u === 0) return { x: points[0].x, y: points[0].y };
    if (u === 1) return { x: points.at(-1).x, y: points.at(-1).y };
    const target = length * u;
    let lo = 1;
    while (lo < table.length - 1 && table[lo].distance < target) lo++;
    const a = table[lo - 1], b = table[lo];
    const mix = b.distance > a.distance ? (target - a.distance) / (b.distance - a.distance) : 0;
    const segment = b.segment;
    const t0 = a.segment === segment ? a.t : 0;
    return raw(segment, t0 + (b.t - t0) * mix);
  };
}

export function sampleRoutineRoute(route, progress) {
  return createRoutineRouteSampler(route)(progress);
}

// Sample one station per subdivision, including both route endpoints. startCount is
// zero-based beats from the show's count origin; all stored time remains content-clock time.
export function sampleRoutineStations(route, { origin = 0, beatMs = 500, startCount = 0, beats = 4, subdivision = 1 } = {}) {
  const beat = Number(beatMs), span = Number(beats), div = Math.round(Number(subdivision));
  const start = Number(startCount), first = Number(origin);
  if (!Array.isArray(route) || !route.length || !(beat > 0) || !Number.isFinite(beat) || !(span > 0) || !Number.isFinite(span) || !(div > 0) || div > 16 || !Number.isFinite(start) || !Number.isFinite(first)) return [];
  const intervals = Math.min(2047, Math.ceil(span * div));
  const sampler = createRoutineRouteSampler(route);
  return Array.from({ length: intervals + 1 }, (_, i) => {
    const count = start + Math.min(span, i / div);
    const progress = (count - start) / span;
    const point = sampler(progress);
    return { id: `station-${i + 1}`, count, contentMs: Math.max(0, Math.round(first + count * beat)), x: point.x, y: point.y, keyframe: {} };
  });
}

export function loadRoutineDraft(storage = globalThis.localStorage) {
  try {
    const text = storage && storage.getItem(ROUTINE_DRAFT_KEY);
    return text ? normalizeRoutineDraft(JSON.parse(text)) : null;
  } catch { return null; }
}

export function saveRoutineDraft(draft, storage = globalThis.localStorage) {
  try {
    if (!storage) return false;
    storage.setItem(ROUTINE_DRAFT_KEY, JSON.stringify(normalizeRoutineDraft(draft)));
    return true;
  } catch { return false; }
}

export function clearRoutineDraft(storage = globalThis.localStorage) {
  try { if (!storage) return false; storage.removeItem(ROUTINE_DRAFT_KEY); return true; }
  catch { return false; }
}
