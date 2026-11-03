// School conventions: the values a school or teacher sets for the positions, kept apart from the
// pose code. Each row carries:
//   value                   the value the pose uses (a provisional preset, or null when unset)
//   unit                    the unit the value is written in
//   measurement_reference   what the number measures, and from which anatomical point
//   status                  the default status: 'provisional' (preview preset, needs school review)
//                           or 'unset' (no value). Approval is recorded separately (see statusOf).
//   school_method           the system or syllabus the row is written against, if known
//   applied                 whether the pose reads the value now. A row with applied: false is
//                           recorded for the teacher and must not be presented as changing the drawing.
//
// Status shown in the table and in test output:
//   unset             no value
//   provisional       a value is in use (a preset, or a school-entered value not yet approved)
//   school-approved   the school approved this exact value; a later change withdraws the approval
//
// Provisional values drive the preview only. Results built on them are not school-correct until the
// school approves the row. Overrides, approvals, and the approver name are stored in browser storage
// under one versioned key; they are never part of a show file, and no media is stored here.

export const CONVENTIONS_KEY = 'choreographer.conventions.v2';

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
    id: 'plie.depth', kind: 'measure', applied: true, value: 42.68, min: 17.9, max: 90, status: 'provisional',
    label: 'Plié hip depth (preview target)', unit: 'degrees from vertical',
    measurement_reference: 'thigh angle from vertical at the hip, hip joint to knee; thigh-to-floor = 90 − value',
    school_method: 'Preview target. 42.68 is the current contact-constrained baseline, not a school depth. The solver re-solves knee and body sink to keep flat feet on the floor. Below about 17.9° the solved body would lift the ankles onto the ball of the foot, so the minimum is 17.9 (the flat-foot limit is 17.86).',
  },
  {
    id: 'arabesque.elevation', kind: 'measure', applied: false, value: 90, min: 0, max: 180, status: 'provisional',
    label: 'Arabesque elevation (optional target)', unit: 'degrees from straight down',
    measurement_reference: 'working leg, hip joint to ankle, angle from straight down; 90 = horizontal behind',
    school_method: 'Optional provisional target, not the definition of every school’s arabesque. The solver does not read it yet.',
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

// Overrides: `values` holds the school's entered values; `approvals` holds the approval record
// { value, by, at } for a row, where `value` is the exact value approved. `approver` is the name
// typed in the table, used for the next approval.
let state = loadState();

function storage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch (e) {
    return null; // storage blocked: the table still works for this session
  }
}

function loadState() {
  const empty = { values: {}, approvals: {}, approver: '' };
  const store = storage();
  if (!store) return empty;
  try {
    const saved = JSON.parse(store.getItem(CONVENTIONS_KEY) || '{}') || {};
    const values = {};
    for (const [id, value] of Object.entries(saved.values || {})) {
      const checked = validate(id, value);
      if (checked.ok) values[id] = checked.value;
    }
    const approvals = {};
    for (const [id, rec] of Object.entries(saved.approvals || {})) {
      if (!BY_ID[id] || !rec || typeof rec.by !== 'string' || typeof rec.at !== 'string') continue;
      approvals[id] = { value: rec.value, by: rec.by.slice(0, 80), at: rec.at };
    }
    const approver = typeof saved.approver === 'string' ? saved.approver.slice(0, 80) : '';
    return { values, approvals, approver };
  } catch (e) {
    return empty;
  }
}

function persist() {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(CONVENTIONS_KEY, JSON.stringify(state));
  } catch (e) {
    /* storage full or blocked: the value still applies for this session */
  }
}

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

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

// The value the pose uses: the school's entry when set, otherwise the default recorded above.
export function conventionValue(id) {
  if (has(state.values, id)) return state.values[id];
  return BY_ID[id] ? BY_ID[id].value : undefined;
}

// The rise a pose uses, or undefined when the pose has no convention row.
export function riseFor(poseId) {
  const entry = CONVENTIONS.find((c) => c.kind === 'rise' && c.pose === poseId);
  return entry ? conventionValue(entry.id) : undefined;
}

// unset: no value. school-approved: the approved value is the value in use. provisional: a value is
// in use that the school has not approved (a preset, or an entry not yet approved, or an approval
// withdrawn because the value changed).
export function statusOf(id) {
  const value = conventionValue(id);
  if (value === null || value === undefined) return 'unset';
  const rec = state.approvals[id];
  if (rec && rec.value === value) return 'school-approved';
  return 'provisional';
}

export function setConvention(id, value) {
  const checked = validate(id, value);
  if (!checked.ok) return checked;
  state = { ...state, values: { ...state.values, [id]: checked.value } };
  persist();
  return { ok: true, value: checked.value };
}

export function resetConvention(id) {
  if (!has(state.values, id)) return;
  const values = { ...state.values };
  delete values[id];
  state = { ...state, values };
  persist();
}

export function getApprover() {
  return state.approver;
}

export function setApprover(name) {
  state = { ...state, approver: String(name ?? '').trim().slice(0, 80) };
  persist();
}

// Approves the value in use for a row. The approval records that exact value, the approver's name,
// and the time, so a later change to the value withdraws the approval.
export function approveConvention(id, now = new Date()) {
  if (!BY_ID[id]) return { ok: false, reason: 'Unknown convention' };
  const value = conventionValue(id);
  if (value === null || value === undefined) return { ok: false, reason: 'Set a value before approving' };
  if (!state.approver) return { ok: false, reason: 'Enter the approver name first' };
  const approvals = { ...state.approvals, [id]: { value, by: state.approver, at: now.toISOString() } };
  state = { ...state, approvals };
  persist();
  return { ok: true };
}

export function revokeApproval(id) {
  if (!has(state.approvals, id)) return;
  const approvals = { ...state.approvals };
  delete approvals[id];
  state = { ...state, approvals };
  persist();
}

export function conventionRows() {
  return CONVENTIONS.map((c) => {
    const school = has(state.values, c.id);
    const value = conventionValue(c.id);
    const rec = state.approvals[c.id] || null;
    const stale = !!rec && rec.value !== value;
    return {
      ...c,
      value,
      defaultValue: c.value,
      source: school ? 'school' : 'default',
      status: statusOf(c.id),
      approval: rec && !stale ? { by: rec.by, at: rec.at } : null,
      approvalWithdrawn: stale,
    };
  });
}

// What the preview is running on. Used by the table banner and by test output, so provisional and
// school-approved values are never reported as one thing.
export function previewSummary() {
  const rows = conventionRows();
  return {
    provisionalInUse: rows.filter((r) => r.applied && r.status === 'provisional').map((r) => r.id),
    approvedInUse: rows.filter((r) => r.applied && r.status === 'school-approved').map((r) => r.id),
    recordedOnly: rows.filter((r) => !r.applied && r.status !== 'unset').map((r) => r.id),
    unset: rows.filter((r) => r.status === 'unset').map((r) => r.id),
  };
}
