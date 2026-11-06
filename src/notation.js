// The paper plan: a dancer's phrases written the way a teacher writes them down. Counts sit on
// the left, the choreography a few spaces over, port de bras in parentheses only when the legs
// are also moving, sub-counts in [brackets], miscellaneous notes in {braces} under the line, and
// the piece set out in sections of sixteen counts with a timestamp at each. Pure text generation
// from the show; no DOM access in the generator, so the same lines can be checked in node.
import { countGrid, phraseRuns, contentOfLocal, STEP_LABEL, POSE_LABEL, LEVEL_LABEL } from './model.js';

// Counts per printed section: four bars, which is sixteen in common time.
export const SECTION_BARS = 4;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// m:ss.s on the show clock, the same reading the ruler prints.
export function clockOf(ms) {
  const t = Math.max(0, Number(ms) || 0) / 1000;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

// The beat (0-based, counted from the grid origin) a moment falls nearest. Stations are placed on
// counts, so rounding reads the count they were put on.
export function beatOf(show, ms) {
  const g = countGrid(show);
  return Math.max(0, Math.round((Number(ms) - g.origin) / g.count));
}

// What a point is doing, in the words a teacher would use: the position, then the step that
// travels into it, then any level off flat.
export function pointWords(k) {
  const pose = k && k.pose && k.pose !== 'none' ? POSE_LABEL[k.pose] || k.pose : '';
  const step = k && k.step && k.step !== 'walk' ? STEP_LABEL[k.step] || k.step : '';
  const level = k && k.level && k.level !== 'flat' ? LEVEL_LABEL[k.level] || k.level : '';
  const core = [pose, step].filter(Boolean).join(', ') || 'walk';
  return level ? `${core} (${level})` : core;
}

// Whether a run of stations moves the legs: a named step, or a described leg action (tendu, plié,
// relevé, pirouette, pas de bourrée, chassé). A position name is a static state the legs arrive
// in and holds, so arriving in 1st–5th, arabesque or attitude alone does not put the arms in
// parentheses. Walking phrases carry their port de bras without them.
const POSITION_STATES = new Set(['first', 'second', 'third', 'fourth', 'fifth', 'arabesque', 'attitude']);
function legsMove(stations) {
  return stations.some((k) =>
    (k.step && k.step !== 'walk') || (k.pose && k.pose !== 'none' && !POSITION_STATES.has(k.pose)));
}

// The lines of one dancer's paper plan: each phrase as a line with its counts, its words, its
// port de bras and its notes, grouped into sections of sixteen counts.
export function notationFor(show, dancer) {
  const g = countGrid(show);
  const keys = (dancer && dancer.keys) || [];
  const sectionLen = g.perBar * SECTION_BARS;
  const beatAt = (k) => beatOf(show, contentOfLocal(show, dancer.id, k.t));
  const lines = [];
  // Counts restart at 1 in every section of sixteen. `rel` is a count's place in its own section.
  const rel = (c) => ((c - 1) % sectionLen) + 1;
  for (const run of phraseRuns(dancer)) {
    const stations = keys.slice(run.start, run.end + 1);
    const departure = keys[run.start - 1];
    // Counts run from the count she leaves on to the count she lands on, so the line shows the
    // whole phrase, not just its arrivals.
    const from = beatAt(departure) + 1;
    const moving = legsMove(stations);
    const multi = stations.length > 1;
    // A phrase that crosses a section line is written as one line per section, each restarting at 1.
    // Each line is filed by the section its arrivals fall in. Port and notes go on the first line.
    const parts = [];
    for (const k of stations) {
      const c = beatAt(k) + 1;
      const idx = Math.floor((c - 1) / sectionLen);
      let part = parts[parts.length - 1];
      if (!part || part.idx !== idx) {
        part = { idx, stations: [] };
        parts.push(part);
      }
      part.stations.push({ k, c });
    }
    parts.forEach((part, pi) => {
      const first = part.stations[0].c;
      const last = part.stations[part.stations.length - 1].c;
      // The first line starts at the departure count when it is in the same section; otherwise at
      // the section's own count 1.
      const startC = pi === 0 ? Math.max(from, part.idx * sectionLen + 1) : part.idx * sectionLen + 1;
      const words = part.stations.map(({ k, c }) => {
        const n = rel(c);
        return multi ? `${pointWords(k)} [${n}]` : pointWords(k);
      }).join(', ');
      const counts = startC === last ? String(rel(startC)) : `${rel(startC)}–${rel(last)}`;
      const port = pi === 0 ? (stations[0].port || '') : '';
      const portText = port ? (moving ? `(${port})` : port) : '';
      lines.push({
        from: startC,
        counts,
        text: portText ? `${words} — ${portText}` : words,
        notes: pi === 0 ? (stations[0].notes || '') : '',
      });
    });
  }
  // Sections are numbered from the origin, sixteen counts each. A line sits in the section its
  // first count falls in.
  const sections = [];
  for (const line of lines) {
    const index = Math.floor((line.from - 1) / sectionLen);
    let sec = sections.find((s) => s.index === index);
    if (!sec) {
      const startBeat = index * sectionLen;
      sec = {
        index,
        counts: `1–${sectionLen}`,
        at: g.origin + startBeat * g.count,
        lines: [],
      };
      sections.push(sec);
    }
    sec.lines.push(line);
  }
  sections.sort((a, b) => a.index - b.index);
  const begin = keys[0];
  return {
    name: dancer.name,
    timeSignature: `${g.perBar}/4 · ${g.tempo} bpm`,
    begin: begin ? `${pointWords(begin)}, x ${Number(begin.x).toFixed(1)} m, y ${Number(begin.y).toFixed(1)} m` : 'not placed yet',
    sections,
  };
}

// The paper plan for a whole show: one part per dancer with a path, props left out.
export function notationHTML(show) {
  const dancers = (show.cast || []).filter((d) => d.kind !== 'prop' && (d.keys || []).length > 0);
  if (!dancers.length) return '<p class="note">No dancer has a path yet, so there is nothing to write down.</p>';
  return dancers.map((d) => {
    const plan = notationFor(show, d);
    const secs = plan.sections.map((s) => {
      const rows = s.lines.map((l) =>
        `<div class="nline"><span class="nc">${esc(l.counts)}</span><span class="nd">${esc(l.text)}</span></div>` +
        (l.notes ? `<div class="nn">{${esc(l.notes)}}</div>` : '')
      ).join('');
      return `<div class="nsec"><div class="nsech"><span>${esc(s.counts)}</span><span>${esc(clockOf(s.at))}</span></div>${rows}</div>`;
    }).join('');
    return `<div class="nplan"><h2>${esc(plan.name)}</h2>` +
      `<p class="nmeta">${esc(plan.timeSignature)} · Begin: ${esc(plan.begin)}</p>` +
      (secs || '<p class="note">No phrases yet.</p>') + '</div>';
  }).join('');
}
