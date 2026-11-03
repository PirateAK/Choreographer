import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Import as a data URL so Node treats the dependency-free browser module as ESM without package.json.
const source = await readFile(new URL('./src/placement-guide.js', import.meta.url), 'utf8');
const { placementRange, DRAFT_TRAVEL_RANGES } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);

const expectedSteps = ['walk', 'chasse', 'glissade', 'pas-de-bourree', 'pirouette', 'releve'];
assert.deepEqual(Object.keys(DRAFT_TRAVEL_RANGES), expectedSteps);
assert(Object.isFrozen(DRAFT_TRAVEL_RANGES));
for (const [step, range] of Object.entries(DRAFT_TRAVEL_RANGES)) {
  assert(range.comfortableMin >= 0, `${step} minimum is nonnegative`);
  assert(range.comfortableMin <= range.comfortableMax, `${step} comfortable band is ordered`);
  assert(range.comfortableMax <= range.stretchMax, `${step} stretch band follows comfortable band`);
}

for (const step of expectedSteps.slice(0, 5)) {
  const range = placementRange({ step });
  const reference = DRAFT_TRAVEL_RANGES[step];
  assert.equal(range.comfortableMin, reference.comfortableMin);
  assert.equal(range.comfortableMax, reference.comfortableMax);
  assert.equal(range.stretchMax, reference.stretchMax);
  assert.equal(range.label, reference.label);
  assert.equal(range.draft, true);
}
assert.equal(placementRange({ step: 'unsupported' }), null);
assert.equal(placementRange({ step: 'releve' }), null);

const ordinary = placementRange({ step: 'walk' });
const short = placementRange({ step: 'walk', durationMs: 750 });
const tall = placementRange({ step: 'walk', height: 3.4 });
assert.equal(short.comfortableMax, ordinary.comfortableMax / 2);
assert.equal(tall.stretchMax, ordinary.stretchMax * 2);
assert.equal(placementRange({ step: 'walk', durationMs: 9000 }).stretchMax, ordinary.stretchMax);

for (const [step, pose] of [['pirouette', 'none'], ['walk', 'pirouette'], ['walk', 'releve']]) {
  const normal = placementRange({ step, pose, durationMs: 1000 });
  const extended = placementRange({ step, pose, durationMs: 9000 });
  assert.deepEqual(extended, normal, `${step}/${pose} in-place range must not grow with time`);
  assert.equal(normal.comfortableMax, DRAFT_TRAVEL_RANGES[pose === 'releve' ? 'releve' : 'pirouette'].comfortableMax);
}

assert.deepEqual(placementRange({ step: 'walk', height: 0, durationMs: NaN }), ordinary);
assert.deepEqual(placementRange({ step: 'walk', height: Infinity, durationMs: -1 }), ordinary);
assert.deepEqual(placementRange({ step: 'walk', height: 'invalid', durationMs: 'invalid' }), ordinary);
const input = { step: 'chasse', pose: 'none', height: 1.8, durationMs: 1200 };
const before = structuredClone(input);
placementRange(input);
assert.deepEqual(input, before, 'helper must not mutate caller options');
assert.deepEqual(DRAFT_TRAVEL_RANGES.walk, { comfortableMin: 0.25, comfortableMax: 1.2, stretchMax: 1.8, label: 'Walk' });

console.log('placement guide: ok');
