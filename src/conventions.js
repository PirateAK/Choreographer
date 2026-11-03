// School conventions: the values a school or teacher sets for the positions, kept apart from the
// pose code. Each row carries:
//   value                   the value the pose uses (a provisional preset, or null when unset)
//   unit                    the unit the value is written in
//   measurement_reference   what the number measures, and from which anatomical point
//   status                  'provisional' (preview preset, needs school review),
//                           'school-approved' (the school has signed off), or 'unset' (no value)
//   school_method           the system or syllabus the row is written against, if known
//   applied                 whether the pose reads the value now. A row with applied: false is
//                           recorded for the teacher and must not be presented as changing the drawing.
//
// Provisional values drive the preview only. Results built on them are not school-correct until the
// school reviews them. Overrides are stored in browser storage under one versioned key; they are
// never part of a show file, and no media is stored here.

export const CONVENTIONS_KEY = 'choreographer.conventions.v1';

// kind 'rise'    a height in body units (1 = dancer height), read by specOf and the levels
// kind 'measure' a number that is recorded and may be unset (null)
// kind 'note'    free text for a setting that is not a single number
export const CONVENTIONS = [
  {
    id: 'level.demi', kind: 'rise', applied: true, value: 0.03, min: 0, max: 0.1, status: 'provisional',
    label: 'Demi-pointe level', unit: 'body height (1 = dancer height)',
    measurement_reference: 'vertical distance from the floor to the ball-of-foot contact, standing foot',
    school_method: 'Provisional. Cheat-sheet and station level.',
  },
  {
    id: 'level.pointe', kind: 'rise', applied: true, value: 0.06, min: 0, max: 0.1, status: 'provisional',
    label: 'Pointe level', unit: 'body height (1 = dancer height)',
    measurement_reference: 'vertical distance from the floor to the ball-of-foot contact, standing foot',
    school_method: 'Provisional. Cheat-sheet and station level.',
  },
  {
    id: 'releve.rise', kind: 'rise', pose: 'releve', applied: true, value: 0.03, min: 0, max: 0.1, status: 'provisional',
    label: 'Relevé', unit: 'body height (1 = dancer height)',
    measurement_reference: 'vertical distance from the floor to the ball-of-foot contact point during relevé, both feet',
    school_method: 'Provisional. Earlier HEAD value 0.010 kept in resume notes as a prior, not used.',
  },
  {
    id: 'pirouette.rise', kind: 'rise', pose: 'pirouette', applied: true, value: 0.06, min: 0, max: 0.1, status: 'provisional',
    label: 'Pirouette preparation', unit: 'body height (1 = dancer height)',
    measurement_reference: 'vertical distance from the floor to the ball-of-foot contact, standing foot',
    school_method: 'Provisional. Rise on one pointe before a turn.',
  },
  {
    id: 'arabesque.rise', kind: 'rise', pose: 'arabesque', applied: true, value: 0.03, min: 0, max: 0.1, status: 'provisional',
    label: 'Arabesque standing foot', unit: 'body height (1 = dancer height)',
    measurement_reference: 'vertical distance from the floor to the ball-of-foot contact, standing foot',
    school_method: 'Provisional.',
  },
  {
    id: 'attitude.rise', kind: 'rise', pose: 'attitude', applied: true, value: 0.03, min: 0, max: 0.1, status: 'provisional',
    label: 'Attitude standing foot', unit: 'body height (1 = dancer height)',
    measurement_reference: 'vertical distance from the floor to the ball-of-foot contact, standing foot',
    school_method: 'Provisional.',
  },
  {
    id: 'pas-de-bourree.rise', kind: 'rise', pose: 'pas-de-bourree', applied: true, value: 0.02, min: 0, max: 0.1, status: 'provisional',
    label: 'Pas de bourrée', unit: 'body height (1 = dancer height)',
    measurement_reference: 'vertical distance from the floor to the ball of the foot on the pointe behind',
    school_method: 'Pending the syllabus. Confirm value and whether demi-pointe or pointe.',
  },
  {
    id: 'plie.depth', kind: 'measure', applied: false, value: 42.7, min: 0, max: 90, status: 'provisional',
    label: 'Plié depth (demi preset)', unit: 'degrees from vertical',
    measurement_reference: 'thigh angle from vertical at the hip, hip joint to knee; thigh-to-floor = 90 − value',
    school_method: 'Provisional demi-plié preset. The current 42.7 is the contact-constrained solution, not a depth chosen for ballet. Kept separate from floor contact. The solver does not read it yet.',
  },
  {
    id: 'arabesque.elevation', kind: 'measure', applied: false, value: 90, min: 0, max: 180, status: 'provisional',
    label: 'Arabesque elevation (optional target)', unit: 'degrees from straight down',
    measurement_reference: 'working leg, hip joint to ankle, angle from straight down; 90 = horizontal behind',
    school_method: 'Optional target, not the definition of every school’s arabesque. The solver does not read it yet.',
  },
  {
    id: 'arabesque.arms', kind: 'note', applied: false, value: 'Current preview arm set', status: 'provisional',
    label: 'Arabesque arm configuration', unit: 'text',
    measurement_reference: 'arm angles at shoulder and elbow; named by the school',
    school_method: 'Set separately from elevation because the named arabesque and arm shape depend on the system.',
  },
  {
    id: 'attitude.knee_height', kind: 'measure', applied: false, value: null, min: -0.3, max: 0.3, status: 'unset',
    label: 'Attitude knee height', unit: 'body height, positive above the hip',
    measurement_reference: 'height of the working knee relative to the hip joint',
    school_method: 'Unset. Not inferred from the knee bend angle, which describes a different part of the pose.',
  },
  {
    id: 'fourth.turnout', kind: 'measure', applied: false, value: null, min: 0, max: 180, status: 'unset',
    label: 'Fourth position turnout', unit: 'degrees',
    measurement_reference: 'angle of each foot from the line of travel; 0 = parallel',
    school_method: 'Unset. Turnout is not universally fixed across systems.',
  },
  {
    id: 'fourth.spacing', kind: 'measure', applied: false, value: null, min: 0, max: 1, status: 'unset',
    label: 'Fourth position front-to-back spacing', unit: 'body height (1 = dancer height)',
    measurement_reference: 'distance from the heel of the front foot to the toe of the back foot, front-to-back',
    school_method: 'Unset. Spacing is not universally fixed across systems.',
  },
  {
    id: 'fourth.feet', kind: 'note', applied: false, value: 'Crossed, turned out (preview preset)', status: 'provisional',
    label: 'Fourth position foot orientation', unit: 'text',
    measurement_reference: 'whether the feet are crossed or parallel to the line of travel, each foot',
    school_method: 'Provisional conventional preview preset. Label kept until the school defines the shape.',
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
// a value outside the range is refused with a reason the table can show.
export function validate(id, value) {
  const entry = BY_ID[id];
  if (!entry) return { ok: false, reason: 'Unknown convention' };
  if (entry.kind === 'note') {
    const text = String(value ?? '').trim();
    if (text.length > 500) return { ok: false, reason: 'Keep notes under 500 characters' };
    return { ok: true, value: text };
  }
  if (value === '' || value === null || value === undefined) return { ok: false, reason: 'Enter a number' };
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return { ok: false, reason: 'Enter a number' };
  if (n < entry.min || n > entry.max) return { ok: false, reason: `Keep between ${entry.min} and ${entry.max}` };
  return { ok: true, value: n };
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
