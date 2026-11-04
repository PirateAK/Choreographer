// Settings-to-solver check: a value entered in the convention table must change the solver output and the
// review result; an unset row must stay unapplied. Engine check only, not school approval of any value.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// In-memory stand-in for the browser's localStorage, installed before conventions.js loads.
const memory = {};
globalThis.localStorage = {
  getItem: (k) => (k in memory ? memory[k] : null),
  setItem: (k, v) => { memory[k] = String(v); },
  removeItem: (k) => { delete memory[k]; },
};

const conv = await import('./src/conventions.js');
const pose = await import('./src/pose.js');
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SPACING = 'fourth.spacing';
const SPACING_TEST = 0.3; // in range (0–1); a test value, not a school value

// 1) Solver output: an entered spacing changes the fourth-position feet; the unset row changes nothing.
const footsOf = (id) => JSON.stringify(pose.feetPlaceOf(pose.specOf(id), 1, 0));
assert.equal(conv.conventionValue(SPACING), null, 'fourth spacing unset by default');
assert.equal(conv.statusOf(SPACING), 'unset');
const unsetFeet = footsOf('fourth');
const unsetSpec = JSON.stringify(pose.specOf('fourth'));
assert.equal(conv.setConvention(SPACING, 1.5).ok, false, 'out-of-range value refused, not clamped');
assert.equal(conv.conventionValue(SPACING), null, 'refused value leaves the table unchanged');
assert.equal(JSON.stringify(pose.specOf('fourth')), unsetSpec, 'unset spacing is unapplied');

assert.equal(conv.setConvention(SPACING, SPACING_TEST).ok, true, 'in-range value accepted');
assert.equal(conv.statusOf(SPACING), 'provisional', 'an entered value is provisional until approved');
const setFeet = footsOf('fourth');
assert.notEqual(setFeet, unsetFeet, 'solver output changes with the table value');
conv.resetConvention(SPACING);
assert.equal(conv.statusOf(SPACING), 'unset', 'reset returns the row to unset');
assert.equal(footsOf('fourth'), unsetFeet, 'reset restores the solver output');

// 2) Review result: a fresh review process with the override preloaded must report a different fourth line.
function reviewWith(values) {
  const preload = `globalThis.localStorage={getItem:()=>${JSON.stringify(JSON.stringify({ values }))},setItem(){},removeItem(){}};`;
  const url = 'data:text/javascript,' + encodeURIComponent(preload);
  const run = spawnSync(process.execPath, ['--import', url, 'review-basic-movements.mjs'], { cwd: ROOT, encoding: 'utf8' });
  const line = run.stdout.split('\n').find((l) => l.startsWith('fourth ') && l.includes('balance'));
  assert.ok(line, 'review prints the fourth-position line');
  return line.replace(/\s+/g, ' ').trim();
}
const reviewUnset = reviewWith({});
const reviewSet = reviewWith({ [SPACING]: SPACING_TEST });
assert.notEqual(reviewSet, reviewUnset, 'review result changes with the table value');

console.log(`solver: fourth feet change with ${SPACING} = ${SPACING_TEST}; unset row leaves spec unchanged`);
console.log(`review unset: ${reviewUnset}`);
console.log(`review set:   ${reviewSet}`);
console.log('settings-to-solver: ok');
