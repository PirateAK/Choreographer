import assert from 'node:assert/strict';
import { createShow, addCast, addStation, setEnd, timelineScrollRange, totalActLength } from './src/model.js';

const show = createShow();
const acts = totalActLength(show) / 1000;

// An empty show still leaves room past the running order.
let r = timelineScrollRange(show, 20);
assert.equal(r.endSec, acts);
assert(r.max >= acts + 30 - 20 - 1e-9, 'room beyond the last act');

// Stations long after the acts end are reachable, with room to keep building.
const d = addCast(show, 'dancer');
d.keys.length = 0;
addStation(d, 0, 2);
addStation(d, 1, 2, { dur: (acts + 200) * 1000 });
r = timelineScrollRange(show, 20);
assert(Math.abs(r.endSec - (acts + 200)) < 0.01, 'end follows the furthest station');
assert(r.max >= r.endSec + 30 - 20 - 1e-9);

// An end marker before the work must not hide the later stations from the slider.
setEnd(show, 5000);
r = timelineScrollRange(show, 20);
assert(r.endSec >= acts + 200 - 0.01, 'end marker does not shorten the scroll range');

// Music past everything else extends the range.
show.musicTracks = [{ id: 'm', start: 0, length: (acts + 500) * 1000 }];
r = timelineScrollRange(show, 20);
assert(Math.abs(r.endSec - (acts + 500)) < 0.01);

// A wider window scrolls less; the room grows with it; a view already scrolled further is kept.
const narrow = timelineScrollRange(show, 10).max;
const wide = timelineScrollRange(show, 100).max;
assert(wide < narrow);
assert.equal(timelineScrollRange(show, 10, 99999).max, 99999);
// Bad inputs do not produce NaN.
for (const v of [NaN, -5, 0, undefined]) assert(Number.isFinite(timelineScrollRange(show, v, v).max));

console.log('timeline scroll range: ok');
