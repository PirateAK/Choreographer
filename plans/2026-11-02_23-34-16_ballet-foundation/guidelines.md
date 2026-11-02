# Implementation guidelines

- Pause coding until the user returns. Work incrementally; finish and verify the first bounded contact/reach renderer fix before broader anatomical changes.
- Preserve zero runtime dependencies, vanilla ES modules, canvas rendering and Node static server; no build step. Discuss a change before introducing a 3D engine or dependencies.
- Use ./start.sh with APP_PORT and existing conditional devguard; do not restart a running server merely for file edits. Do not push Git remotes without explicit permission.
- Preserve saved show metadata, undo, media references and existing theatre workflows. Never clear localStorage/IndexedDB to solve startup issues. Media bytes stay in browser IndexedDB, not show JSON. Do not delete bytes during ordinary cue removal/replacement.
- clone blendSpecs() results before mutation because endpoint results can be shared POSE_SPECS references.
- Use consistent module import-map cache versions for changed browser-facing modules; avoid duplicate model/state module instances. Update CSS cache version when needed.
- Do not silently move user stations or alter existing choreography. Optional corrective operations must explain the effect and support undo.
- Glossary is a supplied reference, not a universally authoritative technical standard. Cross-check technique when implementing it, acknowledge school variations, and do not present computational reach checks as medical/safety certification.
- Do not proactively create more documentation unless requested. These notes/plan were explicitly requested on 2026-11-02.
- Verify modifications before completion: node test-phrase-plants.mjs; node test-overlap.mjs; node test-video.mjs; node test-slides.mjs; node --input-type=module --check < changed-file.js; git diff --check.
- Browser tests can use temporary cached Playwright with /usr/local/bin/chromium, without adding project dependencies. Test both playback and scrubbing, all applicable views, hidden overlays, reload persistence and Watch return. Add focused deterministic geometry regressions for any model/render correction.
- Tests that pass establish specified code properties, not correct ballet technique. Use representative visual review and the daughter's expertise where available.
