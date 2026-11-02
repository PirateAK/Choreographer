// The printable side of a show: a stage plot for the crew, one path per
// performer with numbered stations, and a cue sheet. It reads the same saved
// show the planner writes, so nothing has to be exported first.
//
// Everything is drawn as plain SVG sized in plan metres, so a printout is to
// scale and the numbers on it (depths, widths, station positions) are the same
// numbers the panel shows.

import {
  state, restore, displayOfContent, contentOfDisplay, contentOfLocal, localOfContent, posOfContent, endDisplay, endContent,
  clothX, clothSpan, clothDepth, clothThick, curtainLegW, wingBays, sceneryStateAt, musicSpan,
  propPosOfContent, POSE_LABEL, STEP_LABEL, LEVEL_LABEL, EASE_LABEL, levelOf, levelBlend, actRanges, actAt, sceneRanges, sceneAt, legPoints,
  endMarker, activeMusicAt, LIGHT_TYPES, LIGHT_GOBOS, GEL_NAMES, costumeOf, poseOfContent, plantsOf,
  footAtLocal, footPins, feetOnFloor, rolesOf, roleOf,
} from './model.js';
import { specOf, blendSpecs, poseSvg } from './pose.js';

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Paper is read at a glance, so tenths of a second are plenty and the hour is
// not worth the width.
function clock(ms) {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}

// A paper copy of a plan gets superseded, so it says when it was made.
const printDate = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Metres, with a real minus sign: stage left reads as −2.4, not hyphens.
const m1 = (v) => {
  const n = Math.round(Number(v) * 10) / 10;
  return (Object.is(n, -0) ? 0 : n).toFixed(1).replace('-', '−');
};

// The same colour, mixed towards white, for a fill on white paper.
function tint(hex, f = 0.8) {
  const h = String(hex || '#888888').replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  if (!Number.isFinite(n)) return '#eeeeee';
  const part = (shift) => {
    const c = (n >> shift) & 255;
    return Math.round(c + (255 - c) * f);
  };
  return '#' + [part(16), part(8), part(0)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// A dancer's colour is chosen for a dark screen; on white paper it needs to be
// darker to stay legible, without losing which performer it belongs to.
function shade(hex, f = 0.45) {
  const h = String(hex || '#888888').replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  if (!Number.isFinite(n)) return '#444444';
  const part = (shift) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * f)));
  return '#' + [part(16), part(8), part(0)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* --------------------------------------------------------------- geometry */

// One frame for every plan on the page: metres in, SVG units out, with the
// proscenium at the bottom of the drawing so the audience reads as below it.
function frame(show, width) {
  const st = show.stage;
  const padX = 1.9;
  const padTop = 2.4;
  const padBottom = 2.8;
  const worldW = st.width + 2 * st.wingDepth + padX * 2;
  const worldH = st.depth + padTop + padBottom;
  const k = width / worldW;
  return {
    st,
    k,
    width,
    height: worldH * k,
    X: (x) => (x + st.width / 2 + st.wingDepth + padX) * k,
    Y: (y) => (st.depth - y + padTop) * k,
  };
}

const rect = (x, y, w, h, fill, stroke, sw = 1) =>
  `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(0, w).toFixed(2)}" height="${Math.max(0, h).toFixed(2)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`;

const line = (x1, y1, x2, y2, stroke, sw = 1, dash = '') =>
  `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} />`;

function svg(f, body) {
  return `<svg viewBox="0 0 ${f.width.toFixed(1)} ${f.height.toFixed(1)}" preserveAspectRatio="xMidYMid meet" role="img">` +
    `<style>
       .lbl { font: 600 11px "Segoe UI", system-ui, sans-serif; fill: #23262b; }
       .dim { font: 8.5px "Segoe UI", system-ui, sans-serif; fill: #7d7a72; }
       .cap { font: 8px "Segoe UI", system-ui, sans-serif; fill: #6d6a62; letter-spacing: 1.4px; }
       .num { font: 600 9px "Segoe UI", system-ui, sans-serif; fill: #23262b; }
       .e-cap { font: 7.5px "Segoe UI", system-ui, sans-serif; fill: #6d6a62; letter-spacing: 1.2px; }
       .e-num { font: 600 8px "Segoe UI", system-ui, sans-serif; fill: #23262b; }
     </style>` + body.join('') + '</svg>';
}

/* ------------------------------------------------------------ plan layers */

// The floor, its wings, the grid and the centre line. Nothing that belongs to
// a particular show lives here.
function base(show, f) {
  const { st, k } = f;
  const half = st.width / 2;
  const out = [];

  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -half - st.wingDepth : half;
    out.push(rect(f.X(x0), f.Y(st.depth), st.wingDepth * k, st.depth * k, '#f4f2ed', '#cbc7bf', 0.9));
  }
  out.push(rect(f.X(-half), f.Y(st.depth), st.width * k, st.depth * k, '#ffffff', '#8d8a82', 1.2));

  // A metre grid, dropped when the drawing gets too small for it to help.
  if (k >= 9) {
    for (let x = -half + 1; x < half - 0.01; x += 1) out.push(line(f.X(x), f.Y(st.depth), f.X(x), f.Y(0), '#efedE7', 0.7));
    for (let y = 1; y < st.depth - 0.01; y += 1) out.push(line(f.X(-half), f.Y(y), f.X(half), f.Y(y), '#efedE7', 0.7));
  }
  out.push(line(f.X(0), f.Y(st.depth), f.X(0), f.Y(0), '#c6c2b9', 1, '5 4'));
  return out;
}

// Metre numbers along the front edge and up the stage-left side, so a station
// can be read off the paper with a tape measure.
function edgeRules(show, f) {
  const { st } = f;
  const half = st.width / 2;
  const out = [];
  for (let x = -half; x <= half + 0.01; x += 1) {
    out.push(line(f.X(x), f.Y(0), f.X(x), f.Y(0) + 4, '#b9b5ac', 0.9));
    if (x % 2 === 0) {
      out.push(`<text x="${f.X(x).toFixed(1)}" y="${(f.Y(0) + 13).toFixed(1)}" class="dim" text-anchor="middle">${x === 0 ? 'CL' : m1(Math.abs(x))}</text>`);
    }
  }
  const leftEdge = f.X(-half - st.wingDepth);
  for (let y = 0; y <= st.depth + 0.01; y += 1) {
    out.push(line(leftEdge - 4, f.Y(y), leftEdge, f.Y(y), '#b9b5ac', 0.9));
    if (y % 2 === 0) {
      out.push(`<text x="${(leftEdge - 7).toFixed(1)}" y="${(f.Y(y) + 3).toFixed(1)}" class="dim" text-anchor="end">${m1(y)}</text>`);
    }
  }
  return out;
}

// Which way the drawing faces. A plan printed for a crew is useless without it.
function orientation(show, f) {
  const { st } = f;
  const half = st.width / 2;
  const top = f.Y(st.depth) - 12;
  const out = [];
  out.push(`<text x="${f.X(0).toFixed(1)}" y="${top.toFixed(1)}" class="cap" text-anchor="middle">UPSTAGE</text>`);
  out.push(`<text x="${f.X(-half - st.wingDepth / 2).toFixed(1)}" y="${top.toFixed(1)}" class="cap" text-anchor="middle">STAGE LEFT</text>`);
  out.push(`<text x="${f.X(half + st.wingDepth / 2).toFixed(1)}" y="${top.toFixed(1)}" class="cap" text-anchor="middle">STAGE RIGHT</text>`);
  out.push(`<text x="${f.X(0).toFixed(1)}" y="${(f.height - 8).toFixed(1)}" class="cap" text-anchor="middle">AUDIENCE</text>`);

  // A two-metre scale bar, bottom left.
  const barY = f.height - 12;
  const barX = f.X(-half - st.wingDepth);
  out.push(line(barX, barY, barX + 2 * f.k, barY, '#23262b', 1.6));
  out.push(line(barX, barY - 3, barX, barY + 3, '#23262b', 1.2));
  out.push(line(barX + 2 * f.k, barY - 3, barX + 2 * f.k, barY + 3, '#23262b', 1.2));
  out.push(`<text x="${(barX + f.k).toFixed(1)}" y="${(barY - 5).toFixed(1)}" class="dim" text-anchor="middle">2 m</text>`);
  return out;
}

function wingLegs(show, f) {
  const { st, k } = f;
  const half = st.width / 2;
  const len = Math.max(1.2, Math.min(2.0, st.wingDepth * 0.5));
  const thick = 0.34;
  const out = [];
  for (const side of [-1, 1]) {
    for (const bay of wingBays(show, side)) {
      if (bay.hi - bay.lo < 0.6) continue;
      const cx = f.X(side < 0 ? -half - st.wingDepth * 0.82 : half + st.wingDepth * 0.82);
      const cy = f.Y((bay.lo + bay.hi) / 2);
      out.push(`<text transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(-90)" class="dim" text-anchor="middle">${esc(bay.name)}</text>`);
    }
  }
  for (const leg of show.wingLegs) {
    const x0 = leg.side < 0 ? -half - len : half;
    out.push(rect(f.X(x0), f.Y(leg.y + thick / 2), len * k, thick * k, '#dcd8d0', '#8d8a82', 0.9));
  }
  return out;
}

// Curtains and drops as they stand when the show opens; `faint` reduces them to
// outlines so a path stays the loudest thing on the page.
// `ct` is when the sheet is drawn: 0 for the plot of the opening, the end of the
// show for the curtain call. Everything on this page is a function of that moment.
function cloth(show, f, faint, ct = 0) {
  const { k } = f;
  const out = [];
  const items = show.scenery
    .filter((s) => s.kind !== 'prop')
    .slice()
    .sort((a, b) => clothDepth(a) - clothDepth(b));

  for (const item of items) {
    const y = clothDepth(item);
    const cx = clothX(item);
    const span = clothSpan(item);
    const thick = clothThick(item);
    const now = sceneryStateAt(item, ct);
    const fill = faint ? 'none' : '#f0ebdf';
    const stroke = faint ? '#d8d4cc' : '#6f6757';

    if (item.kind === 'card') {
      // A card is a board in front of the house: on the plan it is a thin band at
      // its depth, carrying the words the audience reads. Off stage, nothing.
      const shown = Math.max(0, Math.min(1, now.shown));
      if (shown <= 0.02) continue;
      const x0 = cx - span / 2;
      out.push(rect(f.X(x0), f.Y(y + thick), span * k, thick * k, '#efe8d6', '#6f6757', 1));
      if (!faint) {
        out.push(`<text x="${f.X(cx).toFixed(1)}" y="${(f.Y(y + thick) - 4).toFixed(1)}" class="lbl" text-anchor="middle">${esc(item.text || item.name)}</text>`);
      }
      continue;
    }

    if (item.kind === 'drop') {
      const fly = Number.isFinite(now.fly) ? now.fly : 1;
      const x0 = cx - span / 2;
      if (fly >= 0.02) {
        out.push(rect(f.X(x0), f.Y(y + thick), span * k, thick * k, fill, stroke, 1));
        if (!faint) {
          const seams = Math.max(4, Math.round(span / 0.3));
          for (let i = 1; i < seams; i++) {
            const sx = f.X(x0 + (span / seams) * i);
            out.push(line(sx, f.Y(y + thick) + 1, sx, f.Y(y) - 1, '#b9b09c', 0.5));
          }
        }
      }
      if (!faint) {
        const note = fly < 0.02 ? ' (flown out)' : fly < 0.98 ? ` (${Math.round(fly * 100)}% in)` : '';
        out.push(`<text x="${f.X(cx).toFixed(1)}" y="${(f.Y(y + thick) - 4).toFixed(1)}" class="lbl" text-anchor="middle">${esc(item.name)}${note}</text>`);
      }
      continue;
    }

    const legW = curtainLegW(span, Number.isFinite(now.open) ? now.open : 1);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? cx - span / 2 : cx + span / 2 - legW;
      out.push(rect(f.X(x0), f.Y(y + thick), legW * k, thick * k, fill, stroke, 1));
    }
    if (!faint) {
      out.push(`<text x="${f.X(cx).toFixed(1)}" y="${(f.Y(y + thick) - 4).toFixed(1)}" class="lbl" text-anchor="middle">${esc(item.name)}</text>`);
    }
  }
  return out;
}

// Eyes are a viewing aid for the planner, not a change to the show, so the paper
// prints everyone and everything — a hidden performer is still in the cast.
function props(show, f, faint, ct = 0) {
  const { k } = f;
  const out = [];
  for (const s of show.scenery) {
    if (s.kind !== 'prop') continue;
    const p = propPosOfContent(show, s, ct) || { x: s.x, y: s.y };
    const fill = faint ? 'none' : '#fbf6e6';
    const stroke = faint ? '#ddd9d0' : '#8a7a4a';
    out.push(rect(f.X(p.x - s.w / 2), f.Y(p.y + s.d), s.w * k, s.d * k, fill, stroke, 1));
    if (!faint) {
      out.push(`<text x="${f.X(p.x).toFixed(1)}" y="${(f.Y(p.y + s.d) - 4).toFixed(1)}" class="dim" text-anchor="middle">${esc(s.name)}</text>`);
    }
  }
  return out;
}

// Feet on paper, under the body and under the station circle, exactly as the plan draws them: a
// cross where a foot is on the deck and carrying her, a small open ring for the other foot when it
// is down too, and nothing at all for a foot the position has in the air — a contact point is
// where the floor is being stood on, and a lifted foot is not one. `idx` is the station she is
// standing on, whose plant is the foot she is leaving on.
function footMarks(show, f, dancer, lt, idx) {
  const keys = dancer.keys || [];
  if (!keys.length) return [];
  const plant = plantsOf(dancer)[idx] || { name: 'both' };
  if (plant.name === 'air') return [];
  const ink = shade(dancer.color, 0.5);
  // The same feet the plan draws: the contact she is standing on, held where she put it, rather than
  // wherever the pose would have carried it along the path.
  const feet = feetOnFloor(show, dancer, lt);
  const out = [];
  for (const side of ['left', 'right']) {
    const foot = feet[side];
    if (!foot || foot.h > 0.12) continue;
    const x = f.X(foot.x);
    const y = f.Y(foot.y);
    if (foot.held) {
      const arm = 3.4;
      out.push(
        `<path d="M${(x - arm).toFixed(1)} ${y.toFixed(1)}L${(x + arm).toFixed(1)} ${y.toFixed(1)}" stroke="${ink}" stroke-width="2" />` +
          `<path d="M${x.toFixed(1)} ${(y - arm).toFixed(1)}L${x.toFixed(1)} ${(y + arm).toFixed(1)}" stroke="${ink}" stroke-width="2" />`
      );
    } else {
      // A foot that is down but not carrying her is drawn open: it is the one she can move.
      out.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.9" fill="none" stroke="${ink}" stroke-width="1" opacity="0.75" />`
      );
    }
  }
  return out;
}

// Where everyone stands at a moment: the top of the show on the plot, the last
// moment on the curtain call.
function castAt(show, f, ct = 0) {
  const out = [];
  for (const d of show.cast) {
    const p = posOfContent(show, d, ct);
    if (!p) continue;
    const x = f.X(p.x);
    const y = f.Y(p.y);
    // Her feet first: they belong under her, and the station circle is drawn over them.
    const keys = d.keys || [];
    if (keys.length) {
      const lt = localOfContent(show, d.id, ct);
      let idx = 0;
      for (let i = 0; i < keys.length; i++) if (keys[i].t <= lt) idx = i;
      out.push(...footMarks(show, f, d, lt, idx));
    }
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="#fff" stroke="${shade(d.color)}" stroke-width="2" />`);
    out.push(`<text x="${x.toFixed(1)}" y="${(y + 3.2).toFixed(1)}" class="num" text-anchor="middle">${d.number}</text>`);
    out.push(`<text x="${(x + 13).toFixed(1)}" y="${(y + 3).toFixed(1)}" class="dim">${esc(d.name)}</text>`);
  }
  return out;
}

// One performer's walk: their stations joined in order, numbered to match the
// table beneath.
function walk(show, dancer, f) {
  const keys = dancer.keys || [];
  const out = [];
  if (!keys.length) return out;
  const ink = shade(dancer.color, 0.5);
  // The same bowed legs the plan draws, sampled, so a printed path is the path they walk.
  const line = [];
  keys.forEach((k, i) => {
    if (!i) line.push(k);
    else line.push(...legPoints(keys[i - 1], k, 10).slice(1));
  });
  const pts = line.map((k) => `${f.X(k.x).toFixed(1)},${f.Y(k.y).toFixed(1)}`).join(' ');
  if (keys.length > 1) {
    out.push(`<polyline points="${pts}" fill="none" stroke="${ink}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`);
  }
  const numbered = keys.length <= 30;
  // Her feet on the floor at each station, before the station's own circle is laid over them: the
  // same picture the plan draws, and the reason the table beside it has a Plant column.
  keys.forEach((k, i) => out.push(...footMarks(show, f, dancer, k.t, i)));
  keys.forEach((k, i) => {
    const x = f.X(k.x);
    const y = f.Y(k.y);
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${numbered ? 8.5 : 4}" fill="#fff" stroke="${ink}" stroke-width="2" />`);
    if (numbered) out.push(`<text x="${x.toFixed(1)}" y="${(y + 3.2).toFixed(1)}" class="num" text-anchor="middle">${i + 1}</text>`);
  });
  return out;
}

/* ---------------------------------------------------------- elevation */

// The opening and the dancer height are stage settings; each piece of cloth
// carries its own height, so a border can hang at 3 m beside an 8 m backdrop.
const openingOf = (show) => (Number.isFinite(show.stage.openingH) ? show.stage.openingH : 7.5);
const dancerHeightOf = (show) => (Number.isFinite(show.stage.dancerH) ? show.stage.dancerH : 1.7);

// Falls back to a house-plausible height only for a show that predates item heights.
function clothHeight(show, item) {
  const h = Number(item.h);
  if (Number.isFinite(h)) return Math.max(0.5, Math.min(20, h));
  const opening = openingOf(show);
  return item.kind === 'drop' ? Math.max(1, opening * 0.8) : Math.max(2, opening - 1.1);
}

// How a piece hangs at a moment in the show: a curtain from the deck, a drop
// from wherever its fly has left it.
function clothExtent(show, item, ct) {
  const now = sceneryStateAt(item, ct);
  const h = clothHeight(show, item);
  const opening = openingOf(show);
  if (item.kind === 'drop') {
    const fly = Math.max(0, Math.min(1, Number.isFinite(now.fly) ? now.fly : 1));
    const bottom = (1 - fly) * opening;
    return { bottom, top: bottom + h, h, fly, out: fly <= 0.02, open: 1 };
  }
  const open = Number.isFinite(now.open) ? now.open : 1;
  return { bottom: 0, top: h, h, fly: 1, out: false, open: Math.max(0, Math.min(1, open)) };
}

// Height in drawing units, width across the opening. A sliver above the header
// exists so the picture can say where the audience's sight stops.
function elevFrame(show, width) {
  const st = show.stage;
  const opening = openingOf(show);
  const worldTop = opening + 0.9;
  const padL = 54;
  const padR = 14;
  const padTop = 22;
  const padBottom = 34;
  const k = (width - padL - padR) / (st.width + 1.2);
  return {
    st, k, opening, worldTop, width,
    height: worldTop * k + padTop + padBottom,
    X: (x) => padL + (st.width / 2 + x + 0.6) * k,
    Y: (z) => padTop + (worldTop - z) * k,
  };
}

// A square is scenery (table below), a circle is a performer (cast key below), so
// the two numbering systems on one drawing cannot be confused.
function tagMark(x, y, n, shape) {
  if (!n) return '';
  const mark = shape === 'square'
    ? `<rect x="${(x - 7).toFixed(1)}" y="${(y - 7).toFixed(1)}" width="14" height="14" rx="2" fill="#ffffff" stroke="#23262b" stroke-width="1" />`
    : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="#ffffff" stroke="#23262b" stroke-width="1" />`;
  return mark + `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" class="e-num" text-anchor="middle">${n}</text>`;
}

// The deck, the opening and the height scale: the frame every height is read
// against.
function elevBase(show, f) {
  const { st, k } = f;
  const half = st.width / 2;
  const l = f.X(-half);
  const r = f.X(half);
  const deck = f.Y(0);
  const head = f.Y(f.opening);
  const out = [];

  out.push(rect(l, f.Y(f.worldTop), r - l, head - f.Y(f.worldTop), '#faf8f3', '#e6e2da', 0.8));
  out.push(rect(l, head, r - l, deck - head, '#ffffff', '#c1bdb5', 0.8));
  out.push(rect(f.X(-half - 0.6), deck, (st.width + 1.2) * k, 0.3 * k, '#eceae3', '#8d8a82', 1));

  // Metres above the deck, up the stage-left side.
  const rx = l - 12;
  out.push(line(rx, deck, rx, head, '#b9b5ac', 1));
  for (let z = 0; z <= Math.ceil(f.opening); z++) {
    const at = Math.min(z, f.opening);
    out.push(line(rx - 4, f.Y(at), rx, f.Y(at), '#b9b5ac', 0.9));
    out.push(`<text x="${(rx - 7).toFixed(1)}" y="${(f.Y(at) + 3).toFixed(1)}" class="dim" text-anchor="end">${m1(at)}</text>`);
    if (at >= f.opening - 0.01) break;
  }
  out.push(`<text x="${(rx - 7).toFixed(1)}" y="${(head - 12).toFixed(1)}" class="e-cap" text-anchor="end">m</text>`);
  out.push(`<text x="${(l + 5).toFixed(1)}" y="${(head - 6).toFixed(1)}" class="e-cap">OUT OF SIGHT ABOVE HERE</text>`);
  return out;
}

// Curtains are two legs within their own span; drops are one sheet, lifted by
// their fly. Both are cut at the header, as the audience sees them.
function elevCloth(show, f, item, tag, marks, ct) {
  const e = clothExtent(show, item, ct);
  const k = f.k;
  const bottom = Math.max(0, Math.min(e.bottom, f.opening));
  const top = Math.min(e.top, f.opening);
  const out = [];
  if (top - bottom < 0.04) return out;

  const y0 = f.Y(top);
  const hgt = (top - bottom) * k;
  const fill = tint(item.color, 0.84);
  const ink = shade(item.color, 0.7);
  const span = clothSpan(item);

  if (item.kind === 'card') {
    // A board standing on the deck, read as the house reads it.
    if (sceneryStateAt(item, ct).shown <= 0.02) return out;
    const x0 = f.X(clothX(item) - span / 2);
    const w = span * k;
    out.push(rect(x0, y0, w, hgt, '#efe8d6', '#6f6757', 1));
    const words = String(item.text || '');
    if (words && w > 40) {
      out.push(`<text x="${(x0 + w / 2).toFixed(1)}" y="${(y0 + hgt / 2 + 3).toFixed(1)}" class="lbl" text-anchor="middle">${esc(words)}</text>`);
    }
    marks.push({ x: x0 + 9, y: y0 + 9, n: tag, shape: 'square' });
    return out;
  }

  if (item.kind === 'drop') {
    const x0 = f.X(clothX(item) - span / 2);
    const w = span * k;
    out.push(rect(x0, y0, w, hgt, fill, ink, 1));
    const seams = Math.max(4, Math.round(span / 0.45));
    for (let i = 1; i < seams; i++) {
      const sx = x0 + (w / seams) * i;
      out.push(line(sx, y0 + 1, sx, y0 + hgt - 1, shade(item.color, 0.9), 0.6));
    }
    marks.push({ x: x0 + 9, y: y0 + 9, n: tag, shape: 'square' });
    return out;
  }

  const legW = curtainLegW(span, e.open);
  const cx = clothX(item);
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? cx - span / 2 : cx + span / 2 - legW;
    const px = f.X(x0);
    const w = legW * k;
    out.push(rect(px, y0, w, hgt, fill, ink, 1));
    const folds = Math.max(2, Math.round(legW / 0.35));
    for (let i = 1; i < folds; i++) {
      const fx = px + (w / folds) * i;
      out.push(line(fx, y0 + 1, fx, y0 + hgt - 1, shade(item.color, 0.9), 0.6));
    }
    if (side < 0) marks.push({ x: px + 9, y: y0 + 9, n: tag, shape: 'square' });
  }
  return out;
}

// The same dancer the planner draws, in the position the station carries, with their
// cast number above the head. The paper has to agree with the screen: a cue sheet that
// shows a fifth while the dancer is in arabesque is a sheet the crew cannot trust.
function elevDancer(show, f, d, p, marks, ct) {
  const k = f.k;
  const height = dancerHeightOf(show);
  const x = f.X(p.x);
  const feet = f.Y(0);
  // On paper the costume keeps its colour but is darkened enough to print, because the
  // crew dresses the cast by sight.
  const cos = costumeOf(show, d);
  const body = cos ? cos.body : d.color;
  const at = poseOfContent(show, d, ct);
  // The level on paper matters as much as on screen: a crew reading heights needs to see
  // who is on the deck, who is on pointe, and who is over it.
  const lvl = levelBlend(at.level, at.nextLevel, at.levelT);
  const posed = blendSpecs(specOf(at.pose), specOf(at.next), at.t);
  // The landing's plié is a body lower on the same feet, so the rise carries it: metres of
  // dip over the dancer's own height.
  const spec = { ...posed, rise: (posed.rise || 0) + lvl.rise - lvl.absorb / height };
  const fig = poseSvg({
    spec,
    x,
    y: feet - lvl.lift * k,
    h: height * k,
    facing: at.facing,
    turn: at.turn,
    headTurn: at.headTurn,
    // The feet she is standing on, at this moment: the printed figure bends over them exactly as
    // the screen's does, so the sheet and the planner cannot show two different stances.
    pins: footPins(show, d, localOfContent(show, d.id, ct)),
    body: shade(body, 0.95),
    ink: shade(body, 0.4),
    skirt: cos ? { color: shade(cos.skirt, 0.95), style: cos.style } : null,
    // An undressed dancer still gets a hair tone from their own colour, so the head has a
    // front and a back and a spot can be seen on paper.
    hair: cos ? shade(cos.hair, 0.9) : shade(body, 0.6),
  });
  marks.push({ x, y: fig.headY - fig.headR - 9, n: d.number, shape: 'circle' });
  return fig.svg;
}

function elevProp(show, f, s, p) {
  const k = f.k;
  const hgt = Number.isFinite(Number(s.h)) ? Math.max(0.1, Math.min(20, Number(s.h))) : 0.8;
  // A carried prop is held off the floor, as the planner draws it.
  const lift = s.carriedBy ? 0.45 : 0;
  const x = f.X(p.x - s.w / 2);
  const w = s.w * k;
  const y = f.Y(lift + hgt);
  const out = [rect(x, y, w, hgt * k, tint(s.color, 0.62), shade(s.color, 0.55), 1)];
  if (w > 42) {
    out.push(`<text x="${(x + w / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" class="dim" text-anchor="middle">${esc(s.name)}</text>`);
  }
  return out;
}

// Tags sit on top of the drawing, so one is never buried by cloth that hangs
// later in the order. Two pieces at the same height would wear the same corner,
// so each tag is lifted clear of the ones already placed.
function placeTags(marks) {
  const placed = [];
  const clash = (x, y) => placed.some((p) => Math.abs(p.x - x) < 17 && Math.abs(p.y - y) < 17);
  for (const m of marks) {
    let x = m.x;
    let y = m.y;
    let step = 0;
    while (clash(x, y) && step < 40) {
      step++;
      // Along the piece's own top edge first, since that is where the piece is
      // widest; only lift clear when the edge has run out of room.
      if (step % 7 === 0) y -= 18;
      else x += 18;
    }
    m.x = x;
    m.y = y;
    placed.push(m);
  }
  return marks.map((m) => tagMark(m.x, m.y, m.n, m.shape)).join('');
}

// Everything in one depth order, upstage first, so a shut curtain really does
// stand in front of what is behind it.
function elevPieces(show, f, tags, ct) {
  const items = [];
  for (const s of show.scenery) {
    if (s.kind === 'prop') continue;
    items.push({ kind: 'cloth', item: s, depth: clothDepth(s) });
  }
  for (const d of show.cast) {
    const p = posOfContent(show, d, ct);
    if (p) items.push({ kind: 'dancer', item: d, depth: p.y, p });
  }
  for (const s of show.scenery) {
    if (s.kind !== 'prop') continue;
    const p = propPosOfContent(show, s, ct) || { x: s.x, y: s.y };
    items.push({ kind: 'prop', item: s, depth: p.y, p });
  }
  items.sort((a, b) => b.depth - a.depth);
  const out = [];
  const marks = [];
  for (const it of items) {
    if (it.kind === 'cloth') out.push(...elevCloth(show, f, it.item, tags.get(it.item.id), marks, ct));
    else if (it.kind === 'dancer') out.push(...elevDancer(show, f, it.item, it.p, marks, ct));
    else out.push(...elevProp(show, f, it.item, it.p));
  }
  return out.join('') + placeTags(marks);
}

// Which way the picture faces, the proscenium frame over the top of everything,
// and a word for anything lifted out of the opening.
function elevOrientation(show, f, ct) {
  const half = show.stage.width / 2;
  const l = f.X(-half);
  const r = f.X(half);
  const deck = f.Y(0);
  const head = f.Y(f.opening);
  const out = [];
  out.push(`<path d="M ${l.toFixed(1)} ${(deck + 1).toFixed(1)} L ${l.toFixed(1)} ${head.toFixed(1)} L ${r.toFixed(1)} ${head.toFixed(1)} L ${r.toFixed(1)} ${(deck + 1).toFixed(1)}" fill="none" stroke="#23262b" stroke-width="2.2" />`);
  const y = deck + 0.3 * f.k + 15;
  out.push(`<text x="${l.toFixed(1)}" y="${y.toFixed(1)}" class="e-cap">STAGE LEFT</text>`);
  out.push(`<text x="${r.toFixed(1)}" y="${y.toFixed(1)}" class="e-cap" text-anchor="end">STAGE RIGHT</text>`);
  out.push(`<text x="${f.X(0).toFixed(1)}" y="${y.toFixed(1)}" class="e-cap" text-anchor="middle">FROM THE HOUSE</text>`);
  const gone = show.scenery.filter((s) => s.kind === 'drop' && clothExtent(show, s, ct).out);
  gone.forEach((s, i) => {
    out.push(`<text x="${(r - 2).toFixed(1)}" y="${(head - 6 - i * 10).toFixed(1)}" class="dim" text-anchor="end">↑ ${esc(s.name)} flown out</text>`);
  });
  return out;
}

// The elevation only shows what is inside the opening. Anyone standing in a wing
// is out of the house's view, so say who rather than letting them vanish.
function outOfView(show, ct) {
  const half = show.stage.width / 2;
  const names = [];
  for (const d of show.cast) {
    const p = posOfContent(show, d, ct);
    if (p && Math.abs(p.x) > half + 0.02) names.push(d.name);
  }
  for (const s of show.scenery) {
    if (s.kind !== 'prop') continue;
    const p = propPosOfContent(show, s, ct) || { x: s.x, y: s.y };
    if (Math.abs(p.x) > half + 0.02) names.push(s.name);
  }
  return names;
}

/* ---------------------------------------------------------------- tables */

const pctWord = (v) => (v <= 0.005 ? 'shut' : v >= 0.995 ? 'open' : Math.round(v * 100) + '%');
const flyWord = (v) => (v <= 0.005 ? 'out' : v >= 0.995 ? 'in' : Math.round(v * 100) + '%');

function cell(tag, body, cls) {
  return `<${tag}${cls ? ` class="${cls}"` : ''}>${body}</${tag}>`;
}

// A head that repeats when a long table crosses a page, which is the norm for a
// cue sheet.
function table(head, body, cls) {
  return `<table${cls ? ` class="${cls}"` : ''}><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

// Everything that happens in time order: scenery cues, holds, pauses and
// hand-offs. Each row is numbered, because that is how a crew calls them.
function cueRows(show) {
  const rows = [];
  for (const item of show.scenery) {
    for (const c of item.cues || []) {
      const before = sceneryStateAt(item, Math.max(0, c.at - 1));
      const parts = [];
      if (Number.isFinite(c.open)) parts.push(`open ${pctWord(before.open)} → ${pctWord(c.open)}`);
      if (Number.isFinite(c.fly)) parts.push(`flies ${flyWord(before.fly)} → ${flyWord(c.fly)}`);
      // A card says its own words on the cue, which is what the crew walks on with.
      if (Number.isFinite(c.shown)) {
        parts.push(
          (Number(c.shown) >= 0.5 ? 'brings on' : 'takes off') +
            (item.text ? ` “${item.text}”` : '')
        );
      }
      rows.push({
        at: c.at,
        item: item.name,
        kind: item.kind === 'drop' ? 'Drop' : item.kind === 'card' ? 'Card' : 'Curtain',
        action: parts.join(', ') || 'change',
        dur: c.dur,
      });
    }
  }
  for (const m of show.markers) {
    // The end is not a cue on the clock: it is where the clock stops, and the run
    // already prints "End of show" on its own line.
    if (m.kind === 'end') continue;
    if (m.kind === 'hold') {
      const d = show.cast.find((x) => x.id === m.trackId);
      rows.push({
        at: m.t,
        item: d ? d.name : 'Track',
        kind: 'Hold',
        action: 'holds position',
        dur: m.duration,
      });
    } else {
      rows.push({ at: m.t, item: 'Whole show', kind: 'Pause', action: 'everyone holds', dur: m.duration });
    }
  }
  // Sound is a cue like any other: the operator needs the track's entry point,
  // and a music cue sits on the same clock as everything else.
  // Every track enters somewhere, and a fade is a sound cue the operator calls
  // like any other, so both belong in the same list, in time order, with the
  // seconds each takes.
  for (const t of show.musicTracks || []) {
    rows.push({ at: t.start, item: t.name, kind: 'Music', action: 'track enters', dur: 0 });
    // A trimmed track stops before its file ends, which the operator has to know:
    // the silence after it is deliberate.
    const span = musicSpan(t);
    if (t.length > 0 && span < t.length) {
      rows.push({ at: t.start + span, item: t.name, kind: 'Music', action: 'track ends (trimmed)', dur: 0 });
    }
    for (const c of t.cues || []) {
      rows.push({
        at: c.at,
        item: t.name,
        kind: 'Music',
        action: Number(c.level) <= 0.005
          ? 'fades out'
          : Number(c.level) >= 0.995
            ? 'fades in'
            : 'fades to ' + Math.round(Number(c.level) * 100) + '%',
        dur: c.dur,
      });
    }
  }
  for (const c of show.videos || []) {
    const span = Math.max(0, Math.min(c.length, c.trimOut ?? c.length) - (c.trimIn || 0));
    rows.push({ at: c.at, item: c.name, kind: 'Video', action: `projector starts at source ${((c.trimIn || 0) / 1000).toFixed(1)} s · ${c.muted ? 'muted' : Math.round((c.level ?? 1) * 100) + '% sound'}`, dur: 0, len: (span / 1000).toFixed(1) + ' s' });
    rows.push({ at: c.at + span, item: c.name, kind: 'Video', action: 'projector stops', dur: 0 });
  }
  for (const cue of show.slideCues || []) {
    const image = (show.images || []).find((im) => im.id === cue.imageId);
    rows.push({ at: cue.at, item: image?.name || (cue.imageId ? 'Missing image' : 'Projector'), kind: 'Slide', action: cue.imageId ? 'replace projection with slide' : 'projector off', dur: cue.fade || 0 });
  }
  // The voice is a cue like any other: someone in the booth starts the line, and
  // how long it runs tells them what it plays over.
  for (const c of show.narration || []) {
    rows.push({
      at: c.at,
      item: c.name,
      kind: 'Narration',
      action: 'line plays',
      dur: 0,
      // The length of the line belongs in the length column: "cut" would say the
      // voice is instantaneous, and a spoken line is the one thing on this sheet
      // that is never over on the beat.
      len: c.length ? (c.length / 1000).toFixed(1) + ' s' : '—',
    });
  }
  for (const s of show.scenery) {
    if (s.kind !== 'prop' || !Array.isArray(s.carryHandoffs)) continue;
    let from = s.carriedBy;
    for (const h of s.carryHandoffs) {
      const a = show.cast.find((d) => d.id === from);
      const b = show.cast.find((d) => d.id === h.to);
      rows.push({ at: h.at, item: s.name, kind: 'Hand-off', action: `${a ? a.name : '—'} → ${b ? b.name : '—'}`, dur: 0 });
      from = h.to;
    }
  }
  // The ending is called like any other cue, and only when it has been placed:
  // an ending that is merely implied is a calculation, not a decision the booth
  // should be looking for. A marked end prints two rows — the music coming down
  // over the last stretch, and the moment the show stops.
  const ending = endMarker(show);
  if (ending) {
    const fade = Number(show.prefs && show.prefs.endFade) || 0;
    const sounding = activeMusicAt(show, ending.t);
    if (fade > 0 && sounding) {
      rows.push({
        at: Math.max(0, ending.t - fade),
        item: sounding.name,
        kind: 'Music',
        action: 'fades out for the end',
        dur: fade,
      });
    }
    rows.push({
      at: ending.t,
      item: 'Whole show',
      kind: 'End',
      action: 'curtain call — the show ends here',
      dur: 0,
      // Not a cut: there is nothing moving, so the length column would be a lie.
      len: '—',
    });
  }
  return rows.sort((a, b) => a.at - b.at);
}

// The show's shape on paper: which act, when it starts and how long it runs.
// An act's length is what it owns, so this is also the running order.
function runningOrderTable(show) {
  const ranges = actRanges(show);
  if (!ranges.length) return '<p class="empty">No acts in this show.</p>';
  const scenes = sceneRanges(show);
  const head = '<tr>' + ['Act / scene', 'Starts', 'Runs', 'Ends'].map((h) => cell('th', h, h === 'Act / scene' ? '' : 'num')).join('') + '</tr>';
  const rows = [];
  ranges.forEach((r, i) => {
    const from = displayOfContent(show, r.start);
    const to = displayOfContent(show, r.end);
    rows.push('<tr>' + [
      cell('td', `${i + 1}. ${esc(r.name)}`),
      cell('td', clock(from), 'num'),
      cell('td', clock(to - from), 'num'),
      cell('td', clock(to), 'num'),
    ].join('') + '</tr>');
    // Scenes sit under the act they divide, indented, so the shape of the
    // evening reads at a glance.
    for (const s of scenes.filter((x) => x.actIndex === i)) {
      const sFrom = displayOfContent(show, s.start);
      const sTo = displayOfContent(show, s.end);
      rows.push('<tr class="sub">' + [
        cell('td', esc(s.name)),
        cell('td', clock(sFrom), 'num'),
        cell('td', clock(sTo - sFrom), 'num'),
        cell('td', clock(sTo), 'num'),
      ].join('') + '</tr>');
    }
  });
  return table(head, rows.join(''));
}

// "Act 1" or "Act 1 · Opening": where a cue falls, for the cue sheet.
function whereAt(show, ct) {
  const scene = sceneAt(show, ct);
  if (scene) return scene.act + ' · ' + scene.name;
  const act = actAt(show, ct);
  return act ? act.name : '—';
}

function sceneryTable(show) {
  const items = show.scenery.filter((s) => s.kind !== 'prop');
  if (!items.length) return '<p class="empty">No curtains or drops in this show.</p>';
  const head = '<tr>' + ['Item', 'Kind', 'Across', 'Depth', 'Width', 'Height', 'Cues'].map((h) => cell('th', h)).join('') + '</tr>';
  const body = items.map((s) => '<tr>' + [
    cell('td', esc(s.name)),
    cell('td', s.kind === 'drop' ? 'drop' : s.kind === 'card' ? 'card' : 'curtain'),
    cell('td', m1(clothX(s)) + ' m'),
    cell('td', m1(clothDepth(s)) + ' m'),
    cell('td', m1(clothSpan(s)) + ' m'),
    cell('td', m1(s.h) + ' m'),
    cell('td', String((s.cues || []).length)),
  ].join('') + '</tr>').join('');
  return table(head, body);
}

function propTable(show) {
  const items = show.scenery.filter((s) => s.kind === 'prop');
  if (!items.length) return '<p class="empty">No props in this show.</p>';
  const head = '<tr>' + ['Prop', 'Size', 'On stage at', 'Runs on', 'Notes'].map((h) => cell('th', h)).join('') + '</tr>';
  const body = items.map((s) => {
    const p = propPosOfContent(show, s, 0) || { x: s.x, y: s.y };
    const runs = s.carriedBy
      ? 'carried'
      : s.keys && s.keys.length
        ? `timer, ${s.keys.length} pts`
        : 'dressing';
    const notes = s.carriedBy
      ? 'Carried by ' + esc((show.cast.find((d) => d.id === s.carriedBy) || {}).name || '—') +
        (s.carryHandoffs && s.carryHandoffs.length ? `, ${s.carryHandoffs.length} hand-off(s)` : '')
      : '';
    return '<tr>' + [
      cell('td', esc(s.name)),
      cell('td', `${m1(s.w)} × ${m1(s.d)} × ${m1(s.h)} m`),
      cell('td', `${m1(p.x)} / ${m1(p.y)}`),
      cell('td', runs),
      cell('td', notes || '—'),
    ].join('') + '</tr>';
  }).join('');
  return table(head, body);
}

// How a station is arrived at, in a dancer's words: the step and how far round they
// turn on the way. The paper is read down a column in a rehearsal room, so a station
// walked straight into and not turned on says so with a dash.
function stepWords(k) {
  const step = k && k.step && k.step !== 'walk' && STEP_LABEL[k.step] ? STEP_LABEL[k.step] : '';
  const deg = Math.round(Number(k && k.turn) || 0);
  const turn =
    deg === 0
      ? ''
      : deg === 180
        ? '½ turn'
        : deg === -180
          ? '½ turn back'
          : deg === 360
            ? 'full turn'
            : deg === -360
              ? 'full turn back'
              : Math.abs(deg) + '° turn';
  // A turn given its own length is one slow movement rather than a part of the transition,
  // and the paper says so: a dancer rehearsing an adagio turn needs the count as well as
  // the amount.
  const ms = Number(k && k.turnMs);
  const over = turn && Number.isFinite(ms) && ms > 0 ? ` over ${(ms / 1000).toFixed(1)} s` : '';
  // A bowed leg is a different line to walk, not just a different dot, so the paper says
  // which way it arcs and how far — the plotted path shows the shape, this names the size.
  const bend = Number(k && k.bend) || 0;
  const arc = Math.abs(bend) >= 0.05 ? `arcs ${m1(Math.abs(bend))} m ${bend > 0 ? 'left' : 'right'}` : '';
  // The count is part of how the leg is danced, so a shaped one is named: a dancer counts a
  // gathering step differently from a settling one.
  const shape = k && k.ease && k.ease !== 'even' && EASE_LABEL[k.ease] ? EASE_LABEL[k.ease] : '';
  // Two phrases joined here: the dancer does not stop on this station, which is the one thing
  // about it a rehearsal on paper has to get right, so the column says it out loud.
  const through = k && k.pass ? 'passed through' : '';
  return [step, turn ? turn + over : '', shape, arc, through].filter(Boolean).join(', ') || '—';
}

// The position and the level a station is held at, in the words a rehearsal uses: "5th
// position, en pointe", "arabesque, in the air 0.4 m up". A station standing flat on the
// deck says nothing extra, so the column stays readable.
function poseWords(k, from) {
  const pose = k && k.pose && k.pose !== 'none' ? POSE_LABEL[k.pose] || k.pose : '';
  const lv = levelOf(k, from);
  const named = LEVEL_LABEL[lv.name] || 'flat';
  const level = lv.name === 'flat' && !lv.lift ? '' : named + (lv.lift > 0 ? ` ${m1(lv.lift)} m up` : '');
  // A landing that gives is a fact about the station, so the paper says how deep it gives.
  // Centimetres, not tenths: a landing is a small number and 0.11 m read as "0.1 m" loses
  // the difference between a soft landing and a stiff one.
  const plie = lv.absorb >= 0.02 ? `plié ${lv.absorb.toFixed(2)} m` : '';
  return [pose, level, plie].filter(Boolean).join(', ') || '—';
}

function stationTable(show, dancer) {
  const keys = dancer.keys || [];
  if (!keys.length) return '<p class="empty">No stations yet — this performer has no path.</p>';
  // The foot each station stands on, so a rehearsal can check the weight as well as the shape: a
  // position decides unless the station says otherwise, which is why the column is on every row.
  const plants = plantsOf(dancer);
  const head =
    '<tr>' + ['#', 'Time', 'Pose', 'How in', 'Plant', 'Across', 'Depth'].map((h) => cell('th', h)).join('') + '</tr>';
  const body = keys.map((k, i) => {
    const at = displayOfContent(show, contentOfLocal(show, dancer.id, k.t));
    const plant = plants[i] ? plants[i].name : '';
    return '<tr>' + [
      cell('td', String(i + 1), 'num'),
      cell('td', clock(at), 'num'),
      cell('td', esc(poseWords(k, i ? keys[i - 1] : null))),
      cell('td', esc(stepWords(k))),
      cell('td', esc(plant === 'air' ? 'in the air' : plant === 'both' ? 'both' : plant + ' foot')),
      cell('td', m1(k.x)),
      cell('td', m1(k.y)),
    ].join('') + '</tr>';
  }).join('');
  return table(head, body, 'stations');
}

/* ----------------------------------------------------------------- pages */

function plotPage(show) {
  const f = frame(show, 760);
  const body = [
    ...base(show, f),
    ...edgeRules(show, f),
    ...wingLegs(show, f),
    ...cloth(show, f, false, 0),
    ...props(show, f, false, 0),
    ...castAt(show, f, 0),
    ...orientation(show, f),
  ];

  const cues = show.scenery.reduce((n, s) => n + (s.cues || []).length, 0);
  const pauses = show.markers.filter((m) => m.kind === 'pause').length;
  const holds = show.markers.filter((m) => m.kind === 'hold').length;
  // How much of the show is voice, which is a fact about the evening the plan
  // should carry: it is time on the clock, not a decoration.
  const voiceCount = (show.narration || []).length;
  const voiceTime = (show.narration || []).reduce((n, c) => n + (Number(c.length) || 0), 0);

  return `<section class="sheet">
  <header class="doc-head">
    <div class="doc-title">
      <h1>${esc(show.name)}</h1>
      <p class="sub">Performance plan · stage plot, paths and cue sheet · printed ${esc(printDate())}</p>
    </div>
    <dl class="facts">
      <div><dt>Stage</dt><dd>${m1(show.stage.width)} × ${m1(show.stage.depth)} m</dd></div>
      <div><dt>Wings</dt><dd>${m1(show.stage.wingDepth)} m a side</dd></div>
      <div><dt>Opening</dt><dd>${m1(show.stage.openingH)} m</dd></div>
      <div><dt>Running time</dt><dd>${clock(endDisplay(show))}</dd></div>
      <div><dt>Cast</dt><dd>${show.cast.length}</dd></div>
      <div><dt>Acts</dt><dd>${(show.acts || []).length}</dd></div>
      <div><dt>Cues</dt><dd>${cues} · ${holds} hold(s) · ${pauses} pause(s)</dd></div>
      <div><dt>Music</dt><dd>${(show.musicTracks || []).length ? show.musicTracks.map((t) => `${esc(t.name)} from ${clock(displayOfContent(show, t.start))}`).join('; ') : 'none'}</dd></div>
      ${voiceCount ? `<div><dt>Narration</dt><dd>${voiceCount} line(s), ${clock(voiceTime)} of voice</dd></div>` : ''}
    </dl>
  </header>

  <h2>Stage plot</h2>
  <figure class="plan">${svg(f, body)}</figure>
  <ul class="legend">
    <li><span class="sw start"></span>Performer, numbered as in the cast</li>
    <li><span class="sw cloth"></span>Curtain or drop, as the show opens</li>
    <li><span class="sw prop"></span>Prop</li>
    <li><span class="sw leg"></span>Wing leg</li>
    <li><span class="sw cl"></span>Centre line</li>
    <li><span class="sw foot"></span>Foot on the deck · the open one is free</li>
  </ul>
  <p class="note">Distances are in metres: across is measured from the centre line, depth from the proscenium. Scenery is drawn at its depth with its own width; the side elevation on the next sheet shows the same pieces in height, at whichever moment the bar above is set to. A cross under a performer marks the foot she is standing on at that moment, the same picture the plan draws, and a foot the position has lifted is not marked because it is not touching the floor.</p>

  <h3>Running order</h3>
  ${runningOrderTable(show)}

  <div class="split">
    <section>
      <h3>Scenery</h3>
      ${sceneryTable(show)}
    </section>
    <section>
      <h3>Props</h3>
      ${propTable(show)}
    </section>
  </div>
</section>`;
}

// The vertical facts a crew rigs from: how tall each piece is, where it sits
// above the deck at the chosen moment, and where it hangs relative to the rest.
function flyingTable(show, ct, dt) {
  // A card is not flown: it is held up and taken off, and the cue sheet is where
  // that lives. Listing it here with a "from the deck" it does not have would lie.
  const items = show.scenery.filter((s) => s.kind !== 'prop' && s.kind !== 'card');
  if (!items.length) return '<p class="empty">No curtains or drops in this show.</p>';
  const opening = openingOf(show);
  const head = '<tr>' + ['№', 'Item', 'Kind', 'Height', 'From the deck', 'Across', 'Depth', 'At ' + clock(dt)]
    .map((h) => cell('th', h, h === '№' ? 'num' : '')).join('') + '</tr>';
  const body = items.map((s, i) => {
    const e = clothExtent(show, s, ct);
    const above = e.top > opening + 0.02 ? ' ↑' : '';
    const atTop = s.kind === 'drop' ? flyWord(e.fly) : pctWord(e.open);
    return '<tr>' + [
      cell('td', String(i + 1), 'num'),
      cell('td', esc(s.name)),
      cell('td', s.kind === 'drop' ? 'drop' : 'curtain'),
      cell('td', m1(e.h) + ' m', 'num'),
      cell('td', `${m1(e.bottom)} – ${m1(e.top)} m${above}`, 'num'),
      cell('td', m1(clothSpan(s)) + ' m', 'num'),
      cell('td', m1(clothDepth(s)) + ' m', 'num'),
      cell('td', atTop),
    ].join('') + '</tr>';
  }).join('');
  return table(head, body);
}

function elevationPage(show, dt) {
  // The page works in show time, like the timeline and cue sheet; the model wants
  // content time, where a pause has not yet stretched the clock.
  const ct = contentOfDisplay(show, dt);
  const when = dt <= 0 ? 'the top of the show' : clock(dt);
  const f = elevFrame(show, 760);
  const half = show.stage.width / 2;
  const items = show.scenery.filter((s) => s.kind !== 'prop');
  const tags = new Map(items.map((s, i) => [s.id, i + 1]));
  // Nothing outside the opening is in the house's view, so the pieces are
  // clipped to it exactly as the planner's elevation clips them.
  const sight = `<defs><clipPath id="elevSight"><rect x="${f.X(-half).toFixed(1)}" y="${f.Y(f.opening).toFixed(1)}" width="${(show.stage.width * f.k).toFixed(1)}" height="${(f.opening * f.k).toFixed(1)}" /></clipPath></defs>`;
  const body = [
    sight,
    ...elevBase(show, f),
    `<g clip-path="url(#elevSight)">${elevPieces(show, f, tags, ct)}</g>`,
    ...elevOrientation(show, f, ct),
  ];
  const key = show.cast.map((d) =>
    `<li><span class="swatch" style="background:${esc(d.color)}"></span>${esc(d.number)}. ${esc(d.name)}</li>`
  ).join('');
  const away = outOfView(show, ct);
  // The legend wears the show's own cloth colours, so it cannot disagree with
  // what is drawn above it.
  const swatch = (item, fallbackFill, fallbackInk) =>
    `style="background:${item ? tint(item.color, 0.84) : fallbackFill};border-color:${item ? shade(item.color, 0.7) : fallbackInk}"`;
  const aCurtain = items.find((s) => s.kind !== 'drop');
  const aDrop = items.find((s) => s.kind === 'drop');

  return `<section class="sheet">
  <h2>Side elevation · ${clock(dt)}</h2>
  <p class="note">The same stage seen from the house at ${when}. Heights are measured from the deck, widths across the opening; the drawing is larger than the plot because it has only one axis to fit. Each piece keeps its own height, and a piece taller than the opening is cut at the header, because that is where the audience's sight stops.</p>
  <figure class="plan">${svg(f, body)}</figure>
  <ul class="legend">
    <li><span class="sw" ${swatch(aCurtain, '#f2e8e9', '#7b2d3b')}></span>Curtain, as it hangs at this moment</li>
    <li><span class="sw" ${swatch(aDrop, '#eef0f2', '#243b52')}></span>Drop</li>
    <li><span class="sw" style="background:#dfe3e8;border-color:#5a6b8c"></span>Performer, at the stage's dancer height</li>
    <li><span class="sw" style="background:#f7f1de;border-color:#8a7a4a"></span>Prop</li>
    <li><span class="sw tag"></span>Square: scenery number, as in the table</li>
    <li><span class="sw circle"></span>Circle: cast number, as in the key below</li>
  </ul>
  ${away.length ? `<p class="note">Out of the opening's width at ${when}, so not in this view: ${away.map(esc).join(', ')}. The plot shows where they stand.</p>` : ''}

  <h3>Heights and flying</h3>
  ${flyingTable(show, ct, dt)}
  <p class="note">“From the deck” is where the piece sits at ${when}, so a drop caught partway through a fly starts partway up the opening. ↑ marks a top above the header, out of sight. Cues that move a piece are on the cue sheet.</p>

  <h3>Cast</h3>
  ${show.cast.length ? `<ul class="legend">${key}</ul>` : '<p class="empty">No performers in this show.</p>'}
</section>`;
}

// Where the company has finished: the closing picture in numbers, for the crew that
// has to clear the stage or bring a curtain call on to it. The pose is the one held
// at that moment, which is the pose of the last station the performer has reached.
function closingTable(show, ct) {
  if (!show.cast.length) return '<p class="empty">No performers in this show.</p>';
  // The role is the act the show ends in: the closing picture is one moment, so one act.
  const closing = actAt(show, ct);
  const closingAct = closing ? (show.acts || []).find((a) => a.id === closing.id) : null;
  const head = '<tr>' + ['#', 'Performer', 'Role', 'Closing pose', 'Across', 'Depth', 'Where']
    .map((h) => cell('th', h, h === '#' || h === 'Across' || h === 'Depth' ? 'num' : '')).join('') + '</tr>';
  const half = show.stage.width / 2;
  const rows = show.cast.map((d) => {
    const p = posOfContent(show, d, ct);
    const keys = d.keys || [];
    let pose = '—';
    if (keys.length) {
      const lt = localOfContent(show, d.id, ct);
      // The last station reached, not the last station in the path: a performer
      // whose walk ended earlier is still holding whatever they finished on.
      const at = keys.filter((k) => k.t <= lt).pop() || keys[0];
      if (at.pose && at.pose !== 'none') pose = esc(POSE_LABEL[at.pose] || at.pose);
    }
    const where = !p
      ? 'no path'
      : p.x < -half - 0.01
        ? 'in the left wing'
        : p.x > half + 0.01
          ? 'in the right wing'
          : 'on stage';
    const role = closingAct ? roleOf(closingAct, d.id) : '';
    return '<tr>' + [
      cell('td', String(d.number), 'num'),
      cell('td', esc(d.name)),
      cell('td', role ? esc(role) : '<span class="dim">—</span>'),
      cell('td', pose),
      cell('td', p ? m1(p.x) : '—', 'num'),
      cell('td', p ? m1(p.y) : '—', 'num'),
      cell('td', where),
    ].join('') + '</tr>';
  }).join('');
  return table(head, rows);
}

// The clearance list: everything on the deck when the curtain comes down, where it
// stands, and the move that takes it away. Written for the crew who have to clear the
// stage after the call, not for the audience.
function strikeTable(show, ct) {
  const clothRows = show.scenery
    .filter((s) => s.kind !== 'prop')
    .slice()
    .sort((a, b) => clothDepth(a) - clothDepth(b))
    .map((s) => {
      const now = sceneryStateAt(s, ct);
      let state;
      let clear;
      if (s.kind === 'card') {
        const on = now.shown > 0.02;
        state = on ? 'held up — “' + (s.text || '') + '”' : 'off';
        clear = on ? 'walked off' : '—';
      } else if (s.kind === 'drop') {
        const fly = Math.max(0, Math.min(1, now.fly));
        state = fly <= 0.02 ? 'flown out' : fly >= 0.98 ? 'hanging' : Math.round(fly * 100) + '% in';
        clear = fly <= 0.02 ? 'already out' : 'flies out';
      } else {
        const open = Math.max(0, Math.min(1, now.open));
        state = open <= 0.005 ? 'shut' : open >= 0.995 ? 'open' : Math.round(open * 100) + '% open';
        // A curtain is the house's own cloth: it is opened, not struck.
        clear = '—';
      }
      return {
        item: esc(s.name),
        kind: s.kind === 'drop' ? 'Drop' : s.kind === 'card' ? 'Card' : 'Curtain',
        x: m1(clothX(s)),
        y: m1(clothDepth(s)),
        state,
        clear,
        depth: clothDepth(s),
      };
    });

  const propRows = show.scenery
    .filter((s) => s.kind === 'prop')
    .map((s) => {
      const p = propPosOfContent(show, s, ct) || { x: s.x, y: s.y };
      const who = s.carriedBy ? carrierNameAt(show, s, ct) : null;
      const onTimer = Array.isArray(s.keys) && s.keys.length > 0;
      const state = who ? 'carried by ' + esc(who) : onTimer ? 'on its own path' : 'dressing';
      // A carried prop leaves with the person holding it; anything else is walked off.
      const clear = who ? 'carried off by ' + esc(who) : 'carried off';
      return {
        item: esc(s.name),
        kind: 'Prop',
        x: m1(p.x),
        y: m1(p.y),
        state,
        clear,
        depth: p.y,
      };
    })
    .sort((a, b) => a.depth - b.depth);

  const rows = clothRows.concat(propRows);
  if (!rows.length) return '<p class="empty">Nothing stands on this stage.</p>';
  // A tick column because this list is worked through by hand at the call, and a
  // signature line because handing the stage back is something someone is answerable
  // for. Both are blank space on paper, which is the point.
  const head = '<tr>' + ['\u2713', 'Item', 'Kind', 'Across', 'Depth', 'At the call', 'Clearing']
    .map((h) => cell('th', h, h === '\u2713' ? 'tick' : h === 'Across' || h === 'Depth' ? 'num' : '')).join('') + '</tr>';
  const body = rows.map((r) => '<tr>' + [
    cell('td', '<span class="tick-box"></span>', 'tick'),
    cell('td', r.item),
    cell('td', r.kind),
    cell('td', r.x, 'num'),
    cell('td', r.y, 'num'),
    cell('td', esc(r.state)),
    cell('td', r.clear),
  ].join('') + '</tr>').join('');
  const signoff = `<div class="signoff">
    <div><span class="line"></span>checked by</div>
    <div><span class="line"></span>stage manager</div>
    <div><span class="line"></span>time the stage was clear</div>
  </div>`;
  return table(head, body, 'strike') + signoff;
}

// Who is holding a carried prop at a moment, which is who takes it off.
function carrierNameAt(show, s, ct) {
  let from = s.carriedBy;
  for (const h of s.carryHandoffs || []) {
    if (h.at > ct) break;
    from = h.to;
  }
  const d = show.cast.find((x) => x.id === from);
  return d ? d.name : null;
}

// The last picture: the plan at the moment the show stops, with the cloth as it
// hangs then and every performer where their path leaves them. It is a decision the
// company made when it placed the end, which is why it prints only when the end has
// been marked — an end that is only implied is a calculation, not a tableau.
function tableauPage(show) {
  const ending = endMarker(show);
  if (!ending) return '';
  const ct = endContent(show);
  const dt = displayOfContent(show, ct);
  const f = frame(show, 760);
  const body = [
    ...base(show, f),
    ...edgeRules(show, f),
    ...wingLegs(show, f),
    ...cloth(show, f, false, ct),
    ...props(show, f, false, ct),
    ...castAt(show, f, ct),
    ...orientation(show, f),
  ];
  // A performer with no stations at all has nowhere to be drawn; one whose path
  // ended early is still standing where it finished, which is the truth on stage.
  const withoutPath = show.cast.filter((d) => !posOfContent(show, d, ct)).length;

  return `<section class="sheet">
  <h2>Curtain call · ${clock(dt)}</h2>
  <p class="note">The picture the show closes on, at the moment the clock stops. Scenery is drawn as it hangs then — a drop caught after its fly is marked with how far in it is — and performers stand at the end of their paths. Paths are left off on purpose: this is the stage as the audience sees it, not how anyone got there.</p>
  <figure class="plan">${svg(f, body)}</figure>
  <ul class="legend">
    <li><span class="sw start"></span>Performer, numbered as in the cast</li>
    <li><span class="sw cloth"></span>Curtain or drop, as it hangs at the end</li>
    <li><span class="sw prop"></span>Prop</li>
    <li><span class="sw leg"></span>Wing leg</li>
    <li><span class="sw cl"></span>Centre line</li>
  </ul>
  ${withoutPath > 0 ? `<p class="note">${withoutPath} of ${show.cast.length} performer(s) have no path in this show, so they cannot be placed at ${clock(dt)} and are not drawn.</p>` : ''}

  <h3>Where everyone ends</h3>
  ${closingTable(show, ct)}
  <p class="note">Read at ${clock(dt)}. Across is measured from the centre line, positive to stage right; depth from the proscenium. A performer whose path finished earlier is listed where it left them, holding the pose they finished on.</p>

  <h3>To strike after the call</h3>
  ${strikeTable(show, ct)}
  <p class="note">Everything on the deck at ${clock(dt)}, front to back, with the move that clears it. A curtain is the house's own cloth and is opened rather than struck, so it has no clearing; a drop already flown out has none either.</p>
</section>`;
}

// What a performer is playing, as the other sheets say it beside her name. One role needs no
// bookkeeping and reads as a line under the name; several mean the act has to be named, or the
// same dancer would appear to be two people at once. A performer nobody has cast is left
// unlabelled rather than labelled "uncast" — the casting sheet is where that is the subject.
function roleLine(show, dancer) {
  const acts = show.acts || [];
  const named = acts
    .map((act) => ({ act, role: roleOf(act, dancer.id) }))
    .filter((o) => o.role);
  if (!named.length) return '';
  if (named.length === 1 || acts.length === 1) return named.map((o) => o.role).join(' · ');
  return named.map((o) => `${o.role} (${o.act.name})`).join(' · ');
}

// The casting sheet: who is playing whom, act by act. It is the first thing a company
// looks for on paper, and it is the only page that says a role out loud. A performer
// with no role is still in the company, so she is listed under the act with a dash
// rather than left off; a show with no casting at all prints no page, the way a show
// with no lanterns prints no lighting sheet.
function castPage(show) {
  const acts = (show.acts || []).filter((a) => a && a.name);
  if (!acts.some((act) => Object.keys(rolesOf(act)).length)) return '';
  const head = '<tr>' + ['Role', 'Performer', 'No.'].map((h) => cell('th', h)).join('') + '</tr>';
  const blocks = acts.map((act) => {
    const roles = rolesOf(act);
    // Cast first, in role order, because that is the order a bill is read in; anyone
    // uncast follows, in the company's own numbering.
    const cast = show.cast.filter((d) => roles[d.id]).sort((a, b) => roles[a.id].localeCompare(roles[b.id]) || a.number - b.number);
    const rest = show.cast.filter((d) => !roles[d.id]).sort((a, b) => a.number - b.number);
    const row = (role, d) =>
      '<tr>' +
      cell('td', role ? esc(role) : '<span class="dim">—</span>') +
      cell('td', esc(d.name)) +
      cell('td', String(d.number), 'num') +
      '</tr>';
    const body = cast.map((d) => row(roles[d.id], d)).concat(rest.map((d) => row('', d))).join('');
    return `<h3>${esc(act.name)}</h3>
  ${body ? table(head, body, 'cast') : '<p class="empty">No performers in the company.</p>'}`;
  }).join('');

  const uncast = show.cast.filter((d) => !acts.some((act) => rolesOf(act)[d.id])).length;
  return `<section class="sheet">
  <h2>Cast</h2>
  <p class="note">Who is playing whom, act by act. A role is written against a performer in the planner, and the same body can play a different one in each act — a Snowflake in the first and a Flower in the second. A dash means the performer is in the company but is not cast in that act.</p>
  ${blocks}
  ${uncast ? `<p class="note">${uncast} of ${show.cast.length} performer(s) have no role in any act.</p>` : ''}
</section>`;
}

// How many performers are standing on the deck at each moment of an act, drawn as a step
// line: up when somebody walks on, down when somebody leaves. A call sheet already says who
// is wanted; this says when the stage is crowded and when it empties, which is the thing a
// quick change hangs on. Counted from the paths, so it cannot disagree with the plan: a
// performer whose path has finished is still standing where it left her, and one who is in
// the wings is off — the audience has lost sight of her, and so has the count.
//
// Sampled rather than solved: walking off is a position crossing the wing line part-way
// along a leg, not a station, so the moment is read from the path at a fine enough step to
// catch it (a quarter second on a short act, coarser on a four-hour one).
const RUN_SAMPLES = 900;
function companyLine(show, range) {
  const cast = show.cast || [];
  if (!cast.length) return null;
  const half = show.stage.width / 2;
  const span = Math.max(1, range.end - range.start);
  const step = Math.max(250, Math.round(span / RUN_SAMPLES));
  const samples = [];
  for (let ct = range.start; ct < range.end; ct += step) samples.push(ct);
  samples.push(range.end);
  // Who is on at each sample, not just how many: the names are what make a change useful, and
  // a change of two at once — one walking off as another walks on — leaves the count alone but
  // is exactly the quick change a stage manager wants to see. It is read from the same position
  // the plan draws, so a performer cannot be off in one and on in the other.
  const states = samples.map((ct) =>
    cast.map((d) => {
      const p = posOfContent(show, d, ct);
      return !!p && Math.abs(p.x) <= half + 0.01;
    })
  );
  const counts = states.map((row) => row.filter(Boolean).length);
  const peak = Math.max(1, ...counts);
  const W = 760;
  const left = 24;
  const right = 8;
  const top = 10;
  const plotH = 38;
  const base = top + plotH;
  const xOf = (ct) => left + ((ct - range.start) / span) * (W - left - right);
  const yOf = (n) => base - (n / peak) * plotH;
  const nx = (v) => v.toFixed(1);

  let d = `M${nx(xOf(samples[0]))} ${nx(yOf(counts[0]))}`;
  const changes = [];
  for (let i = 1; i < samples.length; i++) {
    const x = xOf(samples[i]);
    const on = [];
    const off = [];
    for (let j = 0; j < cast.length; j++) {
      if (states[i][j] && !states[i - 1][j]) on.push(cast[j]);
      else if (!states[i][j] && states[i - 1][j]) off.push(cast[j]);
    }
    if (counts[i] !== counts[i - 1]) {
      d += ` L${nx(x)} ${nx(yOf(counts[i - 1]))} L${nx(x)} ${nx(yOf(counts[i]))}`;
    } else {
      d += ` L${nx(x)} ${nx(yOf(counts[i]))}`;
    }
    // A swap moves nobody's total, so the line stays flat and only the tick and the names say
    // that anything happened at all.
    if (on.length || off.length) changes.push({ x, n: counts[i], from: counts[i - 1], at: samples[i], on, off });
  }
  const lastX = xOf(samples[samples.length - 1]);
  const area = `${d} L${nx(lastX)} ${nx(base)} L${nx(xOf(samples[0]))} ${nx(base)} Z`;

  const body = [`<rect x="${left}" y="${top}" width="${W - left - right}" height="${plotH}" fill="#fbfaf7" />`];
  // A rule per count, or every second one when the company is large, with the number at
  // the left so a height can be read without counting squares.
  const every = peak <= 5 ? 1 : Math.ceil(peak / 5);
  for (let c = every; c <= peak; c += every) {
    body.push(line(left, yOf(c), W - right, yOf(c), '#e6e2d9', 0.6, '2 3'));
    body.push(`<text x="${left - 4}" y="${nx(yOf(c) + 2.5)}" class="dim" text-anchor="end">${c}</text>`);
  }
  body.push(`<path d="${area}" fill="#e9e2d3" opacity="0.8" />`);
  body.push(`<path d="${d}" fill="none" stroke="#33322e" stroke-width="1.2" />`);
  body.push(line(left, base, W - right, base, '#b9b4a8', 0.8));
  // A tick wherever the number changes, and its time under it. Two rows of labels rather
  // than one, because the changes worth seeing are exactly the ones close together — a run
  // of exits a few seconds apart would otherwise print a cluster of ticks and one time, or
  // labels written over each other. A label that will not fit in either row is dropped; the
  // tick stays, so the shape is never lost.
  const lanes = [base + 10, base + 19];
  const laneX = [-99, -99];
  for (const c of changes) {
    body.push(line(c.x, top, c.x, base, '#8d8a82', 0.6, '1.5 2.5'));
    let lane = -1;
    for (const i of [0, 1]) if (c.x - laneX[i] >= 24 && lane < 0) lane = i;
    if (lane < 0) continue;
    laneX[lane] = c.x;
    body.push(`<text x="${nx(c.x)}" y="${lanes[lane]}" class="dim" text-anchor="middle">${clock(displayOfContent(show, c.at))}</text>`);
  }
  // The count of changes is named in the caption, so a dense run of ticks with no times beside
  // it still reads as what it is: that many entrances and exits, not decoration.
  const caption = 'COMPANY ON THE DECK · ' + changes.length + ' CHANGE' + (changes.length === 1 ? '' : 'S');
  body.push(`<text x="${left}" y="${base + 31}" class="cap">${caption}</text>`);

  return { svg: `<figure class="runline">${svg({ width: W, height: base + 36 }, body)}</figure>`, peak, changes };
}

// Who each step of the company line is. The chart can hold a tick and a time; it cannot hold
// "Ada went off as Cleo came on", which is the sentence a quick change actually needs. So the
// changes are listed under the line in the order they happen, with the performers numbered as
// they are everywhere else — a stage manager reads numbers on a call, and the names are there
// for the reader who does not know the company yet.
function changesTable(show, changes) {
  const who = (list) =>
    list.length
      ? list.map((d) => `${esc(d.name)} <span class="dim">${d.number}</span>`).join(', ')
      : '<span class="dim">—</span>';
  const head = '<tr>' + ['Time', 'On', 'Off', 'On stage']
    .map((h) => cell('th', h, h === 'Time' || h === 'On stage' ? 'num' : '')).join('') + '</tr>';
  const body = changes
    .map((c) =>
      '<tr>' +
        cell('td', clock(displayOfContent(show, c.at)), 'num') +
        cell('td', who(c.on)) +
        cell('td', who(c.off)) +
        cell('td', String(c.n), 'num') +
        '</tr>'
    )
    .join('');
  return table(head, body, 'call changes');
}

// The rehearsal call sheet: who is needed, in which part, and from when — read act by act
// and then scene by scene, which is how a rehearsal is called. A performer is "called" for a
// stretch of the show when she has a station inside it: that is the only evidence the show
// carries that she is on for it, and it means the sheet cannot promise someone who never
// walks on. A company member with no path anywhere is named once at the foot rather than
// appearing in every scene as a blank.
function callSheetPage(show) {
  const company = show.cast.slice().sort((a, b) => a.number - b.number);
  const cast = company.filter((d) => (d.keys || []).length);
  if (!cast.length) return '';
  const acts = actRanges(show);
  const scenes = sceneRanges(show);
  // A tick column, because a call is worked through by hand as people arrive, and the
  // boxes are blank space on paper — which is the point.
  const head = '<tr>' +
    ['\u2713', 'Role', 'Performer', 'No.', 'Called at', 'Stations']
      .map((h) =>
        cell('th', h, h === '\u2713' ? 'tick' : h === 'No.' || h === 'Called at' || h === 'Stations' ? 'num' : '')
      )
      .join('') +
    '</tr>';

  // The stations a performer has inside a stretch of the clock, as the times a crew reads.
  const callsIn = (d, start, end) =>
    (d.keys || []).filter((k) => {
      const ct = contentOfLocal(show, d.id, k.t);
      return ct >= start && ct < end;
    });

  const blocks = acts.map((range, i) => {
    const act = (show.acts || []).find((a) => a.id === range.id);
    const roleIn = (d) => (act ? roleOf(act, d.id) : '');
    const ownScenes = scenes.filter((s) => s.actIndex === i);
    // Where an act has scenes, the stretch before the first one is still part of the act.
    const stretches = [];
    if (!ownScenes.length) stretches.push({ label: 'Whole act', start: range.start, end: range.end });
    else {
      if (ownScenes[0].start > range.start) {
        stretches.push({ label: 'Before ' + ownScenes[0].name, start: range.start, end: ownScenes[0].start });
      }
      for (const s of ownScenes) stretches.push({ label: s.name, start: s.start, end: s.end });
    }

    const rows = [];
    for (const stretch of stretches) {
      const called = cast
        .map((d) => ({ d, keys: callsIn(d, stretch.start, stretch.end) }))
        .filter((o) => o.keys.length)
        .map((o) => ({
          ...o,
          first: displayOfContent(show, contentOfLocal(show, o.d.id, o.keys[0].t)),
        }))
        .sort((a, b) => a.first - b.first || a.d.number - b.d.number);
      if (!called.length) continue;
      // The count sits on the scene line, where a stage manager looks first: how many are
      // wanted here is the number that sizes a dressing room, a warm-up and a wait.
      rows.push(
        '<tr class="sub"><td colspan="6" class="callsec">' +
          esc(stretch.label) +
          ' · ' +
          clock(displayOfContent(show, stretch.start)) +
          '<span class="callcount">' +
          called.length +
          ' called</span>' +
          '</td></tr>'
      );
      for (const o of called) {
        const role = roleIn(o.d);
        rows.push(
          '<tr>' +
            cell('td', '<span class="tick-box"></span>', 'tick') +
            cell('td', role ? esc(role) : '<span class="dim">—</span>') +
            cell('td', esc(o.d.name)) +
            cell('td', String(o.d.number), 'num') +
            cell('td', clock(o.first), 'num') +
            cell('td', String(o.keys.length), 'num') +
            '</tr>'
        );
      }
    }

    const onFor = new Set();
    for (const d of cast) if (callsIn(d, range.start, range.end).length) onFor.add(d.id);
    const run = companyLine(show, range);
    const fact = `${onFor.size} called · ${clock(displayOfContent(show, range.start))} → ${clock(displayOfContent(show, range.end))}${
      run ? ` · peak ${run.peak} on the deck` : ''
    }`;
    const body = rows.join('');
    return `<h3>${esc(range.name)}<span class="tag">${esc(fact)}</span></h3>
  ${run ? run.svg : ''}
  ${run && run.changes.length ? changesTable(show, run.changes) : ''}
  ${body ? table(head, body, 'call') : '<p class="empty">Nobody has a station in this act yet.</p>'}`;
  }).join('');

  const idle = company.filter((d) => !(d.keys || []).length);
  return `<section class="sheet">
  <h2>Rehearsal call</h2>
  <p class="note">Who is needed, in what part, and the first moment she is on — act by act and scene by scene. A performer is called for a stretch when she has a station inside it, so nobody is promised for a scene she never walks into. Times are show time with pauses counted, the same clock as the cue sheet. The step line under each act is how many performers are standing on the deck: it rises when someone walks on, falls when someone leaves and marks the moment of every change, so a crowded dance and a quick exit can be seen without reading the paths. The short table beneath the line names each change — who came on, who went off, and how many that leaves — so a change of one for one, which leaves the line flat, is still visible.</p>
  ${blocks}
  ${idle.length ? `<p class="note">Not called at all: ${idle.map((d) => esc(d.name) + ' (' + d.number + ')').join(' · ')} — no path in this show.</p>` : ''}
  <p class="note">Tick a performer off as she arrives. The call is complete when every box in the act is ticked and the page is signed.</p>
  <div class="signoff">
    <div><span class="line"></span>called by</div>
    <div><span class="line"></span>date</div>
    <div><span class="line"></span>stage manager's signature</div>
  </div>
</section>`;
}

function pathsPage(show) {
  const blocks = show.cast.map((d) => {
    const keys = d.keys || [];
    const from = keys.length ? displayOfContent(show, contentOfLocal(show, d.id, keys[0].t)) : 0;
    const to = keys.length ? displayOfContent(show, contentOfLocal(show, d.id, keys[keys.length - 1].t)) : 0;
    const facts = keys.length
      ? `${keys.length} station${keys.length === 1 ? '' : 's'} · ${clock(from)} → ${clock(to)}`
      : 'no path yet';
    const f = frame(show, 700);
    const body = [
      ...base(show, f),
      ...cloth(show, f, true),
      ...props(show, f, true),
      ...walk(show, d, f),
      ...orientation(show, f),
    ];
    // A path is read for the part a performer is playing in it, so the role sits beside the
    // name and the numbers stay in the tag.
    const roles = roleLine(show, d);
    return `<article class="path-block">
      <h3><span class="swatch" style="background:${esc(d.color)}"></span>${esc(d.name)}${roles ? `<span class="role">${esc(roles)}</span>` : ''}<span class="tag">${esc(facts)}</span></h3>
      <figure class="plan">${svg(f, body)}</figure>
      ${stationTable(show, d)}
    </article>`;
  }).join('');

  return `<section class="sheet">
  <h2>Paths</h2>
  <p class="note">Stations are numbered in the order they are walked. Times are show time, with pauses counted — the same clock the timeline shows. A cross under a numbered station is the foot that station stands on, with the other foot drawn open when it is on the deck too; the Plant column in the table names both.</p>
  ${blocks || '<p class="empty">No performers in this show.</p>'}
</section>`;
}

function cuePage(show) {
  const rows = cueRows(show);
  const head = '<tr>' + ['Cue', 'Time', 'Act / scene', 'Item', 'Kind', 'Action', 'Length'].map((h) => cell('th', h)).join('') + '</tr>';
  const body = rows.map((r, i) => '<tr>' + [
    cell('td', String(i + 1), 'num'),
    cell('td', clock(displayOfContent(show, r.at)), 'num'),
    cell('td', esc(whereAt(show, r.at))),
    cell('td', esc(r.item)),
    cell('td', r.kind),
    cell('td', esc(r.action)),
    cell('td', r.len || (r.dur ? (r.dur / 1000).toFixed(1) + ' s' : 'cut'), 'num'),
  ].join('') + '</tr>').join('');

  return `<section class="sheet">
  <h2>Cue sheet</h2>
  <p class="note">In running order. “Cut” means the change happens on the beat rather than over a duration; “—” is a moment with nothing moving — the show ending; holds freeze one performer where they stand, pauses stop the whole show.</p>
  ${rows.length ? table(head, body, 'cue') : '<p class="empty">Nothing is called in this show yet: no scenery cues, holds, pauses or hand-offs.</p>'}
</section>`;
}

/* --------------------------------------------------------------- lighting */

// A lantern's colour as paper can name it: the gel's name when it came off the
// palette, its code when it was mixed by eye on the wheel.
const gelWord = (hex) => GEL_NAMES[String(hex || '').toLowerCase()] || String(hex || '');
const typeWord = (t) => (LIGHT_TYPES.find(([v]) => v === t) || LIGHT_TYPES[0])[1];
const goboWord = (g) => (LIGHT_GOBOS.find(([v]) => v === g) || LIGHT_GOBOS[0])[1];

// What one cue does to its lantern, in the words an operator works from. A cue can
// carry a level, an aim, or both, so the sentence is built from whichever it has.
function lightAction(show, c) {
  const parts = [];
  if (c.level !== undefined) {
    const p = Math.round(Number(c.level) * 100);
    parts.push(p <= 0 ? 'out' : p >= 100 ? 'full' : 'to ' + p + '%');
  }
  if ('followId' in c) {
    const d = c.followId ? (show.cast || []).find((x) => x.id === c.followId) : null;
    parts.push('hand to ' + (d ? d.name : 'its own place'));
  }
  return parts.join(', ') || 'no change';
}

// Every lantern's cues, gathered into one running order across the rig: the booth
// works from times, not from concertina folders.
function lightCueRows(show) {
  const rows = [];
  for (const l of show.lights || []) {
    for (const c of l.cues || []) {
      rows.push({ at: c.at, light: l, dur: c.dur || 0, action: lightAction(show, c) });
    }
  }
  return rows.sort((a, b) => a.at - b.at);
}

// The rig: what is hung, in what, and where — the list a crew works from before a
// single cue is called.
function rigTable(show) {
  const head = '<tr>' +
    ['No.', 'Lantern', 'Type', 'Colour', 'Gobo', 'Hangs', 'Pool', 'Where', 'Follows', 'Level']
      .map((h) => cell('th', h, /^(No\.|Hangs|Pool|Level)$/.test(h) ? 'num' : ''))
      .join('') + '</tr>';
  const body = (show.lights || []).map((l, i) => {
    const who = l.followId ? (show.cast || []).find((d) => d.id === l.followId) : null;
    return '<tr>' + [
      cell('td', String(i + 1), 'num'),
      cell('td', esc(l.name)),
      cell('td', typeWord(l.type)),
      cell('td', `<span class="swatch" style="background:${esc(l.color)}"></span>${esc(gelWord(l.color))}`),
      cell('td', esc(goboWord(l.gobo))),
      cell('td', m1(l.h) + ' m', 'num'),
      cell('td', m1(l.spread) + ' m', 'num'),
      cell('td', `${m1(l.x)} across, ${m1(l.z)} deep`),
      cell('td', who ? esc(who.name) : '—'),
      cell('td', Math.round(Number(l.level) * 100) + '%', 'num'),
    ].join('') + '</tr>';
  }).join('');
  return table(head, body, 'cue');
}

function lightingPage(show) {
  // A show with no lanterns has nothing for the booth, and a blank sheet in the
  // printout would only invite the question of what it was for.
  if (!(show.lights || []).length) return '';
  const rows = lightCueRows(show);
  const head = '<tr>' +
    ['Cue', 'Time', 'Act / scene', 'Lantern', 'Colour', 'Gobo', 'Action', 'Length']
      .map((h) => cell('th', h, h === 'Cue' || h === 'Time' || h === 'Length' ? 'num' : ''))
      .join('') + '</tr>';
  const body = rows.map((r, i) => '<tr>' + [
    cell('td', String(i + 1), 'num'),
    cell('td', clock(displayOfContent(show, r.at)), 'num'),
    cell('td', esc(whereAt(show, r.at))),
    cell('td', esc(r.light.name)),
    cell('td', `<span class="swatch" style="background:${esc(r.light.color)}"></span>${esc(gelWord(r.light.color))}`),
    cell('td', esc(goboWord(r.light.gobo))),
    cell('td', esc(r.action)),
    cell('td', r.dur ? (r.dur / 1000).toFixed(1) + ' s' : 'cut', 'num'),
  ].join('') + '</tr>').join('');

  return `<section class="sheet">
  <h2>Lighting</h2>
  <p class="note">The rig first, then every light cue in running order. A level is where the lantern sits after the cue; a cue that only hands the spot on leaves the brightness alone. A hand-off is a pan, not a cut — the beam leaves one performer and arrives at the other over the length shown, and follows neither in between. “Its own place” sends a follow spot back to where it is hung.</p>
  <h3>The rig<span class="tag">${show.lights.length} lantern${show.lights.length === 1 ? '' : 's'}</span></h3>
  ${rigTable(show)}
  <h3>Cues</h3>
  ${rows.length ? table(head, body, 'cue') : '<p class="empty">No light cues yet: every lantern stands at the level in the rig list.</p>'}
</section>`;
}

/* ------------------------------------------------------------------- boot */

// Which moment the elevation sheet draws. It is show time — the same clock the
// timeline and cue sheet use — and it lives in the address, so a sheet can be
// re-opened or bookmarked at exactly that moment.
let moment = 0;

// "0:08.0", "0:08", "8.5" and "8" all mean 8.5 s; anything else is not a time.
function clockMs(text) {
  const t = String(text == null ? '' : text).trim().replace(',', '.');
  if (!t) return null;
  const m = t.match(/^(\d{1,3}):([0-5]?\d(?:\.\d+)?)$/);
  if (m) return Math.round((Number(m[1]) * 60 + Number(m[2])) * 1000);
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) : null;
}

const clampMoment = (show, dt) => Math.max(0, Math.min(Math.round(endDisplay(show)), Math.round(dt)));

// The moments worth putting on paper: the top of the show, every cue — and the end
// of anything that takes time, so a fly can be seen done as well as part-way — and
// the end of the show.
function momentList(show) {
  const out = [{ at: 0, label: '0:00.0 · Top of show' }];
  // Every act and scene boundary is a moment a crew wants.
  for (const r of actRanges(show)) {
    const at = Math.round(displayOfContent(show, r.start));
    if (at > 0) out.push({ at, label: `${clock(at)} · ${r.name}` });
  }
  for (const s of sceneRanges(show)) {
    const at = Math.round(displayOfContent(show, s.start));
    if (at > 0) out.push({ at, label: `${clock(at)} · ${s.act} · ${s.name}` });
  }
  for (const r of cueRows(show)) {
    const at = Math.round(displayOfContent(show, r.at));
    out.push({ at, label: `${clock(at)} · ${r.item}: ${r.action}` });
    if (r.dur > 0) {
      const done = Math.round(displayOfContent(show, r.at + r.dur));
      out.push({ at: done, label: `${clock(done)} · ${r.item}: ${r.action} (done)` });
    }
  }
  // Light cues change the picture too, and a hand-off is a pan — its arrival is a
  // different beam from its start, so both ends are worth looking at.
  for (const r of lightCueRows(show)) {
    const at = Math.round(displayOfContent(show, r.at));
    out.push({ at, label: `${clock(at)} · ${r.light.name}: ${r.action}` });
    if (r.dur > 0) {
      const done = Math.round(displayOfContent(show, r.at + r.dur));
      out.push({ at: done, label: `${clock(done)} · ${r.light.name}: ${r.action} (done)` });
    }
  }
  const end = Math.round(endDisplay(show));
  out.push({ at: end, label: `${clock(end)} · End of show` });
  // Nothing exists past the end, and two cues in the same instant are one picture,
  // so the first name stands for it.
  const seen = new Set();
  return out
    .filter((o) => o.at <= end)
    .filter((o) => (seen.has(o.at) ? false : (seen.add(o.at), true)))
    .sort((a, b) => a.at - b.at);
}

function render(show) {
  document.title = show.name + ' — plan';
  const bar = document.getElementById('docName');
  if (bar) bar.textContent = show.name;
  document.getElementById('doc').innerHTML =
    plotPage(show) + castPage(show) + callSheetPage(show) + elevationPage(show, moment) + tableauPage(show) + pathsPage(show) + cuePage(show) + lightingPage(show);
}

function fillMomentPicker(show) {
  const sel = document.getElementById('momentSel');
  const input = document.getElementById('momentTime');
  if (!sel || !input) return;
  const list = momentList(show);
  const exact = list.find((o) => Math.abs(o.at - moment) < 1);
  const options = exact ? list : [{ at: moment, label: `${clock(moment)} · Chosen time` }, ...list];
  sel.innerHTML = options.map((o) => `<option value="${o.at}">${esc(o.label)}</option>`).join('');
  sel.value = String(moment);
  input.value = clock(moment);
}

function applyMoment(show, dt) {
  moment = clampMoment(show, dt);
  render(show);
  fillMomentPicker(show);
  const url = new URL(location.href);
  url.searchParams.set('at', String(moment));
  history.replaceState(null, '', url);
}

const show = restore();
if (!show) {
  document.getElementById('doc').innerHTML =
    '<section class="sheet"><header class="doc-head"><div class="doc-title">' +
    '<h1>No show yet</h1><p class="sub">Nothing is saved in this browser.</p></div></header>' +
    '<p class="note">Open the planner, build or import a show, and print from there — this page reads the same saved file.</p>' +
    '<p><a class="back" href="index.html">Open the planner</a></p></section>';
} else {
  // Model helpers read the show from state, so it has to be in place first.
  state.show = show;
  // The address carries milliseconds, so a link is exact regardless of formatting.
  const askedRaw = new URLSearchParams(location.search).get('at');
  const asked = askedRaw == null || askedRaw.trim() === '' ? 0 : Number(askedRaw);
  moment = clampMoment(show, Number.isFinite(asked) ? asked : 0);
  render(show);
  fillMomentPicker(show);

  const btn = document.getElementById('btnPrint');
  if (btn) btn.addEventListener('click', () => window.print());

  const sel = document.getElementById('momentSel');
  if (sel) sel.addEventListener('change', () => applyMoment(show, Number(sel.value)));

  const input = document.getElementById('momentTime');
  if (input) {
    const commit = () => {
      const parsed = clockMs(input.value);
      if (parsed == null) input.value = clock(moment);
      else applyMoment(show, parsed);
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
        input.blur();
      } else if (e.key === 'Escape') {
        input.value = clock(moment);
        input.blur();
      }
    });
  }
}
