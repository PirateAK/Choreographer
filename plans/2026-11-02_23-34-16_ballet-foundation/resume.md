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

## Status: shared movement evaluation (2026-11-03)
- Added `evaluateMovement(show, dancer, lt)` in model.js: pose, rise+absorb spec, footPins, blended lift. Used by overheadPoseAtLocal, legOverreach, elevation drawDancer, house drawDancer.
- House now passes real pins (feet held) and blended lift (was start level only). Overhead reach now includes rise and plié absorption.
- Import map: model trajectory6, house slides10, elevation move1 (new entry).
- New test `test-movement-views.mjs`: pins/rise/lift agreement, overhead reach vs shared spec. Discriminating case: 17 unreachable samples agree; dropping rise/absorb changes one verdict.
- Full engine suite (13 tests) passes; `git diff --check` clean; browser smoke loads with no page errors (House view not opened by smoke).
- Watch: overhead can now show new red X where rise/absorb shorten the leg. This is the honest result, not a threshold change. Review existing shows before calling it done.
- Not done: House render path not exercised in browser; leg-length (rise/2 per leg) still open (Phase 2).

## Leg length / ankle articulation: design findings (2026-11-03, not yet implemented)
- `pose.js` joints(): `leg = BODY.leg + rise/2` per leg; `hipY = BODY.hip + rise - rockSink`. Rise lengthens legs and raises hips; ankles stay on floor.
- Fixed legs cannot do this: a straight leg with the hip raised by `rise` cannot reach the floor. Fixing lengths REQUIRES an ankle-lift term: the ankle sits `ankleLift` above the ball-of-foot contact, and the hip rises by the same amount.
- Consequences if changed: `floorY` clamp in joints (ownAnkle), pins (`y` is contact height 0; relevé pins need the lift), `feetPlaceOf`/contacts (contacts equal ankles today), `test-pose-calibration.mjs` line ~30 asserts `len = BODY.leg + rise/2` (encodes current lengthening; must be updated deliberately), cheatsheet.js line ~141 (level rise for drawing).
- Rise values today: demi 0.02, pointe 0.045 (LEVEL_RISE, body heights); releve 0.04, pirouette 0.05, arabesque/attitude/pas-de-bourree 0.02, plie -0.09, fourth -0.02.
- Open decision for the user: ankle-lift per level (demi vs pointe heights), and whether the ball of the foot or the ankle is the contact on relevé. Arabesque and attitude carry a rise of 0.02 on the standing foot, which may be a flat foot or a pointe — needs clarifying.

## Guardrails (from plan.md and guidelines.md)
- Do not move user stations or rewrite existing choreography silently.
- Keep warnings honest; do not raise thresholds to hide them.
- Zero dependencies, vanilla ES modules, no build step.
- Bump import-map versions for changed browser modules.
- Verify with the engine suite (12 tests), `node --input-type=module --check`, `git diff --check`, and a browser smoke test at the preview.
- Commit each verified checkpoint with `git -c user.name=Workshop -c user.email=workshop@local`.
- Preserve untracked imported files; do not create new docs unless asked.

## Status: ankle articulation checkpoint (ank-2..ank-5 done, ank-6 commit pending)
- Bone lengths fixed at BODY.leg (no rise/2 lengthening). Contacts are ball-of-foot: `feetPlaceOf` y = ankle − max(0, rise); pinned ankle target = contact + max(0, rise) in `joints()` hold and `contactSink`.
- Hip shift is measured from the socket it starts at (not the origin), so the hip never overshoots the support foot. This removed the 2 cm arabesque settle the fixed leg had created (HEAD 0.8 mm; now 0 mm at every weight).
- Plié re-solved to legs [42.68, −30.57]; contacts match HEAD (y 0.025), was −0.062 (below floor).
- Fourth re-solved to legs [[22.087, −13.04, 22.978], [4.483, −30.454, −21.077]]; contacts reproduce HEAD exactly. Angles change a lot: needs teacher review of the shape.
- Rises: releve 0.03, pirouette 0.06, arabesque/attitude 0.03, LEVEL_RISE demi 0.03 / pointe 0.06, cheatsheet level rise matched. Pas de bourrée 0.02 kept pending the syllabus decision.
- Fallout: relevé contact x 0.055 → 0.054 (1 mm, tolerance 2 mm in test-ankle-lift.mjs). Movement-views unreachable foot samples 17 → 14 (test asserts > 0).
- Tests: test-ankle-lift.mjs (new) plus the 13 existing engine tests pass; syntax and `git diff --check` clean; browser smoke loads with no page errors. Import map: pose load2, model trajectory7.
- Open for the user: fourth-position shape, pas de bourrée rise per syllabus, plié shape (thigh 20° → 43°) for teacher review.

## Status: arabesque rear depth (2026-11-03)
- Arabesque working leg was `[62, 78]`: 28° below horizontal sideways, ankle at 0.35 height, no rear depth. Now `[180, 180, -60]`: straight, thigh 30° above horizontal behind. Ankle at height 0.86 (hip 0.56), rear depth −0.42 of body height. Support foot unchanged.
- Trade-off: the 6° rock tips the lifted leg forward with the hip, so rear depth is about 0.39 once rocked. Teacher to confirm the 30° elevation (school-dependent; many syllabi use 90°).
- Free feet are no longer reported as contact shortfalls: the overlap loop skips unpinned sides, and overhead `shortfall` follows the same pin condition as `unreachable`. Free-foot home is still held by the hip-drop rule, so a straight free leg can sit about 1 cm off its home.
- Attitude has the same lowered-sideways working leg (`[45, -30]`, ankle 0.12). Not changed yet; needs the same review.
- Import map: pose load3, model trajectory8. Engine suite passes (14 tests incl. rear-depth assertions in test-ankle-lift.mjs). Browser smoke: no page errors.


## Status: arabesque/attitude convention and attitude fix (2026-11-03)
- Arabesque now 90° (thigh and leg horizontal behind, straight): legs `[[1, 0], [180, 180, -96]]`. The 6° rock tip is cancelled by `front −96` so the line is level with the hip (ankle y − hip y < 0.02). Rear depth z < −0.45 of body height. Rise 0.03 on the standing foot.
- Attitude fixed: thigh level behind (`[180, 0, -87, 0]`: hip 180, knee 0, front −87), knee at 90°, lower leg folded straight down with its own fore-and-aft (`shinFront` 0). Knee z < −0.2 and level with the hip (|Δy| < 0.05). Ankle is below the knee by > 0.2. Shin verticality tolerance is 0.02 because the 3° rock tips the shin 13 mm in z. Documented in test-ankle-lift.mjs.
- Code: `shinFront` (optional 4th entry of a leg triplet, default = front) is supported in `blendSpecs`, `rockSink`, and `limbFrom`. Settle stays 0 mm.
- Import map: pose load4 (model trajectory8, unchanged).
- Verified: syntax, 14 engine tests including test-ankle-lift.mjs, `git diff --check`, browser smoke (title ok, no page errors).

### Teacher questions (unresolved, school-dependent)
- Arabesque at 90° horizontal behind is the convention used here; confirm against the school's line (some syllabi use lower or higher elevation).
- Attitude fold: thigh horizontal, knee 90°, lower leg vertical. Confirm the fold and whether the foot sits at knee height or lower.
- Fourth-position shape: angles changed a lot in the re-solve, contacts match HEAD.
- Plié thigh 20° → 43°.
- Pas de bourrée rise 0.02 pending syllabus.
- Relevé ball-of-foot height 0.010 (HEAD), confirm the floor convention.

### Teacher answers (received 2026-11-03; standard conventions vs school-specific measurements)
- Arabesque 90° (horizontal behind, straight leg): recognized target for the working leg. The school's line decides the arm and body shape. Keep hips and shoulders aligned to that line rather than turning to force height. Current code matches the 90° target. Confirm the school's arm and body shape before fixing it.
- Attitude: 90° knee bend is the common reference. Knee sits higher than the pointed foot, not level with it. Current code has the foot below the knee (test: ankle y < knee y − 0.2), which matches this. Still confirm the school's knee height.
- Fourth position: define the school's geometry explicitly: turnout, spacing, and whether the feet are crossed or parallel to the direction of travel. Contacts match HEAD, but the shape may differ visually. Needs school definition before further changes.
- Plié thigh 20° → 43°: the number alone does not show correctness. Specify the measurement convention (thigh-to-floor or thigh-to-vertical) and intended depth. Grand plié thighs are generally described as reaching horizontal. Needs a measurement convention before the change is judged.
- Pas de bourrée rise 0.02: keep pending syllabus. Needs units and a reference point (floor, ball of foot, or heel) before it is actionable.
- Relevé ball-of-foot height 0.010: define height from the floor to the ball of the foot, in body-height units. On demi-pointe the heel lifts while rising onto the balls of the feet. The floor convention must state which contact is the zero-height reference.
- Plié convention (settled 2026-11-03 in notes; depth still open):
  - Thigh angle = hip angle from vertical (`legs[i][0]`, the code's native measure). Thigh-to-floor = 90 − hip angle. Grand plié target (thigh horizontal) = hip 90, thigh-to-floor 0.
  - Current `plie` legs [42.68, −30.57] = thigh 42.7° from vertical, 47.3° to floor, with body sink −0.09 (ankle on floor, shortfall none).
  - HEAD legs [20, −8] at the same sink put the ankle at −0.062 (6 cm below floor) under fixed bone lengths. The 43° is what keeps the flat foot on the floor at this sink. It is not a chosen depth.
  - Decision (2026-11-03): the current 42.7° is the contact-constrained solution, not the chosen plié depth. A demi-plié target is added only after the school's depth is specified. Then solve for floor contact while keeping the chosen body height and bone lengths (per Luna).
  - Open: the target depth (demi vs grand). Reaching horizontal thighs with flat feet needs a much deeper body sink and a different shin angle than now. Teacher or school depth is needed before changing the sink or legs.
- Principle: record angle or height, anatomical reference point, units, and school or syllabus convention separately. The same pose can otherwise be read differently.

### Not started
- Per-dancer height settings. Only start after the moves above are confirmed for height. `dancerHeight(show)` is still global.

## Status: school conventions table (2026-11-03)
- New `src/conventions.js`: one table of school-set values. Each row has the built-in default (the best case now), unit, anatomical reference, note, and `applied`. Overrides are stored in browser storage under `choreographer.conventions.v1`, never in show files. Invalid values are refused with a reason, not clamped.
- Applied now (the pose and levels read the school value): releve, pirouette, arabesque, attitude, pas de bourrée rise; level demi and pointe (model.js and cheatsheet.js). `specOf` returns a copy only when a school value is set, so defaults are the shared table as before.
- Recorded, not applied (the solver does not read them yet): plié depth, arabesque elevation, attitude knee height, fourth-position geometry. The table says "Recorded, not applied yet" for these rows.
- UI: "School" button in the header opens the table sheet (same overlay as Moves). Enter a value to apply; Reset returns a row to the default; Esc or click outside closes.
- Note for the teacher: the earlier note listed relevé ball-of-foot height as 0.010 (HEAD). Current code uses 0.03 (set during the ankle work). The table uses 0.03; confirm which the school wants.
- Import map: pose load5, model trajectory9, cheatsheet guide22, conventions conv1, app scroll22 (styles.css scroll22).
- Verified: 15 engine tests incl. test-conventions.mjs (defaults equal code, override reaches specOf and contact stays on ball-of-foot, refusals, reset); syntax; `git diff --check`; browser check of the sheet (rows, save, reset, refusal, Esc) with no page errors besides the pre-existing favicon 404.
- Next: wire the recorded rows into the solver as the school supplies values (plié depth needs a re-solve of the sink and shin; arabesque/attitude height needs the working-leg angle solve; fourth needs a geometry definition).

## Decision: relevé ball-of-foot height (2026-11-03)
- Value: 0.03 body height (1 = dancer height), provisional default. Not a school-approved measurement. Editable in the School table (`releve.rise`).
- Meaning: vertical distance from the floor to the ball-of-foot contact point during relevé, both feet. Zero is the floor contact. Unit: fraction of dancer height.
- Prior value: 0.010 at HEAD, kept here as a prior value. It is not used and was not silently replaced.
- Open: the school to confirm or replace the value, and whether it is demi-pointe or pointe for the relevé step.

## Decision: provisional presets and row schema (2026-11-03, per Luna)
- Every row carries `value`, `unit`, `measurement_reference`, `status` (`provisional` | `school-approved` | `unset`), `school_method`, and `applied`. No row is `school-approved` yet.
- Provisional and applied in preview: demi, pointe, releve (0.03), pirouette, arabesque, attitude, pas de bourrée rises. Results using them are not school-correct until the school reviews.
- Plié: `plie.depth` is a separate provisional demi-plié preset (42.7, thigh from vertical). It is not derived from floor contact; the solver does not read it yet (`applied: false`). Changing it leaves the plié's sink and rise unchanged.
- Arabesque: `arabesque.elevation` (90, optional target, degrees from straight down, 90 = horizontal behind) and `arabesque.arms` (text) are separate fields. `applied: false`.
- Attitude: `attitude.knee_height` is `unset` (null). Not inferred from the knee bend.
- Fourth position: `fourth.turnout` and `fourth.spacing` are `unset`; `fourth.feet` is a provisional crossed, turned-out preview preset (text). None read by the solver.
- The table shows a preview banner and per-row status and "read by the pose" / "not read by the solver yet".
- Import map: conv2, app scroll23, styles scroll23.
- Verified: test-conventions.mjs (fields, statuses, unset holds null, plié depth separate from rise, unset numeric ranges), all 15 engine tests, syntax, `git diff --check`, browser check of the sheet.

## Preview re-solve and approvals (conv3)

- Storage moved to `choreographer.conventions.v2` with `{values, approvals, approver}`. v1 overrides are not migrated (dev data only).
- Plié: `plie.depth` default is 42.68°, the contact-constrained baseline from the closed form (not a demi target). Status provisional. `plieSpec(depth)` (pose.js) re-solves shin angle and body sink to keep ankles at x 0.089 / y 0.025. Accepted range 17.9–90. The flat-foot limit is 17.86°: below it the solved rise turns positive and lifts the ankle onto the ball of the foot, so the table refuses it. Baseline `specOf('plie')` returns the shared spec unchanged.
- Limit: `STEP_SINK_MAX` stays tied to the table's baseline plié rise (not the preview depth). It caps contact compensation in travelling steps. Tying it to a deeper preview would raise the travel allowance, so it is left as is until the school decides.
- Arabesque 90° is kept as an optional provisional target; arm set is a provisional note. Not school-approved. Elevation is recorded, not read by the solver.
- Attitude knee height stays unset. Solver does not infer it.
- Fourth position: crossed, turned-out preset is provisional (text, not read). Turnout, spacing, and foot orientation remain unset or unapproved.
- Approval: each row has Approve / Revoke. Approval needs an approver name (stored with the table) and a value in use; it records `{value, by, at}`. Changing the value withdraws approval ("Approval withdrawn: value changed"). Unset rows cannot be approved.
- Statuses: `Provisional`, `School-approved`, `Unset`. Banner counts provisional values in use vs school-approved in use.
- Tests: test-conventions.mjs prints the three-way summary (provisional in use / school-approved in use / unset) and checks plié re-solve contacts, baseline identity, approval lifecycle, and withdrawal.
- Import map: pose load6, conventions conv3, app scroll24, styles scroll24.
- Verified: conventions test; all engine tests (ankle-lift, contacts, conventions, foot-scheduler, foot-trajectory, movement-views, overlap, phrase-plants, placement-guide, pose-calibration, pose-contact-load, slides, timeline-scroll, transition-diagnostics, video); syntax checks; `git diff --check`; browser smoke of the School sheet (approve, refuse without name, withdraw on change, plié refusal, unset not approvable, Esc closes, no page errors).
- Not run by the default loop: test-placement-browser.mjs and test-timeline-browser.mjs import bare `playwright`, which does not resolve from the project. They need the temporary Playwright path.

## Arabesque elevation preview (load7, conv5)

- `arabesque.elevation` is applied. Default 90 is the provisional preset and returns the shared POSE_SPECS entry, so the default drawing is unchanged.
- Measure: working leg's angle from straight down as drawn, after the body tip (rock 6). 0 hangs, 90 horizontal behind, 180 straight up. `arabesqueSpec(e)` sets the working leg's fore-aft angle to `e − 180 − rock`. The drawn angle is verified at 0–180° in 1° steps.
- Arm set and standing leg are unchanged. The arm set stays a provisional note, recorded, not applied.
- Limit: a school arabesque may not match the 90° horizontal line. Elevation is a provisional target only.
- Verified: test-arabesque-elevation.mjs, test-conventions.mjs (elevation provisional-in-use, arms recorded-only), full engine suite, syntax, `git diff --check`, School smoke.

## Fourth position turnout (load8, conv6)

- `fourth.turnout` is applied when entered. Unset (default) draws the existing preset unchanged.
- Entered turnout turns each leg about its own hip by that angle, outward for both feet. The foot follows; bone lengths are unchanged (verified 0–180° in 1° steps). Contacts follow the turned ankles through feetPlaceOf.
- Limit: knee-over-toe alignment is not modelled. Plan toe rotation is covered in the toe rotation section below.
- `fourth.spacing` stays recorded only. Its measure is heel-to-toe, which needs a foot length the solver does not have. Needs a school value for foot length.
- `fourth.feet` (crossed, turned-out) stays a provisional text preset. Its "turned out" label is not drawn until a turnout value is entered.
- Blends carry `turnout` when either end sets it (blendSpecs). Blends without turnout are unchanged.
- Verified: test-fourth-turnout.mjs, test-conventions.mjs, full engine suite, syntax, `git diff --check`, School smoke.

## Toe rotation in plan view (pose load9, model trajectory10, guide21)

- Each foot in the overhead (plan) view draws a toe line from the ankle dot. The toe points where the solver turns the foot: forward when parallel, outward by the turnout.
- Geometry: `toeDirection(spec, side)` in pose.js uses the same yaw as the limb; the point is transformed through `frame.toStage`. Length `TOE_LENGTH = 0.05` body units (matches the elevation toe; not anatomical foot length).
- Limit: no knee-over-toe alignment; the toe is a direction indicator only.
- Verified: test-fourth-turnout.mjs section 7 (toe vs turned leg) and section 8 (plan toe turns by 40° for both feet through overheadPoseAtLocal), full engine suite, syntax, `git diff --check`, School smoke. Plan render not visually inspected.

## School answers, provisional defaults (conv7)

- All values are provisional or unset. None is school-approved. Editable in the School table; approval is per row.
- Arabesque arm set: current preview arm set, provisional, recorded only.
- Attitude knee height: unset; not inferred from knee bend. Solver skips the constraint.
- Fourth position: crossed, turned-out preview preset, provisional. Foot length 0.15 body units (≈25.5 cm at 1.7 m), provisional, recorded only. Spacing unset, recorded only: the solver does not yet turn spacing into a heel-to-toe distance.
- Pas de bourrée rise 0.02, relevé rise 0.03: provisional, editable, with unit and measurement reference.
- Plié: 42.68° is the current contact-constrained pose, provisional preview depth, not a school demi-plié depth.
- test-conventions.mjs summary now reflects the default state (no approvals). Its previous approval fixture printed releve.rise as school-approved.
- Spacing solver (fourth position, conv7, load10, scroll25): when fourth.spacing is entered, specOf scales both legs' fore/aft angles together until the front heel-to-back toe gap matches. Hip and knee angles and bone lengths are unchanged. Foot length is read only then.
- Ankle sits 0.3 of foot length from the heel: a solver assumption, not a school measurement.
- Out of reach (e.g. 0.95 with foot length 0.15; reachable gap is about −0.15 to 0.886): the drawing stays at the nearest reachable gap, spec.spacingShortfall is set, and the School banner reports the shortfall.
- Verified: test-fourth-spacing.mjs, test-fourth-turnout.mjs (spacing reaches solver), full engine suite, syntax, School smoke, out-of-reach banner in browser.
