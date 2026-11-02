// The crowd: how many performers are on the deck across the stretch of the timeline you are
// looking at, drawn as a step line under the tracks. It is the same count the printed call
// sheet draws per act, so the page and the screen cannot disagree about who is on — a
// performer whose path has finished is still standing where it left her, and one in the wings
// is off, because the audience has lost sight of her.
//
// The line is sampled rather than solved — walking off is a position crossing the wing line
// part-way along a leg, not a station — and the samples are kept against the clock rather than
// against the screen, so scrolling and zooming read the same run of numbers instead of
// recounting the company on every frame. Only a window that has scrolled out of what was
// measured is measured again, which during a run-through is a few times a minute.
import { state, THEME, posOfContent, contentOfDisplay, displayOfContent, actRanges } from './model.js';
import { GUTTER } from './timeline.js';

// About two pixels a sample at a normal zoom: finer than an entrance can happen, and coarse
// enough that a long show stays cheap to count.
const SAMPLE_PX = 2;
// A quarter of a window measured either side of what is on screen, so a small scroll does not
// trigger a recount.
const MARGIN = 0.25;
const MAX_SAMPLES = 3200;

export class CompanyLine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cache = null;
  }

  // Screen position to display time, in the same units the timeline uses.
  xOfDisplay(displayMs) {
    return GUTTER + (displayMs / 1000 - state.ui.scrollT) * state.ui.pxPerSec;
  }

  visible(w) {
    const from = state.ui.scrollT * 1000;
    const span = Math.max(500, ((w - GUTTER) / state.ui.pxPerSec) * 1000);
    return { from, to: from + span, span };
  }

  // How many are on the deck at one moment of content time.
  countAt(ct) {
    const show = state.show;
    const half = show.stage.width / 2;
    let n = 0;
    for (const d of show.cast || []) {
      const p = posOfContent(show, d, ct);
      if (p && Math.abs(p.x) <= half + 0.01) n++;
    }
    return n;
  }

  // The numbers for a stretch of the clock, in content time, with the resolution set by the
  // zoom: a step of a couple of pixels is as fine as the line can be drawn.
  measure(view) {
    const stepMs = Math.max(
      30,
      Math.min(250, (SAMPLE_PX / state.ui.pxPerSec) * 1000),
      ((view.to - view.from) * (1 + MARGIN * 2)) / MAX_SAMPLES
    );
    const from = view.from - view.span * MARGIN;
    const to = view.to + view.span * MARGIN;
    const n = Math.max(2, Math.ceil((to - from) / stepMs) + 1);
    const counts = new Int16Array(n);
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const ct = contentOfDisplay(state.show, from + i * stepMs);
      const c = this.countAt(ct);
      counts[i] = c;
      if (c > peak) peak = c;
    }
    return { from, to, stepMs, counts, peak };
  }

  draw() {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, w, h);

    const show = state.show;
    const view = this.visible(w);
    // Measure again only when the window has left what was measured, or when the zoom has
    // changed enough to want a different resolution.
    // An edit is the one thing that changes the shape without moving the window, and
    // `state.ui.rev` is bumped by every save, so a path dragged on the stage redraws the line
    // on the next frame instead of waiting for a scroll.
    const need = !this.cache ||
      view.from < this.cache.from ||
      view.to > this.cache.to ||
      this.cache.rev !== state.ui.rev ||
      this.cache.stepMs > Math.max(30, (SAMPLE_PX / state.ui.pxPerSec) * 1000) * 1.6;
    if (need) this.cache = { ...this.measure(view), rev: state.ui.rev };
    const { from, stepMs, counts, peak } = this.cache;

    const top = 7;
    const base = h - 7;
    const scale = Math.max(1, peak);
    const yOf = (n) => base - (n / scale) * (base - top);
    const countFor = (displayMs) => {
      const i = Math.round((displayMs - from) / stepMs);
      return counts[Math.max(0, Math.min(counts.length - 1, i))] || 0;
    };

    // The act boundaries the tracks already show, carried down as thin rules so a count can be
    // read against the act it belongs to.
    ctx.strokeStyle = '#1d2634';
    ctx.lineWidth = 1;
    for (const range of actRanges(show)) {
      const x = Math.round(this.xOfDisplay(displayOfContent(show, range.start))) + 0.5;
      if (x <= GUTTER || x >= w) continue;
      ctx.beginPath();
      ctx.moveTo(x, 7);
      ctx.lineTo(x, base);
      ctx.stroke();
    }

    // The floor of the strip, and a rule for the peak, so the height has a scale at all.
    ctx.strokeStyle = '#243040';
    ctx.beginPath();
    ctx.moveTo(GUTTER, base + 0.5);
    ctx.lineTo(w, base + 0.5);
    ctx.stroke();
    if (peak > 0) {
      ctx.strokeStyle = '#1b2532';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(GUTTER, yOf(peak) + 0.5);
      ctx.lineTo(w, yOf(peak) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The step line, filled to the floor. One point per sample: at two pixels a sample this is
    // the shape an entrance makes, without pretending to a precision the sampling does not have.
    // GUTTER is exactly the left edge of the window, so the first sample is the leftmost point.
    const x0 = GUTTER;
    ctx.beginPath();
    ctx.moveTo(x0, yOf(countFor(view.from)));
    for (let x = GUTTER + SAMPLE_PX; x <= w; x += SAMPLE_PX) {
      const n = countFor((x - GUTTER) / state.ui.pxPerSec * 1000 + view.from);
      ctx.lineTo(x, yOf(n));
    }
    ctx.lineTo(w, base);
    ctx.lineTo(x0, base);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,183,3,.12)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x0, yOf(countFor(view.from)));
    for (let x = GUTTER + SAMPLE_PX; x <= w; x += SAMPLE_PX) {
      const n = countFor((x - GUTTER) / state.ui.pxPerSec * 1000 + view.from);
      ctx.lineTo(x, yOf(n));
    }
    ctx.strokeStyle = THEME.accent;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.lineWidth = 1;

    // The playhead, and how many it is standing on: the number is what makes the strip useful
    // while editing a scene rather than only while reading the whole act.
    const px = this.xOfDisplay(displayOfContent(show, state.ui.playhead));
    const now = this.countAt(state.ui.playhead);
    if (px >= GUTTER && px <= w) {
      ctx.strokeStyle = THEME.accent;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(Math.round(px) + 0.5, 5);
      ctx.lineTo(Math.round(px) + 0.5, base);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = THEME.accent;
      ctx.beginPath();
      ctx.arc(px, yOf(now), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // The gutter names the strip and the count, the way a track row names its track.
    ctx.font = '600 9px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = THEME.dim;
    ctx.fillText('ON STAGE', 12, base - 6);
    ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = now ? THEME.accent : THEME.dim;
    ctx.fillText(String(now), 12, base);
    ctx.font = '9px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = THEME.dim;
    ctx.fillText(now === 1 ? 'performer' : 'performers', 32, base);
    if (peak > 0) {
      const label = 'peak ' + peak;
      ctx.font = '9px "Segoe UI", system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = THEME.dim;
      ctx.fillText(label, w - tw - 8, 12);
    }
  }
}
