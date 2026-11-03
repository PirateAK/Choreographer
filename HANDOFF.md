# Handoff — Choreographer, state at 1 Nov 2026

Written so any model can pick this work up by reading one file. It is deliberately
factual: everything below was read from the files or run, not remembered.

## Where the project is

    C:\Users\kurt\.config\freebuff-desktop\local-projects\2de6f9cb-db2a-427a-996c-6e053d2a285b

Open **that folder** as the project. Do not work in `threads\` — it holds per-thread scratch
copies with stale snapshots of a few files, and opening one makes the project look half-lost.
That mistake cost a morning on 1 Nov 2026.

## What it is

A zero-dependency, no-build-step browser tool for planning stage performance: a 2D stage
plan, cast paths, an elevation from the house, a timeline with acts and music, and a large
printed output (plot, elevation, station tables, cue sheets, scene cards, clearance list,
lighting sheet, curtain call). Plain ES modules in `src\`, served by `server.mjs`.

Run it:

    node server.mjs 4322        (or start-choreographer.cmd)
    then http://127.0.0.1:4322

`server.mjs` binds `127.0.0.1` only. No `npm install`, ever: the "no new dependency and no
build step" rule in `PLAN-FOOTING.md` is a project constraint, not an accident.

## Read these first

- `NOTES.md` — the design record, 3,516 lines to 1 Nov 2026, newest sections at the end.
  Every feature has a section with its reasoning and a **Checked.** paragraph.
- `PLAN-FOOTING.md` — foot contact and weight. **All eight steps are built** as of 1 Nov 2026.
  Its "What must not change" list is the project's real rulebook.
- `README.md` — the user-facing summary, current to 1 Nov 2026.

## What was built in the last session (1 Nov 2026)

All three are recorded in `NOTES.md`; this is the short version of what to expect in the code.

1. **The overlap fixer.** `scanOverlaps`, `overlapFix`, `applyOverlapFix` in `src/model.js`;
   panel labelled **Overlaps → Find overlaps** in `index.html` with `overlapRow` and the fix
   click handler in `src/app.js`. Whole-show scan on the same `CLEARANCE` (0.55 m) the
   run-through stops on; one ranked fix per overlap (nudge / shift / retime, cheapest first);
   every candidate measured on the real show and put back; `pathsKey` makes a stale list stand
   down. Verified: `node test-overlap.mjs` — 8 cases, all reaching zero overlaps.
2. **Phrases choose their own plants** (step 5 of the footing plan). `otherFoot`, `phraseLead`
   and `phrasePlant` sit above `phraseStations` in `src/model.js`, which now writes `plant` on
   the stations it lays down. A walk alternates from the foot she was last on, a chassé lands
   the front foot of the two it gathers, a pas de bourrée lands its third transfer, a turn keeps
   the standing foot. It writes **nothing** under a position that names its own side (an
   arabesque) or on a body in the air, so a plant can never contradict the drawing. Verified:
   `node test-phrase-plants.mjs`, and once through the real Moves panel.
3. **Step 6 recorded as built.** The tableau sheet's contact crosses were already there —
   `tableauPage` draws through the same `castAt` → `footMarks` pair the plot uses. No code
   changed; the plan was corrected in place.

## Known faults, honestly stated

- A **fourth-position preparation** reports a skate of about 0.35 m into the turn
  (`test-phrase-plants.mjs` prints it). Proven pre-existing: the same fault appears with every
  written plant stripped out. It belongs to the position table, not to phrase plants.
- A plant held **through a turn** can leave a couple of centimetres of the across-stage axis
  unheld (see `PLAN-FOOTING.md`, step 8 limit).
- The run-through and the plan both read a foot's depth from the body in some places; the
  fore/aft axis fixed most of this, but not every path.

## Next work, in the order the notes queue it

1. The **projector and screen** — designed, not built (`NOTES.md`, "Narration (built) and the
   projector (queued)").
2. The fourth-position skate above, if it is worth chasing into the pose table.

## Traps that have already caused damage

- Do **not** copy `C:\Users\kurt\Freebuff-projects-backup` over this folder. It is from
  31 Oct 11:00 and its `RESTORE.md` predates a day of work. It is a safety net, not a source.
- Do **not** install `Freebuff-0.0.192-win-x64.exe` from that backup; it is older than the
  installed build.
- Do **not** clear browser site data for `127.0.0.1`. The live show lives in the app's storage
  there. As at this handoff the saved show is **Winter Recital — sketch 1**, 5,255 bytes, with
  Ada on 8 stations, Bea 5 and Cleo 5. If the stage looks wrong, compare against those numbers
  before assuming code damage.
- The C: drive is **96% full** (about 11 GB free). A nearly full disk caused save timeouts and
  a crash on 1 Nov; it will do it again. Clearing Temp and old installers is worth more than
  any code change.

## Safety copies on disk

- `NOTES.md.bak-2026-11-01`, `NOTES.md.bak-step5`
- `PLAN-FOOTING.md.bak-2026-11-01`, `PLAN-FOOTING.md.bak-step5`
- `backup-2026-10-31\` inside the project, and `Freebuff-projects-backup\` in the home folder
- Show history: `show-backup-2026-10-31.json`, `show-recovered-2026-10-31.json`,
  `show-checkpoint-2026-10-31.json`

## How to verify before claiming anything

Run what exists: `node test-overlap.mjs` and `node test-phrase-plants.mjs` (both exit 0, both
print their numbers). Then load http://127.0.0.1:4322 and check the console is empty. If you
change a station's geometry, the plan and the printed elevation must still agree — that rule is
why the pose table is kept as one source.
