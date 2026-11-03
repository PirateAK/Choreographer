// The movement vocabulary as a cheat sheet: every position, step and level the planner
// knows, each one drawn as a small dancer doing it, moving. A drop-down can name a move but
// it cannot show one, and a name you cannot recognise is a name you do not use — the point
// of this sheet is to see the move, then put it on the path.
//
// It draws with the same two functions the stage does (`specOf`/`blendSpecs` and `drawPose`),
// so a cell cannot disagree with the figure it is describing, and it animates on its own
// clock instead of the show's: a reference has no playhead.

import { POSES, STEPS, LEVELS, THEME, AIR_LIFT, phraseShape, phraseOffsets, COUNT_EPS } from './model.js';
import { specOf, blendSpecs, drawPose, darker } from './pose.js';

/* --------------------------------------------------------- what is on the sheet */

// One line each, in the words a studio uses. A move with no note would be a picture of a
// word, which is the thing this sheet exists to avoid.
const POSE_NOTES = {
  first: 'Feet together, arms curved low in front — where class starts.',
  second: 'The wide one: arms open at shoulder height, feet a stride apart.',
  third: 'One arm curved over the head, the other out, feet crossed behind.',
  fourth: 'As third, but the low arm reaches forward and the legs split fore and aft.',
  fifth: 'Both arms rounded above the head, feet crossed tight — the closed position.',
  tendu: 'One foot stretched out to touch the floor, the other taking the weight.',
  plie: 'Both knees out over the toes, the whole body a hand’s width lower.',
  releve: 'Up on the balls of the feet, arms lifted — the rise before a turn.',
  arabesque: 'The long line: one leg carried back and up, one arm forward, one back.',
  attitude: 'The same lifted leg, bent — the toe drawn up towards the standing knee.',
  pirouette: 'Up on one pointe, the other foot at the knee, arms rounded into a hoop.',
  'pas-de-bourree': 'Links two positions: crossed feet, one on the pointe behind.',
  chasse: 'A lunge that carries the dancer across the stage, leaning into it.',
};

const STEP_NOTES = {
  walk: 'The plain blend: one position becomes the next as the dancer travels.',
  chasse: 'The feet chase each other past a bent front knee, carrying the dancer.',
  'pas-de-bourree': 'A small three-step link: back, side, front, under the body.',
  pirouette: 'A revolution on one pointe — give the station a turn of 360.',
};

const LEVEL_NOTES = {
  flat: 'The whole foot on the deck, where every dancer starts.',
  demi: 'Half point: the heel comes off and the body stands a little taller.',
  pointe: 'On the tips of the toes — the tallest a dancer ever stands.',
  air: `Off the deck: a jump, or a dancer held aloft. ${AIR_LIFT} m unless a height is typed.`,
};

// The three kinds of thing a station can be told, in the order they are read.
export function moveGroups() {
  return [
    { kind: 'pose', title: 'Positions', note: 'What the body is doing at the point.', moves: POSES.filter(([v]) => v !== 'none').map(([v, label]) => ({ value: v, label, note: POSE_NOTES[v] || '' })) },
    { kind: 'step', title: 'Steps', note: 'How the dancer travels into the point.', moves: STEPS.map(([v, label]) => ({ value: v, label, note: STEP_NOTES[v] || '' })) },
    { kind: 'level', title: 'Levels', note: 'How the point meets the floor.', moves: LEVELS.map(([v, label]) => ({ value: v, label, note: LEVEL_NOTES[v] || '' })) },
  ];
}

/* --------------------------------------------------------------- one cell drawn */

const smooth = (u) => {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
};

// A cell is a small stage: a floor line, a dancer as tall as the cell allows, and the move
// happening on a loop. `p` is the loop's own progress, 0 to 1.
const LOOP_MS = 2600;

function drawCell(cell, ms) {
  const cv = cell.canvas;
  const ctx = cv.getContext('2d');
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (!w || !h) return;
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Room at the top for a jump: the tallest a dancer gets here is a head at the apex, and a
  // figure that gains 0.35 m at this size would go out of the top of the cell.
  const hgt = Math.max(28, h - 34); // the figure's height in pixels
  const feet = h - 12;
  const cx = w / 2;
  const p = ((ms - cell.phase) % LOOP_MS) / LOOP_MS;

  // Floor: the same faint deck line the elevation draws, so a rise has something to rise from.
  ctx.strokeStyle = THEME.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, feet + 0.5);
  ctx.lineTo(w - 6, feet + 0.5);
  ctx.stroke();

  const body = '#8fa6c4';
  const paint = (spec, x, y, turn = 0) =>
    drawPose(ctx, {
      spec,
      x,
      y,
      h: hgt,
      facing: 1,
      body,
      hair: darker(body, 0.55),
      width: Math.max(1.3, hgt * 0.045),
    });

  if (cell.kind === 'pose') {
    // Into the position and out of it again: what the move looks like, not just where it
    // ends up. A smooth triangle holds the position a moment at its top.
    const t = 0.5 - 0.5 * Math.cos(p * Math.PI * 2);
    const spec = blendSpecs(specOf('none'), specOf(cell.value), smooth(t));
    // A dashed silhouette of the plain standing figure, so the move reads as a change.
    if (cell.value !== 'none') {
      ctx.save();
      ctx.globalAlpha = 0.18;
      const ghost = specOf('none');
      const g = drawPose(ctx, { spec: ghost, x: cx, y: feet, h: hgt, facing: 1, body: THEME.dim, hair: THEME.dim, width: Math.max(1.3, hgt * 0.045) });
      void g;
      ctx.restore();
    }
    paint(spec, cx, feet);
  } else if (cell.kind === 'step') {
    // A named step is held while the dancer travels, so the cell holds the position and
    // moves the dancer: the same reading as the stage, seen small.
    const travel = (w - 34) / 2;
    const x = cx + Math.sin(p * Math.PI * 2) * travel;
    const ahead = Math.cos(p * Math.PI * 2) >= 0 ? 1 : -1;
    paint(specOf(cell.value === 'walk' ? 'none' : cell.value), x, feet, 0);
    // A faint mark of where the step is heading.
    ctx.fillStyle = THEME.grid;
    ctx.beginPath();
    ctx.arc(x + ahead * 7, feet - 1, 1.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // A level is a height, so the whole figure moves: taller for a rise, clear of the deck
    // for a jump. The dashed line is where the plain dancer's head reaches, which is what
    // makes a few centimetres legible at this size.
    const lv = cell.value;
    const rise = lv === 'demi' ? 0.03 : lv === 'pointe' ? 0.06 : 0;
    const lift = lv === 'air' ? 0.35 : 0;
    const t = smooth(0.5 - 0.5 * Math.cos(p * Math.PI * 2));
    const spec = { ...specOf('none'), rise: rise * t };
    const y = feet - lift * t * (hgt / 1.7);
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = THEME.grid;
    ctx.beginPath();
    ctx.moveTo(6, feet - hgt * 0.925 + 0.5);
    ctx.lineTo(w - 6, feet - hgt * 0.925 + 0.5);
    ctx.stroke();
    ctx.restore();
    paint(spec, cx, y);
  }
}

/* ------------------------------------------------------------------- the sheet */

// A phrase is a step and the position it arrives in. It is above the cells because it is the
// thing a sequence is built from: the cells describe one point, a phrase lays down the points
// a step needs — a chassé's gather and arrival, a pas de bourrée's three transfers, a
// pirouette's preparation and its revolution.
const PHRASE_NOTE =
  'A step and the position it arrives in, laid down as the stations that step needs — after the dancer’s last point, or from a count picked on the ruler.';

export class MoveSheet {
  // `pick(kind, value)` and `place(opts)` are the app's business: the sheet only says what
  // was clicked and what was chosen. `plan(opts)` is asked what the row would do right now — the
  // sheet cannot know about holds without the dancer and the show, and a warning about a hold it
  // would cross has to come from the same arithmetic the placement uses.
  constructor(root, pick, place, plan) {
    this.root = root;
    this.pick = pick;
    this.place = place;
    this.plan = plan;
    this.cells = [];
    this.raf = 0;
    this.built = false;
    this.lead = '';
  }

  phraseHTML() {
    const opts = (list, value) =>
      list.map(([v, label]) => `<option value="${v}"${v === value ? ' selected' : ''}>${label}</option>`).join('');
    const step = 'chasse';
    return `<section class="move-group phrase-block">
      <h3>Phrase <span class="move-note">${PHRASE_NOTE}</span></h3>
      <div class="phrase-form">
        <label>step${'<select id="phraseStep">' + opts(STEPS, step) + '</select>'}</label>
        <label>into${'<select id="phrasePose">' + opts(POSES.filter(([v]) => v !== 'none'), 'arabesque') + '</select>'}</label>
        <label>level${'<select id="phraseLevel">' + opts(LEVELS, 'flat') + '</select>'}</label>
        <label>counts<input id="phraseCounts" type="number" min="1" max="32" step="1" value="${phraseShape(step).counts}" title="How many counts of the music the whole phrase takes. Its stations divide them in the proportion the step is counted, and the show's tempo says how long a count is" /></label>
        <label>on the${'<select id="phraseSnap"><option value="1">count</option><option value="bar">bar</option><option value="0">path</option></select>'}</label>
        <button id="btnStationGuide" title="Choose the next station yourself on the stage, with a draft distance guide for this step, position and count duration">Next station…</button>
        <button id="btnPhrasePlace" class="primary">Place phrase</button>
        <button id="btnPhrasePick" title="Take the start from the music instead of from the end of her path: the next double-click on the timeline ruler starts the phrase on that count">On the ruler...</button>
      </div>
      <p class="phrase-where" id="phraseWhere"></p>
    </section>`;
  }

  build() {
    if (this.built) return;
    this.built = true;
    const body = this.root.querySelector('#movesBody');
    const html = this.phraseHTML() + moveGroups()
      .map(
        (g) => `<section class="move-group">
        <h3>${g.title} <span class="move-note">${g.note}</span></h3>
        <div class="move-grid">${g.moves
          .map(
            (m) => `<button class="move" data-kind="${g.kind}" data-value="${m.value}">
          <canvas width="84" height="104" aria-hidden="true"></canvas>
          <span class="move-name">${m.label}</span>
          <span class="move-note">${m.note}</span>
        </button>`
          )
          .join('')}</div>
      </section>`
      )
      .join('');
    body.innerHTML = html;
    const t0 = performance.now();
    this.cells = [...body.querySelectorAll('.move')].map((el, i) => ({
      el,
      canvas: el.querySelector('canvas'),
      kind: el.dataset.kind,
      value: el.dataset.value,
      // Staggered a little, so a grid of dancers is not one person in thirty bodies.
      phase: t0 + (i % 4) * 90,
    }));
    body.addEventListener('click', (e) => {
      const btn = e.target.closest('.move');
      if (btn) this.pick(btn.dataset.kind, btn.dataset.value);
    });

    const stepSel = body.querySelector('#phraseStep');
    const countsIn = body.querySelector('#phraseCounts');
    // A step is counted its own way: a pas de bourrée is three counts where a chassé is two,
    // so the field follows the step until it is typed over.
    stepSel.addEventListener('change', () => {
      countsIn.value = phraseShape(stepSel.value).counts;
      this.paintPhrase();
    });
    countsIn.addEventListener('input', () => this.paintPhrase());
    body.querySelector('#phraseSnap').addEventListener('change', () => this.paintPhrase());
    // What the row says a phrase is, read in one place: the two buttons differ only in where the
    // start comes from — the end of her path, or a count clicked on the music.
    const phraseOpts = () => {
      const snap = body.querySelector('#phraseSnap').value;
      return {
        step: stepSel.value,
        pose: body.querySelector('#phrasePose').value,
        level: body.querySelector('#phraseLevel').value,
        counts: Math.max(1, Number(countsIn.value) || 1),
        snap: snap === 'bar' ? 'bar' : Number(snap),
      };
    };
    body.querySelector('#btnStationGuide').addEventListener('click', () => this.place({ ...phraseOpts(), station: true }));
    body.querySelector('#btnPhrasePlace').addEventListener('click', () => this.place(phraseOpts()));
    body.querySelector('#btnPhrasePick').addEventListener('click', () => this.place({ ...phraseOpts(), pick: true }));
  }

  // What the phrase will land after, written by the app: it is the app that knows which
  // dancer is focused and where her path ends — and when there is nothing to place against,
  // which is a sentence rather than an address.
  // `countMs` is the show's count in milliseconds and `bar` its measure, so the caption can
  // do the arithmetic the choreographer is doing in their head.
  phraseWhere(info) {
    this.lead = (info && info.text) || '';
    this.ready = !!(info && info.ready);
    this.link = !!(info && info.link);
    this.countMs = Number(info && info.countMs) > 0 ? Number(info.countMs) : 500;
    this.bpm = Number(info && info.bpm) > 0 ? Number(info.bpm) : 120;
    this.bar = Number(info && info.bar) > 0 ? Number(info.bar) : 2000;
    this.origin = Number(info && info.origin) || 0;
    this.at = Number.isFinite(Number(info && info.at)) ? Number(info.at) : null;
    this.paintPhrase();
  }

  paintPhrase() {
    const line = this.root.querySelector('#phraseWhere');
    if (!line) return;
    const sel = this.root.querySelector('#phraseStep');
    if (!sel) return;
    const shape = phraseShape(sel.value);
    const travel = shape.travel > 0 ? `${shape.travel.toFixed(1)} m of travel` : 'no travel — it turns on the spot';
    const countsIn = this.root.querySelector('#phraseCounts');
    const counts = Math.max(1, Number(countsIn && countsIn.value) || shape.counts);
    const secs = (counts * (this.countMs || 500)) / 1000;
    // How far the phrase has to move to begin on the count (or the bar): a path that ends off
    // the grid is joined by the leg into the first station, so the sheet says how long that
    // catch-up is before it is placed rather than after.
    const snapSel = this.root.querySelector('#phraseSnap');
    const snap = snapSel ? snapSel.value : '1';
    const step = snap === 'bar' ? this.bar || 0 : snap === '0' ? 0 : this.countMs || 0;
    let shift = 0;
    if (step > 1 && this.at != null) {
      const k = Math.max(0, Math.ceil((this.at - (this.origin || 0)) / step - 1e-6));
      shift = Math.max(0, (this.origin || 0) + k * step - this.at);
    }
    const on = shift >= 1 ? ` · starts ${(shift / 1000).toFixed(2)} s on` : '';
    // A hold between the phrase's stations stops her in the middle of it: the phrase is laid down
    // in two halves with the stop between them, and its arrivals after the stop stay on the counts
    // they were counted to. Worth saying before it is placed, because "split by a hold" and "placed
    // straight through" look the same on paper otherwise.
    const plan = typeof this.plan === 'function'
      ? this.plan({ step: sel.value, counts, snap: snap === 'bar' ? 'bar' : Number(snap) })
      : null;
    // A hold between two of the phrase's stations splits it and keeps the counts; a hold that eats
    // an arrival is a beat it cannot stand on, and the placement will refuse it, so say that.
    const held = plan && plan.swallowed
      ? ` · a hold covers ${plan.swallowed === 1 ? 'a count' : plan.swallowed + ' counts'}`
      : plan && plan.holds
      ? ` · split by ${plan.holds} hold${plan.holds === 1 ? '' : 's'} (+${(plan.stretch / 1000).toFixed(2)} s)`
      : '';
    // Counts that do not divide into the step's transfers evenly leave stations between beats.
    // Said here, where the division is chosen, rather than discovered by hearing it afterwards.
    const per = this.countMs || 500;
    const offs = phraseOffsets(sel.value, counts, per);
    const ragged = offs.filter((v) => Math.abs(v - Math.round(v)) * per > COUNT_EPS);
    const short = (v) => v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    const uneven = ragged.length
      ? ` · ${ragged.length} of ${offs.length} arrivals between counts (${ragged.map(short).join(', ')})`
      : '';
    const text = this.ready
      ? `${this.lead} · ${counts} count${counts === 1 ? '' : 's'} at ${this.bpm || 120} = ${secs.toFixed(2)} s · ${
          shape.count
        } station${shape.count === 1 ? '' : 's'}, ${travel}${uneven}${held}${on}${this.link ? ' · joins it' : ''}`
      : this.lead || 'pick a dancer';
    // Written only when it changes: the caption is refreshed every time the path does.
    if (line.textContent !== text) line.textContent = text;
  }

  open(current) {
    this.build();
    this.root.hidden = false;
    this.current = current || null;
    this.mark();
    this.paintPhrase();
    this.start();
    const close = this.root.querySelector('#btnMovesClose');
    if (close) close.focus();
  }

  close() {
    this.root.hidden = true;
    this.stop();
  }

  get isOpen() {
    return !this.root.hidden;
  }

  // What the station being edited is already doing, so the sheet shows the choice in force.
  mark(current) {
    if (current) this.current = current;
    const c = this.current || {};
    for (const cell of this.cells) {
      const on = cell.kind === 'pose' ? c.pose === cell.value : cell.kind === 'step' ? c.step === cell.value : c.level === cell.value;
      cell.el.classList.toggle('sel', !!on);
    }
  }

  say(text) {
    const line = this.root.querySelector('#movesWhere');
    if (line) line.textContent = text || '';
  }

  start() {
    if (this.raf) return;
    const tick = () => {
      const now = performance.now();
      for (const cell of this.cells) drawCell(cell, now);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    if (!this.raf) return;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
