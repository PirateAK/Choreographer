// Path studio: a full-screen plan for drawing and checking dancers' paths. It reads the
// same show as the main window; its eyes only change what this view shows, and its
// warnings are the whole-show scan, so a clash stays listed whether or not its path is shown.

import {
  state, commit, findObject, mirrorPathLeftRight, scanOverlaps,
  posOfContent, pathsKey, CLEARANCE,
} from './model.js';

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
};

let root, canvas, ctx, castEl, warnEl, warnCount, subEl;

export function initPathStudio(deps) {
  ui.deps = { ...ui.deps, ...deps };
  root = document.getElementById('studio');
  canvas = document.getElementById('studioCanvas');
  castEl = document.getElementById('studioCast');
  warnEl = document.getElementById('studioWarn');
  warnCount = document.getElementById('studioWarnCount');
  subEl = document.getElementById('studioSub');
  ctx = canvas.getContext('2d');

  document.getElementById('btnStudio').addEventListener('click', () => (ui.open ? closePathStudio() : openPathStudio()));
  document.getElementById('studioClose').addEventListener('click', closePathStudio);
  document.getElementById('studioZoomIn').addEventListener('click', () => setZoom(ui.zoom * 1.3));
  document.getElementById('studioZoomOut').addEventListener('click', () => setZoom(ui.zoom / 1.3));
  document.getElementById('studioMirror').addEventListener('click', mirrorSelected);

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
    const row = e.target.closest('[data-warn]');
    if (!row) return;
    const o = ui.scan.find((x) => x.id === row.dataset.warn);
    if (!o) return;
    state.ui.playhead = o.at;
    state.ui.selectedId = o.ids[0];
    state.ui.dirtyPanels = true;
    ui.deps.rebuild();
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
  document.getElementById('btnStudio').setAttribute('aria-pressed', 'true');
  renderPathStudio();
}

export function closePathStudio() {
  ui.open = false;
  root.hidden = true;
  document.getElementById('btnStudio').setAttribute('aria-pressed', 'false');
}

export function renderPathStudio() {
  if (!ui.open) return;
  const show = state.show;
  renderCast(show);
  renderWarnings(show);
  drawPlan(show);
  subEl.textContent = `${show.cast.filter((d) => (d.keys || []).length).length} dancers with paths · ${Math.round(ui.zoom * 100)}% zoom`;
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

function currentScan(show) {
  const key = pathsKey(show);
  if (key !== ui.scanKey) {
    ui.scan = scanOverlaps(show);
    ui.scanKey = key;
  }
  return ui.scan;
}

function renderWarnings(show) {
  const scan = currentScan(show);
  warnCount.textContent = scan.length ? String(scan.length) : 'none';
  warnEl.innerHTML = scan.map((o) => {
    const names = o.ids.map((id) => {
      const d = findObject(show, id);
      return escapeHtml((d && d.name) || 'Dancer');
    }).join(' & ');
    const gap = (o.gap || 0).toFixed(2);
    return `<div class="studio-row warn" data-warn="${o.id}" role="button" tabindex="0">
      <span class="studio-name">${names}</span>
      <span class="studio-count">${(o.at / 1000).toFixed(2)} s · ${gap} m</span>
    </div>`;
  }).join('') || '<p class="hint">No two dancers come within ' + CLEARANCE + ' m.</p>';
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
