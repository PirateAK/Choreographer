import assert from 'node:assert/strict';
import {
  ROUTINE_DRAFT_KEY, createRoutineDraft, normalizeRoutineDraft,
  sampleRoutineRoute, sampleRoutineStations, loadRoutineDraft, saveRoutineDraft, clearRoutineDraft,
} from './src/routine-draft.js';

const route = [{ x: -2, y: 1 }, { x: 0, y: 3 }, { x: 4, y: 1 }];
assert.deepEqual(sampleRoutineRoute(route, 0), route[0]);
assert.deepEqual(sampleRoutineRoute(route, 1), route[2]);
assert.ok(Math.abs(sampleRoutineRoute([{ x: 0, y: 0 }, { x: 8, y: 4 }], 0.5).x - 4) < 1e-9);
assert.ok(Math.abs(sampleRoutineRoute([{ x: 0, y: 0 }, { x: 8, y: 4 }], 0.5).y - 2) < 1e-9);
assert.equal(sampleRoutineRoute([], 0.5), null);
assert.deepEqual(sampleRoutineRoute(route, -1), route[0]);

const stations = sampleRoutineStations(route, { origin: 125, beatMs: 600, startCount: 2, beats: 3, subdivision: 2 });
assert.equal(stations.length, 7);
assert.equal(stations[0].contentMs, 1325);
assert.equal(stations.at(-1).contentMs, 3125);
assert.equal(stations[0].count, 2);
assert.equal(stations.at(-1).count, 5);
assert.deepEqual({ x: stations[0].x, y: stations[0].y }, route[0]);
assert.deepEqual({ x: stations.at(-1).x, y: stations.at(-1).y }, route[2]);
assert.deepEqual(stations, sampleRoutineStations(route, { origin: 125, beatMs: 600, startCount: 2, beats: 3, subdivision: 2 }));
assert.deepEqual(sampleRoutineStations(route, { beats: 0 }), []);
assert.deepEqual(sampleRoutineStations([], {}), []);

const draft = createRoutineDraft({ name: 'Rehearsal', dancerId: 'dancer-1', obstacles: [{ id: 'obs-1', kind: 'prop', x: 1, y: 2, w: 2, d: 1 }] });
draft.route = route;
draft.stations = stations;
draft.stations[2].keyframe = { pose: 'arabesque', level: 'flat', bend: 0.2 };
const normalized = normalizeRoutineDraft(draft);
assert.equal(normalized.version, 1);
assert.equal(normalized.dancerId, 'dancer-1');
assert.deepEqual(normalized.route, route.map((p, i) => ({ ...p, u: i / 2 })));
assert.equal(normalized.stations[2].keyframe.pose, 'arabesque');
assert.equal(normalized.obstacles.length, 1);
assert.equal(normalizeRoutineDraft({ version: 99, route: [{ x: 'no', y: 1 }], obstacles: [{ kind: 'unknown' }] }).route.length, 0);
assert.equal(normalizeRoutineDraft({ route: [{ x: 1000, y: -1000 }] }).route[0].x, 100);
assert.equal(normalizeRoutineDraft({ route: [{ x: 1000, y: -1000 }] }).route[0].y, -100);

const memory = new Map();
const storage = {
  getItem(key) { return memory.get(key) ?? null; },
  setItem(key, value) { memory.set(key, value); },
  removeItem(key) { memory.delete(key); },
};
assert.equal(saveRoutineDraft(draft, storage), true);
assert.equal(memory.has(ROUTINE_DRAFT_KEY), true);
const loaded = loadRoutineDraft(storage);
assert.deepEqual(loaded, normalized);
assert.equal(clearRoutineDraft(storage), true);
assert.equal(loadRoutineDraft(storage), null);
memory.set(ROUTINE_DRAFT_KEY, '{broken');
assert.equal(loadRoutineDraft(storage), null);
assert.equal(saveRoutineDraft(draft, null), false);

console.log('routine draft model: ok');
