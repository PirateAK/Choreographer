// Audience-facing theatre view. Stage metres are projected into a shallow floor
// perspective; all drawing stays on the supplied canvas.
import {
  sceneryStateAt, posOfContent, evaluateMovement, localOfContent, feetOnFloor,
  propPosOfContent, objectShown, costumeOf, dancerHeight, clothDepth, maxClothSpan,
} from './model.js';
import { drawPose, darker } from './pose.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;

export class HouseView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    this.width = 0;
    this.height = 0;
    this.depth = true;
    this.resize(canvas && canvas.width || 0, canvas && canvas.height || 0);
  }

  resize(width, height) {
    if (!this.canvas || !this.ctx) return;
    const dpr = typeof devicePixelRatio === 'number' ? Math.max(1, devicePixelRatio) : 1;
    this.width = Math.max(0, Number(width) || 0);
    this.height = Math.max(0, Number(height) || 0);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setDepth(enabled) { this.depth = enabled !== false; }
  useDepth(enabled) { this.setDepth(enabled); }

  draw(show, contentTimeMs = 0, videoElement = null) {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.width;
    const h = this.height;
    if (w <= 0 || h <= 0) return;
    ctx.setTransform((this.canvas.width / w) || 1, 0, 0, (this.canvas.height / h) || 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const st = show && show.stage;
    if (!st) {
      ctx.fillStyle = '#080b10';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const stageW = Math.max(1, num(st.width, 12));
    const stageD = Math.max(1, num(st.depth, 8));
    const openingH = Math.max(2, num(st.openingH, 7.5));
    const dancerH = Math.max(0.4, num(st.dancerH, 1.7));
    const padX = Math.min(28, w * 0.06);
    const floorBand = Math.min(h * 0.29, Math.max(38, h * 0.24));
    const scale = Math.max(0.1, Math.min((w - padX * 2) / stageW, (h - floorBand - 22) / openingH));
    const openingW = stageW * scale;
    const left = (w - openingW) / 2;
    const floorFront = h - Math.min(22, h * 0.05);
    const floorBack = floorFront - floorBand;
    const depthPx = floorFront - floorBack;
    const stageTop = Math.max(8, floorBack - openingH * scale);
    const xAt = (x, y) => {
      const p = this.depth ? 0.88 + 0.12 * clamp(y / stageD, 0, 1) : 1;
      return w / 2 + x * scale * p;
    };
    const floorAt = (y) => floorFront - clamp(y / stageD, 0, 1) * depthPx;
    const zScale = (y) => scale * (this.depth ? 0.88 + 0.12 * clamp(y / stageD, 0, 1) : 1);
    const half = stageW / 2;

    // House and proscenium surround.
    ctx.fillStyle = '#090d14';
    ctx.fillRect(0, 0, w, h);
    const archGrad = ctx.createLinearGradient(0, stageTop, 0, floorBack);
    archGrad.addColorStop(0, '#171c27');
    archGrad.addColorStop(1, '#252330');
    ctx.fillStyle = archGrad;
    ctx.fillRect(left - scale * 0.48, stageTop - scale * 0.42, openingW + scale * 0.96, floorFront - stageTop + scale * 0.42);
    ctx.fillStyle = '#111721';
    ctx.fillRect(left, stageTop, openingW, floorFront - stageTop);

    // Receding deck with quiet boards and a warm footlight at the lip.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(left, floorBack);
    ctx.lineTo(left + openingW, floorBack);
    ctx.lineTo(w / 2 + half * scale, floorFront);
    ctx.lineTo(w / 2 - half * scale, floorFront);
    ctx.closePath();
    ctx.clip();
    const deck = ctx.createLinearGradient(0, floorBack, 0, floorFront);
    deck.addColorStop(0, '#33303a');
    deck.addColorStop(1, '#51413a');
    ctx.fillStyle = deck;
    ctx.fillRect(left, floorBack, openingW, depthPx + 2);
    ctx.strokeStyle = 'rgba(226,190,147,.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 9; i++) {
      const yy = floorBack + depthPx * i / 9;
      ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(left + openingW, yy); ctx.stroke();
    }
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * scale * 0.55, floorBack);
      ctx.lineTo(w / 2 + i * scale * 1.45, floorFront);
      ctx.stroke();
    }
    ctx.restore();
    const lip = ctx.createLinearGradient(0, floorFront - 5, 0, floorFront + 5);
    lip.addColorStop(0, '#e2ad72'); lip.addColorStop(0.45, '#ffd59a'); lip.addColorStop(1, '#7d543b');
    ctx.fillStyle = lip;
    ctx.fillRect(left, floorFront - 3, openingW, 5);

    // Work within the framed opening. Back-to-front scenery masks performers as it
    // would from the house; cards, drops, and curtains all share the same cue state.
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, stageTop, openingW, floorFront - stageTop);
    ctx.clip();
    const scenery = Array.isArray(show.scenery) ? show.scenery : [];
    const cloth = scenery.filter((item) => item && item.kind !== 'prop')
      .slice().sort((a, b) => clothDepth(b) - clothDepth(a));
    for (const item of cloth) this._drawScenery(item, contentTimeMs, videoElement, {
      ctx, show, stageW, stageD, openingH, scale, half, xAt, floorAt, zScale,
      stageTop, floorFront,
    });

    // The more distant performer is drawn first. Foot contacts keep the floor shadow
    // anchored during steps and holds; the pose renderer supplies the articulated body.
    const dancers = [];
    for (const d of show.cast || []) {
      if (!d || !objectShown(d)) continue;
      const p = posOfContent(show, d, contentTimeMs);
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) dancers.push({ d, p });
    }
    dancers.sort((a, b) => b.p.y - a.p.y);
    for (const { d, p } of dancers) {
      const ev = evaluateMovement(show, d, localOfContent(show, d.id, contentTimeMs));
      const at = ev.at;
      const local = localOfContent(show, d.id, contentTimeMs);
      const feet = feetOnFloor(show, d, local) || {};
      const contacts = Object.values(feet).filter((f) => f && Number.isFinite(f.x));
      const cx = contacts.length ? contacts.reduce((sum, f) => sum + f.x, 0) / contacts.length : p.x;
      const groundX = xAt(cx, p.y);
      const groundY = floorAt(p.y);
      const s = zScale(p.y);
      const air = ev.lift;
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath();
      ctx.ellipse(groundX, groundY, Math.max(3, dancerH * s * 0.16), Math.max(1.5, s * 0.035), 0, 0, Math.PI * 2);
      ctx.fill();
      const costume = costumeOf(show, d);
      const body = costume && costume.body || d.color || '#f0d4b8';
      const hair = costume && costume.hair || darker(body, 0.42);
      const skirt = costume && costume.skirt ? { style: costume.skirt, color: costume.skirtColor || body } : null;
      drawPose(ctx, {
        spec: ev.spec, x: xAt(p.x, p.y), y: groundY - (Number.isFinite(air) ? air : 0) * s, h: dancerH * s,
        facing: at.facing || 1, turn: at.turn || 0, headTurn: at.headTurn || at.turn || 0,
        body, hair, skirt, pins: ev.pins,
      });
    }

    // Dressing and movable props sit on the deck in front of the cloth and cast.
    const props = scenery.filter((p) => p && p.kind === 'prop' && objectShown(p))
      .map((item) => ({ item, p: propPosOfContent(show, item, contentTimeMs) }))
      .filter((v) => v.p).sort((a, b) => b.p.y - a.p.y);
    for (const { item, p } of props) {
      const px = xAt(p.x, p.y), py = floorAt(p.y), s = zScale(p.y);
      const pw = Math.max(2, num(item.w, 0.8) * s);
      const ph = Math.max(2, num(item.h, 0.8) * s);
      ctx.fillStyle = item.color || '#9a785d';
      ctx.fillRect(px - pw / 2, py - ph, pw, ph);
      ctx.strokeStyle = 'rgba(18,15,13,.8)';
      ctx.lineWidth = Math.max(0.8, s * 0.018);
      ctx.strokeRect(px - pw / 2, py - ph, pw, ph);
      if (pw > 40) {
        ctx.fillStyle = '#f0dfc5'; ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.fillText(String(item.name || ''), px, py - ph - 4, pw);
      }
    }
    ctx.restore();

    // Frame, header, and subtle side drapes complete the audience view.
    ctx.fillStyle = '#332b2d';
    ctx.fillRect(left - scale * 0.48, stageTop - scale * 0.42, openingW + scale * 0.96, Math.max(5, scale * 0.34));
    ctx.fillStyle = '#5d3534';
    ctx.fillRect(left - scale * 0.48, stageTop - scale * 0.08, scale * 0.46, floorFront - stageTop + scale * 0.08);
    ctx.fillRect(left + openingW + scale * 0.02, stageTop - scale * 0.08, scale * 0.46, floorFront - stageTop + scale * 0.08);
    ctx.strokeStyle = 'rgba(231,194,145,.38)';
    ctx.lineWidth = Math.max(1, scale * 0.025);
    ctx.strokeRect(left - scale * 0.48, stageTop - scale * 0.42, openingW + scale * 0.96, floorFront - stageTop + scale * 0.42);
  }

  _drawScenery(item, time, video, g) {
    const { ctx, stageW, stageD, openingH, scale, half, xAt, floorAt, zScale, stageTop } = g;
    const state = sceneryStateAt(item, time);
    const span = clamp(num(item.span, stageW), 0.5, maxClothSpan(g.show.stage));
    const lim = Math.max(0, (stageW - span) / 2);
    const cx = clamp(num(item.x, 0), -lim, lim);
    const depth = clamp(clothDepth(item), 0, stageD);
    const px = xAt(cx, depth);
    const pw = span * zScale(depth);
    const hgt = Math.max(0.5, num(item.h, item.kind === 'drop' ? openingH * 0.8 : openingH - 1.1));
    const hanging = item.kind === 'drop' ? clamp(num(state.fly, 1), 0, 1) : 1;
    const bottom = item.kind === 'drop' ? (1 - hanging) * openingH : 0;
    const py = floorAt(depth) - bottom * zScale(depth);
    const ph = hgt * zScale(depth);
    const x0 = px - pw / 2;
    if (item.kind === 'card') {
      const showAmount = clamp(num(state.shown, 0), 0, 1);
      if (showAmount <= 0.02) return;
      ctx.fillStyle = item.color || '#c7b38e';
      ctx.fillRect(x0, py - ph, pw, ph);
      ctx.strokeStyle = 'rgba(20,18,16,.7)'; ctx.strokeRect(x0 + .5, py - ph + .5, pw - 1, ph - 1);
      const text = String(item.text || '');
      if (text && pw > 28) {
        ctx.fillStyle = '#2b2927'; ctx.textAlign = 'center'; ctx.font = `600 ${clamp(pw * .055, 7, 15)}px system-ui, sans-serif`;
        ctx.fillText(text, px, py - ph * .48, pw - 8);
      }
      return;
    }
    if (item.kind === 'drop' && hanging <= 0.015) return;
    if (item.kind === 'curtain') {
      const open = clamp(num(state.open, 1), 0, 1);
      const legW = Math.max(Math.min(0.55, span / 2), span / 2 - (span / 2 - Math.min(0.55, span / 2)) * open);
      for (const side of [-1, 1]) {
        const legCenter = cx + side * (span / 2 - legW / 2);
        const x = xAt(legCenter, depth) - legW * zScale(depth) / 2;
        this._clothPanel(ctx, x, py - ph, legW * zScale(depth), ph, item.color || '#743b43', side);
      }
      return;
    }
    if (item.kind === 'drop' && item.screen === true) {
      ctx.fillStyle = '#d9d9d4';
      ctx.fillRect(x0, py - ph, pw, ph);
      const sw = video && (video.videoWidth || video.width);
      const sh = video && (video.videoHeight || video.height);
      const ready = video && (video.readyState == null || video.readyState >= 2);
      if (ready && sw > 0 && sh > 0) {
        const fit = Math.min(pw / sw, ph / sh);
        const dw = sw * fit, dh = sh * fit;
        ctx.fillStyle = '#000';
        ctx.fillRect(x0, py - ph, pw, ph);
        ctx.save();
        ctx.beginPath(); ctx.rect(x0, py - ph, pw, ph); ctx.clip();
        ctx.drawImage(video, px - dw / 2, py - ph + (ph - dh) / 2, dw, dh);
        ctx.restore();
      } else {
        const glow = ctx.createLinearGradient(x0, py - ph, x0, py);
        glow.addColorStop(0, '#f0f1ec'); glow.addColorStop(1, '#c9cbc9');
        ctx.fillStyle = glow; ctx.fillRect(x0, py - ph, pw, ph);
      }
      ctx.strokeStyle = 'rgba(38,40,42,.75)'; ctx.lineWidth = 1;
      ctx.strokeRect(x0 + .5, py - ph + .5, pw - 1, ph - 1);
      return;
    }
    this._clothPanel(ctx, x0, py - ph, pw, ph, item.color || '#354354');
  }

  _clothPanel(ctx, x, y, w, h, color, side = 1) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    const shade = ctx.createLinearGradient(x, 0, x + Math.max(1, w), 0);
    shade.addColorStop(0, 'rgba(0,0,0,.2)');
    shade.addColorStop(0.48, 'rgba(255,255,255,.07)');
    shade.addColorStop(1, 'rgba(0,0,0,.24)');
    ctx.fillStyle = shade; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
    const folds = Math.max(2, Math.floor(w / 16));
    for (let i = 1; i < folds; i++) {
      const fx = x + w * i / folds;
      ctx.beginPath(); ctx.moveTo(fx, y + 1); ctx.lineTo(fx, y + h - 1); ctx.stroke();
    }
    if (side < 0) { ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(x, y, w * .16, h); }
  }
}
