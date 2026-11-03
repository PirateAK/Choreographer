# Choreographer — where things stand

Written the night of 31 Oct 2026, at your request, so nothing is lost while you think it over.
Nothing was taken away and your show was not changed.

## Starting it again

In this folder:

    node server.mjs

Then open http://127.0.0.1:4322 in the browser.

## What changed tonight

Clicking a dancer's name in the track list already selected them, but the editing
controls sit in the far-right panel, below the floor map and the cast list, and the
panel never scrolled to them. So the only thing you could see happening was the other
dancers' paths vanishing from the stage (that is the "All paths" checkbox at the
bottom being off — nothing is deleted).

Two changes:

1. Clicking a station's dot on a dancer's track now picks that station, jumps the
   playhead to it, and outlines it. Dragging the dancer on stage then moves *that*
   point instead of adding one at the end.
2. The dancer you have selected is remembered, so the panel is no longer blank after
   a reload or the next morning.

## Editing an existing path now

1. Click the dancer's name in the track list.
2. Click one of their dots on the track.
3. Drag the dancer on stage.

Poses and transition seconds are in the panel on the right. "remove" beside a station
deletes just that station; Undo brings it back.

## The open question

It still doesn't behave the way you expect, and that is the real problem — the
controls are in the right-hand panel while you are looking at the tracks. The
unanswered question is: should stations be added and edited directly on the track you
clicked, instead of in a panel on the other side of the screen?

## Safety copies

- `show-checkpoint-2026-10-31.json` — the show as it stands now (taken at the end of
  the day's cloth work). Newest of the three; the app's Import button loads it.
- `show-recovered-2026-10-31.json` — the show as recovered after the reinstall.
- `show-backup-2026-10-31.json` — the old demo copy from before the recovery.
- `backup-2026-10-31/` — a copy of all the code as it stood tonight, in case a later
  change goes wrong. Note this copy predates the cloth editing (width, across, depth,
  dragging, snapping), so it is a fallback, not a snapshot of today.
- The live show itself is stored in the browser (localStorage), so it survives
  reloads; the backup file above is the safety net if the browser data is cleared.

## 31 Oct 2026 — where things stand (written by hand, not by the chat)
- Your show is saved as `show-recovered-2026-10-31.json` (2,035 bytes, checksum 239571355b19...).
  Older demo copy: `show-backup-2026-10-31.json`. Pre-recovery code copy: `backup-2026-10-31/`.
- Full backup of all four Freebuff projects, outside the app's folder:
  `C:\Users\kurt\Freebuff-projects-backup` — see `INDEX.txt` and `RESTORE.md` in it.
- The app itself is unstable since its 0.0.196 update (31 Oct, 10:19): sidebar chat entries
  duplicate/rename themselves, and the chat database has stopped writing to disk.
  This does not affect this project. To work on the show, use `start-choreographer.cmd`
  and open http://127.0.0.1:4322 — that needs only Node, not Freebuff.
- Unedited checksums for reference: `src/app.js` = 952cfc6d5df8af331f5eabe615e623d3.

## Where this could go — the pages a real performance needs (31 Oct 2026)

Written down so the direction is not lost. Today the app plans a performance: paths,
positions, timing, scenery cues, props. If we ever want to *watch* a performance
rather than read a plan, the show also needs things to look at — what the props are,
what the dancers are wearing, what is painted on the drops. That is four more pages,
and none of them change how the timer works.

1. **Props workshop** — build a prop instead of choosing a rectangle. Parts the
   dancer can be seen to hold, a footprint, a colour or drawing, saved to a library
   and reused across shows. Everything else about a prop already exists: stations,
   carrying, hand-offs, its track row.
2. **Costume library** — choose an existing costume or create one: colours,
   silhouette, maybe a few pieces (tutu, tunic, cape). Saved, named, reusable, and
   shareable between shows the way a prop library would be.
3. **Dressing the performers** — put costumes on the cast, per dancer, and eventually
   per part of the show, so a dancer can change between numbers. A change mid-show
   would reuse the cue mechanism that scenery uses now.
4. **Drop studio** — design the cloth itself: a painted backdrop, layers, or an
   imported image, sized to the drop. Drops already exist as coloured bands with an
   id and their own cues, so this replaces the colour rather than the plumbing.

**Order that costs least**: drops first (a drop is already a flat thing with a
colour), then props (the workshop only replaces a rectangle that already moves,
carries and is handed over), then costumes. Costumes are last because they ask a
question the plan view has not answered: seen from above, a costume is invisible. So
either the stage gains a second view — a side elevation, or an isometric corner —
or costumes are reduced to colour and silhouette in plan. That decision comes before
any costume code is worth writing, and it is the same decision an animated
performance would force anyway.

**What it would cost**: not a week. Each page is a data model of its own (parts,
layers, palettes) plus a drawing surface, plus somewhere to keep the library, which
today means the show file and later means real files on disk. Worth doing in the
order above, one page at a time, each usable on its own — the way props and cues
were added.

**What to protect while building them**: the show file stays the single source of
truth, every appearance change stays optional (a show with no costumes and plain
rectangles must still open and play), and nothing in a drawing page is allowed to
touch stations, holds, pauses or cues.

**Update, 1 Nov 2026**: costumes and dressing are built, and the second view the
argument above waited for turned out to be the elevation that already existed — a
costume is invisible from above but perfectly visible from the house. See *Green room*
below. Props and drops are still notes only.

## Cloth: how it works now (31 Oct 2026, end of day)

Curtains and drops are no longer fixed scenery. Each has its own **Width** (how much
of the opening it masks), **Across** (metres from centre, kept inside the opening),
**Depth** (metres from the downstage edge) and **Height**. A drag on the plan moves
a piece in both directions; a depth change pins it where you let go, choosing a layer
again releases it. A drag lands on the floor grid (whole steps, Alt for free) and the
readout above the band says `grid` or `free` while it moves.

Where it still stops: a curtain's legs are the cloth either side of the opening, so a
narrow border reads as a tab but not as a leg with its own masking; nothing measures
whether two pieces of cloth overlap in depth; and the elevation picks the front-most
piece at a height rather than drawing true occlusion between adjacent bands.

## Acts: one clock, cut into acts (31 Oct 2026, evening)

Acts are in. The decision that matters is **one continuous running order**, not a
separate stage document per act: the set, the cast, the props and the cue numbers all
continue through the evening, so an act is a stretch of the same clock and an interval
is a pause at the boundary. Each act owns a *length*, not a start time, so acts cannot
overlap or leave gaps.

- Tabs above the stage switch act: the playhead jumps to that act's first moment and
the timeline scrolls there. The lit tab follows the playhead while playing.
- **Running order** in the left panel names each act and sets its length in seconds.
- The timeline draws the running order as a band across the top of the ruler, with a
dashed boundary through the tracks.
- The clock reaches the end of the last act even when it holds nothing yet, so a new
act is a place to work before there is work in it.
- Adding an act appends it after the last one. Only an empty last act can be removed:
cutting one that holds work would slide every later station, cue and hold earlier.
- A show saved before acts existed loads as a single Act 1 long enough to hold what it
already had, so nothing moves on the clock.
- On paper: the plot sheet carries the running order and the act count, the cue sheet
names each cue's act, and the elevation's moment list offers the top of each act.

**Scenes** are named moments inside an act. A scene owns an offset from its act's
start and runs until the next scene or the end of the act, so a scene is only ever a
label: renaming, moving or cutting one cannot move a station, cue or hold. The row
under the act strip lists the lit act's scenes; **+ Scene** marks one at the playhead;
Running order edits each name and start (seconds into the act); scene starts are
notched in the timeline's act band and each notch is a handle you can drag (with a
readout naming the scene and its landing time while you drag); clicking a scene chip
jumps the playhead to it. A shorter act pulls its scenes back inside it.

A dragged boundary is clamped to its own act, and it refuses to land within half a
second of another scene rather than creating one that normalise would quietly delete
on the next load; the refusal says so over the stage. Scenes at the very top of an
act are drawn a pixel inside the act's start line, or the act boundary would cover
the handle and leave it grabbable nowhere. On paper the running order indents scenes
under their act, the cue sheet says which act and scene a cue falls in, and the
elevation's moment list offers the top of every scene.

Not built yet: separate stage states per act — deliberately, since one set is what a
stage actually has.

## A run-through is a mode, not a second page (31 Oct 2026, late)

**▶ Watch** hides the editor and plays the show from the top. It is deliberately not
`watch.html`: the clock, the pause markers, the end-of-show rule and the music are the
ones the editor already uses, so a run-through cannot behave differently from the show
it is supposed to be. A second page would have meant a second `advance()` and a
second music engine to keep in step — exactly the kind of drift this project keeps
paying for.

What changes in watch mode:

- `body.watch` removes the header, both panels, the act and scene strips, the
  transport and the timeline; the plan and the elevation take the whole window
  (roughly 0.9 : 1.25, house view larger), and a fixed bar offers play/pause, restart,
  the clock, fullscreen and *Back to editing*.
- `state.ui.watch` makes the stage and elevation pointer handlers return immediately,
  so a click cannot select, drag or delete anything mid-show. Verified: clicking the
  stage left the saved selection untouched.
- Collisions are skipped entirely while watching. They are a choreography warning, and
  stopping the show in front of an audience because two dancers overlapped is not what
  a run-through is for.
- Escape, Space and the bar's buttons all work; leaving restores the editor at the
  moment you stopped rather than throwing the playhead away.

Two layout traps, both from the same mistake: a `display:none` child stops being a grid
item, so zeroing its *track* does not keep the remaining children in their places. The
body's hidden header pulled `main` into the first (0 px) track, and the hidden act and
scene strips pulled the two canvases into theirs. Both now count only the children
that are left in flow.

One engine fix came out of this: `music.play()` anchored the clock *after* awaiting
`ctx.resume()`, so for a frame or two a running engine reported a stale anchor, which
read as a huge drift and threw the playhead (it landed on the pause marker at 11 s on
the first attempt). It anchors on the wall clock immediately and hands over to the
audio clock once the context is running, continuing from the wall's idea of the time.

Checked in watch mode: the chrome measured 0 × 0, the canvases filled 1223 × 393 and
1223 × 545, and a four-second curtain cue visibly opened in both pictures — the
elevation's curtain pixels fell 266 304 → 143 664 over the first two seconds while the
clock read 0.320 s → 2.250 s. Restart took the show back to the top, play-through
paused at the 0:11 pause marker, and Escape returned the header, transport and timeline
to their normal sizes.

## Saying what the cloth is doing (31 Oct 2026, late)

A cue-driven curtain looked manual in the panel: its slider is the piece's state
*before its first cue*, and it never moves while a cue runs, so watching the panel
during playback suggests nothing is happening even when the stage is moving. Fixed by
showing the state rather than only the control:

- A **now** row under the slider or select reads `61% open · moving`, `open`,
  `closed`, `hanging`, `flown out`, `42% in` — computed with the same
  `sceneryStateAt` the stage and the printed elevation use, so the panel cannot
  disagree with the picture. `· moving` appears only while a cue with a duration is
  part-way through.
- Once a piece has any cue, its control is labelled **Start** (with a tooltip saying
  "before its first cue"), and reverts to `Open` / `Hangs` if every cue is removed.
- `updateTransport()` rewrites the `[data-live]` text every frame, because the panel
  only rebuilds when it is marked dirty; otherwise the row would be stale during
  playback and scrubbing.

Checked against a 0→100% cue over four seconds: 2.000 s read `61% open · moving`,
6.800 s read `open`, and the start of the move read `23% open · moving` — matching the
61% the printed elevation reported at its halfway moment.

## Editing a cue where it lives (31 Oct 2026, late)

Scenery cues could be created and deleted but not changed, which meant a 1.5-second
fly that should take four seconds had to be rebuilt from scratch. The fix follows the
idea that the band *is* the cue: `state.ui.cueId` names the picked cue, and picking
happens either by clicking its band or its row.

- **Picked cue.** Its panel row opens into a select for the action (`open / half open
  / close` for cloth, `fly in / out` for a drop) and a number for the seconds, and the
  band draws in accent with a grip at each end.
- **The ends are handles.** Dragging the right end sets the duration, the left end
  moves the start and holds the finish (so dragging the left edge changes the length),
  and the middle slides the cue in time. The body drag is now relative to where the
  band was grabbed; it used to snap the cue's start under the pointer, which was
  tolerable for a click-drag on a band but obvious next to real edge handles.
- **Nothing changes on a click.** The undo step is only committed on the first move of
  a cue drag, so picking a cue does not fill the history with no-ops.
- Picking a cue does *not* change the object selection: the cue's controls live in the
  scenery list, which is always on screen, and the inspector is for performers and
  props. That also avoids showing a cloth piece through the dancer inspector.
- `updateCue(item, id, patch)` in the model is the one place that clamps (`at` and
  `dur` ≥ 0, `open`/`fly` in 0–1), swaps a curtain's `open` for a drop's `fly` rather
  than keeping both, and re-sorts the list — `sceneryStateAt` reads cues in order, so
  a retimed cue that overtakes its neighbour has to move in the array too.

Checked with a close cue retimed to open over four seconds: the panel fields followed
both edits, the right end stretched it to 6 s, the left end moved the start to 1.033 s
and left the finish at exactly 6 s, the middle moved it +1 s without changing its
length, and the printed elevation at the halfway point read **61%** — the halfway
value of 0.22 → 1.0.

## Narration (built) and the projector (queued) — 31 Oct 2026

Two features asked for together. **Narration is built**; the projector is still queued
below, unchanged. Both are the kind that look like "one more track" and are not: each
brings a media type the show file cannot hold, each needs a surface the planner does
not have, and both have to survive the rule the whole project is built on — *the show
file is the single source of truth, and every media file is a cue that survives its
file being missing*.

### 1. Narration — built

**What actually exists** (the design notes under it are kept as the record of intent,
and the differences are listed at the end):

```
show.narration = [ { id, key, name, at, length } ]     // flat list, content time
show.trackVis.narration = true                         // the row's eye
```

- **Recording** is `getUserMedia` + `MediaRecorder`, cut into 250 ms slices and stopped
  by the same button. It records, then decodes the result for the length and peaks.
  Where it lands is read **when the take begins**, not when it ends: a two-minute take
  must still sit where the narrator started. `+ Voice file` is the same path with a
  file already on disk.
- **Where it lives:** the section is in the **Performers** pane, under Props, not
  beside the music on the left. A voice is performed, and the left pane was already
  the longest one on screen. The timeline row still sits with the music rows, because
  that is where sound belongs.
- **One row, many bands.** `drawNarrationTrack` splits the row into as few lanes as
  will hold the clips, so a recorded line under a live one is visible rather than
  hidden; a single clip takes the whole row.
- **Playback** is `src/narration.js`, riding the music's `AudioContext` so there is one
  clock. Each sounding clip keeps a source, an anchor time and the offset it started
  at; every frame compares where it *should* be (`playhead − at`) with where it is, and
  restarts it beyond 250 ms — which is what makes a scrub, an act jump or a dragged
  band land in the right part of the take instead of from the top. It stops with the
  show: paused, stopped, on a pause marker, or with the row's eye.
- **Overlap is allowed** (see the differences below): the list says which pieces speak
  over each other.
- **Removal keeps the recording.** A take cannot be got back from disk, and undo is how
  most removals are reconsidered, so `removeNarration` deletes the cue and not the
  bytes. The trade is a little unused audio in the browser; the alternative is an undo
  that restores a silent cue.
- **Paper**: the cue sheet gains `Narration · line plays` with the line's own length in
  the length column (`1.5 s`), and the facts count the lines and their total time. It
  printed as a "cut" at first, which said a spoken line ends on the beat; the length
  column is where every other duration on that sheet lives, so it went there.
- **Storage**: `src/audiostore.js` now holds the one IndexedDB store both features use
  (`choreographer.music.v1`, `music-…` and `voice-…` keys), so new media types do not
  re-implement it again.

**Where this differs from the notes below, and why:**

- The fields are `at`/`length` on a flat list, not `{clips:[{start,…}]}` — it reads
  like the music list and needs no migration.
- **Clips may overlap.** The note said refuse them. Refusing makes a ruled line under a
  recorded one impossible, which is an ordinary thing to want on a stage; instead the
  lanes show it and the list names the piece it collides with. A wrong overlap is now
  visible in two places rather than blocked in one.
- **No ducking, no text clips, no narration-only page** yet: those are the parts still
  queued (see the top of the README's *Not built yet*).
- Cancelling a *spoken* line mid-word is not an issue here, because a recorded clip is
  stopped by stopping its source.

#### The original design notes

A **Narration** section beside Music, and a narration row on the timeline that holds
any number of spoken clips rather than one file. Each clip is a moment, not a track:
the narration is delivered in pieces around the dancing, so the row carries many short
bands with gaps between them.

**Model** (mirrors the music list, but one row, many clips):

```
show.narration = {
  clips: [
    { id, start, length, kind: 'file' | 'voice' | 'text',
      key, name,                       // recorded or imported audio
      text, voice, rate, pitch }       // spoken from the show's own text
  ]
}
```

`start` and `length` are content time like everything else, so a pause marker holds
narration with the show and a hold does not touch it. Audio lives in IndexedDB beside
the music (`choreographer.music.v1` with a `voice-` key prefix) and the show keeps
only the cue; a clip whose bytes are missing prints and lists exactly as it is, with
its text intact — the same bargain the music tracks already make.

**Two ways in, and they are not the same thing:**

- **Record** uses `getUserMedia` + `MediaRecorder`, then decodes the result to get its
  length and a waveform. This is a file, with a real duration, and it behaves like a
  music clip.
- **Speak** stores text and speaks it with `speechSynthesis` at the cue. The trap is
  duration: the browser decides how long a sentence takes and will not tell you
  beforehand, and its output cannot be captured to a file in any reliable way. So a
  text clip's band is an **estimate** (words ÷ rate) and must be drawn as an estimate —
  a dashed band, with the text in its label — and the real duration recorded the first
  time it is spoken, so the estimate improves for every play after that. If the text
  changes, the duration is an estimate again.

**Rules worth deciding now:**

- Clips must not overlap. A second clip starting inside the first is a warning at add
  time, not a silent cut, because narration cut in the middle is an audible mistake.
- Music **ducks** under a narration clip — an automatic level drop of a few dB with
  ramps at both ends, derived from the clip's span, so it needs no cue of its own. It
  is a display, though: the duck must never make the music silent without saying so,
  and turning it off must leave the music exactly as the fades left it.
- Cancelling is part of the contract: pause, scrub or leaving watch mode must stop an
  utterance mid-word, and seeking into the middle of a text clip starts it at the
  beginning (there is no "seek within a sentence"), so the band should say so.

**Paper** is where narration pays off first: the cue sheet gains a **Narration** kind
with the clip's line printed under it, so the rehearsal copy is also the script. A
narration-only sheet (every clip, in order, with its time) is the natural fifth page.

**Must not break:** the master clock stays the audio context. A text clip spoken late
must not drag the show; it starts when the clock reaches it and is cancelled when the
clock leaves it.

### 2. Projector and screen

A **screen** is a drop you can fly like any other — same stack, same depth, same
width — with a video attached and played onto it. The change of scene around it is one
automatic thing, because that is the part the choreographer should not be hand-placing
six times.

**Model:** the screen is ordinary scenery, so the stack, the fly cues and the elevation
all keep working:

```
screen = { kind: 'drop', screen: true, ...existing drop fields }
show.videos = [ { id, key, name, length } ]        // bytes in IndexedDB
show.changes = [
  { id, at, curtain, out: [ids], into: [ids], video, lead, tail }
]
```

**The decision that matters: expand, don't hide.** A change is stored as intent, and
the cues it implies are ordinary scenery cues on ordinary rows, derived from it. The
timeline shows every real move, the printed sheet calls them like any other cue, and
nothing depends on a mechanism you cannot see. Deriving them is also what makes the
requested behaviour work: when the video's length changes, the closing cues move with
it, because they are computed from `at + lead + video.length + tail` rather than typed.
Stored intent plus derived cues is the same pattern acts and scenes already use for
their boundaries.

**The sequence, as asked:**

1. main curtain closes over `curtain` seconds — always first, so the crew works unseen;
2. the front drop(s) fly out (over `lead`) and the screen flies in;
3. main curtain opens; the video starts exactly when the opening finishes, not when the
   change began;
4. the video plays to its end (its own length, not a typed one);
5. main curtain closes again;
6. the stage resets behind it — screen out, next drop in;
7. main curtain opens on the new scene.

Step 5–7 are the "return to the next state" the request describes; they are computed
from the video's length, so nothing has to be retimed by hand.

**Sync:** the video follows the playhead, never the other way round — the audio context
is still the master. Each frame the player is asked for `currentTime`; a drift beyond a
few tens of milliseconds is corrected by seeking, small drift by nudging play-rate, and
pause markers pause it with the show. Autoplay rules mean the element must be muted
unless the user has interacted; watch mode is entered by a click, so sound is allowed
there, and a **video sound** switch routes the element through the same gain as the
music so the fades and the mute apply to it too.

**The surface problem — decide before building.** A projected picture cannot be drawn
on a plan view and can barely be drawn in the current side elevation. Showing the video
properly needs a **house view**: a perspective (or at least a frontal) picture of the
opening with the screen quad in it. That is the same "second stage view" the costume
notes already say has to come before dressing performers, so it is the natural next
step after this pair — and it is worth doing once, properly, rather than faking video
on the elevation.

**Storage:** a video file is tens or hundreds of megabytes, far beyond what the music
budget assumes. IndexedDB holds it, the show holds the cue, and the panel should say
the size before it is attached. Export never includes bytes; an imported show lists the
video as *file missing* and the change still plays with a black screen and its cues
intact.

**Must not break:** the change must degrade to plain cues if the video is missing — the
curtain still opens on the new scene at the computed time. And the change must never
run backwards: seeking into the middle of a video is a seek, not a restart of steps 1–4.

### Order, and the questions to settle first

Narration first: it reuses the music engine, the IndexedDB store, the row drawing and
the cue-sheet code almost as they are. The projector needs the house view and a
composite-cue primitive, so it is the bigger of the two and should follow the view.

Four things to settle before either is built, because each changes the model:

1. Does the curtain stay **closed while the video plays**? (The request says close
   before setting the drops and before running the video; the sequence above reads that
   as *closed while the stage is set, open for the video*.)
2. Does the video have **sound of its own**, or is all audio narration and music?
3. Should narration **duck the music** automatically, and by how much?
4. For typed narration, which **voice** — the system voice on this machine, or a
   chosen one per clip, noted in the show so another machine speaks it as closely as
   it can?

## Trimming a track without losing the file (31 Oct 2026, night)

A track that runs into the next one needs to be cut short, and the obvious way —
overwriting `length` — is wrong: `length` is how long the *file* is, and the panel,
"replace" and the missing-file report all depend on that number. So a track has two:

- `length` — the file's own duration, written when the audio is attached.
- `play` — how much of it sounds from the entry point. Absent means the whole file, so
  every show written before this change keeps playing its track to the end.

`musicSpan(t)` is the single rule (`play` if present, capped at the file), and it is
what `activeMusicAt`, the timeline band, the running-order warning and the printed
sheet all read. The engine repeats the same two lines when it schedules a source, and
passes the span to `start()` as a duration — so a trim is sample-accurate instead of
waiting for a frame to notice the track has ended.

- **plays** is the field; **end here** reads the playhead, so trimming is: put the
  playhead where the music should stop, press it. It names the moment it landed on, or
  says so if the playhead is before the track starts and nothing would play.
- **The band's right end trims too** (added later the same day, because typing a number
  for a musical end is the wrong instrument). `musicEdge` decides whether the pointer
  is on the end — two bright bars are drawn there so the handle can be found — and the
  drag sets `play` in tenths of a second. It clamps to the file's own length and to a
  floor of 100 ms: a zero-length span would leave the track neither playing nor ended.
  A readout above the band while it is held says `plays 0:22.0 of 2:45.5`, and the
  source is only restarted on pointer-up, so trimming while the show runs does not
  stutter the music under the hand.
- **The left edge still slides the track.** Both edges are not handles: the band moves
  as a whole from anywhere but its last few pixels, which is how the entry point has
  been dragged from the start.
- A trimmed track ends in **silence**: an earlier track does not resume, because you
  chose the change of music at that point. This is worth knowing, not a bug.
- **replace** resets `play` to the new file's length — a trim belonging to the old
  audio would otherwise silently cut the replacement short.
- The waveform takes the first `play / length` of the stored peaks rather than
  stretching the whole file across the shorter band, so what is drawn is the part that
  sounds.

Checked on a 4 s test track placed at 20 s: it arrived with `play` 4000 and the field
reading 4; with the playhead at 22 s, **end here** set `play` 2000 and the field 2, the
hint said `now ends at 00:22.000`, and `activeMusicAt` gave the track at 21.9 s and
null at 22.1 s. Playing from 20.4 s with the trim at 21 s: a live source at 20.62 and
20.85 s, none by 21.08 s, `music.track` null, and the show still running — so the audio
stops at the trim and the clock does not. The cue sheet gained
`5 0:21.0 … track ends (trimmed)` in running order. The test track was then removed,
with its stored audio.

## Music is a list, not a track (31 Oct 2026, night)

One audio file per show was the wrong shape: a real evening is a prelude, a change of
mood, a song, a finale, and the panel had a single row with **replace** on it. The
model is now `show.musicTracks`, a sorted list of `{id, key, name, start, length,
level, visible, cues}`, and the panel edits it exactly like the cast.

- **Migration, not conversion.** `normalise` takes an old `show.music` object and makes
  it the first entry, so the existing show kept its track, its entry point and (later)
  its fades. The stored show no longer has a `music` key; `delete out.music` after
  reading it means a re-save cannot resurrect a second copy.
- **The list is the running order.** `activeMusicAt(show, ct)` is the last track to
  have started that has not finished, so "what is playing" is read off `start` and
  `length` rather than a pointer that could disagree with them. That is also why
  moving an entry point re-sorts: the order *is* the answer.
- **The engine follows the playhead**, not the panel. `music.sync(track, showMs,
  playing)` runs every frame: a different track stops the old source and boots the
  new one, the same track with no source restarts it, and no track stops it while the
  show's clock (the audio context) keeps running through the gap. A switch decodes on
  demand and keeps two decoded tracks cached — a five-minute stereo track is over
  100 MB of floats, so caching the whole evening would not fit.
- **Every row draws its own waveform** from the `peaks` array stored with the audio at
  attach time, because the truth about a track you have not played yet is in that
  array, not in the one buffer the engine holds.
- A new track starts **where the playhead is**, read when the file picker opens rather
  than when the file finishes decoding — choosing a file takes time and the show may be
  running, and a track that landed "at the playhead" two seconds late would be wrong.
  It snaps to 100 ms so the starts field shows a number a person would type, and the
  stage hint names the moment it landed on. `addMusicTrack` still falls back to the end
  of the running order when no start is given, which is what an imported show means.
  **starts** or dragging the waveform moves it after the fact. The eye mutes one track;
  × removes the track *and* its stored audio.

Checked on the real show: it loaded as one track (name, 0:00 entry, 2:45.504 length,
level 1) with `music` gone from storage and the row drawing its waveform. A generated
3-second WAV was attached through the file picker: it joined the list at 165.504 s,
and a second one attached at a 12 s playhead joined at exactly 12 000 ms, taking over
from that moment (11 s still had the first track sounding, 12.1 s had the new one) —
the playhead is read at the picker, so a slow decode cannot shift it. The hint named
the moment (`Added finale.wav at 00:06.000`, matching the transport clock, which is
content time, not the ruler's display time). When its entry was set to 20 s the engine,
playing from 19 s, held
`pardeeppatel…` at 19.0–19.9 s and switched to `test-second-track.wav` at 20.2 s with a
live source the whole way; past its 23 s end the engine dropped the source and set
track to null while the show kept running (22.9 → 23.5 s). The printed cue sheet listed
`1 0:00.0 … track enters` and `3 0:20.0 … track enters` among the holds and the pause,
and the header line named both tracks. Removing the test track took it out of the list,
the timeline and IndexedDB (only the original audio key remained).

A long filename also painted across the whole timeline from the row label; both the
gutter label and the in-row name are now trimmed and width-clipped.

## Fades are cues on the track's level (31 Oct 2026, night)

The music had one control — an eye that muted it — and a scene change needs the track
to come down and back up on cue. The whole feature is one number and one function:
`musicLevelAt(show, ct)` reads the track's base level plus its fade cues in time
order, exactly the way `sceneryStateAt` reads a curtain's, and everything else reads
*that* — the gain, the panel's **now** row, the printed cue sheet.

- **The level is derived, never accumulated.** No `fade()` schedule is pushed into
  the gain node; each frame sets the gain from the playhead. Scrubbing backwards into
  a fade, pausing inside one, or jumping acts all land on the right level for free,
  because there is no envelope to get out of step with the clock.
- **`setLevel` writes only when it has moved** by more than 0.004, so a still track
  is not seventy audio-param writes a second, and `muted` (the eye) stays separate
  from the fade level — hiding the row silences it whatever the fades say.
- **A fade flips when you drop it on the row**, like a cloth cue: a double-click where
  the level is up gives a fade out, where it is down gives a fade in. The panel's
  select is there for the in-between — *fade to half* under a piece of stage business.
- **The bands are cues you can retime**: click to pick, drag either end or the middle,
  double-click to remove — the same interactions the scenery bands have, sharing
  `updateMusicCue` for the clamping and the re-sort.

A layout bug fell out of adding the panel editor: a picked cue row (scenery or music)
put its time, select, seconds and button on one flex line, which squeezed the select
and the number to **28 px each** — present, clickable and unreadable. Both editors now
sit their controls on a second line under the time, and the fields measure 73 px and
58 px.

Checked with a 3 s fade out at 2 s while the show played with the audio context
**running**: sampling `state.ui.playhead` and the gain node together every 250 ms gave
`0.92/0.92, 0.83/0.83, 0.747/0.743, 0.663/0.66, … 0.046/0.046, 0/0` — the audible gain
following the fade to silence and staying there. A double-click at 6 s then made the
fade back in (`0 → 0.5 → 1` across 6–8 s), its panel row opened on `fade in` with `2.0`,
dragging its right end took it to 4 s, and dragging its middle moved it to 9 s without
changing its length. The printed cue sheet read `2 0:02.0 … fades out 4.0 s` and
`4 0:09.0 … fades in 2.0 s` in running order among the holds and the pause.

## Drops are a stack, not a pile (31 Oct 2026, late)

A change of scene is flown: the curtain in, the drop hanging in front of the audience
up and away, the next drop already waiting behind it. That only works if the drops are
physically arranged front to back, and they were not — `addScenery('drop')` gave every
drop `y = depth - 0.5`, so a second drop landed exactly on the first and neither masked
the other. The elevation also drew cloth at 0.85–0.9 alpha, which meant even a spaced
stack let the drop behind show through, and a closed curtain did not hide a fly.

- **New drops go behind the stack** (`dropStack(show)` is the list, front first), one
  `DROP_GAP` (0.45 m) upstage of the last. Authoring then reads in playing order: the
  backdrop you see at the rise goes in first, the one you change to goes in behind it.
- **When the stack reaches the wall**, it is walked 0.45 m toward the house to make room
  rather than stacking two drops on one pipe. This moves pieces the user already placed,
  which is why it happens only at the wall and never silently anywhere else.
- **Cloth is opaque in the elevation.** A drop that lets the one behind show through
  cannot hide a change, and a curtain at 0.85 alpha cannot mask a fly. The plan stays
  translucent: it is a diagram of positions, not a picture of the house.
- **The panel says what the stack means**: `flying this out reveals Drop 2`, or
  `Backdrop — forest hangs in front, so this one is hidden until it flies out`. Depth
  numbers alone do not tell you which way round that is.
- New drops take colours from a four-entry palette (`DROP_COLORS`) so two hangs of the
  same cloth do not read as one piece.

Checked by adding a second drop to the show: **Backdrop — forest** moved 7.5 → 7.05 m
and **Drop 2** took 7.5 m behind it with a different colour, and each row carried the
right note. A fly-out cue on the front drop at 2 s over 1.5 s, sampled in the elevation
at the middle of the opening: `#24506b` (the front drop) before, `#3a2f4a` (Drop 2) at
2.75 s and after — and with the sample taken lower in the opening at 2.75 s the same
frame still read `#24506b`, so the cloth is lifting past the point rather than fading.
With a curtain cue closing it at 1 s, the same moment read `#7b2d3b` — the curtain —
so the change is hidden from the house exactly as it would be on stage.

## A cloth row is a track you put points on (31 Oct 2026, late)

The timeline kept a row called **Curtain main** at the top that was left over from
before each piece had a track of its own. It had nothing behind it, so it drew as an
empty lane, and the only thing that made it appear at all was `addHold()` falling back
to `trackId: 'curtain'` when no track was selected — pressing **+ Hold** with nothing
picked quietly manufactured a row that could never move anything.

- The abstract row is gone, and `addHold` now says *pick the track first* instead of
  inventing one. A hold is a property of a row you can see: a dancer's, or the music's.
  Hold markers already stored against `curtain` by old shows are left in the file but
  never drawn, because there is no clock for them to hold.
- Every curtain and drop already had a row; the row is now the place the cue is made
  rather than only reported. Clicking an empty stretch selects the row and puts the
  playhead at that moment (a drag scrubs), because a cue's time is easiest to choose
  where you can see the piece; double-clicking drops a cue there.
- A new cue **flips** the piece: open becomes close, hanging becomes flown out, read
  from `sceneryStateAt` at that moment so a second double-click later in the show
  gives the opposite move. It lands at 1.5 s and is picked for editing immediately, so
  the select and the seconds are already open if 1.5 s is not what the move takes.
- The picked row draws a `+` at the playhead while no cue covers that moment, so the
  double-click is discoverable without a paragraph of instructions in the row.

A bug fell out of the same reading: picking a cue from its band had stopped working.
`onDown` returned early when the clicked row belonged to scenery (to keep the object
selection out of it), and the cue hit-test — `cueAt`, `pickCue` and the drag that
retimes it — sat *after* that return, so the bands were drawn, clickable-looking, and
inert. Clicking a row's band now hits the cue first and falls through to the scrub
only when the click missed every band.

Checked on a show with three pieces, no cues and no music: a click on the Main curtain
row at x=300 put the playhead at 4.133 s and lit the row; a double-click there made an
`open` cue at 4.133 s over 1.5 s (0.22 → 1.0), whose panel row opened with `open` and
`1.5` already filled in and whose **now** label read `22% open · moving`; clicking the
band left the playhead where it was; dragging its right end took it to 4.3 s; grabbing
the middle slid it from 10.8 s to 12.8 s without changing its length. A planted
`trackId: 'curtain'` hold no longer produced a **Curtain main** row, and **+ Hold** with
nothing selected added no marker and said *Pick the track to hold first*.

## Music: the track is the clock (31 Oct 2026, night)

One track per show, attached in the **Music** section of the left panel. The important
decision is that **the audio context is the master clock**: the playhead is read from
`AudioContext.currentTime`, not accumulated in animation frames. A frame counter drifts
against a real recording, and five minutes is long enough for the difference to show;
with the context as the clock, a late frame costs a moment of drawing and nothing else.
With no track attached the context still ticks, so there is one clock either way. If a
browser refuses to start the context (no gesture yet), the engine falls back to a wall
clock for that run rather than stopping the show.

`music.play(showMs)` anchors the clock and schedules the buffer **sample-accurately**:
before its entry point the source waits `start - showMs` seconds into the future; at or
after it, the source starts from `showMs - start` seconds into the recording. That one
line is what makes "start partway through" work in both directions: press play at 0 with
a cue at 5 s and the music enters at 5 s; press play at 8 s and it joins 3 s into the
piece. A pause marker stops the track with the show and, when the interval ends, the
track resumes at the show's new position — so an interval never slides the music out of
alignment with the dancing.

Two bugs that the testing found, both worth remembering:

- The resync rule ("if the audio clock and the playhead disagree by more than 400 ms,
the playhead was moved by hand") treated a *stalled frame* as a scrub. In a throttled
tab the app then froze the show and restarted the track every tick. The fix is to
tell the two apart honestly: if the drift equals the time that actually passed, the
clock simply ran on while the frame was late — catch up with it; anything else is a
moved playhead. The frame's clamped step (`Math.min(80, …)`) hides that elapsed time,
so the unclamped number is kept for the comparison.
- Stopping at a collision, and a pause marker that the playhead was dragged out of,
left the audio playing or the engine stopped. Collisions now stop the music with the
show, and a running show with a stopped engine restarts it at the moment it is
actually at, once per frame at most.

Storage: the bytes are in IndexedDB (`choreographer.music.v1`, one record per file,
keyed by an id the show's cue points at), because an audio file in `localStorage`
would blow the quota instantly. The show file keeps `{ key, name, start, length }`.
Peaks for the waveform are stored beside the bytes, so the row draws immediately on
reload and the decode happens behind it.

On paper: the cue sheet lists **Music · track enters** at its entry point, and the plot
sheet's facts name the track and where it starts.

## Paper: what prints now (31 Oct 2026, evening)

**Print plan** in the header saves the show and opens four A4 sheets, in this order:

1. **Stage plot** — the floor, wings, bays, wing legs, cloth at its depth and width,
   props, and everyone as the show opens, with metre rules, orientation and a scale
   bar. Below it, tables of scenery and props.
2. **Side elevation** — the same stage from the house at a chosen moment: the deck,
   the opening and a metre rule, every curtain and drop at its own height and fly
   state, and the performers at the stage's dancer height. Everything is clipped to
   the opening, so anyone in a wing or any drop flown out is named as out of sight
   rather than drawn outside the frame. Under it, a table of heights and flying
   (height, where each piece sits above the deck, its across and depth, and how open
   or flown it is) plus a cast key. Scenery numbers are squares, cast numbers are
   circles.

   The moment is picked in the paper view's bar: type a show time (`0:08.0` or plain
   seconds) or choose from the list, which offers the top of the show, every cue and,
   for anything that takes time, the moment it is done, and the end. The list and the
   address (`?at=8000`, milliseconds) keep the moment, so the same sheet can be
   reopened; the default is still 0:00. The plot and the paths stay at the opening —
   only the elevation moves.
3. **Paths** — one plan per performer with numbered stations, and their show times,
   ballet positions and positions.
4. **Cue sheet** — scenery cues, holds, pauses and hand-offs in running order.

Where it still stops: the elevation shows one moment, so two moments of a fly need two
printouts. Occlusion between adjacent depth bands is approximate, as in the planner.
Eyes are ignored: paper shows the whole cast. The paths sheet is longer than a page
when the cast is large, so it prints as two.

Print from the paper view's own **Print** button, with headers and footers off and
scale at Default; the sheets carry their own margins.

## The track menu: right-click on a timeline row (31 Oct 2026)

Asked for as "the appropriate tools for each track type on a right-click, so I could
choose what to do at that point and then drag to fine-tune". Built for the **timeline
rows only** — the stage keeps its right-click, which deletes a path point and
everything after it, and that gesture is too load-bearing to share.

**Why it is worth its weight:** the row had grown gestures that could only be found by
knowing them. Double-clicking an empty stretch of a cloth row *flips* the piece — a
closed curtain opens, a hanging drop flies out — and on a Music row it fades the music
the opposite way from where the level stands. Nothing on screen said so. The menu names
those, and adds the ones that had no gesture at all (end the track here, start it here,
station here, hold here, pause here, record a take here).

**How it is built:** `onContext` in `timeline.js` reads the row under the pointer and the
moment under the pointer (a tenth of a second, like every other placement), then
`menuItems` returns the entries for that row's kind with a `run` closure each.
`openMenu` builds a DOM panel, clamps it to the window, and `closeMenu` removes it.

Rules that keep it honest:

- **Every entry works through the playhead.** An action sets `state.ui.playhead` to the
  clicked moment and then calls the same command the transport or panel would
  (`addKeyAtPlayhead`, `addHold`, `addPause`, `addSceneryCue`, `addMusicCue`). There is
  no second implementation of "add a cue", so the menu cannot drift from the buttons.
  The few things that live in `app` (recording, the two file pickers, key/hold/pause at
  a moment) are exposed as small methods on `app` for exactly this reason.
- **Only what the row can hold.** A narration row has no fades; a dancer has no fly
  floor; a carried prop is offered a hold but not a station, because its path belongs to
  whoever carries it.
- **The right button does not also scrub.** `onDown` returns early for `button === 2`;
  before this a right-click moved the playhead *and* would have opened a menu.
- **It closes on anything else**: a press outside (captured), Escape, the wheel, or
  another right-click.
- **Nothing destructive is guesswork**: deletes only appear when the pointer is on a band
  or a station, and they name the moment they will remove. `commit()` runs before each
  change, so every entry is one undo step.
- **The menu does not replace the double-click.** Adding a fade with the menu is slower
  than double-clicking the row; the menu is for the things that had no gesture and for
  not having to remember which way a flip goes.
- **Lengths are settings, not constants.** A `tm-field` row above the actions feeds
  `show.prefs`: `The move takes 1.5 s` → `prefs.cueDur` (close/open a curtain, fly a
  drop) and `The fade takes 2 s` → `prefs.fadeDur` (fade out / to half / back in). Six
  fly cues of four seconds are chosen once, and a fade can be as long as the change of
  scene it covers. `0` is a **cut** in both cases — a piece that changes instantly, a
  level that drops on the beat — not a mistake, and the band's end can be dragged
  afterwards either way. The field does not close the menu when it is clicked, because
  it is part of the menu rather than an action: `menuOutside` only closes on a press
  outside the panel.
- **The timings live in the show, not the tab.** They started as module variables and
  that was wrong: a company reopens a file the next morning and expects it to fly and
  fade the way it was staged, on whatever machine is running the rehearsal. So they are
  `show.prefs`, written on the field's `input` (with `persist()`), carried through
  export/import, and defaulted by `normalise` — a show written before the fields existed
  opens at 1500 ms and 2000 ms, which are also the values the code used before.
- **A station already there** says so and focuses it (`There is already a station here`)
  instead of looking like the click did nothing — the refusal came from
  `addKeyAtPlayhead`, which quietly returns when a key is within 60 ms.

Checked with the built app, one row kind at a time: the music menu offered fades, ends,
starts, mute, replace and pause; "Fade the music out" put a 2 s fade at 4.1 s, selected
it in the panel and moved the playhead there; the band then offered "Delete this fade",
which removed it. "The track ends here" trimmed a track to 7.5 s. The curtain row's
"Close the curtain" made a 1.5 s cue; the dancer row offered station, hold, and — when
the pointer was on a station — continue and delete-from-here, and "Hold here" added a
1.5 s hold on that dancer at the clicked moment. The narration row offered go, remove,
record, attach and pause; "Remove this line" took the line and left its audio in the
browser, as the panel's × does. "Pause the whole show here" added a pause at 17.5 s from
a dancer row. Escape closed the menu, and a right-click left the playhead where it was.

Nothing in the user's show was left changed: the test cues, fades, trims, holds, pauses
and the test line were removed, the zoom and the playhead restored, and the two long
music tracks are untrimmed and starting at 0:00 and 0:06 again.

## Show settings: the lengths a cue is given (31 Oct 2026)

The two durations the track menu carried (`cueDur`, `fadeDur`) grew into four, and moved
somewhere visible. Once they were in `show.prefs` it was odd that the only way to change
them was to right-click a track and type into a menu, so the **Show settings** section
sits under Stage in the left pane: cloth cue, music fade, hold and pause, in seconds.

- **One place each, no second copy.** The section and the menu's `tm-field` rows read and
  write the same `show.prefs`, so a value set in either shows up in the other; there is no
  mirror to keep in step.
- **These are the only default durations in the app.** `+ Hold` and `+ Pause` in the
  transport used to hardcode 1500 and 2000; they now read `prefs.holdDur` and
  `prefs.pauseDur`, and the menu's "Hold here" note prints the number it will use. Existing
  markers keep the durations they were given — a pref changes what a *new* one gets.
- **Floors where a zero would be meaningless.** A cloth cue or fade of 0 is a cut and is
  allowed; a hold or pause of 0 is a marker that does nothing, so both the field and
  `normalise` hold those two at 100 ms. All four cap at two minutes.
- **Written on `change`, not on every keystroke**, so typing `1.5` does not commit three
  undo steps, and `commit()` runs first so the setting is one undo step like any edit.
- **They travel with the show.** `prefs` is part of the show JSON, so a file reopened on
  the rehearsal machine flies and fades the way it was staged; a show written before any of
  this opens at 1500/2000/1500/2000.

Checked: fresh fields read 1.5 / 2 / 1.5 / 2; setting cloth 4, hold 3 and pause 5 wrote
`prefs` 4000/2000/3000/5000; the curtain menu's field then showed 4 and its cue came out
4000 ms; the dancer menu's "Hold here" said `3 s` and made a hold of 3000 ms; "Pause the
whole show here" made one of 5000 ms; `+ Hold` and `+ Pause` read the same prefs. The
values were set back to the defaults afterwards, the test cue and markers removed by id,
and both music tracks are untouched (untrimmed, 0:00 and 0:06).

## Typing a hold or pause length (31 Oct 2026)

Markers were drag-only, which is fine for "about a second and a half" and useless for
"the orchestra holds for exactly four bars". Now a marker's band has its own menu:
right-click it and the first row is **The pause lasts** / **The hold lasts**, in seconds.

- **The marker wins over the row under it.** `pauseAt` is checked before the row, because
  a pause is drawn the full height of the tracks; `holdAt` then checks whether the pointer
  is on that row's hold band. So a right-click on a pause means the pause, not the dancer
  behind it — the same precedence `onDown` already gave a pause when picking.
- **One undo step per visit, not per keystroke.** The field writes on `input` (so the band
  redraws as you type), but `markerItems` commits only the first time, guarded by a flag in
  its closure. Typing `2.5` is one press of undo, and the snapshot is taken *before* the
  first digit, so undo lands on the old length.
- **A floor, because zero is not a marker.** `100 ms` minimum and two minutes maximum, the
  same rule `normalise` applies to the show's hold and pause defaults.
- **The band says its length.** A hold's row now prints `HOLD 1.8s` when there is room (it
  used to print just `HOLD`), matching the `PAUSE 2.0s` a pause has always shown, so the
  number is readable without opening the menu — and a drag shows its result the same way.
- **"Go to it"** puts the playhead on the marker's own moment, which is the other thing
  you want from a band you can see but not find.

Checked: the hold band on Bea's row opened as `Hold · 2. Bea · 00:08` with the field at
`1.8`; typing `3` set `duration` 3000 and one **Undo** brought back 1800. The pause band
opened as `Pause · 00:21` with `2`; typing `4` set 4000 and one undo returned 2000, with
exactly one commit counted for the edit. Both markers are back at 1800 ms and 2000 ms, the
drawing reads `HOLD 1.8s` and `PAUSE 2.0s`, and nothing else in the show moved.

## Drawing a hold or pause with a drag (31 Oct 2026)

Markers could be placed at a default length, dragged after, or typed after. Now they can
also be drawn: press in empty space on a performer's row and drag, and the band follows
the pointer with its length counted live (`HOLD 3.1s`), becoming a marker on release.

**Which marker, and where:**

- **A performer's row, plain drag** → a hold on that track. Nothing else lives in that
  space, so no gesture was displaced.
- **The Lights row, plain drag** → a pause. The lights row had no drag of its own, and a
  pause is show-wide, so it needed somewhere of its own that is not a dancer.
- **Shift + drag, any row** → a pause, checked *before* the bands, because a music track
  covers its whole row and a shift-drag on it would otherwise move the track's entry point
  (which is exactly what happened on the first attempt, and had to be put back).
- **Cloth and dialogue rows keep their plain drag for scrubbing.** Drawing a marker there
  is Shift only, so the scrub that row already had is not taken away.

**Rules:**

- **One commit, on release.** The band is drawn as a ghost from drag state — dashed
  edges, the length in seconds — so nothing enters the show until the pointer comes up.
  A press that never moved makes nothing: the span has to reach a tenth of a second.
- **Only moves with the button down count.** `e.buttons === 0` is ignored for a drag in
  progress; without that guard a mouse merely crossing the window stretched a band that
  was being drawn to 28.8 s — the stray move was mine, but the bug was real.
- **The row's empty space says so**: the pointer is a crosshair wherever a drag would draw
  a marker rather than move something, and the ghost's label names which marker it will
  be.
- Undo takes the whole drawn marker away in one step, since the commit happens before it is
  added.

Checked: a drag from 2 s to 5 s on Bea's row made `hold t=2000 d=3000` on her track; the
same row with a stray buttonless move aimed at 30 s still made 3.0 s from 00:03; shift-drag
across the first music band made `pause@8000 d=2500` and left that track's start where it
was; a drag on the Lights row made a 1.5 s pause at 12 s; a plain click made nothing; and
one undo removed each. All test markers are gone, the first track is back at 0:00, and the
original hold (1800 ms) and pause (2000 ms) stand.
## The end of the show is a marker (31 Oct 2026)

A pause is a hole in the clock; it never answered "when does this stop?". The clock did
stop, but at a length derived from the work — `endContent`, the last station, the last
cue, or the running order if that is longer — plus a second so the final picture can be
seen. That is the right default, and the wrong only answer: a curtain call, a blackout or
a button on the last chord ends the performance earlier than the last station does.

**What it is:** a marker like a pause, `show.markers` with `kind: 'end'` and a `t`, and
exactly one of it (`setEnd` moves the existing one rather than adding another; `normalise`
keeps the first and drops malformed extras from a hand-edited file). Because it lives in
the markers it travels with the show and is read through `displayOfContent`, so a pause
earlier in the evening does not shift the number it lands on.

**What it changes:** `endContent` returns the marker's moment when there is one, in both
directions — the show can finish before the acts do, and can also run past the last cue
into a marked but unchoreographed curtain call. That single function already feeds the
printed running time, the greyed-out ground past the choreography, the act-edit clamp on
the playhead and the stop rule in `advance`, so nothing else had to learn about it. In
`advance` the stop differs only in the second: a marked end stops on the moment itself
(that is the picture the last cue was timed to), an unmarked one a second later.

**Ways in:** `+ End` in the transport at the playhead; drag the red line (a tenth of a
second, like every other hand-placed moment); right-click it for **The show ends at** (in
clock seconds, which is what the ruler prints), "go to it", "delete the end"; or any row's
menu, which offers "end the show here" and says "instead" once one exists.

**Details worth keeping:**

- The line wins over the pause band it may cross — `endAt` is checked before `pauseAt` in
  both `onDown` and `onContext`, because the target is only a few pixels wide and the press
  can only have meant it.
- The rule is drawn inside the clipped track area, so it spans the tracks but not the
  gutter; the `END 00:30` label is drawn *after* `ctx.restore()` in the ruler strip instead
  of on the first row, where it sat over the opening music's waveform.
- Hatching past the line is cheap strokes in the same clip; the dark fill it lies on was
  already there for "past the choreography", so a marked end just moves where it starts.
- Print: `cueRows` skips `kind === 'end'`, or the cue sheet printed a second "Pause" row
  with no duration. "End of show" is already its own line, and the running time follows
  `endDisplay`, so a marked end prints the shorter evening without further work.
- Play on a finished show rewinds to 0 first (`play()`), because otherwise pressing play
  at the end is the same as pressing it in a room with the curtain down.

Checked on the real show: `+ End` at the playhead made `end t=26000` with `endContent`
26000 and the hint naming the moment; the printed plan then read "Running time 0:26.0"
with one "End of show" line and no phantom pause row. Dragging the line moved it to 21700
(content time clamps into the pause it crossed, then rounds to a tenth); the row menu's
"end the show here instead" moved it to 7500 and one **Undo** brought back 28000; the end
menu's field read `30` for a marker at display 00:30 and typing `30` set the content time
to 28000; playing from 27.95 s stopped exactly at 28000 with `playing` false and the hint
"The show ends here: 00:30.000"; pressing play again restarted near 0; "delete the end"
returned `endContent` to 30000 (the act) and the marker survived a reload until it was
removed. The test marker is gone, the original hold (1800 ms) and pause (2000 ms) stand,
the tracks are where they were, and the console stayed clean.

## The end takes the music down (31 Oct 2026)

An end marker stopped the clock by cutting the music, which is the one thing an audience
hears as a mistake. The ending is now a fade into the marker, so the clock stops on
silence.

**It is a property of the ending, not a cue.** `endFadeLevel(show, ct)` ramps 1 → 0 over the
last `prefs.endFade` milliseconds before the marker, and `audibleLevel(show, track, ct)` is
`musicLevelAt` times that. So moving the curtain call moves the fade with it, and a track
with its own fade out at the same moment is simply taken down twice rather than fighting.

**Where it is read:** one place — `music.setLevel` in the frame loop. The ramp is derived
from the playhead, so scrubbing into the last seconds hears it come down too, and the
engine's gain is already at 0 when `advance` stops the source, which is what makes the cut
inaudible rather than merely brief.

**Settings:** **End fade (s)** in Show settings, and **the music fades over** in the end
line's own menu — the same `prefs` value, so setting it in either place sets both. `0` is a
real answer here (the music stops on the beat) which is why this timeout has no floor,
unlike the hold and pause defaults. Old shows open at 2 s, like a fresh one.

**Drawn as a wash**, not a wedge: a gradient rectangle from end − fade to the line, colour
`danger` at 17% where it meets the line and nothing at the start. It reads as a fade
because it deepens towards the end, and at `0` it draws nothing at all, which is exactly
what a cut looks like.

**Two typos found on the way**, both in the same read of the level: `fadeLive` was calling
`musicLevelAt(state.show, playhead)` instead of `musicLevelAt(track, playhead)`, so every
music row's "now" read **full** whatever the fades said — and the double-click flip on a
music row used `musicLevelAt(show, at)`, so it always faded *out* however loud the track
was. Both now read the track they are describing; the row reads `silent` under a fade out,
and the flip fades up from a quiet track. The double-click deliberately keeps the raw
level, not `audibleLevel`, so the show's ending cannot turn a double-click into a fade up.

Checked on the real show with an end at 26 s and the fade at 2 s: `audibleLevel` gave 1 at
23 s, 0.55 at 24.9 s, 0.25 at 25.5 s and 0 at 26 s; played from 24.5 s with the gain sampled
live, `music.level` came down 1 → 0.56 → 0 and the clock stopped at 26 000 with `playing`
false, `music.running` false and the level at 0. Setting the field to `0` made the same
sampling read 1 right up to the end — a cut. Removing the end returned `endContent` to 30 000
and the wash disappeared; the `prefs` came back to 1500/2000/1500/2000/2000 after a reload,
the hold and pause are as they were, and the console stayed clean.

## The ending on paper (31 Oct 2026)

The cue sheet listed everything the booth calls except the thing they are waiting for.
With an end marker placed, `cueRows` now prints two more rows, in running order with the
rest:

- at `end − endFade`, the track that is sounding then: **Music · fades out for the end**,
  with the fade in the length column. `activeMusicAt` decides *which* track, so a show
  that changes music in its last minutes names the one actually playing. If nothing is
  sounding, or the end fade is `0`, the row is not printed — there is no fade to call.
- at the end moment, **Whole show · End · curtain call — the show ends here**, with `—`
  in the length column. The column prints `cut` for a zero duration, which would have
  been a lie here: nothing is moving, the show is simply over. Hence the optional `len`
  override on a row, used by `cuePage` before it falls back to `dur`/`cut`.

Only for a marked end. An implied end is a calculation from the last cue; printing it as
a curtain call would give the crew a decision nobody made. The cue sheet's note now
explains the `—` alongside `cut`.

Checked on the real show with an end at content 26 s (clock 0:28, after the 2 s pause)
and the 2 s fade: the sheet gained `5 · 0:26.0 · Music · fades out for the end · 2.0 s`
naming the second track, and `6 · 0:28.0 · Whole show · End · curtain call — the show ends
here · —`. With the end fade set to `0` the sound row disappeared and the curtain call
stayed. Removing the end marker returned the sheet to its five rows, the show's prefs to
1500/2000/1500/2000/2000, and the console stayed clean.

## The closing picture on paper (31 Oct 2026)

The plan printed the stage as the show opens and never the stage it ends on, which is the
one the crew stands behind a curtain for. `tableauPage` is a second plot — the same drawing
at the end moment — placed between the elevation and the paths.

**Making the drawing answer "when".** `cloth`, `props` and `starts` were all written against
moment 0 (`sceneryStateAt(item, 0)`, `propPosOfContent(show, s, 0)`, `posOfContent(show, d,
0)`). Each now takes a `ct` with a default of 0, and `starts` became `castAt` because it is
no longer about where anyone starts. The plot page passes 0 explicitly, so its behaviour is
unchanged by construction rather than by luck.

**Marked ends only.** Same rule as the ending's cue rows: an implied end is a calculation
from the last cue, so there is no tableau to print until someone puts the curtain call
somewhere. A show without one prints exactly the sheets it printed before.

**Worth knowing:**

- A performer whose path ended early still has a position (`posAtLocal` holds the last
  station), so they are drawn standing where they finished — which is the truth on stage.
  Only a performer with no stations at all cannot be placed, and the sheet says how many
  of those there are rather than leaving a hole unexplained.
- No paths on this sheet, deliberately: it is the stage as the house sees it. The paths
  pages follow immediately for how everyone got there.
- The cloth labels are the plot's own, so a drop at 40% in prints "(40% in)" at the curtain
  call too, which is the fact a flyman needs.

Checked on the real show with an end at content 26 s (clock 0:28, after the 2 s pause): the
document gained a sheet headed "Curtain call · 0:28.0" between the elevation and the paths,
with all three performers at their closing positions — the circle coordinates differ from
the opening plot's for all three (Ada 654,211 → 629,249; Bea 108,281 → 105,287; Cleo
418,109 → 380,109) — the three pieces of cloth, wing legs and the legend. Removing the end
marker removed the sheet and left the plot, elevation, paths and cue sheet as they were,
with the console clean.

## The scene card (31 Oct 2026)

The old way of saying "this is Act 1, Scene 2" was a person walking on with a board. It
is now a piece of scenery, and it is deliberately *not* a prop: it has a row on the clock
from the moment it exists, because bringing it on is a cue.

**Model.** `kind: 'card'` in `show.scenery`, with `text` (the words, 40 characters), the
usual `x`/`y`/`span`/`h`, and one state of its own — `shown`, 0 to 1. Cues carry `shown`
the way a curtain's carry `open` and a drop's carry `fly`, so `sceneryStateAt` interpolates
it with the same two lines as everything else and every existing reader (stage, elevation,
print, the panel's "now" row) got it for free. A card sits at 0.3 m — **downstage of the
main curtain**, between it and the house — because that is where a placard is held, and
because its words would otherwise be lost among the tabs.

**One extra rule, `clothThick(item)`** (0.5 curtain, 0.35 drop, 0.18 card). The plan, the
drag outline and the print each had `item.kind === 'drop' ? 0.35 : 0.5` written out, which
would have drawn a board as thick as a curtain and made its hit area miss. Now there is one
function, and a card is a board from above.

**Where it appears:** a pale band on the plan with its words on it (no name label — that
collided with the main curtain's, and the board's words are its label); a board standing on
the deck in the elevation, drawn opaque because that is the view the house has; the same in
a run-through, since that is the same canvas; a row on the timeline whose cues read
`CARD ON` / `CARD OFF`, with **bring on** / **take off** in the row menu and a flip on
double-click; and on the cue sheet as `Card · brings on “Act 1 · Scene 2” · 0.8 s`. It is
kept out of the heights-and-flying table, because it is not flown and a "from the deck"
number for it would be an invention.

**A card is not half on.** Its cue can take 0.8 s or 0 s and the drawing fades through the
state, which is the honest schematic for a board being walked on and off; the panel says
`off stage`, `coming on 40%` or `showing “Act 1 · Scene 2”`.

Checked on the real show: `+ Card` made a 1.6 × 0.9 m board at 0.3 m with `shown` 0 and
"Says" `Act 1`; the panel row showed `card · 2 cues`, the Says field, start on/off and
`now showing “Act 1 · Scene 2”` at 4 s; two cues (on at 3 s over 0.8 s, off at 8 s over
0.5 s) drew `CARD ON` and `CARD OFF` bands; the row menu offered **bring on** / **take
off** and placed a take-off at 10.8 s; a double-click at 18 s flipped it back on; the plan
at 4.5 s showed the band with its words, the elevation at `?at=4000` showed the board with
`Act 1 · Scene 2`, and the cue sheet printed `Card · brings on “Act 1 · Scene 2” · 0.8 s`
and `takes off`. The test card was then deleted from the panel, which removed it and its
cues; the show is back to its three pieces of scenery, the same hold and pause, and the
console stayed clean.

## Where everyone ends, in numbers (31 Oct 2026)

The curtain-call sheet showed the closing picture but not the numbers a crew writes on a
pad, so `closingTable` sits under it: cast number, name, closing ballet position, metres
across from the centre line, depth from the proscenium, and on stage or in which wing.

Two decisions in it:

- **The closing pose is the pose of the last station reached, not the last station in the
  path.** A performer whose walk ended at 0:20 is still holding whatever they finished on
  at 0:26, and `localOfContent` plus a filter on `k.t` picks that one. With no pose set the
  cell is `—`, which is what the station tables already print for "none".
- **"Where" is judged against the opening, not the floor.** Anything beyond half the stage
  width is in a wing and is named as such, which is how a stage manager reads the plot:
  a dot outside the arch is someone waiting, not someone performing.

Checked with an end at content 26 s (clock 0:28): the sheet listed `1 Ada — 7.8 2.6 in the
right wing`, `2 Bea — −8.6 1.4 in the left wing`, `3 Cleo — 0.0 7.0 on stage`; setting
Cleo's last station to Arabesque printed `Arabesque` in the pose column. The test pose and
the end marker were then removed, which removed the sheet again; the remaining four sheets
and the console are as they were.

## The clearance list (31 Oct 2026)

The last sheet of the curtain call is for the people who have to hand the stage back:
`strikeTable(show, ct)` lists every curtain, drop, card and prop with where it stands and
what it takes to clear it, front to back.

**The two halves of a row.** "At the call" is what the piece is doing at the end moment —
`hanging`, `flown out`, `40% in`, `22% open`, `held up — “Act 1 · Scene 2”`, `carried by
Ada`, `on its own path`, `dressing` — and "Clearing" is the move, or a dash when there is
nothing to do. The dash is deliberate in three cases: a curtain is the house's cloth and is
opened, not struck; a drop already out is already out; a card that is off stage is off. A
list that invented a task for those would teach the crew not to trust the column.

**Carried props.** `carrierNameAt` walks the hand-offs up to the end moment, so the prop is
listed with the person who actually has it and clears with them — not whoever picked it up
in Act 1. Its position comes from `propPosOfContent`, so a prop carried into the wing prints
the wing, which is where the crew will find it.

**Order** is front to back for cloth (the order it hangs) and then by depth for props, which
is how a stage is cleared without walking round the back of the next thing.

Checked with an end at content 26 s and two test props: the sheet printed `Main curtain ·
Curtain · 0.0 · 0.6 · 22% open · —`, `Tab legs · Curtain · 0.0 · 4.0 · 88% open · —`,
`Backdrop — forest · Drop · 0.0 · 7.5 · hanging · flies out`, `Lantern · Prop · 8.4 · 2.1 ·
carried by Ada · carried off by Ada` (Ada being in the right wing at the call, so the lantern
printed there with her) and `Chair · Prop · −1.2 · 3.4 · dressing · carried off`. The test
props and the end marker were then removed: the document is back to four sheets and the
console is clean.

## Signing the stage off (31 Oct 2026)

The clearance list was something to read; at the call it is something to work through, so it
now prints with an empty tick box per row and a ruled signature line under it — checked by,
stage manager, and the time the stage was clear.

**Paper, not screen.** The boxes are drawn by CSS (`.tick-box`, a hairline square in
`print.html`) rather than a character like ☐, because a glyph depends on the printer's font
and prints in whatever weight it feels like; a one-pixel border is the same on every sheet.
The tick column is 20 px wide so a pen has room, and the signature rules are 20 px tall so
there is something to write on. All of it is blank space on screen as well as on paper,
which is correct — it is a form.

Checked with an end at 0:28 and a test Chair prop: the table printed `✓ | Item | Kind | …`
with a 10 × 10 px box on each of the four rows, and under it the three rules reading
`checked by`, `stage manager`, `time the stage was clear`. The prop and the end marker were
then removed, which took the sheet away again; the other four sheets and the console are
unchanged.

## Lighting (31 Oct 2026)

Lighting was the last department the plan still had no answer for: the timeline held an
empty **Lights** row that nothing could be put on. It is now a list of lanterns, the way
sound is a list of tracks.

**What a light is.** A bottle hung over one spot on the floor: `x` across and `z` upstage
for where it lands, `h` for how high it hangs, `spread` for the pool it washes, a colour
and a standing `level`. That is deliberately a downlight — one position, one aim, no
angle — because everything the show needs to read at this stage is "is this spot lit, in
what colour, and how brightly". An aimed beam (a target point, a shutter, a gobo) is the
next step and would be two more numbers on the same object, but it also needs a
shadow-shaped drawing in two views to be worth having, so it waits. The note in
[README.md](README.md) under *Not built yet* says so.

**Level is the whole cue language.** A lantern's `level` is where it stands before its
first cue; a cue moves it to a new level over a duration, from wherever the previous one
left it. `lightLevelAt` is deliberately the same function shape as `musicLevelAt` and
`sceneryStateAt` — walk the cues in order, ease towards each, stop mid-move — so a light
halfway through a fade behaves like a curtain halfway through a fly, and scrubbing back
into a fade brings the brightness with it. Colour is not cued: swapping gel mid-scene is
a different lantern, and a show that lied about that would be wrong on the night.

**Handing a spot over.** A cue can carry `followId`: a performer's id to hand the spot to,
`null` to send it back to the lantern's own place, or the field absent to leave the aim
alone. `lightSpot` walks the cues in order and, while a hand-off is in progress,
interpolates between where the beam is and where the new target is — so the performer is
followed by a pan, not swapped like a slide. That is the difference between `null` and an
absent field, and it is why a cue can move the brightness and the aim at the same time:
`level` and `followId` are independent, and a cue with only `followId` leaves the level
untouched (`addLightCue` returns null only when a cue would do neither). Placing one is
the card's **Hand to** picker beside **hold level**, the picked cue's own **Hand to** row
("as it is" deletes the field rather than parking the aim where it already is), or the
row's right-click menu, which lists every performer on a follow spot's row. An imported
file that hands a spot to somebody no longer in the cast turns that cue into a release,
because the alternative is a beam panning to nowhere.

Checked with a spot on Ada at 80%: a hand-off to Bea at 5 s over 2 s read Ada at 0 s
(-8.5 / 1.6), mid-pan at 5 and 6 s, and Bea at 7 s and 9 s (0.8 / 3.21 then 0 / 3.5),
with the level 0.80 at every one of those moments — the cue moved the aim and nothing
else. The cue listed as `→ Bea over 2.0 s`, its band read `→ Bea`, and the row renamed
itself `Light 1 → Bea` past the cue. The test lantern was then removed.

**Types, gels and gobos.** A lantern has a `type` — `spot` or `flood` — and a `gobo`,
which is a template in the gate: open, star field, dapple, window. Type is not decoration:
a spot is drawn with a hot core and a rim you can point at, a flood with an even wash that
dies at the edges, and changing the type brings its usual pool (2.4 m, 6 m) with the Pool
field left to overrule it. The gels in the card are a strip of the colours a designer asks
for most, in front of the colour wheel, because choosing a colour at a tech is one click
or none.

A gobo is drawn where it lands: a golden-angle spiral scatters the stars evenly without a
random number that would flicker frame to frame, dapple is nine overlapping ellipses, and
window is a frame with two mullions — the shapes that read from across a room. The
elevation sees the pool edge-on, so the pattern becomes a line of marks along the deck:
panes, leaves, stars. It is a drawing of the gobo, not a simulation of one: no pattern is
thrown onto the cloth or the dancers, which is the next thing to do if the plan starts
being used to judge a look rather than to place a cue.

**Follow spots.** A lantern can be aimed by hand at one performer: `followId` names a
dancer, and `lightSpot(show, light, ct)` returns where the light actually is at that
moment — `posOfContent` for a follow, the lantern's own `x`/`z` otherwise. Both views
and the timeline label read it, so a follow spot is on Ada at 0:06 for all three without
three opinions. Three rules that fall out of it: the lantern keeps its own place while it
follows, so clearing **Follows** sends it back where it was hung rather than leaving it
wherever the performer happened to be; a performer deleted from the show releases the spot
that followed them (`normalise` does the same to an imported file); and a performer in a
wing is off stage, so no pool is drawn there — the elevation's clip already handled that
side of it. A follow spot also draws no marker on the plan: it sits exactly on the
performer, whose body is already the thing you click to select them, so a marker there
would only steal that click. Its row is named `Light 1 → Ada` instead.

**Two views, one truth.** The plan draws a radial pool under the floor's grid before
anything stands in it, and a small ringed marker on top of everything so the fixture is
always grabbable — a fixture that vanishes under a dancer cannot be dragged. The elevation
draws a beam from the bottle to a wash across the deck, after the bodies so the light falls
on them. Both read `lightLevelAt(light, playhead)` and `visible`, so they cannot disagree
about what the stage looks like at a moment, and the run-through gets the effect for free.

**Rows, not one Lights track.** Every lantern owns a row, the way every curtain does,
which means the cues have somewhere to go before there is a cue, and the row's eye is that
lantern's own blackout. This did cost the old Lights row its other job — dragging on it
drew a pause — so a pause is now made with Shift on any row or with **+ Pause**.

Checked in the browser: three lights added at 0, −3.12 and +3.12 m; pools and beams drawn
at the level the playhead was at; a double-click at 5 s and another at 9 s made `OUT over
2.0 s` and `80% over 2.0 s` and the brightness read `0.80 / 0.60 / 0.40 / 0.00 / 0.80` at
4, 5.5, 6, 9 and 12 s; dragging the first band's end retimed it to 3.9 s; editing that cue
to 25% over 1.0 s read `0.80 / 0.53 / 0.25`; the right-click menu put an `out` cue where
the pointer was with **the change takes** at 2.0 s; the panel's **Add at** placed 25% over
3.5 s; the row's eye dropped the pool pixel from `(187,169,135)` to `(61,65,58)`. The three
test lanterns were then removed and the show is as it was: three dancers, three pieces of
scenery, no lights, console clean.

## The lighting sheet (31 Oct 2026)

The booth gets its own page, and it is two lists that belong together: the rig, then every
light cue in one running order across the whole rig rather than one column per lantern.

**The rig first**, because that is what a crew works from before a single cue is called: a
number, the lantern's name, whether it is a spot or a flood, the gel, the gobo, the height
it hangs at, the pool it washes, where it is hung in metres across and deep, the performer
a follow spot is on, and the level it stands at before its first cue. The standing level is
in that table on purpose — a lantern that never gets a cue still has to be set before the
house opens, and its first cue says `to 45%` rather than `45%`, which only makes sense if
the paper says what it was at before.

**Then the cues**, sorted by time across all the lanterns. Each row repeats the gel and the
gobo even though neither can change inside a cue today: a cue sheet page gets photocopied
and carried to the desk on its own, and a row that says `Spot 1 · straw · open · hand to
Bea` is a complete instruction. When colour or gobo changes do become cueable the column
is already there rather than needing to be added later.

**Gels are named, not coded**, because a booth says "straw" and not "#ffd27a".
`GEL_NAMES` sits beside `LIGHT_GELS` in the model so the two cannot drift apart, and a
colour mixed on the wheel — which has no name — falls back to its hex code, which is the
only honest thing to print for it.

**A cue says what it does, not which field changed**: `to 45%`, `out`, `full`, `hand to
Bea`, `hand to its own place`, or both joined with a comma (`to 60%, hand to Cleo`). A
hand-off with no length prints `cut` in the length column, because the beam jumps instead
of panning and "0.0 s" would read as a pan that had been timed badly.

**No lanterns, no sheet.** A blank Lighting page in a printout invites the question of
what it was for, and a show with no lights has nothing to say to the booth.

Light cues also went into the elevation's moment list, so a hand-off can be looked at
half-way through its pan and at its arrival, not only at the start.

Checked in the browser on a two-lantern test show: the rig printed `Spot · straw · open ·
6.2 m · 2.4 m · −2.0 across, 3.0 deep · 80%` and `Flood · daylight · star field · 5.4 m ·
6.0 m · 1.5 across, 4.2 deep · 60%`; five cues printed in time order (`0:04.0 to 45% over
1.5 s`, `0:09.0 hand to Bea over 2.0 s`, `0:12.0 Wash out cut`, `0:18.0 Wash full over
0.5 s`, `0:19.0 Wash hand to its own place cut`); the swatches carried the right colours;
the tables fitted the A4 width with no overflow; and eight light moments appeared in the
elevation picker. The test show was cleared afterwards and the console was clean.

## One metre, two drawings (31 Oct 2026)

The plan and the elevation were each fitted to their own pane, which meant they were
pictures of different rooms: the plan is 12 m of floor plus 4 m of wing each side, the
elevation is the same 12 m opening, so fitting each one to the same width drew the opening
larger than the floor it stands in front of. A fully open curtain then had its legs inside
the floor edges above it, and reading a fly-out against the plan was guesswork.

**The scale is chosen for the pair, not for each view.** `fitViews` in `app.js` measures the
centre column once, picks the scale that fits both drawings at that width and height, and
writes the stage row's height from it; the rest is left to the elevation. `state.ui.viewScale`
is that number, and both views read it — the plan for its 24 m of floor and wings, the
elevation for its 12 m opening. The two rows are sized from the container rather than the
views measuring each other back, so there is no feedback loop, and the pair is cached on a
key of the column size and the stage's own dimensions so a resize is the only thing that
recomputes it.

**Fallbacks stay.** The run-through keeps the plan filling the window (`compact`), and the
elevation falls back to its own fit when no shared scale exists, so a watch-mode frame or a
first paint before the column has a size still draws something sane.

**The run-through follows the same rule.** It has no shared scale — the plan takes the
window there — so the elevation borrows the plan's (`app.stage.scale`) unless that would not
fit its row, and its two rows are now equal (`.9fr / 1.25fr` gave the elevation more height
than a 7.5 m opening needs and starved the plan). Where a pane is still taller than the
drawing needs, the deck is nudged up to centre it rather than left sitting at the foot of an
empty pane; in the editor there is no spare, so nothing moves.

Checked at 1223 × 939, 1792 × 1024, 1400 × 900 and 1000 × 700: the plan's floor edges and
the elevation's proscenium verticals came out at 162/497 and 162/496, 414/814 and 413/814,
266/570 and 265/570, 143/293 and 143/292 — the same verticals within a pixel of stroke
width, at every size. In a run-through at 1792 × 1024 they are 563/1229 and 562/1229, with
the plan filling half the window and the elevation the other half; exiting restores the
editor's rows and scale. The show itself is untouched.

## Checking narration and the scene card (31 Oct 2026, late)

Two departments had never been driven end to end. Both work, and one small thing on
paper and one on screen were wrong.

**The card**, on a copy of the show on a throwaway port: **+ Card** added one with
`text: 'Act 1'`, the **Says** field took `Act 1 · Scene 2`, and **Add at 00:05.000**
placed a cue `{at: 5000, dur: 1500, shown: 1}`. At 0:05 nothing was on the board yet; at
0:07 the elevation drew it (colour found at 310×204–348×224 in the elevation canvas) and
the run-through at 0:21.7 showed `Card 1` standing on the deck with `Act 1 · Scene 2`
readable across it. On paper the cue sheet read `0:05.0 · Act 1 · Card 1 · Card · brings
on “Act 1 · Scene 2” · 1.5 s`, the scenery table listed `Card 1 | card | 0.0 m | 0.6 m |
1.6 m | 0.9 m | 1`, and the elevation sheet at 0:09 carried the words on the board. The
plot sheet does not show it because the plot is the picture at the top of the show, where
the card is still off — that is the sheet's rule, not a miss.

**A real finding:** the standing instruction over the plan sat exactly where a card
stands (front of stage, centre), so the board was drawn behind a translucent pill. That
line is now a coach mark: it retires on the first click on the stage, or after twenty
seconds, and comes back on the next load. Refusals and confirmations still use the same
bubble, so nothing the app has to say is lost.

**Narration**, with a WAV built in the page (440 Hz, 1.5 s) and handed to the file input
through a `DataTransfer`: it was read, measured at `length: 1500`, stored under a
`voice-…` key and placed at the playhead, and the row said `1.5 long`. The row's
**starts** field moved it to 8 s and persisted `at: 8000`. The engine's contract was
tested directly, because a preview tab throttles `requestAnimationFrame` and the
transport clock jumps when it does: `sync(show, 500, true, false)` and `sync(show, 1000,
true, false)` put the clip live, `sync(show, 3000, …)` released it at the end of the
line, `playing: false` released it, `muted: true` released it, and unmuting started it
again — which is the whole of what the frame loop asks of it. On paper it printed
`0:08.0 · voice-test.wav · Narration · line plays · cut`, and the `cut` was wrong: it
says the voice ends on the beat. The length column now carries the line's own duration
(`1.5 s`) and the action says only `line plays`.

**Not tested here:** the microphone. `startRecording()` opens `getUserMedia`, and in this
preview environment the permission prompt never answers — the button sat on "Opening the
microphone…" with `recording` still false. That is the environment, not the code, but it
is worth knowing that a prompt that is never answered has no timeout to fall back on.

## Names over the cloth, in the elevation (31 Oct 2026)

A curtain and the legs behind it are both centred and often both six and a half metres
high, so their names were drawn at the same point: `Main curtain` and `Tab legs` printed
into one another and the result read as a single invented word across the top of the
opening. Two separate faults, fixed together.

**Names are placed, not drawn where they fall.** `drawCloth` now pushes each name into
`this.clothNotes` and `drawClothNotes` places them after the cloth is drawn: in drawing
order, each name measures itself and takes the first height clear of the ones already
placed, lifting 11 px at a time. Three pieces in the same place stack into three readable
lines, and the same pass handles a card in front of a drop.

**The names are drawn outside the opening's clip.** They are labels about the cloth rather
than part of the picture, and a name lifted clear of the arch is still read where one cut
off by it is not — which matters precisely when a name has just been lifted.

**A flown drop keeps its one name.** The old label was drawn even for a drop hanging
entirely above the frame, which `drawFlownOut` already reports as `↑ Name flown out`; the
note is now only queued while some of the piece is still in the opening
(`bottom < opening`), so nothing is named twice.

Checked in the browser on the show as it stands: the elevation's top read `Main curtain`
and `Tab legs` on separate lines where it had been one unreadable string, the backdrop's
name stayed at its hem, held arrows and click targets were untouched, and the console was
clean.

## Folding the panes (31 Oct 2026)

The left pane grew a section per department — stage, settings, running order, music,
legs, lights, cloth — and the first two together took 587 px of a pane that never has
that much to spare. Width and depth are set once and then sit there taking a third of
the column.

**The heading is the control**, not a separate button: an `h2` with `role="button"`, a
`tabindex`, `aria-expanded`, and a chevron drawn with `::after` that points down when open
and right when shut. Folding is one class on the section and one rule —
`.panel > section.collapsed > :not(h2) { display: none }` — so nothing in the sections has
to know it can fold, and the lists inside keep rebuilding themselves untouched.

**The count stays visible when folded**, because `Music 2` or `Curtains 3` is the reason
to open a section again, and a folded heading that hides its own count would make you
open it to find out.

**The key is the heading's own words, not its text.** `Running order 1` folds under
`running-order`, so a show gaining a second act does not lose the fold. The whole set
lives in `localStorage['choreographer.sections.v1']`, beside the view settings and for
the same reason: it is the state of your desk, and a show file sent to another machine
should not arrive with somebody else's sections shut.

**Space is stopped at the heading.** Space is the transport's key, so a fold that let the
event through would also start the show — `stopPropagation` on the handled keys, not just
`preventDefault`, because the transport listener is on the window and would otherwise
still hear it.

**Both panes fold now**, on the same machinery: the cast, props and narration lists shut
one at a time, because you are working in them rather than setting them up, and the
inspector is skipped because it is the one section with no `h2` of its own — it says what
is picked, and there is nothing to fold it into.

**One control folds the stage pane.** `btnFoldAll` at the head of the left pane reads the
state rather than remembering it: if every section on that side is shut it says **Unfold
all**, otherwise **Fold all**, which is the same trick the per-section headings use. It
only ever touches the left pane — a button sitting in one column that shut the other one
would be a surprise the first time it was pressed. The registries (`sections`, one entry
per foldable section with its pane, heading and `read`/`apply`/`store`) are what makes it
two lines of code.

**The stage pane has one arrangement per act.** Setting up a second act's lights and
cloth is a different job from the first's, and what you want on screen is not the same:
`actFolds` is `actId → { slug: open }`, and `read()` asks the current act first. An act
that has never been arranged starts open, which is the right way round — a new act is a
fresh room rather than a copy of the last one. The right pane's lists are the same lists
whatever is playing, so they keep a single global map.

**Three verbs, because switching act must not save anything.** `apply(open)` is the class
and `aria-expanded`; `store(open)` is the memory; `read()` is what this section should be
showing now. A toggle does apply + store, fold-all does both for every section, and
`syncFoldsToAct()` — called once per frame from `render()` — does applies only when the
act id has changed, so scrubbing across a boundary or playing into the next act restores
that act's arrangement without writing one act's state over another's.

**Old files migrate quietly.** The first version of this stored a flat `{ slug: open }`.
On load, a blob without `sections`/`acts` is read as the arrangement of the act you are
in, so nothing you had folded springs open when the new build arrives; deleted acts are
dropped from the map on load rather than left as keys nothing can reach.

Checked in the browser: all ten headed sections wired with `role="button"`,
`aria-expanded` and a chevron (seven on the left, three on the right, inspector skipped);
Stage fell from 244 px to 36 px with its fields hidden and the chevron flipped to `\25B8`;
Show settings folded the same way; both survived a reload; Space on a focused Running
order heading folded it and left the clock at `00:00.000` with the transport still
stopped; unfolding all three restored the pane. **Fold all** shut all seven left sections
to 36 px each — the whole pane 678 px, no scrollbar — and the button became **Unfold
all**, which opened them again to a 3430 px pane; the right side was untouched by it and
kept its own state. Performers folded to 36 px with `Performers 3` still on the heading,
survived a reload, and left the Fold all label alone. Console clean, show untouched.

Per-act state was checked on a two-act test show on a throwaway port: Stage folded in Act
1 stored `acts.a1.stage = false` and nothing else; switching to Act 2 opened it again
without writing anything, and Fold all there wrote seven keys under `a2` while `a1` stayed
as it was; switching back to Act 1 restored Stage shut with the other six open, and the
Fold all label read the new act correctly. The right pane's Performers fold survived the
same switches, as a global should. A hand-written old-format blob (`{stage:false,
music:false}`) loaded with Stage and Music shut and Performers open, kept them through a
trip to Act 2 and back, and the first toggle wrote the new shape with Act 1's seeded map
intact. Test storage and server cleared afterwards; the real show now holds
`acts.<act 1>.{…}` with every section open, which is where it started.
Console clean afterwards, and the show was untouched.

## Filling a view, and depth in the elevation (31 Oct 2026)

The pair of drawings is the right default and the wrong room for two jobs: placing a path
on a twelve-metre plan a few hundred pixels tall, and watching the show from the house.

**Fill** is a button in each view's own corner. It gives that view the whole centre and
takes the other out of the grid — `display: none` rather than a zero-height row, so the one
that is left simply gets the space — and the label becomes **⛶ Both** to say what the next
click does. Only one can fill at a time: two half-full views would be the layout it is
there to replace.

**A filled view fits itself.** The shared scale exists so a metre is the same above and
below, and there is nothing to share with when one view is gone, so `fitViews` sets
`state.ui.viewScale` to null in that branch and the plan or the elevation fits its own
pane. The elevation also has to be told to ignore the plan's *remembered* scale: with the
plan hidden there is no new measurement, only a stale one from a panel that is not on
screen, and `Math.min(fit, planScale)` would quietly shrink the drawing to suit a
layout that is no longer there. `alone` in `elevation.js` is that exception.

**The fill survives a run-through.** Watching from the house is the reason the elevation
can fill at all, so `setWatch` does not clear it: fill the elevation, press Watch, and the
house view plays alone across the whole window (`body.watch.fill-elev #center` is a single
row). Esc brings back the editor with the fill still set, which is where you left it.

**Depth.** A flat elevation draws a dancer on the lip and one at the back wall the same
size, which is the one thing the house never sees. The audience sits a real distance away,
so a figure `y` metres upstage is `HOUSE_DIST + y` away instead of `HOUSE_DIST` and reads
smaller by `HOUSE_DIST / (HOUSE_DIST + y)`. `HOUSE_DIST` is 16 m — a front row rather than
a survey — which makes a dancer at the back of a 9 m stage about two thirds the size of
one on the lip: enough to read as distance, not so much that a deep stage looks like a
long corridor. Props take the same factor about the same feet, so a bench upstage is not
left looking oversized beside whoever is standing next to it. Cloth is deliberately never
scaled: a border hangs at a real height and is read against the metre rule, and shrinking
a backdrop would make the one measured drawing in the app into a picture of a smaller
theatre.

**Depth is a toggle because it is a look, not a fact.** **Depth** in the elevation's corner
turns it off and every figure draws full height again, which is what you want when judging
whether a flown drop clears a dancer's head. Both settings live in
`localStorage['choreographer.view.v1']` rather than in the show file: they are how you are
looking at the show, and a copy sent to another machine should not arrive with somebody
else's panels arranged.

Checked at 1792 × 1024: the plan drew 22 m of floor and wings at 42.7 px/m with both views
up and 54 px/m filled, and the elevation's 12 m opening at 78.8 px/m filled; the elevation
filled to 1228 × 616, and in a run-through from that fill to 1792 × 1023 with the plan out
of the grid entirely. Depth measured the same dancer (Cleo, 7 m upstage) at 90 px tall with
it on and 130 px with it off — a ratio of 0.692 against the 0.696 the formula predicts for
y = 7 and 16 m of house. Reloading restored both views with depth on, entering and leaving
a run-through restored the fill, and the console was clean. The show itself was untouched:
three dancers, three pieces of scenery, no lights.

## Green room: costumes as data (1 Nov 2026)

The notes above argued costumes were the expensive page because a plan cannot show them.
That was the wrong way round: the expensive part is not wearing a costume on screen, it is
deciding what a costume *is*, and once it is colours and a cut the drawing follows.

**The model.** `show.costumes` is a list of `{ id, name, body, skirt, hair, style }`, and a
performer carries `costumeId` or nothing. `style` is one of three cuts — tutu, tunic, plain
— because a cut is the only thing that changes a silhouette; everything else is colour.
`costumeOf(show, dancer)` is the single way anything asks what somebody is wearing, so the
plan, the elevation and the printed elevation cannot drift apart. The normaliser rebuilds
the list, gives a costume without a name one, and clears a `costumeId` that points at a
costume which is not there — a deleted costume undresses its wearers instead of leaving a
dangling reference. A show written before the wardrobe has no `costumes` key and opens
with plain dancers, drawn in their cast colours, exactly as before.

**Where it lives.** A **Green room** section in the right pane, between the cast and the
props: you dress a performer you have just picked, from a costume you have just made. The
dressing picker is on each performer's row rather than in a page of its own, because
dressing is one decision made while looking at who is who. That picker had one trap: the
cast row's click handler selects the dancer, and rebuilding the row under an open
`<select>` closes it — so the handler returns early for `[data-act="dress"]`.

**How it draws, and what it protects.** Seen from above a costume is a skirt, so the plan
draws a ring in the skirt colour whose thickness is the cut (a tutu is a fat disc, a tunic
narrow, plain a line) and keeps the dancer's own colour in the body, because the plan's job
is *who*. The elevation draws the figure in the costume's colours with its skirt, a crown
of hair and the name in the dancer's own cast colour, and the printed elevation draws the
same figure darkened to print. Costume colours are deliberately not part of the cast
palette: a costume is something they put on.

Checked on a throwaway port against the demo show: `+ Costume` added a colourway and the
three cast rows grew their pickers without selecting anybody; choosing one dressed Ada,
persisted `costumeId: "cos-…"` immediately, and turned 285 pixels of skirt colour on the
plan (tutu) — 219 as a tunic, 64 as plain, 0 undressed, which is the ring thinning with the
cut. In the elevation the same dancer measured a 14 × 5 px tutu disc at the hip with the
figure 97 px tall in costume body colour, and the name in her cast blue. On paper the
elevation carried an `<ellipse>` in the skirt colour and the half-circle hair path. `×` on
the wardrobe emptied it, undressed all three, removed the pickers, and **Undo** brought the
costume and both wearers back. Console clean throughout.

## Posed dancers: the positions are drawn (1 Nov 2026)

The plan was to reach real-looking dancers through 3D. That was dropped: what a
choreographer needs to check is whether the *positions* and the *transitions* are right,
and a jointed stick figure answers that better than a rendered human — it is legible at
35 px, prints in one colour, and carries no assets, no rigs and no licensing.

**The table.** `src/pose.js` holds each of the twelve positions as four joint angles (two
arms, two legs, each with an upper and a lower segment), plus a torso lean and a rise.
Angles are degrees from straight down, positive away from the body's centre, and every pose
is authored facing the house. The left side is the right side mirrored, so symmetric
positions are exactly symmetric and asymmetric ones are one line of numbers. `joints()`
turns a spec into points in body units (one unit tall, floor at zero) and both renderers
use it: `drawPose()` for the canvas, `poseSvg()` for the printed elevation. Adding a
position is a line in `POSE_SPECS` and a line in the station select.

**Rise is leg length, not a lift.** A dancer on the pointes is taller with their feet still
on the floor, so `rise` lengthens each leg segment by half of it and raises the pelvis by
all of it: the feet land back on the same line, and a plié (a negative rise) lowers the
body without the ankles sinking through the deck.

**Timing.** `poseAtLocal` gives the position at a local moment, the position being moved
towards, and how far into the change it is. The change is eased (`smoothstep`) and finished
at 68% of the travel, then held: a dancer who spends the whole count halfway between fifth
and arabesque is dancing neither, and a real dancer arrives and *is* in the position before
moving on. A hold freezes the pose for free, because `localOfContent` already discounts held
time. Facing follows the nearest stretch of path that actually crosses the stage, so a
dancer travelling stage left extends the other arm and keeps that side when they stop.

**What it changes.** The elevation's figure is now the posed one, drawn with a dark outline
pass under the body colour so it reads on a dark stage and on white paper, with a widened
click box because a raised arm reaches wider than a body. The printed elevation draws the
same joints at the stage's dancer height, before the tags, so the position on paper is the
position on screen. The plan is unchanged on purpose: from above, a position is invisible.

Checked by driving the app on a throwaway port with Cleo (7 m upstage, dressed) and
measuring the costume-body pixels in the elevation: the bounding box went 7 px wide at
**none**, 13 at **first**, 31 at **second** (arms open), 36 at **arabesque** (leg carried
out), 23 at **tendu**, 15 × 31 at **pirouette**; **fifth** grew to 38 px tall with its top
13 px higher (arms overhead), **plié** shrank to 26 px with its top 3 px lower, and
**relevé** 2 px taller than first. The transition was checked on a synthetic two-station
path (first → arabesque over 3 s): blend 0.15 at 0.5 s, 0.49 at 1 s, 0.83 at 1.5 s, 1.0 by
2 s and held to 3 s, with the arm angle arriving at arabesque's 95°/70°; a path running the
other way reported `facing: -1`. On paper the elevation carried 50 thin polylines (five
limbs × five dancers × outline and colour) and a head circle above them. Console clean; the
demo show untouched apart from the dancer added for the test.

Where it still stops: there is no foot work inside a position (no frappé, no rise inside a
station), no turn (a pirouette does not rotate), and no port de bras between stations
beyond the straight blend; a dancer's position cannot change inside a hold. Those are the
next steps if the figures are ever asked to *perform* rather than to be checked.

## Steps and turns: how a station is arrived at (1 Nov 2026)

A station was a place and a position, and the travel between two of them was one long
blend. That is right for walking and wrong for anything a choreographer actually names: a
chassé is not a body halfway between two positions, and a pirouette is not a bent leg
standing still. So a station now carries two more things — **how it is travelled** and
**how far round the dancer goes on the way**.

**Step.** `walk` is the behaviour the planner already had (blend into the new position,
arriving at 68% of the leg and holding). The named steps — `chasse`, `pas-de-bourree`,
`pirouette` — are the same ids as the positions, because in a studio they are the same
words, and the figure simply holds that position while it travels. The leg is spent in
three parts: the first fifth getting into the step, the middle half held in it, and the
last three tenths taking the position being arrived at. That is what makes a chassé look
like a chassé: the legs are open for the length of the movement instead of sweeping
through it.

**Turn.** Degrees, spread across the travel with the same smoothstep, so a 360 is finished
when the dancer arrives rather than continuing after they have stopped. A flat drawing
cannot show a rotation, so `joints()` fakes the one thing the eye uses: the body's width
across the picture is `0.42 + 0.58·|cos θ|` and it mirrors once past 90°. Profile is 42% as
wide, the back view is full width and reversed, and a dancer coming round the front again
looks like themselves. Heights never change, so the metre rule and the clearance checks
still mean what they said.

**Where it is set.** The strip under the stage, beside the position — on the focused point —
and on the station's own row in the inspector, so a station can be edited without focusing
it. Both are disabled on a first station, because there is no leg into it. A station written
before this opens as `walk`, 0°, which is exactly how it drew. The printed path sheet gained
a **How in** column so paper says `chassé, full turn` where the screen shows a body in a
chassé going round.

One bug found and fixed while wiring it: a `<select>` fires `input` as well as `change`, and
the inspector's `input` handler ended in a catch-all that wrote `d[f] = value` — so changing
a station's position (and now its step) also wrote `pose`/`step` onto the dancer itself. Any
field carrying a station index now returns before the catch-all; the change handler is the
only thing that writes a station's select.

Checked on a throwaway port, on the demo show. The schedule was read straight out of
`poseAtLocal` on a three-second leg of `chasse` + 360: at 0.3 s the figure was half way into
the chassé and 10° round, at 0.9 s in the chassé at 78°, at 1.5 s still in it at 180°, at
2.4 s coming out of it at 323°, and at 2.9 s arrived at fifth at 359° — so the turn finishes
with the movement. In the app's own elevation, measuring Cleo through that leg, the drawn
figure went 22 px wide at 0°, **11 px at 87°** (profile), **26 px at 180°** (back view,
chassé open), 14 px at 263° and 9 px at 360° where she had arrived in a near-neutral
position. `+ Costume` and the wardrobe were untouched by this. The strip kept its `360`
after a reload, the inspector's row wrote `pas-de-bourree` + `180°` to station 3 of another
dancer with no stray properties left on the performer, **Undo** returned that station to
`walk`/0°, and the printed path sheet read `chassé, full turn` on the station that had it and
`—` on the one that was walked straight into. Console clean.

Where it still stops: the turn is a drawing convention, not a three-dimensional body — a
dancer cannot be turned to face upstage in a way that changes what the plan means, and a
turn cannot be split across two legs (it belongs to the station being arrived at). The step
has no tempo of its own: its shape is held for a fixed share of the leg, so a very short
transition cannot show a full chassé. A hold still freezes both, because it freezes the
local clock both are read from.

## Turns that chain (1 Nov 2026)

A turn used to belong to one leg: it swept from zero to its value and the next leg began at
zero again. Two stations of 180 therefore turned, snapped back to the front, and turned
again — which is not a chaîné. The heading is now carried: `headingAt(keys, i)` sums every
turn up to and including a station, a leg sweeps from the heading it starts on to the one it
finishes on, and a station with no turn simply keeps the heading it arrived with.

That last part is a real change of meaning worth knowing: a dancer turned to face upstage
*stays* facing upstage through the stations after it, because that is what a body does. To
come back, put −180 on a later station. The printed **How in** column still prints the turn on
that leg, not the running heading, because that is the instruction a dancer rehearses.

Checked straight out of `poseAtLocal` on a chain of two 180° legs: 0° at the start, 90° at the
middle of the first leg, 180° on arrival, 208° into the second, 270° at its middle and 360° on
arrival — one revolution, with no reset at the joint. A third case (180, then 0, then −180)
read 180° through the walking leg and 90° halfway back to the front, arriving at 0°. In the
app's own elevation, with that chain set on Cleo, the drawn figure narrowed to 11 px at 90°
and 4 px at 270° against 22 px at the front and 10 px at 360° (the difference between the last
two is her changing depth, not the turn: an undressed neutral body is only about 8 px wide).
`stepWords` needed no change, and a station written before this opens at 0° as it always drew.

Where it still stops: the heading is stored as the sum of the turns, so a show that adds up
past 720° relies on the per-station clamp (−720…720) rather than a total; and nothing yet
spreads one turn across several legs (a slow four-count turn is four stations of 90, which
looks the same but cannot be retimed as one movement).

## A turn with a length of its own (1 Nov 2026)

A turn was a share of one leg: it swept from 0° to its value across the transition into the
station, and that was the only speed it could have. A slow adagio turn therefore had to be
faked with four stations of 90 — four numbers to keep in step, four durations to retime, and
no way to say "this is one movement".

**The window.** A turn now has a start and an end rather than a leg. It always *ends* at the
station it belongs to, and it *starts* `turnMs` earlier; with no length given, `turnMs` is the
leg into that station, which is exactly the old behaviour. Give it 6 s on a station six seconds
in and it begins at 0:00 and turns steadily across the three legs in between, including while
the dancer is standing at the stations it passes. The heading at a moment is the sum of every
turn's eased progress, so a turn that has not started contributes nothing, one under way
contributes part of its degrees, and one that has finished contributes all of them — which is
why chains still add up without any special case. Overlapping turns simply add; nothing more
honest is possible, and a show that overlaps them has said something it did not mean.

**Where it is set.** A **turn over** field beside the turn, on the focused point's strip and on
the station's own row. Empty means the transition, and the field echoes that with a dash. The
range is 0–60 s. The printed path sheet says `chassé, ½ turn over 7.5 s` when a length has been
given, because a dancer rehearsing an adagio needs the count as well as the amount.

Checked on a throwaway port against the model first. With no lengths anywhere, a two-station
chain of 180s read 0°, 90°, 180°, 270°, 360° — the same numbers as the previous build, so old
shows are untouched. A 360 given 6 s and ending at 6:00 on a three-leg path read 0°, 27°, 93°,
180°, 267°, 333°, 353°, 360° at one-second intervals: one movement, symmetric about its middle.
A 180 given 1.5 s on a four-second leg read 0° at 1 s and 2 s, 47° at 3 s and 180° at 4 s — it
finishes early and the dancer walks the rest of the leg already turned round. In the app, a
turn length typed on Cleo's strip saved as `turnMs: 7500` and persisted, the printed sheet read
`chassé, ½ turn over 7.5 s` where a station without a length still read `chassé, full turn`, and
the elevation narrowed to 11 px as she passed through 90° between 19 px either side of it.
Console clean.

Where it still stops: a turn cannot start *late* (it is anchored to its finish), so "hold, then
turn on the last count" is two stations rather than one setting; and a window that reaches back
before the start of the show begins partially turned, which is arithmetically right but worth
knowing when a first station carries a long turn.

## Spotting (1 Nov 2026)

A turning body is only half the picture. A dancer spots: the head holds the way it was
facing while the body goes round, then whips to catch up in the last part of the turn, which is
why an audience sees the face almost the whole way through a pirouette.

**The model.** `turnsAt()` returns two headings from the same turns: the body's, eased across
the turn, and the head's, which holds at the turn's starting heading for the first 60% and
then sweeps the whole amount in the last 40% with the same smoothstep. Finished turns
contribute their full amount to both, so chains and timed windows need no special case, and a
head cannot drift out of step with the revolution it belongs to. For a 360 over three seconds
the body read 27°, 93°, 180°, 233° at 0.5, 1.0, 1.5 and 1.8 s while the head stayed at 0° until
the 233° point and then went 56°, 180°, 304°, 360° — the face held, then snapped.

**The drawing.** A head five pixels across cannot show a face, so the cue is the hair, which is
also honestly what you see from a distance. Its mass is clipped to the head and its radius and
offset follow the head's own angle: `0.62 + 0.18·(1−cos h)` of the head radius, pulled back by
`−sin h` and lifted by `(1+cos h)/2` at the crown. Front is a small crown on the top, profile a
mass at the back of the head, from behind the whole head. Measured on a 170 px test figure:
104 hair pixels facing front, 122 in profile, 266 from behind. Because a costume used to be the
only source of a hair colour, an undressed dancer now gets one from their own cast colour
(`darker()`), so spotting can be seen in a show with no costume in it at all.

Checked in the app's own elevation with the view filled, across Cleo's turning leg: at head
turns of 0°, 0° and 13° (body 47°, 90°, 133°) the head kept 7, 7 and 6 hair pixels — a crown,
held while the body went round — and at 180° it jumped to 27 as the hair came round to cover the
head. On paper the SVG carries a `clipPath` per head with unique ids, all of which resolve, and
the elevation still printed fifty figure polylines. Console clean; the demo show untouched.

Where it still stops: the spot is a drawing convention and not a neck — a body at 233° with a
head still facing front is impossible in life, though it is exactly what the audience reads.
Spotting is always on (there is no "no spot" for an adagio), it is a single hold-then-whip
rather than the several spots a slow turn takes, and a head with no hair (a show drawn before
this) simply has no cue until it is redrawn.

## A bowed leg (1 Nov 2026)

A path made only of straight lines turns at its stations like a hinge, and a dancer crossing the
stage does not: the body carries the momentum of the step and the line curves. A leg between two
stations can now bow.

**The model.** `bend` on the arriving station is how far the path passes to the left of the chord
at the middle of the leg, in metres — positive to the left of travel, negative to the right.
`BEND_LIMIT` is 20 m, which is a stage crossing rather than a memory of a drag. The curve is a
quadratic whose control point sits twice the bend out from the chord's midpoint, which is the
trick that makes the number on the field the number you can see: at its middle a quadratic passes
exactly half its control point's offset from the chord. Read back with a 1 m bow on a horizontal
leg, the middle sat 1.000 m off the chord, the quarter points 0.750 m, the ends never moved, and a
show with no bends at all walked exactly the positions it walked before.

**One even speed.** A quadratic's parameter is not its length — the curve is effectively slower at
its ends — so `posAtLocal()` does not walk it by parameter. `curveByTime()` measures the arc in
twelve steps and finds the parameter for the fraction of the leg asked for, because otherwise the
plan's equal-time ticks would bunch through the bend and a dancer would seem to stumble three
times while walking one sweep. Measured on a 1 m bow over a 4 m leg, sampled every 500 ms: steps
of 1.042, 1.038, 1.040, 1.039, 1.039, 1.040, 1.038, 1.042 m. The wobble is the twelve-step
measure, not the walk.

**Where it is read.** `curveAt()` and `legPoints()` are the only ways anything now reads a leg.
The plan draws a path by sampling `posAtLocal()` in time, so the bow came for free there; its
click test follows `legPoints()` instead of the chord, because an arm of a bow has to be pickable
and the straight line it no longer follows must not be; and the printed path is the same sampled
polyline, so paper and stage agree. Props on stations take the same field, since they walk the
same `posAtLocal()`.

**Dragging it.** A click on the line focuses that performer — the click that used to do nothing —
and a drag bows the leg. The depth is measured against the chord's normal, but the pointer grabs
a *point* on the curve, and a quadratic sits `4u(1−u)` of its depth off the chord at parameter
`u`. Dividing the pointer's offset by that weight is what makes the grabbed arm follow the mouse
instead of the middle drifting away from it, which is what the first version did; the weight is
floored at 0.35 so a grab beside a station cannot ask for an endless bow, and nothing moves until
the pointer has travelled 8 cm, so a click that wobbles still only picks. Checked on one leg: a
1 m pull at the middle gave a 1.0 m bow, a 1 m pull on the arm at `u ≈ 0.17` gave 1.75 m — the
same pull, a deeper bow, because that is the part of the curve being held. Values snap to the
floor grid like everything else, and the typed field in the strip writes the same number: −0.5
typed in saved as `bend: -0.5` and the printed sheet read `arcs 0.5 m right`.

**On paper** the station's **How in** column adds `arcs 1.2 m left`, so a dancer reading their
path at the barre knows the line curved as well as where it went. A straight leg says nothing
extra, which keeps the column readable.

Where it still stops: one quadratic per leg, so an S-curve is two stations rather than one
control point held in the middle; the bow is measured at the middle of the leg, so a path that
must clear a prop near one station cannot be pulled sideways without moving that station; and a
bend on a transition the dancer never travels (two stations at the same moment) does nothing,
which is honest.

## Levels (1 Nov 2026)

A position says what the body is doing. It does not say how tall the dancer is doing it, so the
elevation drew a dancer on the pointes, a dancer flat, and a dancer in the air as the same body
sliding about. A station now carries a **level**.

**Two different things, and they must not be one.** A standing level is a rise: the hips come up
and the legs lengthen, the feet stay on the deck, which is what standing higher actually is.
`rise` was already in the pose table for exactly this (`relevé` 0.04, `plié` −0.09) — a fraction of
the dancer's height, so a small dancer rises a small amount, and the level's rise is added to the
pose's rather than replacing it. A jump is not a taller body, it is a body with nothing under it,
so it is a height in metres that moves the whole figure up from its feet. `levelOf()` returns both
numbers so nothing downstream has to guess which kind it is holding; a 1.7 m dancer stands 3.4 cm
taller on the demi and 7.7 cm taller on the point, with the feet never leaving the floor.

**A height is travelled, on the leg's own clock.** The first cut blended levels on the pose's
eased count, which arrives at 68% of a leg — right for a position, wrong for a height: the dancer
touched down a third of a leg early and walked the rest of the way in a plié, and a rise was long
finished before the station it belonged to. `poseAtLocal()` now returns `levelT` as well as `t`, a
smoothstep over the whole leg, and `levelBlend()` takes that. Height and position therefore arrive
together: a jump lands *on* its station, not short of it, and flat to pointe is complete when the
dancer gets there. Read every second on a flat–air–flat path of three-second legs: lift 0, 0.09,
0.26, 0.35 at the air station, then 0.26, 0.17, 0.09, 0 at the landing. On a flat-to-pointe leg the
body measured 0, 1.2, 3.8, 6.5, 7.6 cm up, and the feet never left the deck.

**The height is typed or defaulted.** `level: 'air'` with no `lift` takes `AIR_LIFT` (0.35 m);
anything typed in the **off floor** field is in metres and is clamped to `LIFT_MAX` (2.5 m). A
filled `lift` on a standing level is a dancer held off the deck — a partner lift — and is drawn as
one, which is why the field is not hidden for the standing levels.

**Drawn.** The elevation adds the level's rise to the pose's and offsets the figure by the height,
so the head, the name above it and the click box all follow the body; the floor shadow stays on the
deck and shrinks and fades as the height grows (`0.6 + 0.4·near` of its size, its alpha falling with
the height), which is the only cue that distinguishes a jump from a tall dancer in a side view. On
paper `elevDancer` does the same, and the station table's Pose column reads `in the air 0.7 m up`
or `5th position, en pointe`.

Checked on the app's own elevation canvas by hiding every other performer and photographing the
pixels: flat to pointe raised her head by 2 px, flat to air by 9 px, and the ratio of the two —
4.5 — is the 0.35 m jump against the 0.077 m point, so the scale dropped out of the check. Typing
0.7 m raised her 8 px further, exactly another 0.35 m, and saved as `lift: 0.7`. On paper, changing
0.7 m to the 0.35 m default moved ten polylines of one figure by 18.4 px at 52.43 px per metre —
18.35 px of expected shift, and no other figure moved. A show written before levels opens with
every station `flat` and `lift: null`, which is how it was drawn.

Where it still stops: the arc is a smoothstep over the leg rather than a ballistic parabola, so a
jump rises and falls evenly instead of hanging at its apex, and it cannot be hung there by hand
either; the rise is a fraction of the dancer's height for every level, so a 1.5 m dancer's point is a
little lower than a 1.9 m dancer's, which is true in life; and the plan, being a floor view, cannot
show any of it — the elevation and the paper are where a level lives.

## Landings (1 Nov 2026)

A jump needs somewhere to arrive. With a level on the station but nothing to receive the drop, the
dancer came down out of the air straight into whatever the next station said — a tall position,
immediately — which is not a landing, it is a teleport with a curve on it.

**What a landing is.** A station on the floor whose predecessor is off the deck absorbs the drop:
the body is lowest exactly at that station, then unwinds into the next position across the following
leg. `levelOf(key, from)` returns an `absorb` in metres beside the level's rise and height, and
`levelBlend()` carries it, so the plié is part of the same curve as everything else rather than a
special case the drawing has to remember. In the skeleton a dip is a *negative rise*: the hips come
down and the legs shorten while the feet stay on the deck, which is precisely what standing higher
does backwards — so it is subtracted in body heights (`absorb / dancer height`) at the two places
that draw, and the feet never move.

**How deep.** Typed in metres in the **plié** field, clamped to `ABSORB_MAX` (0.6 m). Left empty it
takes what the drop needs: `0.32 × the height it fell from`, floored at 0.06 m and capped at 0.45 m,
so a 0.35 m jump gives 0.112 m and a 1.2 m jump 0.384 m. Typing 0 is a stiff landing, which is a
choice a choreographer is allowed and the planner must not overrule; clearing the field goes back to
what the drop needs. A station still in the air absorbs nothing — there is no deck under it to give —
and a landing onto pointe keeps the pointe's rise with the dip taken out of it.

**This is why heights were retimed.** With levels blended on the pose count (which arrives at 68% of
a leg) the dancer touched down a third of a leg early and walked the last metre in a plié, and the
dip peaked before the station that owned it — a landing you could see was wrong. `poseAtLocal()` now
returns `levelT`, a smoothstep over the whole leg, and levels blend on that, so height and position
arrive together. The Levels section above has the corrected numbers.

**Checked** on a flat → air (3 s) → floor (6 s) → pointe (9 s) path, levels read on `levelT`: lift 0,
0.09, 0.26, 0.35 at the air station; then 0.26, 0.17, 0.09, 0 at the landing, with the plié reading
0.029, 0.056, 0.083, 0.112 m — deepest exactly at the landing station, 11.2 cm below standing — and
then unwinding to 0.083, 0.029 while the body comes up onto pointe, ending 7.6 cm above standing. In
the app the field appears only where there is a landing: on that station with a flat station before
it there was no **plié** field, and with the jump put in front of it the field appeared with 0.11 in
its placeholder. In the elevation, the automatic 0.112 m dip lowered her head by 3 px in the 22 px
column she occupies, about 26.8 px per metre at her depth, and typing 0 or 0.55 moved the same
figure further in the same direction. On paper the station reads `plié 0.11 m` (in centimetres,
because "0.1 m" is not a landing anyone can judge), and changing that landing to a stiff one raised
every polyline of her figure on the printed elevation by exactly 5.9 px at 52.43 px per metre — the
5.87 px of a 0.112 m dip — with no other figure moving.

**Housekeeping this forced.** The field pushed the focused-point strip past what a narrow centre pane
can hold, and the strip had been hiding its own *Continue* and *Delete* buttons at the far end. It
now scrolls sideways instead (`overflow-x: auto`, a 5 px scrollbar) rather than clipping them.

Where it still stops: the dip is at the station rather than a moment after touchdown, so there is no
separate impact-and-recover beat — landing, give and rise are three stations or two stations and a
hold; the automatic depth is a rule about the drop, not about how a particular dancer lands; and a
landing's plié is only ever a knee bend, since the planner has no separate knee of its own.

## The movement sheet (1 Nov 2026)

Every move the planner knows was already in it, behind a drop-down. That is the wrong shape for a
vocabulary you are still learning to use: a list of names can tell you that *attitude* exists but not
what it looks like, and a move you cannot picture is a move you do not put on the stage. **Moves** in
the header now opens a sheet of all of them, each drawn by a small dancer doing it.

**What is on it.** Three groups, in the order a station is read: thirteen **Positions** (everything
in `POSES` but *— none —*, which is the absence of a choice rather than one), four **Steps**
(`STEPS`, including the plain walk, because "take that step back off" is also a thing you pick), and
four **Levels** (`LEVELS`). Each cell is a name, one line of studio-speak, and a canvas.

**How a cell is drawn.** With the app's own functions and nothing else: `specOf` for the position,
`blendSpecs` for the movement into it, `drawPose` for the figure — so the reference cannot drift from
the elevation it describes. A position blends *out of* the plain standing figure and back on a smooth
triangle over a 2.6 s loop, with a faint silhouette of that plain figure behind it so the change is
what you see. A step holds its position and travels across the cell, because that is what a named step
does on the stage. A level moves the whole dancer: the rise lengthens the legs, the jump lifts the
figure off the deck line, and a dashed rule marks where the plain dancer's head reaches, which is the
only way a 2–3 px rise is legible at this size.

**Picking one.** Click a cell and the move goes on the focused station — `pose`, `step` or `level`
according to the group — through the same `commit` → `ensureDurations` → `rebuild` path the panel
fields use, so it is one undo step, the strip under the stage updates, and the printed sheet follows.
The sheet stays open, marks whatever the station is already doing (`.move.sel`), and names it in its
header ("chassé · point 1 of Ada"). With no station picked it says so and changes nothing; a prop is
refused with a reason, since positions and levels are for dancers.

**Cost.** Thirty canvases animating would be a waste on a sheet nobody has opened, so the DOM is
built on first open and the animation loop is one `requestAnimationFrame` that draws every visible
cell until the sheet closes — then it cancels itself. The stage keeps drawing behind it; the loop is
the sheet's own clock, not the show's, because a reference has no playhead.

**Checked** in the browser: 21 cells in three groups, all drawing, and a cell's pixels change between
frames and stop changing once the sheet is closed. The cells are genuinely different drawings — at
the widest point of its loop *2nd position* spans 67 px against *1st position*'s 29 px and *tendu*'s
43 px — and a jump clears the deck by 15 px against *flat*, with *pointe* standing 3 px taller than
flat. Picking on a focused station saved `pose: 'fifth'`, `step: 'chasse'` and `level: 'pointe'` in
turn, marked all three cells, and left the strip reading the same three values. Escape, the Close
button and a click on the backdrop each close it, a click inside the panel does not, and with nothing
picked a click changed no saved data and said "pick a point on the stage first".

Where it still stops: the sheet is a picker, not a lesson — a position is one still figure and a
step is one travelling figure, so it cannot show a combination (a chassé *into* fifth) or a count;
it lists only what the vocabulary has, so a new position has to be added to `pose.js` and `POSES`
before it can appear here; and the cells are drawn small enough that a level's three-centimetre
demi-pointe is honestly hard to see, which is why the level cells carry the number in their note.

## Shaped counts (1 Nov 2026)

A leg was one length of time walked at one speed. Every travelling step in the planner therefore
read at the same rate — a chassé that gathers and shoots out across the stage had the same speed
profile as a step that is placed and settled, and the only way to fake the difference was to add
stations close together and then far apart, which changes the path.

**The model.** `ease` on the arriving station names the shape of that leg's count, the same way
`step` and `turn` do: `even` (identity), `accel` (`u²`, slow out and quick in), `decel`
(`1 − (1−u)²`, quick out and slow in) and `both` (`u²(3−2u)`, soft at each end). Every curve is
monotonic and pinned at 0 and 1, so a shaped leg still leaves the station it left and arrives at
the one it was aimed at: `countShape(key, u)` in `posAtLocal()` changes the *speed between* two
stations, never the stations. Measured on a 6 m leg over four seconds, in 0.5 s steps: even moved
0.75 m eight times; accel 0.09, 0.28, 0.47, 0.66, 0.84, 1.03, 1.22, 1.41; decel the mirror of that;
both 0.26, 0.68, 0.96, 1.10 and back down. All four ended at exactly −3.00 and 3.00 m, and the
half-way moment found the dancer at 0 m on an even or soft-both-end count, 1.5 m *behind* on a
gathering one and 1.5 m *ahead* on a settling one.

**One clock.** `poseAtLocal()` takes the same shaped fraction, so the pose, the step's phases and
the level's height all ride the count the travel rides: on a gathering leg at two seconds the body
was 31% into the position where an even leg was 83% into it. Otherwise a dancer would arrive in the
arabesque and then slide the rest of the leg in it, which is the same fault the levels had before
they were given their own clock.

**Where it is set.** A **count** picker on the focused point's strip (disabled on the first station,
which has no leg into it) and on every station's own row. It is stored per station like the rest of
the leg's shape, so a reopened show travels at the speeds it was staged with, and a leg written
before this opens as `even`, which is the walk it always was. The printed **How in** column names
the shape when it is not even — `chassé, full turn, quick out · slow in` — because a dancer counts a
gathering step differently from a settling one.

**Checked** in the app against its own model at a mid-leg moment (playhead 4.25 s, halfway through
a 2.5–6.0 s leg): the model put the dancer at −3.11 m even, −3.93 m gathering and −2.18 m settling,
and the elevation's repainted pixels agreed — the changed band between even and accel was 45 px
wide, which is her 22 px figure plus the 23 px of the 0.82 m shift at 27.87 px/m; between accel and
decel 71 px (22 + 49 for 1.75 m); between even and decel 48 px (22 + 26 for 0.93 m). Saving
`accel` and `decel` on two stations printed `slow out · quick in` and `quick out · slow in` in
their station rows.

Where it still stops: the shapes are four fixed curves with no amount, so "a little soft at the
start" is the nearest of them rather than a number; a turn keeps its own time window, so shaping a
leg does not reshape the revolution that ends on it; and because the shape belongs to the arriving
station, the way *out* of a station is decided by the next station's count rather than its own.

## Phrases (1 Nov 2026)

A step was describable but never built. Every travelling movement was one leg with three fields on
one point, so a sequence — chassé, pas de bourrée, pirouette, each into its own position — was that
many points typed in one at a time, with the same step chosen on every one of them and the level and
count remembered from the point before. The vocabulary knew *what* a chassé is; nothing knew *how
many stations* one takes.

**What a phrase is.** A step, the position it arrives in, and a level, laid down as the stations that
step actually needs. The table lives in `model.js` as `PHRASE_SHAPES`, one entry per step the planner
already knows, so a phrase cannot invent a move the vocabulary does not have:

- **walk** — one station, 0.9 m. The plain blend, arriving in the chosen position.
- **chassé** — two stations, 1.4 m: the close under the body at 45% of the travel (fifth, gathering),
  then the long low step that carries her, arriving in the chosen position and settling.
- **pas de bourrée** — three stations, 0.7 m: back, side, front at 34% and 68%, both on the
  demi-pointe, the last one arriving in the position. The quickest of the three because it is three
  transfers, not one.
- **pirouette** — two stations, **no travel**: the preparation in fourth, then the revolution on the
  pointe. Both sit on the spot she is already on, so placing a pirouette cannot move the path that
  led to it. The turn is one revolution because a pirouette is; editing the station to 720 makes it a
  double on the same count.

Each station carries its own `step`, `level`, `ease` and `dur`, and `pose`/`level`/`turn` in the table
say either a literal value or `'arrive'` for the one chosen with the phrase — which is how "chassé to
arabesque" and "chassé to tendu" are the same shape with a different ending.

**Where it goes, and which way.** Always after the last station, because a sequence is built forwards
and the caption says so ("after point 8 of Ada (00:19.500)"). The heading is taken from the last leg
she actually travelled — the nearest previous station more than 20 cm away — so three phrases in a
row make a line across the stage instead of a zigzag; with no travel behind her she heads stage
right, which is where a first entrance usually goes. A phrase whose end would fall off the deck is
turned round instead of being placed in the wings, but only if the other way keeps her on it.

**One undo step, one address.** The placement is `commit` → `ensureDurations` → append → focus the
arrival, so **Undo** takes all the stations back at once and the arrival is left focused for the next
phrase. The caption is a promise about where the next phrase lands, so it is refreshed whenever the
panels repaint while the sheet is open; without that a placed phrase followed by an undo left the
sheet addressing a point that no longer existed.

**Checked** against the model in Node: from a dancer at (−2, 3) a chassé gave stations at −1.37 and
−0.60 m at 1.0 s and 2.0 s, and a second chassé carried on from −0.60 to 0.03 and 0.80 — the same
1.4 m, along the same heading. A pas de bourrée at (0, 4) gave 0.24, 0.48 and 0.70 m at 0.7 s each,
the first two on the demi-pointe. A pirouette at (1, 4) put both stations at exactly x = 1.00, the
preparation at 1.2 s in fourth and the revolution at 2.4 s on the pointe; halfway through the turn
(1.8 s) the model had the body 180° round with the head still facing front, which is the spotting the
turn already does. A chassé placed at x = 5.4 on a 12 m stage — where 1.4 m more would be 6.8 m, off
the deck — was mirrored to 4.77 and 4.00. In the app: 10 stations became 13 with **pas de bourrée to
attitude** on the pointe, stations 11–13, the last at 00:23.600 with a 0.70 s count; the plan gained
264 lit pixels of path; one **Undo** took it back to 10 and the caption went back from "after point
13 of Ada" to "after point 10"; a reload kept all thirteen with their step, level, count and
duration. A prop is refused ("phrases are for dancers") and the caption says so instead of naming an
address. Console clean apart from my own `getImageData` warnings.

Where it still stops: a phrase is one step, so a *combination* — a chassé into a pas de bourrée — is
two placements rather than one name; the travel is the step's own and cannot be typed, so a longer
chassé is the phrase placed and its arrival dragged; the heading is inherited rather than chosen, so
turning a phrase is a drag afterwards; and the shapes assume a right foot leading, since the planner
has no side of the body to mirror.

## Linked phrases (1 Nov 2026)

A phrase could be placed after another, but the join was two movements wearing one path. The station
the first phrase arrived on was a stopping place: the body reached the position two thirds of the way
through the leg into it and held there, the count settled into it (`decel`), and the next phrase's
first leg gathered out of it (`accel`). Both of those shapes are pinned at zero velocity at the
station, so the dancer arrived at nothing and left from nothing — a stall, at every phrase boundary
on a path.

**Measured before changing anything.** Two chassés placed in a row on a dancer entering at 3 m stage
left: stations at 1.0 s (fifth, gathering), 2.0 s (arabesque, settling), 3.0 s (fifth, gathering),
4.0 s (tendu, settling). Sampling every 100 ms across the 2.0 s junction gave speeds of 0.69, 0.54,
0.38, 0.23, 0.08, 0.06, 0.19, 0.31, 0.44, 0.57, 0.69 m/s — a stall of about 300 ms at 6 cm/s — with
the pose pinned at `t = 1.00` (fully arabesque) from 1.85 s to 2.05 s and only beginning to leave
after 2.1 s. Both halves of a stop, in the travel and in the pose.

**What a link is.** The station a phrase arrived on becomes a **junction**: `pass: true`, and its
count is levelled. Three parts, and none of them is a special case in the drawing:

- `poseAtLocal` reaches a position at `POSE_REACH` (0.68) of the leg normally — arrive early, hold —
  and at **1.0** for a junction, so the position is a peak of the line reached exactly at the station
  and left immediately. Every drawing (plan, elevation, printed elevation, cheat sheet) reads the
  same function, so nothing else had to change.
- A settling arrival (`decel`, `both`) becomes `even` at the junction, and a gathering first leg
  (`accel`, `both`) becomes `even` too. Settling in and gathering out are both zero-velocity shapes;
  one speed through the junction is what "without a stop" means in a model whose only control is the
  shape of a count. A shape the planner had not chosen (`accel` in, `decel` out) is left alone.
- The arrival is tagged `phraseEnd`, so a third phrase links to it in the same way. The tag lives on
  the station, so it survives edits, drags and reloads, and is tidied in `normalise` alongside the
  other per-station fields.

`addPhrase()` does the whole placement — find the junction, link it, compute the stations, append
them, tag the new arrival — so the app only has to commit, focus and say what happened. Linking is
decided by the tag alone: a phrase placed on a point you built by hand is **not** linked, because a
hand-built point is where you asked her to stop. That rule is what makes the behaviour predictable
and what the phrase row reports before you press Place ("· joins it").

**Checked** against the model: the same two chassés, linked, give a minimum speed through the middle
of 0.63 m/s (was 0.01 m/s on a 20 ms sample) with the junction station reading `t = 1.00` at exactly
2.0 s and `t = 0.50` at 2.1 s — reached at the point, left immediately, no hold window. A third
phrase chained on linked again (`flags [false, true, true]`), and clearing the tag (what a
pre-linking show looks like) reproduced the stall exactly (`flags [false, false, false]`). In the
app, placing chassé–arabesque then chassé–tendu said "linked to the point before"; station 3 became
`pass` with its count `even` and the next leg's `accel` went `even`; its number drew as a ring in the
list; the strip showed a **through** checkbox on it; unchecking it removed the ring and the checkbox,
putting the pause back. On paper the same station printed `chassé, passed through` where its
neighbours printed `chassé`. Console clean; test server stopped, the show's own server on 4322
untouched.

Where it still stops: the link is automatic and has no "link/touch down" choice other than unchecking
the toggle afterwards, and nothing tells you before placing that the *previous* phrase's arrival count
will be rewritten — it is in the same undo step, but it is a change to work already placed. The
travelling closes inside a phrase are still rested on (a chassé's close reaches fifth early and holds
while she travels), because a close is a moment of weight rather than a junction; and two phrases
join only where one ends and the next begins, so a phrase dropped in the middle of an existing path
does not exist yet — phrases only ever extend a path forwards.

## Counted phrases (1 Nov 2026)

A phrase was laid down in whatever time its step felt like: "each transfer" was a number of
seconds, and a run of phrases therefore ran to its own length regardless of the band. Choreography is
counted, not timed, so the phrase now takes its time out of the music.

**The clock.** `Show settings` gains **tempo** (bpm) and **counts per bar**, stored in
`prefs.tempo` / `prefs.beatsPerBar` with the show, so a reopened file counts the same way. A count is
one beat — 0.50 s at 120 bpm — and a bar is a measure of them. `countGrid(show)` returns the three
numbers everything else uses, and counts bars **from where the first music track begins**
(`origin`), because that is where the band starts counting: a show whose music enters at 10.4 s has
its bar one there, not at 0. `onCount(show, ms, per)` gives the first count (or bar, or any step) at
or after a moment.

**What a phrase's counts divide.** Each station in `PHRASE_SHAPES` carries `w`, the counts that
transfer takes — chassé 1 + 1, pas de bourrée 1 + 1 + 1, walk 2, pirouette 1 + 1 — so the phrase's
default counts are the sum (2, 3, 2, 2). A phrase placed with `counts: 4` divides four counts in that
proportion (2 + 2 for a chassé); the last station takes the remainder, so a 7-count pas de bourrée
still ends exactly on its own last count. The seconds a step used to take are gone from the table:
at 120 bpm a chassé is 1.00 s and a pas de bourrée 1.50 s, and the tempo is now the only thing that
changes that.

**Where it lands.** `snap` moves the phrase's start onto the next count (`1`), the next bar
(`perBar`), or nothing (`0`, the old behaviour of beginning exactly where the path ends). The
arithmetic is done on the show's clock and converted back through `localOfContent`, so a dancer with
a hold in her path lands on the count the music is playing rather than on her own delayed one. A path
that already ends on the grid comes back untouched — snapping into time must not add a gap — and one
that ends between counts is joined by the leg into its first station, which is the honest place for
the catch-up to go: the model has stations, not a "phrase begins" moment, so the extra time lengthens
the leg before the first one rather than pausing her. The sheet says how big that catch-up will be
("· starts 0.40 s on") before it is placed.

**On the paper of the screen.** The bars are drawn under the tracks in the timeline, a warm shade
over the cool time grid so a bar is not read as a count, and only when they are at least 9 px apart.
The phrase row's caption gives the arithmetic both ways: "3 counts at 120 = 1.50 s · 2 stations,
1.4 m of travel · starts 1.00 s on".

**Checked** in the model: at 120 in four the grid is `{count: 500, bar: 2000, origin: 0}`; a chassé's
default 2 counts gave stations at 0.5 s and 1.0 s of 500 ms each, and a pas de bourrée given 6 counts
gave 2.0 / 3.0 / 4.0 s of 1000 ms each. A path ending at 1.234 s placed a two-count chassé at 2.00 and
2.50 s on the count, at 2.50 and 3.00 s on the bar, and at 1.734 and 2.234 s with snapping off; a path
ending exactly on 1.000 s stayed there when snapped to the count (no gap), and with the music starting
at 10.4 s a phrase after a 10.0 s station snapped to the bar at 10.9 s. A dancer with a one-second
hold — whose local 1.0 s is content 2.0 s — had her placed stations land at content 2.5 s and 3.0 s,
both on counts. At 240 bpm an untyped pas de bourrée took 750 ms and at 60 bpm 3000 ms, i.e. the same
three counts. In the app: the count field follows the step (2, 2, 3, 2), the caption read "2 counts at
120 = 1.00 s" and changed with the field, a four-count chassé across a snap placed stations at 25.000
and 26.000 from a path ending at 23.600, bar alignment reported "starts 1.00 s on" and placed from
20.0 s, and the timeline's warm-column count at a fixed row fell from 79 to 16 when the bars were set
too close together to draw. Console clean; test server stopped, the show's own server on 4322
untouched.

Where it still stops: the tempo is typed, not read from the music — a track has no beat grid of its
own, so an imported file and the count grid agree only because someone typed the right number; a
phrase with an odd number of counts over an even number of stations puts its later stations on half
counts (three counts over a chassé land at 0.75 s each); changing the tempo afterwards does not
re-time phrases already placed, it only changes where the next one lands; there is no count/bar
readout under the playhead, so the numbers live in the station times; and holds and pauses are still
free of the grid — a pause inside a phrase moves everything after it off the music.

*Housekeeping*: while editing this section I overwrote `src/model.js` with a placeholder by using the
whole-file writer instead of a replacement. It was restored immediately from the copy the test
harness had made of the same file (identical md5), and the two edits that had been applied after that
copy were re-applied; nothing else was affected.

## The count readout (1 Nov 2026)

The bars were on the screen but the *number* was not: to know which count the playhead was on you
read the time, did the division by the tempo in your head, and hoped the bars were where you thought.
That is exactly the arithmetic the phrase feature exists to remove, so the timeline now says it.

**What it says.** A small pill riding just under the ruler with the playhead: `bar 3 · 2` — the bar,
then the count within it. `countAt(show, ms)` does the division once, in the model, from the same
`countGrid` the phrase placement uses, so the readout and the snapping can never disagree.

**Three decisions in the drawing.**

- It is counted on the **show's clock**, not the display's: `state.ui.playhead` is content time, so a
  hold or a pause does not move the number. The band plays on through both; the count must too.
- It sits *below* the ruler, not in it. The ruler's rows are all spoken for (the running-order band at
  0–15 px, the tick labels at 21–30, the ticks at 33–40), and a pill floating over the labels would be
  unreadable at a glance. A dark ground with a faint amber border over the first track row is legible
  against anything, and the pause labels already live in that band.
- It turns round. Right of the line normally; to the left when there is no room on the right; and
  clamped inside the strip both ways, so it can never fall off the edge it is following. The first
  version only flipped and did not clamp, which left a pill half-hanging off the right edge when the
  playhead was scrolled past it — found by putting the playhead at x = 1270 on a 1223 px strip and
  seeing the box start at 1215 with 8 px of it visible.

**Checked** in the model: at 120 in four (count 500 ms, bar 2000 ms) the readout gives bar 1 count
1 at 0 and 499 ms, count 2 at 500, count 4 at 1999, bar 2 count 1 at 2000 — and a waltz at 90 in three
gives the same boundaries at 666.67 ms counts. A show whose music enters at 10.4 s has no bar before
it: `countAt` returns null at 0 and 10 000 ms, bar 1 count 1 at 10 400, bar 1 count 3 at 11 400 and
bar 2 count 1 at 12 400. In the app, matching the drawn glyphs against the same text rendered
offscreen gave "bar 4 · 3" the best fit (0.64) when the model said bar 4 count 3 at 7.0 s, against
0.50–0.58 for its neighbours; the pill moved with the playhead (7.0 s → x 385, 32.2 s → x 1202), drew
to the *left* of the line at 1202 with both borders inside the strip, and with a music track starting
at 40 s it drew nothing at 12 s and a readout again at 45 s. Console clean; test server stopped, the
show's own server on 4322 untouched.

Where it still stops: it is drawn, not selectable — no tooltip, and nothing on paper says which bar a
station lands on; the bar number is absolute, so a show whose music enters at 40 s calls that bar 1
and gives no hint that the house was dark before it; and the readout is in the timeline only, so the
run-through shows the stage without a count on it.

## Points from the ruler (1 Nov 2026)

The count could be read but not *used*: a point put on the timeline landed wherever the pixel fell
(double-clicking a track row places at `localAtX`, unsnapped), and the phrase row's snapping was
after-the-fact arithmetic. Double-clicking the **ruler** now places a point on a count.

**Why double-click, and why the ruler only.** A single click on the ruler is the scrub — dragging it
is how the whole show is judged — so taking that gesture would have cost more than it gave. The ruler
is also the only surface where a *count* means anything: the acts band at the very top is left alone
(y ≤ 16) because that is where scene boundaries are dragged, and the tracks below keep their own
exact placement, which is where a syncopation belongs.

**Two pieces of arithmetic, both in the model.** `nearestCount(show, ms, per)` rounds to the count
the click is *pointing at* rather than the next one after it, and never lands before the first count.
`localAtCount(show, dancer, ms, per)` then converts that count to the performer's own clock — and
this is where a hold matters: her clock stops for the length of a hold, so `localOfContent` maps a
count inside one to the hold's start, whose content is *not* the count asked for. Rather than place
her a beat early, it walks forward a count at a time until it finds one she is actually moving on,
and hands back both the count used and her local time. Both are bounded (64 tries) and neither needs
anything but the model.

**Insertion.** The point is put at the place she already is (`posAtLocal`), so a leg split by it keeps
its shape. Only the two legs either side are re-timed — the new station's own `dur` is the gap from
the station before, and the station after takes the remainder — so every other station keeps the time
it was staged on. A point already within 60 ms of an existing one is focused rather than added, since
two stations on one count would be a leg of no length. A dressing prop that has never been on the
timer starts where it stands rather than at the centre of the stage.

**Checked.** In the model at 120 in four: `nearestCount` gave 0 at 240 ms and 500 at 260 (the
rounding boundary), 500 at 733, 1000 at 760, and with music entering at 4.0 s a click at 1.0 s
returned 4.0 s rather than a bar before the band. With a 1.8 s hold at her 8.0 s (content 9.8–11.6),
`localAtCount` put clicks at 9.0, 9.8 and 10.0 s all on the count at content 10.0 s at her local
8.2 s — the far side of the hold — and every result was a whole count, and whole bars under Shift. In
the app: a double-click at x = 700 on Cleo inserted a point at 00:15.500 (a count) and selected it
("Point 5 of 9"); repeating the same double-click left the count at 9 and focused the same point;
Shift at x = 520 landed on 00:12.000, a whole bar; a double-click in the acts band changed nothing;
with nothing focused the hint read "Pick a performer or a prop first — a point belongs to a path".
On Bea, whose path holds for 1.8 s at her 8.0 s, a double-click that fell inside the hold placed her
point at content 10.000 — on the count, at her local 8.2 s. The legs read 2.50 s and 2.00 s either
side of a point inserted into a 4.50 s leg, with every other station's time unchanged. Console
clean; test server stopped, the show's own server on 4322 untouched.

Two mistakes of mine, both caught by running it rather than reading it: `localOfContent` and then
`posAtLocal` were used in `app.js` without being imported, so the first two attempts threw
`ReferenceError` and placed nothing at all — the console said so plainly, and both are imported now.

Where it still stops: the gesture is a double-click with no affordance on the ruler to say so — the
hint lives in the station list — and there is no drag along the ruler to place a run of points; a
point landing inside a hold silently moves to the far side of it rather than saying that it did; and
the count it lands on is the count *nearest the click*, so at a wide zoom a 500 ms count can be two
pixels and the pointer's exact pixel decides between neighbours.

## Phrases from the ruler (1 Nov 2026)

A point can be put on the music with a double-click, but a *sequence* could not: the phrase row
appended its stations to wherever her path ended, and the **on the** picker could only nudge the
start forward to the next count. So a section could not be laid down at the bar it belongs to — you
had to place it and then find that it was a beat out.

**The gesture.** The phrase row now has a second button, **On the ruler…**. It arms the phrase —
what was chosen is kept whole, because the sheet closes — and the next double-click on the ruler
lays it down from that count. Shift takes the nearest bar, the same as placing a point. A button
rather than a modifier on the double-click because the phrase's parameters live in the sheet: arming
is the moment you say "this one, there", and a hidden modifier cannot say which.

**What "from that count" means.** The leg into the phrase's first station begins on the clicked
count — the same rule the sheet's snapping already followed, so a phrase placed by click and a
phrase placed by snapping are timed identically. A four-count chassé on the count at 22.500
therefore arrives at 23.5 and again at 24.5, a count per transfer; a pas de bourrée takes three.
The alternative reading — first station *on* the clicked count — would have made the two gestures
disagree, and the counts a phrase divides are the ones it moves through.

**Where the model keeps it.** `phraseStart(show, dancer, opts)` resolves a start three ways and is
now the only place that decides: a moment on the show's clock (`at`, `atBar` for a bar), the next
count or bar after the end of her path (`snap`), or the end of the path itself. `addPhrase` resolves
it once, hands the result down as `startLocal`, and reports it, so the placement and the message
cannot disagree. A count inside one of her holds is not a moment she can move on, so `localAtCount`
skips to the first count she is moving again on — the same rule as a point.

**Refusals, because they are cheaper than repair.** A phrase is built on the end of a path, so a
count she is already choreographed past is refused (`Ada is choreographed to 00:27.500 — start the
phrase after that, or press Continue from a point first`) rather than quietly cutting the stations
that follow: dropping work is what **Continue from** is for, and it says how much it is taking. A
count well past the end of her path is allowed — the leg into the phrase is then a long one — and
the message says how long it is (`1.50 s after her last point`), because that is the time she has to
cross the stage in. Picking another performer or pressing Esc cancels an armed phrase; the hint over
the stage says what is waiting.

**Checked.** In the model at 120 in four (count 0.50 s, bar 2.00 s): a chassé clicked at 4.300 s
began on the count at 4.500 and its stations fell on 5.000 and 5.500, 500 ms each; the same click
with the bar asked for began on 4.000, with a pas de bourrée's three transfers on 4.5, 5.0 and 5.5.
A path ending at 2.0 s with a walk clicked at 12.0 s put its one station on 13.0 s — two counts of
walking from the clicked count — and a click at content 2.0 s inside a 1.5 s hold began at content
2.5 s, the first count she is moving again on. In the app: a four-count chassé into arabesque on the
count at 00:22.500 gave stations 8 and 9 at 23.5 and 24.5 s of 1000 ms each, reported as
`2 stations (8–9) of Ada, from the count at 00:22.500 · 4.50 s after her last point`; the same
phrase with Shift and a bar clicked at 26.3 s began on the bar at 00:26.000 with three stations at
26.5, 27.0 and 27.5 s of one count each; Esc left `Phrase cancelled` and the next double-click
placed a plain point again (`Point 8 of Ada placed on the count at 00:22.500`); a click at 8.3 s was
refused with `Ada is choreographed to 00:27.500` and her path unchanged afterwards; picking
another dancer cleared the armed phrase. Console clean on a fresh load; test server stopped, the
show's own server on 4322 untouched.

A testing note worth keeping: the demo show has a 2 s pause in it, so a pointer x measured in
*display* seconds lands 2 s early in *content* seconds. My first two clicks were refused for exactly
that reason, which is what a refusal is for.

Where it still stops: the start is the only thing the ruler chooses — the phrase's direction and
position still come from the last leg of her path, so a phrase cannot be laid down somewhere else
along the stage; a phrase armed and then forgotten stays armed across a play-through, since only a
pick or Esc clears it; there is no preview of where the stations will fall before the click (the
caption still describes the end of her path, not the count you are pointing at); and a hold inside
the phrase's span still pushes its later stations off the music, which is the same limit phrases had
when they were only ever appended.

### Judged before the click (1 Nov 2026)

Placing a phrase on a bar worked, but you only found out where its stations fell *after* the
click: the counts a step divides were arithmetic done in the dark. A choreographer counts out loud
while placing, and the planner should count with them, so the ruler now previews the placement.

**What is drawn, and why those things.** Under the pointer, while a phrase is armed: a dashed
line at the count it would start on (the leg into the first station begins there), a diamond on
every count a station would land in, a tint along the foot of the ruler over the music it would
occupy, and a label in booth shorthand — `chassé · bar 12 · 2 → 3, 4` when it stays inside a bar,
`chassé · 12·4 → 13·1 13·2` when it crosses one. A start count alone would not have been enough:
what a choreographer is judging is whether the *arrivals* are on the counts they hear, and where a
bar line falls between two of them decides that.

**One arithmetic, not two.** `phrasePlan(show, dancer, opts)` runs `phraseStart` and then the same
`phraseStations` the placement uses, converting each station through content time into `countAt`
bar-and-count. Nothing about the preview is a second implementation, so it cannot promise a
station the click then puts elsewhere; it is read-only, so it is safe to call on every frame the
pointer sits on the ruler.

**The pointer is the state.** The timeline keeps `hover` (a moment and whether the bar was asked
for) and a `shiftHeld` flag, set by the pointer move and by key down/up — a held key with the
pointer still is a different gesture, and a preview that ignored that would promise counts the
click would not use. Off the ruler, unarmed, or after placing, the hover is dropped and nothing is
drawn. The ruler shows a `copy` cursor while a phrase is waiting for it.

**Checked.** In the app, hovering the ruler with a two-count chassé armed at content 22.3 s drew
accent diamonds (255, 183, 3) exactly at 23.0 and 23.5 s — the counts 3 and 4 of bar 12 — with the
start line at 22.5 s (215, 156, 7, a dashed accent) and nothing at 21.5 or 25.5 s, where the
background read (14, 19, 27); the label read `chassé · bar 12 · 2 → 3, 4`, drawn at x 919 of a
1223 px strip. Holding Shift moved the start to the bar at 22.0 s with stations at 23.0 and 24.0,
and the count-preview positions fell back to the tint. A chassé whose start fell on the last count of a bar labelled itself `chassé · 12·4 → 13·1 13·2`, the crossing case. The click then placed stations at exactly
23.0 and 24.0 — the previewed counts — and left no diamonds behind; pointing at the track area, at
the running-order band, or anywhere with nothing armed drew no label at all. No console errors
(the `prefEndFade` NaN warning seen during testing is pre-existing and unrelated).

Where it still stops: the preview says where the stations fall but not how long the legs are, so
an uneven split (a phrase whose counts do not divide into whole counts, like a seven-count pas de
bourrée) shows as the counts it lands *inside* rather than a warning that it is off the line; the
label is a single line, so four or more stations in a bar can overrun the strip's end; and it
previews only the start, since direction and distance still come from the last leg of her path.

### Counting the uneven division (1 Nov 2026)

The preview promised counts, and most of the time it keeps them. A phrase whose counts do not
divide into its transfers, though, leaves a station between two beats — seven counts over a pas de
bourrée's three is 2.33 and 4.67 — and nothing said so. It looked on the beat, it sounded a third
of a count late, and the discovery came in the studio instead of at the desk.

**One division, now literally.** The share arithmetic had been inside `phraseStations`, so any
warning about it would have been a second copy of the same sum, free to drift. It is now
`phraseShares(step, counts, countMs)`, which the stations are timed from and which the warning
reads, and `phraseOffsets` turns those shares into counts measured from the phrase's own start.
`phraseStations` lost its local `total`/`sumW`/`left` in the move; its stations are identical to
the millisecond (checked below), which is the point of doing it this way.

**Where the warning is, and why there.** Two places, both before the phrase exists: the sheet's
caption, which reports the division of the *shape* and so needs no start and no path —
`· 2 of 3 arrivals between counts (2.33, 4.67)` — and the ruler preview, which marks the actual
stations. There, an arrival between counts is drawn as a **hollow** diamond instead of a filled one,
and the label says `· 2 of 3 between counts`. A hollow diamond is the honest mark: the count labels
beside it still read `12·3`, because that is the count the station falls *inside*, and the fill is
the only thing saying it is not *on* it.

**How "on the count" is decided.** `offCount` compares a station's content time with the count
nearest it and calls anything within `COUNT_EPS` (2 ms) on the beat. That tolerance is not
decoration: at 90 bpm a count is 666.67 ms, so seven counts over three transfers ends 0.67 ms off
the line — arithmetically on it, and a warning there would be noise. The same number is used by
the caption's filter, so the sheet and the ruler cannot disagree about a phrase.

**Checked.** In the model: a four-count chassé shares 1000 + 1000 with arrivals at 2 and 4 counts;
a three-count pas de bourrée 1, 2, 3; a seven-count one 2.334, 4.668 and 7, at 120 and again at 90
bpm (7.001, inside the tolerance). A four-count chassé placed on the bar at 22 000 ms still put its
stations at 23 000 and 24 000 — the extraction moved no timings. A seven-count pas de bourrée's
plan from the same bar read stations at 23 167 (+167 ms), 24 334 (−166 ms) and 25 500 (0), with
`off: 2` and `worst: 167`; a six-count one read 0, 0, 0. In the app: the sheet's caption for the
even phrase carried no note, and for the seven-count one read `· 2 of 3 arrivals between counts
(2.33, 4.67)`; the ruler preview labelled the even phrase `chassé · 12·1 → 12·3 13·1` with both
diamonds filled (255, 183, 3 at their centres) and the uneven one `pas de bourrée · 12·1 → 12·3
13·1 13·4 · 2 of 3 between counts` with the two between-count diamonds hollow — their centres read
the tint (57, 49, 22) rather than accent — and the last filled. No console errors; test server
stopped, the show's own server on 4322 untouched.

Where it still stops: the caption warns about the division, not about a **hold** inside the phrase,
which still walks its later arrivals off the music; the numbers are counts from the phrase's own
start, not bar-and-count, so a warning still needs the ruler to be read as a bar; and the marks are
7 px wide at default zoom, which at a very wide zoom is smaller than the count spacing can show
distinctly, so a crowded bar reads as a zigzag rather than as two kinds of diamond.

### A hold in the middle of a phrase (1 Nov 2026)

The between-counts warning catches a phrase that divides badly. It cannot catch a phrase that stops
in the middle: a hold freezes her clock, so the arrivals after it are pushed later in the music by
its length — and when that length is a whole number of counts, every arrival is still on a beat.
The phrase then quietly takes six counts where the sheet promised four, and the only way to find out
was to count along in the studio.

**Where the fact comes from.** `holdsWithin(show, trackId, from, to)` — holds strictly after `from`
and up to and including `to`, in the dancer's own clock. Both ends matter and are not symmetrical:
a hold at the moment the phrase begins is what happens *before* it (or, when it is crossed into, it
is what `localAtCount` steps past), so it is not inside the phrase; a hold on the last station still
freezes her there, so it is. `phrasePlan` reports `holds` and `stretch` (the milliseconds they add)
from the phrase's resolved start to its last station, and `addPhrase` reports the same pair so the
placement can say it again once it is done.

**Where it is said.** In three places, all with the same numbers: the sheet's caption
(`· crosses 1 hold (+1.00 s)`), the ruler preview label (`· 1 hold inside` — kept short, because the
label already carries the counts), and the hint after the phrase is placed. The preview could have
marked the hold itself, but the hold band is already drawn on her row a few pixels below the ruler;
saying "inside" is what the ruler cannot show.

**Why it is separate from the between-counts warning.** They answer different questions. A hold of
1000 ms at 120 bpm moves every arrival by exactly two counts: all on the beat, all still wrong
because the phrase now occupies six counts instead of four. A hold of 700 ms moves them by 1.4
counts: also off the beat, and then both warnings appear together, which is honest — the phrase is
both stretched and ragged, and one is the cause of the other.

**Checked.** In the model at 120 in four: a 1000 ms hold inside a four-count chassé placed at 0 put
its stations at content 2000 and 3000 — on the counts, `off: 0` — with `holds: 1` and
`stretch: 1000`; the same phrase placed left two stations at 1000 and 2000 locally and reported the
hold again. A 700 ms hold gave stations at 1700 and 2700 (`off: 2`, worst 200) plus the hold. A hold
exactly at the start reported `holds: 0` and pushed the whole phrase to content 2000/3000, and a
hold after the last station reported `holds: 0`. Two holds (600 + 900) inside a six-count pas de
bourrée gave arrivals at 2500, 3500 and 4500 — all on counts — with `holds: 2`, `stretch: 1500`.
`holdsWithin` on a hold at 1000 counted it as inside `(0, 1000]` and not inside `(1000, 2000]`. In
the app, with a 1000 ms hold injected on Ada's row after the end of her path, the sheet's caption read
`after point 6 of Ada (00:18.000) · 4 counts at 120 = 2.00 s · 2 stations, 1.4 m of travel · crosses
1 hold (+1.00 s)` for all three alignment choices; the ruler preview over bar 10 at 18.000 s labelled
`chassé · 10·1 → 11·1 11·3 · 1 hold inside` (arrivals at 20.0 and 21.0 s, every one on a beat, which
is exactly the case the old warning missed), and placing it there reported `· crosses 1 hold
(+1.00 s)`. No console errors beyond the pre-existing `prefEndFade` warning; the injected hold was
removed by clearing the browser's storage, my test server was stopped, and the show's own server on
4322 was left alone.

Where it still stops: it says a hold is inside, not which station it comes before or how far the
arrivals move (the hollow diamonds say that only when the shift is not a whole count); the phrase is
still placed across the hold rather than split into two phrases with the hold between them, which is
what a choreographer would actually write; and a hold that begins exactly on a station is counted as
inside, which is right for the stations after it but reads oddly when it is the last one.

### Splitting a phrase at a hold (1 Nov 2026)

The warning came first, and it was honest about the wrong thing: a phrase that crossed a hold was
*stretched*. Every arrival after the stop landed late by the length of the hold, so a chassé counted
to four arrived on counts two and five. Knowing that is better than not knowing, but it is not what
the counts meant.

**What a station is timed against now.** The shares are still her own time — a chassé's two transfers
of a count each — but each station is placed on *the music's* clock first: the phrase's start plus
the counts it was counted to. It is then mapped back into her own clock through the holds, so a stop
falls between two arrivals and she resumes after it and arrives where she was counted to. In numbers:
a four-count chassé from 18.0 s with a 500 ms hold at 18.2 s now has stations at her 18.5 and 19.5,
which is content 19.0 and 20.0 — counts 2 and 4 — where it used to be 19.0 and 20.5. Her own legs
change length with it (1000 ms and 500 ms in her clock), because the hold's half-second was never
hers to dance.

**The case that cannot be split.** A station whose count falls *inside* the hold has no moment to
happen at: she is frozen through it, and the app's own mapping puts a station at the hold's start at
the hold's end. Pushing that station to one side and the rest onto their counts would put the path
out of order — the pushed station's local time would be later than the next station's. So the
placement is refused instead: `A hold at 00:19.000 covers one of Ada's counts — place the phrase
either side of the stop, or use fewer counts`. The time in that sentence is the start of the hold's
band as the ruler draws it (a millisecond before the freeze, rounded to the tenth the show is placed
in), so it matches what is on screen rather than the millisecond after it.

**How the sheet knows before the button is pressed.** `phrasePlan` compares each placed station's
content time with the time its count said it should have (`phraseShares` again, from the plan's own
start), and calls the difference a swallow. That gave the caption `· a hold covers a count` and the
preview label the same words in place of its station counts — the counts are precisely what cannot
happen there, so promising them beside a warning would be worse than not promising them at all. When
no station is swallowed the caption says `· split by 1 hold (+0.50 s)` instead.

**Checked.** In the model at 120 in four: a four-count chassé from 0 with a 500 ms hold at 1.3 s put
its stations at local 1000 and 1500, content 1000 and 2000 — counts 2 and 4, `swallowed: 0`, where
the old arithmetic gave 1000 and 2500. A 1000 ms hold at 1.5 s over a six-count pas de bourrée
displaced its middle arrival (content 2500 for a nominal 2000) and reported `swallowed: 1`. With no
holds the stations are exactly what they were (23 000 and 24 000 for a four-count chassé from a bar
at 22 000), and a hold after the phrase changed nothing. In the app: with a 500 ms hold at 18.2 s on
Ada's row, the caption read `after point 6 of Ada (00:18.000) · 4 counts at 120 = 2.00 s · 2
stations, 1.4 m of travel · split by 1 hold (+0.50 s)`, the preview labelled `chassé · starts 10·1 →
10·3 11·1 · 1 hold inside`, placing it reported `· split by 1 hold (+0.50 s)`, and her path gained
stations at content 19.0 and 20.0. With the hold moved to 19.0 s for 1000 ms — covering the first
arrival — the caption said `· a hold covers a count`, and both the sheet's button and the ruler
refused with `A hold at 00:19.000 covers one of Ada's counts …` while her path stayed at six
stations. No console errors beyond the pre-existing `prefEndFade` warning; the injected holds were
removed with the browser's storage, my test server is stopped and the show's own server on 4322 was
left alone.

Where it still stops: the split does not finish the first half before the stop — that came in the
next step, below; a phrase that would be refused is
still *previewed* with its stations bunched at the hold's end, which is honest but reads oddly if
you only look at the marks; and the refusal is judged from the phrase's own counts, so a hold added
to the row afterwards can leave an already placed phrase straddling it with no second warning.

### The half finished before the stop (1 Nov 2026)

Splitting a phrase fixed where its *arrivals* fell but not where the freeze found her: with the hold
mid-leg, she stopped part-way through a transfer and held a pose that was neither station. A hold on
a dancer's row reads as "stand still there", so the picture was wrong even though the counts were
right.

**The rule.** The phrase's arrivals are aimed at moments on the show's clock (`phraseMoments`, new:
the start plus the counts, with the holds applied) and the arrival due before a hold is moved onto
the last instant before it — so the half before the stop is *finished* when the music stops for her,
and she holds that station's pose. `phraseStations` and `phrasePlan` both read those moments now
rather than each computing nominals, which also keeps the swallow test honest: a station that lands
somewhere other than its aimed moment is displaced by a hold, and that is still what refuses a
placement that would eat an arrival.

**Where the rule does not apply.** A hold that begins before the phrase's *first* arrival has no
half to finish: the phrase has not reached a station yet, and rushing its opening transfer onto the
stop would be a worse distortion than the one being removed. Those phrases are split (their later
arrivals still land on their counts) but the opening transfer is interrupted where it falls. Both
cases are one sentence: the arrival due before the stop moves onto it, if there is one.

**What it costs.** A hold inside a phrase always takes one transfer's worth of her dancing time,
because the phrase's music is fixed and her clock is frozen for the hold. Moving the pre-stop arrival
onto the stop decides *where* that cost lands: the transfer after the stop is danced in what is left
of it, so a half-second hold inside a one-second transfer leaves about a tenth of a second of
movement after the release. The alternative — leaving the arrival on its count — spreads that
movement before the freeze instead, and freezes her near the *other* station. Neither is free; this
one keeps the pose that is actually being held, which is what a hold is for, and the leg can be
re-timed by hand afterwards.

**Checked.** In the model at 120 in four: a four-count chassé from 0 with a 500 ms hold at 1.3 s
aimed its arrivals at 1299 and 2000 — the first on the last instant before the freeze — and placed
them at local 1299 and 1500, both content times exact and `swallowed: 0`; a six-count pas de bourrée
with a 400 ms hold at 2.1 s aimed at 1000, 2099 and 3000, so its middle arrival finished before the
stop and its last stayed on count 6. A hold at 0.6 s — before the first arrival — left the arrivals
at 1000 and 2000 untouched (`swallowed: 0`), and a 1000 ms hold at 1.5 s over the same six counts
still displaced its middle arrival and reported `swallowed: 1`. No holds, and a hold after the
phrase, left every station exactly as before. In the app, with a 500 ms hold at 19.4 s on Ada's row,
the caption read `· split by 1 hold (+0.50 s)`, the preview labelled `chassé · starts 10·1 → 10·3
11·1 · 1 of 2 between counts · 1 hold inside` (the first arrival deliberately off its count, at the
stop), placing it reported the split, and her path gained stations at content 19 399 and 20 000 —
she arrives as the hold begins and again on count 4. With the hold moved to 18.2 s — before the
first arrival — the same placement put her stations at content 19 000 and 20 000, untouched. No
console errors beyond the pre-existing `prefEndFade` warning; the injected holds were cleared from
the browser's storage, my test server is stopped and the show's own server on 4322 was left alone.

Where it still stops: the movement after the stop is squeezed into whatever is left of that leg, so
a long hold in a short transfer gives a quick, close-to-a-snap move after the release (fixed below);
the arrival that finishes on the stop is off its count by design and shows as a hollow diamond, which
reads as a mistake unless you also read the hold note beside it; and a hold that begins before the
first arrival still freezes her in the opening transfer, with nothing said to explain the difference.

## Sharing a stop's cost between the pose and the step (1 Nov 2026)

The rule above finished a split phrase's first half on the stop, and paid for it out of the transfer
that followed. In the case that rule was written for — a half-second hold inside a one-second
transfer — that left **101 ms** of dancing after the release: a station reached by a snap, which is
not something a dancer can do and not something a choreographer can hand to one. The pose was right
and the step was gone.

**What changed.** The arrival still moves towards the stop, but only as far as the leg after it can
spare, and that leg keeps at least half of the counts it was given (`PHRASE_LEG_KEEP` in
`phraseMoments`). Both quantities are measured in *her* clock, not the music's: the hold already
sitting in that leg has taken its own share of the counts, so what is left of them is what the
arrival may spend. Three outcomes, one rule:

- a **short hold** (100 ms inside a 1000 ms transfer) leaves 900 ms of leg, 500 of which is the
  floor, so the arrival has 400 ms to move — it reaches the stop exactly, and the leg still keeps
  its half second;
- a **half-length hold** (200 ms) leaves 800, so the arrival moves 300 of the 400 it wanted and stops
  100 ms short of the freeze, with the leg on its 500 ms floor;
- a **hold that is itself half the transfer** or more leaves nothing to give, so the arrival stays on
  its own count and both stations stay on the counts they were counted to. She is frozen part-way
  through the transfer, near the far station rather than at the near one — the picture the split was
  built to avoid, but the only one the music offers.

**Why not spread it further.** The literally-even reading — divide the hold's duration across every
leg after the stop and let the later arrivals run late — was rejected. It cannot coexist with the
split: moving the music under a station is exactly the stretch the split exists to prevent, and in a
two-station phrase (the common case) "spread across the legs after it" is one leg, so it would have
put the 500 ms back by making the arrival land 0.4 s after its count. A late arrival is a wrong
count; a held pose a little before its station is a wrong picture. This keeps every arrival that
follows a stop on its count, which is what the counts were spent for.

**Checked.** In the model at 120 in four (chassé, 1000/1000 shares): a 500 ms hold at 19.4 s gave
legs 1000/500 with content 19 000 and 20 000 — `off 0,0` — where the old arithmetic gave 1399/101; a
200 ms hold gave 1300/500 with the first arrival at 19 300, a 100 ms hold gave 1399/501 with the
arrival at the stop, and a 900 ms hold kept `swallowed: 1` (a count inside the hold is still
refused). A six-count pas de bourrée with 300 ms at 19.4 s gave legs 1200/500/1000 — the third leg
untouched, the second on its floor — and with 500 ms at 19.4 s legs 1000/500/1000, all on counts. A
hold at 18.2 s, before the first arrival, left 500/1000 and both counts as before. In the app, with
a 500 ms hold injected at 19.4 s on Ada's row, the sheet's caption read `after point 6 of Ada
(00:18.000) · 4 counts at 120 = 2.00 s · 2 stations, 1.4 m of travel · split by 1 hold (+0.50 s)`,
and placing a four-count chassé there added stations at local 19 000 (`dur` 1000) and 19 500 (`dur`
500) — the post-stop transfer with its half second intact. No console errors beyond the pre-existing
`prefEndFade` warning; the injected hold and the two test stations were removed from the browser's
storage, my test server is stopped, and the show's own server on 4322 was left alone.

Where it still stops: the floor is a fraction of the *counted* share, not of what the hold has left,
so a hold longer than half a transfer cannot be answered — the leg is short because the music is
short, and the app says nothing about it (the arrival shows as a hollow diamond only when it was
moved at all); the arrival stopped short of the stop is not explained in words anywhere, so a held
pose a hand's width from its station has to be read off the diamonds; and spreading over several
legs — the only version that would keep both the pose *and* the counts for a long hold — is not
possible without moving later arrivals off their counts, which is the stretch the split replaced.

## Which foot is on the floor (1 Nov 2026)

The first step of `PLAN-FOOTING.md`, and the first time anything in the planner knows that a
figure has weight. Until now the body was pinned to its path and the feet were whatever the
position's angles put below it: every ankle sits between 1.7 cm and 8.5 cm above the deck
(they are joints, not soles), and a change of position moved the feet even when the body did
not.

**What a station now carries.** `plant` — `left`, `right`, `both` or `air` — absent meaning
"work it out". The working out is one pass forward along the path (`plantsOf`), because a
step's foot depends on the foot before it: a typed plant wins; a station off the deck has no
foot under it; a position says which foot carries, taken from the angle table itself
(`PLANT_BY_POSE` in `pose.js`, beside the angles, because "an arabesque stands on the leg that
is not lifted" is a fact about the drawing, not a preference); and a station with no position
is a plain step, which leaves on the other foot. A path that begins with no position begins
standing, on both feet, rather than beginning on an arbitrary side.

**Two things are now checkable, and both are checked.**

- *A foot that is not there.* `plantProblem` measures each candidate foot's height above the
  deck at that station: more than 0.15 m and it is not carrying anybody. A right-foot plant
  typed into an arabesque reports 0.62 m; the automatic left-foot plant reports nothing. A
  station whose level is in the air resolves to `air` on its own, so a jump does not have to
  be told it has no foot down.
- *A foot that skates.* `footSkate` measures a stance foot across a leg that does not travel,
  and only where the plant is a single foot: changing from first to second moves both feet and
  always has, and a travelling leg is a step. A pirouette followed by a chassé on the same
  spot reports the left foot moving 0.33 m; fifth into second reports nothing; a leg that
  travels 1.4 m reports nothing (it is a step, not a skate); a tendu into an arabesque reports
  nothing (the standing ankle moves 1 cm).

**What it cannot see, and says so.** Only the across-stage component. The positions are drawn
from the front, and `joints()` has no fore/aft: a foot's depth is taken as the body's own. So
a skate upstage reads as zero, and the number in the warning is a minimum, not the whole
story. That half arrives with the leg solve, when a contact point gives the foot a depth to be
held at — which is also why `footAtLocal` returns `y` straight from the path and marks the
ankle height separately.

**Where it shows.** The point strip gains a picker whose first entry names what was worked out
(`auto — left`), because a value you did not choose should not pretend you did; the field is
committed as one undo step and stored only when typed. The warning sits next to it, in the same
line, so a choice and its consequence are one glance apart. The printed station table gains a
**Plant** column (`left foot`, `both`, `in the air`), which is what a rehearsal room needs:
shape and weight in the same row.

**Checked.** In the model: a path of fifth → tendu → arabesque → pirouette → (no position) →
(no position, in the air) resolved to `both, left, left, left, right, air`, every one
automatic; a right-foot plant typed into an arabesque flagged at 0.62 m in the air while the
automatic one was clean; a bare path resolved `both, right, left, both, right, air, right`; a
second-position station placed its feet at +0.364 m and −0.364 m across (0.73 m apart, matching
the pose table) and a 0.35 m lift raised both ankles to 0.415 m. In the app: station 2 of a
pirouette → chassé path read `auto — left` with `Ada's left foot skates 0.33 m across the
stage into this point`; typing `left` into an arabesque station stored `plant: "left"`, and the note
repainted a frame later as the skate note for the new stance, which is the strip doing exactly
what it should. On paper, the station table printed `# | Time | Pose | How in | Plant | Across
| Depth` with `left foot` on the typed station and `both` on the opening station of a bare
path. No console errors; the injected show was cleared from my test origin, my server is
stopped and the show's own server on 4322 was left alone.

Where it still stops: nothing is drawn from any of it yet — the figure still shows where the
feet are, not where the weight is, and the foot marks and the leg solve are the next two steps
in `PLAN-FOOTING.md`; the skate figure is across-stage only, so it under-reports; the plant is
edited on the focused point only, not in the inspector's station list; and the step table the
plan proposed (which foot a chassé lands) was dropped, because with no fore/aft the pose table
already says everything the step could, and a second guess would only disagree with the first.

## Footprints on the plan (1 Nov 2026)

Step 2 of `PLAN-FOOTING.md`. Step 1 made the planner know which foot carries; nothing showed it.
The plan drew a body and a path, and the floor — the one thing a plan is for — carried no mark
of where the feet were.

**What is drawn.** Two marks under each dancer, from `footAtLocal`: the foot she is standing on
filled in her own colour with a dark rim, the other a hollow ring, and a foot the position has
lifted (arabesque's back leg, 0.62 m up) a faint smaller ring, so an arabesque reads as one foot
down rather than as two. The plant used is the *departure* station's while she is between
stations — the foot she is leaving on carries the stance, not the one she is arriving on — and
the whole thing is read at `localOfContent`, so a hold freezes the feet with her rather than
letting them drift through a stop.

**Under the body, on purpose.** The first version drew the marks after the avatar, which put two
dots on the dancer's middle whenever her feet were together: the body disc is 10–12 px across
and a fifth-position pair is 4 px apart, so every ordinary stance looked like a bug. Drawing
them *before* the avatar makes the mark a footprint — visible where the feet are apart (second
position is 0.36 m either side, roughly 14 px at the plan's usual scale), hidden where they are
together, which is exactly what a plan of a person standing looks like from above.

**The streak.** `footSkate`'s finding, drawn: a red dashed line from where the stance foot began
the leg to where it ended, with a dot at the start so it reads as a direction rather than a
scratch. It is drawn over everything (it is a warning, not a mark), only for the dancer being
edited, and only when the playhead is inside that leg or that station is the one being edited —
the two moments when the number in the strip is on screen. The same threshold (5 cm) and the
same numbers, so the line and the sentence cannot disagree.

**Checked.** In the app, with Ada on a pirouette → chassé leg at one spot (a 0.33 m skate) and
selected, sampling the stage canvas found 17 pixels of the danger colour and 63 of her own —
the dashed streak and the filled marks. Selecting another dancer dropped the danger pixels to
zero while her marks stayed drawn, which is the "only for the dancer being edited" rule holding.
No console errors beyond the pre-existing `prefEndFade` warning (the `getImageData` note in the
log is my own readback probe, not the app). With a three-station path the arabesque station
drew one solid mark and one faint one. The injected show was cleared from my test origin, my
server is stopped, and the show's own server on 4322 was left alone.

Where it still stops: a foot's depth is the body's, so the two marks are always drawn on the
same line of the stage and a fourth-position split, which is fore-and-aft, reads as a lateral
one — the same missing axis as the skate measurement, and it will only be fixed by giving the
positions a fore/aft term; the marks are on the screen's plan only, not yet on the printed plot
(step 6, where a cross at each station's contact point is the plan); a foot mark does not say
*which* foot it is, which matters for a rehearsal reading the plan without the strip; and the
trail of ghosts behind a moving dancer is drawn over the feet of the dancers behind her, since
it is part of the same body's pass.

## Contacts on paper (1 Nov 2026)

The printed side of step 2. The plan had feet on the screen and paper had none, which is the one
kind of disagreement this project has never allowed: paper is what the crew and the rehearsal room
actually hold.

**What is drawn.** `footMarks` — a cross at each foot that is on the deck and carrying her, a small
open ring for the other foot when that one is down too, and nothing at all for a foot the position
has lifted (arabesque's back leg is 0.62 m up; a contact point is a place the floor is being stood
on). It sits under the station's numbered circle on a path sheet and under the performer's circle on
the plot, which is the same order as the screen: the body covers the mark when her feet are
together, and a spread stance shows both marks either side of her. Two stations of a `second`
position printed their crosses at ±10.7 px around a circle of radius 8.5, and a `tendu` printed one
cross and one open ring for the foot it is not standing on.

**Why not draw them on top.** Two dots printed on the number circle is worse than no dots: at the
path sheet's scale, feet together are 2.9 px apart, so the mark would land on the digit and read as
a printing fault. Underneath, a together stance looks exactly like what it is — a body over its own
feet — and the table beside it carries the fact in words.

**Where it is said.** The plot's legend gains `Foot on the deck · the open one is free` with a cross
for a swatch (a small CSS cross, not a swatch, because that is what the mark is), and both sheets
say it in a sentence: the plot's note explains the cross and the unmarked lifted foot, the paths
page's note explains the cross and the open ring and points at the Plant column.

**Checked.** A test show with `second` → `arabesque` → `tendu` printed 4 crosses on its path sheet:
both feet at `second` (±10.7 px in the dancer's own ink, just outside the 8.5 px station circle),
one at `arabesque` (the standing left foot, 2.5 px out, with no ring for the lifted right one), one
at `tendu` with an open ring 11.5 px the other side for its free foot. The plot at the top of the
show printed two crosses under each dancer, and the legend read `Foot on the deck · the open one is
free`. The demo show's five plan figures came out at 12, 0, 14, 12, 12 cross strokes — the zero is
the elevation, which has no floor plan and correctly gets none. No console errors, the injected show
was cleared, my server is stopped and the servers on 4322 and 4325 were left alone.

Where it still stops: a foot's depth is the body's, so a cross is always on the same line of the
stage as the body and a fourth-position split prints as a lateral one; a stance with the feet
together hides its crosses under the numbered circle (the table's Plant column is the answer there);
the crosses are only on the plot's opening picture and on the path sheets, not on the curtain-call
tableau, which is a decision — the tableau is about the closing picture, and five dancers of crosses
would crowd it; and a cross does not say *which* foot it is, only where the weight is.

## The legs that keep their feet (1 Nov 2026)

Step 3 of the footing plan, and the first time the figure is solved rather than posed. Until now
the elevation drew the position's own legs and the body's place on the stage, and the two had no
conversation: a dancer standing still who changed from second to arabesque moved her standing foot
11 cm sideways, and one who travelled 0.9 m moved both of hers the whole way with her. The plan
already knew where the feet were — it draws the marks — so the picture was the odd one out.

**How it is done.** `footPins` reports, per foot, a contact and a weight: the departure station's
contact for the first third of a leg, the arrival station's for the last third, and a blend in
between, read on the dancer's own clock so a hold freezes the feet with her. `joints` takes that
weight and, for anything above zero, moves the ankle from where the angles put it toward the
contact and re-places the knee: two equal segments with the hip fixed have exactly one bend that
reaches a given spot, and of the two mirror answers it keeps the one nearer the pose's own knee, so
an arabesque's standing leg still bends like an arabesque's. Same joint table as the screen and the
paper, so nothing can disagree — the rule this project has kept since the first printable sheet.

**The step in the middle.** A foot with a foot's length to travel cannot slide that far along the
floor; it goes through the air. So between two different contacts the pin lifts in an arc, peaking
at the middle of the transfer, 3.5 cm up for a 10 cm shuffle and 12 cm for a stride or more — and
nothing lifts at all where the two contacts are the same spot, which is what stops a dancer standing
in second from rising onto nothing every time she changes position.

**What it cannot do, said out loud.** Past the leg's length the solve cannot reach, and the drawing
says so by straightening the leg toward the contact with the foot stopped at the leg's end: a step
too long for one stance is visible instead of the leg breaking. That failure is not yet in words,
and it is the next thing worth saying — a step further than her leg can reach should be a
sentence, not just a stretch. And the solve has one axis: the pose table still carries no fore/aft,
so a fourth-position split is solved as a lateral one and a skate upstage is still invisible.

**Checked.** A standing leg (`second` into `arabesque`, left foot planted) holds its ankle at
0.364 m for the first third where the unsolved figure had slid it to 0.254 m, then swings onto
0.085 m and stays; a 0.9 m travelling leg holds its contact to the millimetre while the body leaves
it and then swings the foot the whole 0.9 m with the ankle lifted to 0.077 m at mid-swing; `second`
to `second` with no travel moves nothing and lifts nothing; leg length never leaves 0.884 m. The
app loaded a three-station test path, played through both legs and reported nothing to the console.
My test origin was put back afterwards; the servers on 4322 and 4325 were not touched.

## The step she cannot take (1 Nov 2026)

The solve straightened the leg when it could not reach a contact, and said nothing about it. That is
the same fault as a skate from the other side — a foot that stays where it is while the body leaves
it — and it is the more expensive one, because it means the step is too long for the stance it was
given. It is now a sentence in the point strip, next to the other two plant checks.

**How it is found.** `joints` records in `shortfall` what each leg was asked for and could not have:
the distance from hip to the requested ankle, less twice the leg's length, in body units. The
requested ankle is the *blended* one the solver actually used, so a foot mid-swing is judged by where
it really is rather than by the contact it is heading for. `legOverreach` walks the leg in sixteen
steps — the furthest moment is normally part-way through a transfer, not at either station — rebuilds
the same spec the elevation draws (rise and landing plié included, since a plié shortens the leg), and
keeps the worst side. Same joints as the picture, same rule as everything else here: the sentence and
the drawing cannot disagree about what is happening.

**Why it needs a threshold, and why a hand's width.** The position table's legs are already at their
length — second position is a wide stance with the legs straight — so a stance spread sideways is a
centimetre or two past the limit before anything is wrong, and a warning that fires on every second
position is a warning nobody reads. `REACH_SLACK` is 0.15 m, the same hand's width that decides a
foot is off the deck: below it the leg straightens imperceptibly and the foot is still doing its job;
above it the contact has visibly gone.

**Checked.** A leg travelling 0.3, 0.6, 0.9, 1.2 and 1.5 m across the stage during a held first
position reports nothing; 2.4 m reports the left leg 0.30 m short (worst at 1.25 s of a 4 s leg, which
is the moment the body is furthest from the contact it is leaving); a body standing still
through second → arabesque reports nothing; the first station of a path reports nothing, as it has no
leg into it. In the app on a two-station test path, station 2 read `Ada's left leg is 0.30 m too short
to keep her foot planted into this point`, and on a three-station path the slot showed, in order, no
note at station 1, `Ada's left foot skates 0.33 m across the stage into this point` at station 2 and
`Ada's right foot is 0.62 m off the deck here, so she cannot stand on it` at station 3 — the three
faults, one at a time, in the order they matter. The two older messages gained the dancer's name,
since the third one needed it to be a sentence. No console output on a clean load; my test origin was
cleared, my server stopped, and the servers on 4322 and 4325 were not touched.

**Worth knowing.** The demo sketch lights up: its paths are four-metre hops between stations, so most
of its legs are short of their contacts by 0.2–0.9 m. That is not a bug in the check, it is the sketch
being scribble rather than choreography — a step that long is one no stance can hold.

## The gap on the floor (1 Nov 2026)

The warning said it in words; the floor now shows it. `legOverreach` was already finding the worst
moment of a leg and how far past the leg's length the foot was asked for — the elevation needed that
to straighten the leg honestly. The plan needs the same fact in two dimensions, so the same calculation
now also reports the two ends of the gap on the floor: the mark the foot is meant to be on
(`body + pin`, the pinned contact) and where the leg actually runs out (`body + pin − overX`, the
contact pulled back along the leg towards her). `joints` supplies `overX` beside `over` for exactly
this: the part of the shortfall that is across the floor rather than up the leg.

**How it is drawn.** An open ring at the mark — open, because a filled mark would say her weight is
on it, and it is the one thing here that is definitely not happening — a dashed red line from that
ring to the dot where the foot really is, and nothing else. Same colour, same dash and the same rule
as the skate streak: only the dancer being edited, and only on the leg the playhead is in or on the
station being edited. Two warnings on one floor would be a floor nobody can read, so the strip shows
only the first fault that applies and the plan draws only the streak that belongs to it.

**Why the gap is not the whole number.** `over` is measured along the leg and includes how far up or
down the foot is; the plan can only show the floor. On a 2.4 m step the strip says 0.30 m and the floor
draws 0.20 m — both true, both about the same foot, one from the side and one from above. Saying that
in the notes is cheaper than making the plan lie about a third dimension it does not have.

**Checked.** In the model: a 2.4 m step with the left foot planted gives a gap from x −1.10 to
−0.90 at y 2.20 — 0.20 m across, the mark she is leaving behind her and her reach short of where she
now is — and the same step mirrored gives the mirrored gap; a 1.5 m step gives nothing, because it stays inside the hand's width
of give. In the app on the plan canvas: 31 pixels of the warning colour with the dancer visible and the
station in focus, and zero with her hidden — so every one of them belongs to this mark and to nothing
else on the stage. No console output beyond my own pixel-readback warnings; the test origin was
cleared, my server stopped, and the servers on 4322 and 4325 were left alone.

**A thing to remember when testing.** A paused page in this browser does not redraw: the frame loop
runs, but the canvas only repaints while the show is playing or something wakes the window. Counting
pixels on a paused canvas measures the last frame the tab was given, which is how an earlier attempt
at this check reported zero for a streak that was in fact being drawn.

## The hips over the foot (1 Nov 2026)

Step 4 of the footing plan, and the last thing that separates the figure from an articulated stick. A
dancer standing on one leg is not the same drawing as a dancer standing on two: the weight is over the
foot that carries it, the other hip sags, and the whole line of the body leans to that side. The
elevation drew neither, so an arabesque read as a body floating with one leg up rather than a body
standing on one.

**Where the number comes from.** Not a new column in the position table — the pins already know which
foot is on the deck, and the same weight that holds a foot on its contact is the weight that belongs
over it. `joints` reads it: one pin means that side carries her, two pins mean the weight is between
them and the hips stay square. `HIP_SHIFT` is 0.035 of her height (6 cm at 1.7 m) for the stance
socket and `HIP_DROP` is 0.022 (3.7 cm) for the free one, and both multiply the pin's own weight, so a
change of weight through a leg moves the hips across the transfer instead of snapping at the station.

**Two decisions worth keeping.** The stance socket moves and the free socket only drops: a pelvis
tilts, it does not slide, and moving the free socket pulls an extended arabesque leg out of reach of a
place the position already put — the first version did exactly that and opened a 2 cm gap in a leg
nobody had complained about. And the free ankle is *held* while its hip drops, by the same two-bone
solver the contacts use, so the sag bends that knee rather than pushing the foot through the deck: a
dropped hip over a planted tendu toe would otherwise have put that foot 2 cm underground.

**What it does to the numbers already built.** The reach check measures from the hip, so shifting her
hips over the foot she is leaving slightly shortens her reach behind her: a 2.4 m step that was 0.32 m
short is now 0.30 m, and the worst moment of that leg has moved from 2.5 s (the transfer) to 1.25 s
(still holding the departure contact). Both are more correct than before; the warnings, the plan gap
and the docs were re-measured to match.

**Checked.** With both feet planted the joints are identical to the previous version, field by field —
no pins means no weight shift, and a show nobody has touched draws as it did. On one foot at weight 1:
pelvis 4 cm across and 1.9 cm lower, stance socket 6 cm into the stance, free socket 3.7 cm lower, and
the free ankle at exactly the place the square pose put it (x −0.547, h 0.367 before and after) with
the knee taking the whole drop. At weight 0.5 every one of those is halved. At `facing −1` the shift
mirrors to the other side. In the app: the strip still reads `Ada's left leg is 0.30 m too short to
keep her foot planted into this point`, the plan still draws 31 pixels of the gap, and the only console
line is the `prefEndFade` warning that was there before this work (an end-fade setting absent from the
demo show, `rebuildPanels` writing `NaN` into a number input) — untouched here because it is a
different fault in a different panel.

## The axis that was missing (1 Nov 2026)

Step 7, and the end of a caveat this project has carried since the first posed figure: the pose table
had angles only in the elevation's plane, so a foot's depth was read as the body's own. Everything
downstream inherited that — a fourth position drew as two legs squeezed together, a tendu devant and
a tendu derrière were the same picture, a skate upstage measured zero, and the plan could not say
which foot was in front.

**What a leg is now.** Three numbers instead of two: the hip's angle, the knee's, and `front` — how far
the whole leg swings towards the house (positive) or away from it. The first two stay in the frontal
plane; `front` shortens what that plane sees by its cosine, which is exactly the foreshortening the
house gets from a leg swung forward, and puts the ankle `leg × sin(front)` downstage or upstage. A body
also carries `rock`, tipping the weight line over the toes, so every foot ends up further upstage of
the pelvis than the legs alone would put it — a balance on the ball of the foot, seen from above.

**What pays for it.** A fore-and-aft split cannot be made by legs that are already at their length, so
fourth position's hips come down (2% of her height) and its ankles sit 9–10 cm up, which is an ankle
joint, not a hovering foot. That is what a dancer does and why the table is allowed to say it.

**What it changed without being asked to.** The skate check was the surprise: it measures a foot's
place, and a foot's place now has three axes, so a station that changes from first to fourth without
walking reports `her left foot skates 0.35 m on the deck`, where before the same movement was
invisible — the foot slid 35 cm upstage and the app said nothing. The message lost "across the
stage" for the same reason: it is no longer only across.

**Checked.** First, second, fifth and plié produce byte-for-byte the joints they produced before the
axis existed, because their `front` is zero — a show that never uses a split or a rock draws exactly
as it did. Fourth splits 0.35 m towards the house and 0.32 m away (0.66 m heel to heel), with its feet
at 9 and 10 cm; a tendu devant puts its free foot 0.24 m in front of her at 11 cm; an arabesque's
standing foot sits 9 cm upstage of the pelvis because the body is tipped 6° over it; chassé puts both
feet 8 cm behind her for the same reason. On the plan the two foot marks of a fourth position sit at
y 1.85 and 2.52 for a body at 2.20 — one in front, one behind. On the printed sheet the same dance
printed its crosses 30 px apart at a scale of about 45 px/m, which is the 0.66 m it should be. No new
console output; my test origin was cleared, my server stopped, and the servers on 4322 and 4325 were
left alone.

**Limits, honestly.** A foot's fore/aft is authored in the pose table, not solved against a contact —
the pins move an ankle sideways and up and down, not in depth — so a dancer keeping a foot planted
while she travels upstage has that foot declared rather than held. That is the one place left where
the three axes are not equal; the turn was the other, and it is closed below.

## Turning the split (1 Nov 2026)

The last thing standing between the two views and one body. The axis added this morning put a foot in
front of her or behind her, but only while she faced the house: a fourth position at a quarter turn
still drew the two legs squeezed together and the plan still put the feet fore and aft, because the
turn was doing its work by *narrowing* the figure rather than by rotating anything.

**What the turn is now.** Two projections of one pair of numbers. `feetPlaceOf` gives each ankle in the
body's own frame — x her left, y above the deck, z towards the house — and each view takes two of the
three. The elevation keeps x and y, narrowed by the turn as before, and adds back what the depth
carries: `z × sin(turn)` comes into the width, so at a quarter turn the split is as wide on screen as
it is long on the floor. The plan keeps x and z and *rotates* them by the turn, so the floor shows
where the feet actually are: a fourth position at 90° stands side by side, and her lateral spread
becomes fore-and-aft. Both start from the same pair, so they cannot disagree — the rule this project
has kept since the first printed sheet.

**The side the split lands on.** The elevation's narrowing already flips sign past a quarter turn (that
is why the figure appears mirrored from behind), and the depth term follows `sin`, so it needs no flip:
at 0° it adds nothing, at 90° all of the split, at 180° nothing again, at 270° all of it on the other
side. That is exactly a cosine-and-sine rotation, with the artist's floor kept on the cosine so a dancer
in profile is a narrow figure rather than a vertical line.

**Half a turn is not the same as none.** Rotating the stance by 180° also turns her *devant* round, so
a fourth position facing upstage splits the other way: 0.35 m upstage and 0.32 m downstage, where at
the front it is the reverse. The pins are unaffected — they live in stage coordinates and never needed
the body's frame — and the weight shift reads its stance the same way it did.

**Checked.** Fourth position, in the body frame, at four headings: at 0° the feet are 0.14 / 0.10 across
and +0.35 / −0.32 in depth, and the elevation's ankle gap is 0.04 m; at 45° it is 0.34 / −0.15 across,
+0.15 / −0.30 in depth, gap 0.50 m; at 90° the feet are 0.35 / −0.32 across and −0.14 / −0.10 in depth —
side by side — with the elevation's gap 0.68 m; at 180° it mirrors back to a fore-and-aft split the
other way round, gap 0.04 m. Heading 0 is unchanged to the third decimal for both first and fourth, so
nothing that does not turn moves. In the app, a three-station path of fourth at 0°, 90° and 180° played
through with the plan's two foot marks travelling from one-in-front-of-the-other to side-by-side and
back again, and the console stayed silent. The `feetOf` helper that used to serve one foot per call was
removed rather than left as a second way to ask the same question.

**What is left unequal.** Depth is authored, not held: the pins move an ankle across and up and down,
never fore and aft, so a dancer travelling upstage with a foot planted has that foot declared by the
pose rather than held by the solver. That is the last place where the three axes differ, and it wants
the same two-bone treatment in the other plane.

## Holding a planted foot in depth

**One frame, and it was the wrong one.** The pins carried a `z`, but it was measured along the stage —
how far upstage the contact was — while every leg in `joints` is solved in her own frame, where `z` is
how far towards the house a foot is. The two were negatives of each other, so the solver held the foot
at the mirror image of its mark: a plaster cast of the contact, in front of her when it should have been
behind. Nothing showed it while she stood still, because there the pose's own answer and the pin agree,
and the elevation does not draw depth. What showed it was the walk: her body moved 0.2 m upstage and the
held foot crossed to `+0.195` rather than staying put.

So `footPins` now builds the mark in her frame — rotate the stage offset back by her turn, with `facing`
mirroring the across axis — and keeps `sx`/`sy` alongside it in stage metres for anything that measures
on the floor. `legOverreach` reads those two, so the gap it draws is a place on the deck rather than a
place in the body.

**A rock belongs in the legs.** `rock` lived only in `feetPlaceOf`, so the elevation's legs never carried
it: the plan's ankle was 5.5 cm upstage of the pelvis in an arabesque while the drawn one was level with
it. It now sits in the base every leg is solved from, which is where the other feet get it, and a free
leg's own mark (its "home" under a dropped hip) agrees with the plan again.

**A step should not jump.** The pin used to stay on the departure contact until the weight crossed and
then switch to the arrival one, a 0.6 m jump in a single frame. It now travels between the two marks by
the same crossover that carries the weight, so the transfer is a step: the marks read 2.000, 2.086,
2.400, 2.714, 2.800 across a 0.8 m walk.

**The plan and the paper hold it too.** `feetOnFloor` is the one answer both views ask for: the pose's own
foot blended towards the held contact by the pin's weight, `held` when that contact is carrying her. The
plan's filled mark and the printed cross sit on the contact; the other foot on the deck is an open ring;
a foot in the air is faint. Checked against the solved legs at nine moments of a walk: the mark and the
ankle's depth agree to the millimetre, and where the leg is asked past its length the two still agree
because both read the same solve.

**Checked.** A plié walking 0.8 m upstage holds its left mark at 2.000 until the weight crosses, while
her body goes to 2.225 — the elevation's ankle at 2.003 (3 mm, the leg at its length) — and a walk
downstage mirrors it exactly. Stationary first, second, fourth, tendu and arabesque put each pinned ankle
within 0.4 mm of where the position puts it, so nothing that stands still moves. A plant held through a
90° turn keeps its mark in depth to 2.4 cm while the leg straightens (a first-position leg has no slack
to give); with a plié it is exact. Fourth and second on the plan still land where they always did.
The print page draws its crosses, the app plays a path with no console output, and first/second/fifth
were re-checked to be the joints they were before this change.

**Still unequal.** The pins' across axis and their depth axis are read in slightly different frames — the
drawing mirrors the figure and squashes its width, which is what turns a rotation into something a flat
picture can show — so a plant held *while turning* can leave a couple of centimetres of the across
component unheld. The depth, which is what walks a foot away upstage, is now held properly.

## Cued: cast list, recording, stage effects

Three ideas from the same session, written down with what each one costs, so nobody has to
re-remember them later.

**Cast list and roles.** The performer is already the unit — name, number, colour, costume,
path, tracks, printed sheets — and the plan already draws every path at once with the eyes to
thin them down, while the printed *Dancer paths* page gives each dancer their own numbered
graph. So a second "layout page" would duplicate the plan. What is missing is the *casting*: a
**Role** on the performer (Snow Queen, Mouse King, an understudy's second name), a casting sheet
at the top of the paper that lists the company as *role — dancer — number*, and roles carried
into the sheets and the call sheet. Then casting a show is typing roles against the company
that already exists, and the paths stay where they are. Worth deciding before building: whether
a role belongs to the show or to an act (the same dancer is a Snowflake in Act 1 and a Flower
in Act 2), which is the same question the sheets already answer per act.

**Recording the show to a file.** Not built, and not a big piece of machinery: the browser can
capture the stage canvas and the soundtrack together into a video file it downloads, with no
.exe and no new dependency beyond what a browser ships. The honest costs: it records in real
time — a twelve-minute act takes twelve minutes — and it saves the format the browser prefers
rather than a broadcast one, so it is a review copy for the company, not a master. The part
that needs care is the soundtrack, because the music, the narration and the voice pieces are
mixed in the same place the clock drives; the capture has to take that mix rather than the
speakers. A frame-by-frame render would be a different, larger job (each frame drawn and
encoded off the clock, no real-time wait), and it is the one that would make the tool an
exporter; real-time capture makes it a recorder.

**Stage effects, and the snow.** This one makes complete sense and fits a shelf that does not
exist yet. Everything on the stage so far is a *thing* — a dancer, a prop, a curtain, a drop, a
lantern, a screen. Snow is the first *weather*: not a thing you place, but something that needs
a kind, an area and a strength, brought on and taken off by cues on its own row, exactly the way
a light cue brings a lantern up (so `snow on, full stage, 40%` then `snow out` around the Snow
Queen's adagio is two bands, not a hundred particles). It draws over the plan and the elevation
as it falls, it is visible in a run-through, it prints as a line on the cue sheet with its time
and its act and scene, and — the useful part — the cue sheet then tells a crew when to start
the snow and when to stop it, which is the thing a paper trail of a real Nutcracker is for. A
show with no effects must open and play exactly as it does now; that is the same rule costume,
music and narration each kept.

## Casting, per act

**Why it lives on the act.** A show's company is one list of bodies with numbers, and a role is
what one of them is *in one act*: the same dancer is a Snowflake in the first half and a Flower in
the second, and the printed sheets are already cut per act. So the role is `act.roles` — a map of
dancer id to a name — rather than a field on the dancer, and moving the playhead to another act
shows that act's casting instead of a second, contradictory list. `rolesOf` cleans what it reads
(trimmed, collapsed spaces, 60 characters); `setRole` is the only door in, and an empty name is
how you uncast somebody. `normalise` keeps the map, drops anything that is not a name, and drops a
role whose dancer has left the show, so a deleted performer cannot come back as a phantom row.

**Where you type it.** The **plays** field on each performer's row in the cast list, under the
name — the place you are already looking when you think about who is in the scene. It is read in
the act the playhead is in and its grey placeholder names that act (`not cast in Act 2`). The
field commits on blur or Enter, so a role is not rewritten on every keystroke, and the value it
shows afterwards is what the show kept, not what was typed.

**On paper.** A **Cast** sheet after the stage plot: one table per act, columns Role / Performer /
No., roles in alphabetical order, and everyone with no role in that act listed under a dash at the
end with their number — a company list, not a filter. A role shared by two dancers simply appears
twice, which is the truth about understudies and doubles. A show where nobody is cast prints no
cast page at all, the same rule a show with no lanterns follows for the lighting sheet.

**Checked.** Casting Ada as Snow Queen in Act 1 and Flower in Act 2 keeps the two apart in the
model and in storage (`[{d1: "Snow Queen"}, {d1: "Flower"}]`), and the field shows each where it
belongs — the Act 2 tab says `not cast in Act 2` and lists only that act's casting. Clearing a
field removes the entry rather than storing an empty name; a name of 120 characters is kept as 60;
a role pointing at a dancer who is no longer in the company is dropped on load. On the printed
page, Act 1 draws `Mouse King — Bea — 2`, `Snow Queen — Ada — 1`, then `— — Cleo — 3`, and Act 2
draws `Flower — Ada — 1` with the other two under dashes. The planner and the paper both load with
no console output.

## The role travels with the name

**On the paths page.** Each dancer's block heading now reads `1 · Ada — Snow Queen`, the role set
apart by a hairline and in italic so the name still leads. A dancer who plays two parts reads
`Snow Queen (Act 1) · Flower (Act 2)`, because a path can cross an interval and one unqualified
name would be a half-truth; with a single role, or a single act, the act name is left out as
bookkeeping nobody needs. The station table below is untouched: it is about geometry, not casting.

**On the curtain call.** `Where everyone ends` gained a Role column between the performer and the
closing pose, read in the act the show *ends* in rather than the act the playhead is in — a closing
picture is one moment, so it can only have one answer. A performer cast in the first act and not
the second therefore shows a dash there, which is the truth the crew needs when they are looking
for her at the call.

**Rule kept.** An uncast performer is unlabelled on these sheets rather than labelled "uncast";
the casting sheet is the one page where that is the subject, and repeating it everywhere would
turn a note into noise. Also unchanged: a show with no casting prints exactly the sheets it
printed before this change, since an empty role line simply does not appear.

**Checked.** A probe show with Ada as Snow Queen in Act 1 and Flower in Act 2, Bea as Mouse King,
and Cleo uncast printed: paths `Ada — Snow Queen (Act 1) · Flower (Act 2)`, `Bea — Mouse King`,
Cleo with no role line; and the closing table `1 Ada Snow Queen Arabesque`, `2 Bea Mouse King
1st position`, `3 Cleo — — no path`. Moving the show's end into Act 2 flipped the same table to
`1 Ada Flower`, `2 Bea —`, `3 Cleo —`, which is the act-scoped reading working. The page loads with
no console output.

## The rehearsal call

**What "called" means here.** Not a list of who is in the company — the cast sheet is that. A
performer is called for a stretch of the show when she has a station inside it, because that is
the only evidence the show carries that she is on for it. So the sheet is derived from the paths
rather than authored twice, and it cannot promise somebody for a scene she never walks into. A
company member with no path at all is named once at the foot (`Not called at all: Cleo (3) — no
path in this show`) instead of standing as a blank in every scene.

**How it is cut.** Act by act, then scene by scene, in the order a rehearsal is called. Where an
act has scenes, the stretch before the first one is its own group (`Before Scene 1 · 0:00.0`), and
the last scene runs to the end of the act; an act with no scenes is one group (`Whole act`). Each
group lists only the performers with a station inside it, in the order they are first on, with
their role in that act, their number, the first call time and how many stations they have there.
The act heading carries the count and the stretch: `2 called · 0:00.0 → 1:00.0`. A group nobody
is in is not printed at all — an empty scene line is noise on a call sheet.

**Why it sits where it does.** Third page, after the stage plot and the cast: a company reads the
plot to know the room, the cast to know who is who, and then this to know when they are wanted.
The signature block at the foot is `Called by`, `Date` and `Stage manager's signature`, on ruled
lines with `break-inside: avoid`, because a call sheet is signed on the night and a signature
half-way across a page break is not a signature.

**Checked.** A probe show — Act 1 of one minute with scenes at 0:15 and 0:35, Ada dancing at 0:00,
0:20 and 0:42, Bea at 0:38, Cleo with no path, then an Act 2 of forty seconds with Ada at 1:10 —
printed: Act 1 grouped `Before Scene 1 · 0:00.0` (Ada, Snow Queen, 0:00.0, 1 station), `Scene 1 ·
0:15.0` (Ada, 0:20.0), `Scene 2 · 0:35.0` (Bea as Mouse King at 0:38.0, Ada at 0:42.0), then Act 2
as `Whole act · 1:00.0` with Ada as Flower at 1:10.0, and the note about Cleo. The heading read
`2 called · 0:00.0 → 1:00.0` for Act 1 and `1 called` for Act 2. The signature rules measure 1px
and the block fits inside the sheet (no horizontal overflow at 794px). Stripping every path from
the same show removed the page entirely, so a company with nothing choreographed gets no call
sheet. The page loads with no console output.

## Ticking the call

**One box per row, first thing in it.** The call sheet's table gained a leading **✓** column: a
10 px box, blank, in the same shape the clearance list has used since it was built. It is the
first cell rather than a column at the end, because a call is read down the left edge while
people arrive, and a box you have to hunt for is a box somebody skips. The scene lines are a
single cell across all six columns, so a group never shows a stray box of its own.

**The signature line, reused rather than reinvented.** My first pass had its own signature block
for this page and it collided with the `.signoff` rule the clearance list already owns — the
clearance list would have rendered its three lines in a row with the call sheet's note. It now
uses the same markup (`<div class="signoff"><div><span class="line"></span>caption</div>…`), so
the two pages sign the same way by construction, and the shared rule picked up `break-inside:
avoid` so neither block can be split by a page break.

**Checked.** A probe show of one act — Ada at 0:00 and 0:20, Bea at 0:38 with a scene boundary at
0:35 — printed a head of `✓ Role Performer No. Called at Stations` and one tick cell per called
row: `Snow Queen · Ada · 1 · 0:00.0 · 1`, `Snow Queen · Ada · 1 · 0:20.0 · 1`, `Mouse King · Bea
· 2 · 0:38.0 · 1`. The boxes measure 10 × 10 px, the scene rows resolve to a single cell (so the
`colspan` is right), and nothing overflows the 794 px sheet. Adding a drop to the same show brought
the clearance list back and both signature blocks measured as flex rows with three ruled lines —
`called by / date / stage manager's signature` and `checked by / stage manager / time the stage was
clear` — each with `break-inside: avoid`. The page loads with no console output.

## How many are wanted, per scene

**A tally on the scene line, not a second table.** Each group line now ends with its count at the
far edge — `Scene 2 · 0:35.0                         3 called` — because the number that sizes a
dressing room, a warm-up or a wait is read at the same moment as the time it starts, and a separate
summary table would be the same six numbers printed twice. The act heading already totals the act
(`3 called · 0:00.0 → 1:00.0`), so the page goes act → stretch → company, each level saying how
many it holds.

**What is counted.** Rows, which are performers with a station inside that stretch, so the tally
can never disagree with the list beneath it. It is not a count of *people on stage at once* — a
performer whose path crosses the whole scene counts once, and one who walks on twice counts once
too, because a call is about who has to be there, not about how often.

**Checked.** A probe show — Act 1 with scenes at 0:15 and 0:35, Ada at 0:00, 0:20 and 0:40, Bea at
0:38, Cleo at 0:39 — printed `Before Scene 1 · 0:00.0 … 1 called`, `Scene 1 · 0:15.0 … 1 called`,
`Scene 2 · 0:35.0 … 3 called`, each tally sitting within 8 px of the right edge of its line, and
each group's row count matched its tally exactly (1, 1, 3). The act heading read `Act 1` with
`3 called · 0:00.0 → 1:00.0`. The page loads with no console output.

## The company line

**What it counts.** Performers standing on the deck, not performers called. Called is the table
under it; this is the stage: a woman whose path has finished is still standing where it left her,
and a woman in the wings is off, because the audience has lost sight of her and the count should
lose her too. It is read from `posOfContent` at each sampled moment, so the line, the plan and the
curtain-call table are all the same geometry — there is no second idea of "on stage" in the code.

**Sampled, and why.** Walking off is not a station: it is a position crossing the wing line
part-way along a leg, so there is no exact moment to solve for without inventing more geometry
than the show carries. The line is sampled at 250 ms on a short act and coarser on a long one
(`span / 900`, floored at 250 ms), which is finer than a walk-on can be misread at the width of
the printed chart, where a quarter second is a quarter of a millimetre.

**The chart.** A step line over the act, filled underneath, with a faint rule per count (every
second count when the company is larger than five) and the number down the left edge, so a height
is read without counting squares. Every change gets a dashed tick; the time goes under it, in two
rows so that changes a few seconds apart can both be labelled rather than one swallowing the
other, and a label that still will not fit is dropped while its tick stays. The caption names the
count of changes — `COMPANY ON THE DECK · 9 CHANGES` — so a dense run of untimed ticks still reads
as that many entrances and exits. The act heading gained the peak: `9 called · 0:00.0 → 1:00.0 ·
peak 9 on the deck`.

**Checked.** A probe act of a minute: Ada on throughout, Bea walking in from the wing at 0:10,
Cleo walking on at 0:25 and off at 0:40, Dee standing in the wing for the whole act. The line read
one at 0:00, two from 0:01.8 (Bea crossing the wing line, not her station — the sample found the
moment), three from 0:20.8, back to two from 0:39.3, with the heading saying `4 called … peak 3 on
the deck` — Dee is called and never on, which is exactly the difference the chart is for. A second
probe of nine dancers all on at once, leaving 300 ms apart, thinned the axis to 2, 4, 6, 8, printed
three of the nine times across two rows, kept all nine ticks, and captioned itself `9 CHANGES`.
The figure fits inside the 794 px sheet on both. The page loads with no console output.

## Who the change is

**The line counts; the table names.** A chart can say "three went to two at 0:39.3" but not *who*,
and "who" is the whole sentence a quick change needs. So the count is now read from a per-performer
on/off state at each sample rather than by tallying, and every difference between two samples
becomes a change with two lists — came on, went off. Those are printed under the line as a tight
little table: Time · On · Off · On stage, names with their cast numbers, so it lines up with
everything else on paper. `—` where nothing moved on that side.

**A swap is a change too.** With counts alone, one performer walking off as another walks on leaves
the total alone and disappears. Reading the sets catches it: the line stays flat (correctly — the
same number of people are on) but the change still gets its tick, its row and its place in the
caption's count. That is precisely the case a stage manager is reading for: two dancers crossing in
the wing during eight seconds of music.

**What the times mean.** The moment a name appears is the moment her position crossed the wing
line, which is not her station: Bea in the probe walks on from the wings and is counted from
0:01.8, though her first station is at 0:10. That is the truth of the floor rather than of the
path, and it is why the line is sampled instead of solved.

**Checked.** A probe act of a minute — Ada on throughout, Bea walking in from the wing around
0:02, Cleo on at 0:25 and off at 0:40, Dee leaving about 0:46 as Eve arrives at 0:44 — printed
`0:01.8 · on Bea 2 · 3 on`; `0:20.8 · on Cleo 3 · 4 on`; `0:39.3 · off Cleo 3 · 3 on`;
`0:44.5 · on Eve 5 · 4 on`; `0:45.8 · off Dee 4 · 3 on`, with the heading `5 called · 0:00.0 →
1:00.0 · peak 4 on the deck`. Column widths came out 58 / 284 / 284 / 70 px, so the time and the
total stay narrow and the names get the room, and the table fits inside the 794 px sheet. The page
loads with no console output.

## The company line in the planner

**A strip, not a track.** It draws under the tracks in its own canvas (`#companyLine`), sharing
the timeline's gutter and its clock rather than being another row: a row would scroll away with
the tracks, and this is meant to be a frame around the whole thing. `GUTTER` is exported from
`timeline.js` now so the two line up exactly, and the strip uses `xOfDisplay`'s own arithmetic
(`GUTTER + (display/1000 - scrollT) * pxPerSec`) rather than a copy that could drift.

**Measured against the clock, not the screen.** The first version counted the company on every
frame, which is a few thousand position lookups per frame and a visible cost in the one place the
app is already drawing eleven things. The numbers are now kept for a stretch of *time* — the
visible window plus a quarter of a window either side — so scrolling inside that stretch reads
the same run of counts, and only a window that has scrolled out of it is measured again. The
resolution follows the zoom (a sample every ~2 px, floored at 30 ms and capped at 250 ms, and at
3200 samples for a long window), so a zoomed-in edit resolves an entrance and a zoomed-out act
does not pay for one. Two pixels a sample is what the line can draw; anything finer would be
pretending to a precision the drawing does not have.

**Edits reach it.** A cache keyed on the window would leave the line stale after a path was
dragged, so `persist()` now bumps `state.ui.rev` — one counter, bumped by every save — and the
strip re-measures when it changes. That is cheaper and more reliable than teaching the strip
which edits matter, and it means any future drawing with a cache can use the same signal.

**What it draws.** The step line with a faint fill, the peak as a dashed rule with `peak N` at
the right, act boundaries carried down as thin rules from the band above, a playhead line with a
dot at the count, and `ON STAGE` with the live number in the gutter. It counts with the same rule
as the printed call sheet — a finished path stands where it left her, the wings are off — so the
screen and the paper cannot disagree.

**Checked.** A three-dancer probe (Ada on throughout, Bea walking in from the wing, Cleo on at
0:25 and off at 0:40, with a two-second pause marker from the demo show still in place) drew
levels that matched `posOfContent` at every probe point across the visible window, including
across the pause, where display time and content time are two seconds apart. The x mapping was
verified by rebuilding the count at each probe column from the model and comparing it to the
drawn height: 3 at 32–40 s, 2 from 41.4 s, with the peak rule and the gutter number reading 3 at
the playhead. Zooming out twice and in once, then playing for a second and a half, left no
exceptions; deleting two of Cleo's stations and saving changed the line on the next frame with
no scrolling (peak fell to 2). The strip sits directly under the timeline (bottom of one, top of
the other) and is hidden with the rest of the chrome in a run-through.

**One staleness that remains, by choice.** A path being dragged is not saved until the gesture
ends, so the line steps when the drop lands rather than following the pointer. The stage itself
updates live; the strip is a summary, and a summary that follows every mouse move would be the
expensive version of the same information.

## The overlap fixer (1 Nov 2026)

A run-through only finds the overlaps it happens to play through, which is the wrong way round:
the faults worth fixing are the ones the clock has not reached yet. So the planner now looks
through the whole running order for them, lists them with their times, and offers one fix each.

**A scan, not a stop.** `scanOverlaps` walks the show at up to five thousand moments — the show's
length over 5000, never finer than 80 ms — and records every pair of bodies inside `CLEARANCE`.
Two samples of the same pair in the same stretch are one overlap rather than thirty: consecutive
hits are merged into a run with a start and an end, and the overlap is reported *at the moment in
it they are closest*, which is the moment worth looking at. The threshold is the constant the
run-through already stops on, so the list and the stage cannot disagree about what a collision
is, and invisible performers are skipped the way they are in `collisionsAt` — a hidden dancer is
not on stage however close her path runs to somebody else's.

**Three kinds of fix, cheapest first.** A **nudge** moves one station, which is all a still dancer
needs: a station is where a still body is. A **shift** carries both ends of the leg she is on,
which is what a pass made *while travelling* needs, because moving one end of a blend moves her
by half at the moment that matters and half is still a collision; it is also what a stand gets,
since a stationary figure pushed at one end would drift a metre and come back rather than step
aside. A **retime** moves a station on the clock, in steps from 0.3 s to 4 s, smallest
displacement first, and never within 120 ms of the station before or after it — a leg still has
to be a leg. The costs say what the planner believes: a metre of movement is three, a metre of a
carried path four because it moves two ends, and a second of displaced music seven tenths. A path
is the dance; the clock is only where it sits. So when both are possible the dancer waits a beat
rather than the picture changing, and when the fix offered is *"Mia leaves 1.5 s later"* that is
the ranking working rather than the geometry failing.

**Measured, not guessed.** Every candidate is put into the real show, read, and put straight back.
It is a fix only if three things hold. These two bodies clear the clearance *everywhere* in the
show, not just here. No third body is newly crowded. And the legs the edit touched raise no new
plant, skate or reach fault — a nudge that clears a body and pulls a planted foot is a different
fault, not a fix. The other bodies' floor is measured once into a cache keyed on `state.ui.rev`,
so a candidate costs one walk of her own path rather than of the whole show; that is why a scan of
a company of eight takes 7 ms and forty-odd candidate edits take 50.

**Why the pair is the one that matters.** A local window cannot tell that a dancer retimed earlier
simply meets the same body earlier — the collision has moved to a moment the window does not
contain, and it looks clear. "Not worse overall" cannot tell either. Only the pair, measured across
the whole show, can, and that is the number a fix has to pass.

**A fix cannot outlive the paths it describes.** A fix names stations by their place in a path, so
a list is only good for the paths it was read from. The list therefore carries `pathsKey`, a
signature of the paths alone, and the panel compares it every rebuild: once the show has changed
the rows stand down and say so rather than offering to move a point that is no longer the one it
meant. The revision counter would not do for this, because a panel rebuild writes the show to
storage without changing a thing.

**A fix is an ordinary edit.** It commits first, so Undo puts the path back exactly as it was, and
it re-scans afterwards instead of patching the list — the fix may have moved a station the other
overlaps were counted against, and a fix that tidies one collision into another is not one.
Clicking a row rather than its button takes the playhead to the moment, so the stage can be
judged before anything is changed.

**Checked.** `test-overlap.mjs`, eight cases on synthetic companies, all of them reaching zero
overlaps after every fix was applied: a walk-through (*shift — carry Cy's path downstage 1.0 m*),
two crossing on the same line, two standing in nearly the same spot (*nudge — move Eve's point
stage left 0.5 m*), a pass through a spot just arrived at (*retime*), a planted-foot conflict where
the feet had to stay valid, two travelling bodies meeting at a point (*retime — Mia leaves 1.5 s
later, cost 1.05*), a clean show that reports nothing, and a company of eight crossing at once for
the cost of a scan. Scans run in 1–7 ms and the fixes in 12–54 ms.

**What is left.** The scan samples: an overlap shorter than the step between samples can be missed,
which at 80 ms is a brush past and on a twenty-minute act is a quarter of a second. The clearance
is a circle where a dancer is nearer an ellipse. Only one of the two dancers is ever moved, since
moving both is a different edit with a different answer, and *no automatic fix* is a real result —
a pair standing on top of each other in a full stage is a choreography problem, not a rounding
one.

## Phrases choose their own feet (1 Nov 2026)

A phrase already lays down the stations a step needs — a chassé its gather and its step, a pas de
bourrée its three transfers — and it left every one of them to derive a plant from its position.
That derivation alternates only where the position is neutral, and a chassé closes on both feet, so
the step after the gather always came out on the right; a turn came out on the right as well,
because the fourth before it stands on both feet too. Nothing was recorded either, so changing an
arrival position after a phrase had been placed silently changed which foot she stood on.

**The step decides, in `phraseStations`, beside the counts.** A walk alternates from the foot she
was last on; a chassé lands the front foot of the two it gathers; a pas de bourrée lands the third
of its three transfers; a turn keeps the standing foot the fourth prepared her onto; a preparation
stands on both, because that is what a fourth or a fifth is. The lead is read once, when the phrase
is placed, from the last station's plant — typed or derived — so a foot set by hand on one station
carries into the phrase after it, which is the inheritance the plan asked for.

**Where the phrase keeps quiet.** Under a position that names its own side the phrase writes
nothing: an arabesque drawn on the left leg with a right-foot plant would print as a fault the
choreographer never made, and the foot on paper would disagree with the foot being drawn. A body in
the air is left alone the same way. Those stations keep deriving, exactly as they did before, so a
show placed before today keeps the feet it already had.

**Checked.** `test-phrase-plants.mjs`: three walks alternate right · left · right; two chassés land
right then left, where the derived table repeated the right; two pas de bourrées land right then
left off their preparations; a pirouette arriving on the left turns on the left, where the derived
table would have answered right; a foot typed on a station turns the next step the other way; and
two walks arriving in arabesque both keep the arabesque leg, writing nothing. The probe reports one
fault — a fourth-position preparation skating 0.35 m into the turn — and the same fault appears
with every written plant stripped out, so it belongs to the position table and not to this.
