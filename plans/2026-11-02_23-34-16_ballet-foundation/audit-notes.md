# Audit notes — 2026-11-02

## User intent
Build for the user's daughter, who studied ballet for 17 years. Aim for credible positions, movement, support and timing, then realistic avatars. User supplied an extensive A–Z glossary as reference and asked to identify missing/wrong implementations. They approved foundation corrections before new moves/wireframes/textures, but explicitly deferred implementation until returning from an appointment. No further app changes now.

## Confirmed current scope
- src/model.js POSES: first–fifth, tendu, plie, releve, arabesque, attitude, pirouette, pas-de-bourree, chasse, plus none. These are full-body presets, not independently selected arms/legs.
- src/model.js STEPS and PHRASE_SHAPES (~286): walk, chasse, pas-de-bourree, pirouette only.
- Phrases: walk travels 0.9 m by default with one transfer; chasse 1.4 m with two generated arrivals; bourree 0.7 m with three transfers; pirouette prepares in fourth then rotates 360 degrees at a pointe level. These are authored approximations, not validated technical performances.
- src/cheatsheet.js is the Moves UI/preview. A named step's preview is not necessarily the generated phrase. src/app.js applies selected pose/step/level to a station.
- Counts, tempo, subdivision/easing, holds and station timing exist. They do not enforce technique-specific feasibility.
- Existing tests passed at audit: test-phrase-plants.mjs, test-video.mjs, test-slides.mjs. Overlap tests passed in the preceding tilt implementation. Phrase tests preserve a deliberate single-foot-skate fault; they are not ballet validation.

## Evidence and corrections to investigate
Line numbers refer to current checkpoint and will drift.
1. src/stage.js drawOverhead (~687 onward) gets joints(spec,1,0,pins), maps legs3, then replaces points[2] with feetOnFloor output. A requested unreachable contact can therefore override the solved ankle without re-solving knee/length, producing visible stretch. drawFeet separately marks requested/blended floor feet. This is the immediate bounded next fix.
2. src/pose.js joints exposes legs3, solves two-segment pinned legs and clamps out-of-reach targets. It reports shortfall. Check its local/stage transforms and footPins conversion rather than assuming all contact math is correct.
3. src/model.js legOverreach (~3084) samples 17 points per transition, reuses pins and joints, and has REACH_SLACK=0.15 m. Sampling/slack are heuristics, not anatomical truth.
4. src/pose.js POSE_SPECS (~41): arabesque legs are [[1,0],[62,78]], with no third fore/aft swing component. Its rear extension is not represented as rear-depth geometry. Arms are 2D pairs from joint angles; torso/head also lack complete 3D geometry. A tilted projection is not a full 3D rig.
5. src/model.js LEVEL_RISE (~74) and src/pose.js joints alter leg length with rise. Model demi/pointe through ankle/foot articulation in a later coordinated change; do not claim current lengths are anatomically fixed.
6. src/elevation.js drawDancer (~407) applies foot pins and blended level rise/absorption. src/house.js (~153) uses the pose renderer with pins:null. src/stage.js drawOverhead uses pose joint heights for tilt but does not apply the same whole-body lift/rise/absorption pipeline. Views need a common evaluated movement state.
7. Foot graphics have no explicit articulated toe/heel model or convincing turnout controls. Fixed PLANT_BY_POSE associates tendu/arabesque/attitude/pirouette with left support; full variant support needs explicit side/working-leg metadata.
8. Pose interpolation blends joint-angle specs rather than enforcing movement phases. A static tendu/pirouette-shaped pose is not the corresponding complete technique.
9. Missing named families include degage/developpe/fondu/frappe/ronds, most jumps, chaines/pique/soutenu/fouette/promenade and balance/waltz. Some concepts can be approximated with existing controls, but should not be advertised as accurately implemented moves.
10. Wardrobe currently resolves costume records with body/skirt/hair colors and simple cuts. No fabric textures, garment mesh or skinning.

## Glossary interpretation cautions
- Categorize poses, actions, direction/modifiers, dynamics and formations separately. Do not make every word a standalone move.
- Correct oversimplified or school-dependent definitions before encoding: demi-plie is not maximum knee bend; arm numbering and arabesque variants vary; en avant/en arriere must be distinguished from body-relative limb direction; counts/tempo are contextual; gender conventions are not capability restrictions.
- En l'air may mean only the working leg is lifted, not whole-body flight. Retire is a pose, pirouette is an action; releve is an action/level rather than a universal arm shape.
- User's broad aspiration that all moves be represented should be approached family-by-family with explicit coverage, not a claim that this glossary is exhaustive or that the app is complete.

## Saved code checkpoints
- 10e6157: top-down with independent Paths/Stations.
- 4c611c7: animated overhead figures.
- 2f8f000: hide filled costume icon in dedicated overhead.
- 6b8615c: drag tilt, reset and independent Costumes (supersedes fixed hide rule).

## On return
Read plan.md and guidelines.md in this bundle, then inspect actual source and Git status. Start Phase 1 only. Preserve unrelated imported untracked files. Keep code review/testing evidence distinct from artistic validation. Ask user to inspect the bounded fix before starting Phase 2.
