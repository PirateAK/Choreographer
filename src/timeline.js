// Timeline: ruler, track gutter, keyframes, holds and pauses.
import {
  THEME, state, displayOfContent, contentOfDisplay, contentOfLocal, localOfContent,
  holdsFor, sortedPauses, posAtLocal, commit, persist, uid,
  objectShown, toggleVisibility, propOnTimer, carrierOf, removeSceneryCue,
  addSceneryCue, sceneryStateAt, addMusicCue, musicLevelAt, removeMusicCue, updateMusicCue,
  addSlideCue, removeSlideCue,
  actRanges, sceneRanges, endContent, moveSceneTo, updateCue, setMusicStart, musicSpan,
  videoSpan, removeVideo,
  setNarrationAt, removeNarration, endMarker, setEnd, removeEnd,
  lightLevelAt, addLightCue, updateLightCue, removeLightCue, lightFollowAt, countGrid, countAt,
  findObject, phrasePlan, STEP_LABEL,
} from './model.js';
import { narration } from './narration.js';
import { fmtTime } from './draw.js';
import { music } from './music.js';

const ROW_H = 24;
// The top of the ruler holds a band for the running order, so acts stay visible
// at every zoom level rather than only in the tabs.
const RULER_H = 40;
// The width of the track list down the left edge. The company strip below the tracks
// shares it, so a count lines up with the row it is counting.
export const GUTTER = 176;
// A cue dropped straight on a track takes the same time a curtain hand pulls it
// in a studio: long enough to see, short enough to retime by grabbing its end.
const CUE_DEFAULT_MS = 1500;
// A fade is judged by ear, so it starts at a musical length rather than a click's.
const FADE_DEFAULT_MS = 2000;
// How long a placed cue takes is a property of the show, not of this tab: the two
// durations live in `show.prefs`, so a company that reopens the file finds it flying
// and fading as it was staged. These read them with the old constants as fallbacks,
// for a show written before the fields existed.
function cueDurOf(show) {
  const v = Number(show && show.prefs && show.prefs.cueDur);
  return Number.isFinite(v) ? Math.max(0, Math.min(120000, v)) : CUE_DEFAULT_MS;
}

function fadeDurOf(show) {
  const v = Number(show && show.prefs && show.prefs.fadeDur);
  return Number.isFinite(v) ? Math.max(0, Math.min(120000, v)) : FADE_DEFAULT_MS;
}

// Lighting is slower than cloth by intent: an eye takes a moment to adjust.
function lightDurOf(show) {
  const v = Number(show && show.prefs && show.prefs.lightDur);
  return Number.isFinite(v) ? Math.max(0, Math.min(120000, v)) : FADE_DEFAULT_MS;
}

function holdDurOf(show) {
  const v = Number(show && show.prefs && show.prefs.holdDur);
  return Number.isFinite(v) ? Math.max(100, Math.min(120000, v)) : 1500;
}

// Narration clips may overlap — a recorded line under a live one — so the row is
// split into as few lanes as will hold them, and one clip is the ordinary case
// that takes the whole row.
function narrationLanes(clips) {
  const ends = [];
  const laneOf = new Map();
  for (const c of clips) {
    let lane = ends.findIndex((end) => end <= c.at);
    if (lane < 0) lane = ends.length;
    ends[lane] = c.at + (c.length || 0);
    laneOf.set(c.id, lane);
  }
  return { laneOf, count: Math.max(1, ends.length) };
}

export class Timeline {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.app = app;
    this.drag = null;
    // Where the pointer is over the ruler, while a phrase is armed for it: the preview is drawn
    // from this, so it costs nothing when nothing is armed.
    this.hover = null;
    this.shiftHeld = false;
    this.bind();
  }

  bind() {
    this.canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', () => this.onUp());
    this.canvas.addEventListener('dblclick', (e) => this.onDouble(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    // The preview has to follow Shift as well as the pointer, or it would promise counts the
    // click would not use: a key held still is a different gesture with the pointer still.
    window.addEventListener('keydown', (e) => {
      this.shiftHeld = e.shiftKey;
    });
    window.addEventListener('keyup', (e) => {
      this.shiftHeld = e.shiftKey;
    });
    // The right button opens the row's own tools. It is not a delete here: the
    // stage owns that gesture, and nothing on a track is worth losing to a
    // mis-aimed click.
    this.canvas.addEventListener('contextmenu', (e) => this.onContext(e));
    window.addEventListener('pointerdown', (e) => this.menuOutside(e), true);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeMenu();
    });
    this.canvas.addEventListener('wheel', () => this.closeMenu(), { passive: true });
  }

  /* ---------------------------------------------------------------- maths */

  xOfDisplay(displayMs) {
    return GUTTER + (displayMs / 1000 - state.ui.scrollT) * state.ui.pxPerSec;
  }

  timeAtX(px) {
    return ((px - GUTTER) / state.ui.pxPerSec + state.ui.scrollT) * 1000;
  }

  xOfLocal(dancer, lt) {
    const show = state.show;
    return this.xOfDisplay(displayOfContent(show, contentOfLocal(show, dancer.id, lt)));
  }

  localAtX(dancer, px) {
    const show = state.show;
    return localOfContent(show, dancer.id, contentOfDisplay(show, this.timeAtX(px)));
  }

  contentAtX(px) {
    return Math.max(0, contentOfDisplay(state.show, this.timeAtX(px)));
  }

  tickStep() {
    const options = [100, 250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000];
    for (const o of options) {
      if ((o / 1000) * state.ui.pxPerSec >= 62) return o;
    }
    return 120000;
  }

  tracks() {
    const show = state.show;
    // One row per track, in running order: the music is a list now, so a show
    // can change pieces the way it changes scenes.
    const list = [];
    for (const t of show.musicTracks || []) {
      list.push({
        id: t.id,
        label: t.name,
        kind: 'music',
        color: '#4cc9f0',
        visible: t.visible !== false,
        track: t,
      });
    }
    // Narration sits with the music — it is sound, and it is heard during a
    // run-through — but it has one row, because its pieces are cues on a line,
    // not a running order that replaces itself.
    const voice = show.narration || [];
    if (voice.length) {
      list.push({
        id: 'narration',
        label: 'Narration \u00b7 ' + voice.length,
        kind: 'narration',
        color: '#f6c177',
        visible: show.trackVis.narration !== false,
      });
    }
    // Each picture clip has its own row, so overlapping edits can be moved and
    // trimmed without one clip obscuring another in the timeline.
    for (const clip of show.videos || []) {
      list.push({
        id: clip.id,
        label: clip.name || 'Video',
        kind: 'video',
        color: '#b794f4',
        visible: show.trackVis.video !== false,
        video: clip,
        selected: state.ui.selectedTrack === clip.id,
      });
    }
    // Slide changes share one row: each marker changes the projector's image, and
    // the band leading into it shows how long that change takes.
    if ((show.images || []).length || (show.slideCues || []).length) {
      list.push({
        id: 'slides',
        label: 'Slide projector',
        kind: 'slides',
        color: '#f4a7c1',
        visible: true,
        selected: state.ui.selectedTrack === 'slides',
      });
    }
    // Every lantern owns a row, the way every curtain owns one: the row *is* its
    // track. A show with no lanterns has no lighting row at all, and draws dark.
    for (const l of show.lights || []) {
      // A follow spot's row says whose hand is on the handle, because the lantern's
      // own row would otherwise look like a fixed special. It names whoever the spot
      // is on *at the playhead*, so a cue that hands it over moves the name with it.
      const follows = lightFollowAt(show, l, state.ui.playhead);
      list.push({
        id: l.id,
        label: follows ? l.name + ' \u2192 ' + follows.name : l.name,
        kind: 'lightCue',
        color: l.color,
        visible: l.visible !== false,
        light: l,
        selected: state.ui.lightId === l.id,
      });
    }
    // There is no abstract "curtain" row any more: every curtain and drop owns
    // its own track, further down this list, and a row with nothing behind it
    // was only ever a place to put a hold that nothing could move.
    for (const d of show.cast) {
      list.push({
        id: d.id,
        label: d.number + '. ' + d.name,
        kind: 'cast',
        color: d.color,
        visible: d.visible,
        shown: objectShown(d),
        body: d,
        selected: d.id === state.ui.selectedId,
      });
    }
    // Every curtain and drop owns a row, cued or not: the row *is* the piece's
    // track, so there is somewhere to put a cue before there is one.
    for (const s of show.scenery) {
      if (s.kind === 'prop') continue;
      list.push({
        id: s.id,
        label: s.name,
        kind: 'sceneryCue',
        color: s.color,
        visible: true,
        scenery: s,
        selected: state.ui.selectedTrack === s.id,
      });
    }
    // Props join the track list only once they have stations: until then they
    // are dressing, not something on the timer.
    for (const p of show.scenery) {
      if (p.kind !== 'prop' || !propOnTimer(p)) continue;
      const holder = p.carriedBy ? carrierOf(show, p, state.ui.playhead) : null;
      list.push({
        id: p.id,
        label: p.carriedBy ? p.name + ' · ' + (holder ? holder.name : 'carried') : p.name,
        kind: 'prop',
        color: p.color,
        visible: p.visible !== false,
        shown: objectShown(p),
        body: p,
        selected: p.id === state.ui.selectedId,
      });
    }
    return list;
  }

  revealTrack(id) {
    const index = this.tracks().findIndex((track) => track.id === id);
    if (index < 0) return;
    const height = Math.max(ROW_H, this.canvas.clientHeight - RULER_H);
    const top = index * ROW_H;
    if (top < state.ui.vscroll) state.ui.vscroll = top;
    else if (top + ROW_H > state.ui.vscroll + height) {
      state.ui.vscroll = Math.max(0, top + ROW_H - height);
    }
    state.ui.selectedTrack = id;
  }

  rowIndexAt(y) {
    const i = Math.floor((y - RULER_H + state.ui.vscroll) / ROW_H);
    return i >= 0 && i < this.tracks().length ? i : null;
  }

  /* -------------------------------------------------------------- drawing */

  // Where the armed phrase would land, drawn on the ruler under the pointer: the count it would
  // start on, a mark for every station at the count it falls in, and the stretch of music the
  // phrase would take. It comes from `phrasePlan`, which runs the placement's own arithmetic, so
  // what is promised here is what the click will do.
  drawPhrasePreview(ctx, w) {
    const armed = state.ui.phraseArmed;
    const hover = this.hover;
    if (!armed || !hover) return;
    const show = state.show;
    const d = findObject(show, armed.id);
    if (!d) return;
    const plan = phrasePlan(show, d, { ...armed, at: hover.at, atBar: hover.bar });
    if (!plan || !plan.steps.length || !plan.start.at) return;
    const xOf = (content) => this.xOfDisplay(displayOfContent(show, content));
    const xs = plan.steps.map((s) => xOf(s.content));
    const x0 = xOf(plan.start.ct);
    const inside = (x) => x >= GUTTER && x <= w;
    if (!inside(x0) && !xs.some(inside)) return;

    ctx.save();
    // The music the phrase would occupy, marked along the foot of the ruler.
    const a = Math.max(GUTTER, Math.min(x0, xs[xs.length - 1]));
    const b = Math.min(w, Math.max(x0, xs[xs.length - 1]));
    if (b > a) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = THEME.accent;
      ctx.fillRect(a, RULER_H - 8, b - a, 7);
      ctx.globalAlpha = 1;
    }
    // The start: where the leg into the first station would begin.
    if (inside(x0)) {
      ctx.strokeStyle = THEME.accent;
      ctx.globalAlpha = 0.8;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(Math.round(x0) + 0.5, 18);
      ctx.lineTo(Math.round(x0) + 0.5, RULER_H - 1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    // One diamond per station, on the count it would land in: filled when it lands on a beat,
    // hollow when it falls between two — a phrase whose counts do not divide evenly is the one
    // thing here worth seeing before it is placed rather than after.
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      if (!inside(x)) continue;
      ctx.beginPath();
      ctx.moveTo(x, RULER_H - 12);
      ctx.lineTo(x + 3.5, RULER_H - 8);
      ctx.lineTo(x, RULER_H - 4);
      ctx.lineTo(x - 3.5, RULER_H - 8);
      ctx.closePath();
      if (plan.steps[i] && plan.steps[i].off === 0) {
        ctx.fillStyle = THEME.accent;
        ctx.fill();
      } else {
        ctx.strokeStyle = THEME.accent;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
    // Said in a booth's words: the count it starts on, then the counts it arrives on — all in
    // one bar when that is where it falls, and bar-and-count when it crosses a line.
    const at = (c) => (c ? `${c.bar}\u00b7${c.count}` : '?');
    const stations = plan.steps.map((s) => s.at).filter(Boolean);
    const oneBar =
      stations.length > 0 &&
      plan.start.at.bar === stations[0].bar &&
      stations.every((c) => c.bar === plan.start.at.bar);
    // A phrase a hold covers has no arrivals to promise: where its stations would fall is exactly
    // what cannot happen, so the warning replaces the counts instead of sitting beside them.
    const where = plan.swallowed || !stations.length
      ? ''
      : oneBar
      ? ` · bar ${plan.start.at.bar} · ${plan.start.at.count} \u2192 ${stations.map((c) => c.count).join(', ')}`
      : ` · starts ${at(plan.start.at)} \u2192 ${stations.map(at).join(' ')}`;
    const ragged = plan.off ? ` \u00b7 ${plan.off} of ${plan.steps.length} between counts` : '';
    // A hold between its stations splits the phrase and its arrivals stay on their counts, so it is
    // said separately; a hold that eats an arrival is marked as the refusal it will be.
    const held = plan.swallowed
      ? ' \u00b7 a hold covers a count'
      : plan.holds
      ? ` \u00b7 ${plan.holds} hold${plan.holds === 1 ? '' : 's'} inside`
      : '';
    const label = `${(STEP_LABEL[armed.step] || armed.step).toLowerCase()}${where || ` · starts ${at(plan.start.at)}`}${ragged}${held}`;
    ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
    const tw = ctx.measureText(label).width;
    const lx = Math.max(GUTTER + 4, Math.min(w - tw - 4, x0 + 8));
    ctx.fillStyle = 'rgba(8,11,16,.88)';
    ctx.fillRect(lx - 3, 17, tw + 6, 12);
    ctx.fillStyle = THEME.accent;
    ctx.fillText(label, lx, 26);
    ctx.restore();
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
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, w, h);

    const tracks = this.tracks();
    const maxScroll = Math.max(0, tracks.length * ROW_H - (h - RULER_H));
    if (state.ui.vscroll > maxScroll) state.ui.vscroll = maxScroll;
    const vs = state.ui.vscroll;

    // follow the playhead while playing
    if (state.ui.playing) {
      const px = this.xOfDisplay(displayOfContent(show, state.ui.playhead));
      if (px > w - 90) state.ui.scrollT += (px - (w - 90)) / state.ui.pxPerSec;
      else if (px < GUTTER + 20) state.ui.scrollT = Math.max(0, (displayOfContent(show, state.ui.playhead) / 1000) - 1);
    }

    // ---- ruler
    ctx.fillStyle = '#0e131b';
    ctx.fillRect(0, 0, w, RULER_H);
    ctx.strokeStyle = '#1d2634';
    ctx.beginPath();
    ctx.moveTo(0, RULER_H + 0.5);
    ctx.lineTo(w, RULER_H + 0.5);
    ctx.stroke();

    // ---- acts: the running order as a band across the top, with a notch for
    // every scene start inside its act
    const acts = actRanges(show);
    const scenes = sceneRanges(show);
    for (let i = 0; i < acts.length; i++) {
      const x0 = this.xOfDisplay(displayOfContent(show, acts[i].start));
      const x1 = this.xOfDisplay(displayOfContent(show, acts[i].end));
      if (x1 < GUTTER || x0 > w) continue;
      const left = Math.max(GUTTER, x0);
      const right = Math.min(w, x1);
      ctx.fillStyle = i % 2 ? '#101927' : '#0d1520';
      ctx.fillRect(left, 0, Math.max(0, right - left), 15);
      ctx.strokeStyle = '#243040';
      ctx.beginPath();
      ctx.moveTo(Math.round(left) + 0.5, 0);
      ctx.lineTo(Math.round(left) + 0.5, 15);
      ctx.stroke();
      if (right - left > 54) {
        ctx.fillStyle = THEME.accent;
        ctx.font = '600 9px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(acts[i].name, left + 6, 11);
      }
      for (const s of scenes) {
        if (s.actIndex !== i) continue;
        // A scene at the very top of its act would otherwise sit under the act
        // boundary and be impossible to grab.
        const sx = Math.max(left + 1, this.xOfDisplay(displayOfContent(show, s.start)));
        if (sx >= right - 1) continue;
        const held = this.drag && this.drag.type === 'scene' && this.drag.scene.id === s.id;
        ctx.strokeStyle = held ? THEME.accent : '#61708a';
        ctx.lineWidth = held ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(sx) + 0.5, held ? 2 : 10);
        ctx.lineTo(Math.round(sx) + 0.5, 15);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    // While a boundary is held, say which scene it is and where it has landed.
    if (this.drag && this.drag.type === 'scene') {
      const at = this.drag.range.start + this.drag.scene.offset;
      const x = this.xOfDisplay(displayOfContent(show, at));
      const label = this.drag.scene.name + ' \u00b7 ' + fmtShort(displayOfContent(show, at));
      ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      const lx = Math.max(GUTTER + 4, Math.min(w - tw - 4, x + 8));
      ctx.fillStyle = 'rgba(8,11,16,.88)';
      ctx.fillRect(lx - 3, 17, tw + 6, 12);
      ctx.fillStyle = THEME.accent;
      ctx.fillText(label, lx, 26);
    }

    const step = this.tickStep();
    const t0 = this.timeAtX(GUTTER);
    const t1 = this.timeAtX(w);
    ctx.font = '10px Consolas, "SF Mono", monospace';
    for (let t = Math.floor(t0 / step) * step; t <= t1 + step; t += step) {
      if (t < 0) continue;
      const x = this.xOfDisplay(t);
      if (x < GUTTER) continue;
      ctx.strokeStyle = '#28323f';
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, RULER_H - 7);
      ctx.lineTo(Math.round(x) + 0.5, RULER_H);
      ctx.stroke();
      ctx.fillStyle = THEME.dim;
      ctx.fillText(fmtShort(t), x + 4, RULER_H - 10);
    }

    // The phrase armed for the ruler, shown where it would fall before the click is made.
    this.drawPhrasePreview(ctx, w);

    // ---- track area
    ctx.save();
    ctx.beginPath();
    ctx.rect(GUTTER, RULER_H, w - GUTTER, h - RULER_H);
    ctx.clip();

    // Where the show stops. With an end marker that is the marker itself, and the
    // stretch after it is not empty stage — it is not part of the performance, so
    // it is struck out rather than left looking available. Without one the old
    // rule stands: the grey begins a little past whatever was choreographed.
    const lastMoment = endMarker(show);
    const endD = lastMoment
      ? displayOfContent(show, lastMoment.t)
      : displayOfContent(show, Math.max(20000, endContent(show) + 10000));
    const endX = this.xOfDisplay(endD + (lastMoment ? 0 : 4000));
    ctx.fillStyle = '#090c12';
    ctx.fillRect(endX, RULER_H, w - endX, h - RULER_H);
    if (!lastMoment) {
      ctx.strokeStyle = '#1b2431';
      ctx.beginPath();
      ctx.moveTo(Math.round(endX) + 0.5, RULER_H);
      ctx.lineTo(Math.round(endX) + 0.5, h);
      ctx.stroke();
    }

    // The show's bars, so a phrase can be placed against the music rather than by arithmetic.
    // Drawn under each row's content, and only where they are far enough apart to read: the
    // count is the tempo's, the bar the measure's, and both are counted from where the first
    // music track begins.
    const grid = countGrid(show);
    const barPx = (grid.bar / 1000) * state.ui.pxPerSec;
    const bars = [];
    if (barPx >= 9) {
      const first = Math.max(0, Math.floor((contentOfDisplay(show, t0) - grid.origin) / grid.bar));
      const last = Math.ceil((contentOfDisplay(show, t1) - grid.origin) / grid.bar);
      for (let k = first; k <= last; k++) {
        const x = this.xOfDisplay(displayOfContent(show, grid.origin + k * grid.bar));
        if (x >= GUTTER) bars.push(Math.round(x));
      }
    }

    tracks.forEach((tr, i) => {
      const y = RULER_H + i * ROW_H - vs;
      if (y + ROW_H < RULER_H || y > h) return;
      ctx.fillStyle = tr.selected ? 'rgba(255,183,3,.07)' : i % 2 ? '#0d1219' : '#0b1017';
      ctx.fillRect(GUTTER, y, w - GUTTER, ROW_H);
      ctx.strokeStyle = '#141c26';
      ctx.beginPath();
      ctx.moveTo(GUTTER, y + ROW_H + 0.5);
      ctx.lineTo(w, y + ROW_H + 0.5);
      ctx.stroke();

      // vertical grid
      ctx.strokeStyle = 'rgba(40,52,68,.5)';
      for (let t = Math.floor(t0 / step) * step; t <= t1 + step; t += step) {
        if (t < 0) continue;
        const x = this.xOfDisplay(t);
        if (x < GUTTER) continue;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, y);
        ctx.lineTo(Math.round(x) + 0.5, y + ROW_H);
        ctx.stroke();
      }
      // The bars sit on top of the time grid and under the content, a shade warmer so a
      // count and a bar are not read as the same line.
      if (bars.length) {
        ctx.strokeStyle = 'rgba(255,183,3,.16)';
        for (const x of bars) {
          ctx.beginPath();
          ctx.moveTo(x + 0.5, y);
          ctx.lineTo(x + 0.5, y + ROW_H);
          ctx.stroke();
        }
      }

      if (tr.body) this.drawCastTrack(tr, y);
      else this.drawCueTrack(tr, y);
    });

    // pauses sit above every track
    for (const p of sortedPauses(show)) {
      const x0 = this.xOfDisplay(displayOfContent(show, p.t));
      const wpx = Math.max(2, (p.duration / 1000) * state.ui.pxPerSec);
      ctx.fillStyle = 'rgba(255,183,3,.10)';
      ctx.fillRect(x0, RULER_H, wpx, h - RULER_H);
      ctx.strokeStyle = 'rgba(255,183,3,.55)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x0 + 0.5, RULER_H);
      ctx.lineTo(x0 + 0.5, h);
      ctx.moveTo(x0 + wpx + 0.5, RULER_H);
      ctx.lineTo(x0 + wpx + 0.5, h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,183,3,.85)';
      ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('PAUSE ' + (p.duration / 1000).toFixed(1) + 's', x0 + 4, RULER_H + 11);
    }

    // A stretch being drawn is a marker that does not exist yet, so it is drawn as
    // a ghost with the length it would have — the drag is the duration.
    if (this.drag && (this.drag.type === 'newHold' || this.drag.type === 'newPause')) {
      const d = this.drag;
      const from = Math.min(d.anchor, d.at);
      const to = Math.max(d.anchor, d.at);
      const x0 = this.xOfDisplay(displayOfContent(show, from));
      const x1 = this.xOfDisplay(displayOfContent(show, to));
      const isPause = d.type === 'newPause';
      let top = RULER_H;
      let height = h - RULER_H;
      if (!isPause) {
        const idx = tracks.findIndex((t) => t.id === d.trackId);
        const ry = RULER_H + idx * ROW_H - vs;
        top = ry + ROW_H / 2 - 6;
        height = 12;
      }
      ctx.fillStyle = isPause ? 'rgba(255,183,3,.12)' : 'rgba(255,183,3,.26)';
      ctx.fillRect(x0, top, Math.max(2, x1 - x0), height);
      ctx.strokeStyle = 'rgba(255,183,3,.85)';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x0 + 0.5, top);
      ctx.lineTo(x0 + 0.5, top + height);
      ctx.moveTo(x1 + 0.5, top);
      ctx.lineTo(x1 + 0.5, top + height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = THEME.accent;
      ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
      const label = (isPause ? 'PAUSE ' : 'HOLD ') + ((to - from) / 1000).toFixed(1) + 's';
      ctx.fillText(label, Math.max(x0, GUTTER) + 4, (isPause ? RULER_H : top) + 10);
    }

    // Act boundaries run down through the tracks, under every cue band.
    ctx.strokeStyle = 'rgba(255,183,3,.22)';
    ctx.setLineDash([3, 5]);
    for (let i = 1; i < acts.length; i++) {
      const x = this.xOfDisplay(displayOfContent(show, acts[i].start));
      if (x < GUTTER || x > w) continue;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, RULER_H);
      ctx.lineTo(Math.round(x) + 0.5, h);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // The end of the show is a boundary rather than a band: it has no length,
    // because it is the moment the clock stops.
    let endTag = null;
    if (lastMoment) {
      const ex = this.xOfDisplay(displayOfContent(show, lastMoment.t));
      if (ex >= GUTTER - 1 && ex <= w + 1) {
        const held = this.drag && this.drag.type === 'end';
        // The stretch the music spends coming down into the end, drawn as what it is:
        // a wash that deepens towards the line, so the ending reads as a fade and not
        // as a cut. `0` draws nothing, because there is nothing to fade over.
        const fadeMs = Number(show.prefs.endFade) || 0;
        if (fadeMs > 0) {
          const fx = this.xOfDisplay(displayOfContent(show, lastMoment.t - fadeMs));
          if (ex - fx > 1) {
            const wash = ctx.createLinearGradient(fx, 0, ex, 0);
            wash.addColorStop(0, 'rgba(255,77,109,0)');
            wash.addColorStop(1, 'rgba(255,77,109,.17)');
            ctx.fillStyle = wash;
            ctx.fillRect(fx, RULER_H, ex - fx, h - RULER_H);
          }
        }
        ctx.strokeStyle = held ? THEME.danger : 'rgba(255,77,109,.8)';
        ctx.lineWidth = held ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(ex) + 0.5, RULER_H);
        ctx.lineTo(Math.round(ex) + 0.5, h);
        ctx.stroke();
        ctx.lineWidth = 1;
        // Past the end is not the show, so it is cross-hatched: nothing there is
        // waiting to be played, and a cue parked beyond it is visible as such.
        ctx.strokeStyle = 'rgba(255,77,109,.10)';
        ctx.beginPath();
        for (let x = ex + 6; x < w; x += 12) {
          ctx.moveTo(x, h);
          ctx.lineTo(x + (h - RULER_H), RULER_H);
        }
        ctx.stroke();
        endTag = { x: ex, text: 'END ' + fmtShort(displayOfContent(show, lastMoment.t)) };
      }
    }

    ctx.restore();

    // The moment, named in the ruler rather than on the top row: the first track's
    // waveform is where the show's opening music lives, and the label would sit on
    // it. The pill has its own ground so it stays readable over the tick marks.
    if (endTag) {
      ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
      const tw = ctx.measureText(endTag.text).width;
      const lx = endTag.x + 5 + tw > w - 4 ? endTag.x - tw - 5 : endTag.x + 5;
      ctx.fillStyle = 'rgba(8,11,16,.94)';
      ctx.fillRect(lx - 3, 16, tw + 6, 13);
      ctx.fillStyle = THEME.danger;
      ctx.fillText(endTag.text, lx, 25.5);
    }

    // ---- gutter
    ctx.fillStyle = '#11161f';
    ctx.fillRect(0, 0, GUTTER, h);
    ctx.fillStyle = '#0e131b';
    ctx.fillRect(0, 0, GUTTER, RULER_H);
    ctx.strokeStyle = '#1d2634';
    ctx.beginPath();
    ctx.moveTo(GUTTER + 0.5, 0);
    ctx.lineTo(GUTTER + 0.5, h);
    ctx.stroke();
    // master eye: hide everything except the performer being edited
    this.drawEye(11, RULER_H / 2, state.ui.onlyFocused);
    ctx.fillStyle = state.ui.onlyFocused ? THEME.accent : '#55637a';
    ctx.font = '9px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('ONLY FOCUSED', 28, RULER_H / 2 + 3);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, RULER_H, GUTTER, h - RULER_H);
    ctx.clip();
    tracks.forEach((tr, i) => {
      const y = RULER_H + i * ROW_H - vs;
      if (y + ROW_H < RULER_H || y > h) return;
      this.drawEye(11, y + ROW_H / 2, tr.visible);
      ctx.fillStyle = tr.color;
      ctx.fillRect(28, y + ROW_H / 2 - 3.5, 7, 7);
      const onStage = tr.body ? tr.shown : tr.visible;
      ctx.fillStyle = tr.selected ? THEME.accent : onStage ? THEME.text : '#55637a';
      ctx.font = (tr.selected ? '600 ' : '') + '12px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(short(tr.label, 22), 40, y + ROW_H / 2 + 4, GUTTER - 46);
      ctx.strokeStyle = '#161e29';
      ctx.beginPath();
      ctx.moveTo(0, y + ROW_H + 0.5);
      ctx.lineTo(GUTTER, y + ROW_H + 0.5);
      ctx.stroke();
    });
    ctx.restore();

    // ---- playhead
    const px = this.xOfDisplay(displayOfContent(show, state.ui.playhead));
    if (px >= GUTTER) {
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = THEME.accent;
      ctx.beginPath();
      ctx.moveTo(px - 6, 0);
      ctx.lineTo(px + 6, 0);
      ctx.lineTo(px, 9);
      ctx.closePath();
      ctx.fill();

      // Where the playhead is in the music, riding just below the ruler so a phrase can be read
      // against the count while the show plays. The pill has its own ground: it sits over the
      // top track, which is exactly where the first row's blocks are.
      const where = countAt(show, state.ui.playhead);
      if (where) {
        const label = 'bar ' + where.bar + ' \u00b7 ' + where.count;
        ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
        const tw = ctx.measureText(label).width;
        const pad = 5;
        const boxW = tw + pad * 2;
        // Turned to the left of the line when there is no room on the right, and held inside the
        // strip, so the readout cannot fall off the edge it is following — nor into the gutter.
        let boxX = px + 5;
        if (boxX + boxW > w - 3) boxX = px - 5 - boxW;
        boxX = Math.max(GUTTER + 2, Math.min(boxX, w - 3 - boxW));
        const boxY = RULER_H + 1;
        ctx.fillStyle = 'rgba(8,11,16,.92)';
        ctx.fillRect(boxX, boxY, boxW, 14);
        ctx.strokeStyle = 'rgba(255,183,3,.4)';
        ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, 13);
        ctx.fillStyle = THEME.accent;
        ctx.fillText(label, boxX + pad, boxY + 10);
      }
    }
  }

  drawEye(x, y, on) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = on ? '#9fb0c8' : '#3b4759';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (on) {
      ctx.ellipse(x, y, 6, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#9fb0c8';
      ctx.beginPath();
      ctx.arc(x, y, 1.9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.ellipse(x, y, 6, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 5);
      ctx.lineTo(x + 6, y - 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCastTrack(tr, y) {
    const ctx = this.ctx;
    const show = state.show;
    const d = tr.body;
    const keys = d.keys;
    const mid = y + ROW_H / 2;

    // A carried prop has no path of its own; it moves with its dancer.
    if (d.carriedBy) {
      ctx.fillStyle = hexA(d.color, 0.14);
      ctx.fillRect(GUTTER, mid - 5, this.canvas.clientWidth - GUTTER, 10);
      // Each hand-off is a moment: a tick with the name of whoever takes it next.
      ctx.font = '9px "Segoe UI", system-ui, sans-serif';
      for (const h of d.carryHandoffs || []) {
        const hx = this.xOfDisplay(displayOfContent(show, h.at));
        const to = show.cast.find((c) => c.id === h.to);
        ctx.strokeStyle = 'rgba(200,215,235,.7)';
        ctx.beginPath();
        ctx.moveTo(hx + 0.5, mid - 9);
        ctx.lineTo(hx + 0.5, mid + 9);
        ctx.stroke();
        if (to) {
          ctx.fillStyle = 'rgba(200,215,235,.8)';
          ctx.fillText(to.name, hx + 3, mid - 8);
        }
      }
      ctx.fillStyle = 'rgba(200,215,235,.55)';
      const holder = carrierOf(show, d, state.ui.playhead);
      ctx.fillText(holder ? 'carried by ' + holder.name : 'carried', GUTTER + 6, mid + 3);
      return;
    }

    if (keys.length > 1) {
      for (let i = 0; i < keys.length - 1; i++) {
        const x0 = this.xOfLocal(d, keys[i].t);
        const x1 = this.xOfLocal(d, keys[i + 1].t);
        ctx.fillStyle = hexA(d.color, tr.selected ? 0.3 : 0.18);
        ctx.fillRect(x0, mid - 3, Math.max(2, x1 - x0), 6);
      }
    }

    for (const h of holdsFor(show, d.id)) {
      const x0 = this.xOfDisplay(displayOfContent(show, h.t));
      const wpx = Math.max(3, (h.duration / 1000) * state.ui.pxPerSec);
      ctx.fillStyle = 'rgba(255,183,3,.22)';
      ctx.fillRect(x0, mid - 6, wpx, 12);
      ctx.strokeStyle = 'rgba(255,183,3,.8)';
      ctx.strokeRect(x0 + 0.5, mid - 6.5, Math.max(2, wpx - 1), 12);
      ctx.fillStyle = THEME.accent;
      ctx.font = '8px "Segoe UI", system-ui, sans-serif';
      // The length is editable now, so the band says what it is, like a pause does.
      ctx.fillText(wpx > 46 ? 'HOLD ' + (h.duration / 1000).toFixed(1) + 's' : 'HOLD', x0 + 3, mid + 3);
    }

    keys.forEach((k, ki) => {
      const x = this.xOfLocal(d, k.t);
      ctx.save();
      ctx.translate(x, mid);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = tr.selected ? '#fff' : d.color;
      ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.strokeStyle = '#05080c';
      ctx.strokeRect(-3.5, -3.5, 7, 7);
      if (tr.selected && ki === state.ui.stationIdx) {
        ctx.strokeStyle = THEME.accent;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-6.5, -6.5, 13, 13);
        ctx.lineWidth = 1;
      }
      ctx.restore();
    });
  }

  drawCueTrack(tr, y) {
    const ctx = this.ctx;
    const show = state.show;
    const mid = y + ROW_H / 2;
    const w = this.canvas.clientWidth;

    if (tr.kind === 'video') {
      this.drawVideoTrack(tr, y);
      return;
    }

    if (tr.kind === 'slides') {
      const images = new Map((show.images || []).map((image) => [image.id, image]));
      ctx.font = '9px "Segoe UI", system-ui, sans-serif';
      for (const cue of show.slideCues || []) {
        const x0 = this.xOfDisplay(displayOfContent(show, cue.at));
        const x1 = this.xOfDisplay(displayOfContent(show, cue.at + Math.max(0, Number(cue.fade) || 0)));
        const bandW = Math.max(2, x1 - x0);
        const selected = state.ui.slideCueId === cue.id;
        const off = cue.imageId == null;
        ctx.fillStyle = off ? (selected ? 'rgba(255,107,107,.3)' : 'rgba(255,107,107,.17)')
          : (selected ? 'rgba(244,167,193,.34)' : 'rgba(244,167,193,.2)');
        ctx.fillRect(x0, mid - 8, bandW, 16);
        ctx.strokeStyle = selected ? THEME.accent : off ? 'rgba(255,107,107,.75)' : 'rgba(244,167,193,.75)';
        ctx.strokeRect(x0 + 0.5, mid - 7.5, Math.max(1, bandW - 1), 15);
        // The cue moment stays visible even for a cut; the opposite edge is the
        // fade handle, which can be pulled independently.
        ctx.fillStyle = selected ? THEME.accent : 'rgba(255,235,244,.9)';
        ctx.fillRect(Math.round(x0) - 1, mid - 10, 2, 20);
        ctx.fillRect(Math.round(x1) - 2, mid - 10, 3, 20);
        const image = cue.imageId == null ? null : images.get(cue.imageId);
        const label = off ? 'PROJECTOR OFF' : image ? image.name : 'Missing image';
        ctx.fillStyle = 'rgba(255,240,246,.92)';
        ctx.fillText(label, x0 + 4, mid + 3, Math.max(20, this.canvas.clientWidth - x0 - 8));
      }
      return;
    }

    if (tr.kind === 'narration') {
      this.drawNarrationTrack(tr, y);
      return;
    }

    // The music row carries the track itself: a waveform from its entry point to
    // its end, so a cue can be judged against the beats rather than guessed.
    if (tr.kind === 'music') {
      const m = tr.track;
      if (!m) {
        ctx.fillStyle = 'rgba(226,236,248,.28)';
        ctx.font = '9px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('no track attached', GUTTER + 6, mid + 3);
      } else {
        // The band is the trimmed span, not the file: a track trimmed to stop before
        // the next one starts must look that short on the row.
        const span = musicSpan(m);
        const x0 = this.xOfDisplay(displayOfContent(show, m.start));
        const x1 = this.xOfDisplay(displayOfContent(show, m.start + span));
        const muted = m.visible === false;
        const left = Math.max(GUTTER, x0);
        const right = Math.min(w, x1);
        const a = tr.visible && !muted ? 1 : 0.3;
        if (right > left) {
          ctx.fillStyle = 'rgba(76,201,240,' + 0.1 * a + ')';
          ctx.fillRect(left, mid - 10, right - left, 20);
          // Peaks come from the stored record when the track has not been
          // decoded, so every row draws its own waveform, not just the one in
          // the player.
          const peaks = music.peaksFor(m.key);
          if (peaks && peaks.length && right - left > 8) {
            ctx.strokeStyle = 'rgba(126,216,245,' + 0.8 * a + ')';
            ctx.beginPath();
            // Peaks cover the whole file, so a trimmed track takes the first part of
            // them rather than stretching all of it across the shorter band.
            const fit = m.length > 0 ? Math.min(1, span / m.length) : 1;
            for (let px = left; px < right; px += 1) {
              const i = Math.min(peaks.length - 1, Math.floor(((px - left) / (right - left)) * peaks.length * fit));
              const amp = Math.max(0.6, peaks[i] * 9);
              ctx.moveTo(Math.round(px) + 0.5, mid - amp);
              ctx.lineTo(Math.round(px) + 0.5, mid + amp);
            }
            ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(76,201,240,' + 0.65 * a + ')';
          ctx.strokeRect(left + 0.5, mid - 10.5, Math.max(2, right - left - 1), 21);
        }
        if (x0 >= GUTTER && right > x0) {
          ctx.fillStyle = 'rgba(226,236,248,.8)';
          ctx.font = '9px "Segoe UI", system-ui, sans-serif';
          // A file name can be longer than the stage is wide, so it is trimmed as
          // well as clipped: a track row must not paint over its neighbours.
          const room = Math.max(48, Math.min(300, right - Math.max(x0, GUTTER) - 8));
          ctx.fillText((muted ? 'muted \u00b7 ' : '') + short(tr.label, 26), Math.max(x0, GUTTER) + 4, mid - 13, room);
        }
        // The band ends where the track stops playing, so its end is the trim
        // handle: a grip says it can be pulled.
        const rightEnd = Math.min(w, x1);
        if (rightEnd > GUTTER + 2) {
          const held = this.drag && this.drag.type === 'musicEnd' && this.drag.trackId === m.id;
          // Two bars, brighter than the band and taller than it: a handle reads as
          // a handle, not as the waveform ending.
          ctx.fillStyle = held ? THEME.accent : 'rgba(190,236,255,.9)';
          ctx.fillRect(Math.round(rightEnd) - 4, mid - 10, 2, 20);
          ctx.fillRect(Math.round(rightEnd) - 1, mid - 10, 2, 20);
          if (held) {
            // How much of the file still plays, which is the number being chosen.
            const text = 'plays ' + fmtShort(musicSpan(m)) + (m.length > 0 ? ' of ' + fmtShort(m.length) : '');
            ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
            const tw = ctx.measureText(text).width;
            // Inside the band, to the left of the grip: above or below the row it
            // would cover the track next to this one.
            const lx = Math.max(GUTTER + 4, Math.min(w - tw - 8, rightEnd - tw - 10));
            ctx.fillStyle = 'rgba(8,11,16,.9)';
            ctx.fillRect(lx - 4, mid - 10, tw + 8, 13);
            ctx.fillStyle = THEME.accent;
            ctx.fillText(text, lx, mid);
          }
        }
      }
      // Fades sit along the bottom of the row: down is a fade out, up a fade in,
      // so the shape of the row says what the track does through the change.
      for (const c of m.cues || []) {
        const x0 = this.xOfDisplay(displayOfContent(show, c.at));
        const wpx = Math.max(8, ((c.dur || 0) / 1000) * state.ui.pxPerSec);
        const on = state.ui.musicCueId === c.id;
        const silent = Number(c.level) <= 0.005;
        const y0 = mid + 2;
        ctx.fillStyle = silent
          ? 'rgba(255,77,109,' + (on ? 0.5 : 0.3) + ')'
          : 'rgba(76,201,240,' + (on ? 0.5 : 0.3) + ')';
        ctx.fillRect(x0, y0, wpx, 8);
        ctx.strokeStyle = on ? THEME.accent : silent ? 'rgba(255,77,109,.9)' : 'rgba(76,201,240,.9)';
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, Math.max(2, wpx - 1), 7);
        if (on) {
          ctx.fillStyle = THEME.accent;
          ctx.fillRect(Math.round(x0) - 1, y0 - 2, 3, 12);
          ctx.fillRect(Math.round(x0 + wpx) - 2, y0 - 2, 3, 12);
        }
        if (wpx > 24) {
          ctx.font = '8px "Segoe UI", system-ui, sans-serif';
          ctx.fillStyle = 'rgba(226,236,248,.85)';
          ctx.fillText(silent ? 'OUT' : Number(c.level) >= 0.995 ? 'IN' : 'HALF', x0 + 4, y0 + 7);
        }
      }
    }

    // A lantern's row: one band per cue, as bright as the level the cue goes to,
    // so the shape of the row says the light comes up and goes down.
    if (tr.light) {
      const l = tr.light;
      ctx.font = '9px "Segoe UI", system-ui, sans-serif';
      if (!(l.cues || []).length) {
        ctx.fillStyle = 'rgba(226,236,248,.24)';
        ctx.fillText('no cues yet \u2014 double-click this track where the light changes', GUTTER + 6, mid + 3);
      }
      for (const c of l.cues || []) {
        const x0 = this.xOfDisplay(displayOfContent(show, c.at));
        const wpx = Math.max(8, ((c.dur || 0) / 1000) * state.ui.pxPerSec);
        const on = state.ui.cueId === c.id;
        const out = Number(c.level) <= 0.005;
        ctx.fillStyle = hexA(tr.color, out ? 0.1 : 0.14 + 0.34 * Number(c.level));
        ctx.fillRect(x0, mid - 5, wpx, 10);
        ctx.strokeStyle = on ? THEME.accent : hexA(tr.color, out ? 0.45 : 0.9);
        ctx.strokeRect(x0 + 0.5, mid - 5.5, Math.max(2, wpx - 1), 10);
        if (on) {
          ctx.fillStyle = THEME.accent;
          ctx.fillRect(Math.round(x0) - 1, mid - 10, 3, 20);
          ctx.fillRect(Math.round(x0 + wpx) - 2, mid - 10, 3, 20);
        }
        ctx.beginPath();
        ctx.moveTo(x0 + 0.5, mid - 9);
        ctx.lineTo(x0 + 0.5, mid + 9);
        ctx.stroke();
        ctx.fillStyle = 'rgba(226,236,248,.85)';
        ctx.fillText(lightCueLabel(c, show), x0 + 4, mid + 3);
      }
      const px = this.xOfDisplay(displayOfContent(show, state.ui.playhead));
      const inside = (l.cues || []).some(
        (c) => state.ui.playhead >= c.at && state.ui.playhead <= c.at + (c.dur || 0)
      );
      if (tr.selected && !inside && px > GUTTER && px < w) {
        ctx.fillStyle = THEME.accent;
        ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('+', px + 3, mid + 4);
      }
      return;
    }

    if (tr.scenery) {
      ctx.font = '9px "Segoe UI", system-ui, sans-serif';
      // An empty track says what to do with it rather than looking like a gap.
      if (!(tr.scenery.cues || []).length) {
        ctx.fillStyle = 'rgba(226,236,248,.24)';
        ctx.fillText('no cues yet — double-click this track where the move begins', GUTTER + 6, mid + 3);
      }
      for (const c of tr.scenery.cues || []) {
        const x0 = this.xOfDisplay(displayOfContent(show, c.at));
        const wpx = Math.max(8, ((c.dur || 0) / 1000) * state.ui.pxPerSec);
        // The picked cue says so: its ends are the handles that retime it.
        const on = state.ui.cueId === c.id;
        ctx.fillStyle = hexA(tr.color, on ? 0.5 : 0.35);
        ctx.fillRect(x0, mid - 5, wpx, 10);
        ctx.strokeStyle = on ? THEME.accent : hexA(tr.color, 0.9);
        ctx.strokeRect(x0 + 0.5, mid - 5.5, Math.max(2, wpx - 1), 10);
        if (on) {
          ctx.fillStyle = THEME.accent;
          ctx.fillRect(Math.round(x0) - 1, mid - 10, 3, 20);
          ctx.fillRect(Math.round(x0 + wpx) - 2, mid - 10, 3, 20);
        }
        // A vertical stub marks the moment the cue starts, even at zero length.
        ctx.beginPath();
        ctx.moveTo(x0 + 0.5, mid - 9);
        ctx.lineTo(x0 + 0.5, mid + 9);
        ctx.stroke();
        ctx.fillStyle = 'rgba(226,236,248,.85)';
        ctx.fillText(cueLabel(c), x0 + 4, mid + 3);
      }
      // On the picked row, show where a cue would land: a click on the track
      // sets that moment, and a double-click drops the cue there.
      const px = this.xOfDisplay(displayOfContent(show, state.ui.playhead));
      const inside = (tr.scenery.cues || []).some(
        (c) => state.ui.playhead >= c.at && state.ui.playhead <= c.at + (c.dur || 0)
      );
      if (tr.selected && !inside && px > GUTTER && px < w) {
        ctx.fillStyle = THEME.accent;
        ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('+', px + 3, mid + 4);
      }
      return;
    }

    for (const h of holdsFor(show, tr.id)) {
      const x0 = this.xOfDisplay(displayOfContent(show, h.t));
      const wpx = Math.max(3, (h.duration / 1000) * state.ui.pxPerSec);
      ctx.fillStyle = 'rgba(255,183,3,.18)';
      ctx.fillRect(x0, mid - 6, wpx, 12);
      ctx.strokeStyle = 'rgba(255,183,3,.7)';
      ctx.strokeRect(x0 + 0.5, mid - 6.5, Math.max(2, wpx - 1), 12);
    }
  }

  // A picture clip gets its own independently editable band on the show clock.
  drawVideoTrack(tr, y) {
    const ctx = this.ctx;
    const show = state.show;
    const clip = tr.video;
    if (!clip) return;
    const span = videoSpan(clip);
    const x0 = this.xOfDisplay(displayOfContent(show, clip.at));
    const x1 = this.xOfDisplay(displayOfContent(show, clip.at + span));
    const left = Math.max(GUTTER, x0);
    const right = Math.min(this.canvas.clientWidth, x1);
    const mid = y + ROW_H / 2;
    const opacity = tr.visible ? 1 : 0.32;
    if (right > left) {
      ctx.fillStyle = 'rgba(183,148,244,' + 0.22 * opacity + ')';
      ctx.fillRect(left, mid - 9, right - left, 18);
      ctx.strokeStyle = 'rgba(183,148,244,' + 0.9 * opacity + ')';
      ctx.strokeRect(left + 0.5, mid - 9.5, Math.max(2, right - left - 1), 19);
      if (right - left > 36) {
        ctx.fillStyle = 'rgba(245,239,255,' + 0.9 * opacity + ')';
        ctx.font = '9px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(short(clip.name || 'Video', 26), left + 4, mid + 3, Math.max(20, right - left - 8));
      }
    }
    // Bright grips mark source-range boundaries.
    if (x0 >= GUTTER && x0 <= this.canvas.clientWidth) {
      ctx.fillStyle = 'rgba(232,216,255,' + opacity + ')';
      ctx.fillRect(Math.round(x0) - 2, mid - 9, 2, 18);
    }
    if (x1 >= GUTTER && x1 <= this.canvas.clientWidth) {
      const held = this.drag && this.drag.type === 'videoEnd' && this.drag.video.id === clip.id;
      ctx.fillStyle = held ? THEME.accent : 'rgba(232,216,255,' + opacity + ')';
      ctx.fillRect(Math.round(x1) - 4, mid - 9, 2, 18);
      ctx.fillRect(Math.round(x1) - 1, mid - 9, 2, 18);
      if (held) {
        const text = 'plays ' + fmtShort(span) + ' of ' + fmtShort(Math.max(0, clip.length));
        ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
        const tw = ctx.measureText(text).width;
        const lx = Math.max(GUTTER + 4, Math.min(this.canvas.clientWidth - tw - 8, x1 - tw - 10));
        ctx.fillStyle = 'rgba(8,11,16,.9)';
        ctx.fillRect(lx - 4, mid - 10, tw + 8, 13);
        ctx.fillStyle = THEME.accent;
        ctx.fillText(text, lx, mid);
      }
    }
  }

  // One row, one band per piece of voice, drawn from its own shape so a line can
  // be placed against the music without playing it.
  drawNarrationTrack(tr, y) {
    const ctx = this.ctx;
    const show = state.show;
    const w = this.canvas.clientWidth;
    const clips = show.narration || [];
    ctx.font = '9px "Segoe UI", system-ui, sans-serif';
    if (!clips.length) {
      ctx.fillStyle = 'rgba(226,236,248,.24)';
      ctx.fillText('no voice on the show yet — press Record in the Narration panel', GUTTER + 6, y + ROW_H / 2 + 3);
      return;
    }
    const lanes = narrationLanes(clips);
    const bandH = Math.max(4, Math.min(16, (ROW_H - 4) / lanes.count));
    const paint = tr.visible ? 1 : 0.35;
    for (const c of clips) {
      const x0 = this.xOfDisplay(displayOfContent(show, c.at));
      const x1 = this.xOfDisplay(displayOfContent(show, c.at + (c.length || 0)));
      const left = Math.max(GUTTER, x0);
      const right = Math.min(w, x1);
      // A piece that starts to the right of the view is still worth a stub when
      // its start is on screen; nothing at all if both ends are away.
      if (right < GUTTER || x0 > w) continue;
      const top = y + 2 + (lanes.laneOf.get(c.id) || 0) * bandH;
      const speaking = state.ui.playhead >= c.at && state.ui.playhead < c.at + (c.length || 0);
      ctx.fillStyle = 'rgba(246,193,119,' + (speaking ? 0.44 : 0.22) * paint + ')';
      ctx.fillRect(left, top, Math.max(2, right - left), bandH);
      const peaks = narration.peaksFor(c.key);
      if (peaks && peaks.length && right - left > 10) {
        const half = Math.max(1, bandH / 2 - 0.5);
        ctx.strokeStyle = 'rgba(255,223,178,' + 0.85 * paint + ')';
        ctx.beginPath();
        for (let px = left; px < right; px += 1) {
          const i = Math.min(peaks.length - 1, Math.floor(((px - left) / (right - left)) * peaks.length));
          const amp = Math.max(0.5, peaks[i] * half);
          ctx.moveTo(Math.round(px) + 0.5, top + bandH / 2 - amp);
          ctx.lineTo(Math.round(px) + 0.5, top + bandH / 2 + amp);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = speaking ? THEME.accent : 'rgba(246,193,119,' + 0.85 * paint + ')';
      ctx.strokeRect(left + 0.5, top + 0.5, Math.max(2, right - left - 1), bandH - 1);
      // The moment it begins is a tick, so a line shorter than its name is
      // still a thing you can put the pointer on.
      if (x0 >= GUTTER) {
        ctx.strokeStyle = 'rgba(246,193,119,.9)';
        ctx.beginPath();
        ctx.moveTo(Math.round(x0) + 0.5, top - 1);
        ctx.lineTo(Math.round(x0) + 0.5, top + bandH + 1);
        ctx.stroke();
      }
      if (bandH >= 9 && right - left > 40) {
        ctx.fillStyle = 'rgba(255,240,220,.9)';
        ctx.fillText(short(c.name, 24), Math.max(left, GUTTER) + 4, top + bandH / 2 + 3, Math.max(24, right - Math.max(left, GUTTER) - 6));
      }
    }
  }

  /* --------------------------------------------------------------- row menu */

  // The right button asks "what can I do here", and the row answers: the menu is
  // built from the row's kind, and every entry places its thing at the moment
  // that was clicked so it can then be dragged into shape.
  onContext(e) {
    e.preventDefault();
    this.closeMenu();
    if (state.ui.watch) return;
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (x < GUTTER || y < RULER_H) return;
    // A tenth of a second, like every other placement, so the band lands on a
    // number the panel can show.
    const at = Math.max(0, Math.round(this.contentAtX(x) / 100) * 100);

    // A band under the pointer belongs to its own marker rather than to the row:
    // a pause runs the whole height of the tracks, a hold sits on one row. This is
    // where their length can be typed as well as dragged.
    // The end line first: it is thin, and where it crosses a pause band the press
    // was meant for it.
    const endHere = y > RULER_H ? this.endAt(x) : null;
    if (endHere) {
      this.openMenu(
        e.clientX,
        e.clientY,
        'End \u00b7 ' + fmtShort(displayOfContent(state.show, endHere.t)),
        this.endItems(endHere)
      );
      return;
    }
    const pause = this.pauseAt(x);
    if (pause) {
      this.openMenu(e.clientX, e.clientY, 'Pause \u00b7 ' + fmtShort(pause.t), this.markerItems(pause, 'pause'));
      return;
    }
    const i = this.rowIndexAt(y);
    if (i == null) return;
    const tr = this.tracks()[i];
    if (tr.kind === 'slides') {
      state.ui.selectedTrack = 'slides';
      const cue = this.slideCueAt(x);
      if (cue) state.ui.slideCueId = cue.cue.id;
      const items = this.menuItems(tr, x, y, at);
      if (items.length) this.openMenu(e.clientX, e.clientY, 'Slide projector · ' + fmtShort(at), items);
      return;
    }
    const hold = this.holdAt(tr, x);
    if (hold) {
      this.openMenu(
        e.clientX,
        e.clientY,
        'Hold \u00b7 ' + tr.label + ' \u00b7 ' + fmtShort(hold.t),
        this.markerItems(hold, 'hold')
      );
      return;
    }
    const items = this.menuItems(tr, x, y, at);
    if (!items.length) return;
    this.openMenu(e.clientX, e.clientY, tr.label + ' \u00b7 ' + fmtShort(at), items);
  }

  // Which pause band the pointer is on, if any. Pauses are drawn across every row,
  // so they win over whatever row is under them, as they do for a click.
  pauseAt(x) {
    for (const p of sortedPauses(state.show)) {
      const x0 = this.xOfDisplay(displayOfContent(state.show, p.t));
      const wpx = (p.duration / 1000) * state.ui.pxPerSec;
      if (x >= x0 && x <= x0 + wpx) return p;
    }
    return null;
  }

  // Which point of the end line the pointer is on, if any. It has no width, so the
  // target is widened by a few pixels on either side of it.
  endAt(x) {
    const m = endMarker(state.show);
    if (!m) return null;
    const ex = this.xOfDisplay(displayOfContent(state.show, m.t));
    return Math.abs(x - ex) <= 5 ? m : null;
  }

  // The end's own tools: the moment it lands on, how the music comes down into it,
  // and how to lose it.
  endItems(marker) {
    const show = state.show;
    let started = false;
    const items = [];
    // The clock is what the ruler prints, so that is what the field shows — a pause
    // earlier in the show does not make the end land on a different number.
    items.push({
      field: 'end-at',
      label: 'The show ends at',
      value: +(displayOfContent(show, marker.t) / 1000).toFixed(1),
      onChange: (v) => {
        if (!Number.isFinite(v) || v < 0) return;
        if (!started) {
          commit();
          started = true;
        }
        setEnd(show, contentOfDisplay(show, Math.round(v * 1000)));
        this.app.rebuild();
      },
    });
    items.push({ sep: true });
    // The ending is a fade, not a cut, unless you say otherwise: this is the length
    // the music takes to reach nothing on the last moment.
    items.push({
      field: 'end-fade',
      label: 'The music fades over',
      value: +((Number(show.prefs.endFade) || 0) / 1000).toFixed(1),
      onChange: (v) => {
        if (!Number.isFinite(v) || v < 0) return;
        show.prefs.endFade = Math.max(0, Math.min(120, v)) * 1000;
        persist();
      },
    });
    items.push({ sep: true });
    items.push({
      label: 'Go to it',
      note: fmtShort(displayOfContent(show, marker.t)),
      run: () => {
        state.ui.playhead = marker.t;
        state.ui.activePause = null;
        state.ui.collision = null;
        this.app.rebuild();
      },
    });
    items.push({
      label: 'Delete the end',
      danger: true,
      run: () => {
        commit();
        removeEnd(show);
        this.app.rebuild();
      },
    });
    return items;
  }

  // Empty row space where a drag would draw a marker rather than move something: a
  // performer's row. It says so with a crosshair.
  markerSpace(x, y) {
    const i = this.rowIndexAt(y);
    if (i == null) return false;
    const tr = this.tracks()[i];
    if (!tr) return false;
    if (!tr.body) return false;
    return !tr.body.carriedBy && !this.stationAt(tr.body, x) && !this.holdAt(tr, x);
  }

  // Which hold band of this row the pointer is on.
  holdAt(tr, x) {
    if (!tr || !tr.id) return null;
    for (const h of holdsFor(state.show, tr.id)) {
      const x0 = this.xOfDisplay(displayOfContent(state.show, h.t));
      const wpx = Math.max(3, (h.duration / 1000) * state.ui.pxPerSec);
      if (x >= x0 - 2 && x <= x0 + wpx) return h;
    }
    return null;
  }

  // A marker's own tools: how long it lasts, where it is, and how to lose it.
  markerItems(marker, kind) {
    const isHold = kind === 'hold';
    const items = [];
    // The length is one undo step for the whole visit to the menu, not one per
    // keystroke: typing 2.5 must not take three presses of undo to reverse.
    let started = false;
    items.push({
      field: 'marker-dur',
      label: isHold ? 'The hold lasts' : 'The pause lasts',
      value: +((marker.duration || 0) / 1000).toFixed(1),
      onChange: (v) => {
        if (!Number.isFinite(v)) return;
        if (!started) {
          commit();
          started = true;
        }
        // A tenth of a second, so a hold cannot be nothing at all.
        marker.duration = Math.max(100, Math.min(120000, Math.round(v * 1000)));
        this.app.rebuild();
      },
    });
    items.push({ sep: true });
    items.push({
      label: 'Go to it',
      note: fmtShort(marker.t),
      run: () => {
        state.ui.playhead = marker.t;
        state.ui.activePause = null;
        state.ui.collision = null;
        this.app.rebuild();
      },
    });
    items.push({
      label: isHold ? 'Delete this hold' : 'Delete this pause',
      danger: true,
      run: () => {
        commit();
        state.show.markers = state.show.markers.filter((m) => m !== marker);
        this.app.rebuild();
      },
    });
    return items;
  }

  // What this row can do at this moment. Only what the row can actually hold: a
  // dialogue row has no fades, a dancer has no fly floor.
  menuItems(tr, x, y, at) {
    const show = state.show;
    const items = [];
    const goTo = () => {
      state.ui.playhead = at;
      state.ui.activePause = null;
      state.ui.collision = null;
    };

    if (tr.kind === 'slides') {
      const hit = this.slideCueAt(x);
      if (hit) {
        items.push({
          label: 'Edit slide cue',
          note: fmtShort(hit.cue.at),
          run: () => {
            state.ui.slideCueId = hit.cue.id;
            state.ui.selectedTrack = 'slides';
            this.app.editSlideCue(hit.cue.id);
          },
        });
        items.push({ sep: true });
        items.push({
          label: 'Remove slide cue',
          danger: true,
          run: () => {
            commit();
            removeSlideCue(show, hit.cue.id);
            if (state.ui.slideCueId === hit.cue.id) state.ui.slideCueId = null;
            persist();
            this.app.rebuild();
          },
        });
        items.push({ sep: true });
      }
      items.push({
        label: 'Projector off',
        note: fmtShort(at),
        run: () => {
          commit();
          const cue = addSlideCue(show, at, null, FADE_DEFAULT_MS);
          state.ui.selectedTrack = 'slides';
          state.ui.slideCueId = cue.id;
          this.app.rebuild();
        },
      });
      const images = show.images || [];
      for (const image of images) {
        items.push({
          label: 'Projector on · ' + image.name,
          note: fmtShort(at),
          run: () => {
            commit();
            const fadeInput = document.getElementById('slideFade');
            const fade = Math.max(0, Math.min(120000, Math.round((Number(fadeInput?.value) || 0) * 1000)));
            const cue = addSlideCue(show, at, image.id, fade);
            state.ui.slideImageId = image.id;
            state.ui.slideCueId = cue.id;
            state.ui.selectedTrack = 'slides';
            this.app.rebuild();
          },
        });
      }
      if (!images.length) items.push({ label: 'Load gallery images first', run: () => this.app.editSlideCue() });
    } else if (tr.kind === 'video' && tr.video) {
      const clip = tr.video;
      items.push({ label: 'Edit video', run: () => this.app.editVideo(clip.id) });
      items.push({ sep: true });
      items.push({
        label: 'Remove video',
        danger: true,
        run: () => {
          commit();
          removeVideo(show, clip.id);
          if (state.ui.selectedTrack === clip.id) state.ui.selectedTrack = null;
          persist();
          this.app.rebuild();
        },
      });
    } else if (tr.kind === 'music' && tr.track) {
      const m = tr.track;
      const fadeTo = (level, label) => ({
        label,
        run: () => {
          commit();
          goTo();
          const cue = addMusicCue(m, at, level, Math.max(0, Math.round(fadeDurOf(show))));
          if (cue) {
            state.ui.musicCueId = cue.id;
            state.ui.selectedTrack = 'music';
          }
          this.app.rebuild();
        },
      });
      // Chosen once, above the actions: a change of scene takes as long as the cloth
      // does, not as long as a constant in the code.
      items.push({
        field: 'fade-dur',
        label: 'The fade takes',
        value: +(fadeDurOf(show) / 1000).toFixed(1),
        onChange: (v) => {
          if (!Number.isFinite(v)) return;
          state.show.prefs.fadeDur = Math.max(0, Math.min(120, v)) * 1000;
          persist();
        },
      });
      items.push(fadeTo(0, 'Fade the music out'));
      items.push(fadeTo(0.5, 'Fade the music to half'));
      items.push(fadeTo(1, 'Bring the music back'));
      items.push({ sep: true });
      items.push({
        label: 'The track ends here',
        note: fmtShort(at),
        run: () => {
          commit();
          goTo();
          const raw = Math.round((at - m.start) / 100) * 100;
          const capped = m.length > 0 ? Math.min(raw, m.length) : raw;
          m.play = Math.max(100, capped);
          if (state.ui.playing) music.seek(state.ui.playhead);
          this.app.rebuild();
        },
      });
      items.push({
        label: 'The track starts here',
        note: fmtShort(at),
        run: () => {
          commit();
          goTo();
          setMusicStart(show, m.id, at);
          if (state.ui.playing) music.seek(state.ui.playhead);
          this.app.rebuild();
        },
      });
      items.push({
        label: m.visible === false ? 'Unmute this track' : 'Mute this track',
        run: () => {
          commit();
          m.visible = m.visible === false;
          this.app.rebuild();
        },
      });
      items.push({ label: 'Replace the audio…', run: () => this.app.replaceMusicAudio(m.id, m.start) });
      const fade = this.fadeAt(x, m);
      if (fade) {
        items.push({ sep: true });
        items.push({
          label: 'Delete this fade',
          danger: true,
          note: fmtShort(fade.cue.at),
          run: () => {
            commit();
            removeMusicCue(m, fade.cue.id);
            if (state.ui.musicCueId === fade.cue.id) state.ui.musicCueId = null;
            this.app.rebuild();
          },
        });
      }
    } else if (tr.light) {
      const l = tr.light;
      const cueTo = (level, label) => ({
        label,
        run: () => {
          commit();
          goTo();
          const cue = addLightCue(l, at, level, Math.max(0, Math.round(lightDurOf(show))));
          if (cue) {
            state.ui.lightId = l.id;
            state.ui.selectedTrack = l.id;
            state.ui.cueId = cue.id;
          }
          this.app.rebuild();
        },
      });
      items.push({
        field: 'light-dur',
        label: 'The change takes',
        value: +(lightDurOf(show) / 1000).toFixed(1),
        onChange: (v) => {
          if (!Number.isFinite(v)) return;
          state.show.prefs.lightDur = Math.max(0, Math.min(120, v)) * 1000;
          persist();
        },
      });
      // "Up" means the level this lantern was given, so a warm side light comes
      // back to its own brightness rather than to whatever a constant says.
      const up = Number.isFinite(l.level) && l.level > 0.05 ? l.level : 1;
      items.push(cueTo(up, 'Bring the light up to ' + Math.round(up * 100) + '%'));
      items.push(cueTo(0.5, 'Take it to half'));
      items.push(cueTo(0, 'Take the light out'));
      // Hand-offs. The brightness is left alone — a cue that only moves the aim is a
      // pan of the beam, and doing it at `undefined` level is how that is said.
      const handTo = (to, label) => ({
        label,
        run: () => {
          commit();
          goTo();
          const cue = addLightCue(l, at, undefined, Math.max(0, Math.round(lightDurOf(show))), to);
          if (cue) {
            state.ui.lightId = l.id;
            state.ui.selectedTrack = l.id;
            state.ui.cueId = cue.id;
          }
          this.app.rebuild();
        },
      });
      if ((show.cast || []).length) items.push({ sep: true });
      for (const d of show.cast || []) items.push(handTo(d.id, 'Hand the spot to ' + d.number + '. ' + d.name));
      if (lightFollowAt(show, l, at) || l.followId) items.push(handTo(null, 'Bring it back to its own place'));
      const hit = this.cueAt(tr, x);
      if (hit) {
        items.push({ sep: true });
        items.push({
          label: 'Delete this cue',
          danger: true,
          note: fmtShort(hit.cue.at),
          run: () => {
            commit();
            removeLightCue(l, hit.cue.id);
            if (state.ui.cueId === hit.cue.id) state.ui.cueId = null;
            this.app.rebuild();
          },
        });
      }
    } else if (tr.scenery) {
      const s = tr.scenery;
      const cueTo = (to, label) => ({
        label,
        run: () => {
          commit();
          goTo();
          // The chosen length, which may be 0: a cut is a real cue, and the band's
          // end can be dragged afterwards either way.
          const cue = addSceneryCue(s, at, to, Math.max(0, Math.round(cueDurOf(show))));
          if (cue) {
            state.ui.selectedTrack = s.id;
            state.ui.cueId = cue.id;
          }
          this.app.rebuild();
        },
      });
      // Asked once, above the two actions it applies to, and remembered for the
      // next cue: 0 is a cut, and anything else is the move the crew has time for.
      items.push({
        field: 'cloth-dur',
        label: 'The move takes',
        value: +(cueDurOf(show) / 1000).toFixed(1),
        onChange: (v) => {
          if (!Number.isFinite(v)) return;
          state.show.prefs.cueDur = Math.max(0, Math.min(120, v)) * 1000;
          persist();
        },
      });
      if (s.kind === 'drop') {
        items.push(cueTo({ fly: 0 }, 'Fly the drop out'));
        items.push(cueTo({ fly: 1 }, 'Fly the drop in'));
      } else if (s.kind === 'card') {
        items.push(cueTo({ shown: 1 }, 'Bring the card on'));
        items.push(cueTo({ shown: 0 }, 'Take the card off'));
      } else {
        items.push(cueTo({ open: 0 }, 'Close the curtain'));
        items.push(cueTo({ open: 1 }, 'Open the curtain'));
      }
      const hit = this.cueAt(tr, x);
      if (hit) {
        items.push({ sep: true });
        items.push({
          label: 'Delete this cue',
          danger: true,
          note: fmtShort(hit.cue.at),
          run: () => {
            commit();
            removeSceneryCue(s, hit.cue.id);
            if (state.ui.cueId === hit.cue.id) state.ui.cueId = null;
            this.app.rebuild();
          },
        });
      }
    } else if (tr.kind === 'narration') {
      const hit = this.narrationHit(x, y);
      if (hit) {
        items.push({
          label: 'Go to this line',
          note: fmtShort(hit.clip.at),
          run: () => {
            goTo();
            state.ui.hint = hit.clip.name + ' starts at ' + fmtShort(at);
            this.app.rebuild();
          },
        });
        items.push({
          label: 'Remove this line',
          danger: true,
          run: () => {
            commit();
            // The recording stays in the browser, as it does from the panel: undo
            // must be able to bring the line back, and a take cannot be re-read
            // from disk.
            removeNarration(show, hit.clip.id);
            this.app.rebuild();
          },
        });
        items.push({ sep: true });
      }
      items.push({
        label: 'Record a take here',
        note: fmtShort(at),
        run: () => {
          goTo();
          this.app.recordVoiceAt(at);
        },
      });
      items.push({
        label: 'Attach a voice file here',
        note: fmtShort(at),
        run: () => {
          goTo();
          this.app.attachVoiceAt(at);
        },
      });
    } else if (tr.body) {
      const d = tr.body;
      const station = this.stationAt(d, x);
      if (!d.carriedBy) {
        items.push({
          label: d.keys && d.keys.length ? 'Station at this point' : 'Start a path here',
          note: fmtShort(at),
          run: () => this.app.addKeyAt(d.id, at),
        });
      }
      items.push({
        label: 'Hold here',
        note: +(holdDurOf(show) / 1000).toFixed(1) + ' s',
        run: () => this.app.addHoldAt(d.id, at),
      });
      if (station) {
        items.push({ sep: true });
        items.push({
          label: 'Continue the path from here',
          run: () => {
            goTo();
            this.app.continueFrom(d, station.index);
          },
        });
        items.push({
          label: 'Delete this station and what follows',
          danger: true,
          run: () => this.app.deleteFrom(d, station.index),
        });
      }
    }

    // Any row can stop the show, because a pause is a break in the performance
    // rather than a property of one track.
    items.push({ sep: true });
    items.push({
      label: 'Pause the whole show here',
      note: fmtShort(at),
      run: () => this.app.addPauseAt(at),
    });
    // And any row can end it: the performance finishes here, whatever the running
    // order says.
    items.push({
      label: endMarker(show) ? 'End the show here instead' : 'End the show here',
      note: fmtShort(displayOfContent(show, at)),
      run: () => {
        commit();
        goTo();
        setEnd(show, at);
        state.ui.hint = 'The show ends at ' + fmtShort(displayOfContent(show, at)) + ' \u2014 drag the line to move it';
        this.app.rebuild();
      },
    });
    return items;
  }

  // Which station of this row is under the pointer, if any.
  stationAt(d, x) {
    if (!d || !Array.isArray(d.keys)) return null;
    for (let i = 0; i < d.keys.length; i++) {
      if (Math.abs(this.xOfLocal(d, d.keys[i].t) - x) <= 7) return { key: d.keys[i], index: i };
    }
    return null;
  }

  openMenu(clientX, clientY, headText, items) {
    const el = document.createElement('div');
    el.className = 'track-menu';
    el.setAttribute('role', 'menu');
    const head = document.createElement('div');
    head.className = 'tm-head';
    head.textContent = headText;
    el.appendChild(head);
    for (const item of items) {
      if (item.sep) {
        const sep = document.createElement('div');
        sep.className = 'tm-sep';
        el.appendChild(sep);
        continue;
      }
      // A value that the actions above share: typed here, used by whichever one is
      // picked next. It does not close the menu when it is clicked.
      if (item.field) {
        const row = document.createElement('label');
        row.className = 'tm-field';
        const label = document.createElement('span');
        label.textContent = item.label;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = '0.5';
        input.value = String(item.value);
        input.setAttribute('aria-label', item.label + ' in seconds');
        input.addEventListener('input', () => item.onChange(Number(input.value)));
        const unit = document.createElement('span');
        unit.className = 'tm-note';
        unit.textContent = 's';
        row.append(label, input, unit);
        el.appendChild(row);
        continue;
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tm-item' + (item.danger ? ' danger' : '');
      b.setAttribute('role', 'menuitem');
      const label = document.createElement('span');
      label.textContent = item.label;
      b.appendChild(label);
      if (item.note) {
        const note = document.createElement('span');
        note.className = 'tm-note';
        note.textContent = item.note;
        b.appendChild(note);
      }
      b.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.closeMenu();
        item.run();
      });
      el.appendChild(b);
    }
    document.body.appendChild(el);
    // Keep it on screen: a row near the bottom must open its menu upwards rather
    // than off the edge of the window.
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(clientX, window.innerWidth - w - 8)) + 'px';
    el.style.top = Math.max(8, Math.min(clientY, window.innerHeight - h - 8)) + 'px';
    this.menu = el;
  }

  closeMenu() {
    if (this.menu && this.menu.parentNode) this.menu.parentNode.removeChild(this.menu);
    this.menu = null;
  }

  // A press anywhere else puts the menu away — including the canvas, so the next
  // click always means what it usually means.
  menuOutside(e) {
    if (!this.menu) return;
    if (this.menu.contains(e.target)) return;
    this.closeMenu();
  }

  /* ---------------------------------------------------------- interaction */

  // A scene notch on the act band is a handle. Only the band is grabbable, so a
  // click in the tracks underneath still scrubs or picks a station.
  sceneHandleAt(x) {
    const show = state.show;
    const ranges = sceneRanges(show);
    const acts = actRanges(show);
    for (let i = ranges.length - 1; i >= 0; i--) {
      const r = ranges[i];
      const sx = this.xOfDisplay(displayOfContent(show, r.start));
      if (sx < GUTTER || Math.abs(sx - x) > 5) continue;
      const range = acts[r.actIndex];
      const act = range ? (show.acts || []).find((a) => a.id === range.id) : null;
      const scene = act ? (act.scenes || []).find((s) => s.id === r.id) : null;
      if (scene && range) return { scene, range };
    }
    return null;
  }

  // A projector cue has a moment handle and a fade-end handle; the band between
  // them is also selectable so a click can open its editor without guessing.
  slideCueAt(x) {
    for (const cue of state.show.slideCues || []) {
      const x0 = this.xOfDisplay(displayOfContent(state.show, cue.at));
      const fade = Math.max(0, Number(cue.fade) || 0);
      const x1 = this.xOfDisplay(displayOfContent(state.show, cue.at + fade));
      if (x < x0 - 5 || x > x1 + 5) continue;
      if (Math.abs(x - x1) <= 5) return { cue, zone: 'end', x0, x1 };
      if (Math.abs(x - x0) <= 5) return { cue, zone: 'start', x0, x1 };
      return { cue, zone: 'body', x0, x1 };
    }
    return null;
  }

  // Which cue of this row is under x, and whether the pointer is on one of its
  // ends (retime) or on the band itself (slide it).
  cueAt(tr, x) {
    if (!tr || !(tr.scenery || tr.light)) return null;
    const show = state.show;
    for (const c of (tr.scenery || tr.light).cues || []) {
      const x0 = this.xOfDisplay(displayOfContent(show, c.at));
      const wpx = Math.max(8, ((c.dur || 0) / 1000) * state.ui.pxPerSec);
      if (x < x0 - 2 || x > x0 + wpx) continue;
      const edge = Math.min(5, Math.max(2, wpx / 3));
      const zone = x > x0 + wpx - edge ? 'end' : x < x0 + edge ? 'start' : 'body';
      return { cue: c, zone, x0 };
    }
    return null;
  }

  // Which fade of a music row is under x, and which part of it.
  fadeAt(x, m) {
    if (!m) return null;
    for (const c of m.cues || []) {
      const x0 = this.xOfDisplay(displayOfContent(state.show, c.at));
      const wpx = Math.max(8, ((c.dur || 0) / 1000) * state.ui.pxPerSec);
      if (x < x0 - 2 || x > x0 + wpx) continue;
      const edge = Math.min(5, Math.max(2, wpx / 3));
      const zone = x > x0 + wpx - edge ? 'end' : x < x0 + edge ? 'start' : 'body';
      return { cue: c, zone, x0 };
    }
    return null;
  }

  // Clicking a band picks that cue for editing. It does not move the object
  // selection: the cue's controls live in the scenery list, which is always
  // on screen.
  pickCue(item, cue) {
    state.ui.selectedTrack = item.id;
    state.ui.cueId = cue.id;
    state.ui.dirtyPanels = true;
  }

  cueCursor(x, y) {
    const i = this.rowIndexAt(y);
    if (i == null) return '';
    const tr = this.tracks()[i];
    if (tr.kind === 'slides') {
      const hit = this.slideCueAt(x);
      if (!hit) return '';
      return hit.zone === 'end' ? 'ew-resize' : 'grab';
    }
    const hit = this.cueAt(tr, x);
    if (!hit) return '';
    return hit.zone === 'body' ? 'grab' : 'ew-resize';
  }

  // Which video clip and band zone sits under the pointer.
  videoHit(x, y) {
    const i = this.rowIndexAt(y);
    if (i == null) return null;
    const tr = this.tracks()[i];
    if (tr.kind !== 'video' || !tr.video) return null;
    const clip = tr.video;
    const x0 = this.xOfDisplay(displayOfContent(state.show, clip.at));
    const x1 = this.xOfDisplay(displayOfContent(state.show, clip.at + videoSpan(clip)));
    const right = Math.max(x0 + 6, x1);
    if (x < x0 - 3 || x > right + 2) return null;
    const edge = Math.min(6, Math.max(3, (right - x0) / 3));
    const zone = x < x0 + edge ? 'start' : x > right - edge ? 'end' : 'body';
    return { clip, zone, x0, x1 };
  }


  // Where the pointer is on a music band, and whether it is on the end that
  // trims. The band is as long as the track plays, so its end *is* the trim.
  musicEdge(x, y) {
    const i = this.rowIndexAt(y);
    if (i == null) return null;
    const tr = this.tracks()[i];
    if (tr.kind !== 'music' || !tr.track) return null;
    const m = tr.track;
    const x0 = this.xOfDisplay(displayOfContent(state.show, m.start));
    const x1 = this.xOfDisplay(displayOfContent(state.show, m.start + musicSpan(m)));
    const right = Math.max(x0 + 6, x1);
    if (x < x0 - 2 || x > right) return null;
    const edge = Math.min(5, Math.max(2, (right - x0) / 3));
    return x > right - edge ? 'end' : 'body';
  }

  // Which piece of voice is under the pointer. Both axes matter here, because
  // the narration row splits into lanes when two lines overlap.
  narrationHit(x, y) {
    const i = this.rowIndexAt(y);
    if (i == null) return null;
    const tr = this.tracks()[i];
    if (tr.kind !== 'narration') return null;
    const show = state.show;
    const clips = show.narration || [];
    const lanes = narrationLanes(clips);
    const bandH = Math.max(4, Math.min(16, (ROW_H - 4) / lanes.count));
    const rowY = RULER_H + i * ROW_H - state.ui.vscroll;
    for (const c of clips) {
      const x0 = this.xOfDisplay(displayOfContent(show, c.at));
      const x1 = this.xOfDisplay(displayOfContent(show, c.at + (c.length || 0)));
      if (x < x0 - 2 || x > Math.max(x0 + 4, x1)) continue;
      const top = rowY + 2 + (lanes.laneOf.get(c.id) || 0) * bandH;
      if (y < top - 1 || y > top + bandH + 1) continue;
      return { clip: c, x0 };
    }
    return null;
  }

  onDown(e) {
    // The menu owns the right button: a right-click must not also scrub or pick.
    if (e.button === 2) return;
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const show = state.show;

    if (x < GUTTER) {
      if (y < RULER_H && x < 120) {
        state.ui.onlyFocused = !state.ui.onlyFocused;
        return;
      }
      const i = this.rowIndexAt(y);
      if (i == null) return;
      const tr = this.tracks()[i];
      if (tr.kind === 'video' && x >= 26) {
        state.ui.selectedTrack = tr.id;
        this.app.editVideo(tr.video.id);
        return;
      }
      if (x < 26) {
        if (tr.kind === 'cast') toggleVisibility(tr.body, e.ctrlKey || e.metaKey);
        else if (tr.kind === 'prop') {
          tr.body.visible = tr.body.visible === false;
          // Hiding the prop you are editing drops the focus, or selecting it
          // again would immediately reopen its eye.
          if (!tr.body.visible && state.ui.selectedId === tr.body.id) {
            state.ui.selectedId = null;
            state.ui.stationIdx = null;
          }
        } else if (tr.kind === 'music') {
          // The eye is the mute for that track, and only that track.
          tr.track.visible = tr.track.visible === false;
        } else if (tr.kind === 'video') {
          show.trackVis.video = show.trackVis.video === false;
        } else if (tr.light) {
          // A lantern's eye takes it out of the picture: no pool, no beam. Its
          // cues stay where they are, so the eye is a view, not a deletion.
          tr.light.visible = tr.light.visible === false;
          if (!tr.light.visible && state.ui.lightId === tr.light.id) state.ui.lightId = null;
        } else {
          show.trackVis[tr.id] = !show.trackVis[tr.id];
        }
        this.app.rebuild();
        if (tr.kind !== 'video') this.app.select(state.ui.selectedId);
        return;
      }
      state.ui.selectedTrack = tr.id;
      if (tr.kind === 'slides') {
        this.app.editSlideCue();
        return;
      }
      if (tr.kind === 'video') {
        this.app.editVideo(tr.video.id);
        return;
      }
      // A lantern has no body to hand to `select`, so its own focus is opened
      // instead — and `select(null)` would close it again.
      if (tr.light) {
        this.app.focusLight(tr.light.id);
        this.app.rebuild();
        return;
      }
      this.app.select(tr.body ? tr.body.id : null);
      return;
    }

    // Dragging a scene boundary along the band moves the scene, not the playhead.
    if (y < 15) {
      const handle = this.sceneHandleAt(x);
      if (handle) {
        commit();
        this.drag = { type: 'scene', scene: handle.scene, range: handle.range };
        return;
      }
    }

    if (y < RULER_H) {
      this.drag = { type: 'scrub' };
      this.scrubTo(x);
      return;
    }

    // The end of the show is one line, and grabbing it moves the moment the show
    // stops: a curtain call is placed by eye, then typed exactly if it matters.
    const endHit = y > RULER_H ? this.endAt(x) : null;
    if (endHit) {
      commit();
      this.drag = { type: 'end', marker: endHit };
      return;
    }

    // marker under the cursor wins over the row underneath it
    for (const p of sortedPauses(show)) {
      const x0 = this.xOfDisplay(displayOfContent(show, p.t));
      const wpx = (p.duration / 1000) * state.ui.pxPerSec;
      if (x >= x0 && x <= x0 + wpx) {
        commit();
        this.drag = { type: 'pause', marker: p };
        return;
      }
    }

    const i = this.rowIndexAt(y);
    if (i == null) return;
    const tr = this.tracks()[i];
    state.ui.selectedTrack = tr.id;
    // Shift means the same thing on every row: draw a pause. It is checked before the
    // bands so it works over one as well as on empty space — which is where a music
    // row usually is, since its track covers the whole stage of the clock.
    if (e.shiftKey) {
      this.beginMarkerDrag('pause', null, x);
      return;
    }
    if (tr.kind === 'slides') {
      const hit = this.slideCueAt(x);
      if (hit) {
        commit();
        state.ui.slideCueId = hit.cue.id;
        state.ui.selectedTrack = 'slides';
        this.app.editSlideCue(hit.cue.id);
        this.drag = {
          type: hit.zone === 'end' ? 'slideCueEnd' : 'slideCue',
          cue: hit.cue,
          grab: x - hit.x0,
          dirty: true,
        };
        return;
      }
      state.ui.slideCueId = null;
      state.ui.dirtyPanels = true;
      this.drag = { type: 'scrub' };
      this.scrubTo(x);
      return;
    }
    if (tr.kind === 'video') {
      const hit = this.videoHit(x, y);
      if (hit) {
        commit();
        const clip = hit.clip;
        this.drag = hit.zone === 'body'
          ? { type: 'video', video: clip, grab: x - hit.x0 }
          : hit.zone === 'start'
          ? { type: 'videoStart', video: clip, at: clip.at, trimIn: clip.trimIn, trimOut: clip.trimOut, grab: x - hit.x0 }
          : { type: 'videoEnd', video: clip, trimIn: clip.trimIn };
        return;
      }
      this.drag = { type: 'scrub' };
      this.scrubTo(x);
      return;
    }
    if (tr.kind === 'narration') {
      const hit = this.narrationHit(x, y);
      if (hit) {
        commit();
        this.drag = { type: 'voice', clip: hit.clip, grab: x - hit.x0 };
        return;
      }
      // An empty stretch of the row is the clock: the click puts the playhead
      // where the next line would go, so it can be recorded against what is
      // already there.
      this.drag = { type: 'scrub' };
      this.scrubTo(x);
      return;
    }
    if (tr.light) {
      // A lantern's own controls live in the Lights list, the way a curtain's do,
      // so picking the row lights it rather than changing the object selection.
      const hit = this.cueAt(tr, x);
      state.ui.lightId = tr.light.id;
      state.ui.selectedTrack = tr.light.id;
      if (hit) {
        state.ui.cueId = hit.cue.id;
        state.ui.dirtyPanels = true;
        this.drag = {
          type: hit.zone === 'body' ? 'lightCue' : hit.zone === 'end' ? 'lightCueEnd' : 'lightCueStart',
          cue: hit.cue,
          light: tr.light,
          grab: x - hit.x0,
          endAt: hit.cue.at + (hit.cue.dur || 0),
          dirty: false,
        };
        return;
      }
      // An empty stretch is where a cue goes: the click puts the playhead at that
      // moment, and a double-click drops a cue there.
      state.ui.cueId = null;
      state.ui.dirtyPanels = true;
      this.drag = { type: 'scrub' };
      this.scrubTo(x);
      return;
    }
    if (tr.scenery) {
      // Cloth keeps its controls in the side list rather than the inspector, so
      // picking its row lights the row instead of changing the object selection.
      const hit = this.cueAt(tr, x);
      if (hit) {
        this.pickCue(tr.scenery, hit.cue);
        this.drag = {
          type: hit.zone === 'body' ? 'cue' : hit.zone === 'end' ? 'cueEnd' : 'cueStart',
          cue: hit.cue,
          scenery: tr.scenery,
          grab: x - hit.x0,
          endAt: hit.cue.at + (hit.cue.dur || 0),
          dirty: false,
        };
        return;
      }
      // An empty stretch of a cloth track is where a cue goes: the click puts
      // the playhead at that moment and a drag scrubs, so the point you drop
      // next is the one you can see on the stage.
      state.ui.cueId = null;
      state.ui.dirtyPanels = true;
      this.drag = { type: 'scrub' };
      this.scrubTo(x);
      return;
    }
    this.app.select(tr.body ? tr.body.id : null);

    if (tr.body) {
      const d = tr.body;
      for (const k of d.keys) {
        if (Math.abs(this.xOfLocal(d, k.t) - x) <= 7) {
          commit();
          // Clicking a station dot picks that station, so a drag on stage then
          // moves this point instead of appending a new one at the end.
          state.ui.stationIdx = d.keys.indexOf(k);
          state.ui.playhead = contentOfLocal(show, d.id, k.t);
          this.drag = { type: 'key', key: k, dancer: d };
          return;
        }
      }
    }

    // A fade's band is a cue, and takes precedence over sliding the track.
    if (tr.kind === 'music' && tr.track) {
      const hit = this.fadeAt(x, tr.track);
      if (hit) {
        state.ui.musicCueId = hit.cue.id;
        state.ui.dirtyPanels = true;
        this.drag = {
          type: hit.zone === 'body' ? 'fade' : hit.zone === 'end' ? 'fadeEnd' : 'fadeStart',
          cue: hit.cue,
          grab: x - hit.x0,
          endAt: hit.cue.at + (hit.cue.dur || 0),
          dirty: false,
        };
        return;
      }
    }

    // The track drags as a whole: grab the waveform and slide where it enters.
    // Its end is the trim handle instead, so the band can be shortened to the
    // beat the fade ends on rather than typed in.
    if (tr.kind === 'music' && tr.track) {
      const m = tr.track;
      const zone = this.musicEdge(x, y);
      if (zone) {
        commit();
        this.drag = zone === 'end'
          ? { type: 'musicEnd', trackId: m.id }
          : { type: 'music', grab: x - this.xOfDisplay(displayOfContent(show, m.start)), trackId: m.id };
        return;
      }
    }

    for (const h of holdsFor(show, tr.id)) {
      const x0 = this.xOfDisplay(displayOfContent(show, h.t));
      const wpx = Math.max(3, (h.duration / 1000) * state.ui.pxPerSec);
      if (x >= x0 - 2 && x <= x0 + wpx) {
        commit();
        this.drag = { type: 'hold', marker: h };
        return;
      }
    }

    // Nothing under the pointer, so the row itself is the instrument: a stretch of a
    // performer's row holds that performer for as long as it is drawn, and Shift
    // draws a pause on any row. The length comes from the drag, not from a default.
    if (tr.kind === 'lights') {
      this.beginMarkerDrag('pause', null, x);
    } else if (tr.body && !tr.body.carriedBy) {
      this.beginMarkerDrag('hold', tr.id, x);
    }
  }

  // Start drawing a marker: the moment the drag began is one end of it, and the
  // pointer sets the other.
  beginMarkerDrag(kind, trackId, x) {
    const at = Math.max(0, Math.round(this.contentAtX(x) / 100) * 100);
    this.drag = { type: kind === 'hold' ? 'newHold' : 'newPause', anchor: at, at, trackId };
  }

  onMove(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const show = state.show;

    if (!this.drag) {
      // Say what is grabbable before anything is dragged: a scene notch, or the
      // track you can slide along the clock.
      if (e.target === this.canvas) {
        const y = e.clientY - r.top;
        // An armed phrase is judged on the ruler before it is placed, so the ruler remembers
        // where the pointer is and the drawing says where its stations would land.
        const onRuler = y > 16 && y < RULER_H && x >= GUTTER;
        this.hover =
          onRuler && state.ui.phraseArmed
            ? { at: this.contentAtX(x), bar: e.shiftKey || this.shiftHeld }
            : null;
        const cue = y > RULER_H ? this.cueCursor(x, y) : '';
        const video = y > RULER_H ? this.videoHit(x, y) : null;
        if (onRuler && state.ui.phraseArmed) this.canvas.style.cursor = 'copy';
        else if (y < RULER_H && x < GUTTER && this.rowIndexAt(y) != null) this.canvas.style.cursor = 'pointer';
        else if (y < 15 && this.sceneHandleAt(x)) this.canvas.style.cursor = 'ew-resize';
        else if (y > RULER_H && this.endAt(x)) this.canvas.style.cursor = 'ew-resize';
        else if (cue) this.canvas.style.cursor = cue;
        else if (video) this.canvas.style.cursor = video.zone === 'body' ? 'grab' : 'ew-resize';
        else if (y > RULER_H && this.musicEdge(x, y) === 'end') this.canvas.style.cursor = 'ew-resize';
        else if (y > RULER_H && this.musicEdge(x, y) === 'body') this.canvas.style.cursor = 'grab';
        else if (y > RULER_H && this.narrationHit(x, y)) this.canvas.style.cursor = 'grab';
        else if (y > RULER_H && this.markerSpace(x, y)) this.canvas.style.cursor = 'crosshair';
        else this.canvas.style.cursor = '';
      }
      return;
    }

    if (this.drag.type === 'scrub') {
      this.scrubTo(x);
    } else if (this.drag.type === 'key') {
      const t = Math.max(0, this.localAtX(this.drag.dancer, x));
      this.drag.key.t = Math.round(t);
      const keys = this.drag.dancer.keys.sort((a, b) => a.t - b.t);
      // Keep stored transitions honest so a later timing edit reflows from the
      // dragged times rather than snapping them back.
      for (let i = 1; i < keys.length; i++) {
        if (Number.isFinite(keys[i].dur)) keys[i].dur = Math.max(0, keys[i].t - keys[i - 1].t);
      }
    } else if (this.drag.type === 'hold' || this.drag.type === 'pause') {
      const t = Math.max(0, this.contentAtX(x));
      this.drag.marker.t = Math.round(t);
    } else if (this.drag.type === 'end') {
      // A tenth of a second, like every other moment placed by hand, so the field
      // in the menu can show what was dragged without rounding again.
      setEnd(show, Math.max(0, this.contentAtX(x)));
    } else if (this.drag.type === 'video') {
      const clip = this.drag.video;
      clip.at = Math.max(0, Math.round(this.contentAtX(x - this.drag.grab) / 100) * 100);
    } else if (this.drag.type === 'videoStart') {
      const clip = this.drag.video;
      const d = this.drag;
      const desiredAt = Math.max(0, Math.round(this.contentAtX(x - d.grab) / 100) * 100);
      const sourceRoom = Math.max(0, d.trimOut - d.trimIn);
      const minSpan = Math.min(100, sourceRoom);
      const delta = Math.max(-d.at, -d.trimIn, Math.min(desiredAt - d.at, d.trimOut - minSpan - d.trimIn));
      clip.at = d.at + delta;
      clip.trimIn = d.trimIn + delta;
    } else if (this.drag.type === 'videoEnd') {
      const clip = this.drag.video;
      const mediaEnd = Math.max(0, Number(clip.length) || 0);
      const remaining = Math.max(0, mediaEnd - this.drag.trimIn);
      const minSpan = Math.min(100, remaining);
      const desired = Math.round((this.contentAtX(x) - clip.at + this.drag.trimIn) / 100) * 100;
      clip.trimOut = Math.max(this.drag.trimIn + minSpan, Math.min(mediaEnd, desired));
    } else if (this.drag.type === 'musicEnd') {
      const m = (show.musicTracks || []).find((t) => t.id === this.drag.trackId);
      if (!m) return;
      // A tenth of a second, the same step the band is dragged in. The trim can
      // never run past the file, and never to nothing — a zero-length track would
      // leave the music with no span at all.
      const raw = Math.round((Math.max(0, this.contentAtX(x)) - m.start) / 100) * 100;
      const capped = m.length > 0 ? Math.min(raw, m.length) : raw;
      m.play = Math.max(100, capped);
    } else if (this.drag.type === 'newHold' || this.drag.type === 'newPause') {
      // Only while the button is held: a mouse merely crossing the window must not
      // stretch a band that is being drawn.
      if (e.buttons === 0) return;
      // The pointer is the other end of the marker; a tenth of a second, so the
      // length it lands on is a number worth reading.
      const t = Math.max(0, this.contentAtX(x));
      this.drag.at = Math.max(0, Math.round(t / 100) * 100);
    } else if (this.drag.type === 'voice') {
      // A tenth of a second, like the music: finer than anyone can place a line
      // by hand, coarse enough that the starts field stays a number worth reading.
      const t = Math.max(0, this.contentAtX(x - this.drag.grab));
      setNarrationAt(show, this.drag.clip.id, Math.round(t / 100) * 100);
    } else if (this.drag.type === 'music') {
      // A tenth of a second is finer than anyone can place a cue by hand and
      // coarse enough that the panel's field stays readable.
      const t = Math.max(0, this.contentAtX(x - this.drag.grab));
      this.drag.trackStart = Math.round(t / 100) * 100;
      setMusicStart(show, this.drag.trackId, this.drag.trackStart);
    } else if (this.drag.type === 'fade' || this.drag.type === 'fadeEnd' || this.drag.type === 'fadeStart') {
      const m = (show.musicTracks || []).find((t) => (t.cues || []).some((c) => c.id === this.drag.cue.id));
      if (!m) return;
      if (!this.drag.dirty) {
        commit();
        this.drag.dirty = true;
      }
      const t = Math.max(0, this.contentAtX(x));
      const move = this.drag;
      if (move.type === 'fade') {
        updateMusicCue(m, move.cue.id, { at: Math.max(0, this.contentAtX(x - move.grab)) });
      } else if (move.type === 'fadeEnd') {
        updateMusicCue(m, move.cue.id, { dur: t - move.cue.at });
      } else {
        const at = Math.max(0, Math.min(t, move.endAt));
        updateMusicCue(m, move.cue.id, { at, dur: move.endAt - at });
      }
    } else if (this.drag.type === 'slideCue' || this.drag.type === 'slideCueEnd') {
      const cue = this.drag.cue;
      if (!this.drag.dirty) {
        commit();
        this.drag.dirty = true;
      }
      const t = Math.max(0, Math.round(this.contentAtX(x) / 100) * 100);
      if (this.drag.type === 'slideCue') {
        cue.at = Math.max(0, Math.round(this.contentAtX(x - this.drag.grab) / 100) * 100);
      } else {
        cue.fade = Math.max(0, Math.min(120000, t - cue.at));
      }
    } else if (this.drag.type === 'scene') {
      const moved = moveSceneTo(show, this.drag.scene.id, Math.max(0, this.contentAtX(x)));
      state.ui.hint = moved ? null : 'Each scene needs its own stretch of the act';
    } else if (this.drag.type === 'lightCue' || this.drag.type === 'lightCueEnd' || this.drag.type === 'lightCueStart') {
      if (!this.drag.dirty) {
        commit();
        this.drag.dirty = true;
      }
      const t = Math.max(0, this.contentAtX(x));
      const move = this.drag;
      if (move.type === 'lightCue') {
        updateLightCue(move.light, move.cue.id, { at: Math.max(0, this.contentAtX(x - move.grab)) });
      } else if (move.type === 'lightCueEnd') {
        updateLightCue(move.light, move.cue.id, { dur: t - move.cue.at });
      } else {
        const at = Math.max(0, Math.min(t, move.endAt));
        updateLightCue(move.light, move.cue.id, { at, dur: move.endAt - at });
      }
    } else if (this.drag.type === 'cue' || this.drag.type === 'cueEnd' || this.drag.type === 'cueStart') {
      if (!this.drag.dirty) {
        commit();
        this.drag.dirty = true;
      }
      const t = Math.max(0, this.contentAtX(x));
      const move = this.drag;
      if (move.type === 'cue') {
        updateCue(move.scenery, move.cue.id, { at: Math.max(0, this.contentAtX(x - move.grab)) });
      } else if (move.type === 'cueEnd') {
        // The far end follows the pointer; the start stays where it is.
        updateCue(move.scenery, move.cue.id, { dur: t - move.cue.at });
      } else {
        // The start moves and the end holds, so the move gets longer or shorter.
        const at = Math.max(0, Math.min(t, move.endAt));
        updateCue(move.scenery, move.cue.id, { at, dur: move.endAt - at });
      }
    }
  }

  onUp() {
    // A stretch that was drawn becomes a marker; a click that merely landed is not
    // a drag and makes nothing, which is why there is a floor on the span.
    if (this.drag && (this.drag.type === 'newHold' || this.drag.type === 'newPause')) {
      const d = this.drag;
      this.drag = null;
      const from = Math.min(d.anchor, d.at);
      const span = Math.abs(d.at - d.anchor);
      if (span >= 100) {
        commit();
        state.show.markers.push({
          id: uid('m'),
          kind: d.type === 'newHold' ? 'hold' : 'pause',
          trackId: d.trackId || undefined,
          t: from,
          duration: Math.round(span),
        });
        state.ui.hint = (d.type === 'newHold' ? 'Held' : 'Paused') + ' for ' + (span / 1000).toFixed(1) + ' s from ' + fmtShort(from);
      }
      persist();
      this.app.rebuild();
      return;
    }
    if (this.drag) {
      const moved = this.drag.type === 'music' || this.drag.type === 'musicEnd';
      this.drag = null;
      persist();
      this.app.rebuild();
      // The cue moved under a running track: restart it from the right place.
      if (moved && state.ui.playing) music.seek(state.ui.playhead);
    }
  }

  scrubTo(x) {
    state.ui.playhead = Math.max(0, contentOfDisplay(state.show, this.timeAtX(x)));
    state.ui.activePause = null;
    state.ui.collision = null;
  }

  onDouble(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const show = state.show;
    // The ruler is the music, so what is put there belongs on a count and not between two of
    // them: double-click below the running order and above the tracks to place a point. Shift
    // puts it on the bar instead. A phrase armed from the movement sheet takes the same click:
    // its stations divide the counts from here rather than one point landing on the count. The
    // band at the very top is left alone — that is where scenes are dragged.
    if (y > 16 && y < RULER_H && x >= GUTTER) {
      const at = Math.max(0, contentOfDisplay(show, this.timeAtX(x)));
      if (state.ui.phraseArmed) this.app.placePhraseOnCount(at, e.shiftKey);
      else this.app.addPointOnCount(at, e.shiftKey);
      return;
    }

    for (const p of show.markers.slice()) {
      if (p.kind === 'pause') {
        const x0 = this.xOfDisplay(displayOfContent(show, p.t));
        const wpx = (p.duration / 1000) * state.ui.pxPerSec;
        if (x >= x0 && x <= x0 + wpx) {
          commit();
          show.markers = show.markers.filter((m) => m !== p);
          this.app.rebuild();
          return;
        }
      }
    }

    if (x < GUTTER || y < RULER_H) return;
    const i = this.rowIndexAt(y);
    if (i == null) return;
    const tr = this.tracks()[i];
    if (tr.kind === 'slides') {
      const hit = this.slideCueAt(x);
      if (hit) {
        state.ui.slideCueId = hit.cue.id;
        state.ui.selectedTrack = 'slides';
        this.app.editSlideCue(hit.cue.id);
      } else {
        state.ui.slideCueId = null;
        state.ui.selectedTrack = 'slides';
        const at = Math.max(0, Math.round(this.contentAtX(x) / 100) * 100);
        this.app.addSlideCueAt(at);
      }
      return;
    }
    if (tr.kind === 'video') {
      this.app.editVideo(tr.video.id);
      return;
    }
    if (tr.kind === 'narration') {
      // Double-clicking a line goes to it. It does not delete it: a recording
      // cannot be got back by undo, so removal is the panel's deliberate ×.
      const hit = this.narrationHit(x, y);
      if (hit) {
        state.ui.playhead = hit.clip.at;
        state.ui.activePause = null;
        state.ui.selectedTrack = 'narration';
        state.ui.hint = hit.clip.name + ' starts at ' + fmtShort(displayOfContent(show, hit.clip.at));
        this.app.rebuild();
      }
      return;
    }
    if (tr.kind === 'music' && tr.track) {
      const m = tr.track;
      // Double-clicking a fade band removes it.
      for (const c of (m.cues || []).slice()) {
        const x0 = this.xOfDisplay(displayOfContent(show, c.at));
        const wpx = Math.max(8, ((c.dur || 0) / 1000) * state.ui.pxPerSec);
        if (x >= x0 - 2 && x <= x0 + wpx) {
          commit();
          removeMusicCue(m, c.id);
          if (state.ui.musicCueId === c.id) state.ui.musicCueId = null;
          this.app.rebuild();
          return;
        }
      }
      // An empty spot takes a fade the other way from where the level stands, so
      // one double-click takes the music down and the next brings it back.
      commit();
      const at = Math.max(0, contentOfDisplay(show, this.timeAtX(x)));
      // "Flip" is only a flip if it reads the track's own level, not the show's.
      const cue = addMusicCue(m, at, musicLevelAt(m, at) >= 0.5 ? 0 : 1, FADE_DEFAULT_MS);
      if (cue) {
        state.ui.playhead = cue.at;
        state.ui.selectedTrack = 'music';
        state.ui.musicCueId = cue.id;
        state.ui.dirtyPanels = true;
        this.app.rebuild();
      }
      return;
    }
    if (tr.light) {
      // Double-clicking a cue band removes that cue.
      for (const c of (tr.light.cues || []).slice()) {
        const x0 = this.xOfDisplay(displayOfContent(show, c.at));
        const wpx = Math.max(8, ((c.dur || 0) / 1000) * state.ui.pxPerSec);
        if (x >= x0 - 2 && x <= x0 + wpx) {
          commit();
          removeLightCue(tr.light, c.id);
          if (state.ui.cueId === c.id) state.ui.cueId = null;
          this.app.rebuild();
          return;
        }
      }
      // An empty spot takes a cue the other way from where the light stands, so one
      // double-click takes it out and the next brings it back up.
      commit();
      const at = Math.max(0, contentOfDisplay(show, this.timeAtX(x)));
      const now = lightLevelAt(tr.light, at);
      const up = Number.isFinite(tr.light.level) && tr.light.level > 0.05 ? tr.light.level : 1;
      const cue = addLightCue(tr.light, at, now >= 0.5 ? 0 : up, lightDurOf(show));
      if (cue) {
        state.ui.playhead = cue.at;
        state.ui.lightId = tr.light.id;
        state.ui.selectedTrack = tr.light.id;
        state.ui.cueId = cue.id;
        state.ui.dirtyPanels = true;
        this.app.rebuild();
      }
      return;
    }
    if (tr.scenery) {
      // Double-clicking a cue band removes that cue.
      for (const c of (tr.scenery.cues || []).slice()) {
        const x0 = this.xOfDisplay(displayOfContent(show, c.at));
        const wpx = Math.max(8, ((c.dur || 0) / 1000) * state.ui.pxPerSec);
        if (x >= x0 - 2 && x <= x0 + wpx) {
          commit();
          removeSceneryCue(tr.scenery, c.id);
          this.app.rebuild();
          return;
        }
      }
      // An empty spot takes a cue. It flips the piece to its other state, which
      // is what a cloth cue is — an open curtain closes, a hanging drop flies
      // out — and the band can then be dragged, retimed or retargeted.
      commit();
      const at = Math.max(0, contentOfDisplay(show, this.timeAtX(x)));
      const st = sceneryStateAt(tr.scenery, at);
      const to = tr.scenery.kind === 'drop'
        ? { fly: st.fly >= 0.5 ? 0 : 1 }
        : tr.scenery.kind === 'card'
          ? { shown: st.shown >= 0.5 ? 0 : 1 }
          : { open: st.open >= 0.5 ? 0 : 1 };
      const cue = addSceneryCue(tr.scenery, at, to, CUE_DEFAULT_MS);
      if (cue) {
        state.ui.playhead = cue.at;
        state.ui.selectedTrack = tr.scenery.id;
        state.ui.cueId = cue.id;
        state.ui.dirtyPanels = true;
        this.app.rebuild();
      }
      return;
    }
    if (!tr.body) {
      for (const h of holdsFor(show, tr.id).slice()) {
        const x0 = this.xOfDisplay(displayOfContent(show, h.t));
        const wpx = Math.max(3, (h.duration / 1000) * state.ui.pxPerSec);
        if (x >= x0 - 2 && x <= x0 + wpx) {
          commit();
          show.markers = show.markers.filter((m) => m !== h);
          this.app.rebuild();
          return;
        }
      }
      return;
    }

    const d = tr.body;
    for (const h of holdsFor(show, d.id).slice()) {
      const x0 = this.xOfDisplay(displayOfContent(show, h.t));
      const wpx = Math.max(3, (h.duration / 1000) * state.ui.pxPerSec);
      if (x >= x0 - 2 && x <= x0 + wpx) {
        commit();
        show.markers = show.markers.filter((m) => m !== h);
        this.app.rebuild();
        return;
      }
    }

    // A carried prop has no stations of its own; double-clicking its row must
    // not quietly build a path that is never used.
    if (d.carriedBy) {
      state.ui.hint = 'That prop is carried — detach it before adding stations';
      return;
    }
    if (d.keys.some((k) => Math.abs(this.xOfLocal(d, k.t) - x) <= 7)) return;
    commit();
    const lt = Math.max(0, this.localAtX(d, x));
    const p = posAtLocal(d, lt) || { x: 0, y: 2 };
    d.keys.push({ t: Math.round(lt), x: p.x, y: p.y });
    d.keys.sort((a, b) => a.t - b.t);
    this.app.rebuild();
  }

  onWheel(e) {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (e.ctrlKey || e.metaKey) {
      const anchor = this.timeAtX(x);
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      state.ui.pxPerSec = Math.max(4, Math.min(800, state.ui.pxPerSec * factor));
      state.ui.scrollT = Math.max(0, anchor / 1000 - (x - GUTTER) / state.ui.pxPerSec);
    } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      state.ui.scrollT = Math.max(0, state.ui.scrollT + d / state.ui.pxPerSec);
    } else {
      state.ui.vscroll = Math.max(0, state.ui.vscroll + e.deltaY);
    }
  }
}

function short(text, n) {
  const s = String(text == null ? '' : text);
  return s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
}

function fmtShort(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const frac = Math.round((ms % 1000) / 100);
  const base = String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  return state.ui.pxPerSec > 90 ? base + '.' + frac : base;
}

// A light cue's label. A hand-off names the performer it goes to, because that is the
// thing a stage manager has to catch; the level rides along after it when the same cue
// moves both.
function lightCueLabel(c, show) {
  const lv = Number(c.level);
  const hasLevel = Number.isFinite(lv);
  const level = !hasLevel ? '' : lv <= 0.005 ? 'OUT' : lv >= 0.995 ? 'FULL' : Math.round(lv * 100) + '%';
  if ('followId' in c) {
    const d = c.followId ? (show.cast || []).find((x) => x.id === c.followId) : null;
    const who = d ? d.name : 'own place';
    return '\u2192 ' + who + (level ? ' \u00b7 ' + level : '');
  }
  return level || 'CUE';
}

function cueLabel(c) {
  // A card has no halfway state: it is held up in front of the house or it is not.
  if (Number.isFinite(c.shown)) return c.shown > 0.5 ? 'CARD ON' : 'CARD OFF';
  if (Number.isFinite(c.open)) {
    if (c.open >= 0.999) return 'OPEN';
    if (c.open <= 0.001) return 'CLOSE';
    return 'OPEN ' + Math.round(c.open * 100) + '%';
  }
  if (Number.isFinite(c.fly)) return c.fly > 0.5 ? 'FLY IN' : 'FLY OUT';
  return 'CUE';
}

function hexA(hex, a) {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  return 'rgba(' + parseInt(full.slice(0, 2), 16) + ',' + parseInt(full.slice(2, 4), 16) + ',' + parseInt(full.slice(4, 6), 16) + ',' + a + ')';
}
