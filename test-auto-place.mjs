import assert from 'node:assert/strict';
import { createShow, addCast, normalise, nextBeatContent, autoPlaceKey, autoPlaceEnabled } from './src/model.js';

// A 120 BPM track: beats every 500 ms from the start of the show.
const beats = Array.from({ length: 40 }, (_, i) => i * 500);
function beatShow(markers = beats) {
  const show = createShow();
  show.musicTracks = [{ id: 'm1', name: 'Track', start: 0, length: 60000, beatMarkers: markers, beatOne: 0 }];
  return show;
}
function dancerAt(show, keys) {
  const d = addCast(show);
  d.keys = keys.map((k) => ({ ...k }));
  return d;
}

// Beat lookup: strictly after the given time, across tracks, or null with no beats.
{
  const show = beatShow();
  assert.equal(nextBeatContent(show, 0), 500, 'a beat exactly at the time is not "next"');
  assert.equal(nextBeatContent(show, 499), 500);
  assert.equal(nextBeatContent(show, 500), 1000);
  show.musicTracks[0].start = 2000;
  assert.equal(nextBeatContent(show, 0), 2000, 'track start offsets its markers');
  assert.equal(nextBeatContent(createShow(), 0), null, 'no music, no beat');
}

// Beat placement: the new station lands on the next beat after the last one.
{
  const show = beatShow();
  const d = dancerAt(show, [{ t: 0, x: 0, y: 5 }]);
  const r = autoPlaceKey(show, d);
  assert.equal(r.t, 500, 'next beat after the last station');
  assert.equal(r.durMs, 500);
  assert.equal(r.dur, 500);
}

// Stride: a comfortable walk from the last station, downstage with no travel yet.
{
  const show = beatShow();
  const d = dancerAt(show, [{ t: 0, x: 0, y: 5 }]);
  const r = autoPlaceKey(show, d);
  const stride = 5 - r.y;
  assert(stride > 0.1 && stride < 0.4, `walk stride for a 500 ms count is inside the draft band, got ${stride}`);
  assert.equal(r.x, 0, 'downstage with no travel leaves the line');
}

// Height: a taller dancer takes a longer comfortable stride over the same count.
{
  const show = beatShow();
  const short = dancerAt(show, [{ t: 0, x: 0, y: 5 }]);
  const tall = dancerAt(show, [{ t: 0, x: 0, y: 5 }]);
  short.heightM = 1.4;
  tall.heightM = 1.9;
  const strideShort = 5 - autoPlaceKey(show, short).y;
  const strideTall = 5 - autoPlaceKey(show, tall).y;
  assert(strideTall > strideShort, `taller dancer strides further (${strideTall} vs ${strideShort})`);
}

// Direction: a dancer already moving keeps going the way she was travelling.
{
  const show = beatShow();
  const d = dancerAt(show, [{ t: 0, x: 0, y: 6 }, { t: 500, x: 1, y: 5.5 }]);
  const r = autoPlaceKey(show, d);
  assert.equal(r.t, 1000);
  assert(r.x > 1, 'continues to the right of travel');
  assert(r.y < 5.5, 'continues downstage of travel');
}

// Edge: a stride that would leave the stage is held at the downstage edge.
{
  const show = beatShow();
  const d = dancerAt(show, [{ t: 0, x: 0, y: 0.5 }]);
  const r = autoPlaceKey(show, d, { durMs: 1500 });
  assert.equal(r.y, 0.35, 'held at the stage edge, not past it');
}

// Explicit duration: a click with a draft guide uses its own count, not the beat.
{
  const show = beatShow();
  const d = dancerAt(show, [{ t: 0, x: 0, y: 5 }]);
  const r = autoPlaceKey(show, d, { durMs: 1000 });
  assert.equal(r.t, 1000, 'explicit duration wins over the beat');
  assert.equal(r.durMs, 1000);
}

// No beats and no duration: nothing to place on, so the caller keeps its own timing.
{
  const show = beatShow([]);
  const d = dancerAt(show, [{ t: 0, x: 0, y: 5 }]);
  assert.equal(autoPlaceKey(show, d), null);
}

// No station to start from: nothing to place from.
{
  const show = beatShow();
  const d = dancerAt(show, []);
  assert.equal(autoPlaceKey(show, d), null);
}

// Toggle: on by default for new and old shows, off only when the choreographer turns it off.
{
  const show = normalise(createShow());
  assert.equal(show.prefs.autoPlace, true, 'auto-place is on by default');
  assert.equal(autoPlaceEnabled(show), true);
  show.prefs.autoPlace = false;
  assert.equal(autoPlaceEnabled(show), false);
  assert.equal(normalise(show).prefs.autoPlace, false, 'the choice survives normalise');
}

console.log('auto-place tests passed');
