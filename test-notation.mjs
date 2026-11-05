// Paper plan: phrase runs and the lines the generator writes for them. Pure model checks, no browser.
import assert from 'node:assert/strict';
import { createShow, phraseRuns, addPhrase, POSE_LABEL, STEP_LABEL, LEVEL_LABEL } from './src/model.js';
import { notationFor, pointWords, clockOf, SECTION_BARS } from './src/notation.js';

// Phrase runs start at the first station after the begin point and end at phraseEnd (or the last key).
{
  const d = { keys: [
    { t: 0 }, { t: 1000 }, { t: 2000, phraseEnd: true }, { t: 3000 }, { t: 4000 },
  ] };
  assert.deepEqual(phraseRuns(d), [{ start: 1, end: 2 }, { start: 3, end: 4 }]);
  assert.deepEqual(phraseRuns({ keys: [{ t: 0 }] }), []);
  assert.deepEqual(phraseRuns({ keys: [] }), []);
}

// Words: pose then step, level only when off flat, plain walk when nothing is named.
{
  assert.equal(pointWords({ pose: 'none', step: 'walk', level: 'flat' }), 'walk');
  assert.equal(pointWords({ pose: 'arabesque', step: 'walk', level: 'flat' }), POSE_LABEL.arabesque);
  assert.equal(pointWords({ pose: 'none', step: 'chasse', level: 'demi' }), `${STEP_LABEL.chasse} (${LEVEL_LABEL.demi})`);
}

// Clock reads like the ruler: m:ss.s.
assert.equal(clockOf(0), '00:00.0');
assert.equal(clockOf(65500), '01:05.5');

// A run with a named step and a port de bras: the arms go in parentheses, the counts read from the
// departure count to the last arrival, and the notes come from the phrase's first station.
{
  const show = createShow();
  show.prefs.tempo = 120; // 500 ms per count
  show.prefs.beatsPerBar = 4;
  show.prefs.downbeat = 0;
  const d = { id: 'd1', name: 'Dancer A', keys: [
    { t: 0, x: 0, y: 0, dur: 0, step: 'walk', pose: 'none', level: 'flat' },
    // Phrase one: leaves count 1, arrives on counts 3 and 5.
    { t: 1000, x: 1, y: 0, dur: 1000, step: 'chasse', pose: 'none', level: 'flat', port: 'arms 2nd', notes: 'head to R' },
    { t: 2000, x: 2, y: 0, dur: 1000, step: 'walk', pose: 'none', level: 'flat', phraseEnd: true },
    // Phrase two: leaves count 5, arrives on count 9.
    { t: 4000, x: 2, y: 2, dur: 1000, step: 'walk', pose: 'none', level: 'flat' },
  ] };
  show.cast.push(d);
  const plan = notationFor(show, d);
  assert.equal(plan.name, 'Dancer A');
  assert.equal(plan.timeSignature, '4/4 · 120 bpm');
  assert.match(plan.begin, /x 0\.0 m, y 0\.0 m$/);
  // Sixteen counts per section: both phrases fall in 1–16.
  assert.equal(plan.sections.length, 1);
  assert.equal(plan.sections[0].counts, '1–16');
  assert.equal(plan.sections[0].at, 0);
  const [one, two] = plan.sections[0].lines;
  assert.equal(one.counts, '1–5');
  assert.match(one.text, / — \(arms 2nd\)$/);
  assert.equal(one.notes, 'head to R');
  assert.equal(two.counts, '5–9');
  assert.equal(two.text.includes('—'), false);
  assert.equal(two.notes, '');
  assert.equal(SECTION_BARS, 4);
}

// Arms with walking phrases are written without parentheses.
{
  const show = createShow();
  show.prefs.tempo = 120; show.prefs.beatsPerBar = 4; show.prefs.downbeat = 0;
  const d = { id: 'd2', name: 'Dancer B', keys: [
    { t: 0, x: 0, y: 0, dur: 0, step: 'walk', pose: 'none', level: 'flat' },
    { t: 1000, x: 1, y: 0, dur: 1000, step: 'walk', pose: 'none', level: 'flat', port: 'arms 1st', phraseEnd: true },
  ] };
  show.cast.push(d);
  const [line] = notationFor(show, d).sections[0].lines;
  assert.match(line.text, / — arms 1st$/);
}

// Arriving in a foot position alone does not move the legs, so the arms are not in parentheses;
// an arabesque does, so they are.
{
  const show = createShow();
  show.prefs.tempo = 120; show.prefs.beatsPerBar = 4; show.prefs.downbeat = 0;
  const d = { id: 'd3', name: 'Dancer C', keys: [
    { t: 0, x: 0, y: 0, dur: 0, step: 'walk', pose: 'none', level: 'flat' },
    { t: 1000, x: 1, y: 0, dur: 1000, step: 'walk', pose: 'fifth', level: 'flat', port: 'arms bras bas', phraseEnd: true },
    { t: 2000, x: 2, y: 0, dur: 1000, step: 'walk', pose: 'arabesque', level: 'flat', port: 'arms 2nd', phraseEnd: true },
  ] };
  show.cast.push(d);
  const [a, b] = notationFor(show, d).sections[0].lines;
  assert.equal(a.text.includes('('), false);
  assert.match(b.text, / — \(arms 2nd\)$/);
}

// addPhrase writes the port and the notes onto the phrase's first station, which is where the
// paper plan and the inspector read them.
{
  const show = createShow();
  show.prefs.tempo = 120; show.prefs.beatsPerBar = 4; show.prefs.downbeat = 0;
  const d = { id: 'd4', name: 'Dancer D', keys: [
    { t: 0, x: 0, y: 0, dur: 0, step: 'walk', pose: 'none', level: 'flat' },
  ] };
  show.cast.push(d);
  const res = addPhrase(show, d, { step: 'chasse', pose: 'arabesque', level: 'flat', counts: 2, snap: 0, port: ' arms 2nd ', notes: 'head R' });
  assert.ok(res.added.length >= 1);
  assert.equal(d.keys[1].port, 'arms 2nd');
  assert.equal(d.keys[1].notes, 'head R');
  assert.equal(d.keys[d.keys.length - 1].phraseEnd, true);
  if (res.added.length > 1) assert.equal(d.keys[d.keys.length - 1].port, undefined);
  assert.deepEqual(phraseRuns(d), [{ start: 1, end: d.keys.length - 1 }]);
}

console.log('test-notation: ok');
