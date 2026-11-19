// Cast groups: organisational entries kept apart from show.cast (dancers).
import assert from 'node:assert/strict';
import { createShow, normalise, addCastGroup, removeCastGroup } from './src/model.js';

// createShow starts with an empty group list and an empty dancer cast.
const fresh = createShow();
assert.deepEqual(fresh.castGroups, []);
assert.ok(Array.isArray(fresh.cast));

// Old shows saved before groups existed normalise without error.
const legacy = createShow();
delete legacy.castGroups;
const legacyOut = normalise(legacy);
assert.deepEqual(legacyOut.castGroups, []);

// Malformed group records are sanitised: bad type falls back, missing name defaults.
const messy = createShow();
messy.castGroups = [
  { id: 'g1', name: 'Audience', type: 'audience', role: '' },
  { id: 'g1', name: '', type: 'bogus', role: 'Lighting crew' },
  null,
  'nonsense',
];
const cleaned = normalise(messy);
assert.equal(cleaned.castGroups.length, 2, 'null and string entries are dropped');
assert.notEqual(cleaned.castGroups[0].id, cleaned.castGroups[1].id, 'duplicate ids are made unique');
assert.equal(cleaned.castGroups[1].name, 'Group');
assert.equal(cleaned.castGroups[1].type, 'other');
assert.equal(cleaned.castGroups[1].role, 'Lighting crew');

// Groups never leak into the dancer cast that movement and render code walk.
assert.equal(cleaned.cast.length, 0);

// add / remove.
const show = createShow();
const added = addCastGroup(show, 'Audience', 'audience', 'Clapping at curtain');
assert.equal(show.castGroups.length, 1);
assert.equal(show.castGroups[0].name, 'Audience');
assert.equal(show.castGroups[0].type, 'audience');
assert.equal(show.castGroups[0].role, 'Clapping at curtain');
assert.ok(added && added.id, 'addCastGroup returns the new group');
assert.equal(show.cast.length, 0, 'adding a group does not add a dancer');

assert.equal(removeCastGroup(show, 'missing-id'), false);
assert.equal(show.castGroups.length, 1);
assert.equal(removeCastGroup(show, added.id), true);
assert.equal(show.castGroups.length, 0);

console.log('test-cast-groups: ok');
