// Stage view: draws the plan of the whole performing space and handles
// dragging dancers (which writes keyframes at the playhead).
import {
  THEME, state, posAtLocal, posOfContent, localOfContent, holdsFor, contentOfLocal, commit, persist,
  addStation, objectShown, wingBays, findObject, propPosOfContent, carrierOf, sceneryStateAt,
  clothSpan, clothX, clothDepth, clothThick, clampClothX, curtainLegW, POSE_LABEL, lightLevelAt,
  lightSpot, costumeOf, legPoints, curveAt, BEND_LIMIT,
  footAtLocal, footSkate, legOverreach, dancerHeight, overheadPoseAtLocal,
} from './model.js';
import { darker } from './pose.js';

// A lantern's colour at a given strength, so every pool and beam is drawn from
// the same hex rather than from a hand-written rgba per place it appears.
function hexA(hex, a) {
  const n = String(hex || '#ffffff').replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  return 'rgba(' + parseInt(full.slice(0, 2), 16) + ',' + parseInt(full.slice(2, 4), 16) + ',' + parseInt(full.slice(4, 6), 16) + ',' + a + ')';
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export class StageView {
  constructor(canvas, app, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.app = app;
    this.compact = !!opts.compact;
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.grab = null;
    this.bind();
  }

  bind() {
    this.canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', () => this.onUp());
    window.addEventListener('pointercancel', () => this.onUp());
    this.canvas.addEventListener('contextmenu', (e) => this.onContext(e));
  }

  tiltAngle() {
    return !this.compact && state.ui.fill === 'plan'
      ? Math.max(0, Math.min(55, Number(state.ui.planTilt) || 0)) * Math.PI / 180 : 0;
  }

  w2s(x, y, height = 0) {
    const tilt = this.tiltAngle();
    return { x: this.ox + x * this.scale, y: this.oy - (y * Math.cos(tilt) + height * Math.sin(tilt)) * this.scale };
  }

  s2w(px, py) {
    return { x: (px - this.ox) / this.scale, y: (this.oy - py) / (this.scale * Math.cos(this.tiltAngle())) };
  }

  rect(x0, y0, x1, y1) {
    const a = this.w2s(x0, y0);
    const b = this.w2s(x1, y1);
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  }

  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /* ------------------------------------------------------------- drawing */

  draw() {
    const show = state.show;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, w, h);

    const st = show.stage;
    const worldW = st.width + st.wingDepth * 2;
    const worldH = st.depth;
    const pad = this.compact ? 6 : 34;
    // The editor picks one scale for the plan and the elevation together, so a metre
    // is the same size in both. Fitting this canvas on its own would make them
    // disagree the moment the panes differed.
    const shared = this.compact ? null : state.ui.viewScale;
    const s = shared || Math.max(0.5, Math.min((w - pad * 2) / worldW, (h - pad * 2) / worldH));
    this.scale = s;
    this.ox = w / 2;
    this.oy = h / 2 + (worldH / 2) * s * Math.cos(this.tiltAngle());

    const halfW = st.width / 2;

    // wings
    for (const side of [-1, 1]) {
      const r = this.rect(side * (halfW + st.wingDepth), 0, side * halfW, st.depth);
      ctx.fillStyle = THEME.wing;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#1b2534';
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }

    // floor
    const floor = this.rect(-halfW, 0, halfW, st.depth);
    ctx.fillStyle = THEME.floor;
    ctx.fillRect(floor.x, floor.y, floor.w, floor.h);

    // grid
    const g = Math.max(0.25, st.grid);
    ctx.lineWidth = 1;
    for (let x = -halfW; x <= halfW + 1e-6; x += g) {
      const p = this.w2s(Math.min(x, halfW), 0);
      const major = Math.abs(Math.round(x)) < 1e-6;
      ctx.strokeStyle = major ? THEME.gridMajor : THEME.grid;
      ctx.beginPath();
      ctx.moveTo(Math.round(p.x) + 0.5, floor.y);
      ctx.lineTo(Math.round(p.x) + 0.5, floor.y + floor.h);
      ctx.stroke();
    }
    for (let y = 0; y <= st.depth + 1e-6; y += g) {
      const p = this.w2s(-halfW, Math.min(y, st.depth));
      ctx.strokeStyle = THEME.grid;
      ctx.beginPath();
      ctx.moveTo(floor.x, Math.round(p.y) + 0.5);
      ctx.lineTo(floor.x + floor.w, Math.round(p.y) + 0.5);
      ctx.stroke();
    }

    // centre line
    const cl = this.w2s(0, 0);
    ctx.strokeStyle = 'rgba(150,175,210,.28)';
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(cl.x, floor.y);
    ctx.lineTo(cl.x, floor.y + floor.h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Lighting first: a pool is what is already on the floor before anyone
    // walks into it, so it goes under the scenery and the cast.
    this.drawLightPools();

    // proscenium
    const pr = this.w2s(-halfW - st.wingDepth, 0);
    const pr2 = this.w2s(halfW + st.wingDepth, 0);
    ctx.strokeStyle = THEME.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pr.x, pr.y);
    ctx.lineTo(pr2.x, pr2.y);
    ctx.stroke();
    ctx.lineWidth = 1;

    if (!this.compact) {
      ctx.fillStyle = '#3b4a60';
      ctx.font = '10px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('A U D I E N C E', w / 2, pr.y + 18);
      ctx.fillText('U P S T A G E', w / 2, floor.y + 13);
      ctx.textAlign = 'left';
      ctx.save();
      ctx.translate(14, floor.y + floor.h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#3f4d64';
      ctx.textAlign = 'center';
      ctx.fillText('LEFT WING', 0, 0);
      ctx.restore();
      ctx.save();
      ctx.translate(w - 14, floor.y + floor.h / 2);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#3f4d64';
      ctx.textAlign = 'center';
      ctx.fillText('RIGHT WING', 0, 0);
      ctx.restore();
      ctx.textAlign = 'left';
    }

    // wing legs sit in the wings, above the wing floor but under the scenery
    this.drawWingLegs();

    // scenery, back to front
    const ordered = show.scenery.slice().sort((a, b) => this.sceneryY(b) - this.sceneryY(a));
    for (const item of ordered) this.drawScenery(item);

    // paths: dancers, plus any prop that has stations
    const selected = findObject(show, state.ui.selectedId);
    if (!this.compact) {
      for (const body of this.pathBodies()) {
        if (!objectShown(body)) continue;
        this.drawPath(body, body === selected);
      }
    }

    // cast
    for (const d of show.cast) {
      if (!objectShown(d)) continue;
      this.drawCast(d, d === selected);
    }

    // The lanterns themselves last, so a marker is never buried under a dancer
    // who is standing in the light.
    if (!this.compact) this.drawLightMarkers();

    // collision
    if (!this.compact && state.ui.collision) {
      for (const id of state.ui.collision.ids) {
        const d = show.cast.find((c) => c.number === id);
        if (!d) continue;
        const p = posOfContent(show, d, state.ui.playhead);
        if (!p) continue;
        const sp = this.w2s(p.x, p.y);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = THEME.danger;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    // Last, so the guide and readout sit over everything else on the plan.
    if (this.grab && this.grab.type === 'cloth') this.drawClothDrag(this.grab);
  }

  // A drag is judged by where the cloth was, where it is, and the number.
  drawClothDrag(grab) {
    const ctx = this.ctx;
    const st = state.show.stage;
    const item = grab.item;
    const halfW = st.width / 2;
    const cx = clothX(item);
    const span = clothSpan(item);
    const depth = clothDepth(item);
    const thick = clothThick(item);

    ctx.save();
    // Where it started, so the distance moved is visible.
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(255,183,3,.32)';
    const a0 = this.w2s(-halfW, grab.depth0);
    const b0 = this.w2s(halfW, grab.depth0);
    ctx.beginPath();
    ctx.moveTo(a0.x, a0.y);
    ctx.lineTo(b0.x, b0.y);
    ctx.stroke();

    // The band itself, outlined while it is in hand.
    const r = this.rect(cx - span / 2, depth, cx + span / 2, depth + thick);
    ctx.setLineDash([]);
    ctx.strokeStyle = THEME.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.lineWidth = 1;

    // A line right across the stage, to read the depth against both edges.
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = 'rgba(255,183,3,.5)';
    const a = this.w2s(-halfW, depth + thick / 2);
    const b = this.w2s(halfW, depth + thick / 2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);

    let text = depth.toFixed(2) + ' m deep';
    if (Math.abs(cx) >= 0.05) text += '  ·  ' + cx.toFixed(2) + ' m across';
    // Whether the move is on the grid or free with Alt held.
    text += grab.snapped ? '  ·  grid' : '  ·  free';
    ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    const lx = Math.min(Math.max(r.x + r.w / 2 - tw / 2, 8), this.canvas.clientWidth - tw - 20);
    const ly = Math.max(14, r.y - 16);
    ctx.fillStyle = 'rgba(8,11,16,.9)';
    ctx.fillRect(lx - 6, ly - 3, tw + 12, 14);
    ctx.strokeStyle = 'rgba(255,183,3,.45)';
    ctx.strokeRect(lx - 5.5, ly - 2.5, tw + 11, 13);
    ctx.fillStyle = THEME.accent;
    ctx.fillText(text, lx, ly + 7);
    ctx.restore();
  }

  legLen() {
    return Math.max(1.2, Math.min(2.0, state.show.stage.wingDepth * 0.5));
  }

  drawWingLegs() {
    const ctx = this.ctx;
    const show = state.show;
    const st = show.stage;
    const halfW = st.width / 2;
    const len = this.legLen();
    const thick = 0.34;

    if (!this.compact) {
      for (const side of [-1, 1]) {
        for (const bay of wingBays(show, side)) {
          if (bay.hi - bay.lo < 0.5) continue;
          const p = this.w2s(side * (halfW + st.wingDepth * 0.84), (bay.lo + bay.hi) / 2);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = 'rgba(125,145,175,.42)';
          ctx.font = '8px "Segoe UI", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(bay.name, 0, 0);
          ctx.restore();
          ctx.textAlign = 'left';
        }
      }
    }

    for (const leg of show.wingLegs) {
      const r = this.rect(
        leg.side * halfW,
        leg.y - thick / 2,
        leg.side * (halfW + len),
        leg.y + thick / 2
      );
      ctx.fillStyle = 'rgba(74,42,60,.95)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#6a3a4f';
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      const folds = Math.max(2, Math.round(r.w / 14));
      ctx.strokeStyle = 'rgba(0,0,0,.3)';
      for (let i = 1; i < folds; i++) {
        const fx = r.x + (r.w / folds) * i;
        ctx.beginPath();
        ctx.moveTo(fx, r.y + 1);
        ctx.lineTo(fx, r.y + r.h - 1);
        ctx.stroke();
      }
    }
  }

  pathBodies() {
    const show = state.show;
    const timed = show.scenery.filter(
      (s) => s.kind === 'prop' && s.keys && s.keys.length && !s.carriedBy
    );
    return show.cast.concat(timed);
  }

  sceneryY(item) {
    if (item.kind === 'prop') return propPosOfContent(state.show, item, state.ui.playhead).y;
    return clothDepth(item);
  }

  drawScenery(item) {
    const ctx = this.ctx;
    const st = state.show.stage;
    const halfW = st.width / 2;
    const y = this.sceneryY(item);

    // What the cues have made of this item by now, rather than its base value.
    const now = sceneryStateAt(item, state.ui.playhead);

    if (item.kind === 'prop') {
      if (!objectShown(item)) return;
      const p = propPosOfContent(state.show, item, state.ui.playhead);
      const r = this.rect(p.x - item.w / 2, p.y, p.x + item.w / 2, p.y + item.d);
      const focused = item.id === state.ui.selectedId;
      ctx.fillStyle = this.alpha(item.color, 0.55);
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = focused ? THEME.accent : item.color;
      ctx.lineWidth = focused ? 1.6 : 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.lineWidth = 1;
      if (!this.compact) {
        ctx.fillStyle = 'rgba(220,232,245,.8)';
        ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.name, r.x + r.w / 2, r.y + r.h / 2 + 3);
        ctx.textAlign = 'left';
      }
      return;
    }

    const thick = clothThick(item);
    const open = Math.max(0, Math.min(1, now.open));

    if (item.kind === 'card') {
      // A card is a board held up in front of the house, not cloth on a pipe: it is
      // either there or it is not, so it is drawn at its own opacity rather than
      // sliding or fading out of view as a drop does.
      const shown = Math.max(0, Math.min(1, now.shown));
      if (shown <= 0.02) return;
      const cx = clothX(item);
      const span = clothSpan(item);
      const r = this.rect(cx - span / 2, y, cx + span / 2, y + thick);
      ctx.fillStyle = this.alpha(item.color, 0.94 * shown);
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = this.alpha('#2a2318', shown);
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      // The words on the card, scaled to whatever room the board has. It is the
      // whole point of the piece, so it is drawn even in the compact view.
      const text = String(item.text || '');
      if (text) {
        const room = Math.max(20, r.w - 6);
        let size = 10;
        ctx.save();
        ctx.font = '600 ' + size + 'px "Segoe UI", system-ui, sans-serif';
        const wide = ctx.measureText(text).width;
        if (wide > room) {
          size = Math.max(6, Math.floor((size * room) / wide));
          ctx.font = '600 ' + size + 'px "Segoe UI", system-ui, sans-serif';
        }
        ctx.fillStyle = 'rgba(20,16,10,' + (0.88 * shown).toFixed(3) + ')';
        ctx.textAlign = 'center';
        ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + size * 0.35, room + 4);
        ctx.textAlign = 'left';
        ctx.restore();
      }
      // No name above the band: the board's words are the label, and the piece is
      // named in the list. A second caption here only collides with the curtain
      // that stands on the same line of the plan.
      return;
    }

    if (item.kind === 'drop') {
      // A drop flies straight up, so in plan it fades rather than slides.
      const fly = Math.max(0, Math.min(1, now.fly));
      if (fly <= 0.02) return;
      // A drop need not span the whole opening, nor sit in the middle of it.
      const dx = clothX(item);
      const span = clothSpan(item);
      const r = this.rect(dx - span / 2, y, dx + span / 2, y + thick);
      ctx.fillStyle = this.alpha(item.color, 0.8 * fly);
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = this.alpha(item.color, fly);
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.strokeStyle = 'rgba(0,0,0,' + (0.22 * fly).toFixed(3) + ')';
      const seams = Math.max(4, Math.round(span / 0.3));
      for (let i = 1; i < seams; i++) {
        const fx = r.x + (r.w / seams) * i;
        ctx.beginPath();
        ctx.moveTo(fx, r.y + 1);
        ctx.lineTo(fx, r.y + r.h - 1);
        ctx.stroke();
      }
    } else {
      // a curtain is two legs; closed means they meet in the middle of its span
      const cx = clothX(item);
      const span = clothSpan(item);
      const legW = curtainLegW(span, open);
      for (const side of [-1, 1]) {
        const x0 = side === -1 ? cx - span / 2 : cx + span / 2 - legW;
        const r = this.rect(x0, y, x0 + legW, y + thick);
        ctx.fillStyle = this.alpha(item.color, 0.72);
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = this.alpha(item.color, 0.95);
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
        // folds
        ctx.strokeStyle = 'rgba(0,0,0,.28)';
        const folds = Math.max(2, Math.round(legW / 0.32));
        for (let i = 1; i < folds; i++) {
          const fx = r.x + (r.w / folds) * i;
          ctx.beginPath();
          ctx.moveTo(fx, r.y + 1);
          ctx.lineTo(fx, r.y + r.h - 1);
          ctx.stroke();
        }
      }
    }

    if (!this.compact) {
      const label = this.w2s(item.kind === 'prop' ? item.x : clothX(item), y);
      ctx.fillStyle = 'rgba(226,236,248,.72)';
      ctx.font = '10px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.name, label.x, label.y - 5);
      ctx.textAlign = 'left';
    }
  }

  drawPath(dancer, strong) {
    const show = state.show;
    const ctx = this.ctx;
    const keys = dancer.keys;
    if (!keys.length) return;
    const lastLt = keys[keys.length - 1].t;
    if (state.ui.showPaths !== false && keys.length >= 2 && lastLt > 0) {

    const step = Math.max(200, Math.min(600, Math.round(lastLt / 70)));
    const pts = [];
    for (let lt = 0; lt <= lastLt; lt += step) {
      const p = posAtLocal(dancer, lt);
      if (p) pts.push(p);
    }
    const endP = posAtLocal(dancer, lastLt);
    if (endP) pts.push(endP);

    const halfW = show.stage.width / 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = this.w2s(pts[i].x, pts[i].y);
      const b = this.w2s(pts[i + 1].x, pts[i + 1].y);
      const wing = Math.abs((pts[i].x + pts[i + 1].x) / 2) > halfW;
      if (Math.hypot(b.x - a.x, b.y - a.y) < 0.6) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = dancer.color;
      ctx.globalAlpha = strong ? (wing ? 0.34 : 0.8) : 0.16;
      ctx.lineWidth = strong ? 2 : 1;
      ctx.setLineDash(wing ? [4, 5] : []);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // time ticks: equal spacing in time, so gaps show speed
    if (strong) {
      for (let i = 1; i < pts.length - 1; i++) {
        const prev = this.w2s(pts[i - 1].x, pts[i - 1].y);
        const next = this.w2s(pts[i + 1].x, pts[i + 1].y);
        const p = this.w2s(pts[i].x, pts[i].y);
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        ctx.beginPath();
        ctx.moveTo(p.x - nx * 3.2, p.y - ny * 3.2);
        ctx.lineTo(p.x + nx * 3.2, p.y + ny * 3.2);
        ctx.strokeStyle = 'rgba(235,242,252,.45)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (i % 5 === 0) {
          const ux = dx / len;
          const uy = dy / len;
          ctx.beginPath();
          ctx.moveTo(p.x + ux * 5, p.y + uy * 5);
          ctx.lineTo(p.x - ux * 2 + nx * 3.4, p.y - uy * 2 + ny * 3.4);
          ctx.lineTo(p.x - ux * 2 - nx * 3.4, p.y - uy * 2 - ny * 3.4);
          ctx.closePath();
          ctx.fillStyle = 'rgba(235,242,252,.55)';
          ctx.fill();
        }
      }
    }

    // hold rings
    for (const h of holdsFor(show, dancer.id)) {
      const ct = h.t;
      const p = posOfContent(show, dancer, ct);
      if (!p) continue;
      const sp = this.w2s(p.x, p.y);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 9, 0, Math.PI * 2);
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineWidth = 1;
      if (strong) {
        ctx.fillStyle = THEME.accent;
        ctx.font = '9px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('H', sp.x, sp.y + 3);
        ctx.textAlign = 'left';
      }
    }

    }
    // Station markers are independent of movement lines and hold rings.
    if (state.ui.showStations === false) return;
    // keyframes
    keys.forEach((k, i) => {
      const sp = this.w2s(k.x, k.y);
      ctx.fillStyle = '#0b0e14';
      ctx.strokeStyle = dancer.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(sp.x - 3.5, sp.y - 3.5, 7, 7);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1;
      if (strong && state.ui.stationIdx === i) {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = THEME.accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (strong && keys.length <= 24) {
        ctx.fillStyle = 'rgba(200,215,235,.9)';
        ctx.font = '9px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(String(i + 1), sp.x + 6, sp.y - 6);
        if (k.pose && k.pose !== 'none') {
          ctx.fillStyle = 'rgba(255,183,3,.9)';
          ctx.fillText(POSE_LABEL[k.pose] || k.pose, sp.x + 6, sp.y + 13);
        }
      }
    });
  }

  drawCast(d, selected) {
    const ctx = this.ctx;
    const show = state.show;
    const p = posOfContent(show, d, state.ui.playhead);
    if (!p) return;
    // The dancer's own clock, because a hold freezes her: the feet must freeze with her.
    const lt = localOfContent(show, d.id, state.ui.playhead);
    const r = this.compact ? 3 : Math.max(4.5, Math.min(12, 0.26 * this.scale));
    const sp = this.w2s(p.x, p.y);

    if (!this.compact && state.ui.showPaths !== false) {
      // short ghost trail behind the playhead
      const trail = [];
      for (let back = 700; back >= 0; back -= 70) {
        const tp = posOfContent(show, d, Math.max(0, state.ui.playhead - back));
        if (tp) trail.push(this.w2s(tp.x, tp.y));
      }
      for (let i = 0; i < trail.length - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(trail[i].x, trail[i].y);
        ctx.lineTo(trail[i + 1].x, trail[i + 1].y);
        ctx.strokeStyle = d.color;
        ctx.globalAlpha = ((i + 1) / trail.length) * 0.5;
        ctx.lineWidth = r * 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.lineCap = 'butt';
    }

    // Draw the figure at the exact floor position, not an upright icon offset from it.
    const solved = this.compact ? null : overheadPoseAtLocal(show, d, lt);
    if (solved) this.drawOverhead(d, p, lt, solved);
    if (solved) this.drawFeet(d, lt, solved);

    if (selected) {
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Seen from above, a costume is a skirt: a tutu is a wide flat disc, a tunic a
    // narrow one, and plain is barely there. The body keeps the performer's own
    // colour, so the plan still answers "which dancer" at a glance.
    const cos = costumeOf(show, d);
    if (cos && this.compact) {
      const wide = cos.style === 'tutu' ? 0.62 : cos.style === 'tunic' ? 0.34 : 0.16;
      const thick = Math.max(1.2, r * wide);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r + thick * 0.5 + 1, 0, Math.PI * 2);
      ctx.strokeStyle = cos.skirt;
      ctx.lineWidth = thick;
      ctx.globalAlpha = 0.9;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
    }

    if (!this.compact) {
      ctx.fillStyle = 'rgba(230,240,252,.85)';
      ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(d.number), sp.x, sp.y - r - 5);
      ctx.textAlign = 'left';
      this.drawSkate(d, lt);
      this.drawShort(d, lt);
    }
    ctx.globalAlpha = 1;
  }


  drawOverhead(d, p, lt, solved = overheadPoseAtLocal(state.show, d, lt)) {
    if (!solved) return;
    const ctx = this.ctx;
    const { at, figure, frame } = solved;
    const h = dancerHeight(state.show);
    const angle = (Number(at.turn) || 0) * Math.PI / 180;
    const mirror = at.facing < 0 ? -1 : 1;
    const project = (x, z, height = 0) => {
      const point = frame.toStage([x, height, z]);
      return this.w2s(point.x, point.y, point.h);
    };
    const cos = costumeOf(state.show, d);
    const body = cos ? cos.body : d.color;
    const size = h * this.scale;
    const stroke = (points, color, width) => {
      ctx.beginPath();
      points.forEach((pt, i) => i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y));
      ctx.strokeStyle = '#080c13'; ctx.lineWidth = width + 2; ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    };
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Every endpoint comes from the solver, including an ankle that cannot reach its target.
    for (const leg of solved.legs) {
      stroke(leg.map(j => this.w2s(j.x, j.y, j.h)), body, Math.max(2, size * 0.035));
    }
    // Costume visibility is independent from paths and station markers.
    if (state.ui.showCostumes === true) {
      const center = project(figure.pelvis[0], 0, figure.pelvis[1]);
      ctx.save();
      ctx.translate(center.x, center.y); ctx.rotate(mirror * angle);
      ctx.beginPath();
      const tutu = cos && cos.style === 'tutu';
      ctx.ellipse(0, 0, size * (tutu ? 0.18 : 0.07), size * (tutu ? 0.18 : 0.045) * Math.cos(this.tiltAngle()), 0, 0, Math.PI * 2);
      ctx.fillStyle = cos ? cos.skirt : body; ctx.fill();
      ctx.strokeStyle = '#080c13'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
    // Arms use the shared pose joints, flattened vertically rather than drawn upright.
    stroke([project(figure.pelvis[0], 0, figure.pelvis[1]), project(figure.chest[0], 0, figure.chest[1])], body, Math.max(3, size * 0.055));
    figure.arms.forEach(arm => {
      stroke(arm.map(j => project(j[0], 0, j[1])), body, Math.max(2.5, size * 0.03));
    });
    stroke([project(-0.075, 0, figure.chest[1]), project(0.075, 0, figure.chest[1])], body, Math.max(3, size * 0.055));
    const head = project(figure.head[0], 0, figure.head[1]);
    const radius = Math.max(3, size * figure.headR);
    ctx.beginPath(); ctx.arc(head.x, head.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = cos ? cos.hair : darker(body, 0.55); ctx.fill();
    ctx.strokeStyle = 'rgba(235,242,252,.8)'; ctx.lineWidth = 1; ctx.stroke();
    const headAngle = (Number(at.headTurn) || 0) * Math.PI / 180 - angle;
    const nose = project(figure.head[0] + Math.sin(headAngle) * figure.headR * 1.4, Math.cos(headAngle) * figure.headR * 1.4, figure.head[1]);
    stroke([head, nose], '#f1cfad', Math.max(2, size * 0.024));
    ctx.restore();
  }

  // Two marks under a dancer: which foot is carrying her, and where the other one is. A planted
  // foot is filled and joined to her by a hairline; a free one is a hollow ring, because it is the
  // one she can move. A foot the position has off the deck is drawn faint, so an arabesque reads as
  // one foot down rather than as two. The floor is the one thing a choreographer reads a plan for,
  // and until now it was the one thing the plan did not draw.
  drawFeet(d, lt, solved = overheadPoseAtLocal(state.show, d, lt)) {
    if (!solved) return;
    const ctx = this.ctx;
    const feet = solved.feet;
    const R = Math.max(2.4, Math.min(7, 0.085 * this.scale));
    for (const side of ['left', 'right']) {
      const f = feet[side];
      if (!f) continue;
      const sp = this.w2s(f.x, f.y, f.h);
      if (f.unreachable && f.target && f.shortfall > 0.005) {
        const target = this.w2s(f.target.x, f.target.y, f.target.h);
        ctx.save();
        ctx.strokeStyle = THEME.danger;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(target.x, target.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(target.x - 3, target.y - 3); ctx.lineTo(target.x + 3, target.y + 3);
        ctx.moveTo(target.x - 3, target.y + 3); ctx.lineTo(target.x + 3, target.y - 3);
        ctx.stroke();
        ctx.restore();
      }
      // A foot more than a hand's width up is not on the floor at all, so it is drawn faint:
      // an arabesque should read as one foot down, not as two.
      const down = f.h <= 0.12;
      const held = f.held;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, held && down ? R : R * 0.8, 0, Math.PI * 2);
      if (held && down) {
        ctx.fillStyle = this.alpha(d.color, 0.95);
        ctx.fill();
        ctx.strokeStyle = 'rgba(6,10,16,.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.strokeStyle = this.alpha(d.color, down ? 0.7 : 0.3);
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
    }
  }

  // A stance foot that skates while she stands still leaves a line on the floor. Drawn over
  // everything, because it is a warning rather than a mark, and only for the dancer being edited:
  // on the leg the playhead is inside, or on the station being edited, which is where the number
  // in the strip comes from.
  drawSkate(d, lt) {
    const ctx = this.ctx;
    const show = state.show;
    const keys = d.keys || [];
    if (d.id !== state.ui.selectedId || !keys.length) return;
    let idx = 0;
    for (let i = 0; i < keys.length; i++) if (keys[i].t <= lt) idx = i;
    const skate = footSkate(show, d, idx);
    const onThisLeg = idx > 0 && lt <= keys[idx].t;
    if (!skate || (!onThisLeg && state.ui.stationIdx !== idx)) return;
    const from = footAtLocal(show, d, keys[idx - 1].t, skate.side);
    const to = footAtLocal(show, d, keys[idx].t, skate.side);
    if (!from || !to) return;
    const a = this.w2s(from.x, from.y);
    const b = this.w2s(to.x, to.y);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = THEME.danger;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Where it started, so the streak reads as a direction rather than a scratch.
    ctx.beginPath();
    ctx.arc(a.x, a.y, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = THEME.danger;
    ctx.fill();
    ctx.restore();
  }

  // A contact she cannot stay on. Where the skate is a foot that creeps while she stands still, this
  // is a foot that has to be let go because the step is longer than her leg: the mark she should be
  // standing on, and the line to where the leg actually runs out. Same rule as the skate — only the
  // dancer being edited, only on the leg the playhead is in or the station being edited — because a
  // floor full of red lines is a floor nobody can read.
  drawShort(d, lt) {
    const ctx = this.ctx;
    const show = state.show;
    const keys = d.keys || [];
    if (d.id !== state.ui.selectedId || !keys.length) return;
    let idx = 0;
    for (let i = 0; i < keys.length; i++) if (keys[i].t <= lt) idx = i;
    const short = legOverreach(show, d, idx);
    const onThisLeg = idx > 0 && lt <= keys[idx].t;
    if (!short || (!onThisLeg && state.ui.stationIdx !== idx)) return;
    const a = this.w2s(short.from.x, short.from.y);
    const b = this.w2s(short.to.x, short.to.y);
    ctx.save();
    // The mark she is not standing on: open, because a filled mark would say the weight is there.
    ctx.beginPath();
    ctx.arc(a.x, a.y, Math.max(2.4, Math.min(7, 0.085 * this.scale)), 0, Math.PI * 2);
    ctx.strokeStyle = THEME.danger;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // From that mark to where the leg runs out: the part of the step her leg cannot make.
    if (Math.hypot(b.x - a.x, b.y - a.y) > 1.5) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Where the foot really is, so the gap reads as a gap rather than as a stray line.
    ctx.beginPath();
    ctx.arc(b.x, b.y, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = THEME.danger;
    ctx.fill();
    ctx.restore();
  }

  alpha(hex, a) {
    const n = hex.replace('#', '');
    const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ---------------------------------------------------------- interaction */

  hitDancer(px, py) {
    const show = state.show;
    for (let i = show.cast.length - 1; i >= 0; i--) {
      const d = show.cast[i];
      if (!objectShown(d)) continue;
      const p = posOfContent(show, d, state.ui.playhead);
      if (!p) continue;
      const sp = this.w2s(p.x, p.y);
      const top = this.w2s(p.x, p.y, dancerHeight(show));
      if (distToSegment(px, py, sp.x, sp.y, top.x, top.y) < Math.max(11, 0.3 * this.scale)) return d;
    }
    return null;
  }

  hitStation(px, py) {
    if (state.ui.showStations === false) return null;
    let best = null;
    for (const d of this.pathBodies()) {
      if (!objectShown(d)) continue;
      const reach = d.id === state.ui.selectedId ? 11 : 8;
      d.keys.forEach((k, i) => {
        const sp = this.w2s(k.x, k.y);
        const dist = Math.hypot(sp.x - px, sp.y - py);
        if (dist <= reach && (!best || dist < best.dist)) best = { dancer: d, index: i, dist };
      });
    }
    return best;
  }

  hitLeg(px, py) {
    const show = state.show;
    const st = show.stage;
    const halfW = st.width / 2;
    const len = this.legLen();
    const half = 0.17;
    for (const leg of show.wingLegs) {
      const r = this.rect(
        leg.side * halfW,
        leg.y - half,
        leg.side * (halfW + len),
        leg.y + half
      );
      if (px >= r.x - 3 && px <= r.x + r.w + 3 && py >= r.y - 3 && py <= r.y + r.h + 3) return leg;
    }
    return null;
  }

  hitPath(px, py) {
    if (state.ui.showPaths === false) return null;
    let best = null;
    for (const d of this.pathBodies()) {
      if (!objectShown(d)) continue;
      const keys = d.keys;
      for (let i = 0; i < keys.length - 1; i++) {
        // A bowed leg is tested along its curve, or the arm of the bow would be unpickable
        // and the straight line it no longer follows would be pickable.
        const pts = legPoints(keys[i], keys[i + 1], 12).map((q) => this.w2s(q.x, q.y));
        for (let j = 0; j < pts.length - 1; j++) {
          const dist = distToSegment(px, py, pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y);
          if (dist <= 6 && (!best || dist < best.dist)) best = { dancer: d, index: i, dist };
        }
      }
    }
    return best;
  }

  // Where along a leg the pointer picked it: 0 at the station it leaves, 1 at the one it
  // arrives at. A bow is deepest at its middle, so a drag has to know which part of the
  // curve is under the mouse or the wrong point would follow it.
  legParam(a, b, w) {
    let bestU = 0.5;
    let bestD = Infinity;
    for (let i = 0; i <= 12; i++) {
      const q = curveAt(a, b, i / 12);
      const d = Math.hypot(q.x - w.x, q.y - w.y);
      if (d < bestD) {
        bestD = d;
        bestU = i / 12;
      }
    }
    return bestU;
  }

  hover(e) {
    if (e.target !== this.canvas) return;
    const p = this.local(e);
    if (this.hitStation(p.x, p.y)) this.canvas.style.cursor = 'grab';
    else if (this.hitLeg(p.x, p.y)) this.canvas.style.cursor = 'ns-resize';
    else if (this.hitLight(p.x, p.y)) this.canvas.style.cursor = 'move';
    else if (this.hitCloth(p.x, p.y)) this.canvas.style.cursor = 'move';
    else if (this.hitPath(p.x, p.y)) this.canvas.style.cursor = 'grab';
    else this.canvas.style.cursor = 'crosshair';
  }

  /* ---------------------------------------------------------------- lights */

  // What the lanterns put on the floor: a soft round pool for each one, at the
  // level its cues have it at this moment. A show with no lights draws nothing,
  // which is what a dark stage looks like.
  drawLightPools() {
    const lights = state.show.lights || [];
    if (!lights.length) return;
    const ctx = this.ctx;
    for (const l of lights) {
      if (l.visible === false) continue;
      const level = lightLevelAt(l, state.ui.playhead);
      if (level <= 0.005) continue;
      const spot = lightSpot(state.show, l, state.ui.playhead);
      // A follow spot goes where its performer goes, and a performer in the wings is
      // off stage: there is no pool out there to draw.
      if (spot.follow && Math.abs(spot.x) > state.show.stage.width / 2) continue;
      const p = this.w2s(spot.x, spot.z);
      const r = Math.max(3, (l.spread / 2) * this.scale);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      if (l.type === 'flood') {
        // A flood has no lens edge: the wash is nearly even and dies at the rim.
        grad.addColorStop(0, hexA(l.color, 0.22 * level));
        grad.addColorStop(0.5, hexA(l.color, 0.19 * level));
        grad.addColorStop(1, hexA(l.color, 0.01 * level));
      } else {
        // A spot has a hot middle and a rim you can point at.
        grad.addColorStop(0, hexA(l.color, 0.4 * level));
        grad.addColorStop(0.6, hexA(l.color, 0.24 * level));
        grad.addColorStop(0.94, hexA(l.color, 0.09 * level));
        grad.addColorStop(1, hexA(l.color, 0));
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (l.gobo && l.gobo !== 'none') this.drawGobo(l, p, r, level);
    }
  }

  // A gobo is a template in the gate, so the pool takes its shape. Drawn brighter
  // than the pool it sits in, because a gobo is light that got through holes.
  drawGobo(l, p, r, level) {
    const ctx = this.ctx;
    const a = Math.min(1, 0.35 + 0.55 * level);
    ctx.save();
    if (l.gobo === 'window') {
      // A pane, a frame and two mullions: the shape says "window" from across the
      // room, which is the whole job of a gobo.
      const side = r * 1.15;
      const x = p.x - side / 2;
      const y = p.y - side / 2;
      ctx.strokeStyle = hexA(l.color, a * 0.85);
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x + 0.5, y + 0.5, side, side);
      ctx.beginPath();
      ctx.moveTo(p.x, y);
      ctx.lineTo(p.x, y + side);
      ctx.moveTo(x, p.y);
      ctx.lineTo(x + side, p.y);
      ctx.stroke();
      ctx.lineWidth = 1;
    } else if (l.gobo === 'dapple') {
      // Leaves: overlapping soft patches, so a break-up reads as shadow, not speckle.
      ctx.fillStyle = hexA(l.color, a * 0.5);
      for (let i = 0; i < 9; i++) {
        const ang = i * 2.399963;
        const rad = Math.sqrt((i + 0.5) / 9) * 0.72 * r;
        ctx.beginPath();
        ctx.ellipse(p.x + Math.cos(ang) * rad, p.y + Math.sin(ang) * rad, r * 0.17, r * 0.12, ang, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // A star field is a scatter, not a ring. A golden-angle spiral spreads the
      // stars evenly without a random number that would flicker frame to frame.
      const n = 24;
      ctx.fillStyle = hexA(l.color, a * 0.9);
      for (let i = 0; i < n; i++) {
        const ang = i * 2.399963;
        const rad = Math.sqrt((i + 0.5) / n) * 0.86 * r;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(ang) * rad, p.y + Math.sin(ang) * rad, 0.7 + ((i * 7) % 5) * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // The fixture on the plan: a ring with an eye in it and four cross hairs, so a
  // lantern never reads as one more dancer.
  drawLightMarkers() {
    const lights = state.show.lights || [];
    if (!lights.length) return;
    const ctx = this.ctx;
    for (const l of lights) {
      // A follow spot has no marker of its own: it sits on the performer, whose body
      // is already a thing you click. Its beam in the elevation and its row say so.
      if (l.followId) continue;
      const p = this.w2s(l.x, l.z);
      const focused = state.ui.lightId === l.id;
      const off = l.visible === false;
      const level = off ? 0 : lightLevelAt(l, state.ui.playhead);
      ctx.beginPath();
      ctx.arc(p.x, p.y, focused ? 8 : 6.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8,11,16,.82)';
      ctx.fill();
      ctx.strokeStyle = focused ? THEME.accent : hexA(l.color, off ? 0.32 : 0.85);
      ctx.lineWidth = focused ? 2 : 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.7, 0, Math.PI * 2);
      ctx.fillStyle = hexA(l.color, Math.max(0.2, level));
      ctx.fill();
      ctx.strokeStyle = focused ? THEME.accent : hexA(l.color, off ? 0.22 : 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - 11, p.y);
      ctx.lineTo(p.x - 8, p.y);
      ctx.moveTo(p.x + 8, p.y);
      ctx.lineTo(p.x + 11, p.y);
      ctx.moveTo(p.x, p.y - 11);
      ctx.lineTo(p.x, p.y - 8);
      ctx.moveTo(p.x, p.y + 8);
      ctx.lineTo(p.x, p.y + 11);
      ctx.stroke();
      if (focused && !state.ui.watch) {
        // The name and the number that matter: where it is, and how bright. Not in
        // a run-through, where nobody is editing anything.
        const text = l.name + ' \u00b7 ' + Math.round(level * 100) + '%';
        ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
        const tw = ctx.measureText(text).width;
        const lx = Math.min(Math.max(p.x - tw / 2, 6), this.canvas.clientWidth - tw - 8);
        const ly = Math.max(16, p.y - 16);
        ctx.fillStyle = 'rgba(8,11,16,.9)';
        ctx.fillRect(lx - 5, ly - 10, tw + 10, 14);
        ctx.fillStyle = THEME.accent;
        ctx.fillText(text, lx, ly);
      }
    }
  }

  // Which lantern's marker is under the pointer. Deliberately small: a light is a
  // point on the plan, not a region, so it must not steal clicks from the floor.
  hitLight(px, py) {
    let best = null;
    let bestD = 13;
    for (const l of state.show.lights || []) {
      if (l.visible === false || l.followId) continue;
      const p = this.w2s(l.x, l.z);
      const d = Math.hypot(px - p.x, py - p.y);
      if (d <= bestD) {
        bestD = d;
        best = l;
      }
    }
    return best;
  }

  hitProp(px, py, want) {
    const show = state.show;
    for (let i = show.scenery.length - 1; i >= 0; i--) {
      const s = show.scenery[i];
      if (s.kind !== 'prop' || !objectShown(s)) continue;
      if (want && !want(s)) continue;
      const p = propPosOfContent(show, s, state.ui.playhead);
      const r = this.rect(p.x - s.w / 2, p.y, p.x + s.w / 2, p.y + s.d);
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return s;
    }
    return null;
  }

  /* Clicking a point, a path or a body, in that order. */

  onDown(e) {
    // A run-through is for watching: the stage takes no clicks.
    if (state.ui.watch) return;
    // A refusal from the last click has been read by now; this one speaks for itself.
    state.ui.hint = null;
    const p = this.local(e);
    if (!this.compact && state.ui.fill === 'plan' && state.ui.tiltMode) {
      if (e.button !== 0) return;
      e.preventDefault();
      this.grab = { type: 'tilt', y: e.clientY, angle: Number(state.ui.planTilt) || 0 };
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (this.compact) {
      const d = this.hitDancer(p.x, p.y);
      if (d) this.app.select(d.id);
      return;
    }

    // A station under the cursor wins over everything else: it becomes the
    // point being edited, and dragging moves that point rather than the body.
    const station = this.hitStation(p.x, p.y);
    if (station) {
      this.app.focusStation(station.dancer, station.index);
      this.grab = {
        type: 'dancer',
        dancer: station.dancer,
        key: station.dancer.keys[station.index],
        moved: false,
      };
      return;
    }

    // While placing, a click on open stage adds the next station. This sits
    // above path and leg picking so building a path is not interrupted by the
    // path that is already there.
    if (state.ui.placingStations) {
      const sel = findObject(state.show, state.ui.selectedId);
      if (!sel) {
        state.ui.hint = 'Select a dancer or prop first';
        return;
      }
      if (sel.carriedBy) {
        // A carried prop takes its position from its dancer, so stations would
        // be ignored while carrying. Detach it first.
        state.ui.hint = 'This prop is carried by its dancer — set Carry to “not carried” to give it stations';
        return;
      }
      const w = this.s2w(p.x, p.y);
      const st = state.show.stage;
      const step = st.grid / 2;
      let x = w.x;
      let y = w.y;
      if (state.ui.snap && !e.altKey) {
        x = Math.round(x / step) * step;
        y = Math.round(y / step) * step;
      }
      const mx = st.width / 2 + st.wingDepth - 0.4;
      commit();
      const key = addStation(sel, Math.max(-mx, Math.min(mx, x)), Math.max(0.35, Math.min(st.depth - 0.35, y)));
      this.app.focusStation(sel, sel.keys.indexOf(key));
      this.app.rebuild();
      return;
    }

    // A wing leg is scenery you can pull up and down the wing.
    const leg = this.hitLeg(p.x, p.y);
    if (leg) {
      const w0 = this.s2w(p.x, p.y);
      const others = state.show.wingLegs
        .filter((l) => l.side === leg.side && l !== leg)
        .map((l) => l.y)
        .sort((a, b) => a - b);
      this.grab = {
        type: 'leg',
        leg,
        offY: leg.y - w0.y,
        moved: false,
        lower: others.filter((y) => y < leg.y).pop(),
        upper: others.filter((y) => y > leg.y).shift(),
      };
      return;
    }

    // A carried prop sits against its dancer, so its body is picked before the
    // paths that run underneath it. Otherwise adjusting where it rides would
    // select the dancer whose path happens to pass by.
    const carried = this.hitProp(p.x, p.y, (s) => !!s.carriedBy);
    if (carried) {
      this.app.select(carried.id);
      this.grab = { type: 'carry', prop: carried, moved: false };
      return;
    }

    // Clicking the path itself focuses that performer without picking a point — and
    // dragging it bows the leg, which is the only way to shape a sweep by eye.
    const onPath = this.hitPath(p.x, p.y);
    if (onPath) {
      this.app.select(onPath.dancer.id);
      state.ui.stationIdx = null;
      const w0 = this.s2w(p.x, p.y);
      const keys = onPath.dancer.keys;
      const u = this.legParam(keys[onPath.index], keys[onPath.index + 1], w0);
      this.grab = { type: 'bend', dancer: onPath.dancer, index: onPath.index, from: w0, u, moved: false };
      return;
    }

    const d = this.hitDancer(p.x, p.y);
    if (d) {
      this.app.select(d.id);
      const show = state.show;
      const lt = localOfContent(show, d.id, state.ui.playhead);
      // A station already picked wins, so dragging moves that point instead of
      // dropping a new keyframe near the playhead.
      const picked = state.ui.stationIdx;
      let key = Number.isInteger(picked) && d.keys[picked]
        ? d.keys[picked]
        : d.keys.find((k) => Math.abs(k.t - lt) < 120);
      if (!key) {
        commit();
        const w = this.s2w(p.x, p.y);
        key = { t: lt, x: w.x, y: w.y };
        d.keys.push(key);
        d.keys.sort((a, b) => a.t - b.t);
      }
      // The undo step is taken on the first actual move, so selecting a point
      // does not fill the history with no-ops.
      this.grab = { type: 'dancer', dancer: d, key, moved: false };
      return;
    }

    const prop = this.hitProp(p.x, p.y);
    if (prop) {
      this.app.select(prop.id);
      if (prop.carriedBy) {
        // Dragging a carried prop moves it around its dancer, not along a path.
        this.grab = { type: 'carry', prop, moved: false };
        return;
      }
      const keys = prop.keys || [];
      if (keys.length) {
        // A timed prop drags its station, the same way a dancer does.
        const lt = localOfContent(state.show, prop.id, state.ui.playhead);
        const picked = state.ui.stationIdx;
        let key = Number.isInteger(picked) && keys[picked]
          ? keys[picked]
          : keys.find((k) => Math.abs(k.t - lt) < 120);
        if (!key) {
          commit();
          const w = this.s2w(p.x, p.y);
          key = { t: lt, x: w.x, y: w.y, dur: 1500 };
          keys.push(key);
          keys.sort((a, b) => a.t - b.t);
        }
        this.grab = { type: 'dancer', dancer: prop, key, moved: false };
        return;
      }
      commit();
      this.grab = { type: 'prop', prop, dx: prop.x - this.s2w(p.x, p.y).x, dy: prop.y - this.s2w(p.x, p.y).y };
      return;
    }

    // A lantern's marker comes before the cloth bands, because a pool usually
    // lands on the wide band of a front curtain and the fixture must still be
    // grabbable. It comes after the cast, so a dancer standing in the light can
    // be picked by their body.
    const lamp = this.hitLight(p.x, p.y);
    if (lamp) {
      this.app.focusLight(lamp.id);
      this.grab = { type: 'light', light: lamp, moved: false };
      return;
    }

    // Cloth comes last, so a dancer or prop standing on its band is still
    // picked first; where the band is clear, dragging it sets its depth.
    const cloth = this.hitCloth(p.x, p.y);
    if (cloth) {
      const w = this.s2w(p.x, p.y);
      this.grab = {
        type: 'cloth',
        item: cloth,
        offX: clothX(cloth) - w.x,
        offY: clothDepth(cloth) - w.y,
        // Remembered so a sideways-only drag does not pin a curtain's depth.
        depth0: clothDepth(cloth),
        // Read by the drag readout, which says whether it is on the grid.
        snapped: state.ui.snap && !e.altKey,
        moved: false,
      };
    }
  }

  // The band each curtain or drop occupies on the plan, front-most first.
  hitCloth(px, py) {
    const show = state.show;
    const bands = show.scenery
      .filter((s) => s.kind !== 'prop')
      .sort((a, b) => clothDepth(a) - clothDepth(b));
    for (const item of bands) {
      const y = this.sceneryY(item);
      const thick = clothThick(item);
      const cx = clothX(item);
      const span = clothSpan(item);
      const r = this.rect(cx - span / 2, y, cx + span / 2, y + thick);
      if (px >= r.x - 5 && px <= r.x + r.w + 5 && py >= r.y - 5 && py <= r.y + r.h + 5) return item;
    }
    return null;
  }

  onContext(e) {
    e.preventDefault();
    if (this.compact || state.ui.watch || (state.ui.fill === 'plan' && state.ui.tiltMode)) return;
    const p = this.local(e);
    const hit = this.hitStation(p.x, p.y);
    if (hit) this.app.deleteFrom(hit.dancer, hit.index);
  }

  onMove(e) {
    if (this.compact) return;
    if (!this.grab) {
      if (state.ui.fill === 'plan' && state.ui.tiltMode) {
        this.canvas.style.cursor = 'ns-resize';
        return;
      }
      this.hover(e);
      return;
    }
    if (this.grab.type === 'tilt') {
      state.ui.planTilt = Math.max(0, Math.min(55, this.grab.angle + (e.clientY - this.grab.y) * 0.25));
      this.draw();
      return;
    }
    const p = this.local(e);
    const w = this.s2w(p.x, p.y);
    const st = state.show.stage;
    const snap = state.ui.snap && !e.altKey;
    const step = st.grid / 2;

    if (this.grab.type === 'bend') {
      // The bow is how far the middle of the leg sits from the straight line, so the
      // pointer is measured against that line's normal rather than followed directly.
      const g = this.grab;
      const a = g.dancer.keys[g.index];
      const b = g.dancer.keys[g.index + 1];
      if (!a || !b) return;
      // A click that wobbles is still a click: picking a path to focus its performer must
      // not bow it, so nothing moves until the pointer has actually travelled.
      if (!g.moved && Math.hypot(w.x - g.from.x, w.y - g.from.y) < 0.08) return;
      if (!g.moved) {
        commit();
        g.moved = true;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const off = ((w.x - mid.x) * -dy + (w.y - mid.y) * dx) / len;
      // A quadratic sits 4u(1−u) of the bow's depth off the chord at parameter u, so the
      // offset the pointer asks for is divided by that weight: grab the arm of a bow two
      // metres out and the arm goes with the mouse instead of the middle drifting away from
      // it. The floor keeps a grab at a station itself from asking for an endless bow.
      const weight = Math.max(0.35, 4 * (Number.isFinite(g.u) ? g.u : 0.5) * (1 - (Number.isFinite(g.u) ? g.u : 0.5)));
      let bend = off / weight;
      if (snap) bend = Math.round(bend / step) * step;
      b.bend = Math.max(-BEND_LIMIT, Math.min(BEND_LIMIT, bend));
    } else if (this.grab.type === 'dancer') {
      if (!this.grab.moved) {
        commit();
        this.grab.moved = true;
      }
      let x = w.x;
      let y = w.y;
      if (snap) {
        x = Math.round(x / step) * step;
        y = Math.round(y / step) * step;
      }
      const mx = st.width / 2 + st.wingDepth - 0.4;
      this.grab.key.x = Math.max(-mx, Math.min(mx, x));
      this.grab.key.y = Math.max(0.35, Math.min(st.depth - 0.35, y));
    } else if (this.grab.type === 'leg') {
      if (!this.grab.moved) {
        commit();
        this.grab.moved = true;
      }
      const leg = this.grab.leg;
      const lo = Math.max(0.45, Number.isFinite(this.grab.lower) ? this.grab.lower + 0.6 : 0.45);
      const hi = Math.min(st.depth - 0.45, Number.isFinite(this.grab.upper) ? this.grab.upper - 0.6 : st.depth - 0.45);
      const y = w.y + this.grab.offY;
      leg.y = hi > lo ? Math.min(Math.max(y, lo), hi) : (lo + hi) / 2;
    } else if (this.grab.type === 'cloth') {
      if (!this.grab.moved) {
        commit();
        this.grab.moved = true;
      }
      const item = this.grab.item;
      let x = w.x + this.grab.offX;
      let y = w.y + this.grab.offY;
      // Cloth lands on the floor's own grid lines rather than the half-steps a
      // dancer uses, so the Depth field reads 3.0 rather than 2.85. Alt suspends
      // snapping here the same way it does everywhere else on the plan.
      const cstep = st.grid;
      this.grab.snapped = snap;
      if (snap) {
        x = Math.round(x / cstep) * cstep;
        y = Math.round(y / cstep) * cstep;
      }
      item.y = Math.max(0.2, Math.min(st.depth - 0.2, y));
      item.x = clampClothX(x, clothSpan(item));
      // Dragging depth is how a piece is placed by hand, so it is pinned there;
      // sliding the same piece sideways leaves it in its layer.
      if (item.kind === 'curtain' && Math.abs(item.y - this.grab.depth0) > 1e-6) item.depthSet = true;
    } else if (this.grab.type === 'light') {
      if (!this.grab.moved) {
        commit();
        this.grab.moved = true;
      }
      const l = this.grab.light;
      let x = w.x;
      let y = w.y;
      // The same half-grid a dancer lands on: a light is placed by eye, and the
      // numbers above it should read like the rest of the stage.
      if (snap) {
        x = Math.round(x / step) * step;
        y = Math.round(y / step) * step;
      }
      const halfW = st.width / 2;
      l.x = Math.max(-halfW, Math.min(halfW, x));
      l.z = Math.max(0, Math.min(st.depth, y));
    } else if (this.grab.type === 'carry') {
      if (!this.grab.moved) {
        commit();
        this.grab.moved = true;
      }
      const prop = this.grab.prop;
      // At this moment the prop may already be in someone else's hands.
      const carrier = carrierOf(state.show, prop, state.ui.playhead);
      const base = carrier ? posOfContent(state.show, carrier, state.ui.playhead) : null;
      if (base) {
        prop.carryOffset = {
          x: Math.max(-2.5, Math.min(2.5, w.x - base.x)),
          y: Math.max(-2.5, Math.min(2.5, w.y - base.y)),
        };
      }
    } else if (this.grab.type === 'prop') {
      const prop = this.grab.prop;
      prop.x = w.x + this.grab.dx;
      prop.y = w.y + this.grab.dy;
      if (snap) {
        prop.x = Math.round(prop.x / step) * step;
        prop.y = Math.round(prop.y / step) * step;
      }
    }
  }

  onUp() {
    if (!this.grab) return;
    const kind = this.grab.type;
    this.grab = null;
    if (kind === 'tilt') {
      this.canvas.dispatchEvent(new Event('viewtiltchange'));
      return;
    }
    // A moved leg, light or cloth changes the numbers in the panel, so redraw that too.
    if (kind === 'leg' || kind === 'cloth' || kind === 'light') this.app.rebuild();
    else if (kind === 'bend') {
      // The station strip and the inspector show the bow as a number, so they are stale
      // the moment it is dragged.
      persist();
      this.app.rebuild();
    } else persist();
  }
}
