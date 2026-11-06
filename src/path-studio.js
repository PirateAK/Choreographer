// Path Studio: a full-screen plan for staging draft routes and checking the live show.
// Draft objects remain separate from state.show until an explicit Send action.

import {
  state, commit, persist, findObject, mirrorPathLeftRight,
  scanOverlaps, overlapFix, applyOverlapFix, pathsKey, CLEARANCE, displayOfContent,
  posOfContent, contentOfLocal, scanClothCrossings, clothCovers, clothDepth, scanPropClashes,
  createShow, addScenery, countGrid, localOfContent, holdsFor,
} from './model.js';
import { fmtTime } from './draw.js';
import {
  createRoutineDraft, normalizeRoutineDraft, loadRoutineDraft,
  saveRoutineDraft, createRoutineRouteSampler, sampleRoutineStations,
} from './routine-draft.js';

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 4;
const MARGIN = 44;

const ui = {
  open: false,
  hidden: new Set(),
  zoom: 1,
  deps: { rebuild: () => {} },
  scanKey: null,
  scan: [],
  reviewed: null,
  warnings: [],
  draft: null,
  draftLoaded: false,
  activeTool: 'select',
  drag: null,
  routeDraw: null,
  selectedStationId: null,
};

const DRAFT_COLORS = { prop: '#ff9f1c', curtain: '#8ac926', drop: '#4cc9f0' };
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

let root, canvas, ctx, castEl, warnEl, warnCount, subEl, scanButton, draftReviewEl;
let stageToolEl, draftDancerEl, obstacleKindEl, routeStartEl, routeBeatsEl, draftStatusEl;
let planTransform = null;


export function initPathStudio(deps) {
  ui.deps = { ...ui.deps, ...deps };
  root = document.getElementById('studio');
  canvas = document.getElementById('studioCanvas');
  castEl = document.getElementById('studioCast');
  warnEl = document.getElementById('studioWarn');
  draftReviewEl = document.getElementById('studioDraftReview');
  warnCount = document.getElementById('studioWarnCount');
  scanButton = document.getElementById('btnScanOverlaps');
  subEl = document.getElementById('studioSub');
  ctx = canvas.getContext('2d');

  stageToolEl = root.querySelector('.studio-toolbar');
  draftDancerEl = document.getElementById('studioDraftDancer');
  obstacleKindEl = document.getElementById('studioObstacleKind');
  routeStartEl = document.getElementById('studioRouteStart');
  routeBeatsEl = document.getElementById('studioRouteBeats');
  draftStatusEl = document.getElementById('studioDraftStatus');
  root.querySelector('#studioAddObstacle').addEventListener('click', () => addDraftObstacle());
  document.getElementById('studioSendDraft').addEventListener('click', sendDraftToShow);
  document.getElementById('studioSampleRoute').addEventListener('click', finishRoute);
  draftDancerEl.addEventListener('change', () => {
    ensureDraft();
    ui.draft.dancerId = draftDancerEl.value || null;
    saveDraft();
    renderPathStudio();
  });
  routeStartEl.addEventListener('change', () => { if (ui.draft?.route.length > 1 && ui.draft.stations.length) finishRoute(); });
  routeBeatsEl.addEventListener('change', () => { if (ui.draft?.route.length > 1 && ui.draft.stations.length) finishRoute(); });
  stageToolEl.addEventListener('click', (e) => {
    const button = e.target.closest('[data-tool]');
    if (!button) return;
    const selectedTool = button.dataset.tool;
    ui.activeTool = selectedTool === 'route' && ui.activeTool === 'route' ? 'select' : selectedTool;
    for (const item of stageToolEl.querySelectorAll('[data-tool]')) item.setAttribute('aria-pressed', String(item.dataset.tool === ui.activeTool));
    if (selectedTool === 'route' && ui.activeTool === 'select') finishRoute();
    else draftStatusEl.textContent = ui.activeTool === 'route' ? 'Click the plan to add route points; choose Draw route again when finished.' : '';
    renderPathStudio();
  });
  canvas.addEventListener('pointerdown', onPlanPointerDown);
  canvas.addEventListener('pointermove', onPlanPointerMove);
  canvas.addEventListener('pointerup', onPlanPointerUp);
  canvas.addEventListener('pointercancel', onPlanPointerUp);

  document.getElementById('btnStudio').addEventListener('click', () => (ui.open ? closePathStudio() : openPathStudio()));
  document.getElementById('studioClose').addEventListener('click', closePathStudio);
  document.getElementById('studioZoomIn').addEventListener('click', () => setZoom(ui.zoom * 1.3));
  document.getElementById('studioZoomOut').addEventListener('click', () => setZoom(ui.zoom / 1.3));
  document.getElementById('studioMirror').addEventListener('click', mirrorSelected);
  draftReviewEl.addEventListener('click', (e) => {
    const row = e.target.closest('[data-draft-warning]');
    if (!row) return;
    ui.selectedStationId = row.dataset.station;
    renderPathStudio();
  });
  scanButton.addEventListener('click', scanNow);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    setZoom(ui.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });

  castEl.addEventListener('click', (e) => {
    const eye = e.target.closest('[data-eye]');
    if (eye) {
      const id = eye.dataset.eye;
      if (ui.hidden.has(id)) ui.hidden.delete(id); else ui.hidden.add(id);
      renderPathStudio();
      return;
    }
    const row = e.target.closest('[data-dancer]');
    if (row) {
      state.ui.selectedId = row.dataset.dancer;
      state.ui.dirtyPanels = true;
      ui.deps.rebuild();
    }
  });

  warnEl.addEventListener('click', (e) => {
    const draftWarning = e.target.closest('[data-draft-warning]');
    if (draftWarning) {
      ui.selectedStationId = draftWarning.dataset.station;
      renderPathStudio();
      return;
    }
    const fix = e.target.closest('[data-fix]');
    if (fix) {
      applyStudioFix(fix.dataset.fix);
      return;
    }
    const row = e.target.closest('[data-warn]');
    if (row) focusWarning(row.dataset.warn);
  });
  warnEl.addEventListener('keydown', (e) => {
    if ((e.key !== 'Enter' && e.key !== ' ') || e.target.closest('[data-fix]')) return;
    const row = e.target.closest('[data-warn]');
    if (!row) return;
    e.preventDefault();
    focusWarning(row.dataset.warn);
  });

  document.addEventListener('keydown', (e) => {
    if (!ui.open || e.key !== 'Escape') return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    closePathStudio();
  });

  window.addEventListener('resize', () => ui.open && renderPathStudio());
}

export function openPathStudio() {
  ui.open = true;
  root.hidden = false;
  const draft = loadRoutineDraft();
  ui.draft = draft || createRoutineDraft({ dancerId: state.ui.selectedId || null });
  ui.draftLoaded = true;
  ui.selectedStationId = null;

  document.getElementById('btnStudio').setAttribute('aria-pressed', 'true');
  renderPathStudio();
}

export function closePathStudio() {
  ui.open = false;
  root.hidden = true;
  ui.routeDraw = null;
  document.getElementById('btnStudio').setAttribute('aria-pressed', 'false');
}

export function renderPathStudio() {
  if (!ui.open) return;
  const show = state.show;
  if (!ui.draftLoaded) {
    ui.draft = loadRoutineDraft() || createRoutineDraft({ dancerId: state.ui.selectedId || null });
    ui.draftLoaded = true;
  }
  renderCast(show);
  renderWarnings(show);
  renderDraftDancers(show);
  drawPlan(show);
  renderDraftStatus();
  renderDraftReview(show);
  const stations = ui.draft.stations.length;
  subEl.textContent = `${show.cast.filter((d) => (d.keys || []).length).length} dancers with paths · ${stations} draft stations · ${Math.round(ui.zoom * 100)}% zoom`;
}

function setZoom(z) {
  ui.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  renderPathStudio();
}

function mirrorSelected() {
  const d = findObject(state.show, state.ui.selectedId);
  if (!d || !state.show.cast.some((x) => x.id === d.id) || !(d.keys || []).length) {
    state.ui.hint = 'Select a dancer with a path to mirror';
    state.ui.dirtyPanels = true;
    ui.deps.rebuild();
    return;
  }
  commit();
  mirrorPathLeftRight(d);
  state.ui.hint = `Mirrored ${d.name || 'dancer'}'s path left to right across centre stage.`;
  ui.deps.rebuild();
}

function renderCast(show) {
  const selected = state.ui.selectedId;
  castEl.innerHTML = show.cast.map((d) => {
    const hidden = ui.hidden.has(d.id);
    const count = (d.keys || []).length;
    return `<div class="studio-row${d.id === selected ? ' on' : ''}${hidden ? ' off' : ''}" data-dancer="${d.id}">
      <span class="swatch" style="background:${d.color || '#888'}"></span>
      <span class="studio-name">${escapeHtml(d.name || `Dancer ${d.number || ''}`)}</span>
      <span class="studio-count">${count} pt${count === 1 ? '' : 's'}</span>
      <button class="eye" data-eye="${d.id}" aria-pressed="${!hidden}" title="${hidden ? 'Show this path' : 'Hide this path'}">${hidden ? '○' : '●'}</button>
    </div>`;
  }).join('') || '<p class="hint">No dancers yet.</p>';
}
function ensureDraft() {
  if (!ui.draft) ui.draft = createRoutineDraft({ dancerId: state.ui.selectedId || null });
  return ui.draft;
}

function saveDraft() {
  ui.draft = normalizeRoutineDraft(ensureDraft());
  saveRoutineDraft(ui.draft);
}

function renderDraftDancers(show) {
  if (!draftDancerEl) return;
  draftDancerEl.innerHTML = '<option value="">Unassigned draft</option>' + (show.cast || []).map((d) =>
    `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name || `Dancer ${d.number || ''}`)}${(d.keys || []).length ? ' · existing routine' : ''}</option>`
  ).join('');
  const valid = (show.cast || []).some((d) => d.id === ui.draft?.dancerId);
  draftDancerEl.value = valid ? ui.draft.dancerId : '';
  if (!valid && ui.draft?.dancerId) { ui.draft.dancerId = null; saveDraft(); }
}

function renderDraftStatus() {
  if (!draftStatusEl || !ui.draft) return;
  draftStatusEl.textContent = `${ui.draft.obstacles.length} draft obstacles · ${ui.draft.route.length} route points · ${ui.draft.stations.length} beat stations`;
  const send = document.getElementById('studioSendDraft');
  if (send) send.disabled = !ui.draft.dancerId || ui.draft.stations.length < 2 || !ui.draft.stations.some((s) => Object.keys(s.keyframe || {}).length);
  const editor = document.getElementById('studioKeyframeEditor');
  const station = ui.draft.stations.find((s) => s.id === ui.selectedStationId);
  if (!editor) return;
  if (!station) { editor.innerHTML = '<p class="hint">Draw a route, then select a station on the plan to edit its ballet keyframe.</p>'; return; }
  const key = station.keyframe || {};
  const options = (values, selected) => values.map(([value, text]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${text}</option>`).join('');
  editor.innerHTML = `<p class="hint">Station ${ui.draft.stations.indexOf(station) + 1} · ${(station.contentMs / 1000).toFixed(2)}s</p>
    <label>Pose <select id="draftPose">${options([['none','— none —'],['first','1st position'],['second','2nd position'],['third','3rd position'],['fourth','4th position'],['fifth','5th position'],['tendu','Tendu'],['plie','Plié'],['releve','Relevé'],['arabesque','Arabesque'],['attitude','Attitude'],['pirouette','Pirouette']], key.pose || 'none')}</select></label>
    <label>Step <select id="draftStep">${options([['walk','Walk'],['chasse','Chassé'],['pas-de-bourree','Pas de bourrée'],['pirouette','Pirouette']], key.step || 'walk')}</select></label>
    <label>Level <select id="draftLevel">${options([['flat','Flat'],['demi','Demi-pointe'],['pointe','En pointe'],['air','In the air']], key.level || 'flat')}</select></label>
    <button id="draftSaveKeyframe" class="view-btn">Save keyframe</button>`;
  document.getElementById('draftSaveKeyframe').addEventListener('click', () => {
    station.keyframe = { pose: document.getElementById('draftPose').value, step: document.getElementById('draftStep').value, level: document.getElementById('draftLevel').value };
    saveDraft(); renderPathStudio();
  });
}


function renderDraftReview(show) {
  if (!draftReviewEl || !ui.draft?.stations.length) { if (draftReviewEl) draftReviewEl.innerHTML = ''; return; }
  const draft = ui.draft;
  const results = [];
  for (const station of draft.stations) {
    for (const other of (show.cast || [])) {
      if (other.id === draft.dancerId || !(other.keys || []).length) continue;
      const p = posOfContent(show, other, station.contentMs);
      if (!p) continue;
      const gap = Math.hypot(p.x - station.x, p.y - station.y);
      if (gap < CLEARANCE) results.push({ station, name: other.name || 'Dancer', gap });
    }
    for (const obstacle of [...draft.obstacles, ...(show.scenery || []).filter((s) => s.kind === 'prop')]) {
      if (obstacle.kind !== 'prop') continue;
      const dx = Math.max(Math.abs(station.x - obstacle.x) - obstacle.w / 2, 0);
      const dy = Math.max(Math.abs(station.y - obstacle.y) - obstacle.d / 2, 0);
      if (Math.hypot(dx, dy) < 0.35) results.push({ station, name: obstacle.name || 'prop', gap: null });
    }
  }
  const unique = [...new Map(results.map((r) => [`${r.station.id}:${r.name}`, r])).values()];
  draftReviewEl.innerHTML = '<p class="hint">Draft station checks · sampled points only</p>' + (unique.map((r) => `<div class="studio-row warn" data-warn="draft-${r.station.id}" role="button" tabindex="0" data-draft-warning="1" data-station="${r.station.id}"><span class="studio-name">Station ${draft.stations.indexOf(r.station) + 1} near ${escapeHtml(r.name)}</span><span class="studio-count">${r.gap == null ? 'review clearance' : `${r.gap.toFixed(2)} m`}</span></div>`).join('') || '<p class="hint">No sampled station conflicts with dancers or props. Route segments and flown scenery still need review.</p>');
}

function addDraftObstacle(point = null) {
  const show = state.show;
  if (ensureDraft().obstacles.length >= 256) {
    draftStatusEl.textContent = 'Draft obstacle limit reached.';
    return null;
  }
  const kind = ['prop', 'curtain', 'drop'].includes(obstacleKindEl.value) ? obstacleKindEl.value : 'prop';
  const template = createShow();
  template.stage = { ...template.stage, ...show.stage };
  template.scenery = [];
  const obstacle = addScenery(template, kind);
  obstacle.id = `draft-${obstacle.id}`;
  if (point) { obstacle.x = point.x; obstacle.y = point.y; }
  ensureDraft().obstacles.push(obstacle);
  saveDraft();
  ui.activeTool = 'select';
  stageToolEl.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === 'select')));
  draftStatusEl.textContent = `${obstacle.name} added to the draft only. Drag it on the plan to position it.`;
  renderPathStudio();
  return obstacle;
}

function finishRoute() {
  ui.routeDraw = null;
  const draft = ensureDraft();
  const startCount = Math.max(0, Math.round(Number(routeStartEl.value) || 0));
  const beats = Math.max(1, Math.min(256, Number(routeBeatsEl.value) || 8));
  const grid = countGrid(state.show);
  draft.stations = sampleRoutineStations(draft.route, { origin: grid.origin, beatMs: grid.count, startCount, beats });
  ui.selectedStationId = draft.stations[0]?.id || null;
  saveDraft();
  draftStatusEl.textContent = draft.route.length < 2 ? 'Add at least two route points to sample stations.' : `${draft.stations.length} beat stations sampled. Add the ballet keyframes next.`;
  renderPathStudio();
}

function stagePointFromEvent(event) {
  if (!planTransform) return null;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left - planTransform.cx) / planTransform.s;
  const y = (planTransform.base - (event.clientY - rect.top)) / planTransform.s;
  const halfDepth = planTransform.sd / 2;
  return { x: clamp(x, -planTransform.sw / 2 - planTransform.wings, planTransform.sw / 2 + planTransform.wings), y: clamp(y, -halfDepth, planTransform.sd + halfDepth) };
}
function sendDraftToShow() {
  const draft = ensureDraft();
  const dancer = (state.show.cast || []).find((d) => d.id === draft.dancerId);
  if (!dancer || !draft.stations.length) return;
  const occupied = (dancer.keys || []).length > 0;
  const oldKeys = (dancer.keys || []).map((key) => ({ ...key }));
  const oldLocalData = {
    footTrajectory: dancer.footTrajectory ? structuredClone(dancer.footTrajectory) : null,
    holds: holdsFor(state.show, dancer.id).length,
  };
  if (occupied) {
    const preview = oldKeys.length > 3 ? `${oldKeys.length} existing keys` : 'existing choreography';
    const choice = window.prompt(`${dancer.name || 'This dancer'} has ${preview}. Type REPLACE to replace this dancer’s full routine, or enter another dancer’s name/number/ID to assign the draft instead.`);
    if (choice !== 'REPLACE') {
      const alternate = state.show.cast.find((d) => d.id === choice || String(d.number) === choice || String(d.name || '').toLowerCase() === String(choice || '').toLowerCase());
      if (alternate && alternate.id !== dancer.id) {
        draft.dancerId = alternate.id; saveDraft(); renderPathStudio();
        draftStatusEl.textContent = `Draft assigned to ${alternate.name || 'another dancer'}. Send again to stage.`;
      } else draftStatusEl.textContent = 'Send canceled. Type REPLACE exactly to confirm replacing choreography, or choose a different dancer.';
      return;
    }
  }
  const start = draft.stations[0].contentMs;
  const end = draft.stations.at(-1).contentMs;
  if (occupied && (oldLocalData.footTrajectory || oldLocalData.holds) && !window.confirm('This routine also owns local foot choreography or holds. Replace the dancer’s full routine, including those items?')) {
    draftStatusEl.textContent = 'Send canceled. Draft and show were left unchanged.';
    return;
  }
  commit();
  const liveDancer = state.show.cast.find((d) => d.id === dancer.id);
  const newKeys = draft.stations.map((s, i) => {
    const local = Math.max(0, localOfContent(state.show, liveDancer.id, s.contentMs));
    return {
      t: local, x: s.x, y: s.y,
      ...(s.keyframe || {}),
      ...(i === draft.stations.length - 1 ? { phraseEnd: true } : {}),
    };
  });
  liveDancer.keys = newKeys.sort((a, b) => a.t - b.t);
  if (occupied) {
    delete liveDancer.footTrajectory;
    delete liveDancer.footTrajectoryRange;
    state.show.markers = (state.show.markers || []).filter((m) => !(m.kind === 'hold' && m.trackId === dancer.id));
  }
  for (const staged of draft.obstacles) {
    addScenery(state.show, staged.kind);
    const added = state.show.scenery.at(-1);
    Object.assign(added, staged, { id: added.id, cues: Array.isArray(staged.cues) ? staged.cues : [] });
  }
  persist();
  draft.stations = []; draft.route = []; draft.obstacles = [];
  ui.routeDraw = null; ui.activeTool = 'select'; ui.selectedStationId = null;
  saveDraft();
  closePathStudio();
  draftStatusEl.textContent = 'Routine and draft scenery sent to the show. Undo restores the previous routine and scenery.';
  ui.deps.rebuild();
}


function onPlanPointerDown(event) {
  if (event.button !== 0) return;
  const point = stagePointFromEvent(event);
  if (!point) return;
  if (ui.activeTool === 'route') {
    if (!ui.routeDraw) { ui.routeDraw = []; ensureDraft().stations = []; }
    if (ui.routeDraw.length >= 512) return;
    ui.routeDraw.push(point);
    ensureDraft().route = ui.routeDraw.map((p, i, a) => ({ ...p, u: a.length > 1 ? i / (a.length - 1) : 0 }));
    saveDraft();
    renderPathStudio();
  } else if (ui.activeTool === 'obstacle') {
    const obstacle = addDraftObstacle(point);
    if (obstacle) { obstacle.x = point.x; obstacle.y = point.y; }
    saveDraft(); renderPathStudio();
  } else {
    const station = [...(ui.draft?.stations || [])].reverse().find((s) => Math.hypot(point.x - s.x, point.y - s.y) <= Math.max(0.16, 9 / planTransform.s));
    if (station) {
      ui.selectedStationId = station.id;
      renderPathStudio();
      return;
    }
    const obstacle = [...ensureDraft().obstacles].reverse().find((o) => Math.abs(point.x - o.x) <= o.w / 2 && Math.abs(point.y - o.y) <= o.d / 2);
    if (obstacle) {
      ui.drag = { id: obstacle.id, offsetX: point.x - obstacle.x, offsetY: point.y - obstacle.y };
      canvas.setPointerCapture(event.pointerId);
    }
  }
}

function onPlanPointerMove(event) {
  if (!ui.drag) return;
  const p = stagePointFromEvent(event);
  const obstacle = ensureDraft().obstacles.find((o) => o.id === ui.drag.id);
  if (!p || !obstacle) return;
  obstacle.x = p.x - ui.drag.offsetX;
  obstacle.y = p.y - ui.drag.offsetY;
  drawPlan(state.show);
}

function onPlanPointerUp() {
  if (!ui.drag) return;
  ui.drag = null;
  saveDraft();
  renderPathStudio();
}


function currentScan(show) {
  const key = pathsKey(show);
  if (key !== ui.scanKey) {
    ui.scan = scanOverlaps(show);
    ui.scanKey = key;
    if (ui.reviewed && ui.reviewed.key !== key) ui.reviewed.stale = true;
  }
  return ui.scan;
}

function currentOverlapScan() {
  const reviewed = ui.reviewed;
  if (!reviewed || reviewed.stale || reviewed.key !== pathsKey(state.show)) return null;
  return reviewed.list;
}

function scanNow() {
  const show = state.show;
  const key = pathsKey(show);
  const list = scanOverlaps(show).map((o) => ({ ...o, fix: overlapFix(show, o) }));
  ui.scan = list;
  ui.scanKey = key;
  ui.reviewed = { list, key, stale: false };
  renderPathStudio();
}

function applyStudioFix(id) {
  const list = currentOverlapScan();
  const overlap = list && list.find((o) => o.id === id);
  if (!overlap || !overlap.fix) return;
  const label = overlap.fix.label;
  commit();
  applyOverlapFix(state.show, overlap.fix);
  persist();
  scanNow();
  state.ui.hint = `Fixed: ${label} · Undo puts the path back`;
  ui.deps.rebuild();
}

function focusWarning(id) {
  const o = ui.warnings.find((x) => x.id === id);
  if (!o) return;
  state.ui.playhead = o.at;
  const dancerId = o.ids?.[0] || o.dancerId;
  if (dancerId) state.ui.selectedId = dancerId;
  state.ui.dirtyPanels = true;
  ui.deps.rebuild();
}

function renderWarnings(show) {
  const scan = currentScan(show);
  const curtains = scanClothCrossings(show);
  const props = (show.scenery || []).filter((s) => s.kind === 'prop').flatMap((p) => scanPropClashes(show, p));
  const all = [...scan, ...curtains, ...props].sort((a, b) => a.at - b.at);
  ui.warnings = all;
  const reviewed = currentOverlapScan();
  const fresh = !ui.reviewed || !!reviewed;
  scanButton.textContent = ui.reviewed ? (reviewed ? 'Rescan overlaps' : 'Scan again') : 'Find overlaps';
  scanButton.title = ui.reviewed && !reviewed ? 'Paths changed since the last scan; run a fresh scan before applying a fix' : 'Scan the whole running order for dancer-to-dancer overlaps';
  warnCount.textContent = `${all.length}${ui.reviewed && !fresh ? ' · stale' : ''}`;
  warnEl.innerHTML = all.map((o) => {
    if (o.sceneryId) {
      const d = findObject(show, o.dancerId);
      const who = escapeHtml((d && d.name) || 'Dancer');
      const isProp = o.kind === 'prop';
      const what = isProp ? 'on path' : (o.kind === 'curtain' ? 'curtain closed' : (o.kind === 'screen' ? 'screen hanging' : 'drop hanging'));
    return `<div class="studio-row warn curtain" data-warn="${o.id}" role="button" tabindex="0">
      <span class="studio-name">${who} ${isProp ? 'at' : 'through'} ${escapeHtml(o.name)}</span>
      <span class="studio-count">${(o.at / 1000).toFixed(2)} s · ${what}</span>
    </div>`;
    }
    const fix = reviewed && reviewed.find((x) => x.id === o.id)?.fix;
    return renderOverlapWarning(o, fix);
  }).join('') || '<p class="hint">No path conflicts found. Run Find overlaps for a whole-show dancer scan.</p>';
}

function renderOverlapWarning(o, fix) {
  const show = state.show;
  const names = o.ids.map((id) => {
    const d = (show.cast || []).find((x) => x.id === id);
    return d ? d.name : '?';
  });
  const at = fmtTime(displayOfContent(show, o.at));
  return `<div class="studio-row warn curtain" data-warn="${o.id}" role="button" tabindex="0" aria-label="${escapeStudioHtml(names.join(' and '))}, ${escapeStudioHtml(at)}, ${o.gap.toFixed(2)} metres apart">
    <span class="studio-name">${names.map(escapeStudioHtml).join(' &amp; ')}</span>
    <span class="studio-count">${escapeStudioHtml(at)} · ${o.gap.toFixed(2)} m</span>
    ${fix ? `<span class="studio-fix-label">${escapeStudioHtml(fix.label)}</span><button class="view-btn studio-fix" data-fix="${o.id}" title="Apply this fix — Undo restores the path">Fix</button>` : '<span class="studio-fix-label">Run Find overlaps to see fixes</span>'}
  </div>`;
}

function escapeStudioHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}


// Plan coordinates: x across the stage (centre at 0), y upstage from the proscenium at 0.
// The canvas draws the audience at the bottom, so y grows upward on screen.
function drawPlan(show) {
  const dpr = window.devicePixelRatio || 1;
  const box = canvas.getBoundingClientRect();
  const w = Math.max(1, box.width);
  const h = Math.max(1, box.height);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const stage = show.stage || {};
  const sw = Number(stage.width) || 12;
  const sd = Number(stage.depth) || 8;
  const wings = Number(stage.wingDepth) || 0;
  const grid = Number(stage.grid) || 0.5;
  const fit = Math.min((w - MARGIN * 2) / (sw + wings * 2), (h - MARGIN * 2) / sd);
  const s = fit * ui.zoom;
  const cx = w / 2;
  const base = h - MARGIN;
  const toX = (x) => cx + x * s;
  const toY = (y) => base - y * s;
  planTransform = { cx, base, s, sw, sd, wings };

  // Stage floor and the wings either side.
  ctx.fillStyle = '#0d121a';
  ctx.fillRect(toX(-sw / 2 - wings), toY(sd), (sw + wings * 2) * s, sd * s);
  ctx.fillStyle = '#11161f';
  ctx.fillRect(toX(-sw / 2), toY(sd), sw * s, sd * s);
  ctx.strokeStyle = '#202a39';
  ctx.lineWidth = 1;
  for (let x = -sw / 2; x <= sw / 2 + 1e-6; x += grid) {
    ctx.beginPath(); ctx.moveTo(toX(x), toY(0)); ctx.lineTo(toX(x), toY(sd)); ctx.stroke();
  }
  for (let y = 0; y <= sd + 1e-6; y += grid) {
    ctx.beginPath(); ctx.moveTo(toX(-sw / 2), toY(y)); ctx.lineTo(toX(sw / 2), toY(y)); ctx.stroke();
  }
  ctx.strokeStyle = '#3a4a60';
  ctx.strokeRect(toX(-sw / 2), toY(sd), sw * s, sd * s);
  ctx.fillStyle = '#6f7f96';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('AUDIENCE', cx - 30, h - 14);

  // Paths for every dancer that is shown.
  for (const d of show.cast) {
    if (ui.hidden.has(d.id) || !(d.keys || []).length) continue;
    const keys = [...d.keys].sort((a, b) => a.t - b.t);
    const selected = d.id === state.ui.selectedId;
    ctx.strokeStyle = d.color || '#888';
    ctx.globalAlpha = selected ? 1 : 0.55;
    ctx.lineWidth = selected ? 2.5 : 1.5;
    ctx.beginPath();
    keys.forEach((k, i) => (i ? ctx.lineTo(toX(k.x), toY(k.y)) : ctx.moveTo(toX(k.x), toY(k.y))));
    ctx.stroke();
    ctx.fillStyle = d.color || '#888';
    for (const k of keys) {
      ctx.beginPath(); ctx.arc(toX(k.x), toY(k.y), selected ? 4 : 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Cloth: the parts that cover the stage at the playhead, drawn as bars at their depth, and
  // each crossing the list reports as a cross.
  const now = state.ui.playhead || 0;
  // Draft route and beat stations are deliberately rendered outside the live show paths.
  const draft = ui.draft;
  if (draft?.route?.length) {
    ctx.save();
    ctx.beginPath();
    const sampler = createRoutineRouteSampler(draft.route);
    const samples = Math.max(24, draft.route.length * 16);
    for (let i = 0; i <= samples; i++) {
      const p = sampler(i / samples);
      if (i) ctx.lineTo(toX(p.x), toY(p.y)); else ctx.moveTo(toX(p.x), toY(p.y));
    }
    ctx.strokeStyle = '#61c5a5'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]); ctx.stroke(); ctx.setLineDash([]);
    for (const p of draft.route) {
      ctx.fillStyle = '#61c5a5'; ctx.beginPath(); ctx.arc(toX(p.x), toY(p.y), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const [i, p] of draft.stations.entries()) {
      const selected = p.id === ui.selectedStationId;
      ctx.fillStyle = selected ? '#ffb703' : '#f3e9ce'; ctx.strokeStyle = '#18202d'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(toX(p.x), toY(p.y), selected ? 6 : 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (i % Math.max(1, Math.ceil(draft.stations.length / 24)) === 0) {
        ctx.fillStyle = '#c9d4e3'; ctx.font = '10px system-ui, sans-serif'; ctx.fillText(String(i + 1), toX(p.x) + 6, toY(p.y) - 5);
      }
    }
    ctx.restore();
  }
  if (ui.routeDraw?.length) {
    ctx.strokeStyle = '#61c5a5'; ctx.lineWidth = 3; ctx.setLineDash([3, 3]); ctx.beginPath();
    ui.routeDraw.forEach((p, i) => i ? ctx.lineTo(toX(p.x), toY(p.y)) : ctx.moveTo(toX(p.x), toY(p.y)));
    ctx.stroke(); ctx.setLineDash([]);
  }
  for (const obstacle of draft?.obstacles || []) {
    ctx.save();
    if (obstacle.kind === 'curtain' || obstacle.kind === 'drop') {
      ctx.strokeStyle = DRAFT_COLORS[obstacle.kind] || '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(toX(obstacle.x - obstacle.w / 2), toY(obstacle.y)); ctx.lineTo(toX(obstacle.x + obstacle.w / 2), toY(obstacle.y)); ctx.stroke();
      ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(toX(obstacle.x - obstacle.w / 2), toY(obstacle.y) - 3); ctx.lineTo(toX(obstacle.x + obstacle.w / 2), toY(obstacle.y) - 3); ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.translate(toX(obstacle.x), toY(obstacle.y));
      ctx.strokeStyle = DRAFT_COLORS[obstacle.kind] || '#fff'; ctx.lineWidth = 2;
      ctx.fillStyle = `${DRAFT_COLORS[obstacle.kind] || '#fff'}44`;
      ctx.fillRect(-obstacle.w * s / 2, -obstacle.d * s / 2, obstacle.w * s, obstacle.d * s);
      ctx.strokeRect(-obstacle.w * s / 2, -obstacle.d * s / 2, obstacle.w * s, obstacle.d * s);
      ctx.setLineDash([4, 3]); ctx.strokeRect(-obstacle.w * s / 2 - 3, -obstacle.d * s / 2 - 3, obstacle.w * s + 6, obstacle.d * s + 6); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  ctx.strokeStyle = '#ffb703';
  ctx.lineWidth = 3;
  for (const c of (show.scenery || []).filter((s) => s.kind === 'curtain' || s.kind === 'drop')) {
    const y = clothDepth(c);
    let run = null;
    for (let x = -sw; x <= sw + 1e-6; x += 0.1) {
      const on = clothCovers(c, now, x);
      if (on && run === null) run = x;
      if (!on && run !== null) {
        ctx.beginPath(); ctx.moveTo(toX(run), toY(y)); ctx.lineTo(toX(x - 0.1), toY(y)); ctx.stroke();
        run = null;
      }
    }
    if (run !== null) { ctx.beginPath(); ctx.moveTo(toX(run), toY(y)); ctx.lineTo(toX(sw), toY(y)); ctx.stroke(); }
  }
  ctx.strokeStyle = '#ffb703';
  ctx.lineWidth = 2;
  for (const o of ui.warnings) {
    if (!o.sceneryId) continue;
    const r = 5;
    ctx.beginPath();
    ctx.moveTo(toX(o.x) - r, toY(o.y) - r); ctx.lineTo(toX(o.x) + r, toY(o.y) + r);
    ctx.moveTo(toX(o.x) + r, toY(o.y) - r); ctx.lineTo(toX(o.x) - r, toY(o.y) + r);
    ctx.stroke();
  }

  // Clashes: a dashed ring at each performer's place at the moment of closest approach.
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = '#ff4d6d';
  ctx.lineWidth = 1.5;
  for (const o of currentScan(show)) {
    for (const id of o.ids) {
      const d = findObject(show, id);
      const p = d && posOfContent(show, d, o.at);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(toX(p.x), toY(p.y), (CLEARANCE / 2) * s, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
