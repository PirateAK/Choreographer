// Elevation: the stage as the house sees it — width across, height up. The plan
// answers "where", this answers "how high, and can the audience see it".
import {
  THEME, state, posOfContent, propPosOfContent, objectShown, sceneryStateAt,
  clothSpan, clothX, clothDepth, curtainLegW, lightLevelAt, lightSpot, costumeOf, evaluateMovement,
  localOfContent, dancerHeight,
} from './model.js';
import { drawPose, darker } from './pose.js';

// The opening and dancer heights are stage settings; each curtain and drop carries
// its own height, so a border can hang at 3 m beside an 8 m backdrop.
function taller() {
  const st = state.show.stage;
  return {
    opening: Number.isFinite(st.openingH) ? st.openingH : 7.5,
    dancer: Number.isFinite(st.dancerH) ? st.dancerH : 1.7,
  };
}

// A flat elevation cannot show distance on its own: a dancer on the lip and one at
// the back wall draw the same size, which is the one thing the house never sees. The
// audience sits a real distance away, so a figure `y` metres upstage is HOUSE + y away
// instead and reads smaller by HOUSE / (HOUSE + y) — at 16 m, a dancer at the back of
// a 9 m stage is about two thirds the size of one on the lip. It can be turned off,
// because it is a picture rather than a measurement: heights are judged with it off.
const HOUSE_DIST = 16;
function depthScale(y) {
  if (state.ui.depth === false) return 1;
  const d = Math.max(0, Number(y) || 0);
  return HOUSE_DIST / (HOUSE_DIST + d);
}

// Falls back to a house-plausible height only for a show that predates item heights.
function clothH(item) {
  const h = Number(item.h);
  if (Number.isFinite(h)) return Math.max(0.5, Math.min(20, h));
  return item.kind === 'drop' ? Math.max(1, taller().opening * 0.8) : Math.max(2, taller().opening - 1.1);
}

export class ElevationView {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.app = app;
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    // Screen boxes of everything drawn this frame, back to front, so a click can
    // find the nearest thing under the cursor.
    this.hits = [];
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onHover(e));
  }

  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  hitAt(p) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h;
    }
    return null;
  }

  // Clicking a figure focuses it, the same as clicking it on the plan. Cloth in
  // the way is cloth in the way: you cannot click what the audience cannot see.
  onDown(e) {
    // Nothing here is a control in a run-through.
    if (state.ui.watch) return;
    const hit = this.hitAt(this.local(e));
    if (!hit || !hit.id) return;
    if (hit.id !== state.ui.selectedId) this.app.select(hit.id);
  }

  onHover(e) {
    if (state.ui.watch) return;
    const hit = this.hitAt(this.local(e));
    this.canvas.style.cursor = hit && hit.id ? 'pointer' : 'default';
  }

  record(x0, y0, x1, y1, id) {
    this.hits.push({
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      w: Math.abs(x1 - x0),
      h: Math.abs(y1 - y0),
      id: id || null,
    });
  }

  // Plan metres to screen pixels: x across the opening, z up from the floor.
  p2s(x, z) {
    return { x: this.ox + x * this.scale, y: this.oy - z * this.scale };
  }

  layerDepth(item) {
    return clothDepth(item);
  }

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
    ctx.fillStyle = '#080b10';
    ctx.fillRect(0, 0, w, h);

    this.hits = [];
    const st = show.stage;
    const padX = 54;
    const padTop = 14;
    const padBottom = 18;
    const H = taller();
    // The editor sets one scale for the plan and this view together, so the opening
    // here is the same 12 m as the floor above it and the legs line up at full open.
    // A run-through has no shared scale — the plan takes the window there — so this
    // adopts the plan's, unless that would not fit, and then it shrinks on its own.
    const fit = Math.max(0.4, Math.min((w - padX * 2) / st.width, (h - padTop - padBottom) / H.opening));
    const planScale = this.app && this.app.stage ? this.app.stage.scale : null;
    // Filling the centre, this view is the only one drawing, so there is no metre to
    // match and the plan's scale is a memory of a panel that is not on screen.
    const alone = state.ui.fill === 'elevation';
    const s = state.ui.viewScale || (alone || !(planScale > 0) ? fit : Math.min(fit, planScale));
    this.scale = s;
    this.ox = w / 2;
    // The deck sits on the bottom margin, unless the pane is taller than the drawing
    // needs — a run-through gives both views an equal row — and then it is centred
    // rather than left floating at the foot of an empty pane.
    const drawn = s * H.opening;
    const spare = Math.max(0, h - padTop - padBottom - drawn);
    this.oy = padBottom + spare / 2 + drawn;

    const halfW = st.width / 2;
    const floor = this.p2s(0, 0).y;
    const top = this.p2s(0, H.opening).y;

    // The opening itself: everything is clipped to it, so a flown drop really
    // does leave the picture.
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.p2s(-halfW, 0).x, top, st.width * s, floor - top);
    ctx.clip();

    // Back wall, then floor.
    ctx.fillStyle = '#0c1119';
    ctx.fillRect(this.p2s(-halfW, 0).x, top, st.width * s, floor - top);
    ctx.fillStyle = '#121924';
    const floorBand = this.p2s(0, -0.35).y;
    ctx.fillRect(this.p2s(-halfW, 0).x, floor, st.width * s, floorBand - floor);

    // Upstage shading: the wall behind everything.
    ctx.fillStyle = 'rgba(255,255,255,.02)';
    ctx.fillRect(this.p2s(-halfW, 0).x, top, st.width * s, floor - top);

    // Words about the cloth are collected while it is drawn and placed afterwards:
    // two curtains hung in the same place hang to the same height, and their names
    // would otherwise print exactly on top of each other.
    this.clothNotes = [];
    this.drawBodies();
    // Light falls on what is there, so the beams go over the cloth and the cast.
    this.drawLights();

    ctx.restore();

    this.drawRuler(halfW, top, floor);
    this.drawFrame(halfW, top);
    this.drawClothNotes();
    this.drawFlownOut(halfW, top);
    this.drawTitle(w);
  }

  // Upstage first, so a downstage curtain covers what stands behind it.
  drawBodies() {
    const show = state.show;
    const items = [];
    for (const s of show.scenery) {
      if (s.kind === 'prop' || s.visible === false) continue;
      items.push({ kind: 'cloth', item: s, depth: this.layerDepth(s) });
    }
    for (const d of show.cast) {
      if (!objectShown(d)) continue;
      const p = posOfContent(show, d, state.ui.playhead);
      if (p) items.push({ kind: 'dancer', item: d, depth: p.y, p });
    }
    for (const pr of show.scenery) {
      if (pr.kind !== 'prop' || !objectShown(pr)) continue;
      const p = propPosOfContent(show, pr, state.ui.playhead);
      if (p) items.push({ kind: 'prop', item: pr, depth: p.y, p });
    }
    items.sort((a, b) => b.depth - a.depth);
    for (const it of items) {
      if (it.kind === 'cloth') this.drawCloth(it.item);
      else if (it.kind === 'dancer') this.drawDancer(it.item, it.p);
      else this.drawProp(it.item, it.p);
    }
  }

  // Lighting, as the house sees it: a beam from the bottle down to the pool it
  // washes, and the wash along the deck. Nothing here is clickable — this view is
  // a picture, and the lantern is picked on the plan or in its list.
  drawLights() {
    const lights = state.show.lights || [];
    if (!lights.length) return;
    const ctx = this.ctx;
    const opening = taller().opening;
    for (const l of lights) {
      if (l.visible === false) continue;
      const level = lightLevelAt(l, state.ui.playhead);
      const h = Number.isFinite(l.h) ? Math.max(0.5, Math.min(20, l.h)) : opening - 1.5;
      const spread = Number.isFinite(l.spread) ? Math.max(0.4, l.spread) : 3.2;
      // A follow spot is drawn where its performer is, so an elevation at a moment
      // shows the beam actually on them.
      const spot = lightSpot(state.show, l, state.ui.playhead);
      const base = this.p2s(spot.x, 0);
      const top = this.p2s(spot.x, h);
      const a = this.p2s(spot.x - spread / 2, 0);
      const b = this.p2s(spot.x + spread / 2, 0);
      if (level > 0.005) {
        // A spot is a cone with an edge; a flood leaves the lens wide and soft.
        const flood = l.type === 'flood';
        const beam = ctx.createLinearGradient(0, top.y, 0, base.y);
        beam.addColorStop(0, this.alpha(l.color, (flood ? 0.2 : 0.3) * level));
        beam.addColorStop(1, this.alpha(l.color, (flood ? 0.07 : 0.07) * level));
        ctx.fillStyle = beam;
        const lens = flood ? 9 : 2.5;
        ctx.beginPath();
        ctx.moveTo(top.x - lens, top.y);
        ctx.lineTo(top.x + lens, top.y);
        ctx.lineTo(b.x, base.y);
        ctx.lineTo(a.x, base.y);
        ctx.closePath();
        ctx.fill();
        // The pool seen edge-on: a wash across the deck, brightest at its middle.
        const wash = ctx.createLinearGradient(a.x, 0, b.x, 0);
        wash.addColorStop(0, this.alpha(l.color, 0));
        wash.addColorStop(0.5, this.alpha(l.color, 0.6 * level));
        wash.addColorStop(1, this.alpha(l.color, 0));
        ctx.fillStyle = wash;
        ctx.fillRect(a.x, base.y - 1.5, Math.max(1, b.x - a.x), 3.5);
        // A gobo, seen edge-on: the pool on the deck is a line, so its pattern is a
        // line of marks — panes for a window, leaves for dapple, stars for stars.
        if (l.gobo && l.gobo !== 'none') this.drawGoboWash(l, a.x, b.x, base.y, level);
      }
      // The bottle: a small ring at its height, with a stub above it to the pipe.
      // Out of sight above the header it simply is not drawn, which is honest.
      if (h <= opening + 0.4) {
        const off = l.visible === false;
        ctx.strokeStyle = off ? 'rgba(120,140,165,.35)' : this.alpha(l.color, 0.9);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(top.x, top.y, 2.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(top.x, top.y - 2.8);
        ctx.lineTo(top.x, top.y - 6);
        ctx.stroke();
        ctx.fillStyle = off ? 'rgba(8,11,16,.5)' : this.alpha(l.color, Math.max(0.2, level));
        ctx.beginPath();
        ctx.arc(top.x, top.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // The pool seen edge-on, patterned by whatever is in the gate.
  drawGoboWash(l, x0, x1, y, level) {
    const ctx = this.ctx;
    const w = Math.max(6, x1 - x0);
    const a = Math.min(1, 0.4 + 0.5 * level);
    ctx.save();
    if (l.gobo === 'window') {
      // Three panes with the mullions showing between them.
      const pane = w / 3.8;
      ctx.fillStyle = this.alpha(l.color, a);
      for (let i = 0; i < 3; i++) ctx.fillRect(x0 + pane * 0.45 + i * pane * 1.15, y - 2.5, pane * 0.85, 5);
    } else if (l.gobo === 'dapple') {
      ctx.fillStyle = this.alpha(l.color, a * 0.8);
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.ellipse(x0 + w * ((i + 0.5) / 7), y, Math.max(1.6, w * 0.045), 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = this.alpha(l.color, a);
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        ctx.arc(x0 + w * ((i + 0.5) / 14), y - 1, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawCloth(item) {
    const ctx = this.ctx;
    const now = sceneryStateAt(item, state.ui.playhead);
    const halfW = state.show.stage.width / 2;

    if (item.kind === 'card') {
      // A card stands on the deck in front of everything, at its own height, and
      // is either there or not — so it is drawn opaque, the way a board would look
      // from the house, and gone entirely when it is off.
      const shown = Math.max(0, Math.min(1, now.shown));
      if (shown <= 0.02) return;
      const cx = clothX(item);
      const span = clothSpan(item);
      const a = this.p2s(cx - span / 2, 0);
      const b = this.p2s(cx + span / 2, clothH(item));
      ctx.fillStyle = item.color;
      ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
      ctx.strokeStyle = 'rgba(42,35,24,.9)';
      ctx.strokeRect(a.x + 0.5, b.y + 0.5, b.x - a.x - 1, a.y - b.y - 1);
      this.record(a.x, b.y, b.x, a.y, null);
      // The words, as the house reads them.
      const text = String(item.text || '');
      if (text) {
        const room = Math.max(16, b.x - a.x - 4);
        let size = 10;
        ctx.font = '600 ' + size + 'px "Segoe UI", system-ui, sans-serif';
        const wide = ctx.measureText(text).width;
        if (wide > room) {
          size = Math.max(5, Math.floor((size * room) / wide));
          ctx.font = '600 ' + size + 'px "Segoe UI", system-ui, sans-serif';
        }
        ctx.fillStyle = 'rgba(20,16,10,.9)';
        ctx.textAlign = 'center';
        ctx.fillText(text, (a.x + b.x) / 2, (a.y + b.y) / 2 + size * 0.35, room);
        ctx.textAlign = 'left';
      }
      this.note(item.name, (a.x + b.x) / 2, b.y - 4);
      return;
    }

    if (item.kind === 'drop') {
      const fly = Math.max(0, Math.min(1, now.fly));
      // Flown out means lifted above the opening, not faded away.
      const bottom = (1 - fly) * taller().opening;
      const topZ = bottom + clothH(item);
      const dx = clothX(item);
      const span = clothSpan(item);
      const a = this.p2s(dx - span / 2, bottom);
      const b = this.p2s(dx + span / 2, topZ);
      if (b.y >= a.y) return;
      // Opaque on purpose: a drop that let the one behind show through could not
      // hide a change, which is the whole reason the stack is flown.
      ctx.fillStyle = item.color;
      ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
      ctx.strokeStyle = this.alpha(item.color, 1);
      ctx.strokeRect(a.x + 0.5, b.y + 0.5, b.x - a.x - 1, a.y - b.y - 1);
      this.record(a.x, b.y, b.x, a.y, null);
      // vertical seams read as cloth
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      const seams = Math.max(4, Math.round(span / 0.5));
      for (let i = 1; i < seams; i++) {
        const fx = a.x + ((b.x - a.x) / seams) * i;
        ctx.beginPath();
        ctx.moveTo(fx, b.y + 1);
        ctx.lineTo(fx, a.y - 1);
        ctx.stroke();
      }
      // A drop lifted clear of the opening is named above the frame instead, so it
      // does not read as a piece still standing in the picture.
      if (bottom < taller().opening - 0.02) this.note(item.name, (a.x + b.x) / 2, a.y - 4);
      return;
    }

    // A curtain hangs as two legs; `open` is how far they have parted, and it
    // parts within its own span rather than across the whole opening.
    const open = Math.max(0, Math.min(1, now.open));
    const cx = clothX(item);
    const span = clothSpan(item);
    const legW = curtainLegW(span, open);
    for (const side of [-1, 1]) {
      const x0 = side === -1 ? cx - span / 2 : cx + span / 2 - legW;
      const a = this.p2s(x0, 0);
      const b = this.p2s(x0 + legW, clothH(item));      // Also opaque: a closed curtain has to mask a fly happening behind it, and
      // the audience is not meant to see the crew work.
      ctx.fillStyle = item.color;
      ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
      ctx.strokeStyle = this.alpha(item.color, 1);
      ctx.strokeRect(a.x + 0.5, b.y + 0.5, b.x - a.x - 1, a.y - b.y - 1);

      this.record(a.x, b.y, b.x, a.y, null);
      ctx.strokeStyle = 'rgba(0,0,0,.3)';
      const folds = Math.max(2, Math.round(legW / 0.35));
      for (let i = 1; i < folds; i++) {
        const fx = a.x + ((b.x - a.x) / folds) * i;
        ctx.beginPath();
        ctx.moveTo(fx, b.y + 1);
        ctx.lineTo(fx, a.y - 1);
        ctx.stroke();
      }
    }
    this.note(item.name, this.p2s(cx, 0).x, this.oy - clothH(item) * this.scale - 4);
  }

  drawDancer(d, p) {
    const ctx = this.ctx;
    const feet = this.p2s(p.x, 0);
    // Further upstage is further from the house, so the figure is smaller about the
    // same feet. The click box shrinks with it, because it is the same drawing.
    const s = this.scale * depthScale(p.y);
    const focused = d.id === state.ui.selectedId;

    // The position the station carries, eased towards the next one: this is what turns
    // a marker sliding across the stage into a dancer doing fifth, then arabesque.
    const { at, lvl, spec, pins } = evaluateMovement(state.show, d, localOfContent(state.show, d.id, state.ui.playhead));
    // The feet she is standing on, so the drawing can bend her legs over them instead of letting the
    // position drag them across the floor. How the feet meet the floor comes from the same evaluated
    // state the overhead and reach warning read.
    const air = lvl.lift * s;

    // Shadow on the floor: it reads as "standing here" rather than floating — and a jump
    // leaves it behind, smaller and fainter the higher the dancer is, which is the one cue
    // that says a figure is in the air rather than very tall.
    const near = Math.max(0.35, 1 - Math.min(1, lvl.lift / 1.2));
    ctx.fillStyle = 'rgba(0,0,0,' + (0.35 * near).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(feet.x, feet.y, 0.22 * s * (0.6 + 0.4 * near), 0.07 * s * (0.6 + 0.4 * near), 0, 0, Math.PI * 2);
    ctx.fill();

    const height = dancerHeight(state.show, d);

    // Dressed, the figure is the costume; undressed, it is the performer's own colour,
    // exactly as it always was.
    const cos = costumeOf(state.show, d);
    const body = cos ? cos.body : d.color;

    // The pose, plus the rise the level adds: the same joints, standing taller. A jump's
    // height is not in the body at all, so it moves the whole figure up from the feet.
    // The spec is the shared evaluated one (pose, rise, plié) from evaluateMovement.
    const box = drawPose(ctx, {
      spec,
      x: feet.x,
      y: feet.y - air,
      h: height * s,
      facing: at.facing,
      turn: at.turn,
      headTurn: at.headTurn,
      pins,
      body: this.alpha(body, 0.95),
      skirt: cos ? { color: this.alpha(cos.skirt, 0.95), style: cos.style } : null,
      // A head needs a front and a back even with no costume, or spotting cannot be seen.
      hair: cos ? cos.hair : darker(body, 0.55),
    });

    if (focused) {
      // A ring on the floor under the focus: the figure itself is a dancer now, so the
      // highlight has to sit where it cannot be mistaken for a limb.
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(feet.x, feet.y, 0.28 * s, 0.09 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Generous on purpose: a dancer is only about 35 px tall in this strip, and a
    // raised arm reaches wider than the body does. A dancer in the air is all of that
    // higher up, so the box follows the figure rather than the shadow it left.
    this.record(feet.x - 0.3 * s, feet.y - height * s - air, feet.x + 0.3 * s, feet.y, d.id);

    // A dressed dancer's colours are the costume's, so the name carries their own
    // cast colour and the plan and this view still agree on who is who.
    ctx.fillStyle = focused ? THEME.accent : cos ? this.alpha(d.color, 1) : 'rgba(226,236,248,.75)';
    ctx.font = '9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.number + '. ' + d.name, feet.x, box.headY - box.headR - 5);
    ctx.textAlign = 'left';
  }

  drawProp(pr, p) {
    const ctx = this.ctx;
    const hgt = Number.isFinite(pr.h) ? pr.h : 0.8;
    // A carried prop is held off the floor, at about hip height.
    const lift = pr.carriedBy ? 0.45 : 0;
    // A prop is drawn at its real size for its place on the floor, so a bench upstage
    // sits behind a dancer at the same depth at the same distance.
    const s = this.scale * depthScale(p.y);
    const base = this.p2s(p.x, lift);
    const a = { x: base.x - (pr.w / 2) * s, y: base.y };
    const b = { x: base.x + (pr.w / 2) * s, y: base.y - hgt * s };
    const focused = pr.id === state.ui.selectedId;
    ctx.fillStyle = this.alpha(pr.color, 0.75);
    ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
    ctx.strokeStyle = focused ? THEME.accent : this.alpha(pr.color, 1);
    ctx.lineWidth = focused ? 1.6 : 1;
    ctx.strokeRect(a.x + 0.5, b.y + 0.5, b.x - a.x - 1, a.y - b.y - 1);
    ctx.lineWidth = 1;
    this.record(a.x, b.y, b.x, a.y, pr.id);
    if (b.x - a.x > 34) this.label(pr.name, (a.x + b.x) / 2, b.y - 4, 'rgba(226,236,248,.7)');
  }

  // A name over a piece of cloth, kept for the placement pass below. The words are
  // drawn outside the opening's clip on purpose: a name lifted clear of the arch is
  // still read, where one cut off by it is not.
  note(text, x, y) {
    if (text) this.clothNotes.push({ text: String(text), x, y });
  }

  // In drawing order, each name takes the first free height above its own: a clear
  // line rather than two names in the same pixels.
  drawClothNotes() {
    const notes = this.clothNotes || [];
    if (!notes.length) return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(226,236,248,.6)';
    ctx.font = '9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    const placed = [];
    for (const n of notes) {
      const w = ctx.measureText(n.text).width + 10;
      const box = { x0: n.x - w / 2, x1: n.x + w / 2, y0: n.y - 9.5, y1: n.y + 2.5 };
      for (let guard = 0; guard < 24; guard++) {
        const hit = placed.find((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0);
        if (!hit) break;
        const lift = hit.y0 - 11;
        box.y0 = lift - 9.5;
        box.y1 = lift + 2.5;
      }
      placed.push({ ...box });
      ctx.fillText(n.text, n.x, box.y1 - 2.5);
    }
    ctx.textAlign = 'left';
  }

  label(text, x, y, colour) {
    const ctx = this.ctx;
    ctx.fillStyle = colour;
    ctx.font = '9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }

  alpha(hex, a) {
    const n = hex.replace('#', '');
    const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
    return 'rgba(' + parseInt(full.slice(0, 2), 16) + ',' + parseInt(full.slice(2, 4), 16) + ',' + parseInt(full.slice(4, 6), 16) + ',' + a + ')';
  }

  // Height scale down the left side, in metres from the deck.
  drawRuler(halfW, top, floor) {
    const ctx = this.ctx;
    const x = this.p2s(-halfW, 0).x;
    ctx.strokeStyle = '#1d2634';
    ctx.beginPath();
    ctx.moveTo(x - 8.5, top);
    ctx.lineTo(x - 8.5, floor);
    ctx.stroke();
    ctx.font = '9px Consolas, "SF Mono", monospace';
    ctx.fillStyle = '#55637a';
    for (let z = 0; z <= taller().opening; z++) {
      const y = this.p2s(0, z).y;
      if (y < top - 1) continue;
      ctx.strokeStyle = '#1d2634';
      ctx.beginPath();
      ctx.moveTo(x - 12.5, y + 0.5);
      ctx.lineTo(x - 4.5, y + 0.5);
      ctx.stroke();
      if (z % 1 === 0) ctx.fillText(String(z), x - 34, y + 3);
    }
    ctx.fillStyle = '#3f4d64';
    ctx.fillText('m', x - 34, top - 3);
  }

  // Proscenium legs and header: the frame the audience sees through.
  drawFrame(halfW, top) {
    const ctx = this.ctx;
    const left = this.p2s(-halfW, 0).x;
    const right = this.p2s(halfW, 0).x;
    ctx.strokeStyle = '#2a3648';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, this.oy + 0.5);
    ctx.lineTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right, this.oy + 0.5);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#7f8ea6';
    ctx.font = '9px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(taller().opening.toFixed(1).replace(/\.0$/, '') + ' m opening', left + 4, top + 10);
  }

  // Anything above the opening is out of sight; say so rather than hiding it silently.
  drawFlownOut(halfW, top) {
    const out = state.show.scenery.filter((s) => {
      if (s.kind !== 'drop') return false;
      return sceneryStateAt(s, state.ui.playhead).fly <= 0.02;
    });
    if (!out.length) return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(226,236,248,.45)';
    ctx.font = '9px "Segoe UI", system-ui, sans-serif';
    out.forEach((s, i) => {
      ctx.fillText('↑ ' + s.name + ' flown out', this.p2s(halfW, 0).x - 132, top - 4 - i * 11);
    });
  }

  drawTitle(w) {
    const ctx = this.ctx;
    ctx.fillStyle = '#6f7f96';
    ctx.font = '9px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('ELEVATION · FROM THE HOUSE', 10, 12);
    void w;
  }
}
