// Cloth width: a piece may be wider than the stage by 1/0.88 so it still reaches the
// frame at its shallowest depth in the house view. Checks the limit, the across clamp,
// and that a full-width piece covers the opening at every depth.
import assert from 'node:assert/strict';
import { normalise, maxClothSpan, CLOTH_FRONT_SCALE } from './src/model.js';

const stage = { width: 12, depth: 8 };
const max = maxClothSpan(stage);
assert.ok(Math.abs(max - 12 / 0.88) < 1e-9, 'max span is stage width over the front scale');

// A curtain asked for wider than allowed is stopped at the limit.
const wide = normalise({ stage: { width: 12, depth: 8 }, scenery: [{ kind: 'curtain', span: 40, x: 3 }] });
assert.ok(Math.abs(wide.scenery[0].span - max) < 1e-9, 'span is capped at the limit');
assert.equal(wide.scenery[0].x, 0, 'a piece as wide as the limit cannot move across');

// A narrower piece can still be placed, and its across is limited to its free width.
const narrow = normalise({ stage: { width: 12, depth: 8 }, scenery: [{ kind: 'curtain', span: 6, x: 3 }] });
assert.equal(narrow.scenery[0].span, 6);
assert.equal(narrow.scenery[0].x, 3, 'a 6 m piece may sit 3 m across on a 12 m stage');
const far = normalise({ stage: { width: 12, depth: 8 }, scenery: [{ kind: 'curtain', span: 6, x: 9 }] });
assert.equal(far.scenery[0].x, 3, 'across is held inside the free width');

// Coverage: the house draws cloth at scale 0.88 + 0.12 * depth / stageD. Every depth
// from front to back must be covered by a piece at the limit.
for (let d = 0; d <= stage.depth; d += 0.5) {
  const p = 0.88 + 0.12 * (d / stage.depth);
  assert.ok(max * p >= stage.width - 1e-9, `covers the frame at depth ${d}`);
}
assert.equal(CLOTH_FRONT_SCALE, 0.88);

console.log('cloth span: limit, across clamp, and frame coverage passed');
