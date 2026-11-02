# Ballet foundation and avatar roadmap

## Agreement and purpose
User explicitly requested these saved notes and plan on 2026-11-02. Pause implementation until they return. The app is being made for the user's daughter, who studied ballet for 17 years. Prioritize recognizable, technically considered ballet movement before wireframes, textures or a larger gallery. Do not claim biomechanical safety or universal school-specific technique. Invite her review of representative examples when available; do not require it to begin engineering corrections.

## Current checkpoint
Branch: feature/slide-projector. Last app commit: 6b8615c (limited drag tilt and independent costume visibility). No app code changed during the subsequent ballet audit.

Working features to preserve: theatre editor, timing/music, scenery/curtain/screen cues, video trimming and audio synchronization, gallery slide crossfades, shared projector replacement semantics, House/Watch and return, overhead dancer figures, independent Paths/Stations/Costumes, drag Tilt view limited to 0–55 degrees, Reset overhead and browser-local view preferences.

## Guidelines to read before implementation
Read `guidelines.md` in this bundle. Consult `audit-notes.md` for evidence and uncertainties. This plan is a saved baseline; track implementation progress in the bundle's tasks directory rather than rewriting this document.

## Phase 1 — Correct visible contact/reach rendering (next session, first bounded change)
1. Trace the complete foot/contact/joint pipeline and establish regression fixtures before editing: src/pose.js joints/legs3, src/model.js feetOnFloor/footPins/legOverreach, src/stage.js drawOverhead/drawFeet, src/elevation.js drawDancer, src/house.js dancer drawing.
2. Remove the overhead practice of replacing a solved ankle with a requested contact after the knee solve. Separate the requested floor contact from the actual reachable ankle. Keep any unreachable target as a clearly differentiated warning/target, not a stretched leg. Ensure foot markers do not falsely imply the rendered toe is on an unreachable contact.
3. Agree on and implement a common body-to-stage transform for contact solving and projection. Check mirror, quarter turns, complete rotations, pinned-foot transitions and view consistency. Do not blindly share screen-projected coordinates across views.
4. Keep the existing proportion/rise assumptions for this narrowly scoped correction unless they block correctness. Fixed anatomical lengths and ankle mechanics are Phase 2, not a prerequisite for shipping the first renderer fix.
5. Verify: each rendered upper/lower leg segment has its solver-prescribed length; unreachable contact does not lengthen it; reachable planted feet remain stable; flat/tilted plan, elevation and House agree on contact status; playback and scrubbing are deterministic. Preserve the existing fourth-position two-foot transfer exemption and deliberate single-foot-skate detection.
6. Save a checkpoint and ask the user to inspect before moving to Phase 2. Do not auto-reposition any existing stations.

## Phase 2 — Shared articulated movement foundation
- Keep thigh/shin lengths fixed independently of pose and level. Rework demi-pointe/pointe through foot/ankle articulation and body placement rather than growing bones. Treat this as a coordinated model change, with migration/compatibility review.
- Provide a shared 3D joint description for legs, torso, arms and head; project it consistently in each view. Preserve stage position and show clock as authoritative.
- Represent support foot, working foot, front/back foot order, contact states and transfers explicitly. Distinguish a lifted working leg from the whole dancer being airborne.
- Include body lift/landing absorption consistently in joint solves, contacts and all view renderers. Resolve House currently omitting pins and overhead not applying the same level adjustments as elevation.
- Tests cover fixed lengths, foot stability, no penetration, reachable versus unreachable targets and consistent view output. Engine tests are not clinical or artistic validation.

## Phase 3 — Validate ballet positions and simple transitions
- Separate foot positions from port de bras; add explicit left/right, front-foot ordering and working-leg direction.
- Review first through fifth, demi-plié, relevé, tendu devant/derrière/à la seconde, cou-de-pied, retiré, arabesque and attitude.
- Correct arabesque's missing rear-depth representation; add arm depth so overhead/tilt does not flatten every arm into the frontal plane.
- Add configurable turnout and distinguish body facing, head/spotting and épaulement. Do not assume one school's arm nomenclature applies universally.
- Validate stationary transitions before travelling steps. Create a small reference show with named cases and optional expert review. Preserve old shows; introduce versioned/optional metadata with safe defaults if schema changes.

## Phase 4 — Steps, timing and constructive placement assistance
- Model named actions as phases: preparation, brush/transfer, extension or flight, landing/closure. Do not substitute a label or single endpoint for the technique.
- Start with walk, chassé and pas de bourrée; then tendu, dégagé, développé/fondu and simple sauté/échappé/changement. Explicitly specify support/contact order.
- Model beat subdivisions and phase accents; allow technique-dependent timing rather than a universal speed limit or fixed count requirement.
- Add warnings and optional corrections: nearest reachable placement for a genuinely planted transition, or enough intermediate steps for travel. Explain any proposed edit and retain undo. No silent station movement or blanket maximum distance for all moves.
- Keep jumps, steps, turns and assisted/carrying movement distinct. Partner carrying requires explicit support relationships, not arbitrary floating height.

## Phase 5 — Expand the Moves gallery in reviewed families
- Organize positions, actions, directions/modifiers, movement qualities and formations separately.
- Add movement families gradually: barre actions and ronds; balancé/waltz/glissade/bourrée couru; turns (chaînés, piqué, soutenu, promenade, fouetté); jumps (assemblé, jetés, sissonne, entrechat, etc.); partnering later.
- Preview and inserted phrase must use the same evaluated movement sequence. Document within the UI when a move is approximate or not implemented, rather than displaying a misleading label.
- Track variants, prerequisites, support changes and landing conditions. Do not turn historic gender conventions into app restrictions.

## Phase 6 — More realistic avatars and wardrobe
- Once the shared skeleton/motion is reliable, add shaped articulated silhouettes and garment pieces; optional 2D fabric textures can retain the current canvas architecture.
- A true 3D wireframe/mesh is a separate architectural decision: rigged body, joint transforms, garment geometry, materials/UV textures, assets, occlusion and performance. Discuss tradeoffs and any dependency policy change before implementation.
- Keep wardrobe independent of motion so appearance cannot change contacts or technique. Do not start this phase merely to conceal movement inaccuracies.

## First return-session deliverable
A tested, small contact/reach rendering correction with a repeatable demonstration of reachable and unreachable stations; no new moves, textures, automatic choreography editing or broad skeleton rewrite in the same iteration.
