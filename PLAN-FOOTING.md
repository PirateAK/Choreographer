# Foot contact and weight — a plan

Written 1 Nov 2026, before any code changed. This is the design the next sessions work from,
and the reasoning behind each choice.

**Built so far: steps 1–8** (1 Nov 2026) — the plant a station carries, the checks it
makes possible, the column on paper, the footprints on the plan with the skate streak, the
leg solve over a held contact, the hips over the stance foot, and the fore/aft axis that the
plan below assumed was missing. See `NOTES.md`, *Which foot is on the floor*, *Footprints on
the plan*, *The legs that keep their feet*, *The step she cannot take*, *The gap on the floor*,
*The hips over the foot* and *The axis that was missing*. Every place the work differs from
the plan is marked in place, and the most of them were the missing axis — which now exists,
so those caveats are historical rather than current.

## The problem, measured

A figure is drawn with its feet at the station's ground point and its limbs wherever the
pose angles put them. So the *body* travels the path and the feet go along with it — the
deck never holds a foot still.

Two numbers to start from, both taken from the pose table as it stands (a 1.7 m dancer):

- **No ankle is ever on the floor.** Every pose leaves both ankles between 0.017 m and
  0.085 m above the deck (first: 0.017, chassé: 0.085, arabesque's working leg: 0.624),
  because an ankle is a joint and the drawing stops there. A foot that is 2 cm up is a foot
  that can slide without anyone noticing.
- **The feet move relative to the body.** Blending fifth into chassé moves the left ankle
  from 0.10 m to 0.414 m and the right from −0.107 m to 0.225 m **with the body standing
  still** — about 0.3 m of sideways drift in each foot. Add the body's own 1.4 m of travel
  over that same chassé and the deck sees a foot slide more than 1.5 m.

Some poses are already specific about the floor: second puts the feet 0.73 m apart, tendu
0.49 m out, arabesque lifts one to 0.62 m. The table knows where the feet are — it just has
no notion of one of them being *held*.

## The one idea

**A planted foot is a constraint on the body, not a new kind of drawing.**

Today the body's position is authored (the path) and the feet are a consequence. Contact
inverts that for the foot that carries the weight: that foot's world position is fixed, and
the body is what is solved to sit over it. Everything the planner already stores — stations,
paths, counts, holds, levels, cues — stays exactly as it is; contact is a layer that reads
those and decides where the pelvis can be at each moment.

The second half of the idea is what makes holds safe: **contact is derived from her own
clock, not the show's.** A hold is a stretch of content she is frozen through, so a contact
computed from local time cannot be disturbed by one — she is planted before the stop on a
foot, and she is planted on the same foot, in the same place, after it. That is the
requirement stated in the request, and it falls out of using the clock the holds already
operate on (`localOfContent`), rather than something that has to be handled specially.

## What gets stored

All of it optional, all of it additive — a show with none of it opens and plays exactly as
it does today.

| field | on | meaning | default |
| --- | --- | --- | --- |
| `plant` | a station | `'left'`, `'right'`, `'both'`, `'air'` | derived, see below |
| `plantX`, `plantY` | a station | where that foot lands, in stage metres | the foot's position when it lands |
| `weight` | a station | 0–1, how much of the body is over the planted foot | 1 on a single plant, 0.5 on both |

**The derived defaults.** Two small tables, in the pose module beside the angles, because
that is where the geometry of a position already lives:

- **by position**: which foot carries — first/fifth both, second both, tendu the standing
  leg, arabesque/attitude the standing leg, pirouette the standing leg, chassé the front leg,
  pas de bourrée the ball of the back foot, plié both.
- **by step**: which foot lands — a walk alternates from the last plant, chassé lands front,
  pas de bourrée lands the third step, a turn keeps the standing foot.

A phrase, then, lays down stations that alternate feet on their own, which is what a
sequence of steps actually does; a choreographer who wants the other foot sets `plant` on
the station and the rest of the phrase inherits from there.

**Why on the station and not on the show.** Contact is a decision about a moment — "she is
on her left foot here" — and a station is the planner's moment. It also means the value
travels with the point when it is dragged, splits with a hold the way the rest of the station
does, and can be printed per row in the station table.

## How it is solved, in three levels

**Level 0 — measure and say it (no change to the figure).**
Compute where each foot is on the deck (ankle position, turned into stage metres) and compare
a planted foot's position across the leg it is planted for. If it moves more than 5 cm while
the body stands still, report it: *"Her left foot skates 0.33 m across the stage into this
point."* Nothing moves on screen. This level alone earns its keep: it is the first time the
planner can say a piece of choreography is impossible.

*Built, with two corrections.* A leg that **travels** is a step, not a skate — its feet are
meant to change — so only a leg shorter than 0.15 m is measured, and only where the plant is
a single foot (changing from first to second moves both feet and always has). And only the
across-stage component exists today: a foot's depth is read as the body's, so a skate upstage
reads as zero and the figure in the warning is a minimum. That half waits for the solve.

**Level 1 — offset the body (a stopgap, and probably not worth building).**
Draw the figure shifted so the planted foot stays put, keeping the body on its authored path
by moving the whole figure. Cheap, and wrong in a specific way: it makes the body leave the
path the choreographer drew, silently, by up to half a metre — and the path on the plan
would then disagree with the figure in the elevation, which is the one thing this project has
never allowed.

**Level 2 — solve the legs (the real thing).**
Two-bone IK per leg: hip on the path, stance ankle on its contact point, knee bent by the
amount that satisfies both — which is exactly a plié, and is therefore *correct* rather than
a hack. When the hip is further from the planted foot than the leg is long, the solver
cannot reach, and that failure is the honest answer: the step is too long for one stance and
needs a second. This is also the geometry a 3D rig will ask for later, so it is not a
throwaway.

*Built, in the elevation and on the printed elevation — see step 3. The out-of-reach failure is
drawn as a stretched leg and said in the point strip (`legOverreach`), with a hand's width of give
before it is reported, because the position table's legs are already at their length.*

Recommendation: **Level 0, then Level 2.** Skip Level 1.

## What each view does with it

- **Plan.** Two small foot marks under the dancer, the planted one solid and joined to the
  body by a hairline, the free one hollow — the top-down picture of where the weight is. A
  slide is drawn as a short red streak from the contact point to where the foot actually
  went, which is the fastest way to see a problem without reading anything.
- **Elevation.** The stance foot sits on the deck line (0.0, not 0.017), the body travels
  over it, and the free foot lifts with the pose. Weight shift shows as the hip moving over
  the planted foot and dropping on the free side, which is what a plié already does in one
  axis.
- **Run-through.** Inherits the elevation, so a found slide is visible in motion.
- **Print.** The station table gains a **Plant** column (`L`, `R`, `both`, `air`), and the
  stage plot draws a small cross at each station's contact point. The cue sheet is untouched.
- **Movement sheet.** Positions gain a line saying which foot carries — "arabesque: on the
  standing leg" — because that is the kind of thing you learn a move by knowing.

## The warnings it makes possible

These are the product, not a nicety — they are the difference between a picture of a dance
and a plan of one:

- a planted foot that slides more than 5 cm;
- a leg that cannot be reached: the hip is further from the contact than the leg is long;
- a landing with both feet planted and the level in the air;
- a plant on a foot that the pose has off the deck (an arabesque standing on the lifted leg);
- a hold that begins with her mid-transfer on one foot and ends asking for the other;
- a phrase whose plants alternate wrongly for its step (a chassé that lands back).

## Order of work

1. **The contact table and the measurement.** *Built.* Ankle positions already exist in
   `joints()`; they are turned into stage metres, the position table decides the plant (the
   step table was dropped — with no fore/aft it could only guess against the angles), `plant`
   is on the station, and the skate is reported. No visual change to the figure, one new
   column on paper. *Checked:* a pirouette into a chassé on the spot reports 0.33 m; a
   travelling leg and a both-feet change report nothing; a right-foot plant in an arabesque
   reports the foot 0.62 m off the deck.2. **Foot marks on the plan.** *Built.* The picture of the weight, plus the skate streak. The
   marks go *under* the body rather than on top of it (a footprint is read by what shows around
   the dancer), a lifted foot is drawn faint, and the streak appears only for the dancer being
   edited, on the leg the playhead is in or the station being edited. *Checked:* the filled mark
   and the dotted streak are both on the canvas for a 0.33 m skate and neither is there when
   another dancer is selected.
3. **The two-bone solve in the elevation.** *Built.* `footPins` says where each foot is held
   (in the body's own frame, with a weight from 0 to 1), and `joints` solves the knee for any
   weight above zero: the ankle is taken from where the position put it towards the contact, and
   the knee is placed on the perpendicular that closes both segments of the leg, choosing of its
   two answers the one nearest the pose's own knee so a solved leg bends the way the position
   bends, and it reports in `shortfall` what it could not reach. Out of reach it draws a straight
   leg toward the contact with the foot stopped at the leg's length, and `legOverreach` walks the
   leg to find the worst moment and says it in the point strip: *"Ada's left leg is 0.30 m too
   short to keep her foot planted into this point."* The same slot carries the other two plant
   faults, and only the first that applies is shown. The plan draws it too, the way it draws a
   skate: an open red ring on the mark she is not standing on, a dashed line from it to where her
   leg runs out, and a dot there — the gap drawn on the floor is the across-stage part of the
   shortfall, because a plan has no height to draw the rest in. A foot crossing from one contact to another
   lifts in an arc between them — a step, not a slide — by up to 12 cm, more for a longer step,
   and nothing lifts where the two contacts are the same point. The printed elevation asks the
   same function, so paper cannot disagree. *Check:* a body standing still in `second` that
   changes to `arabesque` with the left foot planted keeps that ankle at 0.364 m across for the
   first third of the leg where the unsolved figure had slid it to 0.254 m — 11 cm of skate —
   then swings it onto arabesque's contact (0.085 m) and holds it there; a 0.9 m travelling leg
   holds its contact to the millimetre through the first third while the body moves away, then
   swings the foot 0.9 m across with the ankle lifted to 0.077 m at mid-swing; with no motion at
   all (`second` to `second`) nothing lifts and nothing moves; leg length stays the model's 0.884 m
   throughout, so nothing is stretched. The app plays through such a path with no console output.
   *Limits:* the solve sees only the across axis (a foot's depth is still the body's), and weight
   shift — hip over the stance foot — is still step 4.
4. **Weight.** *Built.* `joints` reads which foot carries her from the pins and moves the hips over
   it: the stance socket goes 3.5% of her height outward (6 cm on a 1.7 m dancer), the free socket
   drops 2.2% (3.7 cm), and the pelvis is drawn at the midpoint of the two, with the torso following
   at 60% of the shift so she keeps standing over her path. The free leg's ankle is held at the place
   the position gave it, so the drop bends that knee instead of pushing the foot through the deck —
   an arabesque's back leg keeps its 0.62 m while the hip above it sags. Both numbers scale with the
   dancer and both ramp with the pin's weight, so the shift happens across a leg rather than at a
   station, and with both feet planted the hips stay square. The landing's plié still carries the body
   lower on the same feet, and its drop adds to this one. *Check:* with both feet planted the joints
   are identical to before the change; on one foot at weight 1 the pelvis moves 4 cm and drops 1.9 cm,
   the stance socket 6 cm, the free socket 3.7 cm, and the free ankle does not move at all; at weight
   0.5 every one of those is halved; a mirrored plant at `facing −1` mirrors the shift exactly. This
   also moves the reach figures slightly — a 2.4 m step is now 0.30 m short (was 0.32 m), because her
   hips are over the foot she is leaving.
5. **Phrases choose plants.** *Built.* `phraseStations` writes the foot each of its stations
   stands on, from the by-step rules: a walk alternates from the foot she was last on, a chassé
   lands the front foot of the two it gathers, a pas de bourrée lands the third of its three
   transfers, and a turn keeps the standing foot the fourth prepared her onto. A preparation
   stands on both, which is what it is. Where a position already names its own side — an
   arabesque — the phrase writes nothing and lets the position decide, so a plant can never
   contradict the drawing; a body in the air is left alone for the same reason. The lead is read
   once, when the phrase is placed, from the last station's plant typed or derived, which is
   what makes a foot set by hand carry into the phrase after it. *Checked:*
   `test-phrase-plants.mjs` — three walks alternate right·left·right; two chassés land right then
   left where the derived table repeated the right; two pas de bourrées land right then left off
   their preparations; a pirouette arriving on the left turns on the left, which the derived
   table would have answered with the right; a foot typed on a station turns the next step the
   other way; two walks arriving in arabesque both keep the arabesque leg and write nothing. The
   one fault the probe reports — a fourth-position preparation skating 0.35 m into the turn — is
   identical with the written plants and with them stripped, so it belongs to the position table,
   not to this.
6. **The printed plot and table.** *Built.* The column is in the station table, the crosses are on
   the plot and on the path sheets, and the closing picture carries them too: the curtain call is
   drawn by the same `castAt` the plot is, so the feet come with it — a cross under each performer
   standing on the deck at the end, an open ring for the foot that is down but not carrying her,
   and nothing for a lifted one. Checked on a show closed at 0:19.5: three performers, three
   crosses and three rings, drawn under the bodies and under the station circle exactly as the
   plot draws them. The note that used to sit here said this was deliberately skipped, on the
   grounds that the closing picture is about the last shape rather than about feet. It is about
   the last shape *of the body*, and a body cannot stand where its feet are not — so the skip no
   longer describes what the page prints, and nothing in the code had to change to make it true.

7. **The fore/aft axis.** *Built.* A leg carries a third angle, `front` — how far it swings towards
   the house or away from it — and a body carries `rock`, which tips the weight line over the toes.
   The elevation foreshortens by it (a leg swung forward is drawn shorter, which is what the house
   sees), the feet acquire a depth of their own, and every foot measurement — the plan's marks, the
   printed crosses, the skate and the reach — now uses all three axes instead of guessing the depth
   from the body. *Check:* first, second, fifth and plié are byte-for-byte the joints they were
   (their `front` is zero); fourth splits 0.35 m towards the house and 0.32 m away, with its feet
   9–10 cm up (an ankle, not a floating foot); a tendu devant puts its free foot 0.24 m in front of
   her; an arabesque's standing foot sits 9 cm upstage of the pelvis because the body is tipped over
   it; and a station that changes from first to fourth on the spot now reports a 0.35 m skate, where
   before the same movement was invisible.

8. **Depth held, not authored.** *Built.* The pin used to measure its contact along the stage while the
   legs are solved in her own frame, so the two were negatives of each other and a held foot sat at the
   mirror image of its mark — invisible while she stood still, and obvious on a walk upstage, where the
   foot went with her. The pin is now built in her frame (the stage offset rotated back by her turn, with
   `facing` mirroring the across axis) and carries `sx`/`sy` in stage metres for anything that measures
   on the floor. `rock` moved into the base every leg is solved from, because it was depth the elevation
   had never drawn and the free leg's own mark was missing it. A foot changing contacts now travels
   between the two marks instead of switching halfway (a 0.6 m jump in one frame). `feetOnFloor` gives
   the plan and the printed plot the same held contact the legs are solved to, so a footprint stays put.
   *Check:* a plié walking 0.8 m upstage holds its mark at 2.000 m until the weight crosses while the
   body reaches 2.225 m, and the drawn ankle is within 3 mm of the mark (the leg at its length); a walk
   downstage mirrors it; stationary first, second, fifth, plié, fourth, tendu and arabesque put each
   pinned ankle within 4 mm of where the position puts it, so nothing that does not travel moves; the
   plan's marks and the solved ankles agree to the millimetre at nine moments of a walk, and the print
   page draws them. *Limit:* the across axis of a pin is read in the drawing's own mirror-and-squash
   frame, so a plant held *through a turn* can leave a couple of centimetres of that component unheld.

All eight steps are built. Step 3 is the heart of it and the first piece that changes how the stage
looks, and step 5 is the last of them: a phrase that arrives already standing on the right feet.

## What must not change

- **The pose table stays the one source of ankle geometry**, so the screen and the paper
  cannot disagree — the same rule that keeps the printed elevation true today.
- **No new dependency and no build step.** This is arithmetic on numbers the app already has.
- **A show with no contact data plays exactly as it does now.** Defaults are derived, never
  written into the file unless the choreographer changes one.
- **Paths stay authored.** If the solve cannot follow a path, it says so; it does not quietly
  redraw the path to suit itself.

## Open questions, before step 3

- **Turning.** A pirouette pivots on one spot, so its contact is a point *and* an angle: the
  planted foot rotates under her while the spotting head holds front. The point is easy; the
  angle means the foot mark needs a direction, and a chain of chaînés alternates both.
- **Pointe and demi.** The contact point is the ball or the toe rather than the ankle, so the
  ankle sits above the deck by the height of the foot. That is a single offset per level, and
  it is why "no ankle is on the floor" is not a bug to fix but a number to carry.
- **Passing stations.** `pass` means she does not rest there, so a plant at a passed station
  is a moment rather than a stance — it should not generate a slide warning when the leg
  keeps moving.
- **Lifts and duets.** Two dancers sharing a support is a different constraint entirely; it
  is out of scope here and should stay out until solo work is solid.
- **Turns inside a hold.** A hold mid-turn freezes a rotation where a dancer would normally
  finish it; contact makes that visible, and the honest answer is a warning rather than a
  correction.
