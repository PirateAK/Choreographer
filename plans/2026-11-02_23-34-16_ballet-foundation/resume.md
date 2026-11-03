# Resume notes — foundation work (2026-11-03)

## Where we are
- Local `main` at `00282ce` ("Add multi-interval generated walk continuity"). Not pushed; `origin/main` is still `c27bacf`. Push only when the user asks.
- Multi-step walk continuity is done: `generatedWalkSchedule` chains contiguous `walk` intervals (alternating support, swing, trailing close). `withGeneratedWalk` attaches the run with `footTrajectoryRange`. Full engine suite passes.
- Import map: `model.js?v=trajectory5`.

## Next work (user request, 2026-11-03)
Make House, elevation and overhead views consistent, then the foundation items:
1. Movement evaluation consistency: House (`src/house.js`) currently omits pins; elevation (`src/elevation.js`) and overhead (`src/stage.js` drawOverhead) apply level/lift/absorb differently.
2. Rise and leg-length: `LEVEL_RISE` lengthens legs (rise changes leg length); plan says thigh/shin should stay fixed, with demi/pointe handled by foot/ankle articulation.
3. Arabesque rear depth: arabesque lacks rear-depth representation.
4. Per-dancer height/settings: currently global `dancerHeight(show)`; needs a per-dancer override.
5. Then a basic-movement review (walk first). Tests verify code behaviour only, not ballet correctness.

## Audit: movement evaluation per view (2026-11-03, read-only)
Shared inputs: `poseAtLocal` gives `pose,next,t,levelT,level,nextLevel,facing,turn`. `levelOf` gives `rise,lift,absorb`; `levelBlend` blends all three. `footPins` gives contacts. `joints(spec,f,t,pins)` lengthens legs by `rise/2` each.

| Term | Elevation (`elevation.js` drawDancer ~l.420) | House (`house.js` ~l.153) | Overhead (`model.js` overheadPoseAtLocal ~l.3212, `stage.js` drawOverhead) | legOverreach (`model.js` ~l.3280) |
|---|---|---|---|---|
| Pins / contacts | footPins, passed to drawPose | `pins: null` (feet from pose only; shadow uses feetOnFloor) | footPins, solved by joints | footPins |
| Rise | `posed.rise + levelBlend.rise` | `posed.rise + lerp(level.rise,nextLevel.rise,levelT)` (same, not via levelBlend) | none | `posed.rise + lvl.rise` |
| Absorb (plié on landing) | `- lvl.absorb/h` | missing | missing | `- lvl.absorb/h` |
| Lift (air) | `lvl.lift*s`, blended | `at.level.lift` only (start level, not blended) | none (no vertical; fine for plan) | n/a |

Findings:
1. Overhead's shortfall (reach) is solved with no rise and no absorb, while legOverreach uses both. Overhead can disagree with the warning and with elevation about whether a foot is reachable. Highest-priority inconsistency.
2. House ignores absorb and pins, and reads lift from the start level only, so a jump's height is wrong during the transition. House pins are null, so a planted foot is not held in the House view.
3. Elevation is the reference (only view using the full pipeline). Blending should be shared via one function, e.g. `evaluateMovement(show, dancer, lt)` returning `{ at, spec(rise+absorb), pins, lift, facing, turn }`, used by all three views and legOverreach.
4. Overhead has no vertical lift by design; it should still use the same rise/absorb in its solve so reach matches.
5. `legs` rise lengthens thigh/shin (pose.js l.183 `BODY.leg + rise/2`). This is the Phase 2 leg-length item and is not fixed by harmonization.

Proposed order: (a) add shared `evaluateMovement` in model.js, (b) switch elevation, house, overhead, legOverreach to it with a test that the four agree on shortfall/feet at sampled times, (c) then leg-length/ankle articulation, arabesque rear depth, per-dancer height.

## Guardrails (from plan.md and guidelines.md)
- Do not move user stations or rewrite existing choreography silently.
- Keep warnings honest; do not raise thresholds to hide them.
- Zero dependencies, vanilla ES modules, no build step.
- Bump import-map versions for changed browser modules.
- Verify with the engine suite (12 tests), `node --input-type=module --check`, `git diff --check`, and a browser smoke test at the preview.
- Commit each verified checkpoint with `git -c user.name=Workshop -c user.email=workshop@local`.
- Preserve untracked imported files; do not create new docs unless asked.
