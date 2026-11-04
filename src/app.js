// Application wiring: panels, playback clock and the render loop.
import {
  state, createShow, normalise, addCast, addScenery, restore, persist, commit, undo, redo,
  PALETTE, SHAPES, FILLS, LAYERS, POSES, uid, sortedPauses, collisionsAt, posOfContent, posAtLocal,
  contentOfLocal, localOfContent, endContent, ensureDurations, reflowKeys, removeStation, toggleVisibility, displayOfContent,
  endMarker, setEnd,
  removeFromStation, truncateAfter, addWingLeg, removeWingLeg, canAddWingLeg,
  findObject, isProp, propPosOfContent, CARRY_OFFSET, carrierOf, carrierIdOf,
  addCarryHandoff, removeCarryHandoff, addSceneryCue, removeSceneryCue, clothSpan, clampClothX, maxClothSpan,
  musicLevelAt, addMusicCue, removeMusicCue, updateMusicCue, audibleLevel,
  clothDepth, dropStack, actRanges, actAt, addAct, removeAct, actHasWork, ACT_MIN_MS, ACT_MAX_MS, sceneryStateAt, totalActLength,
  activeMusicAt, addMusicTrack, removeMusicTrack, setMusicStart, musicSpan,
  narrationAt, narrationSpan, addNarration, removeNarration, setNarrationAt, renameNarration,
  setNarrationSpeaker, clipsSpokenBy,
  nextNarrationName, STEPS,
  addLight, removeLight, addLightCue, updateLightCue, removeLightCue, lightLevelAt,
  LIGHT_TYPES, LIGHT_GOBOS, LIGHT_GELS, LIGHT_SPREAD_BY_TYPE,
  scenesOf, sceneAt, sceneRanges, addScene, removeScene, clampSceneOffsets, updateCue,
  addCostume, removeCostume, COSTUME_STYLES, BEND_LIMIT, LEVELS, AIR_LIFT, LIFT_MAX, levelOf, ABSORB_MAX,
  POSE_LABEL, STEP_LABEL, LEVEL_LABEL, EASES, EASE_LABEL,
  plantsOf, plantProblem, footSkate, legOverreach, PLANT_LABEL, rolesOf, setRole,
  scanOverlaps, overlapFix, applyOverlapFix, pathsKey, CLEARANCE,
  phraseShape, addPhrase, countGrid, localAtCount, phrasePlan, timelineScrollRange,
} from './model.js';
import { StageView } from './stage.js';
import { MoveSheet } from './cheatsheet.js';
import { conventionRows, setConvention, resetConvention, getApprover, setApprover, approveConvention, revokeApproval, previewSummary } from './conventions.js';
import { specOf } from './pose.js';
import { ElevationView } from './elevation.js';
import { Timeline, GUTTER } from './timeline.js';
import { CompanyLine } from './company.js';
import { fmtTime } from './draw.js';
import { music, dropStored } from './music.js';
import { narration } from './narration.js';
import { storeAudio, readAudio } from './audiostore.js';
import { buildBundle, bundleFileName, checkBundle, applyBundle } from './narration-bundle.js';
import { HouseView } from './house.js';
import { Recorder, CAPTURE_MODES } from './capture.js';
import { VideoEngine } from './video.js';
import { addVideo, removeVideo, videoSpan, videoAt, addImage, addSlideCue, removeSlideCue, projectionAt, slideLayersAt } from './model.js';
import { SlideEngine } from './slides.js';
const slides = new SlideEngine();
const video = new VideoEngine();
let pendingVideoAt = 0;
let pendingVideoId = null;
let recorder = null;

const $ = (id) => document.getElementById(id);
const SEL_KEY = 'choreographer.sel.v1';
// Which track a file-picker trip is for: null means "add a new one".
let pendingMusicId = null;
// Where that new track should start, read when the picker opens rather than when
// the file finishes decoding: choosing a file takes time and the show may be running.
let pendingMusicAt = 0;
// Where a new voice piece belongs, read when the recording starts or the picker
// opens — the same reason as the music: the moment must not follow the clock.
let pendingVoiceAt = 0;
// The moment the take in progress began at, which is where it lands.
let voiceTakeAt = 0;
const STAGE_HINT = 'Click a point to edit it · drag to move it · drag the line to bow it · right-click deletes it and everything after';
// The standing instruction is a coach mark: read once, then out of the way. It sits over
// the front of the stage, which is exactly where a scene card stands and a downstage
// path ends, so it retires on the first click there (or after a while) rather than
// covering the picture for the whole session. Anything the app has to say still shows.
let coachMark = true;
// The movement cheat sheet, built the first time it is opened: a sheet nobody opens costs
// nothing, and thirty animated canvases are not free.
let moves = null;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const app = {
  stage: null,
  elevation: null,
  timeline: null,
  house: null,
  editSlideCue(id) {
    state.ui.slideCueId = id || null;
    renderSlides();
    const section = $('slideSection');
    section.classList.remove('folded');
    section.scrollIntoView({ block: 'nearest' });
  },
  addSlideCueAt(at) {
    const imageId = $('slideChoice').value || null;
    if (!imageId) { state.ui.hint = 'Choose a gallery image before adding a slide cue'; return; }
    commit();
    const cue = addSlideCue(state.show, at, imageId, slideFade());
    state.ui.slideCueId = cue.id;
    app.timeline.revealTrack('slides');
    app.rebuild();
  },
  editVideo(id) {
    state.ui.videoId = id;
    state.ui.dirtyPanels = true;
    renderVideos();
    const row = Array.from($('videoRow').children).find((el) => el.dataset.video === id);
    row?.scrollIntoView({ block: 'nearest' });
  },
  select(id) {
    state.ui.hint = null;
    // A phrase armed for the ruler belongs to the dancer it was armed for: focusing something
    // else cancels it rather than putting it on whoever happens to be picked next.
    state.ui.phraseArmed = null;
    if (state.ui.selectedId !== id) {
      if (state.ui.stationGuide) {
        state.ui.stationGuide = null;
        state.ui.placingStations = false;
      }
      state.ui.stationIdx = null;
      // A picked cue belongs to one piece of scenery; focusing something else
      // must not leave it looking edited.
      state.ui.cueId = null;
    }
    // A dancer or prop and a lantern are different departments: picking one lets
    // go of the other, so only ever one thing looks focused on the plan.
    state.ui.lightId = null;
    state.ui.selectedId = id;
    state.ui.dirtyPanels = true;
    // Focus never rests on something hidden: selecting it turns its eye back on.
    const picked = findObject(state.show, id);
    if (picked && picked.visible === false) {
      picked.visible = true;
      persist();
    }
    // Remember the pick so the editing panel is not blank after a reload.
    try {
      localStorage.setItem(SEL_KEY, id || '');
    } catch (e) {
      /* storage blocked - not fatal */
    }
  },
  // Focus one point of a performer's path, and put the playhead on it so the
  // performer is standing at the point being edited.
  focusStation(dancer, index) {
    if (!dancer) return;
    this.select(dancer.id);
    const key = dancer.keys[index];
    if (!key) return;
    state.ui.stationIdx = index;
    state.ui.playhead = contentOfLocal(state.show, dancer.id, key.t);
    state.ui.dirtyPanels = true;
  },
  // Cut the path at this point: the point and everything after it goes.
  deleteFrom(dancer, index) {
    if (!dancer || !dancer.keys[index]) return;
    commit();
    removeFromStation(dancer, index);
    const tail = dancer.keys.length - 1;
    state.ui.stationIdx = tail >= 0 ? Math.min(index - 1, tail) : null;
    const key = state.ui.stationIdx != null ? dancer.keys[state.ui.stationIdx] : null;
    state.ui.playhead = key ? contentOfLocal(state.show, dancer.id, key.t) : 0;
    this.rebuild();
  },
  /* -------------------------------------------------------------- the cheat sheet */

  // The movement sheet is a reference first and a picker second: it opens over the stage so
  // the point being edited stays where it is, and says which point that is.
  openMoves() {
    if (!moves) {
      moves = new MoveSheet(
        $('movesSheet'),
        (kind, value) => app.pickMove(kind, value),
        (opts) => app.placePhrase(opts),
        (opts) => app.phrasePlanNow(opts)
      );
    }
    const d = findObject(state.show, state.ui.selectedId);
    const i = state.ui.stationIdx;
    const key = d && Number.isInteger(i) ? d.keys[i] : null;
    moves.open(key ? { pose: key.pose, step: key.step, level: key.level || 'flat' } : null);
    moves.say(key ? `point ${i + 1} of ${d.name}` : 'no point picked');
    moves.phraseWhere(this.phraseLead());
  },
  // Where a phrase would be appended, in the sheet's words: the end of the focused dancer's
  // path, which is the only place a sequence is built from.
  phraseLead() {
    const d = findObject(state.show, state.ui.selectedId);
    if (!d) return { text: 'no dancer picked', ready: false };
    if (isProp(d)) return { text: `${d.name} is a prop, not a dancer`, ready: false };
    if (!d.keys.length) return { text: `${d.name} has no path yet — put a first point on the stage`, ready: false };
    const end = d.keys[d.keys.length - 1];
    const grid = countGrid(state.show);
    return {
      text: `after point ${d.keys.length} of ${d.name} (${fmtTime(contentOfLocal(state.show, d.id, end.t))})`,
      ready: true,
      // A path that ends on a phrase arrival can be joined rather than added to.
      link: end.phraseEnd === true,
      countMs: grid.count,
      bpm: grid.tempo,
      bar: grid.bar,
      origin: grid.origin,
      // The grid is the music's, so the sheet needs the moment on the show's clock, not the
      // dancer's own.
      at: contentOfLocal(state.show, d.id, end.t),
    };
  },
  // Why a phrase will not go here, in one sentence: a hold that eats one of its arrivals is a beat
  // it cannot stand on, and the phrase's own timing cannot be kept across it.
  phraseRefusal(d, plan) {
    // The hold's band begins a millisecond before the moment she stops, which is where the ruler
    // draws it — so the time in the sentence is the time on screen.
    // The hold's band begins a millisecond before the moment she stops, which is where the ruler
    // draws it — so the time in the sentence is the time on screen, rounded to the tenth the show
    // is placed in.
    const band = plan && plan.cover ? contentOfLocal(state.show, d.id, Math.max(0, plan.cover.t - 1)) : null;
    const at = band == null ? '' : ` at ${fmtTime(Math.round(band / 10) * 10)}`;
    return `A hold${at} covers one of ${d.name}'s counts — place the phrase either side of the stop, or use fewer counts`;
  },
  // What the movement sheet's phrase row would do right now, without placing anything: the caption
  // asks this so it can warn about a hold the phrase would cross before the button is pressed.
  phrasePlanNow(opts) {
    const d = findObject(state.show, state.ui.selectedId);
    if (!d || isProp(d) || !d.keys.length) return null;
    const snap = opts.snap === 'bar' ? countGrid(state.show).perBar : Number(opts.snap) || 0;
    return phrasePlan(state.show, d, { ...opts, snap });
  },
  // Lay a phrase down in one go: a step and the position it arrives in become the stations
  // that step needs. One undo step, and the arrival is left focused so the next phrase
  // carries on from it.
  placePhrase(opts) {
    const d = findObject(state.show, state.ui.selectedId);
    if (!d) {
      moves.say('pick a dancer first — a phrase is a path');
      return;
    }
    if (isProp(d)) {
      moves.say(`${d.name} is a prop: phrases are for dancers`);
      return;
    }
    if (!d.keys.length) {
      moves.say(`${d.name} has no path yet — press + Stations and click the stage for a first point`);
      return;
    }
    if (opts.station) {
      state.ui.phraseArmed = null;
      state.ui.stationGuide = {
        id: d.id, step: opts.step || 'walk', pose: opts.pose || 'none', level: opts.level || 'flat',
        durationMs: Math.max(1, Number(opts.counts) || 1) * countGrid(state.show).count,
      };
      state.ui.placingStations = true;
      if (state.ui.playing) pause();
      moves.close();
      state.ui.hint = `Click the stage for ${d.name}'s next station · draft distance bands, not technique limits · Esc cancels`;
      state.ui.dirtyPanels = true;
      return;
    }
    // "On the ruler" hands the placement to the timeline: the sheet closes and the next click on
    // a count puts the phrase there, so its counts divide from that count instead of from the end
    // of her path.
    if (opts.pick) {
      this.armPhrase(d, opts);
      return;
    }
    // A hold between the phrase's stations splits it and keeps the counts; one that covers an
    // arrival is a beat she cannot stand on, so the placement is refused rather than made a count
    // out.
    const plan = phrasePlan(state.show, d, {
      ...opts,
      snap: opts.snap === 'bar' ? countGrid(state.show).perBar : Number(opts.snap) || 0,
    });
    if (plan && plan.swallowed) {
      moves.say(this.phraseRefusal(d, plan));
      return;
    }
    commit();
    ensureDurations(d);
    // 'bar' is a measure of the show, which only the model knows the length of.
    const snap = opts.snap === 'bar' ? countGrid(state.show).perBar : opts.snap;
    const placed = addPhrase(state.show, d, { ...opts, snap });
    const added = placed.added;
    if (!added.length) return;
    const from = d.keys.length - added.length;
    this.focusStation(d, d.keys.length - 1);
    this.rebuild();
    const shape = phraseShape(opts.step);
    const poseName = POSE_LABEL[opts.pose] || '';
    moves.mark({ pose: opts.pose, step: opts.step, level: opts.level });
    moves.say(
      `${STEP_LABEL[shape.step] || shape.step}${poseName ? ' to ' + poseName.toLowerCase() : ''} · ${added.length} station${
        added.length === 1 ? '' : 's'        } (${from + 1}${added.length > 1 ? '–' + d.keys.length : ''}) of ${d.name} · ${(placed.ms / 1000).toFixed(2)} s${
        placed.linked ? ' · linked to the point before' : ''
      }${placed.holds ? ` · split by ${placed.holds} hold${placed.holds === 1 ? '' : 's'} (+${(placed.stretch / 1000).toFixed(2)} s)` : ''}`
    );
    moves.phraseWhere(this.phraseLead());
  },
  // Arm the phrase for the ruler. The sheet closes rather than staying up: the next thing wanted
  // is the music, and a panel over the stage is in the way of it. What was chosen is kept whole
  // — step, position, level and counts — because the sheet is closed by the time it is used.
  armPhrase(d, opts) {
    state.ui.stationGuide = null;
    state.ui.placingStations = false;
    const step = opts.step || 'chasse';
    const label = (STEP_LABEL[step] || step).toLowerCase();
    state.ui.phraseArmed = {
      id: d.id,
      step,
      pose: opts.pose,
      level: opts.level,
      counts: Math.max(1, Number(opts.counts) || phraseShape(step).counts),
    };
    moves.close();
    state.ui.hint = `Double-click a count on the ruler to start ${d.name}'s ${label} there · Shift for the bar · Esc cancels`;
  },
  // A phrase put on a count of the music: its stations divide the counts from where the click
  // landed instead of from the end of her path. The leg into its first station begins on that
  // count, which is the same rule the sheet's snapping follows, so a phrase placed by hand and a
  // phrase placed by click are timed the same way.
  placePhraseOnCount(contentMs, byBar) {
    const armed = state.ui.phraseArmed;
    if (!armed) return;
    state.ui.phraseArmed = null;
    const d = findObject(state.show, armed.id);
    if (!d || isProp(d) || !d.keys.length) {
      state.ui.hint = 'That dancer has no path to put a phrase on';
      return;
    }
    const grid = countGrid(state.show);
    const spot = localAtCount(state.show, d, contentMs, byBar ? grid.perBar : 1);
    const last = d.keys[d.keys.length - 1];
    const endAt = contentOfLocal(state.show, d.id, last.t);
    // A phrase is built on the end of a path, so a count she is already choreographed past is
    // refused rather than quietly cutting the stations that follow it: dropping work belongs to
    // "Continue from", which says how much of it is going.
    if (spot.ct < endAt - 1) {
      state.ui.hint = `${d.name} is choreographed to ${fmtTime(endAt)} — start the phrase after that, or press Continue from a point first`;
      return;
    }
    // A hold that covers one of the phrase's arrivals cannot be split around: refused, with the
    // hold named, rather than placed a count out.
    const plan = phrasePlan(state.show, d, { step: armed.step, pose: armed.pose, level: armed.level, counts: armed.counts, at: contentMs, atBar: !!byBar });
    if (plan && plan.swallowed) {
      state.ui.hint = this.phraseRefusal(d, plan);
      return;
    }
    // The moment she is standing at before the phrase is walked out of: with a bar well past the
    // end of her path the leg into the phrase is a long one, and the message says where it began.
    const fromAt = endAt;
    commit();
    ensureDurations(d);
    const placed = addPhrase(state.show, d, {
      step: armed.step,
      pose: armed.pose,
      level: armed.level,
      counts: armed.counts,
      at: contentMs,
      atBar: !!byBar,
    });
    if (!placed.added.length) {
      state.ui.hint = 'The phrase could not be laid down there';
      return;
    }
    const from = d.keys.length - placed.added.length;
    this.focusStation(d, d.keys.length - 1);
    this.rebuild();
    const stepLabel = (STEP_LABEL[armed.step] || armed.step).toLowerCase();
    const poseName = POSE_LABEL[armed.pose] || '';
    state.ui.hint = `${stepLabel}${poseName ? ' to ' + poseName.toLowerCase() : ''} · ${placed.added.length} station${
      placed.added.length === 1 ? '' : 's'
    } (${from + 1}${placed.added.length > 1 ? '–' + d.keys.length : ''}) of ${d.name}, from the ${
      byBar ? 'bar' : 'count'
    } at ${fmtTime(spot.ct)}${
      placed.holds ? ` · split by ${placed.holds} hold${placed.holds === 1 ? '' : 's'} (+${(placed.stretch / 1000).toFixed(2)} s)` : ''
    }${
      placed.linked
        ? ' · linked to the point before'
        : // A phrase put well past the end of her path is reached by one long leg: say how long,
          // because that is the time she has to cross the stage in.
          spot.ct - fromAt > 60
        ? ` · ${((spot.ct - fromAt) / 1000).toFixed(2)} s after her last point`
        : ''
    }`;
  },
  // Put a move on the focused station. The sheet stays open, so a run of positions can be
  // tried against the same point without closing and reopening it.
  pickMove(kind, value) {
    const d = findObject(state.show, state.ui.selectedId);
    const i = state.ui.stationIdx;
    if (!d || !Number.isInteger(i) || !d.keys[i]) {
      moves.say('pick a point on the stage first — a move goes on a station');
      return;
    }
    if (isProp(d)) {
      moves.say(`${d.name} is a prop: positions, steps and levels are for dancers`);
      return;
    }
    commit();
    ensureDurations(d);
    d.keys[i][kind] = value;
    this.rebuild();
    moves.mark({ pose: d.keys[i].pose, step: d.keys[i].step, level: d.keys[i].level || 'flat' });
    const label = kind === 'pose' ? POSE_LABEL[value] : kind === 'step' ? STEP_LABEL[value] : LEVEL_LABEL[value];
    moves.say(`${label || value} · point ${i + 1} of ${d.name}`);
  },
  // A point placed from the music: the ruler is clicked at a bar or a count, so the station lands
  // on that count rather than wherever the pixel fell, at the place the performer already is at
  // that moment — the path's shape is untouched and only its timing gains a station. `byBar` is
  // the Shift gesture, for a point that belongs on a bar rather than on a count.
  addPointOnCount(contentMs, byBar) {
    const d = findObject(state.show, state.ui.selectedId);
    if (!d) {
      state.ui.hint = 'Pick a performer or a prop first — a point belongs to a path';
      return;
    }
    if (d.carriedBy) {
      state.ui.hint = 'That prop is carried — detach it before adding stations';
      return;
    }
    const grid = countGrid(state.show);
    const spot = localAtCount(state.show, d, contentMs, byBar ? grid.perBar : 1);
    const at = spot.ct;
    const lt = spot.lt;
    commit();
    ensureDurations(d);
    // A point already here is focused rather than stacked on: two stations on one count would be
    // a leg of no length.
    const already = d.keys.findIndex((k) => Math.abs(k.t - lt) < 60);
    if (already >= 0) {
      this.focusStation(d, already);
      this.rebuild();
      return;
    }
    // A dressing prop that has never been on the timer starts where it stands rather than at the
    // middle of the stage; anything already moving keeps the place it is on its own path.
    const p = d.keys.length ? posAtLocal(d, lt) || { x: 0, y: 2 } : { x: Number(d.x) || 0, y: Number(d.y) || 2 };
    d.keys.push({ t: Math.round(lt), x: p.x, y: p.y });
    d.keys.sort((a, b) => a.t - b.t);
    const i = d.keys.findIndex((k) => Math.abs(k.t - Math.round(lt)) < 1);
    // The two legs either side of the new point get their own lengths; every other station keeps
    // the time it was staged on.
    d.keys[i].dur = i === 0 ? 0 : Math.round(lt) - d.keys[i - 1].t;
    if (d.keys[i + 1]) d.keys[i + 1].dur = d.keys[i + 1].t - Math.round(lt);
    this.focusStation(d, i);
    this.rebuild();
    state.ui.hint = `Point ${i + 1} of ${d.name} placed on ${byBar ? 'the bar' : 'the count'} at ${fmtTime(at)}`;
  },
  // Give a dressing prop its first station, which puts it on the timer.
  addPropToTimer(prop) {
    if (!prop || !isProp(prop) || (prop.keys && prop.keys.length)) return;
    commit();
    prop.keys = [{ t: Math.round(contentOfLocal(state.show, prop.id, state.ui.playhead)), x: prop.x, y: prop.y, dur: 0 }];
    this.select(prop.id);
    state.ui.stationIdx = 0;
    this.rebuild();
  },
  // Keep this point, drop what follows, and leave it focused to build from.
  continueFrom(dancer, index) {
    if (!dancer || !dancer.keys[index]) return;
    commit();
    truncateAfter(dancer, index);
    this.focusStation(dancer, index);
    this.rebuild();
  },
  // Focusing a lantern, from its marker on the plan or from its row in the list.
  // It is deliberately not `select`: a light is not a performer or a prop, and the
  // inspector should keep saying what it says.
  focusLight(id) {
    state.ui.lightId = id;
    state.ui.selectedTrack = id;
    state.ui.selectedId = null;
    state.ui.stationIdx = null;
    state.ui.dirtyPanels = true;
    if (id) {
      const l = (state.show.lights || []).find((x) => x.id === id);
      if (l && l.visible === false) {
        l.visible = true;
        persist();
      }
    }
  },
  // The timeline's row menu speaks the way the transport does — "at this
  // moment" — so each entry moves the playhead and then runs the command the
  // button would have run.
  addKeyAt(id, at) {
    state.ui.playhead = Math.round(at);
    this.select(id);
    const d = findObject(state.show, id);
    const before = d && d.keys ? d.keys.length : 0;
    addKeyAtPlayhead();
    // A station is not added twice at the same moment: say so, and leave the one
    // that is there focused, rather than looking like the click did nothing.
    if (d && d.keys && d.keys.length === before) {
      const lt = contentOfLocal(state.show, d.id, state.ui.playhead);
      const idx = d.keys.findIndex((k) => Math.abs(k.t - lt) < 60);
      if (idx >= 0) {
        state.ui.stationIdx = idx;
        state.ui.hint = 'There is already a station here';
        this.rebuild();
      }
    }
  },
  addHoldAt(trackId, at) {
    state.ui.playhead = Math.round(at);
    state.ui.selectedTrack = trackId;
    addHold();
  },
  addPauseAt(at) {
    state.ui.playhead = Math.round(at);
    addPause();
  },
  recordVoiceAt(at) {
    toggleRecording(at);
  },
  attachVoiceAt(at) {
    attachVoiceFile(at);
  },
  replaceMusicAudio(id, at) {
    pickMusicFor(id, at);
  },
  rebuild() {
    state.ui.dirtyPanels = true;
    persist();
  },
};

/* --------------------------------------------------------------- demo show */

function demoShow() {
  const s = createShow();
  s.name = 'Winter Recital — sketch 1';

  const main = addScenery(s, 'curtain');
  main.name = 'Main curtain';
  main.layer = 'front';
  main.order = 0;
  main.open = 0.22;

  const legs = addScenery(s, 'curtain');
  legs.name = 'Tab legs';
  legs.layer = 'center';
  legs.order = 0;
  legs.open = 0.88;
  legs.color = '#4a2a3c';

  const drop = addScenery(s, 'drop');
  drop.name = 'Backdrop — forest';
  drop.y = s.stage.depth - 0.5;
  drop.w = s.stage.width;
  drop.d = 0.3;
  drop.color = '#24506b';

  const a = addCast(s, { name: 'Ada', color: PALETTE[2], shape: 'circle', fill: 'solid' });
  a.keys = [
    { t: 0, x: -8.5, y: 1.6 },
    { t: 3000, x: -4.6, y: 3.4 },
    { t: 6500, x: -1.2, y: 1.8 },
    { t: 10000, x: 1.8, y: 4.2 },
    { t: 14000, x: 4.4, y: 1.5 },
    { t: 18000, x: 7.8, y: 2.6 },
  ];

  const b = addCast(s, { name: 'Bea', color: PALETTE[4], shape: 'triangle', fill: 'hollow' });
  b.keys = [
    { t: 0, x: 8.6, y: 3.8 },
    { t: 3500, x: 3.6, y: 2.2 },
    { t: 8000, x: 0.2, y: 2.6 },
    { t: 12000, x: -3.6, y: 4.0 },
    { t: 17000, x: -8.6, y: 1.4 },
  ];

  const c = addCast(s, { name: 'Cleo', color: PALETTE[5], shape: 'square', fill: 'half' });
  c.keys = [
    { t: 0, x: 1.2, y: 7.0 },
    { t: 5000, x: 0.2, y: 4.8 },
    { t: 9000, x: -0.8, y: 2.0 },
    { t: 13000, x: 0.4, y: 4.9 },
    { t: 17500, x: 0.0, y: 7.0 },
  ];

  s.markers.push({ id: uid('m'), kind: 'hold', trackId: b.id, t: 8000, duration: 1800 });
  s.markers.push({ id: uid('m'), kind: 'pause', t: 11000, duration: 2000 });
  return s;
}

/* ------------------------------------------------------------------ panels */

// The show's music, as a list: each track has a name, an entry point, a level
// with its own fades, and a row on the timeline. It is edited the way the cast
// is — one item per track, added and removed from the list — because a show
// changes music the way it changes scenes.
function renderMusic() {
  const holder = $('musicRow');
  const badge = $('musicState');
  const btn = $('btnMusic');
  const list = state.show.musicTracks || [];
  if (!holder) return;
  if (badge) badge.textContent = list.length ? String(list.length) : 'none';
  if (btn) btn.textContent = list.length ? '+ Track' : '+ Attach track';
  holder.innerHTML = list.map(musicItem).join('') ||
    '<p class="hint">No music yet. Attach a track and it joins the running order, with its own row on the timeline.</p>';
}

function musicItem(t) {
  const missing = music.statusOf(t) === 'missing';
  const sounding = activeMusicAt(state.show, state.ui.playhead);
  // A track longer than the running order would be cut off partway through. What
  // matters is how much plays, not how big the file is.
  const span = musicSpan(t);
  const short = span > 0 && t.start + span > totalActLength(state.show) + 500;
  return `<div class="item${sounding && sounding.id === t.id ? ' sel' : ''}" data-track="${t.id}">
      <div class="row">
        <button class="eye ${t.visible === false ? 'off' : ''}" data-music="eye" title="Mute or unmute this track">${t.visible === false ? '○' : '◉'}</button>
        <span class="tag">\u266a</span>
        <input type="text" data-f="music-name" value="${esc(t.name)}" aria-label="Track name" />
        <button class="del" data-music="remove" title="Remove this track from the show">×</button>
      </div>
      <div class="row">
        <span class="label">starts</span>
        <input type="number" data-f="music-start" min="0" step="1" value="${+(t.start / 1000).toFixed(1)}" style="max-width:66px" aria-label="Seconds into the show where this track starts" />
        <span class="tag">s</span>
      </div>
      <div class="row" title="How much of the track plays from its entry point">
        <span class="label">plays</span>
        <input type="number" data-f="music-play" min="0" step="0.5" value="${+(musicSpan(t) / 1000).toFixed(1)}" style="max-width:66px" aria-label="Seconds this track plays from its start" />
        <span class="tag">s</span>
        <button class="tag pick" data-music="trim" title="End this track where the playhead is">end here</button>
      </div>
      <div class="row">
        <span class="tag">${missing ? 'file missing' : t.length ? fmtTime(t.length) + ' of file' : 'no length'}</span>
        ${musicSpan(t) !== t.length ? `<span class="tag">trimmed to ${fmtTime(musicSpan(t))}</span>` : ''}
        <button class="tag pick" data-music="replace" title="Attach the audio for this track">replace</button>
      </div>
      ${missing ? '<p class="hint">The audio for this track is not in this browser. Attach it again to hear it — the track keeps its place.</p>' : ''}
      ${short ? `<p class="hint">The track runs to ${fmtTime(t.start + t.length)} but the acts end at ${fmtTime(totalActLength(state.show))}, so the show — and the music — stop there. <button class="tag pick" data-music="fit" title="Lengthen the last act to cover this track">Fit the running order</button></p>` : ''}
      ${fadeEditorHTML(t)}
    </div>`;
}

// A fade is a cue on the track's own level: from wherever the music is to a new
// level over a duration, which is what a change of scene needs — the cloth moves
// over silence and the music comes back up on the other side.
function fadeOptions(current) {
  return [
    ['0', 'fade out'],
    ['0.5', 'fade to half'],
    ['1', 'fade in'],
  ]
    .map(([v, l]) => `<option value="${v}"${current != null && String(current) === v ? ' selected' : ''}>${l}</option>`)
    .join('');
}

function fadeWord(level) {
  if (level <= 0.005) return 'silent';
  if (level >= 0.995) return 'full';
  return Math.round(level * 100) + '%';
}

function fadeText(c) {
  const what = c.level <= 0.005 ? 'fade out' : c.level >= 0.995 ? 'fade in' : 'to half';
  return what + (c.dur ? ' over ' + (c.dur / 1000).toFixed(1) + ' s' : '');
}

// What the fades have made of the track by the playhead, so a silenced track can
// be told apart from one that is simply past its end.
function fadeLive(m) {
  // The level as it is heard, which is the track's own fades taken down by the
  // show's end — so the row says "silent" at the curtain as well as after a fade out.
  const level = audibleLevel(state.show, m, state.ui.playhead);
  const moving = (m.cues || []).some(
    (c) => (c.dur || 0) > 0 && state.ui.playhead >= c.at && state.ui.playhead < c.at + c.dur
  );
  return fadeWord(level) + (moving ? ' \u00b7 fading' : '');
}

function fadeEditorHTML(m) {
  const cues = Array.isArray(m.cues) ? m.cues : [];
  const rows = cues
    .map((c) => {
      const at = fmtTime(displayOfContent(state.show, c.at));
      const on = state.ui.musicCueId === c.id;
      if (!on) {
        return `<div class="row cue-row" data-music-cue="${c.id}" title="Click to edit this fade">
          <span class="label">${fadeText(c)}</span>
          <span class="tag">${at}</span>
          <button class="del" data-music="del-fade" data-fade-id="${c.id}" title="Delete this fade">remove</button>
        </div>`;
      }
      const target = c.level <= 0.005 ? '0' : c.level >= 0.995 ? '1' : '0.5';
      return `<div class="cue-row on cue-edit" data-music-cue="${c.id}">
        <div class="row">
          <span class="tag">${at}</span>
          <button class="del" data-music="del-fade" data-fade-id="${c.id}" title="Delete this fade">remove</button>
        </div>
        <div class="row">
          <select data-f="fade-edit" title="Where this fade takes the music">${fadeOptions(target)}</select>
          <input type="number" data-f="fade-edit-dur" min="0" step="0.5" value="${((c.dur || 0) / 1000).toFixed(1)}" style="max-width:58px" aria-label="Seconds this fade takes" />
          <span class="label">s</span>
        </div>
      </div>`;
    })
    .join('');
  return `<div class="row">
      <span class="label">Fades</span>
      <span class="tag">${cues.length || 'none'}</span>
      <button class="tag pick" data-music="add-fade" data-cue-add="1" title="Add this fade where the playhead is">${cueAddLabel()}</button>
    </div>
    <div class="row">
      <select data-f="fade-to">${fadeOptions('0')}</select>
      <input type="number" data-f="fade-dur" min="0" step="0.5" value="2" style="max-width:58px" title="Seconds the fade takes" />
      <span class="label">s</span>
    </div>
    <div class="row live-row" title="Where the track's level stands at the playhead"><span class="label">now</span><span class="tag live" data-music-live="${m.id}">${fadeLive(m)}</span></div>
    <p class="hint">A fade moves the track from wherever it is to that level, over those seconds. Put the playhead where it should begin and press the button; drag the band on the Music row to retime it.</p>
    ${rows ? '<div class="cue-list">' + rows + '</div>' : ''}`;
}

/* --------------------------------------------------------------- narration */

// Narration is a list of pieces rather than a running order: two of them may
// speak at once, and each one simply occupies its own stretch of the clock. It
// is edited the way the music is — a row per piece — because a show gains and
// loses voice lines through the night, and each needs its own moment.
function renderNarration() {
  const holder = $('voiceRow');
  if (!holder) return;
  const list = state.show.narration || [];
  const badge = $('voiceCount');
  if (badge) badge.textContent = list.length ? String(list.length) : 'none';
  const btn = $('btnRecord');
  if (btn) {
    // While the mic is open the button is the way out of it, and says for how
    // long it has been listening.
    if (narration.recording) {
      btn.textContent = '■ Stop · ' + (narration.elapsedRecording() / 1000).toFixed(1) + ' s';
    } else {
      btn.textContent = '◉ Record';
    }
    btn.classList.toggle('recording', narration.recording);
  }
  holder.innerHTML =
    list.map(voiceItem).join('') ||
    '<p class="hint">No voice yet. Put the playhead where the narrator speaks, then press <b>Record</b>.</p>';
}

function voiceItem(c) {
  const missing = narration.statusOf(c) === 'missing';
  const end = c.at + narrationSpan(c);
  // Two lines over each other is sometimes wanted (one voice under another) and
  // sometimes a mistake; either way it is worth saying out loud rather than
  // leaving to be discovered in a run-through.
  const over = voiceOverlaps(c);
  return `<div class="item" data-voice="${c.id}">
      <div class="row">
        <span class="tag">\u201c</span>
        <input type="text" data-f="voice-name" value="${esc(c.name)}" aria-label="Narration name" />
        <button class="del" data-voice-act="remove" title="Remove this piece and its recording">×</button>
      </div>
      <div class="row">
        <span class="label">starts</span>
        <input type="number" data-f="voice-at" min="0" step="0.1" value="${+(c.at / 1000).toFixed(1)}" style="max-width:66px" aria-label="Seconds into the show where this piece starts" />
        <span class="tag">s</span>
        <button class="tag pick" data-voice-act="seek" title="Put the playhead at the start of this piece">go</button>
      </div>
      <div class="row">
        <span class="label">speaker</span>
        <select data-f="voice-speaker" aria-label="Who speaks this piece">${speakerOptions(c.speaker)}</select>
      </div>
      <div class="row">
        <span class="tag">${c.length ? fmtTime(c.length) + ' long' : 'length unknown'}</span>
        <span class="tag">ends ${fmtTime(end)}</span>
      </div>
      <div class="row live-row" title="Whether this piece is speaking at the playhead"><span class="label">now</span><span class="tag live" data-voice-live="${c.id}">${voiceLive(c)}</span></div>
      ${missing ? '<p class="hint">The recording for this piece is not in this browser. Record it again or attach the file — the piece keeps its moment.</p>' : ''}
      ${c.speaker ? '' : '<p class="hint">Unattached: silent until a speaker is chosen, or delete it.</p>'}
      ${over.length ? `<p class="hint">Speaks at the same time as ${over.map((x) => esc(x.name)).join(', ')} — both will be heard.</p>` : ''}
    </div>`;
}

// Who can speak a clip: the cast, in number order, with unattached (silent) first.
function speakerOptions(selected) {
  const cast = [...(state.show.cast || [])].sort((a, b) => a.number - b.number);
  const missing = selected && !cast.some((d) => d.id === selected);
  return (
    `<option value="">Unattached (silent)</option>` +
    (missing ? `<option value="${esc(selected)}" selected>Missing speaker</option>` : '') +
    cast.map((d) => `<option value="${esc(d.id)}"${d.id === selected ? ' selected' : ''}>${esc(d.name)}</option>`).join('')
  );
}

function voiceOverlaps(c) {
  const start = c.at;
  const end = c.at + narrationSpan(c);
  return (state.show.narration || []).filter(
    (x) => x.id !== c.id && start < x.at + narrationSpan(x) && end > x.at
  );
}

function voiceLive(c) {
  return narrationAt(state.show, state.ui.playhead).some((x) => x.id === c.id) ? 'speaking' : '\u2014';
}

/* ------------------------------------------------------------ voice actions */

const voiceById = (id) => (state.show.narration || []).find((c) => c.id === id);

// Every way of getting a piece of voice into the show ends here: the take is
// stored, then placed at the moment it was begun from.
function placeVoice(info, at, name) {
  commit();
  const clip = addNarration(state.show, {
    key: info.key,
    name: name || info.name || 'Narration',
    at,
    length: info.length,
  });
  state.ui.hint = 'Added ' + clip.name + ' at ' + fmtTime(clip.at) + ' — ' + fmtTime(clip.length) + ' long';
  app.rebuild();
  return clip;
}

// Record and stop are one control, because the microphone is a toggle.
function toggleRecording(at) {
  if (narration.recording) {
    // The moment belongs to where the take began, fixed when the microphone
    // opened: the show may have run on, or the playhead been moved, since.
    const start = voiceTakeAt;
    const name = nextNarrationName(state.show);
    state.ui.hint = 'Saving the take…';
    state.ui.dirtyPanels = true;
    narration
      .stopRecording()
      .then((blob) => {
        if (!blob) {
          state.ui.hint = 'Nothing was recorded';
          app.rebuild();
          return null;
        }
        return narration.saveBlob(blob, name).then((info) => placeVoice(info, start, name));
      })
      .catch(() => {
        state.ui.hint = 'That take could not be read back';
        app.rebuild();
      });
    return;
  }
  voiceTakeAt = Math.round(at / 100) * 100;
  pendingVoiceAt = voiceTakeAt;
  state.ui.hint = 'Opening the microphone…';
  narration
    .startRecording()
    .then(() => {
      state.ui.hint = 'Recording from ' + fmtTime(voiceTakeAt) + ' — speak, then press Stop';
      app.rebuild();
    })
    .catch(() => {
      state.ui.hint = 'The microphone is blocked, or not there. Check this page\u2019s permission.';
      app.rebuild();
    });
}

function attachVoiceFile(at) {
  pendingVoiceAt = Math.round(at / 100) * 100;
  $('fileNarration').click();
}

// A track's audio can be swapped from the row it lives on.
function pickMusicFor(id, at) {
  pendingMusicId = id;
  pendingMusicAt = at;
  $('fileMusic').click();
}

function renderVideos() {
  const clips = state.show.videos || [];
  $('videoCount').textContent = clips.length || 'none';
  $('videoRow').innerHTML = clips.map((c) => `<div class="item${state.ui.videoId === c.id ? ' video-focus' : ''}" data-video="${esc(c.id)}">
    <div class="row"><input data-v="name" aria-label="Video name" value="${esc(c.name)}" /><button data-va="remove" class="del" title="Remove video cue">×</button></div>
    <div class="row"><label>Start <input data-v="at" aria-label="Video start in show (seconds)" type="number" min="0" step="0.1" value="${c.at / 1000}" /></label><button data-va="seek">go</button></div>
    <div class="row"><label>Clip in <input data-v="trimIn" aria-label="Source clip in (seconds)" type="number" min="0" max="${c.length / 1000}" step="0.1" value="${c.trimIn / 1000}" /></label></div>
    <div class="row"><label>Clip out <input data-v="trimOut" aria-label="Source clip out (seconds)" type="number" min="0" max="${c.length / 1000}" step="0.1" value="${c.trimOut / 1000}" /></label><button data-va="end">End here</button></div>
    <div class="row"><label><input data-v="muted" type="checkbox" ${c.muted ? 'checked' : ''} />Mute</label><label>Volume <input data-v="level" aria-label="Video volume" type="range" min="0" max="1" step="0.01" value="${c.level}" /></label></div>
    <p class="hint">Ends ${fmtTime(c.at + videoSpan(c))} · ${fmtTime(videoSpan(c))} selected of ${fmtTime(c.length)}${video.status.get(c.key) === false ? ' · File missing in this browser' : ''}</p>
    <button data-va="replace">${video.status.get(c.key) === false ? 'Locate video file' : 'Replace video file'}</button>
  </div>`).join('') || '<p class="hint">Put the playhead at the video’s start, then attach a file.</p>';
}

function slideFade() { return Math.max(0, Math.min(120000, Math.round((Number($('slideFade').value) || 0) * 1000))); }
function slideOptions(selected, off = true) {
  const images = state.show.images || [];
  return (off ? '<option value="">Projector off</option>' : '<option value="">Choose image</option>') +
    (selected && !images.some((im) => im.id === selected) ? `<option value="${esc(selected)}" selected>Missing image reference</option>` : '') +
    images.map((im) => `<option value="${esc(im.id)}"${im.id === selected ? ' selected' : ''}>${esc(im.name)}</option>`).join('');
}
function renderSlides() {
  const images = state.show.images || [];
  const selected = state.ui.slideImageId || $('slideChoice').value;
  $('slideCount').textContent = images.length;
  $('slideChoice').innerHTML = slideOptions(selected, false);
  $('slideGallery').innerHTML = images.map((im) => {
    const url = slides.objectUrls.get(im.key);
    return `<button class="slide-thumb" data-image="${esc(im.id)}" aria-pressed="${selected === im.id}" title="Choose ${esc(im.name)}">${url ? `<img src="${esc(url)}" alt="${esc(im.name)}" />` : '<span class="missing-image">Image missing</span>'}<span>${esc(im.name)}</span></button>`;
  }).join('');
  $('slideCueList').innerHTML = [...(state.show.slideCues || [])].sort((a,b) => a.at - b.at).map((cue) => `<div class="item${state.ui.slideCueId === cue.id ? ' slide-focus' : ''}" data-slide-cue="${esc(cue.id)}">
    <div class="row"><span class="tag">${fmtTime(cue.at)}</span><button data-sa="seek">go</button><button data-sa="remove" class="del" title="Remove slide cue">×</button></div>
    <div class="row"><select data-sf="imageId" aria-label="Cue image">${slideOptions(cue.imageId)}</select></div>
    <div class="row"><label>At <input data-sf="at" type="number" aria-label="Slide start seconds" min="0" step="0.1" value="${cue.at/1000}" /></label><label>Fade <input data-sf="fade" type="number" aria-label="Slide crossfade seconds" min="0" max="120" step="0.1" value="${cue.fade/1000}" /></label></div>
  </div>`).join('');
}

function rebuildPanels() {
  $('showName').value = state.show.name;
  $('stWidth').value = state.show.stage.width;
  $('stDepth').value = state.show.stage.depth;
  $('stWings').value = state.show.stage.wingDepth;
  $('stGrid').value = state.show.stage.grid;
  $('stOpening').value = state.show.stage.openingH;
  $('stDancerH').value = state.show.stage.dancerH;
  // The lengths a placed cue is given. Shown in seconds, like every other timing
  // the panels edit, and stored in milliseconds like everything else.
  const prefs = state.show.prefs;
  $('prefCue').value = +(prefs.cueDur / 1000).toFixed(1);
  $('prefFade').value = +(prefs.fadeDur / 1000).toFixed(1);
  $('prefLight').value = +(prefs.lightDur / 1000).toFixed(1);
  $('prefHold').value = +(prefs.holdDur / 1000).toFixed(1);
  $('prefPause').value = +(prefs.pauseDur / 1000).toFixed(1);
  $('prefEndFade').value = +(prefs.endFade / 1000).toFixed(1);
  $('prefTempo').value = prefs.tempo;
  $('prefBeats').value = prefs.beatsPerBar;
  $('castCount').textContent = String(state.show.cast.length);

  // The running order: tabs for switching act, a list for editing them.
  const acts = state.show.acts || [];
  const ranges = actRanges(state.show);
  const activeAct = actAt(state.show, state.ui.playhead);
  $('actCount').textContent = String(acts.length);
  $('actTabs').innerHTML =
    acts
      .map((a, i) => {
        const r = ranges[i];
        const from = fmtTime(displayOfContent(state.show, r.start));
        const to = fmtTime(displayOfContent(state.show, r.end));
        return `<button class="act-tab${activeAct && activeAct.id === a.id ? ' on' : ''}" data-id="${a.id}" title="${esc(a.name)} — ${from} to ${to}">
          <span class="act-no">${i + 1}</span><span class="act-name">${esc(a.name)}</span>
        </button>`;
      })
      .join('') +
    '<button class="act-tab add" data-add="1" title="Add an act after the last one">+ Act</button>';

  // Scenes of the act the playhead is in: named moments inside that act.
  const activeScenes = activeAct ? scenesOf(acts.find((a) => a.id === activeAct.id)) : [];
  const activeScene = sceneAt(state.show, state.ui.playhead);
  $('sceneTabs').innerHTML = activeAct
    ? activeScenes
        .map((s) => {
          const at = activeAct.start + s.offset;
          return `<button class="scene-tab${activeScene && activeScene.id === s.id ? ' on' : ''}" data-id="${s.id}" title="${esc(s.name)} — ${fmtTime(displayOfContent(state.show, at))}">${esc(s.name)}</button>`;
        })
        .join('') +
      '<button class="scene-tab add" data-add="1" title="Add a scene at the playhead">+ Scene</button>'
    : '';

  renderMusic();
  renderNarration();
  renderVideos();
  renderSlides();

  $('actsList').innerHTML = acts
    .map((a, i) => {
      const r = ranges[i];
      const last = i === acts.length - 1;
      const used = actHasWork(state.show, a);
      const removable = acts.length > 1 && last && !used;
      const title = acts.length < 2
        ? 'A show always has at least one act'
        : !last
          ? 'Only the last act can be removed'
          : used
            ? 'This act holds work — move it out before removing it'
            : 'Remove this empty act';
      return `<div class="item" data-id="${a.id}">
        <div class="row">
          <span class="tag">${i + 1}</span>
          <input type="text" data-f="name" value="${esc(a.name)}" aria-label="Act name" />
          <button class="del" data-act="del-act" ${removable ? '' : 'disabled'} title="${title}">×</button>
        </div>
        <div class="row">
          <span class="label">starts</span>
          <span class="tag">${fmtTime(displayOfContent(state.show, r.start))}</span>
          <input type="number" data-f="length" min="10" step="5" value="${Math.round(a.length / 1000)}" style="max-width:72px" aria-label="Act length in seconds" />
          <span class="tag">s</span>
        </div>
        ${scenesOf(a)
          .map((s, j) => `<div class="row scene-row" data-scene="${s.id}">
          <span class="tag">sc${j + 1}</span>
          <input type="text" data-f="scene-name" value="${esc(s.name)}" aria-label="Scene name" />
          <input type="number" data-f="scene-at" min="0" step="1" value="${Math.round(s.offset / 1000)}" style="max-width:60px" aria-label="Scene start, seconds into the act" />
          <span class="tag">s</span>
          <button class="del" data-act="del-scene" title="Remove this scene">×</button>
        </div>`)
          .join('')}
      </div>`;
    })
    .join('');

  // Wing legs, downstage first on each side.
  const legs = state.show.wingLegs || [];
  const legRows = [];
  for (const side of [-1, 1]) {
    legs
      .filter((l) => l.side === side)
      .sort((a, b) => a.y - b.y)
      .forEach((leg, i) => {
        legRows.push(`<div class="item" data-id="${leg.id}">
      <div class="row">
        <span class="tag">${side === -1 ? 'left' : 'right'}</span>
        <span class="label">Leg ${i + 1}</span>
        <input type="number" data-f="y" min="0.4" step="0.1" value="${leg.y.toFixed(1)}" style="max-width:64px" />
        <span class="tag">m</span>
        <button class="del" data-act="del-leg" title="Remove this leg">×</button>
      </div>
    </div>`);
      });
  }
  $('legCount').textContent = String(legs.length);
  $('legsList').innerHTML = legRows.join('');
  $('btnAddLeftLeg').disabled = !canAddWingLeg(state.show, -1);
  $('btnAddRightLeg').disabled = !canAddWingLeg(state.show, 1);

  const sceneryItem = (s) => {
    const layerOpts = LAYERS.map(
      ([v, l]) => `<option value="${v}" ${s.layer === v ? 'selected' : ''}>${l}</option>`
    ).join('');
    // A drop has no "open": it is either hanging at the wall or flown out.
    // Once a piece is cued its control here is the starting state, so it is
    // named that way rather than looking like the live position.
    const hasCues = (s.cues || []).length > 0;
    const baseRow =
      s.kind === 'drop'
        ? `<div class="row" title="Where this drop sits before its first cue"><span class="label">${hasCues ? 'Start' : 'Hangs'}</span>
             <select data-f="fly">
               <option value="1" ${(s.fly ?? 1) >= 0.5 ? 'selected' : ''}>flown in</option>
               <option value="0" ${(s.fly ?? 1) < 0.5 ? 'selected' : ''}>flown out</option>
             </select></div>`
        : s.kind === 'card'
          ? `<div class="row" title="Whether the card is up before its first cue"><span class="label">${hasCues ? 'Start' : 'State'}</span>
             <select data-f="shown">
               <option value="1" ${(s.shown ?? 0) >= 0.5 ? 'selected' : ''}>on stage</option>
               <option value="0" ${(s.shown ?? 0) < 0.5 ? 'selected' : ''}>off stage</option>
             </select></div>`
          : `<div class="row" title="How far open this curtain is before its first cue"><span class="label">${hasCues ? 'Start' : 'Open'}</span>
             <input type="range" data-f="open" min="0" max="100" value="${Math.round((s.open ?? 1) * 100)}" /></div>`;
    const detailRow =
      s.kind === 'prop'
        ? `<div class="row"><span class="label">Size</span>
             <input type="number" data-f="w" min="0.5" max="12" step="0.5" value="${s.w}" style="flex:1" title="Width in metres" />
             <input type="number" data-f="d" min="0.5" max="12" step="0.5" value="${s.d}" style="flex:1" title="Depth in metres" />
             <input type="number" data-f="h" min="0.1" max="6" step="0.1" value="${s.h ?? 0.8}" style="flex:1" title="Height in metres, as the audience sees it" /></div>`
        : `<div class="row">${s.kind === 'card' ? '' : `<select data-f="layer">${layerOpts}</select>`}
             <input type="color" data-f="color" value="${s.color}" /></div>
           <div class="row"><span class="label">Width</span>
             <input type="number" data-f="span" min="0.5" max="${maxClothSpan(state.show.stage).toFixed(1)}" step="0.5" value="${s.span ?? state.show.stage.width}" style="max-width:58px" title="How much of the opening this ${s.kind} masks, in metres. Up to a little over the stage width, so a piece reaches the frame at the back" />
             <span class="label">Height</span>
             <input type="number" data-f="h" min="0.5" max="20" step="0.5" value="${s.h ?? ''}" style="max-width:58px" title="How high this ${s.kind} hangs, in metres" /></div>
           <div class="row"><span class="label">Across</span>
             <input type="number" data-f="x" min="${-Math.max(0, (state.show.stage.width - (s.span ?? state.show.stage.width)) / 2)}" max="${Math.max(0, (state.show.stage.width - (s.span ?? state.show.stage.width)) / 2)}" step="0.5" value="${s.x ?? 0}" style="max-width:52px" title="Where it sits across the stage; a piece as wide as the stage cannot move" />
             <span class="label">Depth</span>
             <input type="number" data-f="depth" min="0.2" max="${state.show.stage.depth - 0.2}" step="0.1" value="${clothDepth(s).toFixed(1)}" style="max-width:52px" title="How far upstage; typing a number pins it, choosing a layer releases it" /></div>
           ${baseRow}
           ${s.kind === 'prop' ? '' : `<div class="row live-row" title="Where this piece is at the playhead"><span class="label">now</span><span class="tag live" data-live="${s.id}">${liveLabel(s)}</span></div>`}`;
    // Props can be hidden the way performers can; curtains and drops cannot.
    const eye = `<button class="eye ${s.visible === false ? 'off' : ''}" data-act="eye" title="Show or hide this ${s.kind} on the stage, in every view">${s.visible === false ? '○' : '◉'}</button>`;
    const cues = s.cues || [];
    const cueBlock = s.kind === 'prop' ? '' : cueEditorHTML(s, cues);
    const stackNote = s.kind === 'drop' ? dropStackNote(s) : '';
    const tag = s.kind === 'prop'
      ? (s.carriedBy ? 'prop · carried' : s.keys && s.keys.length ? 'prop · ' + s.keys.length + ' pts' : 'prop')
      : s.kind + (cues.length ? ' · ' + cues.length + (cues.length === 1 ? ' cue' : ' cues') : '');
    // What the card actually says. It is the point of the piece, so it is a field
    // of its own rather than a name: the name is for the crew, the words are for
    // the audience.
    const cardRow = s.kind === 'card'
      ? `<div class="row"><span class="label">Says</span>
           <input type="text" data-f="text" value="${esc(s.text || '')}" maxlength="40" style="flex:1" title="The words on the card, as the audience reads them" />
         </div>`
      : '';
    return `<div class="item${state.ui.selectedTrack === s.id ? ' sel' : ''}" data-id="${s.id}">
      <div class="row">
        ${eye}
        <span class="tag">${tag}</span>
        <input type="text" data-f="name" value="${esc(s.name)}" />
        <button class="del" data-act="del">×</button>
      </div>
      ${cardRow}
      ${detailRow}
      ${stackNote}
      ${cueBlock}
    </div>`;
  };

  // Lighting: one card per lantern, with the numbers that place it and the cues
  // that take it up and down. It reads like a curtain's card on purpose — a light
  // is stage hardware, and the crew already knows how to read one of these.
  const lightCard = (l) => {
    const st = state.show.stage;
    const off = l.visible === false;
    const level = lightLevelAt(l, state.ui.playhead);
    const cues = l.cues || [];
    const cueRows = cues
      .map((c) => {
        const at = fmtTime(displayOfContent(state.show, c.at));
        if (state.ui.cueId !== c.id) {
          return `<div class="row cue-row" data-light-cue="${c.id}" title="Click to edit this cue">
            <span class="label">${lightCueText(c)}</span>
            <span class="tag">${at}</span>
            <button class="del" data-act="del-light-cue" data-cue-id="${c.id}" title="Delete this cue">remove</button>
          </div>`;
        }
        return `<div class="cue-row on cue-edit" data-light-cue="${c.id}">
          <div class="row">
            <span class="tag">${at}</span>
            <button class="del" data-act="del-light-cue" data-cue-id="${c.id}" title="Delete this cue">remove</button>
          </div>
          <div class="row">
            <span class="label fixed">Level</span>
            <input type="number" data-f="cue-edit-level" min="0" max="100" step="5" value="${Number.isFinite(Number(c.level)) ? Math.round(Number(c.level) * 100) : ''}" placeholder="hold" style="max-width:54px" aria-label="Level this cue takes the light to, percent; empty keeps it" />
            <span class="label">%</span>
            <input type="number" data-f="cue-edit-dur" min="0" step="0.5" value="${((c.dur || 0) / 1000).toFixed(1)}" style="max-width:50px" aria-label="Seconds the change takes" />
            <span class="label">s</span>
          </div>
          <div class="row">
            <span class="label fixed">Hand to</span>
            <select data-f="cue-edit-follow" title="A follow spot can be handed to another performer here">${followSelect(c)}</select>
          </div>
        </div>`;
      })
      .join('');
    const levelRows = ['keep', 100, 75, 50, 25, 0]
      .map((v) => `<option value="${v}">${v === 'keep' ? 'hold level' : v === 0 ? 'out' : v === 100 ? 'full' : v + '%'}</option>`)
      .join('');
    // Who the spot could be handed to from here: the aim is left alone unless one of
    // these is chosen, which is why "hold aim" is the default rather than a performer.
    const followRows = ['<option value="keep">hold aim</option>']
      .concat(state.show.cast.map((d) => `<option value="${d.id}">${esc(d.number + '. ' + d.name)}</option>`))
      .concat(['<option value="__own">its own place</option>'])
      .join('');
    // A cue's own hand-off: "as it is" keeps the aim, "its own place" releases it.
    // Declared as a function so it is usable above its own definition, where the cue
    // rows are built.
    function followSelect(c) {
      const cur = 'followId' in c ? c.followId || '__own' : 'keep';
      return [`<option value="keep"${cur === 'keep' ? ' selected' : ''}>as it is</option>`,
        `<option value="__own"${cur === '__own' ? ' selected' : ''}>its own place</option>`]
        .concat(state.show.cast.map((d) => `<option value="${d.id}"${cur === d.id ? ' selected' : ''}>${esc(d.number + '. ' + d.name)}</option>`))
        .join('');
    }
    return `<div class="item${state.ui.lightId === l.id ? ' sel' : ''}" data-light="${l.id}">
      <div class="row">
        <button class="eye ${off ? 'off' : ''}" data-act="light-eye" title="Show or hide this light on the stage">${off ? '○' : '◉'}</button>
        <span class="swatch" style="background:${l.color}"></span>
        <input type="text" data-f="name" value="${esc(l.name)}" />
        <button class="del" data-act="del-light" title="Remove this light">×</button>
      </div>
      <div class="row"><span class="label">Level</span>
        <input type="range" data-f="level" min="0" max="100" value="${Math.round(l.level * 100)}" title="How bright this lantern stands before its first cue" />
        <span class="tag">${Math.round(l.level * 100)}%</span>
      </div>
      <div class="row"><span class="label fixed">Type</span>
        <select data-f="type" title="A spot has a lens and an edge; a flood washes a scene">
          ${LIGHT_TYPES.map(([v, label]) => `<option value="${v}"${l.type === v ? ' selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <div class="row"><span class="label fixed">Gobo</span>
        <select data-f="gobo" title="A template in front of the lens: the pool takes its shape">
          ${LIGHT_GOBOS.map(([v, label]) => `<option value="${v}"${l.gobo === v ? ' selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <div class="row"><span class="label fixed">Gel</span>
        <span class="gels">${LIGHT_GELS.map((hex) => `<button class="gel${l.color.toLowerCase() === hex ? ' on' : ''}" data-gel="${hex}" style="background:${hex}" title="${hex}"></button>`).join('')}</span>
        <input type="color" data-f="color" value="${l.color}" title="Any colour you like" />
      </div>
      <div class="row"><span class="label fixed">Height</span>
        <input type="number" data-f="h" min="0.5" max="20" step="0.5" value="${l.h}" style="max-width:56px" title="How high the lantern hangs above the deck, in metres" />
        <span class="label fixed">Pool</span>
        <input type="number" data-f="spread" min="0.4" max="${st.width}" step="0.2" value="${l.spread}" style="max-width:56px" title="How wide a pool it washes, in metres" />
      </div>
      <div class="row"><span class="label fixed">Across</span>
        <input type="number" data-f="x" min="${-st.width / 2}" max="${st.width / 2}" step="0.5" value="${l.x}" style="max-width:50px" title="Where it sits across the stage"${l.followId ? ' disabled' : ''} />
        <span class="label fixed">Depth</span>
        <input type="number" data-f="z" min="0" max="${st.depth}" step="0.5" value="${l.z}" style="max-width:50px" title="How far upstage it lands"${l.followId ? ' disabled' : ''} />
      </div>
      <div class="row"><span class="label">Follows</span>
        <select data-f="follow" title="A follow spot is aimed by hand at one performer, so it has no place of its own">
          <option value=""${l.followId ? '' : ' selected'}>fixed spot</option>
          ${state.show.cast
            .map((d) => `<option value="${d.id}"${l.followId === d.id ? ' selected' : ''}>${esc(d.number + '. ' + d.name)}</option>`)
            .join('')}
        </select>
      </div>
      <div class="row live-row" title="How bright this light is at the playhead">
        <span class="label">now</span><span class="tag live" data-light-live="${l.id}">${off ? 'hidden' : Math.round(level * 100) + '%'}</span>
      </div>
      <div class="row">
        <span class="label">Cues</span>
        <span class="tag">${cues.length || 'none'}</span>
        <button class="tag pick" data-act="light-cue" title="Add this cue where the playhead is, taking the seconds beside it">Add at ${fmtTime(displayOfContent(state.show, state.ui.playhead))}</button>
      </div>
      <div class="row"><span class="label fixed">Level</span>
        <select data-f="cueTo" title="Where this cue takes the light; hold level changes nothing">${levelRows}</select>
      </div>
      <div class="row"><span class="label fixed">Hand to</span>
        <select data-f="cueFollow" title="Hand a follow spot to another performer at this moment; hold aim leaves it alone">${followRows}</select>
      </div>
      <div class="row"><span class="label fixed">Over</span>
        <input type="number" data-f="cueDur" min="0" step="0.5" value="${((Number(state.show.prefs.lightDur) || 2000) / 1000).toFixed(1)}" style="max-width:54px" title="Seconds the change takes" />
        <span class="label">s</span>
      </div>
      ${cueRows ? '<div class="cue-list">' + cueRows + '</div>' : ''}
    </div>`;
  };
  $('lightsList').innerHTML = (state.show.lights || []).map(lightCard).join('') ||
    '<p class="hint">No lights yet. A lantern hangs over a spot, washes a pool of its own colour, and is cued up and out from its own track.</p>';
  $('lightCount').textContent = String((state.show.lights || []).length);

  const props = state.show.scenery.filter((s) => s.kind === 'prop');
  $('sceneryList').innerHTML =
    state.show.scenery.filter((s) => s.kind !== 'prop').map(sceneryItem).join('') ||
    '<p class="hint">No curtains or drops yet.</p>';
  $('propsList').innerHTML =
    props.map(sceneryItem).join('') || '<p class="hint">No props yet.</p>';
  $('propCount').textContent = String(props.length);

  const costumes = state.show.costumes || [];
  const dressOptions = (d) =>
    ['<option value="">— undressed —</option>']
      .concat(
        costumes.map(
          (c) => `<option value="${c.id}" ${c.id === d.costumeId ? 'selected' : ''}>${esc(c.name)}</option>`
        )
      )
      .join('');

  // Casting is read in the act the playhead is in, because that is the act you are
  // building: the same dancer is a Snowflake in one and a Flower in the next, so a
  // single role per performer would be the wrong shape. Scenes work the same way.
  const here = actAt(state.show, state.ui.playhead);
  // `actAt` answers with the act's stretch of the clock rather than the act itself, so the
  // casting is read off the record it names.
  const actRecord = here ? (state.show.acts || []).find((a) => a.id === here.id) : null;
  const castRoles = rolesOf(actRecord);
  const actWord = here ? here.name : 'this act';

  const cl = $('castList');
  cl.innerHTML = state.show.cast
    .map(
      (d) => `<div class="item ${d.id === state.ui.selectedId ? 'sel' : ''}" data-id="${d.id}" data-kind="cast">
        <div class="row">
          <button class="eye ${d.visible ? '' : 'off'}" data-act="eye">${d.visible ? '◉' : '○'}</button>
          <span class="swatch" style="background:${d.color}"></span>
          <span class="label">${d.number}. ${esc(d.name)}</span>
          <span class="tag">${d.keys.length}</span>
        </div>
        <div class="row role"><span class="label">plays</span>
          <input type="text" data-act="role" value="${esc(castRoles[d.id] || '')}" maxlength="60"
            placeholder="not cast in ${esc(actWord)}"
            title="What ${esc(d.name)} is playing in ${esc(actWord)}; leave it empty to leave her uncast there" />
        </div>
        ${costumes.length ? `<div class="row dress"><span class="label">wears</span><select data-act="dress" title="What this performer is dressed in">${dressOptions(d)}</select></div>` : ''}
      </div>`
    )
    .join('');

  // The overlaps: what the whole-show scan found, each with the one fix worth offering. A scan is
  // only good for the show it was read from — a fix names stations by their place in a path, so a
  // list left over from before an edit could move the wrong point. Once the show has changed the
  // list stands down and says so, rather than offering a fix that no longer means anything.
  const scan = state.ui.overlaps;
  const stale = scan && scan.key !== pathsKey(state.show);
  const fresh = stale ? null : scan;
  $('overlapCount').textContent = fresh ? String(fresh.list.length) : '\u2014';
  $('overlapList').innerHTML = stale
    ? '<p class="hint">The show has changed since the last look. Look again to run the fixes over what is there now.</p>'
    : !fresh
      ? '<p class="hint">Not looked yet.</p>'
      : fresh.list.length
        ? fresh.list.map((o) => overlapRow(o)).join('')
        : '<p class="hint">No two performers come inside the clearance anywhere in this show.</p>';

  // The wardrobe. A costume says how many are wearing it, because a costume nobody
  // wears is a note to self rather than part of the show.
  $('costumeCount').textContent = String(costumes.length);
  $('costumeList').innerHTML = costumes
    .map((c) => {
      const worn = state.show.cast.filter((d) => d.costumeId === c.id).length;
      return `<div class="item" data-costume="${c.id}">
        <div class="row">
          <span class="swatch" style="background:${c.body}"></span>
          <input type="text" data-f="name" value="${esc(c.name)}" aria-label="Costume name">
          <button class="del" data-act="del" title="Remove this costume; anyone wearing it goes back to their own colour">×</button>
        </div>
        <div class="row">
          <span class="label">Body</span><input type="color" data-f="body" value="${c.body}" title="Body and tights"><input type="text" class="hex" data-hex="body" value="${c.body}" maxlength="7" spellcheck="false" aria-label="Body colour as hex" title="Hex, e.g. #e0b08a">
          <span class="label">Skirt</span><input type="color" data-f="skirt" value="${c.skirt}" title="Skirt or tunic"><input type="text" class="hex" data-hex="skirt" value="${c.skirt}" maxlength="7" spellcheck="false" aria-label="Skirt colour as hex" title="Hex, e.g. #e0b08a">
          <span class="label">Hair</span><input type="color" data-f="hair" value="${c.hair}" title="Hair"><input type="text" class="hex" data-hex="hair" value="${c.hair}" maxlength="7" spellcheck="false" aria-label="Hair colour as hex" title="Hex, e.g. #e0b08a">
        </div>
        <div class="row">
          <span class="label">Cut</span>
          <select data-f="style" title="What the body of the costume is cut like">${COSTUME_STYLES.map(
            ([v, label]) => `<option value="${v}" ${c.style === v ? 'selected' : ''}>${label}</option>`
          ).join('')}</select>
          <span class="tag">${worn ? 'worn by ' + worn : 'not worn'}</span>
        </div>
      </div>`;
    })
    .join('');

  $('inspector').innerHTML = inspectorHTML();

  const stripHTML = pointStripHTML();
  const strip = $('pointStrip');
  strip.innerHTML = stripHTML;
  strip.hidden = !stripHTML;

  bindPanelEvents();
}

// One overlap in the panel: when it happens, who it is, how close they got, and the one fix
// worth offering. The row is a way into the moment — clicking it takes the playhead there, so
// the stage can be judged before anything is changed.
function overlapRow(o) {
  const show = state.show;
  const names = o.ids.map((id) => {
    const d = (show.cast || []).find((x) => x.id === id);
    return d ? d.name : '?her';
  });
  const at = fmtTime(displayOfContent(show, o.at));
  return `<div class="item" data-overlap="${o.id}" title="Go to this moment">
    <div class="row">
      <span class="label">${esc(at)} · ${esc(names[0])} &amp; ${esc(names[1])}</span>
      <span class="tag">${o.gap.toFixed(2)} m</span>
    </div>
    <div class="row fix">
      <span class="fix-what">${o.fix ? esc(o.fix.label) : 'no automatic fix'}</span>
      ${o.fix ? '<button class="tag pick" data-act="fix" title="Apply this fix — it is a normal edit, so Undo puts the path back">Fix</button>' : ''}
    </div>
  </div>`;
}

// A drop is one hang in a stack: what stands in front of it hides it, and what
// stands behind it is what the audience sees when it flies out. Saying so in the
// panel is cheaper than making the depth numbers mean it.
function dropStackNote(s) {
  const stack = dropStack(state.show);
  const i = stack.findIndex((d) => d.id === s.id);
  if (i < 0) return '';
  const inFront = stack[i - 1];
  const behind = stack[i + 1];
  if (!inFront && !behind) return '';
  const bits = [];
  if (inFront) bits.push(`${esc(inFront.name)} hangs in front, so this one is hidden until it flies out`);
  if (behind) bits.push(`flying this out reveals ${esc(behind.name)}`);
  return '<p class="hint stack-note">' + bits.join(' · ') + '.</p>';
}

// Curtains, drops and cards change during the show, so each one carries its own
// cues. What a cue can do depends on the piece: a card has no halfway house, it is
// either being held up in front of the house or it is not.
function cueOptions(kind, current) {
  const opts = kind === 'drop'
    ? [{ v: 'in', label: 'fly in' }, { v: 'out', label: 'fly out' }]
    : kind === 'card'
      ? [{ v: 'on', label: 'bring on' }, { v: 'off', label: 'take off' }]
      : [
          { v: '100', label: 'open' },
          { v: '50', label: 'half open' },
          { v: '0', label: 'close' },
        ];
  return opts
    .map((o) => `<option value="${o.v}"${current != null && String(current) === o.v ? ' selected' : ''}>${o.label}</option>`)
    .join('');
}

function cueEditorHTML(s, cues) {
  const isDrop = s.kind === 'drop';
  const options = cueOptions(s.kind, null);
  const rows = cues
    .map((c) => {
      const at = fmtTime(displayOfContent(state.show, c.at));
      const on = state.ui.cueId === c.id;
      if (!on) {
        return `<div class="row cue-row" data-cue-select="${c.id}" title="Click to edit this cue">
          <span class="label">${cueText(c)}</span>
          <span class="tag">${at}</span>
          <button class="del" data-act="del-cue" data-cue-id="${c.id}" title="Delete this cue">remove</button>
        </div>`;
      }
      const target = isDrop
        ? (Number(c.fly) >= 0.5 ? 'in' : 'out')
        : s.kind === 'card'
          ? (Number(c.shown) >= 0.5 ? 'on' : 'off')
          : String(Math.round((Number.isFinite(c.open) ? c.open : 1) * 100));
      // Two lines, because one is not enough for a moment *and* a working select:
      // squeezed into a single row the controls were 28 px wide and unreadable.
      return `<div class="cue-row on cue-edit" data-cue-select="${c.id}">
        <div class="row">
          <span class="tag">${at}</span>
          <button class="del" data-act="del-cue" data-cue-id="${c.id}" title="Delete this cue">remove</button>
        </div>
        <div class="row">
          <select data-f="cue-edit" title="What this cue does">${cueOptions(s.kind, target)}</select>
          <input type="number" data-f="cue-edit-dur" min="0" step="0.5" value="${((c.dur || 0) / 1000).toFixed(1)}" style="max-width:58px" aria-label="Seconds this cue takes" />
          <span class="label">s</span>
        </div>
      </div>`;
    })
    .join('');
  // The button names the moment it will use, so "at the playhead" is never a
  // guess: the label follows the playhead as it moves.
  return `<div class="row">
      <span class="label">Cues</span>
      <span class="tag">${cues.length || 'none'}</span>
      <button class="tag pick" data-act="cue" data-cue-add="1" title="Add this cue where the playhead is, taking the seconds beside it">${cueAddLabel()}</button>
    </div>
    <div class="row">
      <select data-f="cueTo">${options}</select>
      <input type="number" data-f="cueDur" min="0" step="0.5" value="1.5" style="max-width:58px" title="Seconds the move takes" />
      <span class="label">s</span>
    </div>
    <p class="hint">Pick what it does and how long it takes, put the playhead where the move should begin, then press the button. The ${s.kind === 'card' ? 'card' : isDrop ? 'drop' : 'curtain'} still starts wherever its own control above says.</p>
    ${rows ? '<div class="cue-list">' + rows + '</div>' : ''}`;
}

function cueAddLabel() {
  return 'Add at ' + fmtTime(displayOfContent(state.show, state.ui.playhead));
}

// What a piece of cloth is doing at the playhead. Its own control in the panel
// says where it starts; this says where the cue has taken it, so a curtain that
// looks still on the stage can be told apart from one that is sitting at its base.
function liveLabel(s) {
  const st = sceneryStateAt(s, state.ui.playhead);
  const moving = (s.cues || []).some(
    (c) => (c.dur || 0) > 0 && state.ui.playhead >= c.at && state.ui.playhead < c.at + c.dur
  );
  let txt;
  if (s.kind === 'card') {
    const sh = Math.max(0, Math.min(1, st.shown));
    if (sh <= 0.005) txt = 'off stage';
    else if (sh >= 0.995) txt = 'showing \u201c' + (s.text || '') + '\u201d';
    else txt = 'coming on ' + Math.round(sh * 100) + '%';
    // Mid-move the percentage is already the news; at rest there is only the state.
    if (sh > 0.005 && sh < 0.995) return txt;
    return moving ? txt + ' · moving' : txt;
  }
  if (s.kind === 'drop') {
    const f = Math.max(0, Math.min(1, st.fly));
    txt = f <= 0.005 ? 'flown out' : f >= 0.995 ? 'hanging' : Math.round(f * 100) + '% in';
  } else {
    const o = Math.max(0, Math.min(1, st.open));
    txt = o <= 0.005 ? 'closed' : o >= 0.995 ? 'open' : Math.round(o * 100) + '% open';
  }
  return moving ? txt + ' · moving' : txt;
}

// A light cue, in words: where it takes the lantern and how long it takes to get
// there. "Out" is a fade to nothing, which is a cue like any other.
function lightCueText(c) {
  const lv = Number(c.level);
  const hasLevel = Number.isFinite(lv);
  const what = !hasLevel ? '' : lv <= 0.005 ? 'out' : lv >= 0.995 ? 'full' : Math.round(lv * 100) + '%';
  let text = what || 'cue';
  if ('followId' in c) {
    const d = c.followId ? (state.show.cast || []).find((x) => x.id === c.followId) : null;
    const hand = '\u2192 ' + (d ? d.name : 'its own place');
    text = what ? hand + ' at ' + what : hand;
  }
  return text + (c.dur ? ' over ' + (c.dur / 1000).toFixed(1) + ' s' : '');
}

function cueText(c) {
  const what = Number.isFinite(c.shown)
    ? c.shown >= 0.5 ? 'bring on' : 'take off'
    : Number.isFinite(c.open)
      ? c.open >= 0.999 ? 'open' : c.open <= 0.001 ? 'close' : 'open ' + Math.round(c.open * 100) + '%'
      : c.fly > 0.5 ? 'fly in' : 'fly out';
  return what + (c.dur ? ' over ' + (c.dur / 1000).toFixed(1) + ' s' : '');
}

function inspectorHTML() {
  const d = findObject(state.show, state.ui.selectedId);
  if (!d) return '<p class="hint">Select a dancer or a prop on the stage or in the lists to edit it.</p>';
  if (isProp(d)) return propInspectorHTML(d);
  return `<h2>Dancer ${d.number}</h2>
    <div class="item sel">
      <div class="row"><input type="text" data-f="name" value="${esc(d.name)}" /></div>
      <div class="row">
        <input type="color" data-f="color" value="${d.color}" />
        <select data-f="shape">${SHAPES.map((s) => `<option value="${s}" ${s === d.shape ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <select data-f="fill">${FILLS.map((f) => `<option value="${f}" ${f === d.fill ? 'selected' : ''}>${f}</option>`).join('')}</select>
      </div>
      <div class="row">
        <span class="label">${d.keys.length} keyframes</span>
        <button class="del" data-act="del-dancer">remove</button>
      </div>
    </div>
    ${stationsHTML(d)}`;
}

function propInspectorHTML(p) {
  const timed = p.keys && p.keys.length;
  const carriers = state.show.cast
    .map((d) => `<option value="${d.id}" ${p.carriedBy === d.id ? 'selected' : ''}>${esc(d.name)}</option>`)
    .join('');
  const holder = p.carriedBy ? carrierOf(state.show, p, state.ui.playhead) : null;
  const status = p.carriedBy
    ? 'on the timer, carried by ' + (holder ? esc(holder.name) : 'nobody')
    : timed ? 'on the timer' : 'stage dressing';
  const action = !p.carriedBy && !timed
    ? '<button class="tag pick" data-act="to-timer">add to timer</button>'
    : timed && !p.carriedBy ? `<span class="tag">${p.keys.length} stations</span>` : '';
  const tail = p.carriedBy ? carriedHTML(p, holder) : stationsHTML(p);
  return `<h2>Prop</h2>
    <div class="item sel">
      <div class="row"><input type="text" data-f="name" value="${esc(p.name)}" /></div>
      <div class="row">
        <input type="color" data-f="color" value="${p.color}" />
        <span class="label">Size</span>
        <input type="number" data-f="w" min="0.5" max="12" step="0.5" value="${p.w}" style="max-width:56px" title="Width" />
        <input type="number" data-f="d" min="0.5" max="12" step="0.5" value="${p.d}" style="max-width:56px" title="Depth" />
        <input type="number" data-f="h" min="0.1" max="6" step="0.1" value="${p.h ?? 0.8}" style="max-width:56px" title="Height" />
      </div>
      <div class="row">
        <select data-f="carriedBy" title="Carry this prop with a dancer">
          <option value="">not carried</option>
          ${carriers}
        </select>
      </div>
      <div class="row">
        <span class="label">${status}</span>
        ${action}
      </div>
    </div>
    ${tail}`;
}

// Carrying: who holds it now, and the moments it changes hands.
function carriedHTML(p, holder) {
  const options = state.show.cast
    .map((d) => `<option value="${d.id}">${esc(d.name)}</option>`)
    .join('');
  const handoffs = p.carryHandoffs || [];
  const rows = handoffs
    .map((h) => {
      const to = state.show.cast.find((d) => d.id === h.to);
      return `<div class="item">
        <div class="row">
          <span class="label">${to ? esc(to.name) : '—'}</span>
          <span class="tag">at ${fmtTime(displayOfContent(state.show, h.at))}</span>
          <button class="del" data-act="del-handoff" data-id="${h.id}" title="Remove this hand-off">remove</button>
        </div>
      </div>`;
    })
    .join('');
  return `<h2>Carried by</h2>
    <p class="hint">It follows its dancer&#8217;s path and freezes with them during a hold. Drag it on the stage to change where it sits against them. Its own stations are kept but ignored until you detach it.</p>
    <div class="row">
      <select data-f="handoffTo" title="Who takes the prop from here">
        <option value="">hand off to…</option>
        ${options}
      </select>
      <button class="tag pick" data-act="handoff" title="Give the prop to that dancer at the playhead">hand off here</button>
    </div>
    ${handoffs.length
      ? '<div class="list">' + rows + '</div>' +
        '<p class="hint">A hand-off lands instantly: hand over while the two dancers are close, or the prop will jump between them.</p>'
      : '<p class="hint">No hand-offs. Put the playhead where the change happens, pick a dancer and press hand off here.</p>'}`;
}

// The focused station, edited next to the stage rather than in a far panel.
function pointStripHTML() {
  const d = findObject(state.show, state.ui.selectedId);
  const i = state.ui.stationIdx;
  if (!d || !Number.isInteger(i) || !d.keys[i]) return '';
  const key = d.keys[i];
  const secs = i === 0 || !Number.isFinite(key.dur) ? '' : (key.dur / 1000).toFixed(2);
  const poseOpts = POSES.map(
    ([v, label]) => `<option value="${v}" ${(key.pose || 'none') === v ? 'selected' : ''}>${label}</option>`
  ).join('');
  const stepOpts = STEPS.map(
    ([v, label]) => `<option value="${v}" ${(key.step || 'walk') === v ? 'selected' : ''}>${label}</option>`
  ).join('');
  const levelOpts = LEVELS.map(
    ([v, label]) => `<option value="${v}" ${(key.level || 'flat') === v ? 'selected' : ''}>${label}</option>`
  ).join('');
  const easeOpts = EASES.map(
    ([v, label]) => `<option value="${v}" ${(key.ease || 'even') === v ? 'selected' : ''}>${label}</option>`
  ).join('');
  // The foot this point stands on. The position decides unless it is typed over, and a point with
  // no position is a plain step, which leaves on the other foot from the one before it — so the
  // auto entry names what it actually resolved to rather than saying "auto" and leaving you to
  // work it out.
  const plant = plantsOf(d)[i] || { name: 'both', auto: true };
  const plantOpts = [['', `auto — ${PLANT_LABEL[plant.name]}`], ['left', 'left foot'], ['right', 'right foot'], ['both', 'both feet'], ['air', 'in the air']]
    .map(([v, label]) => `<option value="${v}" ${(key.plant || '') === v ? 'selected' : ''}>${label}</option>`)
    .join('');
  // Two ways a plant is not a foot she can stand on, said where the choice is made: the position
  // has that foot in the air, or the stance foot skates while the body stays put.
  const plantBad = isProp(d) ? null : plantProblem(state.show, d, i);
  const plantSkate = isProp(d) || plantBad ? null : footSkate(state.show, d, i);
  // And the third: the contact is there but the leg cannot stay on it, so the body walks off the
  // foot instead of over it. Only one of the three is shown, because they are the same fault seen
  // from three sides and a strip with three sentences in it is a strip nobody reads.
  const plantShort = isProp(d) || plantBad || plantSkate ? null : legOverreach(state.show, d, i);
  const plantNote = plantBad
    ? `${d.name}'s ${plantBad.side} foot is ${plantBad.height.toFixed(2)} m off the deck here, so she cannot stand on it`
    : plantSkate
      ? `${d.name}'s ${plantSkate.side} foot skates ${plantSkate.away.toFixed(2)} m on the deck into this point`
      : plantShort
        ? `${d.name}'s ${plantShort.side} leg is ${plantShort.over.toFixed(2)} m too short to keep her foot planted into this point`
        : '';
  // The landing this point has to receive, worked out from the point before it: a station on
  // the floor whose predecessor is in the air gives at the knees. The field is only in the
  // strip where there is a landing to see, or where a depth has been typed, so a run of
  // ordinary stations stays uncluttered.
  const autoLvl = levelOf(key, i ? d.keys[i - 1] : null);
  const absorbShown = key.absorb != null || autoLvl.absorb > 0;
  const absorbField = isProp(d) || !absorbShown
    ? ''
    : `<input class="ps-absorb" type="number" data-f="absorb" step="0.01" min="0" value="${key.absorb != null ? Number(key.absorb).toFixed(2) : ''}" placeholder="${autoLvl.absorb ? autoLvl.absorb.toFixed(2) : '—'}" title="How deep the landing gives, in metres of plié. Empty takes what the drop needs; 0 is a stiff landing"/><span class="ps-unit">plié</span>`;
  return `<span class="ps-tag">Point ${i + 1} of ${d.keys.length}</span>
    <span class="ps-who">${esc(d.name)}</span>
    <span class="ps-div"></span>
    ${isProp(d) ? '' : `<select data-f="pose" title="Ballet position at this point">${poseOpts}</select>`}
    ${isProp(d) ? '' : `<select data-f="step" title="How the dancer travels into this point: a named step is held while they travel, where walking blends one position into the next">${stepOpts}</select>`}
    ${isProp(d) ? '' : `<select data-f="level" title="How this point meets the floor: flat, demi-pointe, full pointe, or in the air. A rise makes the body taller where it stands; a jump leaves the deck, which the elevation shows">${levelOpts}</select>`}
    ${isProp(d) ? '' : `<input class="ps-lift" type="number" data-f="lift" step="0.05" min="0" value="${key.lift ? Number(key.lift).toFixed(2) : ''}" placeholder="${(key.level || 'flat') === 'air' ? AIR_LIFT : '—'}" title="How far the feet are off the deck in metres. Leave it empty to stay on the floor — or to take the usual jump height when the level is in the air"/><span class="ps-unit">m up</span>`}
    ${absorbField}
    ${isProp(d) ? '' : `<select data-f="plant" title="Which foot carries the weight at this point: the position decides unless it is typed, and a point with no position is a plain step, which leaves on the other foot">${plantOpts}</select>`}
    ${plantNote ? `<span class="ps-slide" title="What a foot cannot do at this point, read from the position's own angles">${esc(plantNote)}</span>` : ''}
    ${isProp(d) ? '' : `<input class="ps-turn" type="number" data-f="turn" step="45" min="-720" max="720" value="${Number(key.turn) || 0}" ${i === 0 ? 'disabled' : ''} title="Degrees turned on the way to this point, added to the heading the last leg finished on, so consecutive turns chain: 360 for a pirouette" /><span class="ps-unit">°</span>`}
    ${isProp(d) ? '' : `<input class="ps-turnms" type="number" data-f="turnMs" min="0" step="0.5" value="${key.turnMs ? (key.turnMs / 1000).toFixed(1) : ''}" placeholder="—" ${i === 0 ? 'disabled' : ''} title="How long this turn takes. Empty means the transition into this point; a longer turn starts earlier and carries across the points before it, so a slow revolution is one number to retime" /><span class="ps-unit">s</span>`}
    <input class="ps-bend" type="number" data-f="bend" step="0.1" value="${Number(key.bend) || 0}" ${i === 0 ? 'disabled' : ''} title="How far the path bows to the left of the straight line at its middle, in metres (negative bows right). Drag the path on the stage to the same end" /><span class="ps-unit">bow</span>
    <select data-f="ease" ${i === 0 ? 'disabled' : ''} title="How the count of this leg is spent: even, gathering into a quick arrival, leaving quickly to settle, or soft at both ends">${easeOpts}</select>

    <input class="ps-dur" type="number" data-f="dur" min="0" step="0.1" value="${secs}" placeholder="—" ${i === 0 ? 'disabled' : ''} title="Transition from the previous point" />
    <span class="ps-unit">s</span>
    ${key.pass ? `<label class="ps-through" title="Two phrases joined here: the position is reached exactly at this point and left again, so the movement carries through instead of stopping on it"><input type="checkbox" data-f="pass" checked /> through</label>` : ''}
    <span class="ps-grow"></span>
    <button data-act="continue" ${i >= d.keys.length - 1 ? 'disabled' : ''} title="Keep this point, drop everything after it, and build on from here">Continue from here</button>
    <button class="ps-warn" data-act="del-from" title="Remove this point and everything after it">Delete from here</button>`;
}

function stationsHTML(d) {
  const isP = isProp(d);
  if (!d.keys.length) {
    return isP
      ? '<p class="hint">A prop with no stations is stage dressing, so it stays off the timer.</p>'
      : '<p class="hint">No stations yet. Press <b>+ Stations</b>, then click the stage in order to lay this dancer path.</p>';
  }
  const rows = d.keys
    .map(function (k, i) {
      const secs = i === 0 || !Number.isFinite(k.dur) ? '' : (k.dur / 1000).toFixed(2);
      const dis = i === 0 ? 'disabled' : '';
      const cur = state.ui.stationIdx === i ? ' sel' : '';
      // What this landing gives when nothing is typed: the point before it decides.
      const autoAbs = levelOf(k, i ? d.keys[i - 1] : null).absorb;
      const at = fmtTime(contentOfLocal(state.show, d.id, k.t));
      const poseRow = isP
        ? ''
        : '<div class="row"><select data-f="pose" data-i="' + i + '">' +
          POSES.map(function (p) {
            const sel = (k.pose || 'none') === p[0] ? 'selected' : '';
            return '<option value="' + p[0] + '" ' + sel + '>' + p[1] + '</option>';
          }).join('') +
          '</select></div>';
      return '<div class="item' + cur + '" data-station="' + i + '">' +
        '<div class="row">' +
        '<button class="tag pick' + (k.pass ? ' through' : '') + '" data-act="pick-station" data-i="' + i + '" title="Select this station and jump the playhead to it' + (k.pass ? ' — a junction passed through rather than rested on' : '') + '">' + (i + 1) + '</button>' +
        '<span class="label">' + at + '</span>' +
        '<button class="del" data-act="del-station" data-i="' + i + '" title="Delete this station">remove</button></div>' +
        poseRow +
        '<div class="row"><span class="label">transition</span>' +
        '<input type="number" data-f="dur" data-i="' + i + '" min="0" step="0.1" value="' + secs + '" placeholder="—" ' + dis + ' />' +
        '<span class="label">s</span></div>' +
        '<div class="row"><span class="label">count</span>' +
        '<select data-f="ease" data-i="' + i + '" ' + dis + ' title="How this leg’s count is spent: even, gathering, settling or soft at both ends">' +
        EASES.map(function (x) {
          const sel = (k.ease || 'even') === x[0] ? 'selected' : '';
          return '<option value="' + x[0] + '" ' + sel + '>' + x[1] + '</option>';
        }).join('') +
        '</select></div>' +
        (isP
          ? ''
          : '<div class="row"><span class="label">step</span>' +
            '<select data-f="step" data-i="' + i + '" ' + dis + ' title="How this point is travelled: a named step is held while the dancer moves">' +
            STEPS.map(function (s) {
              const sel = (k.step || 'walk') === s[0] ? 'selected' : '';
              return '<option value="' + s[0] + '" ' + sel + '>' + s[1] + '</option>';
            }).join('') +
            '</select>' +
            '<input type="number" data-f="turn" data-i="' + i + '" step="45" min="-720" max="720" value="' + (Number(k.turn) || 0) + '" ' + dis + ' title="Degrees turned on the way to this point, added to the heading so consecutive turns chain" />' +
            '<span class="label">°</span></div>' +
            '<div class="row"><span class="label">turn over</span>' +
            '<input type="number" data-f="turnMs" data-i="' + i + '" min="0" step="0.5" value="' + (k.turnMs ? (k.turnMs / 1000).toFixed(1) : '') + '" placeholder="—" ' + dis + ' title="How long the turn takes; empty means the transition into this point" />' +
            '<span class="label">s</span></div>' +
            '<div class="row"><span class="label">level</span>' +
            '<select data-f="level" data-i="' + i + '" ' + dis + ' title="How this point meets the floor: flat, demi-pointe, pointe, or in the air">' +
            LEVELS.map(function (l) {
              const sel = (k.level || 'flat') === l[0] ? 'selected' : '';
              return '<option value="' + l[0] + '" ' + sel + '>' + l[1] + '</option>';
            }).join('') +
            '</select></div>' +
            '<div class="row"><span class="label">off floor</span>' +
            '<input type="number" data-f="lift" data-i="' + i + '" step="0.05" min="0" value="' + (k.lift ? Number(k.lift).toFixed(2) : '') + '" placeholder="' + ((k.level || 'flat') === 'air' ? AIR_LIFT : '—') + '" ' + dis + ' title="Metres the feet are off the deck; empty means standing on it, or the usual jump height when the level is in the air" />' +
            '<span class="label">m</span></div>' +
            '<div class="row"><span class="label">plié</span>' +
            '<input type="number" data-f="absorb" data-i="' + i + '" step="0.01" min="0" value="' + (k.absorb != null ? Number(k.absorb).toFixed(2) : '') + '" placeholder="' + (autoAbs ? autoAbs.toFixed(2) : '—') + '" ' + dis + ' title="How deep this landing gives, in metres of plié: empty takes what the drop needs, 0 is a stiff landing" />' +
            '<span class="label">m</span></div>' +
            '<div class="row"><span class="label">bow</span>' +
            '<input type="number" data-f="bend" data-i="' + i + '" step="0.1" value="' + (Number(k.bend) || 0) + '" ' + dis + ' title="How far the path bows to the left of the straight line at its middle, in metres" />' +
            '<span class="label">m</span></div>') +
        '</div>';
    })
    .join('');
  return '<h2>Path stations</h2>' +
    '<p class="hint">Pick a station, then drag it on the stage. Right-click a point to delete it and everything after. Double-click the timeline ruler to put a point on a count (Shift: on a bar).</p>' +
    '<div class="list">' + rows + '</div>';
}

let panelBound = false;
function bindPanelEvents() {
  if (panelBound) return;
  panelBound = true;

  // Curtains and props share the same editor, in the two different panels.
  const bindSceneryList = (el) => {
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act="del"]');
      if (btn) {
        const id = btn.closest('[data-id]').dataset.id;
        commit();
        state.show.scenery = state.show.scenery.filter((s) => s.id !== id);
        app.rebuild();
        return;
      }
      const host = e.target.closest('[data-id]');
      if (!host) return;
      const item = state.show.scenery.find((s) => s.id === host.dataset.id);
      if (!item) return;

      if (e.target.closest('button[data-act="cue"]')) {
        const box = e.target.closest('.item');
        const pick = box && box.querySelector('select[data-f="cueTo"]');
        const durBox = box && box.querySelector('input[data-f="cueDur"]');
        const value = pick ? pick.value : '';
        const secs = Number(durBox && durBox.value);
        commit();
        const to = item.kind === 'drop'
          ? { fly: value === 'in' ? 1 : 0 }
          : item.kind === 'card'
            ? { shown: value === 'on' ? 1 : 0 }
            : { open: Number(value) / 100 };
        addSceneryCue(item, state.ui.playhead, to, Number.isFinite(secs) ? secs * 1000 : 0);
        app.rebuild();
        return;
      }

      const delCueBtn = e.target.closest('button[data-act="del-cue"]');
      if (delCueBtn) {
        commit();
        removeSceneryCue(item, delCueBtn.dataset.cueId);
        if (state.ui.cueId === delCueBtn.dataset.cueId) state.ui.cueId = null;
        app.rebuild();
        return;
      }

      // A cue row is picked for editing in the panel, just as its band is on
      // the timeline: the row is only text until you click it.
      const cueRow = e.target.closest('[data-cue-select]');
      if (cueRow) {
        // Picking a cue does not move the object selection: the cue's own
        // controls live here in the list, and the inspector is for performers
        // and props.
        state.ui.cueId = cueRow.dataset.cueSelect;
        state.ui.selectedTrack = item.id;
        app.rebuild();
        return;
      }

      if (e.target.closest('button[data-act="eye"]')) {
        commit();
        item.visible = item.visible === false;
        if (!item.visible && state.ui.selectedId === item.id) {
          state.ui.selectedId = null;
          state.ui.stationIdx = null;
        }
        app.rebuild();
        app.select(state.ui.selectedId);
        return;
      }
      if (item.kind !== 'prop') return;
      // Props are editable objects, so clicking one focuses it.
      app.select(item.id);
    });
    el.addEventListener('input', (e) => {
      const host = e.target.closest('[data-id]');
      if (!host) return;
      const item = state.show.scenery.find((s) => s.id === host.dataset.id);
      if (!item) return;
      const f = e.target.dataset.f;
      if (!f) return;
      // The cue row's controls describe the *next* cue, so they are not item fields.
      if (f === 'cueTo' || f === 'cueDur') return;
      // A placed cue's own controls: what it does, and how long it takes.
      if (f === 'cue-edit' || f === 'cue-edit-dur') {
        const row = e.target.closest('[data-cue-select]');
        const id = row ? row.dataset.cueSelect : state.ui.cueId;
        if (!id) return;
        if (f === 'cue-edit-dur') {
          const secs = Number(e.target.value);
          if (!Number.isFinite(secs)) return;
          updateCue(item, id, { dur: Math.max(0, secs * 1000) });
        } else {
          const v = e.target.value;
          updateCue(
            item,
            id,
            item.kind === 'drop'
              ? { fly: v === 'in' ? 1 : 0 }
              : item.kind === 'card'
                ? { shown: v === 'on' ? 1 : 0 }
                : { open: Number(v) / 100 }
          );
        }
        persist();
        return;
      }
      if (f === 'open') item.open = Number(e.target.value) / 100;
      else if (f === 'fly') item.fly = Number(e.target.value) >= 0.5 ? 1 : 0;
      else if (f === 'shown') item.shown = Number(e.target.value) >= 0.5 ? 1 : 0;
      else if (f === 'w' || f === 'd') item[f] = Math.max(0.2, Number(e.target.value) || 0.2);
      else if (f === 'h') {
        // Props are small; cloth is measured against the opening.
        const lim = item.kind === 'prop' ? 6 : 20;
        item.h = Math.max(0.2, Math.min(lim, Number(e.target.value) || 0.8));
      } else if (f === 'span') {
        item.span = Math.max(0.5, Math.min(maxClothSpan(state.show.stage), Number(e.target.value) || state.show.stage.width));
        // The field shows what is stored, so a value past the limit is seen to be capped.
        if (Number(e.target.value) !== item.span) e.target.value = String(item.span);
        // Narrowing frees it to move, widening squeezes it back to the middle.
        item.x = clampClothX(item.x, item.span);
        // The Across field's limits and value depend on the width, so refresh it
        // here rather than rebuilding the panel under the cursor.
        const xi = host.querySelector('input[data-f="x"]');
        const lim = Math.max(0, (state.show.stage.width - item.span) / 2);
        if (xi) {
          xi.min = String(-lim);
          xi.max = String(lim);
          xi.value = String(item.x);
        }
      } else if (f === 'x') {
        item.x = clampClothX(Number(e.target.value), item.span ?? state.show.stage.width);
        if (e.target.value !== String(item.x)) e.target.value = String(item.x);
      } else if (f === 'depth') {
        const depth = state.show.stage.depth;
        item.y = Math.max(0.2, Math.min(depth - 0.2, Number(e.target.value) || 0.55));
        if (item.kind === 'curtain') item.depthSet = true;
        if (e.target.value !== String(item.y)) e.target.value = String(item.y);
      }
      else item[f] = e.target.value;
      persist();
    });
    el.addEventListener('change', (e) => {
      const f = e.target.dataset.f;
      if (f === 'cueTo') return;
      // Choosing a layer is how a curtain is released from a pinned depth.
      if (f === 'layer') {
        const host = e.target.closest('[data-id]');
        const item = host && state.show.scenery.find((s) => s.id === host.dataset.id);
        if (item) {
          commit();
          if (item.kind === 'curtain' || item.kind === 'drop') {
            item.layer = e.target.value;
            item.depthSet = false;
            // Keep the stored depth honest about where the layer puts it.
            const base = item.layer === 'center' ? state.show.stage.depth * 0.5
              : item.layer === 'back' ? Math.max(0.6, state.show.stage.depth - 0.75) : 0.55;
            item.y = base + (Number(item.order) || 0) * 0.5;
          }
          app.rebuild();
          return;
        }
      }
      if (f === 'color' || e.target.tagName === 'SELECT') commit();
    });
  };
  bindSceneryList($('sceneryList'));
  bindSceneryList($('propsList'));

  // The lights list. Same shape as the scenery one, but a lantern's controls are
  // its own: a colour, a level, a height, a pool and a run of level cues.
  const lightsList = $('lightsList');
  lightsList.addEventListener('click', (e) => {
    const host = e.target.closest('[data-light]');
    if (!host) return;
    const l = (state.show.lights || []).find((x) => x.id === host.dataset.light);
    if (!l) return;

    if (e.target.closest('[data-act="del-light"]')) {
      commit();
      removeLight(state.show, l.id);
      if (state.ui.lightId === l.id) state.ui.lightId = null;
      app.rebuild();
      return;
    }
    if (e.target.closest('[data-act="light-eye"]')) {
      l.visible = l.visible === false;
      if (!l.visible && state.ui.lightId === l.id) state.ui.lightId = null;
      app.rebuild();
      return;
    }
    if (e.target.closest('[data-act="light-cue"]')) {
      const pick = host.querySelector('select[data-f="cueTo"]');
      const followPick = host.querySelector('select[data-f="cueFollow"]');
      const durBox = host.querySelector('input[data-f="cueDur"]');
      const secs = Number(durBox && durBox.value);
      // "Hold level" and "hold aim" are how a cue says "leave that alone": a hand-off
      // is a cue with a performer and no level at all.
      const levelVal = pick ? pick.value : 'keep';
      const followVal = followPick ? followPick.value : 'keep';
      const level = levelVal === 'keep' ? undefined : Number(levelVal) / 100;
      const followId = followVal === 'keep' ? undefined : followVal === '__own' ? null : followVal;
      if (level === undefined && followId === undefined) {
        state.ui.hint = 'Choose a level or a performer for this cue to change';
        return;
      }
      commit();
      const cue = addLightCue(
        l,
        state.ui.playhead,
        level,
        Number.isFinite(secs) ? Math.max(0, secs * 1000) : 0,
        followId
      );
      if (cue) {
        state.ui.lightId = l.id;
        state.ui.cueId = cue.id;
      }
      app.rebuild();
      return;
    }
    // A gel is one click: the swatches are the colours a designer asks for most.
    const gel = e.target.closest('[data-gel]');
    if (gel) {
      commit();
      l.color = gel.dataset.gel;
      app.rebuild();
      return;
    }
    if (e.target.closest('[data-act="del-light-cue"]')) {
      const id = e.target.closest('[data-act="del-light-cue"]').dataset.cueId;
      commit();
      removeLightCue(l, id);
      if (state.ui.cueId === id) state.ui.cueId = null;
      app.rebuild();
      return;
    }
    // A cue row is picked for editing in the list, just as its band is on the
    // timeline, so the two selections are one selection.
    const cueRow = e.target.closest('[data-light-cue]');
    if (cueRow) {
      state.ui.lightId = l.id;
      state.ui.cueId = cueRow.dataset.lightCue;
      state.ui.selectedTrack = l.id;
      app.rebuild();
      return;
    }
    // Anything else in the card focuses the lantern.
    app.focusLight(l.id);
    app.rebuild();
  });
  lightsList.addEventListener('input', (e) => {
    const host = e.target.closest('[data-light]');
    if (!host) return;
    const l = (state.show.lights || []).find((x) => x.id === host.dataset.light);
    if (!l) return;
    const f = e.target.dataset.f;
    if (!f) return;
    // The row's controls describe the *next* cue, so they are not light fields.
    if (f === 'cueTo' || f === 'cueDur') return;
    if (f === 'cue-edit-level' || f === 'cue-edit-dur') {
      const row = e.target.closest('[data-light-cue]');
      const id = row ? row.dataset.lightCue : state.ui.cueId;
      if (!id) return;
      if (f === 'cue-edit-level') {
        // An emptied field is a cue that leaves the brightness alone.
        const raw = e.target.value.trim();
        if (raw === '') {
          updateLightCue(l, id, { level: 'keep' });
          persist();
          return;
        }
        const pct = Number(raw);
        if (!Number.isFinite(pct)) return;
        updateLightCue(l, id, { level: pct / 100 });
      } else {
        const secs = Number(e.target.value);
        if (!Number.isFinite(secs)) return;
        updateLightCue(l, id, { dur: Math.max(0, secs * 1000) });
      }
      persist();
      return;
    }
    if (f === 'level') {
      l.level = Math.max(0, Math.min(1, Number(e.target.value) / 100));
      // The number beside the slider is the one being chosen, so it moves with it.
      const tag = host.querySelector('[data-f="level"] + .tag');
      if (tag) tag.textContent = Math.round(l.level * 100) + '%';
    } else if (f === 'h') {
      l.h = Math.max(0.5, Math.min(20, Number(e.target.value) || 5));
    } else if (f === 'spread') {
      l.spread = Math.max(0.4, Math.min(state.show.stage.width, Number(e.target.value) || 3.2));
    } else if (f === 'x') {
      const lim = state.show.stage.width / 2;
      l.x = Math.max(-lim, Math.min(lim, Number(e.target.value) || 0));
    } else if (f === 'z') {
      l.z = Math.max(0, Math.min(state.show.stage.depth, Number(e.target.value) || 0));
    } else if (f === 'color') {
      // The swatch and the pool read the same hex, so the colour changes as it is
      // picked rather than on release.
      if (/^#[0-9a-f]{6}$/i.test(e.target.value)) {
        l.color = e.target.value;
        const sw = host.querySelector('.swatch');
        if (sw) sw.style.background = l.color;
      }
    } else if (f === 'name') {
      l.name = e.target.value;
    }
    persist();
  });
  lightsList.addEventListener('change', (e) => {
    const host = e.target.closest('[data-light]');
    const l = host && (state.show.lights || []).find((x) => x.id === host.dataset.light);
    // Follow spots: the setting, not a cue. The lantern keeps its own place while
    // it follows, so clearing the picker sends it back where it was hung.
    if (l && e.target.dataset.f === 'follow') {
      commit();
      l.followId = e.target.value || null;
      app.rebuild();
      return;
    }
    // Changing the type brings its usual pool with it — a flood is not a spot with a
    // wide number in it — and the Pool field is still there to overrule that.
    if (l && e.target.dataset.f === 'type') {
      commit();
      l.type = e.target.value;
      const usual = LIGHT_SPREAD_BY_TYPE[l.type];
      if (Number.isFinite(usual)) l.spread = Math.max(0.4, Math.min(state.show.stage.width, usual));
      app.rebuild();
      return;
    }
    if (l && e.target.dataset.f === 'gobo') {
      commit();
      l.gobo = e.target.value;
      app.rebuild();
      return;
    }
    // A picked cue's hand-off: 'keep' removes the field, so the cue stops moving the
    // aim at all rather than moving it to where it already is.
    if (l && e.target.dataset.f === 'cue-edit-follow') {
      const row = e.target.closest('[data-light-cue]');
      const id = row ? row.dataset.lightCue : state.ui.cueId;
      if (!id) return;
      commit();
      const v = e.target.value;
      updateLightCue(l, id, { followId: v === 'keep' ? 'keep' : v === '__own' ? null : v });
      app.rebuild();
      return;
    }
    if (e.target.dataset.f === 'cueTo') return;
    commit();
  });
  $('btnAddLight').addEventListener('click', () => {
    commit();
    const l = addLight(state.show);
    app.focusLight(l.id);
    app.rebuild();
  });

  const legsList = $('legsList');
  legsList.addEventListener('input', (e) => {
    if (e.target.dataset.f !== 'y') return;
    const host = e.target.closest('[data-id]');
    if (!host) return;
    const leg = state.show.wingLegs.find((l) => l.id === host.dataset.id);
    const v = Number(e.target.value);
    if (!leg || !Number.isFinite(v)) return;
    leg.y = Math.min(Math.max(v, 0.45), Math.max(0.5, state.show.stage.depth - 0.45));
    persist();
  });
  legsList.addEventListener('change', () => commit());
  legsList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="del-leg"]');
    if (!btn) return;
    const host = btn.closest('[data-id]');
    if (!host) return;
    commit();
    removeWingLeg(state.show, host.dataset.id);
    app.rebuild();
  });

  // Switching act moves the playhead to the act's first moment: the stage shows
  // the same stage, at the start of that act.
  const gotoTimes = (start) => {
    state.ui.playhead = start;
    state.ui.stationIdx = null;
    state.ui.scrollT = Math.max(0, displayOfContent(state.show, start) / 1000 - 1);
    state.ui.dirtyPanels = true;
  };

  $('actTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.act-tab');
    if (!btn) return;
    if (btn.dataset.add) {
      commit();
      const act = addAct(state.show);
      const range = actRanges(state.show).find((r) => r.id === act.id);
      gotoTimes(range ? range.start : 0);
      app.rebuild();
      return;
    }
    const range = actRanges(state.show).find((r) => r.id === btn.dataset.id);
    if (range) gotoTimes(range.start);
  });

  const actsList = $('actsList');
  const actOf = (target) => {
    const host = target.closest('[data-id]');
    return host ? state.show.acts.find((a) => a.id === host.dataset.id) : null;
  };
  // Both fields apply as they are typed: this browser does not fire `change` on
  // Enter, so waiting for it would lose the edit. The field keeps the text the
  // user typed; the act keeps the clamped number.
  actsList.addEventListener('input', (e) => {
    const act = actOf(e.target);
    if (!act) return;
    if (e.target.dataset.f === 'name') {
      act.name = e.target.value;
      // Keep the tab in step while typing, without rebuilding the list under the cursor.
      const name = $('actTabs').querySelector(`.act-tab[data-id="${act.id}"] .act-name`);
      if (name) name.textContent = act.name || 'Act';
      persist();
      return;
    }
    if (e.target.dataset.f === 'length') {
      const secs = Number(e.target.value);
      if (!Number.isFinite(secs)) return;
      act.length = Math.max(ACT_MIN_MS, Math.min(ACT_MAX_MS, Math.round(secs * 1000)));
      // A shorter act cannot keep a scene past its end.
      clampSceneOffsets(act);
      persist();
      return;
    }
    if (e.target.dataset.f === 'scene-name' || e.target.dataset.f === 'scene-at') {
      const row = e.target.closest('[data-scene]');
      const scene = row ? (act.scenes || []).find((s) => s.id === row.dataset.scene) : null;
      if (!scene) return;
      if (e.target.dataset.f === 'scene-name') {
        scene.name = e.target.value;
        const chip = $('sceneTabs').querySelector(`.scene-tab[data-id="${scene.id}"]`);
        if (chip) chip.textContent = scene.name || 'Scene';
      } else {
        const secs = Number(e.target.value);
        if (!Number.isFinite(secs)) return;
        scene.offset = Math.max(0, Math.min(Math.round(secs * 1000), Math.max(0, act.length - 1000)));
      }
      persist();
    }
  });
  // Shortening the running order can leave the playhead past the end of it.
  const clampPlayhead = () => {
    const end = endContent(state.show);
    if (state.ui.playhead > end) state.ui.playhead = end;
  };
  actsList.addEventListener('change', (e) => {
    if (!actOf(e.target)) return;
    if (e.target.dataset.f === 'name' || e.target.dataset.f === 'scene-name') commit();
    clampPlayhead();
    app.rebuild();
  });
  actsList.addEventListener('keydown', (e) => {
    const f = e.target.dataset.f;
    if (e.key !== 'Enter' || (f !== 'length' && f !== 'scene-at')) return;
    e.preventDefault();
    clampPlayhead();
    app.rebuild();
  });
  actsList.addEventListener('click', (e) => {
    const delScene = e.target.closest('[data-act="del-scene"]');
    if (delScene) {
      const row = delScene.closest('[data-scene]');
      if (!row) return;
      commit();
      removeScene(state.show, row.dataset.scene);
      app.rebuild();
      return;
    }
    const btn = e.target.closest('[data-act="del-act"]');
    if (!btn) return;
    const host = btn.closest('[data-id]');
    if (!host) return;
    commit();
    const ok = removeAct(state.show, host.dataset.id);
    state.ui.hint = ok ? null : 'Only an empty last act can be removed';
    clampPlayhead();
    app.rebuild();
  });

  // A scene is only a named moment, so adding or jumping to one never moves work.
  $('sceneTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.scene-tab');
    if (!btn) return;
    if (btn.dataset.add) {
      if (!actAt(state.show, state.ui.playhead)) return;
      commit();
      const scene = addScene(state.show, state.ui.playhead);
      state.ui.hint = scene ? null : 'There is already a scene at this moment';
      app.rebuild();
      return;
    }
    const range = sceneRanges(state.show).find((s) => s.id === btn.dataset.id);
    if (range) gotoTimes(range.start);
  });

  const castList = $('castList');
  castList.addEventListener('click', (e) => {
    // The costume picker and the role field are controls inside the row: using one must
    // not select the dancer and rebuild the panel under the pointer.
    if (e.target.closest('[data-act="dress"]') || e.target.closest('[data-act="role"]')) return;
    const host = e.target.closest('[data-id]');
    if (!host) return;
    const d = state.show.cast.find((x) => x.id === host.dataset.id);
    if (!d) return;
    if (e.target.closest('[data-act="eye"]')) {
      toggleVisibility(d, e.ctrlKey || e.metaKey);
      app.rebuild();
      app.select(state.ui.selectedId);
      return;
    }
    app.select(d.id);
  });

  // Dressing is one choice on the performer's own row, because that is where you are
  // when you decide what they wear.
  castList.addEventListener('change', (e) => {
    const host = e.target.closest('[data-id]');
    const d = host && state.show.cast.find((x) => x.id === host.dataset.id);
    if (!d) return;
    if (e.target.dataset.act === 'dress') {
      commit();
      d.costumeId = e.target.value || null;
      persist();
      app.rebuild();
      return;
    }
    if (e.target.dataset.act === 'role') {
      const act = actAt(state.show, state.ui.playhead);
      if (!act) return;
      commit();
      // The show decides what was kept (trimmed, or cleared by an empty field), so the
      // field is put back to that rather than to what was typed.
      e.target.value = setRole(state.show, act.id, d.id, e.target.value);
      persist();
      app.rebuild();
    }
  });

  // ---- the overlaps. A scan of the whole running order, then one ranked fix per overlap.
  // The stamp of the show it was read from travels with it, so a list cannot outlive the paths it
  // describes. `say` replaces the count for a moment, which is how a fix reports itself.
  const scanNow = (say) => {
    const list = scanOverlaps(state.show).map((o) => ({ ...o, fix: overlapFix(state.show, o) }));
    state.ui.overlaps = { list, key: pathsKey(state.show) };
    state.ui.hint = say || (list.length
      ? `${list.length} overlap${list.length === 1 ? '' : 's'} in this show`
      : `No two performers come inside ${CLEARANCE.toFixed(2)} m anywhere in this show`);
    app.rebuild();
  };
  $('btnScanOverlaps').addEventListener('click', () => scanNow());

  const overlapList = $('overlapList');
  overlapList.addEventListener('click', (e) => {
    const scan = state.ui.overlaps;
    if (!scan || scan.key !== pathsKey(state.show)) return;
    const host = e.target.closest('[data-overlap]');
    if (!host) return;
    const o = scan.list.find((x) => x.id === host.dataset.overlap);
    if (!o) return;
    if (e.target.closest('[data-act="fix"]')) {
      if (!o.fix) return;
      const label = o.fix.label;
      commit();
      applyOverlapFix(state.show, o.fix);
      persist();
      // The floor has changed around her, so the list is looked at again rather than patched: the
      // fix may have moved a station that other overlaps were counted against, and a fix that only
      // tidy one collision into another is not one.
      scanNow('Fixed: ' + label + ' — Undo puts it back');
      return;
    }
    // The row itself is a way into the moment, so the stage can be judged before changing it.
    gotoTimes(o.at);
    app.rebuild();
  });

  // The green room. A costume is edited in place, and every view redraws from it, so
  // a colour is changed by watching the plan rather than by pressing apply.
  $('btnAddCostume').addEventListener('click', () => {
    commit();
    addCostume(state.show);
    app.rebuild();
  });
  const wardrobe = $('costumeList');
  wardrobe.addEventListener('click', (e) => {
    if (!e.target.closest('button[data-act="del"]')) return;
    const host = e.target.closest('[data-costume]');
    if (!host) return;
    commit();
    removeCostume(state.show, host.dataset.costume);
    if (state.ui.selectedId) app.select(state.ui.selectedId);
    else app.rebuild();
  });
  wardrobe.addEventListener('input', (e) => {
    const host = e.target.closest('[data-costume]');
    const f = e.target.dataset.f;
    if (!host || !f) return;
    const c = state.show.costumes.find((x) => x.id === host.dataset.costume);
    if (!c) return;
    c[f] = e.target.value;
    // The swatch follows the body colour as it is dragged, rather than being rebuilt
    // under the pointer mid-drag.
    if (f === 'body') {
      const sw = host.querySelector('.swatch');
      if (sw) sw.style.background = e.target.value;
    }
    const hex = host.querySelector(`input[data-hex="${f}"]`);
    if (hex) hex.value = e.target.value;
    persist();
  });
  // Hex text entry beside each colour swatch. Firefox's colour picker has no hex field,
  // so typed values are accepted here when they are a full #rrggbb.
  wardrobe.addEventListener('change', (e) => {
    const host = e.target.closest('[data-costume]');
    const f = e.target.dataset.hex;
    if (!host || !f) return;
    const c = state.show.costumes.find((x) => x.id === host.dataset.costume);
    if (!c) return;
    const raw = e.target.value.trim();
    const v = /^#?([0-9a-f]{6})$/i.exec(raw);
    if (!v) {
      e.target.value = c[f];
      return;
    }
    const hex = `#${v[1].toLowerCase()}`;
    commit();
    c[f] = hex;
    e.target.value = hex;
    const picker = host.querySelector(`input[type="color"][data-f="${f}"]`);
    if (picker) picker.value = hex;
    if (f === 'body') {
      const sw = host.querySelector('.swatch');
      if (sw) sw.style.background = hex;
    }
    persist();
    app.rebuild();
  });
  wardrobe.addEventListener('change', (e) => {
    const host = e.target.closest('[data-costume]');
    if (!host || e.target.dataset.f !== 'style') return;
    const c = state.show.costumes.find((x) => x.id === host.dataset.costume);
    if (!c) return;
    commit();
    c.style = e.target.value;
    persist();
    app.rebuild();
  });

  // Focused-station strip under the stage.
  const strip = $('pointStrip');
  strip.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (f !== 'dur' && f !== 'turn' && f !== 'turnMs' && f !== 'bend' && f !== 'lift' && f !== 'absorb') return;
    const d = findObject(state.show, state.ui.selectedId);
    const i = state.ui.stationIdx;
    if (!d || !Number.isInteger(i) || !d.keys[i]) return;
    if (f === 'absorb') {
      const raw = String(e.target.value).trim();
      const v = Number(raw);
      if (raw === '') d.keys[i].absorb = null;
      else if (Number.isFinite(v) && v >= 0) d.keys[i].absorb = Math.min(ABSORB_MAX, v);
      else return;
      persist();
      return;
    }
    if (f === 'lift') {
      const raw = String(e.target.value).trim();
      const v = Number(raw);
      if (raw === '') d.keys[i].lift = null;
      else if (Number.isFinite(v) && v >= 0) d.keys[i].lift = Math.min(LIFT_MAX, v);
      else return;
      persist();
      return;
    }
    if (f === 'bend') {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) return;
      d.keys[i].bend = Math.max(-BEND_LIMIT, Math.min(BEND_LIMIT, v));
      persist();
      return;
    }
    if (f === 'turn') {
      const deg = Number(e.target.value);
      if (!Number.isFinite(deg)) return;
      d.keys[i].turn = Math.max(-720, Math.min(720, deg));
      persist();
      return;
    }
    if (f === 'turnMs') {
      const raw = String(e.target.value).trim();
      const secs = Number(raw);
      if (raw === '') d.keys[i].turnMs = null;
      else if (Number.isFinite(secs) && secs >= 0) d.keys[i].turnMs = Math.min(60000, Math.round(secs * 1000));
      else return;
      persist();
      return;
    }
    const secs = Number(e.target.value);
    if (!Number.isFinite(secs) || secs < 0) return;
    ensureDurations(d);
    d.keys[i].dur = Math.round(secs * 1000);
    reflowKeys(d, i);
    state.ui.playhead = contentOfLocal(state.show, d.id, d.keys[i].t);
    persist();
  });
  strip.addEventListener('change', (e) => {
    const f = e.target.dataset.f;
    // A junction can be taken back to a stop: the pace of the leg is the count beside it.
    if (f === 'pass') {
      const d = findObject(state.show, state.ui.selectedId);
      const i = state.ui.stationIdx;
      if (!d || !Number.isInteger(i) || !d.keys[i]) return;
      commit();
      d.keys[i].pass = e.target.checked === true;
      app.rebuild();
      return;
    }
    if (f !== 'pose' && f !== 'step' && f !== 'level' && f !== 'ease' && f !== 'plant') return;
    const d = findObject(state.show, state.ui.selectedId);
    const i = state.ui.stationIdx;
    if (!d || !Number.isInteger(i) || !d.keys[i]) return;
    commit();
    ensureDurations(d);
    // A plant set back to auto is absent rather than empty, so a reopened show and a fresh one
    // read the same.
    if (f === 'plant') d.keys[i].plant = e.target.value || null;
    else d.keys[i][f] = e.target.value;
    // A level rebuilds the strip as well as the stage, so the height field's hint follows
    // the new level.
    app.rebuild();
  });
  strip.addEventListener('click', (e) => {
    const d = findObject(state.show, state.ui.selectedId);
    const i = state.ui.stationIdx;
    if (!d || !Number.isInteger(i)) return;
    if (e.target.closest('[data-act="continue"]')) {
      app.continueFrom(d, i);
      return;
    }
    if (e.target.closest('[data-act="del-from"]')) app.deleteFrom(d, i);
  });

  const insp = $('inspector');
  insp.addEventListener('input', (e) => {
    const d = findObject(state.show, state.ui.selectedId);
    if (!d) return;
    const f = e.target.dataset.f;
    if (!f) return;
    if (f === 'dur') {
      const i = Number(e.target.dataset.i);
      const secs = Number(e.target.value);
      if (!Number.isFinite(i) || !Number.isFinite(secs) || secs < 0) return;
      ensureDurations(d);
      d.keys[i].dur = Math.round(secs * 1000);
      reflowKeys(d, i);
      persist();
      return;
    }
    // A station's own fields carry an index, so they are written to the key rather than
    // to the dancer: `step` and `turn` are not properties of a performer.
    if (f === 'turn' || f === 'turnMs' || f === 'bend' || f === 'lift' || f === 'absorb') {
      const i = Number(e.target.dataset.i);
      if (!Number.isInteger(i) || !d.keys[i]) return;
      if (f === 'absorb') {
        const raw = String(e.target.value).trim();
        const v = Number(raw);
        if (raw === '') d.keys[i].absorb = null;
        else if (Number.isFinite(v) && v >= 0) d.keys[i].absorb = Math.min(ABSORB_MAX, v);
        else return;
        persist();
        return;
      }
      if (f === 'lift') {
        const raw = String(e.target.value).trim();
        const v = Number(raw);
        if (raw === '') d.keys[i].lift = null;
        else if (Number.isFinite(v) && v >= 0) d.keys[i].lift = Math.min(LIFT_MAX, v);
        else return;
        persist();
        return;
      }
      if (f === 'bend') {
        const v = Number(e.target.value);
        if (!Number.isFinite(v)) return;
        d.keys[i].bend = Math.max(-BEND_LIMIT, Math.min(BEND_LIMIT, v));
      } else if (f === 'turn') {
        const deg = Number(e.target.value);
        if (!Number.isFinite(deg)) return;
        d.keys[i].turn = Math.max(-720, Math.min(720, deg));
      } else {
        const raw = String(e.target.value).trim();
        const secs = Number(raw);
        if (raw === '') d.keys[i].turnMs = null;
        else if (Number.isFinite(secs) && secs >= 0) d.keys[i].turnMs = Math.min(60000, Math.round(secs * 1000));
        else return;
      }
      persist();
      return;
    }
    // A field carrying a station index belongs to that station: a select here fires
    // `input` as well as `change`, and the station's own handler writes it.
    if (e.target.dataset.i != null) return;
    if (f === 'w' || f === 'd') d[f] = Math.max(0.2, Number(e.target.value) || 0.2);
    else if (f === 'h') d.h = Math.max(0.1, Math.min(6, Number(e.target.value) || 0.8));
    else d[f] = e.target.value;
    persist();
  });
  insp.addEventListener('change', (e) => {
    const d = findObject(state.show, state.ui.selectedId);
    if (!d) return;
    if (e.target.dataset.f === 'carriedBy') {
      commit();
      const who = e.target.value;
      if (who) {
        d.carriedBy = who;
        if (!d.carryOffset) d.carryOffset = { x: CARRY_OFFSET.x, y: CARRY_OFFSET.y };
      } else {
        // Leave it where it currently stands rather than snapping it back to
        // wherever it was before the dancer picked it up.
        const at = propPosOfContent(state.show, d, state.ui.playhead);
        if (at) {
          d.x = at.x;
          d.y = at.y;
        }
        d.carriedBy = null;
      }
      app.rebuild();
      return;
    }
    const i = e.target.dataset.i;
    if (i != null && e.target.dataset.f === 'pose') {
      commit();
      ensureDurations(d);
      d.keys[Number(i)].pose = e.target.value;
      app.rebuild();
      return;
    }
    if (i != null && e.target.dataset.f === 'step') {
      commit();
      ensureDurations(d);
      d.keys[Number(i)].step = e.target.value;
      app.rebuild();
      return;
    }
    if (i != null && e.target.dataset.f === 'level') {
      commit();
      ensureDurations(d);
      d.keys[Number(i)].level = e.target.value;
      app.rebuild();
      return;
    }
    if (i != null && e.target.dataset.f === 'ease') {
      commit();
      d.keys[Number(i)].ease = EASE_LABEL[e.target.value] ? e.target.value : 'even';
      app.rebuild();
      return;
    }
    if (e.target.dataset.f === 'color') commit();
  });
  insp.addEventListener('click', (e) => {
    const d = findObject(state.show, state.ui.selectedId);
    if (!d) return;
    if (e.target.closest('[data-act="to-timer"]')) {
      app.addPropToTimer(d);
      return;
    }
    const delBtn = e.target.closest('[data-act="del-station"]');
    if (delBtn) {
      commit();
      removeStation(d, Number(delBtn.dataset.i));
      state.ui.stationIdx = null;
      app.rebuild();
      return;
    }
    const pick = e.target.closest('[data-act="pick-station"]');
    if (pick) {
      const i = Number(pick.dataset.i);
      if (!d.keys[i]) return;
      app.focusStation(d, i);
      app.rebuild();
      // Bring the picked row into view, so choosing a station shows where to edit.
      requestAnimationFrame(() => {
        const row = $('inspector').querySelector('.item.sel[data-station]');
        if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
      });
      return;
    }
    const handoffBtn = e.target.closest('[data-act="handoff"]');
    if (handoffBtn) {
      const row = handoffBtn.closest('.row');
      const pick = row && row.querySelector('select[data-f="handoffTo"]');
      const to = pick && pick.value;
      if (!to) {
        state.ui.hint = 'Pick who takes the prop';
        return;
      }
      if (carrierIdOf(d, state.ui.playhead) === to) {
        state.ui.hint = 'That dancer already has it at this moment';
        return;
      }
      commit();
      addCarryHandoff(d, state.ui.playhead, to);
      app.rebuild();
      return;
    }
    const delHandoff = e.target.closest('[data-act="del-handoff"]');
    if (delHandoff) {
      commit();
      removeCarryHandoff(d, delHandoff.dataset.id);
      app.rebuild();
      return;
    }
    if (!e.target.closest('[data-act="del-dancer"]')) return;
    // A speaker cannot leave while clips are still attached: they are un-attached or deleted first.
    const spoken = clipsSpokenBy(state.show, state.ui.selectedId);
    if (spoken.length) {
      state.ui.hint = `Not removed: ${spoken.map((c) => c.name).join(', ')} ${spoken.length === 1 ? 'is' : 'are'} attached to this speaker. Set the speaker to Unattached or delete the clip first.`;
      state.ui.dirtyPanels = true;
      app.rebuild();
      return;
    }
    commit();
    const goneId = state.ui.selectedId;
    state.show.cast = state.show.cast.filter((d) => d.id !== goneId);
    state.show.markers = state.show.markers.filter((m) => m.trackId !== goneId);
    // Nor can a follow spot follow one: it goes back to being a fixed spot where it
    // was hung, which is what the operator would do if the performer left.
    (state.show.lights || []).forEach((l) => {
      if (l.followId === goneId) l.followId = null;
    });
    // A prop cannot be carried, or handed, by a dancer who has left the show.
    state.show.scenery.forEach((s) => {
      if (s.kind !== 'prop') return;
      if (s.carriedBy === goneId) s.carriedBy = null;
      if (Array.isArray(s.carryHandoffs)) {
        s.carryHandoffs = s.carryHandoffs.filter((h) => h.to !== goneId);
      }
    });
    state.ui.selectedId = null;
    app.rebuild();
  });
}

/* --------------------------------------------------------------- transport */

function play() {
  // Pressing play on a finished show is a request to see it again, not to sit at
  // the end listening to silence.
  const marked = endMarker(state.show);
  if (marked && state.ui.playhead >= marked.t) state.ui.playhead = 0;
  state.ui.playing = true;
  state.ui.activePause = null;
  state.ui.collision = null;
  state.ui.ignoreUntil = state.ui.playhead + 600;
  // The track joins wherever the playhead already is, so pressing play in the
  // middle of Act 2 hears the music that belongs there.
  const track = activeMusicAt(state.show, state.ui.playhead);
  music.setMuted(track ? track.visible === false : false);
  music.play(state.ui.playhead, track);
  // The voice about to be reached is decoded now rather than when it is due, so
  // a line is not late for its own first performance.
  narration.preload(state.show, state.ui.playhead);
}

function pause() {
  state.ui.playing = false;
  state.ui.activePause = null;
  music.pause();
}

function stop() {
  state.ui.playing = false;
  state.ui.playhead = 0;
  state.ui.activePause = null;
  state.ui.collision = null;
  music.pause();
}

function advance(dt) {
  const ui = state.ui;
  const show = state.show;

  if (ui.activePause) {
    ui.activePause.remaining -= dt;
    if (ui.activePause.remaining <= 0) {
      ui.activePause = null;
      ui.playhead += 1;
      // The interval is over: the music picks up where it stopped.
      music.play(ui.playhead, activeMusicAt(show, ui.playhead));
    }
  } else {
    const upcoming = sortedPauses(show).find((p) => p.t > ui.playhead && p.t <= ui.playhead + dt);
    if (upcoming) {
      ui.playhead = upcoming.t;
      ui.activePause = { id: upcoming.id, remaining: upcoming.duration };
      // A pause is a break in the performance, so the music breaks with it.
      music.pause();
    } else {
      ui.playhead += dt;
    }
  }

  // Collisions are an editing aid: a run-through plays through them rather than
  // stopping the show in front of an audience.
  if (!ui.watch && ui.playhead >= (ui.ignoreUntil || 0)) {
    const hits = collisionsAt(show, ui.playhead);
    if (hits.length) {
      ui.collision = { t: ui.playhead, ids: hits[0].map((d) => d.number) };
      if (ui.pauseOnCollision) {
        ui.playing = false;
        ui.activePause = null;
        // Stopping on a collision is a stop: the music has to stop with it.
        music.pause();
      }
    } else {
      ui.collision = null;
    }
  }

  // The end of the show stops the clock. With a marked end it stops on the moment
  // itself, because that is the picture the last cue was timed to; without one it
  // stops a second past the last thing so that thing can be seen.
  const marked = endMarker(show);
  const end = marked ? marked.t : endContent(show) + 1000;
  if (ui.playhead >= end) {
    ui.playhead = end;
    ui.playing = false;
    ui.activePause = null;
    music.pause();
    if (marked) ui.hint = 'The show ends here: ' + fmtTime(displayOfContent(show, end));
  }
}

function togglePlay() {
  if (state.ui.playing) pause();
  else play();
}

/* -------------------------------------------------------------- run-through */

// Watching is a mode of this page, not a second page: the clock, the pause
// markers and the music are the ones the editor already uses, so a run-through
// cannot drift from the show it is meant to be. The chrome is hidden by a body
// class and every pointer handler stands down while it is on.
function setWatch(on) {
  const want = !!on;
  if (state.ui.watch === want) return;
  state.ui.watch = want;
  document.body.classList.toggle('watch', want);
  const bar = $('watchBar');
  if (bar) bar.hidden = !want;
  $('watchExit').hidden = !want;

  if (want) {
    state.ui.beforeWatchFill = state.ui.fill;
    state.ui.fill = 'house';
    // Nothing is half-finished when the audience arrives.
    state.ui.placingStations = false;
    state.ui.stationIdx = null;
    state.ui.cueId = null;
    state.ui.hint = null;
    state.ui.collision = null;
    const title = $('wTitle');
    if (title) title.textContent = state.show.name;
    // A run-through starts at the top, with the music, as a performance would.
    state.ui.playhead = 0;
    pause();
    play();
  } else {
    state.ui.fill = state.ui.beforeWatchFill ?? null;
    pause();
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }
  // A run-through has no room for a half-filled centre, and the fill has to come
  // back when it ends.
  paintView();
  fitKey = '';
  app.rebuild();
}

/* ---------------------------------------------------------- folding sections */

// Every section of either pane folds down to its heading. The stage's own numbers are
// set once and then take a third of the pane, so a section that has been dealt with can
// stand aside for the lists; the right pane's lists fold one at a time, because those
// are what you are working in.
//
// The stage pane keeps a separate arrangement per act: lighting Act 2 is a different
// job from lighting Act 1, so a section folded for one is not folded for the other. The
// right pane's cast, props and narration are the same lists whatever is playing and fold
// once for all acts. All of it is remembered in the browser beside the view settings,
// because it is the state of your desk rather than of the show.
const SEC_KEY = 'choreographer.sections.v1';
// Every foldable section, so "Fold all" has something to act on.
let sections = [];
// Open state for the sections that do not belong to an act (the right pane's lists).
let sectionState = {};
// actId → { slug: open }, for the stage pane.
let actFolds = {};
// The act the stage pane is currently arranged for.
let foldActId = null;

function currentActId() {
  const a = actAt(state.show, state.ui.playhead);
  return a ? a.id : null;
}

function loadSections() {
  let raw = {};
  try {
    raw = JSON.parse(localStorage.getItem(SEC_KEY) || '{}') || {};
  } catch (e) {
    raw = {}; /* nothing remembered — every section starts open */
  }
  if (raw && typeof raw.sections === 'object' && raw.sections && typeof raw.acts === 'object' && raw.acts) {
    sectionState = raw.sections;
    actFolds = raw.acts;
  } else {
    // Written before acts had arrangements of their own: the flat map becomes the state
    // of the act you are in, so nothing you had folded springs open on upgrade.
    sectionState = {};
    actFolds = {};
    const id = currentActId();
    if (id) actFolds[id] = Object.assign({}, raw || {});
  }
  // An act that has gone takes its arrangement with it, rather than leaving keys that
  // can never be reached again.
  const live = new Set((state.show.acts || []).map((a) => a.id));
  for (const id of Object.keys(actFolds)) if (!live.has(id)) delete actFolds[id];
}

function saveSections() {
  try {
    localStorage.setItem(SEC_KEY, JSON.stringify({ sections: sectionState, acts: actFolds }));
  } catch (e) {
    /* storage blocked — folding still works for this session */
  }
}

// One button, two readings: while anything on this side is open it says "Fold all",
// and once the whole pane is shut it says "Unfold all" — the same words the section
// headings use for the same reason.
function paintFoldAll() {
  const b = $('btnFoldAll');
  if (!b) return;
  const left = sections.filter((s) => s.pane === 'left');
  const shut = left.length > 0 && left.every((s) => !s.open);
  b.textContent = shut ? 'Unfold all' : 'Fold all';
  b.setAttribute('aria-pressed', shut ? 'true' : 'false');
  b.title = shut ? 'Unfold every section in this pane' : 'Fold every section in this pane';
}

function setupSections() {
  loadSections();
  sections = [];
  foldActId = currentActId();

  for (const paneName of ['left', 'right']) {
    const pane = $(paneName);
    if (!pane) continue;
    for (const sec of Array.from(pane.children)) {
      if (sec.tagName !== 'SECTION') continue;
      const head = sec.querySelector('h2');
      // The inspector is a section with no heading of its own: it shows what is picked
      // and is never something you are finished with.
      if (!head) continue;
      // The heading's own words are the key, not its whole text: "Running order 1"
      // folds under `running-order`, so the count changing never loses the fold.
      const label = String((head.firstChild && head.firstChild.textContent) || head.textContent).trim();
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const ctl = {
        pane: paneName,
        sec,
        get open() {
          return !sec.classList.contains('collapsed');
        },
        // What this section is in the arrangement that applies now: the act's own when
        // it has one, otherwise open — an act you have not arranged yet starts fresh.
        read() {
          if (paneName !== 'left') return sectionState[key] !== false;
          const map = foldActId ? actFolds[foldActId] : null;
          return !map || map[key] !== false;
        },
        // The drawing and the attribute, saying nothing about memory: switching act
        // must not write one act's arrangement over another's.
        apply(open) {
          sec.classList.toggle('collapsed', !open);
          head.setAttribute('aria-expanded', open ? 'true' : 'false');
        },
        store(open) {
          if (paneName !== 'left') {
            sectionState[key] = open;
            return;
          }
          if (!foldActId) return;
          const map = actFolds[foldActId] || (actFolds[foldActId] = {});
          map[key] = open;
        },
      };
      ctl.apply(ctl.read());
      head.classList.add('sec-head');
      head.setAttribute('role', 'button');
      head.setAttribute('tabindex', '0');
      head.title = 'Fold or unfold this section';
      const toggle = () => {
        const next = !ctl.open;
        ctl.apply(next);
        ctl.store(next);
        saveSections();
        paintFoldAll();
      };
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // Space is the transport's key as well, so a fold must not also start the show.
          e.stopPropagation();
          toggle();
        }
      });
      sections.push(ctl);
    }
  }
  paintFoldAll();
}

// Folds the stage pane, or opens it again once everything on it is shut. It acts on the
// act you are in, which is the one the pane is showing.
function foldAllSections() {
  const left = sections.filter((s) => s.pane === 'left');
  if (!left.length) return;
  const shut = left.every((s) => !s.open);
  for (const s of left) {
    s.apply(shut);
    s.store(shut);
  }
  saveSections();
  paintFoldAll();
}

// Moving into another act is moving into another job, so the stage pane takes that
// act's arrangement — without writing anything, which is what makes it safe to call on
// every frame: it does the work only when the act has actually changed.
function syncFoldsToAct() {
  const id = currentActId();
  if (id === foldActId) return;
  foldActId = id;
  for (const s of sections) if (s.pane === 'left') s.apply(s.read());
  paintFoldAll();
}

/* --------------------------------------------------------------- view prefs */

// Which view fills the centre, and whether the elevation draws depth. Both are ways
// of looking at the show rather than part of it, so they live beside the show in the
// browser — reopening the planner leaves the room set up the way you left it.
const VIEW_KEY = 'choreographer.view.v1';

function loadView() {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) || '{}');
    if (['plan', 'elevation', 'house'].includes(saved.fill)) state.ui.fill = saved.fill;
    if (saved.depth === false) state.ui.depth = false;
    state.ui.showPaths = saved.showPaths !== false;
    state.ui.showStations = saved.showStations !== false;
    state.ui.showCostumes = saved.showCostumes === true;
    state.ui.planTilt = Math.max(0, Math.min(55, Number(saved.planTilt) || 0));
  } catch (e) {
    /* nothing saved, or storage blocked — the defaults are the room as built */
  }
}

function saveView() {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify({ fill: state.ui.fill, depth: state.ui.depth, showPaths: state.ui.showPaths, showStations: state.ui.showStations, showCostumes: state.ui.showCostumes === true, planTilt: state.ui.planTilt || 0 }));
  } catch (e) {
    /* storage blocked — the view still works for this session */
  }
}

// The buttons and the body classes are painted from the same two values, so the
// label on a button always says what pressing it will do next.
function paintView() {
  // A run-through keeps the filled view too: watching from the house is the reason
  // the elevation can fill at all, so the fill is not the editor's private luxury.
  const filling = state.ui.fill;
  document.body.classList.toggle('fill-plan', filling === 'plan');
  document.body.classList.toggle('fill-elev', filling === 'elevation');
  document.body.classList.toggle('fill-house', filling === 'house');
  $('house-wrap').hidden = filling !== 'house';
  $('btnHouse').setAttribute('aria-pressed', String(filling === 'house'));
  for (const [id, which] of [['btnFillPlan', 'plan'], ['btnFillElev', 'elevation']]) {
    const b = $(id);
    if (!b) continue;
    const on = filling === which;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.textContent = on ? '⛶ Both' : which === 'plan' ? 'Top-down' : '⛶ Fill';
  }
  for (const [id, key] of [['btnPaths', 'showPaths'], ['btnStations', 'showStations']]) {
    const on = state.ui[key] !== false;
    $(id).classList.toggle('on', on);
    $(id).setAttribute('aria-pressed', String(on));
  }
  $('btnCostumes').classList.toggle('on', state.ui.showCostumes === true);
  $('btnCostumes').setAttribute('aria-pressed', String(state.ui.showCostumes === true));
  $('btnTilt').classList.toggle('on', !!state.ui.tiltMode);
  $('btnTilt').setAttribute('aria-pressed', String(!!state.ui.tiltMode));
  $('stage').style.cursor = state.ui.tiltMode ? 'ns-resize' : '';
  const depth = $('btnDepth');
  if (depth) {
    depth.classList.toggle('on', state.ui.depth !== false);
    depth.setAttribute('aria-pressed', state.ui.depth === false ? 'false' : 'true');
  }
}

// Filling is not watching: one view takes the centre and the other stands down, so
// the plan can be worked on at twice the size and put back with the same click.
// Only one can be full, because the point of filling is having the room to yourself.
function setFill(which) {
  if (recorder?.recording && recorder.mode === 'house' && (which !== 'house' || state.ui.fill === 'house')) {
    recorder.stop();
  }
  state.ui.fill = state.ui.fill === which ? null : which;
  paintView();
  saveView();
  // The row heights are the fit's business, so it has to be told the layout moved.
  fitKey = '';
  fitViews();
  render();
}

// The record control shows what is being taken and for how long; a failed start says why
// for a few seconds, then gets out of the way.
let recStatusTimer = 0;
function paintRecorder(s) {
  const btn = $('btnCaptureRec');
  const status = $('recStatus');
  const label = $('captureMode');
  label.disabled = s.recording || s.starting === true;
  btn.disabled = s.starting === true;
  btn.classList.toggle('on', s.recording);
  btn.textContent = s.starting ? 'Starting…' : s.recording ? '■ Stop' : '● Record';
  clearTimeout(recStatusTimer);
  status.hidden = !s.recording && !s.starting;
  status.removeAttribute('role');
  if (s.starting) status.textContent = `Starting ${CAPTURE_MODES[s.mode].label}…`;
  if (s.recording) {
    const clock = `${String(Math.floor(s.seconds / 60)).padStart(2, '0')}:${String(s.seconds % 60).padStart(2, '0')}`;
    status.textContent = `${CAPTURE_MODES[s.mode].label} · ${clock}`;
  }
}
function flashRecStatus(message) {
  const status = $('recStatus');
  status.hidden = false;
  status.setAttribute('role', 'status');
  status.textContent = message;
  clearTimeout(recStatusTimer);
  recStatusTimer = setTimeout(() => { status.hidden = true; }, 6000);
}

function setDepth(on) {
  state.ui.depth = !!on;
  paintView();
  saveView();
  app.elevation.draw();
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  } else if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

function addKeyAtPlayhead() {
  const d = findObject(state.show, state.ui.selectedId);
  if (!d) {
    state.ui.hint = 'Select a dancer or prop first';
    return;
  }
  if (d.carriedBy) {
    state.ui.hint = 'That prop is carried — detach it before adding stations';
    return;
  }
  commit();
  const lt = contentOfLocal(state.show, d.id, state.ui.playhead);
  const p = (isProp(d)
    ? propPosOfContent(state.show, d, state.ui.playhead)
    : posOfContent(state.show, d, state.ui.playhead)) || { x: 0, y: 2 };
  const existing = d.keys.find((k) => Math.abs(k.t - lt) < 60);
  if (existing) return;
  d.keys.push({ t: Math.round(lt), x: p.x, y: p.y });
  d.keys.sort((a, b) => a.t - b.t);
  app.rebuild();
}

function addHold() {
  // A hold belongs to a row you can see. The old fallback to a "curtain" track
  // invented one that had no piece behind it, which then showed up in the track
  // list as an empty row.
  const trackId = state.ui.selectedTrack;
  if (!trackId) {
    state.ui.hint = 'Pick the track to hold first: a dancer row, or the music';
    return;
  }
  if (state.show.scenery.some((s) => s.id === trackId)) {
    state.ui.hint = 'That row is scenery: give it a cue rather than a hold';
    return;
  }
  const held = findObject(state.show, trackId);
  if (held && held.carriedBy) {
    // A carried prop borrows its dancer's clock, so its own hold would do nothing.
    state.ui.hint = 'Hold the dancer who carries that prop, not the prop itself';
    return;
  }
  commit();
  state.show.markers.push({
    id: uid('m'),
    kind: 'hold',
    trackId,
    t: Math.round(state.ui.playhead),
    duration: Math.round(state.show.prefs.holdDur),
  });
  app.rebuild();
}

function addPause() {
  commit();
  state.show.markers.push({
    id: uid('m'),
    kind: 'pause',
    t: Math.round(state.ui.playhead),
    duration: Math.round(state.show.prefs.pauseDur),
  });
  app.rebuild();
}

// The end of the show, put where the playhead is: a pause is a hole in the clock,
// this is where the clock stops. There is only ever one, so pressing it again
// moves the end rather than adding a second opinion.
function addEnd() {
  commit();
  const marker = setEnd(state.show, state.ui.playhead);
  state.ui.hint =
    'The show ends at ' + fmtTime(displayOfContent(state.show, marker.t)) + ' \u2014 drag the line to move it';
  app.rebuild();
}

function updateTransport() {
  const clock = fmtTime(state.ui.playhead);
  $('timeDisplay').textContent = clock;
  // The watch bar is the same transport with everything else taken away.
  const wt = $('wTime');
  if (wt) wt.textContent = clock;
  const wp = $('wPlay');
  if (wp) wp.textContent = state.ui.playing ? '❚❚' : '▶';

  // Whichever act the playhead is in is the lit tab, so playing through a
  // boundary changes act on the stage as well as on the clock.
  const act = actAt(state.show, state.ui.playhead);
  const tabs = $('actTabs');
  if (tabs) {
    for (const tab of tabs.querySelectorAll('.act-tab[data-id]')) {
      tab.classList.toggle('on', !!act && tab.dataset.id === act.id);
    }
  }
  // Inside an act, the scene the playhead stands in is lit too.
  const scene = sceneAt(state.show, state.ui.playhead);
  const sceneTabs = $('sceneTabs');
  if (sceneTabs) {
    for (const chip of sceneTabs.querySelectorAll('.scene-tab[data-id]')) {
      chip.classList.toggle('on', !!scene && chip.dataset.id === scene.id);
    }
  }
  $('btnPlay').textContent = state.ui.playing ? '❚❚' : '▶';
  const bp = $('btnPath');
  if (bp) {
    bp.classList.toggle('on', !!state.ui.placingStations);
    bp.textContent = state.ui.placingStations ? '◉ Placing' : '+ Stations';
  }
  // The cue buttons name the moment they will use, which is wherever the playhead
  // is now, so they are rewritten with the clock rather than on a rebuild.
  const addLabel = cueAddLabel();
  for (const el of document.querySelectorAll('[data-cue-add]')) {
    if (el.textContent !== addLabel) el.textContent = addLabel;
  }

  // Cloth state follows the playhead, so the "now" rows are written every frame
  // rather than waiting for a panel rebuild.
  for (const el of document.querySelectorAll('[data-live]')) {
    const item = state.show.scenery.find((s) => s.id === el.dataset.live);
    if (!item) continue;
    const txt = liveLabel(item);
    if (el.textContent !== txt) el.textContent = txt;
  }

  // The track's level follows the fades, every frame, from the same function the
  // rows and the panel read: scrubbing back into a fade brings the music back
  // with it instead of leaving the gain wherever playback last put it.
  const sounding = activeMusicAt(state.show, state.ui.playhead);
  // The eye on a track's row is that track's mute, applied as the show reaches it.
  music.setMuted(sounding ? sounding.visible === false : false);
  // Including the show's own ending: the last seconds before an end marker are a
  // ramp to nothing, so the clock stops after a fade rather than on a cut.
  music.setLevel(sounding ? audibleLevel(state.show, sounding, state.ui.playhead) : 0);
  // A lantern's brightness follows its cues without a panel rebuild, the way a
  // curtain's position does.
  for (const el of document.querySelectorAll('[data-light-live]')) {
    const l = (state.show.lights || []).find((x) => x.id === el.dataset.lightLive);
    if (!l) continue;
    const txt = l.visible === false ? 'hidden' : Math.round(lightLevelAt(l, state.ui.playhead) * 100) + '%';
    if (el.textContent !== txt) el.textContent = txt;
  }
  for (const el of document.querySelectorAll('[data-music-live]')) {
    const t = (state.show.musicTracks || []).find((x) => x.id === el.dataset.musicLive);
    if (!t) continue;
    const txt = fadeLive(t);
    if (el.textContent !== txt) el.textContent = txt;
  }
  // The same for the voice: a line is "speaking" only while the playhead is
  // inside it, which is a thing the row can say without being rebuilt.
  for (const el of document.querySelectorAll('[data-voice-live]')) {
    const c = (state.show.narration || []).find((x) => x.id === el.dataset.voiceLive);
    if (!c) continue;
    const txt = voiceLive(c);
    if (el.textContent !== txt) el.textContent = txt;
  }
  // While the microphone is open the record button is also its clock.
  if (narration.recording) {
    const rec = $('btnRecord');
    const txt = '\u25a0 Stop \u00b7 ' + (narration.elapsedRecording() / 1000).toFixed(1) + ' s';
    if (rec && rec.textContent !== txt) rec.textContent = txt;
  }

  // Refusals explain themselves where the eye already is, over the stage.
  const sh = $('stageHint');
  if (sh) {
    const text = state.ui.fill === 'plan' && state.ui.tiltMode
      ? 'Tilt view: drag down to angle the stage, up for overhead (0–55°) · toggle Tilt view off to edit'
      : state.ui.hint || (coachMark ? STAGE_HINT : '');
    if (sh.textContent !== text) sh.textContent = text;
    sh.hidden = !text;
  }

  const msg = $('collisionMsg');
  if (state.ui.collision) {
    msg.textContent = 'Overlap at ' + fmtTime(state.ui.collision.t) + ' — dancers ' + state.ui.collision.ids.join(' & ');
  } else {
    msg.textContent = '';
  }
  $('saved').textContent = state.ui.playing ? 'playing' : 'saved';
}

/* ------------------------------------------------------------------ render */

/* ------------------------------------------------------------------- layout */

// One metre has to be the same size in both stage views, or the two are pictures of
// different rooms. The plan is 12 m of floor plus 4 m of wing on each side; the
// elevation is the same 12 m opening. So one scale is chosen for the pair and both
// rows are sized from it, which makes the curtain legs at full open line up with the
// floor edges above them. Sized from the container rather than measured back from the
// panes, so there is no loop: the rows follow the scale, not the other way round.
let fitKey = '';
function fitViews() {
  const center = $('center');
  if (!center) return;
  // A run-through keeps its own proportions — the elevation gets the height there, to
  // show flying — and no inline rows to fight it.
  if (state.ui.watch) {
    if (center.style.gridTemplateRows) {
      center.style.gridTemplateRows = '';
      state.ui.viewScale = null;
      fitKey = '';
    }
    return;
  }
  const st = state.show.stage;
  const tabsH = $('actTabs').offsetHeight;
  const scenesH = $('sceneTabs').offsetHeight;
  const key = [
    center.clientWidth, center.clientHeight, tabsH, scenesH,
    st.width, st.depth, st.wingDepth, st.openingH,
    state.ui.fill || 'both',
  ].join('|');
  if (key === fitKey) return;
  fitKey = key;

  // One view filling the centre has nothing to share a metre with, so it fits
  // itself at whatever size the pane allows. The other wrap is out of the grid
  // (a body class), which leaves three rows rather than four.
  if (['plan', 'elevation', 'house'].includes(state.ui.fill)) {
    state.ui.viewScale = null;
    center.style.gridTemplateRows = `${tabsH}px ${scenesH}px minmax(0, 1fr)`;
    return;
  }

  const avail = center.clientHeight - tabsH - scenesH;
  const w = center.clientWidth;
  // The margins each view keeps around its drawing: the plan 34 px a side, the
  // elevation 54 across and 32 up and down.
  const PLAN_PAD = 68;
  const ELEV_PAD = 32;
  const worldW = st.width + st.wingDepth * 2;
  const scale = Math.max(
    4,
    Math.min((w - PLAN_PAD) / worldW, (avail - PLAN_PAD - ELEV_PAD) / (st.depth + st.openingH))
  );
  const stageH = Math.max(80, Math.round(st.depth * scale + PLAN_PAD));
  state.ui.viewScale = scale;
  center.style.gridTemplateRows = `${tabsH}px ${scenesH}px ${stageH}px minmax(0, 1fr)`;
}

/* ------------------------------------------------------- school conventions */

const STATUS_LABEL = { provisional: 'Provisional', 'school-approved': 'School-approved', unset: 'Unset' };
const SCHOOL_DATE = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// One row per convention. The school's entry is applied on change; clearing it returns the row to
// the default. A row the solver does not read yet says so, rather than looking like it works.
function openSchool() {
  paintSchool();
  $('schoolSheet').hidden = false;
  $('btnSchoolClose').focus();
}

function closeSchool() {
  $('schoolSheet').hidden = true;
}

function paintSchool() {
  const body = $('schoolBody');
  body.replaceChildren();
  const summary = previewSummary();
  const diagnosticBanner = document.createElement('p');
  diagnosticBanner.className = 'school-banner';
  diagnosticBanner.textContent = 'Balance settings below are provisional diagnostic assumptions only, not school-approved and never used for pass/fail, pose geometry, or contact checks. Chassé phase supports remain fixed by CHASSE_PHASES.';
  body.appendChild(diagnosticBanner);
  const banner = document.createElement('p');
  banner.className = 'school-banner';
  banner.textContent = `Preview is running on ${summary.provisionalInUse.length} provisional value${summary.provisionalInUse.length === 1 ? '' : 's'} and ${summary.approvedInUse.length} school-approved. Results built on provisional values are not school-correct until the school reviews them.`;
  body.appendChild(banner);
  const shortfall = specOf('fourth').spacingShortfall || 0;
  if (shortfall > 0) {
    const reach = document.createElement('p');
    reach.className = 'school-banner school-reach';
    reach.textContent = `Fourth-position spacing is out of reach: the drawing stands at the nearest gap the legs can make, ${shortfall.toFixed(3)} body heights short of the entered value.`;
    body.appendChild(reach);
  }

  const approverRow = document.createElement('div');
  approverRow.className = 'school-approver';
  const approverLabel = document.createElement('label');
  approverLabel.textContent = 'Approver name ';
  const approver = document.createElement('input');
  approver.type = 'text';
  approver.maxLength = 80;
  approver.value = getApprover();
  approver.placeholder = 'Teacher or school name';
  approver.setAttribute('aria-label', 'Approver name');
  approver.addEventListener('change', () => setApprover(approver.value));
  approverLabel.appendChild(approver);
  approverRow.appendChild(approverLabel);
  body.appendChild(approverRow);

  const table = document.createElement('table');
  table.className = 'school-table';
  const head = table.createTHead().insertRow();
  for (const label of ['Position', 'School method', 'Default', 'School value', 'Status', 'Approval']) {
    const th = document.createElement('th');
    th.textContent = label;
    head.appendChild(th);
  }
  const tbody = table.createTBody();
  for (const row of conventionRows()) {
    const tr = tbody.insertRow();
    tr.className = row.status === 'school-approved' ? 'school-row approved' : row.source === 'school' ? 'school-row set' : 'school-row';
    const name = tr.insertCell();
    const title = document.createElement('strong');
    title.textContent = row.label;
    const ref = document.createElement('small');
    ref.textContent = `${row.unit} · ${row.measurement_reference}`;
    name.append(title, document.createElement('br'), ref);

    const method = tr.insertCell();
    method.className = 'school-note';
    method.textContent = row.school_method;

    const def = tr.insertCell();
    def.className = 'school-default';
    def.textContent = row.defaultValue === null ? 'unset' : String(row.defaultValue);
    const cell = tr.insertCell();
    const isChoice = row.kind === 'note' && row.choices;
    const input = isChoice ? document.createElement('select') : document.createElement('input');
    input.setAttribute('aria-label', `${row.diagnosticOnly ? 'Provisional diagnostic setting' : 'School value'}: ${row.label}`);

    if (isChoice) {
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = `Default (${row.defaultValue})`;
      input.appendChild(defaultOption);
      for (const choice of row.choices) {
        const option = document.createElement('option');
        option.value = choice;
        option.textContent = choice;
        input.appendChild(option);
      }
      input.value = row.source === 'school' ? String(row.value) : '';
      const msg = document.createElement('div');
      msg.className = 'school-msg';
      input.addEventListener('change', () => {
        if (!input.value) resetConvention(row.id);
        else {
          const result = setConvention(row.id, input.value);
          if (!result.ok) { msg.textContent = result.reason; return; }
        }
        setTimeout(afterSchoolChange, 0);
      });
      cell.append(input, msg);
    } else if (row.kind !== 'note') {
      input.type = 'number';
      input.step = row.kind === 'rise' ? '0.005' : 'any';
      input.min = String(row.min);
      input.max = String(row.max);
      input.placeholder = row.defaultValue === null ? 'unset' : String(row.defaultValue);
      input.value = row.source === 'school' ? String(row.value) : '';
      if (row.diagnosticOnly) input.title = 'Provisional diagnostic-only setting; not school-approved; does not change pose geometry or contact checks.';
      const msg = document.createElement('div');
      msg.className = 'school-msg';
      input.addEventListener('change', () => {
        const text = input.value.trim();
        if (text === '') {
          resetConvention(row.id);
          msg.textContent = '';
          setTimeout(afterSchoolChange, 0);
          return;
        }
        const result = setConvention(row.id, text);
        if (!result.ok) {
          msg.textContent = result.reason;
          input.focus();
          return;
        }
        setTimeout(afterSchoolChange, 0);
      });
      cell.append(input, msg);
    } else {
      input.type = 'text';
      input.maxLength = 500;
      input.placeholder = String(row.defaultValue);
      input.value = row.source === 'school' ? row.value : '';
      const msg = document.createElement('div');
      msg.className = 'school-msg';
      input.addEventListener('change', () => {
        const text = input.value.trim();
        if (text === '') {
          resetConvention(row.id);
          msg.textContent = '';
          setTimeout(afterSchoolChange, 0);
          return;
        }
        const result = setConvention(row.id, text);
        if (!result.ok) {
          msg.textContent = result.reason;
          input.focus();
          return;
        }
        setTimeout(afterSchoolChange, 0);
      });
      cell.append(input, msg);
    }

    const status = tr.insertCell();
    status.className = 'school-status';
    const badge = document.createElement('span');
    badge.className = `school-badge ${row.status}`;
    badge.textContent = STATUS_LABEL[row.status] || row.status;
    const applied = document.createElement('small');
    applied.textContent = row.diagnosticOnly ? ' · diagnostic only; not read by pose/solver' : row.applied ? ' · read by the pose' : ' · not read by the solver';
    status.append(badge, applied);
    if (row.source === 'school') {
      const reset = document.createElement('button');
      reset.className = 'ghost';
      reset.textContent = 'Reset';
      reset.addEventListener('click', () => {
        resetConvention(row.id);
        afterSchoolChange();
      });
      status.append(document.createElement('br'), reset);
    }

    const approval = tr.insertCell();
    approval.className = 'school-approval';
    if (row.diagnosticOnly) {
      const note = document.createElement('small');
      note.textContent = 'Diagnostic-only; not eligible for school approval';
      approval.appendChild(note);
    } else if (row.status === 'school-approved' && row.approval) {
      const when = new Date(row.approval.at);
      const text = document.createElement('small');
      text.textContent = `Approved by ${row.approval.by} · ${SCHOOL_DATE.format(when)}`;
      approval.appendChild(text);
      const revoke = document.createElement('button');
      revoke.className = 'ghost';
      revoke.textContent = 'Revoke';
      revoke.addEventListener('click', () => {
        revokeApproval(row.id);
        afterSchoolChange();
      });
      approval.append(document.createElement('br'), revoke);
    } else {
      if (row.approvalWithdrawn) {
        const note = document.createElement('small');
        note.className = 'school-withdrawn';
        note.textContent = 'Approval withdrawn: value changed';
        approval.append(note, document.createElement('br'));
      }
      const approve = document.createElement('button');
      approve.className = 'ghost';
      approve.textContent = 'Approve';
      approve.disabled = row.status === 'unset';
      const reason = document.createElement('small');
      reason.className = 'school-msg';
      approve.addEventListener('click', () => {
        setApprover(approver.value);
        const result = approveConvention(row.id);
        if (!result.ok) {
          reason.textContent = result.reason;
          return;
        }
        afterSchoolChange();
      });
      approval.append(approve, reason);
    }
  }
  body.appendChild(table);
}

function afterSchoolChange() {
  paintSchool();
  render();
}

function render() {

  // The stage pane belongs to the act the playhead is in, so scrubbing across a
  // boundary puts that act's arrangement back.
  syncFoldsToAct();
  if (state.ui.dirtyPanels) {
    rebuildPanels();
    state.ui.dirtyPanels = false;
    // The sheet's phrase caption is a promise about where the next phrase lands, so it
    // follows the path while the sheet is open: an undone or deleted phrase must not leave
    // a stale address behind.
    if (moves && moves.isOpen) moves.phraseWhere(app.phraseLead());
  }
  // Hidden editor canvases have no layout in House view; do not let their
  // zero-sized drawing interrupt the audience preview.
  if (state.ui.fill !== 'house') {
    app.stage.draw();
    app.elevation.draw();
  }
  const projection = projectionAt(state.show, state.ui.playhead);
  const videoClips = projection.kind === 'video' ? [projection.clip] : [];
  video.sync(videoClips, state.ui.playhead, state.ui.playing && !state.ui.activePause);
  const layers = slideLayersAt(state.show, state.ui.playhead);
  slides.sync(state.show.images, layers);
  const screens = state.show.scenery.filter((s) => s.screen);
  const downScreen = screens.find((s) => sceneryStateAt(s, state.ui.playhead).fly > 0.05);
  const currentImage = state.show.images.find((im) => im.id === projection.imageId);
  let projectionMessage = !screens.length ? 'No projection screen added' : !downScreen ? 'Screen is flown out at this time' : projection.kind === 'off' && !layers.length ? 'Projector off · no active image cue' : projection.kind === 'video' ? 'Video cue is active' : !currentImage && projection.kind === 'slide' ? 'Slide cue refers to a missing gallery image' : currentImage && slides.status.get(currentImage.key) === false ? 'Image file missing in this browser' : layers.length ? 'Projecting ' + (currentImage?.name || 'slide transition') : 'Crossfade starting · advance the playhead';
  if (downScreen) {
    const covered = state.show.scenery.find((s) => s.id !== downScreen.id && s.kind !== 'prop' && clothDepth(s) <= clothDepth(downScreen) && (s.kind === 'drop' ? sceneryStateAt(s, state.ui.playhead).fly > 0.95 : s.kind === 'curtain' ? sceneryStateAt(s, state.ui.playhead).open < 0.05 : false));
    if (covered) projectionMessage += ' · Screen may be covered by ' + covered.name;
  }
  $('projectionStatus').textContent = projectionMessage + (state.ui.fill !== 'house' ? ' · Open House view to see projection' : '');
  if (state.ui.fill === 'house') {
    const wrap = $('house-wrap');
    if (app.house.width !== wrap.clientWidth || app.house.height !== wrap.clientHeight) app.house.resize(wrap.clientWidth, wrap.clientHeight);
    const picture = projection.kind === 'video' ? video.activeElement(videoClips, state.ui.playhead) : slides.frame(state.show.images, layers);
    app.house.draw(state.show, state.ui.playhead, picture);
    $('houseStatus').textContent = 'HOUSE · ' + projectionMessage;
  }
  app.timeline.draw();
  app.company.draw();
  syncTimeScroll();
  updateTransport();
}

// The slider is a view of `scrollT`, not a second copy of it: wheel, zoom and the playhead
// following playback all move the window, and the bar is brought into line every frame.
function timeScrollView() {
  const width = $('timeline').clientWidth - GUTTER;
  return Math.max(1, width / Math.max(1, state.ui.pxPerSec));
}

function syncTimeScroll() {
  const bar = $('timeScroll');
  if (!bar) return;
  const range = timelineScrollRange(state.show, timeScrollView(), state.ui.scrollT);
  const max = range.max.toFixed(2);
  if (bar.max !== max) bar.max = max;
  // Writing value while the thumb is held would fight the hand moving it.
  if (document.activeElement !== bar || !bar.matches(':active')) {
    const v = String(Math.round(state.ui.scrollT * 100) / 100);
    if (bar.value !== v) bar.value = v;
  }
  bar.disabled = range.max <= 0.01;
  const from = state.ui.scrollT * 1000;
  const label = `${fmtClock(from)}–${fmtClock(from + range.view * 1000)} of ${fmtClock(range.endSec * 1000)}`;
  const el = $('timeScrollLabel');
  if (el.textContent !== label) el.textContent = label;
}

function fmtClock(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

let lastFrame = 0;
function frame(now) {
  // `elapsed` is what really passed; `wallDt` is the clamped step the wall clock
  // is allowed to move in one frame. A slow frame has to be told apart from a
  // moved playhead, so the unclamped number is kept.
  const elapsed = lastFrame ? now - lastFrame : 16;
  const wallDt = Math.min(80, elapsed);
  lastFrame = now;
  // Before anything is drawn: both stage views share one scale this frame.
  fitViews();
  // Music follows the playhead whichever way it moves: `sync` picks the track that
  // covers this moment, starts it, and stops it when the show stops. Running it
  // every frame is what makes a list of tracks behave like one running order.
  const sounding = activeMusicAt(state.show, state.ui.playhead);
  music.sync(sounding, state.ui.playhead, state.ui.playing);
  // Narration follows the same clock and stops for the same reasons: not playing,
  // silent on its row, or held on a pause marker — a break in the show is a
  // break in the voice too.
  narration.sync(
    state.show,
    state.ui.playhead,
    state.ui.playing && !state.ui.activePause,
    state.show.trackVis.narration === false
  );
  if (state.ui.playing) {
    // Whatever stopped the track (a pause marker the playhead was dragged out
    // of, a collision stop that was then resumed), a running show gets its music
    // back at the moment it is actually at.
    if (!music.running) music.play(state.ui.playhead, sounding);
    let dt = wallDt;
    // While the show runs, the audio context says what time it is. A playhead
    // moved by hand (a scrub, an act jump) is re-anchored rather than dragged
    // back; during a pause the clock is the wall, because the music has stopped.
    if (!state.ui.activePause) {
      const t = music.now();
      if (t != null) {
        const drift = t - state.ui.playhead;
        // If the drift is exactly the time that has passed, the clock simply ran
        // on while this frame was late (a hidden or busy tab) — catch up with it.
        // If it is anything else, the playhead was moved by hand and the running
        // track has to be re-anchored to where it now is.
        const stalled = Math.abs(drift - elapsed) < 150;
        if (Math.abs(drift) > 400 && !stalled) {
          music.seek(state.ui.playhead);
          dt = 0;
        } else {
          dt = Math.max(0, Math.min(2000, drift));
        }
      }
    }
    advance(dt);
  }
  render();
  requestAnimationFrame(frame);
}

/* -------------------------------------------------------------------- boot */

function boot() {
  state.show = restore() || demoShow();
  // Write the running order out once, so a show from before acts keeps stable
  // act ids instead of being given new ones on every load.
  persist();
  // The room as it was left: which view was filling the centre, and whether the
  // elevation draws depth. Read before the first fit, so the first frame is right.
  loadView();
  try {
    const savedSel = localStorage.getItem(SEL_KEY);
    // Focus never rests on a hidden performer, so only restore a visible pick.
    if (savedSel && state.show.cast.some((d) => d.id === savedSel && d.visible)) state.ui.selectedId = savedSel;
  } catch (e) {
    /* storage blocked - not fatal */
  }

  // Audio is stored separately from the show, so it is checked after the first
  // paint rather than blocking it: a track's row says whether its file is here.
  music.probe(state.show.musicTracks).then(() => {
    state.ui.dirtyPanels = true;
  });
  narration.probe(state.show.narration).then(() => {
    state.ui.dirtyPanels = true;
  });
  const first = activeMusicAt(state.show, state.ui.playhead);
  if (first) music.load(first).then(() => { state.ui.dirtyPanels = true; });

  app.stage = new StageView($('stage'), app, {});
  // The coach mark retires the first time the stage is touched, or after a while on a
  // page nobody has clicked yet — either way it is not there to cover the front of the
  // stage while a card is on.
  $('stage').addEventListener('pointerdown', () => { coachMark = false; }, { once: true });
  setTimeout(() => { coachMark = false; }, 20000);
  app.elevation = new ElevationView($('elevation'), app);
  app.house = new HouseView($('house'));
  video.probe(state.show.videos).then(() => { state.ui.dirtyPanels = true; });
  app.timeline = new Timeline($('timeline'), app);
    app.company = new CompanyLine($('companyLine'));

  slides.probe(state.show.images).then(() => { state.ui.dirtyPanels = true; });
  $('btnSlides').addEventListener('click', () => $('fileSlides').click());
  $('fileSlides').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    const targetShow = state.show;
    $('slideStatus').textContent = 'Loading gallery images…';
    const loaded = [], errors = [];
    for (const file of files) {
      try { loaded.push(await slides.attachFile(file)); }
      catch (error) { errors.push(file.name + ': ' + error.message); }
    }
    if (state.show !== targetShow) return;
    if (loaded.length) {
      commit();
      for (const media of loaded) state.ui.slideImageId = addImage(state.show, media).id;
      app.timeline.revealTrack('slides');
      app.rebuild();
    }
    $('slideStatus').textContent = `${loaded.length} image${loaded.length === 1 ? '' : 's'} loaded` + (errors.length ? ' · ' + errors.join('; ') : ' · choose an image, then add its cue.');
  });
  $('slideGallery').addEventListener('click', (e) => {
    const button = e.target.closest('[data-image]');
    if (!button) return;
    state.ui.slideImageId = button.dataset.image;
    renderSlides();
  });
  $('slideChoice').addEventListener('change', (e) => { state.ui.slideImageId = e.target.value; renderSlides(); });
  $('btnSlideCue').addEventListener('click', () => app.addSlideCueAt(state.ui.playhead));
  $('btnSlideOff').addEventListener('click', () => {
    commit();
    state.ui.slideCueId = addSlideCue(state.show, state.ui.playhead, null, slideFade()).id;
    app.timeline.revealTrack('slides');
    app.rebuild();
  });
  $('slideCueList').addEventListener('change', (e) => {
    const cue = state.show.slideCues.find((c) => c.id === e.target.closest('[data-slide-cue]')?.dataset.slideCue);
    const f = e.target.dataset.sf;
    if (!cue || !f) return;
    const n = Number(e.target.value);
    if (f !== 'imageId' && !Number.isFinite(n)) return;
    commit();
    if (f === 'imageId') cue.imageId = e.target.value || null;
    if (f === 'at') cue.at = Math.max(0, Math.round(n * 1000));
    if (f === 'fade') cue.fade = Math.max(0, Math.min(120000, Math.round(n * 1000)));
    app.rebuild();
  });
  $('slideCueList').addEventListener('click', (e) => {
    const cue = state.show.slideCues.find((c) => c.id === e.target.closest('[data-slide-cue]')?.dataset.slideCue);
    const action = e.target.closest('[data-sa]')?.dataset.sa;
    if (!cue || !action) return;
    if (action === 'seek') state.ui.playhead = cue.at;
    if (action === 'remove') { commit(); removeSlideCue(state.show, cue.id); app.rebuild(); }
  });

  // Projector files and cues stay separate from the screen's fly cues.
  $('btnHouse').addEventListener('click', () => setFill('house'));
  $('btnHouseBack').addEventListener('click', () => setFill('house'));
  $('btnAddScreen').disabled = false;
  $('screenStatus').textContent = 'Screen controls ready · add a screen to reveal its settings and timeline row.';
  $('btnAddScreen').addEventListener('click', () => {
    try {
      commit();
      const screen = addScenery(state.show, 'drop');
      screen.screen = true;
      screen.name = 'Projection screen';
      screen.color = '#eeeeea';
      screen.fly = 0;
      app.select(screen.id);
      app.timeline.revealTrack(screen.id);
      app.rebuild();
      // Update controls immediately, even if a previous drawing error stopped animation.
      rebuildPanels();
      app.timeline.draw();
      $('screenStatus').textContent = 'Projection screen added · settings below · timeline row selected.';
      const item = Array.from($('sceneryList').children).find((el) => el.dataset.id === screen.id);
      item?.scrollIntoView({ block: 'nearest' });
    } catch (error) {
      $('screenStatus').textContent = 'Screen controls error: ' + error.message;
    }
  });
  $('btnVideo').addEventListener('click', () => {
    pendingVideoAt = state.ui.playhead;
    pendingVideoId = null;
    $('fileVideo').click();
  });
  $('fileVideo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const targetShow = state.show, at = pendingVideoAt, replaceId = pendingVideoId;
    state.ui.hint = 'Storing video…';
    try {
      const media = await video.attachFile(file);
      if (state.show !== targetShow) return;
      const existing = targetShow.videos.find((c) => c.id === replaceId);
      commit();
      if (existing) {
        const sourceIn = existing.trimIn, sourceOut = existing.trimOut;
        Object.assign(existing, media);
        existing.trimIn = Math.min(sourceIn, Math.max(0, media.length - 100));
        existing.trimOut = Math.max(existing.trimIn, Math.min(media.length, sourceOut));
      } else addVideo(targetShow, media, at);
      state.ui.hint = 'Video attached · cue the screen separately, then open House view';
      app.rebuild();
    } catch (error) {
      state.ui.hint = 'Video could not be loaded: ' + error.message;
      state.ui.dirtyPanels = true;
    }
  });
  $('videoRow').addEventListener('change', (e) => {
    const row = e.target.closest('[data-video]');
    const clip = row && state.show.videos.find((c) => c.id === row.dataset.video);
    const field = e.target.dataset.v;
    if (!clip || !field) return;
    const n = Number(e.target.value);
    if (field !== 'name' && field !== 'muted' && !Number.isFinite(n)) return;
    commit();
    if (field === 'name') clip.name = e.target.value.trim() || 'Video';
    if (field === 'muted') clip.muted = e.target.checked;
    if (field === 'at') clip.at = Math.max(0, Math.round(n * 1000));
    if (field === 'level') clip.level = Math.max(0, Math.min(1, n));
    if (field === 'trimIn') clip.trimIn = Math.max(0, Math.min(clip.trimOut - Math.min(100, clip.length), Math.round(n * 1000)));
    if (field === 'trimOut') clip.trimOut = Math.max(clip.trimIn + Math.min(100, clip.length), Math.min(clip.length, Math.round(n * 1000)));
    app.rebuild();
  });
  $('videoRow').addEventListener('click', (e) => {
    const row = e.target.closest('[data-video]');
    const clip = row && state.show.videos.find((c) => c.id === row.dataset.video);
    const action = e.target.closest('[data-va]')?.dataset.va;
    if (!clip || !action) return;
    if (action === 'replace') {
      pendingVideoId = clip.id;
      pendingVideoAt = clip.at;
      $('fileVideo').click();
      return;
    }
    if (action === 'seek') { state.ui.playhead = clip.at; return; }
    if (action === 'remove') { commit(); removeVideo(state.show, clip.id); }
    if (action === 'end') {
      const span = state.ui.playhead - clip.at;
      if (span <= 0) { state.ui.hint = 'Put the playhead after the video start to set its end'; return; }
      commit();
      clip.trimOut = Math.min(clip.length, clip.trimIn + span);
    }
    app.rebuild();
  });

  // header
  $('showName').addEventListener('input', (e) => {
    state.show.name = e.target.value;
    persist();
  });
  $('btnUndo').addEventListener('click', () => { state.ui.stationIdx = null; undo(); app.rebuild(); });
  $('btnRedo').addEventListener('click', () => { state.ui.stationIdx = null; redo(); app.rebuild(); });
  /* --------------------------------------------------- save · reload · clear */

  // The file a show is called: its own name, made safe to write to disk.
  const showFileName = () =>
    (state.show.name || 'show').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json';

  // Save writes the browser copy first — that is what this app reopens next time, and
  // what the print page reads — and then a file of the user's choosing, so a show can
  // live on a stick as well as in the tab. Where the browser offers a save dialog the
  // file goes exactly where it is asked to go; where it does not, it downloads as it
  // always has. Either way the hint says which, and how many bytes.
  $('btnSave').addEventListener('click', async () => {
    persist();
    const json = JSON.stringify(state.show, null, 2);
    const name = showFileName();
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: 'Choreographer show', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        state.ui.hint = `Saved ${handle.name} · ${json.length} bytes · also stored in this browser`;
        return;
      } catch (err) {
        // Walking away from the dialog is a decision rather than a failure, and the
        // browser copy is already written by this point. Any other trouble falls
        // through to the download, which cannot fail.
        if (err && err.name === 'AbortError') {
          state.ui.hint = 'Save cancelled — the show is still stored in this browser';
          return;
        }
      }
    }
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    state.ui.hint = `Saved ${name} · ${json.length} bytes · also stored in this browser`;
  });
  // The print view is its own page and reads the saved show, so write the show
  // out first rather than trusting the last edit to have persisted. The link
  // itself opens the new tab; this only makes sure the file is current.
  $('btnPrint').addEventListener('click', () => persist());
  $('btnReload').addEventListener('click', () => $('fileImport').click());
  $('fileImport').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = normalise(JSON.parse(String(reader.result)));
        commit();
        music.pause();
        state.show = parsed;
        state.ui.selectedId = null;
        state.ui.stationIdx = null;
        state.ui.playhead = 0;
        // The imported show brings the cues, not the audio: check which of its
        // tracks this browser already has under those keys.
        music.probe(state.show.musicTracks).then(() => { state.ui.dirtyPanels = true; });
        // An imported show's lines may have been recorded on another machine; the
        // list has to say which ones this browser cannot play.
        narration.probe(state.show.narration).then(() => { state.ui.dirtyPanels = true; });
        video.stop();
        video.probe(state.show.videos).then(() => { state.ui.dirtyPanels = true; });
        slides.probe(state.show.images).then(() => { state.ui.dirtyPanels = true; });
        app.rebuild();
        // A silent success reads as "nothing happened" when the file was large, and a
        // silent failure is worse: say which file came in, or that none did.
        state.ui.hint = `Reloaded ${file.name} · ${state.show.cast.length} in the cast · ${String(reader.result).length} bytes`;
      } catch (err) {
        state.ui.hint = `${file.name} is not a Choreographer show — nothing was changed`;
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // The wings a dancer starts in when she is added, so a cleared company stands in the
  // same places a fresh one would rather than nowhere: a dancer with no station at all
  // has no position to draw, and every view reads her through one.
  const wingsKey = (show, number) => {
    const i = (number || 1) - 1;
    const side = (number || 1) % 2 === 0 ? 1 : -1;
    const slot = Math.floor(i / 2) % 5;
    return {
      t: 0,
      x: side * (show.stage.width / 2 + 1.0 + (slot % 2) * 0.9),
      y: 1.2 + slot * 1.25,
    };
  };

  // Clear takes the staging out and leaves every asset in place: the company keeps its
  // names, colours and numbers, the wardrobe stays, props keep where they stand, the
  // cloth and the lanterns stay hung, the music and the voice pieces stay attached, and
  // the stage, the tempo and every setting are untouched. What goes is the choreography
  // — paths, holds, pauses and the cues on cloth, lights and music — because that is the
  // show rather than the kit. It commits first, so one Ctrl+Z puts all of it back.
  const clearStage = () => {
    const show = state.show;
    commit();
    show.cast.forEach((d) => { d.keys = [wingsKey(show, d.number)]; });
    show.markers = [];
    show.slideCues = [];
    (show.scenery || []).forEach((s) => {
      if (s.kind !== 'prop' && Array.isArray(s.cues)) s.cues = [];
    });
    (show.lights || []).forEach((l) => { if (Array.isArray(l.cues)) l.cues = []; });
    (show.musicTracks || []).forEach((t) => {
      if (Array.isArray(t.cues)) t.cues = [];
      t.start = 0;
    });
    (show.videos || []).forEach((c) => { c.at = 0; });
    video.stop();
    music.pause();
    state.ui.selectedId = null;
    state.ui.stationIdx = null;
    state.ui.playhead = 0;
    state.ui.hint = 'Stage cleared · the company, props, music and settings are kept · Ctrl+Z puts the show back';
    persist();
    app.rebuild();
  };

  $('btnClear').addEventListener('click', () => {
    const show = state.show;
    const somethingToLose =
      (show.markers || []).length > 0 ||
      show.cast.some((d) => d.keys.length > 1) ||
      (show.scenery || []).some((s) => s.kind !== 'prop' && Array.isArray(s.cues) && s.cues.length) ||
      (show.lights || []).some((l) => Array.isArray(l.cues) && l.cues.length) ||
      (show.slideCues || []).length > 0 ||
      (show.videos || []).some((c) => c.at !== 0) ||
      (show.musicTracks || []).some((t) => (Array.isArray(t.cues) && t.cues.length) || t.start !== 0);
    // An empty stage has nothing to confirm, and a dialog over it would only be noise.
    if (!somethingToLose) {
      state.ui.hint = 'The stage is already clear — nothing to remove';
      return;
    }
    const ok = window.confirm(
      'Clear the stage for a new show?\n\n' +
      'KEPT: dancers and their names, costumes, props and where they stand, the cloth ' +
      'and the lanterns, music, voice pieces, video files and trims, image gallery, stage size and every setting. Video starts return to zero.\n\n' +
      'CLEARED: every path, hold and pause, slide cues, and the cues on the cloth, lights and music.\n\n' +
      'Undo (Ctrl+Z) brings it all back.'
    );
    if (!ok) return;
    clearStage();
  });

  // The show's own defaults: how long a cue gets when it is placed, before it is
  // dragged into shape. Written on change, because a setting is not a draft.
  const bindPref = (id, key, min) => {
    $(id).addEventListener('change', (e) => {
      const secs = Number(e.target.value);
      if (!Number.isFinite(secs)) return;
      commit();
      state.show.prefs[key] = Math.max(min, Math.min(120, secs)) * 1000;
      state.ui.dirtyPanels = true;
      persist();
    });
  };
  bindPref('prefCue', 'cueDur', 0);
  bindPref('prefFade', 'fadeDur', 0);
  bindPref('prefLight', 'lightDur', 0);
  bindPref('prefHold', 'holdDur', 0.1);
  bindPref('prefPause', 'pauseDur', 0.1);
  bindPref('prefEndFade', 'endFade', 0);
  // The music's clock. A count is one beat, so the field is the tempo and the measure is how
  // many counts a bar holds; phrases are counted against both.
  const bindTempo = (id, key, min, max) => {
    $(id).addEventListener('change', (e) => {
      const v = Math.round(Number(e.target.value));
      if (!Number.isFinite(v)) return;
      commit();
      state.show.prefs[key] = Math.max(min, Math.min(max, v));
      state.ui.dirtyPanels = true;
      persist();
    });
  };
  bindTempo('prefTempo', 'tempo', 20, 300);
  bindTempo('prefBeats', 'beatsPerBar', 1, 16);

  // stage settings
  const bindStage = (id, key, min, max) => {
    $(id).addEventListener('change', (e) => {
      const v = Number(e.target.value);
      if (!isFinite(v)) return;
      commit();
      state.show.stage[key] = Math.min(max ?? Infinity, Math.max(min, v));
      // A shallower stage cannot leave a wing leg hanging past the back wall.
      if (key === 'depth') {
        state.show.wingLegs.forEach((leg) => {
          leg.y = Math.min(leg.y, Math.max(0.5, state.show.stage.depth - 0.45));
        });
      }
      // Shallower staging pulls pinned cloth inside the back wall.
      if (key === 'depth') {
        state.show.scenery.forEach((s) => {
          if (s.kind === 'prop') return;
          if (s.kind === 'drop' || s.depthSet) {
            s.y = Math.min(s.y, Math.max(0.2, state.show.stage.depth - 0.2));
          }
        });
      }
      // A narrower stage cannot leave cloth wider than the opening, nor hanging off it.
      if (key === 'width') {
        state.show.scenery.forEach((s) => {
          if (s.kind !== 'curtain' && s.kind !== 'drop') return;
          s.span = Math.min(clothSpan(s), maxClothSpan(state.show.stage));
          s.x = clampClothX(s.x, s.span);
        });
      }
      app.rebuild();
    });
  };
  bindStage('stWidth', 'width', 4);
  bindStage('stDepth', 'depth', 3);
  bindStage('stWings', 'wingDepth', 1);
  bindStage('stGrid', 'grid', 0.25);
  bindStage('stOpening', 'openingH', 2.5, 20);
  bindStage('stDancerH', 'dancerH', 1, 2.4);

  // scenery buttons
  $('btnAddCurtain').addEventListener('click', () => {
    commit();
    const item = addScenery(state.show, 'curtain');
    item.layer = 'front';
    item.order = state.show.scenery.filter((s) => s.kind === 'curtain' && s.layer === 'front').length - 1;
    item.open = 0.5;
    app.rebuild();
  });
  $('btnAddDrop').addEventListener('click', () => {
    commit();
    addScenery(state.show, 'drop');
    app.rebuild();
  });
  $('btnAddCard').addEventListener('click', () => {
    commit();
    // A card is a piece of scenery, not a prop: it has a row on the clock from the
    // first moment, because bringing it on is a cue.
    const item = addScenery(state.show, 'card');
    state.ui.selectedTrack = item.id;
    app.rebuild();
  });
  $('btnAddProp').addEventListener('click', () => {
    commit();
    addScenery(state.show, 'prop');
    app.rebuild();
  });
  $('btnAddLeftLeg').addEventListener('click', () => {
    commit();
    addWingLeg(state.show, -1);
    app.rebuild();
  });
  $('btnAddRightLeg').addEventListener('click', () => {
    commit();
    addWingLeg(state.show, 1);
    app.rebuild();
  });
  $('btnAddDancer').addEventListener('click', () => {
    commit();
    const d = addCast(state.show);
    app.select(d.id);
    app.rebuild();
  });

  // music: a list of tracks. Adding, replacing, renaming, moving and removing
  // all work per row, the way the cast does, because a show changes music the
  // way it changes scenes.
  const trackById = (id) => (state.show.musicTracks || []).find((t) => t.id === id);
  $('btnMusic').addEventListener('click', () => {
    pendingMusicId = null;
    // A new track lands where the playhead is, snapped to a tenth of a second so
    // the starts field shows a number a person would type.
    pendingMusicAt = Math.round(state.ui.playhead / 100) * 100;
    $('fileMusic').click();
  });
  $('fileMusic').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const targetId = pendingMusicId;
    const at = pendingMusicAt;
    pendingMusicId = null;
    state.ui.hint = 'Reading ' + file.name + '…';
    state.ui.dirtyPanels = true;
    music
      .attach(file)
      .then((info) => {
        commit();
        const before = targetId ? trackById(targetId) : null;
        if (before) {
          // A replacement keeps the place, level and fades: only the sound changes.
          if (before.key !== info.key) dropStored(before.key);
          before.key = info.key;
          before.name = info.name;
          before.length = info.length;
          // A new file is played whole; a trim that belonged to the old audio would
          // otherwise silently cut the replacement short.
          before.play = info.length;
          state.ui.hint = null;
        } else {
          // At the playhead, which is where the change of music belongs — the
          // running order only decides it if the picker was opened at the very top.
          const t = addMusicTrack(state.show, { key: info.key, name: info.name, length: info.length, start: at });
          state.ui.selectedTrack = t.id;
          // Say where it landed: the file picker can take a while, and "at the
          // playhead" is only reassuring if the moment is named.
          // Content time, like the clock in the transport and the starts field.
          state.ui.hint = 'Added ' + t.name + ' at ' + fmtTime(t.start);
        }
        app.rebuild();
      })
      .catch(() => {
        state.ui.hint = 'That file is not audio this browser can read';
        app.rebuild();
      });
  });
  $('musicRow').addEventListener('change', (e) => {
    const host = e.target.closest('[data-track]');
    const m = host ? trackById(host.dataset.track) : null;
    if (!m) return;
    const f = e.target.dataset.f;
    if (f === 'music-name') {
      commit();
      m.name = e.target.value || 'Music';
      app.rebuild();
    } else if (f === 'music-start') {
      const secs = Number(e.target.value);
      if (!Number.isFinite(secs)) return;
      commit();
      // The entry point moved: re-sort, because which track is playing at a moment
      // is read off the list order, and reschedule what is sounding now.
      setMusicStart(state.show, m.id, secs * 1000);
      if (state.ui.playing) music.seek(state.ui.playhead);
      app.rebuild();
    } else if (f === 'music-play') {
      // The trim: how much of the file plays from its entry point. The file's own
      // length stays reported above, so a trim never hides what the track is.
      const secs = Number(e.target.value);
      if (!Number.isFinite(secs)) return;
      commit();
      const ms = Math.max(0, Math.round(secs * 1000));
      m.play = m.length > 0 ? Math.min(ms, m.length) : ms;
      if (state.ui.playing) music.seek(state.ui.playhead);
      app.rebuild();
    } else if (f === 'fade-edit') {
      const row = e.target.closest('[data-music-cue]');
      const id = row ? row.dataset.musicCue : state.ui.musicCueId;
      if (!id) return;
      commit();
      updateMusicCue(m, id, { level: Number(e.target.value) });
      app.rebuild();
    }
  });
  // A fade's seconds are edited where they are read, like a cue's.
  $('musicRow').addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (f !== 'fade-edit-dur') return;
    const host = e.target.closest('[data-track]');
    const m = host ? trackById(host.dataset.track) : null;
    if (!m) return;
    const row = e.target.closest('[data-music-cue]');
    const id = row ? row.dataset.musicCue : state.ui.musicCueId;
    const secs = Number(e.target.value);
    if (!id || !Number.isFinite(secs)) return;
    updateMusicCue(m, id, { dur: Math.max(0, secs * 1000) });
    persist();
  });
  $('musicRow').addEventListener('click', (e) => {
    const host = e.target.closest('[data-track]');
    const m = host ? trackById(host.dataset.track) : null;
    if (!m) return;
    if (e.target.closest('[data-music="trim"]')) {
      // The quick way to trim: put the playhead where the music should stop.
      const ms = state.ui.playhead - m.start;
      commit();
      if (ms <= 0) {
        m.play = 0;
        state.ui.hint = 'The playhead is before this track starts, so nothing would play';
      } else {
        m.play = m.length > 0 ? Math.min(ms, m.length) : ms;
        state.ui.hint = m.name + ' now ends at ' + fmtTime(m.start + m.play);
      }
      if (state.ui.playing) music.seek(state.ui.playhead);
      app.rebuild();
      return;
    }
    if (e.target.closest('[data-music="replace"]')) {
      // A replacement keeps the row's own place, so there is no new moment to read.
      pickMusicFor(m.id, m.start);
      return;
    }
    if (e.target.closest('[data-music="eye"]')) {
      commit();
      m.visible = m.visible === false;
      app.rebuild();
      return;
    }
    if (e.target.closest('[data-music="add-fade"]')) {
      const box = e.target.closest('.item');
      const pick = box && box.querySelector('select[data-f="fade-to"]');
      const durBox = box && box.querySelector('input[data-f="fade-dur"]');
      const secs = Number(durBox && durBox.value);
      commit();
      const cue = addMusicCue(m, state.ui.playhead, pick ? Number(pick.value) : 0, Number.isFinite(secs) ? secs * 1000 : 0);
      state.ui.musicCueId = cue ? cue.id : null;
      app.rebuild();
      return;
    }
    const delFade = e.target.closest('[data-music="del-fade"]');
    if (delFade) {
      commit();
      removeMusicCue(m, delFade.dataset.fadeId);
      if (state.ui.musicCueId === delFade.dataset.fadeId) state.ui.musicCueId = null;
      app.rebuild();
      return;
    }
    const fadeRow = e.target.closest('[data-music-cue]');
    if (fadeRow) {
      // Picking a fade does not touch the track's own entry point.
      state.ui.musicCueId = fadeRow.dataset.musicCue;
      app.rebuild();
      return;
    }
    if (e.target.closest('[data-music="fit"]')) {
      const last = state.show.acts[state.show.acts.length - 1];
      if (!last) return;
      commit();
      // Only the last act grows: earlier acts are already where they start.
      last.length = Math.min(
        ACT_MAX_MS,
        Math.max(ACT_MIN_MS, Math.round(m.start + m.length + 500))
      );
      clampSceneOffsets(last);
      app.rebuild();
      return;
    }
    if (!e.target.closest('[data-music="remove"]')) return;
    commit();
    removeMusicTrack(state.show, m.id);
    if (state.ui.musicCueId && !((m.cues || []).some((c) => c.id === state.ui.musicCueId))) state.ui.musicCueId = null;
    music.forget(m);
    app.rebuild();
  });

  // narration: both ways in are module functions, because the track menu starts a
  // take (or a picker) at the moment it was right-clicked rather than at the
  // playhead.
  $('btnRecord').addEventListener('click', () => toggleRecording(state.ui.playhead));
  $('btnVoiceFile').addEventListener('click', () => attachVoiceFile(state.ui.playhead));
  $('fileNarration').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const at = pendingVoiceAt;
    state.ui.hint = 'Reading ' + file.name + '…';
    state.ui.dirtyPanels = true;
    narration
      .attachFile(file)
      .then((info) => placeVoice(info, at, info.name))
      .catch(() => {
        state.ui.hint = 'That file is not audio this browser can read';
        app.rebuild();
      });
  });

  $('btnVoiceFolder').addEventListener('click', () => $('folderNarration').click());

  // The voice for this show, as one file. It is named after the show and carries the
  // show's ID, so loading it into a different show asks first.
  $('btnVoiceSave').addEventListener('click', async () => {
    state.ui.hint = 'Gathering the voice…';
    state.ui.dirtyPanels = true;
    commit();
    try {
      const bundle = await buildBundle(state.show, readAudio);
      const json = JSON.stringify(bundle);
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = bundleFileName(state.show);
      a.click();
      URL.revokeObjectURL(a.href);
      const missing = bundle.missing.length ? ` · ${bundle.missing.length} clip(s) had no audio in this browser` : '';
      state.ui.hint = `Saved ${bundle.audio.length} voice clip(s)${missing}`;
    } catch {
      state.ui.hint = 'The voice could not be saved';
    }
    state.ui.dirtyPanels = true;
    app.rebuild();
  });
  $('btnVoiceLoad').addEventListener('click', () => $('fileVoiceLoad').click());
  $('fileVoiceLoad').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let bundle = null;
      try {
        bundle = JSON.parse(String(reader.result));
      } catch {
        bundle = null;
      }
      const check = checkBundle(bundle, state.show);
      if (check.verdict === 'invalid') {
        state.ui.hint = 'That file is not a narration voice file';
        app.rebuild();
        return;
      }
      if (check.verdict === 'other') {
        const go = window.confirm(
          `This voice was saved for "${check.showName}", not the open show "${state.show.name}". Load it anyway?`
        );
        if (!go) {
          state.ui.hint = 'Voice not loaded';
          app.rebuild();
          return;
        }
      }
      const result = await applyBundle(bundle, storeAudio);
      narration.forget(bundle.audio.map((a) => a.key));
      await narration.probe(state.show.narration);
      state.ui.hint = `Loaded ${result.stored} of ${result.total} voice clip(s)`;
      state.ui.dirtyPanels = true;
      app.rebuild();
    };
    reader.readAsText(file);
  });
  // A folder of numbered recordings: taken in file-name order (01, 02, … 10), one after
  // another from the end of the narration already in the show, unattached until a speaker is chosen.
  $('folderNarration').addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])]
      .filter((f) => /^audio\//.test(f.type) || /\.(wav|mp3|m4a|ogg|webm|flac|aac)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    e.target.value = '';
    if (!files.length) {
      state.ui.hint = 'No audio files in that folder';
      app.rebuild();
      return;
    }
    commit();
    let placed = 0;
    for (const file of files) {
      state.ui.hint = `Reading ${file.name} (${placed + 1} of ${files.length})…`;
      state.ui.dirtyPanels = true;
      try {
        const info = await narration.attachFile(file);
        addNarration(state.show, { key: info.key, name: file.name.replace(/\.[^.]+$/, ''), length: info.length });
        placed += 1;
      } catch {
        // An unreadable file is skipped; the count below says how many made it.
      }
    }
    state.ui.hint = `Imported ${placed} of ${files.length} clips — choose a speaker for each`;
    state.ui.dirtyPanels = true;
    app.rebuild();
  });

  $('voiceRow').addEventListener('change', (e) => {
    const host = e.target.closest('[data-voice]');
    const c = host ? voiceById(host.dataset.voice) : null;
    if (!c) return;
    const f = e.target.dataset.f;
    if (f === 'voice-speaker') {
      commit();
      setNarrationSpeaker(state.show, c.id, e.target.value);
      app.rebuild();
    } else if (f === 'voice-name') {
      app.rebuild();
    } else if (f === 'voice-at') {
      const secs = Number(e.target.value);
      if (!Number.isFinite(secs)) return;
      commit();
      setNarrationAt(state.show, c.id, Math.round(secs * 1000));
      app.rebuild();
    }
  });
  $('voiceRow').addEventListener('click', (e) => {
    const host = e.target.closest('[data-voice]');
    const c = host ? voiceById(host.dataset.voice) : null;
    if (!c) return;
    if (e.target.closest('[data-voice-act="seek"]')) {
      state.ui.playhead = c.at;
      state.ui.activePause = null;
      state.ui.hint = c.name + ' starts at ' + fmtTime(c.at);
      app.rebuild();
      return;
    }
    if (!e.target.closest('[data-voice-act="remove"]')) return;
    commit();
    removeNarration(state.show, c.id);
    // The recording stays in the browser even though the piece is gone. A take
    // cannot be got back from disk the way a music file can, and undo is the way
    // most removals of a line are reconsidered — a clip whose audio had been
    // deleted with it would come back silent, which would be worse than a little
    // unused audio.
    app.rebuild();
  });

  // the panes' sections fold to their headings, remembered between visits
  setupSections();
  $('btnFoldAll').addEventListener('click', foldAllSections);

  // one view at a time, and how the elevation reads distance
  $('btnTopDown').addEventListener('click', () => setFill('plan'));
  $('btnFillPlan').addEventListener('click', () => setFill('plan'));
  for (const [id, key] of [['btnPaths', 'showPaths'], ['btnStations', 'showStations']]) {
    $(id).addEventListener('click', () => {
      state.ui[key] = state.ui[key] === false;
      paintView();
      saveView();
      app.stage.draw();
    });
  }
  $('btnCostumes').addEventListener('click', () => {
    state.ui.showCostumes = state.ui.showCostumes !== true;
    paintView(); saveView(); app.stage.draw();
  });
  $('btnTilt').addEventListener('click', () => {
    state.ui.tiltMode = !state.ui.tiltMode;
    if (state.ui.fill !== 'plan') setFill('plan');
    paintView();
  });
  $('btnResetOverhead').addEventListener('click', () => {
    state.ui.planTilt = 0; state.ui.tiltMode = false;
    paintView(); saveView(); app.stage.draw();
  });
  $('stage').addEventListener('viewtiltchange', saveView);
  $('btnFillElev').addEventListener('click', () => setFill('elevation'));
  $('btnDepth').addEventListener('click', () => setDepth(state.ui.depth === false));
  paintView();

  // watch mode: the stage alone, playing, with a bar that can end it
  $('btnWatch').addEventListener('click', () => setWatch(true));

  // Recording. House mode switches to the House view first, so the picture being taken
  // is the audience's; whole-app mode asks the browser to share this window.
  recorder = new Recorder({ onState: paintRecorder });
  $('btnCaptureRec').addEventListener('click', async () => {
    if (recorder.recording) {
      recorder.stop();
      return;
    }
    const mode = $('captureMode').value;
    try {
      if (mode === 'house' && state.ui.fill !== 'house') setFill('house');
      if (mode === 'app') flashRecStatus('Choose this window in the sharing prompt…');
      await recorder.start(mode, { houseCanvas: $('house') });
    } catch (err) {
      const cancelled = err && err.name === 'NotAllowedError';
      flashRecStatus(cancelled ? 'Screen sharing was cancelled' : err && err.message ? err.message : 'Recording did not start');
    }
  });
  $('wPlay').addEventListener('click', togglePlay);
  $('wRestart').addEventListener('click', () => {
    stop();
    play();
  });
  $('wFull').addEventListener('click', toggleFullscreen);
  $('wExit').addEventListener('click', () => setWatch(false));
  $('watchExit').addEventListener('click', () => setWatch(false));

  // transport
  $('btnPlay').addEventListener('click', togglePlay);
  $('btnStop').addEventListener('click', stop);
  $('btnKey').addEventListener('click', addKeyAtPlayhead);
  $('btnPath').addEventListener('click', () => {
    state.ui.placingStations = !state.ui.placingStations;
    state.ui.stationGuide = null;
    state.ui.dirtyPanels = true;
  });
  $('btnHold').addEventListener('click', addHold);
  $('btnPause').addEventListener('click', addPause);
  $('btnEnd').addEventListener('click', addEnd);
  $('zoomIn').addEventListener('click', () => {
    state.ui.pxPerSec = Math.min(800, state.ui.pxPerSec * 1.35);
  });
  $('timeScroll').addEventListener('input', (e) => {
    state.ui.scrollT = Math.max(0, Number(e.target.value) || 0);
    app.timeline.closeMenu();
  });
  $('zoomOut').addEventListener('click', () => {
    state.ui.pxPerSec = Math.max(4, state.ui.pxPerSec / 1.35);
  });
  $('chkCollide').addEventListener('change', (e) => {
    state.ui.pauseOnCollision = e.target.checked;
  });

  $('btnMoves').addEventListener('click', () => app.openMoves());
  $('btnMovesClose').addEventListener('click', () => moves && moves.close());
  $('btnSchool').addEventListener('click', openSchool);
  $('btnSchoolClose').addEventListener('click', closeSchool);
  $('schoolSheet').addEventListener('click', (e) => { if (e.target === $('schoolSheet')) closeSchool(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('schoolSheet').hidden) closeSchool(); });
  // The sheet is a layer over the stage, so clicking past it closes it and clicking inside
  // it does not.
  $('movesSheet').addEventListener('pointerdown', (e) => {
    if (e.target === $('movesSheet')) moves.close();
  });

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    // While the cheat sheet is up it owns the keyboard: Escape closes it, and the space bar
    // does not start a show playing behind a curtain nobody can see through.
    if (moves && moves.isOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        moves.close();
      }
      return;
    }
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'Escape' && state.ui.stationGuide) {
      e.preventDefault();
      state.ui.stationGuide = null;
      state.ui.placingStations = false;
      state.ui.hint = 'Next station cancelled';
      app.rebuild();
    } else if (e.key === 'Escape' && state.ui.phraseArmed) {
      e.preventDefault();
      state.ui.phraseArmed = null;
      state.ui.hint = 'Phrase cancelled';
      app.rebuild();
    } else if (e.key === 'Escape' && state.ui.watch) {
      e.preventDefault();
      setWatch(false);
    } else if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      state.ui.stationIdx = null;
      if (e.shiftKey) redo();
      else undo();
      app.rebuild();
    }
  });

  window.addEventListener('resize', () => {
    // Rows first: the resize redraw uses the shared scale, and a stale one would
    // draw one frame of the two views at different sizes.
    fitViews();
    app.stage.draw();
    app.elevation.draw();
    app.timeline.draw();
  });

  requestAnimationFrame(frame);
}

boot();
