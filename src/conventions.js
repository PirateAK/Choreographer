// School conventions: the values a school or teacher sets for the positions, kept apart from the
// pose code. Each entry records the value the code uses today (the best-case default, so nothing
// moves until a school edits a row), the unit, the anatomical reference, and whether the solver
// applies it yet. An entry marked `applied: false` is recorded for the teacher and is not used by
// the pose yet; it must not be presented as if it changes the drawing.
//
// Overrides are kept in browser storage under one versioned key, beside the view preferences. They
// are never part of a show file, and no media is stored here.

export const CONVENTIONS_KEY = 'choreographer.conventions.v1';

// `kind: 'rise'` is a height in body units (1 = dancer height), read by specOf and the levels.
// `kind: 'note'` is free text the school writes down for an item the solver does not read yet.
export const CONVENTIONS = [
  {
    id: 'level.demi', kind: 'rise', applied: true, value: 0.03, min: 0, max: 0.1,
    label: 'Demi-pointe level', unit: 'body height', reference: 'floor to the ball of the foot, standing foot',
    note: 'Level rise on demi-pointe, used by the cheat sheet and every station with level demi.',
  },
  {
    id: 'level.pointe', kind: 'rise', applied: true, value: 0.06, min: 0, max: 0.1,
    label: 'Pointe level', unit: 'body height', reference: 'floor to the ball of the foot, standing foot',
    note: 'Level rise on pointe, used by the cheat sheet and every station with level pointe.',
  },
  {
    id: 'releve.rise', kind: 'rise', pose: 'releve', applied: true, value: 0.03, min: 0, max: 0.1,
    label: 'Relevé', unit: 'body height', reference: 'floor to the ball of the foot, both feet',
    note: 'Heel lifted, weight on the balls of the feet. Zero is the floor contact.',
  },
  {
    id: 'pirouette.rise', kind: 'rise', pose: 'pirouette', applied: true, value: 0.06, min: 0, max: 0.1,
    label: 'Pirouette preparation', unit: 'body height', reference: 'floor to the ball of the foot, standing foot',
    note: 'Rise on one pointe before a turn.',
  },
  {
    id: 'arabesque.rise', kind: 'rise', pose: 'arabesque', applied: true, value: 0.03, min: 0, max: 0.1,
    label: 'Arabesque standing foot', unit: 'body height', reference: 'floor to the ball of the foot, standing foot',
    note: 'Rise of the standing foot in arabesque.',
  },
  {
    id: 'attitude.rise', kind: 'rise', pose: 'attitude', applied: true, value: 0.03, min: 0, max: 0.1,
    label: 'Attitude standing foot', unit: 'body height', reference: 'floor to the ball of the foot, standing foot',
    note: 'Rise of the standing foot in attitude.',
  },
  {
    id: 'pas-de-bourree.rise', kind: 'rise', pose: 'pas-de-bourree', applied: true, value: 0.02, min: 0, max: 0.1,
    label: 'Pas de bourrée', unit: 'body height', reference: 'floor to the ball of the foot, foot on the pointe behind',
    note: 'Pending the syllabus: confirm the value and whether it is demi-pointe or pointe.',
  },
  {
    id: 'plie.depth', kind: 'note', applied: false, value: '42.7° hip from vertical (contact-constrained)',
    label: 'Plié depth', unit: 'degrees (thigh from vertical)', reference: 'hip joint to knee; thigh-to-floor = 90 − value',
    note: 'The current value is the solution that keeps flat feet on the floor, not a chosen depth. Grand plié is thighs horizontal (90). Applying a depth needs a solver re-solve.',
  },
  {
    id: 'arabesque.elevation', kind: 'note', applied: false, value: '90° working leg, horizontal behind',
    label: 'Arabesque elevation', unit: 'degrees above horizontal behind', reference: 'hip joint to working ankle',
    note: 'Recorded for the school line. Arm and body shape decide what the line means. Applying a different height needs a solver change.',
  },
  {
    id: 'attitude.knee', kind: 'note', applied: false, value: 'thigh level behind, knee 90°, foot below knee',
    label: 'Attitude knee height', unit: 'degrees at the knee; height relative to the hip', reference: 'hip, knee, ankle',
    note: 'Knee sits above the pointed foot. Confirm the school knee height.',
  },
  {
    id: 'fourth.geometry', kind: 'note', applied: false, value: 'not defined',
    label: 'Fourth position', unit: 'text', reference: 'turnout, spacing, crossed or parallel feet',
    note: 'Define the school geometry before the solver changes the shape. Contacts currently match the earlier version.',
  },
];

const BY_ID = Object.fromEntries(CONVENTIONS.map((c) => [c.id, c]));

// Overrides only: an id present here is the school's value, anything else uses the default.
let overrides = loadOverrides();

function storage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch (e) {
    return null; // storage blocked: the table still works for this session
  }
}

function loadOverrides() {
  const store = storage();
  if (!store) return {};
  try {
    const saved = JSON.parse(store.getItem(CONVENTIONS_KEY) || '{}');
    const clean = {};
    for (const [id, value] of Object.entries(saved || {})) {
      const checked = validate(id, value);
      if (checked.ok) clean[id] = checked.value;
    }
    return clean;
  } catch (e) {
    return {};
  }
}

function persist() {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(CONVENTIONS_KEY, JSON.stringify(overrides));
  } catch (e) {
    /* storage full or blocked: the value still applies for this session */
  }
}

// A value is accepted only inside the range the entry declares. Nothing is clamped silently:
// a school value outside the range is refused with a reason the table can show.
export function validate(id, value) {
  const entry = BY_ID[id];
  if (!entry) return { ok: false, reason: 'Unknown convention' };
  if (entry.kind === 'rise') {
    const n = typeof value === 'number' ? value : Number(value);
    if (value === '' || value === null || !Number.isFinite(n)) return { ok: false, reason: 'Enter a number' };
    if (n < entry.min || n > entry.max) return { ok: false, reason: `Keep between ${entry.min} and ${entry.max}` };
    return { ok: true, value: n };
  }
  const text = String(value ?? '').trim();
  if (text.length > 500) return { ok: false, reason: 'Keep notes under 500 characters' };
  return { ok: true, value: text };
}

// The value the pose uses: the school's override when set, otherwise the default recorded above.
export function conventionValue(id) {
  if (Object.prototype.hasOwnProperty.call(overrides, id)) return overrides[id];
  return BY_ID[id] ? BY_ID[id].value : undefined;
}

// The rise a pose uses, or undefined when the pose has no convention row.
export function riseFor(poseId) {
  const entry = CONVENTIONS.find((c) => c.kind === 'rise' && c.pose === poseId);
  return entry ? conventionValue(entry.id) : undefined;
}

export function setConvention(id, value) {
  const checked = validate(id, value);
  if (!checked.ok) return checked;
  overrides = { ...overrides, [id]: checked.value };
  persist();
  return { ok: true, value: checked.value };
}

export function resetConvention(id) {
  if (!Object.prototype.hasOwnProperty.call(overrides, id)) return;
  const next = { ...overrides };
  delete next[id];
  overrides = next;
  persist();
}

export function conventionRows() {
  return CONVENTIONS.map((c) => {
    const school = Object.prototype.hasOwnProperty.call(overrides, c.id);
    return { ...c, value: conventionValue(c.id), defaultValue: c.value, source: school ? 'school' : 'default' };
  });
}
