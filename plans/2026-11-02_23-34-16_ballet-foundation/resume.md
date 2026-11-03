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

## Guardrails (from plan.md and guidelines.md)
- Do not move user stations or rewrite existing choreography silently.
- Keep warnings honest; do not raise thresholds to hide them.
- Zero dependencies, vanilla ES modules, no build step.
- Bump import-map versions for changed browser modules.
- Verify with the engine suite (12 tests), `node --input-type=module --check`, `git diff --check`, and a browser smoke test at the preview.
- Commit each verified checkpoint with `git -c user.name=Workshop -c user.email=workshop@local`.
- Preserve untracked imported files; do not create new docs unless asked.
