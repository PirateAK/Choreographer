// A placed phrase should be dancable as it lands. This checks the foot each station of a phrase
// stands on: that a walk alternates, that a chassé and a pas de bourrée land their last transfer on
// the other foot from the one she started on, that a turn keeps the foot the fourth prepared her
// onto, that a foot typed on a station carries into the next phrase, and that none of it raises a
// plant, skate or reach fault that a hand-set plant would not.
import {
  createShow, addPhrase, plantsOf, plantProblem, footSkate, legOverreach,
} from './src/model.js';

const show = createShow();
show.cast.length = 0;

const dancer = (name, keys) => {
  const d = { id: 'd-' + name, name, number: show.cast.length + 1, color: '#fff', visible: true, keys };
  show.cast.push(d);
  return d;
};

const feet = (d) => plantsOf(d).map((p) => p.name);
const show_ = (label, d) => console.log(label, feet(d).join(' '));

// 1. Three walks in a row: every arrival alternates from the one before it.
{
  const d = dancer('W', [{ t: 0, x: 0, y: 2, pose: 'none' }]);
  for (let i = 0; i < 3; i++) addPhrase(show, d, { step: 'walk', pose: 'none', dist: 1 });
  show_('walks      ', d);
}

// 2. Two chassés: the gather is on both feet, the arrival is the other foot from the last arrival.
{
  const d = dancer('C', [{ t: 0, x: -4, y: 2, pose: 'none' }]);
  addPhrase(show, d, { step: 'chasse', pose: 'none' });
  addPhrase(show, d, { step: 'chasse', pose: 'none' });
  show_('chasses    ', d);
}

// 3. Two pas de bourrées: both, both, then the third transfer lands the other foot.
{
  const d = dancer('P', [{ t: 0, x: -4, y: 4, pose: 'none' }]);
  addPhrase(show, d, { step: 'pas-de-bourree', pose: 'none' });
  addPhrase(show, d, { step: 'pas-de-bourree', pose: 'none' });
  show_('bourrees   ', d);
}

// 4. A pirouette: the fourth is on both feet, the turn keeps the foot she arrived on. Two walks
// first, so she arrives on the left — the foot the derived table would not have chosen. Landing in
// the two-foot preparation may deliberately re-place both feet; it is not single-foot skate.
{
  const d = dancer('T', [{ t: 0, x: 0, y: 3, pose: 'none' }]);
  addPhrase(show, d, { step: 'walk', pose: 'none', dist: 0.6 });
  addPhrase(show, d, { step: 'walk', pose: 'none', dist: 0.6 });
  const before = feet(d).slice(-1)[0];
  addPhrase(show, d, { step: 'pirouette', pose: 'none' });
  const after = feet(d).slice(-1)[0];
  console.log('pirouette  ', feet(d).join(' '), `| arrived on ${before}, turned on ${after}:`, after === before);
  if (footSkate(show, d, d.keys.length - 2) !== null) throw new Error('two-foot fourth preparation was incorrectly reported as single-foot skate');
}

// 5. A foot typed by hand carries into the next phrase.
{
  const d = dancer('H', [{ t: 0, x: 2, y: 2, pose: 'none' }, { t: 2000, x: 2, y: 2, pose: 'none' }]);
  d.keys[1].plant = 'left';
  addPhrase(show, d, { step: 'walk', pose: 'none', dist: 1 });
  console.log('typed left ', feet(d).join(' '), '| next step went the other way:', feet(d).slice(-1)[0] === 'right');
}

// 6. A position that names its own foot is not overruled by the step.
{
  const d = dancer('A', [{ t: 0, x: -2, y: 3, pose: 'none' }]);
  addPhrase(show, d, { step: 'walk', pose: 'arabesque', dist: 1 });
  addPhrase(show, d, { step: 'walk', pose: 'arabesque', dist: 1 });
  console.log('arabesque  ', feet(d).join(' '), '| both arrivals on the arabesque leg:', feet(d).slice(-1)[0] === 'left');
}

// 7. A genuine one-foot stance drift still counts: the exemption is only for arriving on both.
{
  const d = dancer('S', [
    { t: 0, x: 4, y: 3, pose: 'first', plant: 'left' },
    { t: 1000, x: 4, y: 3, pose: 'fourth', plant: 'left' },
  ]);
  const skate = footSkate(show, d, 1);
  console.log('single-foot drift:', skate ? `${skate.side} ${skate.away.toFixed(3)} m` : 'not detected');
  if (!skate || skate.away < 0.3) throw new Error('single-foot stance drift must remain detectable');
}

// 8. Report phrase-placement faults independently from the deliberately faulty hand-set stance in
// example 7; keep the example visible without letting it contaminate this summary.
{
  let faults = 0;
  for (const d of show.cast) {
    if (d.id === 'd-S') continue;
    const keys = d.keys || [];
    for (let i = 1; i < keys.length; i++) {
      for (const [kind, fn] of [['plant', plantProblem], ['skate', footSkate], ['reach', legOverreach]]) {
        const f = fn(show, d, i);
        if (!f) continue;
        faults += 1;
        console.log(`  fault: ${kind} ${d.name} station ${i} (${keys[i].pose}/${plantsOf(d)[i].name} plant ${keys[i].plant || 'derived'})`, JSON.stringify(f).slice(0, 140));
      }
    }
  }
  console.log('faults on the phrases (excluding deliberate example 7):', faults);
  if (faults) throw new Error(`${faults} unexpected phrase placement fault(s)`);
}
