# Choreographer

A browser tool for planning stage performances: a 2D stage plan with wings,
layered curtains and drops, cast avatars moving on a metre grid, and a timing
track timeline with a real-time preview.

## Run it

```
node server.mjs
```

Then open <http://127.0.0.1:4321>. Pass a port as the first argument to change
it: `node server.mjs 8080`.

There are **no dependencies and no build step** — no `npm install`, no bundler.
The only requirement is Node, because the app uses ES modules, which browsers
will not load from `file://`.

## Files

| File | Role |
| --- | --- |
| `index.html` | App shell: header, stage-assets panel, stage canvas, performance-assets panel, transport, timeline |
| `styles.css` | Dark theatre theme and the three-column layout |
| `server.mjs` | Zero-dependency static file server, bound to 127.0.0.1 |
| `src/model.js` | Show document, time maths (content/display/local clocks), collisions, undo, persistence |
| `src/draw.js` | Avatar shape rendering and time formatting |
| `src/stage.js` | `StageView` — the plan: floor and wings, grid, scenery, cast, paths and light pools |
| `src/elevation.js` | Audience elevation under the plan: width across, height up |
| `src/pose.js` | The ballet positions as joint angles, drawn on screen and on paper |
| `src/timeline.js` | Ruler, tracks, playhead, hold/pause bands, scrubbing and zoom |
| `src/app.js` | Panel wiring, demo show, playback loop, keyboard shortcuts |
| `print.html` | The paper view: A4 sheets, a screen-only bar, and the print rules |
| `src/print.js` | Draws the printable stage plot, the side elevation, the performer paths, the cue sheet and the lighting sheet |

## What works

- **Stage**: width, depth, wing depth, grid, proscenium opening height and dancer
  height all editable, in metres. Wings sit either side and are drawn beneath the grid
  so nobody is choreographed into scenery. The opening and dancer height set the
  elevation's scale: the arch, the metre rule and the cloth are all read against them.
- **Elevation**: a strip beneath the plan shows the same moment as the house sees it —
  width across, height up, with a metre scale, the proscenium opening, dancers at the
  height set for them, each curtain and drop hanging at its own height, and drops that
  really rise out of sight when flown. Anything upstage is drawn first, so a downstage
  curtain covers what stands behind it, and a flown drop is named above the opening
  instead of vanishing without a word. Each piece is named once above its own top, and
  where two hang in the same place at the same height the second name is lifted a line
  clear of the first, so a main curtain and the tab legs behind it never print on top
  of each other. Clicking a dancer or prop there focuses it exactly as clicking on the
  plan does; cloth standing in front blocks that click, since it blocks the view too. The
  two drawings share one scale, chosen for the pair when the window is sized: a metre
  is the same number of pixels above and below, so the elevation's opening stands
  between the same verticals as the plan's floor and a fully open curtain's legs sit
  on the floor edges rather than a little inside or outside them. A run-through keeps
  the pair at one scale too, in two equal rows: the plan takes depth, the elevation
  takes the opening, and both grow to fill the window.
- **Filling a view**: **⛶ Fill** in a view's own corner gives that view the whole
  centre and stands the other down, so the plan can be built on at a quarter more
  size (more, in a wide window, where the pair is limited by height). The button then
  reads **⛶ Both** and puts the two back. Only one fills at a time, because the point
  of filling is having the room to yourself, and a filled view has no metre to share,
  so it fits itself. The choice is remembered in the browser rather than in the show:
  it is how you work, not what you are working on. A run-through started from a
  filled view keeps it — fill the elevation and press **▶ Watch** and the house view
  plays on its own across the whole screen.
- **Depth in the elevation**: figures shrink with their distance upstage, the way the
  house sees them — a dancer at the back of a 9 m stage is about two thirds the size
  of one on the lip, and a prop keeps the same relationship, so a bench set upstage
  sits behind a dancer at its own depth. The drawing is a picture again rather than a
  flat measurement, so **Depth** in the elevation's corner turns it off when heights
  are being judged; it is remembered with the fill. Cloth is never scaled: a border
  hangs at its real height and is read against the metre rule.
- **Folding the panes**: every section with a heading — Stage, Show settings, Running
  order, Music, Wing legs, Lights and Curtains, drops & cards on the left; Performers,
  Props and Narration on the right — folds down to its heading when the heading is
  clicked (or focused and given Enter), because the stage's own numbers are set once and
  then take a third of the pane. A folded section still shows its count (`Music 2`), and
  the chevron at its right points the way the next click will take it. **Fold all** at
  the head of the stage pane shuts that whole side in one click and becomes **Unfold
  all** once everything on it is folded; the lists on the right fold one at a time, since
  those are what you are working in. **The stage pane keeps a separate arrangement per
  act** — lighting Act 2 is a different job from lighting Act 1, so a section folded for
  one is not folded for the other, and switching act (or scrubbing across a boundary)
  puts that act's arrangement back; an act you have never arranged starts open. The right
  pane's lists are the same lists whatever is playing and fold once for all acts. What is
  shut is remembered in the browser beside the view settings rather than in the show: it
  is the state of your desk, not of the show. The inspector never folds — it has no
  heading of its own, because it shows whatever is picked.
- **Acts**: the show is one clock cut into acts. The strip above the stage switches
  act — it moves the playhead to that act's first moment and scrolls the timeline
  there — and **Running order** in the left panel names each act and sets how long it
  runs. Acts sit end to end, so Act 2 begins exactly where Act 1 ends, and the clock
  reaches the end of the last act even before anything in it is choreographed: add a
  second act and there is room to build it. An interval is still a pause at the
  boundary. The lit tab follows the playhead, and the timeline shows the running
  order as a band across the top of the ruler with a dashed boundary through the
  tracks. Only an empty last act can be removed, because cutting one that holds work
  would slide every later station, cue and hold earlier on the clock.
- **Scenes**: named moments inside an act. The row under the act strip lists the
  scenes of the lit act, and **+ Scene** marks one at the playhead. Each scene is
  edited in **Running order** — its name and its start in seconds into the act — and a
  scene runs until the next scene or the end of its act. A scene is only a label, so
  renaming, moving or removing one never moves a station, cue or hold; a shorter act
  pulls its scenes back inside it. Scene starts are notched in the timeline's act
  band, clicking a scene chip jumps the playhead to it, and a notch can be dragged
  along the band to move that boundary by hand (the readout above it names the
  scene and the moment as you drag). A boundary stops at its act's ends and will not
  cross another scene.
- **Wing legs**: two per side by default, drawn in the wings and never across the
  stage floor. They split each wing into front, middle and back entrances; drag one
  on the stage or type its depth.
- **Scenery**: curtains (front / centre / back layers, stacking order, open/closed
  slider), drops hung in a stack, and props you can drag on the stage
  (hold Alt to ignore grid snapping). Every piece has a height of its own — a prop's
  box, a curtain's drop, a drop's cloth — edited in its row and used by the elevation;
  new cloth starts at a height that suits the opening (a curtain just under the header,
  a drop a little shorter) and is then independent of it. Curtains and drops also have
  a width — how much of the opening they mask — and an **Across** position, so a narrow
  border or tab can sit over three metres of stage at one side while a full house
  curtain masks everything from the middle. Cloth is kept inside the opening: a piece
  only moves as far as its width allows, and a full-width drop is pinned to the centre
  until it is narrowed. A curtain's legs gather to a 0.55 m stack at the edges of its
  span when wide open, rather than vanishing. A **Depth** field places a piece at an
  exact upstage position: typing one pins it there, and choosing a layer again
  releases it back into that layer's stack. You can also drag a curtain's or drop's
  band on the plan — up and down for depth, and sideways within its width — and a
  depth drag pins it where you let go, while sliding one sideways leaves it in its
  layer. Drops were always at an exact depth; curtains follow their layer and order
  until you pin them. A drag lands on the floor's grid lines, so cloth ends up at
  depths like 2.0 or 3.5 rather than whatever the pointer happened to give; hold
  **Alt** to move it freely, and the readout above the band says `grid` or `free` so
  you can tell at a glance which is happening.  Dancers and props snap at half a grid
  step; cloth snaps at a whole one, because the Depth field shows tenths and should
  not disagree with where the piece drew itself.
- **Scene cards**: the old tradition of a stagehand walking on with a board that says
  which act and scene you have reached. **+ Card** in the same section adds one: it is a
  board, not cloth — downstage of the main curtain, 1.6 m wide and 0.9 m tall until you
  change it — with a **Says** field for the words the audience reads (`Act 1 · Scene 2`,
  `Interval — 15 minutes`, anything). It is either on stage or it is not: no halfway
  state, so its cues are **bring on** and **take off**, and its own control above them
  says where it starts. On the clock it owns a row like every other piece, where a
  click, a double-click or a right-click places and flips it; on the plan it is a pale
  band at its depth carrying its words; in the elevation it is a board standing on the
  deck, read as the house reads it — which is the view to print it in, since a top-down
  plan can only show where the board stands, not what it says. A card stands at the
  front of the stage, so the standing instruction over the plan is a coach mark: it is
  there until the stage is first clicked (or for twenty seconds), then it steps aside
  rather than covering the board. Anything the app has to tell you still shows there. A
  card is not flown, so
  it is not in the heights table; its cues are on the cue sheet like any other.
- **The drop stack**: drops hang on separate pipes behind one another, 0.45 m apart,
  each new one going *behind* the stack — so the drop the audience sees stays in front
  and flying it out is what reveals the next. Adding a drop to a stack that has
  reached the back wall walks the whole stack 0.45 m toward the house first, rather
  than hanging two pieces on the same pipe where neither would mask the other. Each
  drop's row says what it masks and what it reveals (`flying this out reveals
  Drop 2`). Cloth is drawn opaque in the elevation, so a hanging drop really does hide
  the one behind it and a closed curtain really does mask a fly happening behind it;
  the plan keeps cloth translucent, because that view is a drawing of where things are
  rather than a picture of what the audience sees.
- **Scenery cues**: a curtain, drop or card can change during the show. Pick what it
  does (open / half / close, fly in / fly out, or bring a card on / take it off), how
  long it takes in seconds, and press
  **+ at playhead**; the stage follows as you scrub or play. Every curtain and drop has
  a row of its own in the timeline, cued or not — the row *is* its track. Clicking an
  empty stretch of that row puts the playhead at that moment (drag to scrub), and
  double-clicking it drops a cue there that flips the piece to its other state: an open
  curtain closes, a hanging drop flies out. The picked row shows a `+` at the playhead
  where that cue would land. Clicking a band picks that cue, and its
  row in the panel opens into a select for what it does and a field for how long it
  takes, so a cue can be retargeted or retimed after it has been placed. The band's
  ends are handles: drag the right end to change how long the move takes, the left end
  to change when it starts and leave the finish where it is, or grab the middle to
  slide the whole cue along the clock. Double-clicking a band removes it (double-click
  an empty stretch to add one). Before its
  first cue an item holds the base state set in its panel, and a cue in progress is
  never overtaken by a later one. A **now** row under that control says what the piece
  is doing at the playhead — `61% open · moving`, `open`, `flown out` — so a curtain
  mid-cue can be told apart from one sitting at its base; once a piece is cued its
  slider or select is labelled **Start**, because that is what it sets.
- **Watch**: **▶ Watch** in the header runs the show. The editor disappears — no panels,
  no header, no timeline — and the stage fills the window as two pictures: the plan
  above (where everyone is) and the side elevation below (how it looks from the
  house) — or just one of them, if that view was filled beforehand — with a small bar
  carrying play/pause, restart, the clock and a fullscreen button. It starts from the top with the music and plays through pause markers and
  collisions, because a collision is an editing warning rather than something an
  audience sees. Clicks on the stage do nothing while watching, **Space** pauses and
  **Esc** (or *Back to editing*) returns to the editor at the moment you stopped.
- **Music**: the show's music is a list of tracks, added and removed in the **Music**
  section  the way the cast is. **+ Track** attaches a file and puts the track **where the
  playhead is** — put the playhead where the music should change, then attach — and a
  new track added at the top of the show simply starts there; **replace** swaps a track's
  audio while keeping its place, level and fades, the eye mutes that one track and ×
  removes it along with its stored audio. Each track has its own entry point (**starts**,
  or drag its waveform), its own row on the timeline — so a show can run a prelude, a
  scene change and a finale — and its  own fades. A track can be **trimmed**: **plays** is how much of the file sounds from
  its entry point, **end here** sets that from the playhead, and **the pair of bars at
  the right end of its band** is the same handle dragged by hand — a click on the band
  slides the track, a pull on its end shortens what plays, and it cannot be pulled past
  the file's length or down to nothing. The file's own length stays reported beside
  the trim, so a trim never hides what the track is. A trimmed track
  stops at its end — the silence before the next track is deliberate, and nothing
  earlier comes back — and the printed sheet says `track ends (trimmed)`. Only the
  track covering the playhead sounds; the engine starts it when the
  clock reaches it, decodes ahead of the switch and stops the source when the show
  leaves it (the show's clock keeps running in the gap). Every row draws its own
  waveform from the peaks stored beside the audio, so a track you have not played yet
  still shows its shape. A track is decoded in the browser and played through the
  show's own clock — the audio context is the master, so the picture follows the
  recording rather than counting frames. Press play at any
  point and the track joins at the right place in the piece; a pause marker stops the
  music and picks it up again afterwards, and dragging the waveform (or typing
  **starts**) moves where it enters. The eye on the Music row is the mute. The audio
  itself is kept in the browser's IndexedDB, not in the show file, so an exported show
  carries the cue and not the megabytes: importing it elsewhere lists the track as
  *file missing* until the file is attached again, and its entry point is kept.
- **Music fades**: each track's level has cues of its own, in that track's own row.
  Choose **fade out**,
  **fade to half** or **fade in**, how many seconds it takes, put the playhead where
  the fade should begin and press **Add at …**; the music moves from wherever it is to
  that level over those seconds, so a change of scene can take it down under the cloth
  and bring it back on the other side. Each fade is a band along the bottom of the
  Music row — red for down, blue for up — with the same handles a scenery cue has:
  click to pick it, drag either end to retime it, drag the middle to slide it, and
  double-click it to remove it. Double-clicking an empty stretch of the row adds a fade
  the other way from where the level stands, so one double-click takes the music down
  and the next brings it back. A **now** row under the controls says where the level
  stands at the playhead (`full`, `41% · fading`, `silent`), and the printed cue sheet
  lists each fade in running order with its length.
- **Narration**: the spoken word, in the **Narration** section of the Performers pane
  (a voice is performed; it also keeps the left pane from growing another section).
  **◉ Record** opens the microphone and shows the seconds it has been listening;
  pressing it again stops the take and puts the line **where the playhead was when
  recording began** — a two-minute take must still sit where the narrator started.
  **+ Voice file** does the same with a recording made elsewhere. Every piece is a
  row in the list (name, **starts**, how long it runs, when it ends) and one band on
  a single **Narration** row on the timeline: drag a band to move it, double-click it
  to go to its start, and press **go** in the list to do the same. Unlike the music,
  narration is not exclusive — two pieces can speak at once (a recorded line under a
  live one), and the row splits into lanes for them while the list says which piece
  it shares the moment with. The row only appears once there is a piece on it, and
  its eye silences all of it. A line sounds whenever the playhead is inside it: while
  scrubbing, while playing, and in a run-through. It stops with the show — pausing,
  stopping, a pause marker or the row's eye — and picks up at the right point in the
  take afterwards, because the offset is worked out from the show clock every time
  one begins. Removing a piece leaves its recording in the browser, so **Undo**
  brings the line back with its voice rather than bringing back a silent cue.
- **Cast**: each dancer gets a permanent number plus a colour, shape and fill; the
  inspector edits name, colour, shape and fill.
- **Casting**: each performer's row in the cast list carries a **plays** field — what she is
  in the act the playhead is in, so the same body is a Snowflake in Act 1 and a Flower in
  Act 2, the way a role actually works. Casting is a name typed against a dancer: it is not
  a second kind of object, and a performer with nothing typed is still in the company, just
  not playing anyone in that act (the field says so in grey: `not cast in Act 2`). The name
  is trimmed, kept with the act through a save and an export, and drops with the performer if
  she leaves the show. On paper the casting sheet prints after the stage plot: one table per
  act, roles in alphabetical order with the dancer and her number, and anyone uncast listed
  under a dash at the end — a show with no casting at all prints no page rather than an empty
  one. The role follows the performers onto the other sheets: each **Dancer paths** block names
  what that dancer is playing beside her name — `Snow Queen (Act 1) · Flower (Act 2)` when she
  plays more than one, since a path can cross an interval — and the curtain call's **Where
  everyone ends** table has a Role column, read in the act the show ends in, because a closing
  picture is one moment. A performer nobody has cast is left unlabelled rather than labelled
  uncast: the casting sheet is where that is the subject.
- **Rehearsal call sheet**: a page between the cast and the elevation that says who is needed,
  in what part, and from when — act by act, then scene by scene, with the time each stretch
  starts. A performer is *called* for a stretch when she has a station inside it, so the sheet
  can never promise someone for a scene she never walks into; rows are in the order people are
  first on, with their role, number, first call time and station count. A company member with no
  path anywhere is named once under the tables (`Not called at all: Cleo (3)`) instead of
  appearing in every scene as a blank. Every row opens with a **✓** box, so arrivals are ticked
  off by hand as they walk in — the same box the clearance list uses, and blank space on paper is
  the point. Each scene line also carries its own tally at the far edge (`Scene 2 · 0:35.0 …
  3 called`), so how many are wanted for a stretch — a dressing room, a warm-up, a wait — is read
  off the same line as when it starts, and the act heading totals the act. Under each act's
  heading runs the **company line**: a step chart of how many performers are standing on the
  deck, rising when somebody walks on and falling when somebody leaves, with a dashed tick at
  every change and its time beneath — so a crowded dance, an emptying stage and a quick exit are
  read at a glance. The count is taken from the paths themselves (a finished path still stands
  where it left her; a performer in the wings is off), the heading names the peak
  (`peak 5 on the deck`), and the chart's caption counts the changes, because in a dense run the
  ticks are labelled only where two times would not collide. A short table under the line names
  each change — **Time · On · Off · On stage** — with the performers and their numbers, so a
  quick change reads *0:38.2 — on: Cleo 3 — off: — — 4 on stage* without opening a path. A
  change of one for one (someone off as someone comes on) leaves the line flat but still gets a
  tick and a row, which is the kind of change a call sheet is read for. It ends in a signature block — **called by**, **date**, **stage manager's signature**
  — on ruled lines that will not split across a page. A show where nobody has a path prints no
  call sheet at all, and a scene nobody is in is not listed.
- **Green room**: costumes are a list in the right pane, beside the cast — a name, three
  colours (body, skirt, hair) and a cut (**tutu**, **tunic** or **plain**). Each performer's
  row carries a **wears** picker, so dressing is one choice where you are already
  looking, and a costume's row says how many are wearing it. **+ Costume** starts from a
  colourway rather than a blank, so one click makes a dancer look dressed and the
  colours are then adjusted against the plan. A costume is data, not a drawing: the plan
  wears it as a skirt ring in its own colour (a tutu wide, a tunic narrow, plain a
  line), the elevation as a figure in its colours with the skirt, the crown of hair and
  a name in the dancer's own cast colour, and the printed elevation as the same figure
  darkened to print. Removing a costume undresses whoever wore it rather than leaving a
  reference to something that no longer exists, and a show written before the wardrobe
  opens with plain dancers exactly as it did.
- **The movement sheet**: **Moves** in the header opens a cheat sheet of the whole
  vocabulary — thirteen positions, four steps and four levels — each one drawn as a small
  dancer doing it, moving, with a line saying what it is. A drop-down can name a move but
  it cannot show one, and a name you cannot picture is a name you do not reach for. Click
  a move and it goes onto the point being edited — position, step or level, whichever the
  move is — and the strip under the stage updates with it. The sheet marks what that point
  already has, so the choice in force is visible, and it stays open between picks so a run
  of positions can be tried against the same point. Escape, the Close button or a click
  past it closes it, and it stops drawing as soon as it does. The cells are drawn by the
  same `pose.js` joints as the stage, so the reference cannot drift from the picture it
  describes.
- **A phrase in one go**: the sheet's first row is a **Phrase** — choose a step, the position
  it arrives in and the level, and the planner lays down the stations that step actually
  needs, after the dancer's last point. A chassé is its gather and its arrival (two
  stations), a pas de bourrée its three transfers (three), a pirouette its preparation in
  fourth and the revolution on the pointe (two, on the same spot, so the path before it does
  not move), and a walk is one station. Each one arrives with its own step, level, count
  shape and duration, so a sequence is no longer the same three fields typed per point. The
  heading is carried over from the last leg she actually travelled, so three phrases in a
  row make a line across the stage instead of a zigzag, and a phrase that would walk her into
  the wings is turned round rather than placed off the deck. A phrase is one undo step, its
  arrival is left focused so the next one carries on from it, and the sheet says where it
  will land before anything is placed ("after point 8 of Ada (00:19.500) · 2 stations, 1.4 m
  of travel"). That caption follows the path while the sheet is open, so an undone or
  deleted phrase does not leave a stale address. A step brings its own count — a pas de
  bourrée's three transfers are quicker than a walk's one — and the field can be typed over.
- **Phrases that link**: put a phrase on the end of another and the two become one movement.
  The station the first one arrived on is **passed through** rather than rested on: the
  position is reached exactly at that station and left straight away, where a station rested
  on is reached a third of a leg early and held, and the count goes through evenly instead
  of settling into it and gathering out of it again. Measured across a chassé–chassé
  junction the dancer's speed through it went from a low of 0.06 m/s — very nearly a stop,
  with the arabesque held for a quarter of a second — to a steady 0.63 m/s with the position
  reached exactly at the point and left immediately. Which stations are joined is visible:
  a junction's number is ringed in the station list, the focused-point strip offers a
  **through** toggle on it so the stop can be put back, and the printed **How in** column
  says `chassé, passed through` where a dancer must not stop. A phrase placed on a path
  you built by hand is not linked, since a hand-built point is a stopping place by
  definition; the phrase row says when it will join ("· joins it") before anything is placed.
- **Phrases counted in the music**: **Show settings** holds the show's **tempo** and **counts
  per bar**, and a phrase is placed by **counts** — how many counts of the music the whole
  phrase takes — rather than by a length in seconds. A count is a beat: at 120 bpm it is
  0.50 s, and a bar of four is 2.00 s. The phrase's stations divide those counts in the
  proportion the step is counted (a chassé's close and its step, one count each; a pas de
  bourrée's three transfers, one each), so a four-count chassé is two counts per transfer
  while a six-count pas de bourrée is two counts per transfer as well. The step brings its
  own count into the field (walk 2, chassé 2, pas de bourrée 3, pirouette 2) and it can be
  typed over. Phrases are aligned to the grid by the **on the** picker: **count**, **bar**, or
  **path** for the exact moment her path ends. Snapping is measured on the show's clock, not
  the dancer's, so a performer with a hold in her path still lands on the count the band is
  playing; a path that already ends on the grid is untouched, and one that ends between
  counts is joined by the leg into its first station — the caption says how far that catch-up
  is ("· starts 0.40 s on") before anything is placed. The bars are drawn faintly under the
  tracks in the timeline, counted from where the first music track begins, so a phrase can be
  placed against the music by eye rather than by arithmetic. A small **bar and count** readout
  rides just under the ruler with the playhead — `bar 3 · 2` — so a phrase or a station can be
  read against the music as it plays; it is counted on the show's clock, so a hold does not
  move it, it turns to the left of the line when there is no room on the right, and it is
  absent before the first track begins, when there is no bar to be on.
- **Points from the ruler**: double-click the timeline ruler — anywhere below the running order
  and above the tracks — and a point lands on the **count nearest the click** for the focused
  performer (or prop), at the place she already is at that moment, so the path's shape is
  untouched and only its timing gains a station. **Shift** puts it on the bar instead. The point
  is focused and the playhead moves to it; a second double-click on the same count focuses the
  point that is already there rather than stacking one on top, and a click that falls inside one
  of her holds takes the first count she is moving again on, because a count inside a hold is not
  a moment she can be stood at. The two legs either side of a new point take their own lengths and
  every other station keeps the time it was staged on. Double-clicking a performer's *row* still
  places a point exactly where the pixel fell, which is where a syncopation goes.
- **Phrases from the ruler**: the phrase row has a second button, **On the ruler…** — choose the
  step, the position it arrives in, the level and the counts, then press it and double-click a
  count on the timeline ruler. The sheet closes and the phrase is laid down *from that count*,
  so its stations divide the counts of the music from where you clicked instead of from the end
  of her path: a four-count chassé clicked on the bar at 00:22.500 puts its two transfers on
  23.5 and 24.5, one count each. **Shift** takes the nearest bar rather than the nearest count,
  the same gesture as placing a point. The leg into the phrase's first station begins on the
  count that was clicked, which is the rule the sheet's `on the` snapping already follows, so a
  phrase placed by click and one placed by snapping are timed the same way. A count inside one
  of her holds is skipped to the first count she is moving again on; a count she is already
  choreographed past is refused with her endpoint named rather than quietly cutting the stations
  that follow it (dropping work is what **Continue from** is for); a count well past the end of
  her path makes the leg into the phrase a long one, and the message says how many seconds she
  has to cross the stage in. The phrase is one undo step and its arrival is left focused.
- **Judged before the click**: while a phrase is armed, pointing at the ruler previews the
  placement — the count it would start on, a diamond on every count a station would land in, the
  stretch of music it would take, and a label in booth shorthand (`chassé · bar 12 · 2 → 3, 4`, or
  `chassé · 12·4 → 13·1 13·2` when it crosses a bar line). The preview is drawn from
  `phrasePlan`, which runs the placement's own arithmetic, so what it promises is what the click
  does; holding **Shift** moves the preview to the bar before the click does, and moving off the
  ruler or placing the phrase clears it. A station that would land **between** two counts is
  drawn as a hollow diamond rather than a filled one and counted in the label
  (`pas de bourrée · 12·1 → 12·3 13·1 13·4 · 2 of 3 between counts`), and the sheet says it
  before anything is armed at all: a seven-count pas de bourrée's caption reads `· 2 of 3 arrivals
  between counts (2.33, 4.67)`, because seven counts do not divide into its three transfers. A
  **hold** between its stations splits the phrase instead of stretching it: the arrival due before
  the stop is moved towards it, so she is standing in that position and holding it rather than
  frozen part-way through a transfer, and everything after the stop still lands on the counts it was
  counted to. Finishing that half is paid for out of the transfer that follows, so the arrival only
  goes as far as that transfer can spare: it always keeps **half** of the counts it was given, and a
  hold that has already taken more than that leaves the arrival on its own count. A four-count
  chassé placed across a half-second hold therefore arrives on its count, holds, and has its full
  half second to arrive on the last count — not a tenth of a second — rather than being strung out to
  a count it was never given. Both the caption and the hint say `· split by 1 hold (+0.50 s)` and the preview label says
  `· 1 hold inside`. A hold that *covers* one of the arrivals is refused rather than placed a count
  out — `A hold at 00:19.000 covers one of Ada's counts — place the phrase either side of the stop,
  or use fewer counts` — and the caption and preview say `a hold covers a count` before you press
  anything, because no split can keep the phrase's timing across a beat she is frozen through. Picking another performer, or pressing **Esc**, cancels
  an armed phrase; the hint over the stage says what is waiting to be clicked.
- **The posed dancer**: a station's ballet position is drawn, not just recorded. Each of
  the twelve positions — first to fifth, tendu, plié, relevé, arabesque, attitude,
  pirouette, pas de bourrée, chassé — is a few joint angles in `src/pose.js`, and the
  elevation draws the figure from them: arms overhead in fifth, a leg carried back and up
  in arabesque, the knees out over the toes in plié, the body a hand's width taller on
  the pointes (the legs lengthen instead of the feet leaving the floor). Between two
  stations the positions are blended, and the new one is reached in the first two thirds
  of the travel and held for the rest, because a dancer who is half in fifth for the
  whole count is dancing neither. Facing follows the travel, so a dancer crossing stage
  left extends the other arm, and the printed elevation draws the same joints, so paper
  and screen cannot disagree about the position. A station left at **— none —** draws
  the plain figure it always did. A leg also swings forward or back — a third angle per
  leg, `front`, in the same table: 24° downstage and 22° upstage in **fourth**, 16° in a
  **tendu**, and a body can **rock** over its toes (6° in arabesque, 5° in chassé), which
  tips the whole weight line forward so her feet sit behind her rather than under her. This
  is the axis the elevation cannot draw, and the reason the plan is no longer purely
  schematic: a fourth position splits 0.35 m towards the house and 0.32 m away from it,
  and the plan's two foot marks now sit one in front of the other, with the printed plot's
  crosses doing the same. What the elevation does with it is foreshortening — a leg swung
  forward is drawn shorter, which is exactly what the house sees, and why the hips come
  down to pay for a split.
- **Steps and turns**: a station also carries *how the dancer gets there*. **Step** is
  **walks** (the plain blend) or a named step — **chassé**, **pas de bourrée**,
  **pirouette** — which the figure holds while it travels, so the leg reads as the step
  rather than as a slow morph between two held positions: in on the first fifth, held
  through the middle, and the arriving position taken at the end. **Turn** is how far
  round they go on the way, in degrees (0 to 360, or negative backwards), spread across
  the travel so they are round by the time they arrive — a pirouette is a pirouette step
  with a 360 in that field. Each turn starts from the heading the last leg finished on,
  so consecutive turns add up: two stations of 180 are a chain of half turns and one
  revolution, not two turns that both restart at the front, and a dancer turned to face
  upstage stays facing upstage until a station turns them back (put −180 on it). **Turn
  over** sets how long that turn takes. Left empty it takes the transition into the point,
  which is how a turn has always worked; give it a longer length and the turn starts before
  the leg it ends on and carries across the points in between — so a slow revolution over
  three stations is one number to retime instead of four quarters to keep in step, and the
  paper prints it as `½ turn over 7.5 s`. A flat
  drawing cannot show a rotation, so it shows what the eye reads as one: the body narrows
  as it goes into profile, widens again mirrored as it comes round to the back, narrows,
  and returns. What a leg carries in depth comes back as width, which is the part that
  makes a turn honest: a fourth position at a quarter turn stands with its feet side by
  side rather than one in front of the other, both on screen and on the plan, because the
  whole stance is rotated by the heading rather than only the shoulders. At half a turn the
  split is fore-and-aft again but the other way round, since her devant now faces upstage. A turning dancer also **spots**: the head holds the way it was already
  facing while the body goes round, then whips to catch up over the last part of the turn,
  so the audience keeps the face — which is the whole reason a dancer spots. It is drawn
  through the hair, the one feature a head that size has: a crown from the front, a mass
  at the back in profile, the whole head from behind. Both are set on the focused point's
  strip under the stage and on the station's own row in the inspector, and the printed path
  sheet gives each station a **How in** column (`chassé, full turn`) — the turn on that leg,
  which is what a dancer rehearsing a chain reads.
- **A shaped count**: a leg is one length of time, but it need not be spent evenly. **Count**,
  beside the transition, sets the shape of that time: **even** (one speed throughout, and
  what every leg did before), **slow out · quick in** (gathers and arrives fast — a run-out,
  or the take-off before a jump), **quick out · slow in** (leaves promptly and settles), and
  **slow both ends** for a long adagio line. The stations and the shape of the path stay
  exactly where they were: only the speed between them changes, and the dancer, the position
  and the height all move on that one shaped clock, so nobody is halfway into an arabesque
  while still standing where an even count would have left them. The printed **How in**
  column names it (`chassé, slow out · quick in`), because a gathering step is counted
  differently from a settling one.
- **A line that bows**: a leg between two stations can arc instead of running straight.
  **Bow** is how far the path passes to the left of the straight line at the middle of the
  leg, in metres, negative to the right. Drag the line itself on the plan to bend it by eye
  and the point under the mouse goes with the mouse; type a number instead when the sweep
  has to be exact. The dancer walks the curve at one even speed — the time ticks space out
  evenly along the arc rather than bunching at the bend — so a chassé crosses the stage as a
  sweep the way a body actually carries its momentum, and the printed path draws the same
  curve, with the station's **How in** reading `arcs 1.2 m left`.
- **Levels**: a station also says how the dancer meets the floor — **flat**, **demi-pointe**,
  **pointe** or **in the air**. A rise makes the body taller where it stands (the legs
  lengthen and the hips come up, the feet stay on the deck, about 3 cm on the half and 8 cm
  on the point for a 1.7 m dancer); a jump takes it off the deck. **Off floor** is the height
  in metres, and leaving it empty means the floor — except in the air, where it takes the
  usual jump height of 0.35 m, so a sauté is typed smaller and a grand jeté larger. The
  elevation draws all of it: the body rises through the step and the shadow under it shrinks
  and fades as the dancer leaves the ground, which is the cue that tells a jump from a very
  tall dancer. A jump is a station in the air between two on the floor, so the dancer rises
  and falls across the legs either side of it. The printed station table names it in the
  Pose column (`5th position, en pointe`, `arabesque, in the air 0.4 m up`) and the printed
  elevation stands the figures at their heights.
- **A landing gives**: a station on the floor that a dancer comes down onto absorbs the drop
  — the knees bend, the body is lowest exactly at that station, and it unwinds into the next
  position across the following leg, so nobody rises straight out of the air into a tall
  pose. Crossed by a jump it needs no setting: the **plié** depth is taken from the height
  fallen from (about 11 cm off a jump of 35 cm, deeper for a bigger one). Type a depth in
  the field to choose your own — 0 is a stiff landing — and leave it empty to go back to what
  the drop needs. The station table prints it (`5th position, plié 0.11 m`).
- **Which foot carries**: every station stands on a foot, and the point strip says which. The
  position decides — first to fifth and a plié are both feet, a tendu, arabesque, attitude and
  pirouette the standing leg, a chassé the front leg, a pas de bourrée the ball of the foot
  behind — and a station with no position is a plain step, which leaves on the other foot from
  the one before it, so a bare path alternates. The picker's first entry names what was worked
  out (`auto — left`); choosing one types it in, and typing it is what travels with the show.
  Three things are said where the choice is made, all read from the position's own angles and the
  leg that has to hold them: a foot more than a hand's width off the deck cannot carry her
  (`Ada's right foot is 0.62 m off the deck here, so she cannot stand on it`); a stance foot that
  moves while the body stays where it is has skated (`Ada's left foot skates 0.33 m on the deck
  into this point`); and a body that walks further than the leg can follow leaves the foot
  behind (`Ada's left leg is 0.30 m too short to keep her foot planted into this point`). Only
  one is shown at a time — they are the same fault seen from three sides, and the first that
  applies is the one worth reading. The reach is measured along the whole leg rather than at its
  ends, because the furthest moment is usually part-way through a transfer, and it is allowed a
  hand's width of give first: the position table's legs are already at their length, so any spread
  is a centimetre or two over, and a stretch that small draws as a straight leg and reads as
  nothing. All three axes are measured — across, upstage and up — because the position table now
  carries a fore/aft swing as well as the frontal angles. The printed station table carries the
  column, so a rehearsal can check the weight as well as the shape.
- **Weight**: the hips go over the foot that carries her. With one foot planted the pelvis moves
  about 6 cm toward it and the free hip drops about 4 cm, so a figure on one leg is drawn leaning
  over that foot rather than standing square on nothing. The free leg bends at the knee to keep
  its foot exactly where the position put it — an arabesque's back leg keeps its height while the
  hip above it sags — and both numbers scale with the dancer's height, so a short dancer shifts
  less than a tall one. The shift follows the transfer of weight through a leg instead of
  switching at the station, and with both feet planted the hips stay square, because the weight
  is then between her feet. A landing's plié still lowers the body on the same feet, and that
  drop adds to this one rather than replacing it.
- **Footprints on the plan**: under every dancer the plan draws both of her feet — the one she
  is standing on filled and solid, the other a hollow ring — so the floor shows where the weight
  is and not only where the body is. The marks sit *under* the body, which is where feet are: a
  dancer in fifth hides them, a dancer in second shows them either side of her, and a foot the
  position has lifted (the back leg of an arabesque) is drawn faint rather than outlined, because
  she is not standing on it. A stance foot that skates while the body stands still leaves a red
  dashed streak from where it started to where it ended, drawn for the dancer being edited and
  only on the leg the playhead is in or the station being edited. A step too long for her leg is
  drawn the same way and for the same dancer only: the mark she should be standing on as an open red
  ring — open, because a filled mark would say the weight is there — a dashed red line from it to
  where her leg actually runs out, and a dot at that end, so the gap between the mark and her foot
  is the size of the step she cannot take. Foot positions come from
  `footAtLocal`, the same geometry the strip measures, so the mark and the warning cannot
  disagree. The printed sheets draw the same picture: a cross at each station's contact point on
  a path sheet, and under each performer on the stage plot at the top of the show, with the other
  foot open when it is on the deck too and nothing at all for a foot the position has lifted. The
  plot's legend names the marks, and the paths page says it in a note beside the tables.
- **Planted feet stay planted**: the elevation solves each leg instead of letting the position
  drag the foot along with the body. A stance foot is held on its contact — the same point the
  plan marks — and the knee bends to keep it there, so a body travelling over a planted foot
  shows a leg that leans over the floor rather than a foot that slides across it. The weight is
  on the departure foot for the first third of a leg and on the arrival foot for the last third,
  changing over between; the foot going from one contact to the other is lifted on the way and
  comes down on the new mark, higher the further it has to step. Nothing is drawn differently at
  the stations themselves, so a leg still begins and ends exactly where the position puts the
  foot. When the body gets further from a contact than the leg is long the solve cannot reach,
  and it says so in geometry: the leg straightens toward the mark and the foot stops at its
  length, which is what a step too long for one stance looks like. Depth is held the same way as
  the width: a foot planted while she walks upstage stays on its mark instead of being carried
  along with her, so the leg is drawn reaching forward or back to it. The plan's mark and the
  printed cross are the same held contact, so a footprint stays where it was put while she
  travels. The printed elevation bends over the same contacts, so paper and screen agree; a show
  with no plants set draws as it always did.
- **Eyes**: a dancer's eye shows or hides their body *and* their path. A plain click
  shows only that dancer, Ctrl-click keeps several on, and the master eye at the top
  of the track gutter shows only the dancer being edited.
- **Props**: one kind of object. With no stations a prop is stage dressing and stays
  off the timer; give it a station (**add to timer**, `+ Key`, or double-click its
  track row once timed) and it gains a track, a path, and a position that moves with
  the show. Every prop has an eye in the list, timed or not.
- **Carried props**: the prop inspector's **Carry** picker hands a prop to a dancer.
  From then on the prop rides along with them — offset from their body, so it reads
  as being carried at the side rather than swallowed — and because it borrows the
  dancer's clock it freezes with them through a hold. Drag the prop on the stage to
  change where it sits relative to them. Detaching leaves it where it stands; any
  stations it had are kept and are used again once it is no longer carried.
- **Hand-offs**: with the playhead where the change happens, the prop inspector's
  **hand off here** gives the prop to another dancer from that moment, and lists every
  hand-off with its time so one can be removed. Each hand-off is drawn on the prop's
  track as a tick with the new holder's name, and the track's label and the stage both
  name whoever holds it at the playhead.
- **Paths**: solid on stage and dashed in the wings, tick marks at equal intervals
  of time so their spacing reads as speed, chevrons for direction, numbered
  keyframes, hold rings, and a short fading trail behind the playhead.
- **Editing points on the stage**: click a point to focus it (the playhead moves
  there, so the performer stands on it), drag to move it, right-click to delete it
  and everything after it. The strip under the stage holds that point's ballet
  position, how the dancer travels into it, its transition, and Continue / Delete from
  here.
- **Lighting**: a lantern hangs over a spot on the floor. Each one in the **Lights**
  section of the Stage pane carries a **type** — a **spot** with a lens and an edge, or a
  **flood** that washes a scene — the **gobo** (a template in the gate: open, **star
  field**, **dapple**, or **window**), a colour chosen from a strip of gels or from the
  colour wheel, a standing **level**, a **height** above the deck, the width of the **pool**
  it washes, and a position — dragged by its marker on the plan (hold Alt to ignore the
  grid) or typed as **across** and **depth**. Changing type brings its usual pool with it
  (a spot 2.4 m, a flood 6 m), and the Pool field overrules that afterwards. What it does is
  drawn in both views: a pool of its own colour on the plan — a hot middle with a rim for a
  spot, an even wash for a flood — and in the elevation a beam from the bottle down to the
  wash it leaves on the deck, so a light hung out of the opening's sight is visibly out of
  the picture. A gobo shapes that pool: a scatter of stars, overlapping dapple, or a pane
  with mullions, drawn in the light's own colour, and read edge-on as marks along the deck
  line in the elevation. A lantern can be a **follow spot**: set
  **Follows** to a performer and it is aimed wherever that person is at the playhead — the
  pool and the beam move with them through paths, holds and pauses, its own Across and
  Depth fields go dead because it has no place of its own, and the row is named `Light 1 →
  Ada`. Cleared, it goes back to being a fixed special where it was hung; if the performer
  leaves the show, it becomes one again rather than pointing at nothing. A performer off
  stage in a wing is off stage: no pool is drawn out there. A cue can also **hand a spot**
  from one performer to another, or back to the lantern's own place: that is a pan rather
  than a cut, so the beam leaves one and arrives at the other over the cue's duration,
  following neither for the middle of it. A hand-off is made in the card's **Hand to**
  picker (beside the level, which can be left on **hold level** so only the aim moves), in
  the picked cue's own **Hand to** row, or from the row's right-click menu — where every
  performer is one click. Hand-offs work from a fixed lantern too, which is how a special
  becomes a follow spot part-way through a show.
  Its cues are level changes — **up** to its
  standing level, **half**, or **out** — on a row of its own, with a duration each: add one
  with the panel's **Add at** button, a double-click on the row (which flips the light the
  other way), or the row's right-click menu. Clicking a band picks it for editing in the
  list; dragging its ends retimes it. The eye on the row takes the light out of the picture
  without touching its cues, and **Light cue (s)** in Show settings is how long a placed
  cue takes.
- **Show settings**: the lengths a cue is given when it is placed, before it is dragged
  into shape — **cloth cue** (a curtain or drop move), **music fade**, **light cue**,
  **hold** and **pause**, in seconds — and **end fade**, how long the music takes to come
  down into the end of the show. They live in the show file, so they survive a reload and travel
  through export/import: `0` is a cut for a cloth cue, a fade or the ending, holds and
  pauses stop at a tenth of a second. They are the same values the track menu's **the move
  takes**, **the fade takes** and **the music fades over** fields show, so either place can
  set them.
- **Timeline**: one row per music track, the narration row, one row per lantern, one
  per dancer, one per curtain, drop or card, and one per prop that is on the timer (a
  carried prop's row says so and shows no path).
- **Company line**: a strip under the tracks, on the same clock and the same gutter, drawing
  how many performers are standing on the deck across the stretch you can see — up when
  someone walks on, down when someone leaves, with the peak labelled and the playhead's own
  count in the gutter (`3 performers`), so the crowd of a scene is visible while editing
  rather than only on paper. It counts the same way the printed call sheet does: a path that
  has finished still stands where it left her, a performer in the wings is off. It is measured
  against the clock rather than the screen, so scrolling and zooming re-read the same numbers,
  and every save re-measures it, so dragging a path on the stage updates the line on the next
  frame.
  Drag the ruler to scrub, drag a diamond to retime a keyframe, drag holds and
  pauses, double-click a track to add a key, double-click a hold or pause to delete.
  Ctrl+wheel zooms around the cursor.
- **Right-click a track** for that row's own tools at the moment you clicked, then
  drag the band into shape: on a **music** row, fade out / to half / in — with **the
  fade takes** set above them, so a fade can match the change of scene instead of
  always taking two seconds, and `0` is a hard cut to that level — “the track ends
  here”, “the track starts here”, mute, replace the audio, and delete the fade under
  the pointer; on a **curtain, drop or card** row, open or close
  it (or fly it in or out, or walk a card on or off) at that moment — with **the move takes** set above the two
  actions, so a four-second fly is chosen rather than the default 1.5, and `0` makes a
  cut — and delete the cue under the pointer; on a
  **dancer or timed prop** row, a station here, a hold here, and — on a station —
  continue the path from here or delete it and what follows; on the **narration**
  row, go to the line, remove it, record a take here or attach a voice file here;
  and on a **hold or pause band** itself, how long it lasts — typed exactly, or “go
  to it”, or delete it; and on the **end line**, the moment it lands on — typed
  exactly — or delete the end. Every row also offers “pause the whole show here” and
  “end the show here (instead)”. Both lengths are kept **in the
  show** (`prefs`), not in the tab: a file reopened next week — on any machine — flies
  and fades with the timings it was staged with. The menu is the named version of
  gestures that were already there (double-click flips a curtain, a drop or a fade),
  and it never deletes anything the stage's own right-click does — the stage keeps
  that gesture to itself.
- **Pauses and holds** are different things and both are implemented: a pause stops
  the whole show for its duration; a hold freezes one track's local clock while
  everything else carries on. Each is dragged by its band, and its length can also be
  typed: right-click the band, set **the pause lasts** or **the hold lasts**, and the
  band redraws (a hold's row prints `HOLD 1.8s`, so the length is readable without
  opening anything). A mark can also be **drawn**: drag across empty space in a
  performer's row and the band appears under the pointer with its length counted as you
  drag (`HOLD 3.1s`), made on release; drag the **Lights** row the same way for a pause,
  or hold **Shift** and drag any row — over a music band or a cue band as well as empty
  space — to draw a pause there. A plain click makes nothing, and scrubbing a cloth or
  dialogue row is unchanged. A whole menu visit is one undo step, however many digits were
  typed, and a marker cannot be set to nothing — a tenth of a second is the floor.
- **The end of the show** is a marker of its own, kept apart from the running order: a
  performance finishes where you decide it does — on a curtain call, a blackout, a button
  on the last chord — not at the last station of the last dancer. **+ End** in the
  transport puts it at the playhead (pressing it again moves it — a show has one end),
  the red line is dragged along the timeline, and a right-click on it types the exact
  moment or deletes it. Playing stops on that moment rather than running on into nothing;
  so does a run-through, which is how you watch the show finish. Pressing play on a
  finished show starts it again from the top. Everything past the line is struck out as
  hatched ground, so a cue parked beyond it looks as unreachable as it is. A show with no
  end marker behaves as it always did: it ends a second past its last cue.
  The ending is a fade, not a cut: the music comes down over the **end fade** (2 s by
  default, `0` for a hard stop) so what stops at the line is silence. The stretch it takes
  is washed into the line on the timeline, the length is set in **Show settings** or by
  right-clicking the line (**the music fades over**), and it belongs to the ending rather
  than to a cue — drag the curtain call somewhere else and the fade goes with it.
- **Preview**: play / stop / Space, millisecond readout, collision detection with
  optional stop-on-overlap, undo/redo, autosave.
- **Save / Reload / Clear** (header): **Save** writes the browser's copy first and then a
  JSON file the user chooses — a save dialog where the browser offers one, a download
  where it does not — and says how many bytes either way. **Reload** opens a show file and
  reports which one came in, or that a file was not a show and nothing changed. **Clear**
  takes the staging out so a new show can be built on the same stage: the cast keeps its
  names, colours and numbers, and costumes, props and where they stand, the cloth, the
  lanterns, music, voice pieces, stage size and every setting are kept — what goes is the
  paths, the holds and pauses, and the cues on cloth, lights and music. It commits before
  it clears, so one **Ctrl+Z** puts the whole show back exactly.
- **Printing**: **Print plan** in the header opens a paper version of the same saved
  show, set out on A4. The first sheet is a stage plot for the crew — the floor, wings
  and their bays, wing legs, every curtain and drop at its own depth and width, props,
  and where each performer stands as the show opens — drawn to scale with metre
  numbers on two edges, a north-arrow equivalent (audience / upstage / stage left and
  right) and a scale bar, followed by the running order (each act and, indented under
  it, its scenes — when each starts, how long it runs and when it ends) and tables of
  scenery and props. The second sheet is
  the same stage in side elevation, as the house sees it at the top of the show: the
  deck, the opening with a metre rule, every curtain and drop at its own height and fly
  state, and the performers at the stage's dancer height — anything in the wings or
  lifted above the header is out of the picture and named, rather than quietly drawn
  outside the frame. Under it, a table of heights and flying (how tall each piece is,
  where it sits above the deck, and how open or flown it is) and a cast key. This sheet
  follows a moment rather than always the opening: the paper view's bar has a time
  field and a list of the show's cues, act openings, scene openings and light cues,
  so a drop caught halfway through a fly can be
  printed, and the address keeps that moment (`?at=8000`) so the sheet can be
  reopened. A hand-off is a pan rather than a cut, so both ends of one are in that list
  — the start of the move and its arrival. Once the end of the show has been placed, the next sheet is the
  **curtain call**: the same plan at the moment the clock stops, with the cloth as it
  hangs then (a drop still part-way through its fly says how far in it is), props where
  they were left, and every performer standing where their path leaves them, so the crew
  sees the picture the show closes on. Paths are left off it on purpose — it is the stage
  as the audience sees it, not how anyone got there. Under the drawing, **where everyone
  ends** in numbers: each performer's closing station — cast number, name, the ballet
  position they finished on, metres across from the centre line, depth from the
  proscenium, and whether they are on stage or in which wing. A performer whose path
  finished earlier is listed where it left them, holding the pose they ended on, because
  that is where they still are when the curtain comes down.
  Under that, **to strike after the call** — the clearance list for the crew: every curtain,
  drop, card and prop with where it stands in metres, what it is doing at that moment
  (`hanging`, `flown out`, `22% open`, `held up — “Act 1 · Scene 2”`, `carried by Ada`,
  `dressing`) and the move that clears it (`flies out`, `walked off`, `carried off by
  Ada`). A curtain is the house's own cloth and is opened rather than struck, and a drop
  already out has nothing to do, so both say so with a dash instead of inventing a task.
  The list prints with an empty tick box against every row and a ruled signature line for
  **checked by**, **stage manager** and **the time the stage was clear** — it is a sheet to
  be worked through by hand at the call, not only read. Then one plan per
  performer, on its own with numbered stations and walked in order, and a table of
  each station's show time, ballet position and position in metres. The last sheet is
  a cue sheet in running order: scenery cues with what each piece does and how long it
  takes, holds, pauses and prop hand-offs, with the act and scene each cue falls in.
  A music cue appears on the cue sheet as **Music · track enters**, and the plot
  sheet's facts name the track and where it starts. A scene card is a cue with its
  words on it — **Scene card · Card · brings on “Act 1 · Scene 2” · 0.8 s** — so the
  person walking it on knows what it says and when it goes; the elevation at that
  moment shows the board as the house sees it. Cards are not flown, so they are left
  out of the heights table. Once the end of the show has been
  placed, the ending prints as two cues of its own: the sounding track **fades out for
  the end** over the end fade, and at the end moment **Whole show · End · curtain call
  — the show ends here**, with “—” in the length column because nothing is moving.
  A show whose end is only implied prints no ending cue, since there is no moment the
  crew was given. A voice piece appears as **Narration · line plays** with its own
  duration in the length column (**1.5 s**), not a "cut": the booth needs to know when
  the line starts and how long it runs over, and a spoken line is the one thing on the
  sheet that is never over on the beat. The facts count the lines and their total time.
  When the show has lanterns in it, the cue sheet is followed by a **Lighting** sheet:
  first the rig, as the crew hangs it — number, lantern, type, the gel by name with its
  swatch (`straw`, `daylight`, or a hex code for a colour mixed on the wheel), the gobo,
  the height it hangs at, the pool it washes, its position in metres across and deep,
  the performer a follow spot is on, and the level it stands at before its first cue —
  and then every light cue in one running order across the whole rig, with the time,
  the act and scene, the lantern, its gel and gobo, what the cue does and how long it
  takes. A cue that moves a level says so (`to 45%`, `out`, `full`); one that moves the
  aim says who it hands the spot to (`hand to Bea`, `hand to its own place`); a cue that
  does both prints both, separated by a comma. A hand-off with no length prints `cut`,
  because the beam jumps rather than pans. A show with no lanterns prints no sheet at
  all, rather than a blank page.
  Nothing has to be exported first — the
  print view reads the same saved show, so what prints is what is on the stage. Eyes
  are ignored on paper: a performer hidden while editing is still in the cast, so the
  printout shows everyone and every prop. Page breaks are set for A4 portrait, so
  print from the paper view's own **Print** button rather than from the planner's
  window, which would print the working screen instead.

## Not built yet

A lighting rig with more than a bottle in it — beams angled from the house rather than
hung over the deck, colour and gobo changes inside a cue rather than set once, and a
whole-stage master — scenery cues for props and for the fly floor's real travel in three
dimensions, depth shading on paths, and video export.

**Queued next** (written up in [NOTES.md](NOTES.md) so the shape is not lost):

- **Narration, still to come** — the part that is not built: a line typed into the
  show and spoken by the browser instead of recorded, the music ducking under a
  spoken line, and a narration-only page for the rehearsal room.
- **Projector** — a screen drop and a video that plays on it, with the whole change of
  scene (curtain in, drops out, screen in, play, curtain in, stage reset) cued as one
  piece of automation instead of six hand-placed cues.
- **Record the show to a video file** — a player that captures the stage while the clock
  runs and saves what it sees. The browser can do this without becoming an .exe (the
  canvas and the soundtrack are both capturable), at the cost of recording in real time
  and of a web format rather than a cinema codec.
- **Stage effects** — the shelf the snow belongs on: an effect with a kind, an area and
  a strength, brought on and taken off by cues on its own row, drawn over the plan and
  the elevation as it falls and printed as a line on the cue sheet (`snow on, full stage`).
  Practical effects cannot fall in the browser, but the cue, its timing and the picture
  of it can, which is what a rehearsal and a crew sheet actually need.

Of the appearance pages, the costume library and dressing the performers are built (see
**Green room**); a props workshop and a drop studio are still written up in
[NOTES.md](NOTES.md) only.

## Project notes

- Autosave key: `choreographer.show.v1` in `localStorage`. The demo show is
  generated in code, so a cleared browser returns the same starting point.
- The show file carries `prefs` as well as the show: how long a placed curtain cue, a
  music fade, a hold and a pause take, and how long the music fades over at the end
  (milliseconds; defaults 1500, 2000, 1500, 2000, 2000).
  They are settings a company expects to survive reopening, so they travel with the show
  and through export/import rather than living in the tab, and they are edited either in
  **Show settings** or in the track menu's own fields.
- Audio lives in IndexedDB under the database `choreographer.music.v1`, one record
  per attached file: the name, the bytes and the waveform peaks, keyed by the id each
  music track or narration piece carries (`music-…` and `voice-…`, in the same store).
  Clearing site data removes it; the cues stay in the show and report the file missing
  until their audio is attached again.
- `threads/` holds Freebuff Desktop's own per-thread data, not app data. It was
  created while diagnosing an app-side `ENOENT`. Ignore it in version control.
- `.freebuff/project-id` does **not** match this folder's name. That mismatch is
  the likely cause of the desktop app's "different project" and `ENOENT` errors,
  and it should not be hand-edited (its own `.gitignore` warns against it).
- There is no git repository here yet.
