import assert from 'node:assert/strict';
import { createShow, addCast, dancerHeight, evaluateMovement, DANCER_HEIGHT_MIN, DANCER_HEIGHT_MAX } from './src/model.js';

// A blank dancer height is the show's height, so existing shows measure exactly as before.
const show = createShow();
const d = addCast(show);
assert.equal(dancerHeight(show, d), show.stage.dancerH, 'blank height uses the show default');
assert.equal(dancerHeight(show), show.stage.dancerH, 'show-only call keeps the old behaviour');

// A dancer's own height wins over the show, and is clamped to the drawn range.
d.heightM = 1.52;
assert.equal(dancerHeight(show, d), 1.52, 'own height overrides the show');
d.heightM = 0.2;
assert.equal(dancerHeight(show, d), DANCER_HEIGHT_MIN, 'too small clamps up');
d.heightM = 9;
assert.equal(dancerHeight(show, d), DANCER_HEIGHT_MAX, 'too large clamps down');
d.heightM = 'tall';
assert.equal(dancerHeight(show, d), show.stage.dancerH, 'a non-number falls back to the show');

// Explicitly typing the show default gives the same movement as leaving it blank.
const other = addCast(show);
other.keys = [{ t: 0, x: 1, y: 2, pose: 'arabesque', level: 'pointe' }, { t: 2000, x: 2, y: 2, pose: 'first', level: 'flat' }];
const blank = JSON.stringify(evaluateMovement(show, other, 1000));
other.heightM = show.stage.dancerH;
assert.equal(JSON.stringify(evaluateMovement(show, other, 1000)), blank, 'explicit default height matches blank');

// A shorter dancer's body is smaller under the same pose, so the drawn figure scales with height.
const tall = addCast(show);
const short = addCast(show);
tall.keys = [{ t: 0, x: 1, y: 2, pose: 'first', level: 'flat' }];
short.keys = [{ t: 0, x: 1, y: 2, pose: 'first', level: 'flat' }];
tall.heightM = 1.9;
short.heightM = 1.4;
assert.equal(dancerHeight(show, tall) > dancerHeight(show, short), true, 'taller dancer reads taller');

console.log('dancer height tests passed');
