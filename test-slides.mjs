import assert from 'node:assert/strict';
import {
  createShow, normalise, addImage, addSlideCue, removeSlideCue,
  videoAt, projectionAt, slideLayersAt, addVideo, endContent,
} from './src/model.js';

const show = createShow();
assert.deepEqual(show.images, []);
assert.deepEqual(show.slideCues, []);

// Legacy shows normalize with empty slide data, and videoAt keeps its original
// standalone overlapping behavior (including resuming the earlier clip).
const legacy = normalise({ videos: [
  { id: 'v', key: 'movie', at: 10, length: 1000 },
  { key: 'bad', at: Infinity, length: NaN, trimIn: -9, trimOut: Infinity },
] });
assert.deepEqual(legacy.images, []);
assert.deepEqual(legacy.slideCues, []);
assert.equal(legacy.videos.some((clip) => clip.id === 'v'), true);
assert.equal(videoAt(legacy, 10).key, 'movie');
const overlap = {
  videos: [
    { key: 'first', at: 0, length: 5000 },
    { key: 'second', at: 1000, length: 1000 },
  ],
};
assert.equal(videoAt(overlap, 1500).key, 'second');
assert.equal(videoAt(overlap, 2000).key, 'first');

const imageA = addImage(show, { key: 'a', name: 'A', width: 1920, height: 1080, bytes: new Uint8Array([1, 2]) });
const imageB = addImage(show, { key: 'b', name: 'B', width: 800, height: 600 });
assert.deepEqual(imageA, { id: imageA.id, key: 'a', name: 'A', width: 1920, height: 1080 });
assert.equal(Object.hasOwn(imageA, 'bytes'), false, 'media bytes are not retained in show metadata');
assert.equal(addImage(show, null), null);

// Normalization preserves valid metadata, repairs malformed values/IDs, clamps
// fade bounds, and intentionally retains references to missing media.
const malformed = normalise({
  images: [
    { id: 'same', key: 'img', width: NaN, height: Infinity, bytes: 'not metadata' },
    { id: 'same', key: 'img2', width: -4, height: '12' },
    null, { key: '' },
  ],
  slideCues: [
    { id: 'cue', at: '15.6', imageId: 'deleted-media', fade: Infinity },
    { id: 'cue', at: NaN, imageId: null, fade: -4 },
    null,
  ],
});
assert.equal(malformed.images.length, 2);
assert.notEqual(malformed.images[0].id, malformed.images[1].id);
assert.deepEqual(
  { width: malformed.images[0].width, height: malformed.images[0].height },
  { width: 0, height: 0 },
);
assert.equal(Object.hasOwn(malformed.images[0], 'bytes'), false);
assert.equal(malformed.slideCues.length, 2);
assert.notEqual(malformed.slideCues[0].id, malformed.slideCues[1].id);
const missingCue = malformed.slideCues.find((cue) => cue.imageId === 'deleted-media');
const offMalformedCue = malformed.slideCues.find((cue) => cue.imageId === null);
assert.equal(missingCue.at, 16);
assert.equal(missingCue.fade, 1000);
assert.equal(offMalformedCue.at, 0);
assert.equal(offMalformedCue.fade, 0);

const cueA = addSlideCue(show, 0, imageA.id, 0);
assert.ok(cueA.id);
assert.equal(addSlideCue(show, NaN, null, 999999).fade, 120000);
assert.equal(show.slideCues[1].at, 0);
removeSlideCue(show, show.slideCues[1].id);
assert.equal(show.slideCues.length, 1);

// Projection starts are inclusive; a newer start permanently replaces prior
// content. Ending a newer video is blank, not a resurrection of slide/video.
const timeline = createShow();
const a = addImage(timeline, { key: 'a' });
const b = addImage(timeline, { key: 'b' });
addSlideCue(timeline, 0, a.id, 0);
const movie = addVideo(timeline, { key: 'movie', length: 1000 }, 1000);
assert.equal(projectionAt(timeline, 999).imageId, a.id);
assert.equal(projectionAt(timeline, 1000).kind, 'video');
assert.equal(projectionAt(timeline, 1999).clip, movie);
assert.deepEqual(projectionAt(timeline, 2000), { kind: 'off', at: 1000 });
assert.deepEqual(slideLayersAt(timeline, 2500), []);
addSlideCue(timeline, 3000, b.id, 0);
assert.equal(projectionAt(timeline, 3000).imageId, b.id);
assert.deepEqual(slideLayersAt(timeline, 3000), [{ imageId: b.id, alpha: 1 }]);

// Same-time slide/off takes priority over video; the later cue in the stored
// list wins equal-start slide ties.
const tied = createShow();
const tieA = addImage(tied, { key: 'tie-a' });
const tieB = addImage(tied, { key: 'tie-b' });
addVideo(tied, { key: 'tie-video', length: 1000 }, 50);
addSlideCue(tied, 50, tieA.id, 0);
const lastCue = addSlideCue(tied, 50, tieB.id, 0);
assert.equal(projectionAt(tied, 50).cue, lastCue);
assert.equal(projectionAt(tied, 50).imageId, tieB.id);
const offTie = createShow();
addVideo(offTie, { key: 'tie-video', length: 1000 }, 50);
const offCue = addSlideCue(offTie, 50, null, 0);
assert.equal(projectionAt(offTie, 50).kind, 'off');
assert.equal(projectionAt(offTie, 50).cue, offCue);
assert.deepEqual(projectionAt(createShow(), 42), { kind: 'off', at: -Infinity });
assert.deepEqual(projectionAt(tied, Infinity), { kind: 'off', at: -Infinity });

// Linear crossfade midpoint and stable arbitrary-time evaluation.
const fades = createShow();
const fA = addImage(fades, { key: 'fa' });
const fB = addImage(fades, { key: 'fb' });
const fC = addImage(fades, { key: 'fc' });
addSlideCue(fades, 0, fA.id, 0);
addSlideCue(fades, 1000, fB.id, 2000);
const midpoint = slideLayersAt(fades, 2000);
assert.deepEqual(midpoint, [
  { imageId: fA.id, alpha: 0.5 },
  { imageId: fB.id, alpha: 0.5 },
]);
assert.deepEqual(slideLayersAt(fades, 2000), midpoint, 'scrubs are deterministic');

// An interrupted transition starts from the exact weighted snapshot at the
// interruption, rather than restarting from a single image or flashing.
addSlideCue(fades, 2000, fC.id, 1000);
const atInterruption = slideLayersAt(fades, 2000);
assert.deepEqual(atInterruption, midpoint);
assert.deepEqual(slideLayersAt(fades, 2500), [
  { imageId: fA.id, alpha: 0.25 },
  { imageId: fB.id, alpha: 0.25 },
  { imageId: fC.id, alpha: 0.5 },
]);
assert.deepEqual(slideLayersAt(fades, 3000), [{ imageId: fC.id, alpha: 1 }]);

// Projector off fades the current blend out; video entry cuts to blank for
// slide-layer output, and does not let a previous image reappear on video end.
const offFade = createShow();
const offA = addImage(offFade, { key: 'off-a' });
addSlideCue(offFade, 0, offA.id, 0);
addSlideCue(offFade, 1000, null, 1000);
assert.deepEqual(slideLayersAt(offFade, 1500), [{ imageId: offA.id, alpha: 0.5 }]);
assert.deepEqual(slideLayersAt(offFade, 2000), []);
const videoInterrupt = createShow();
const vidImage = addImage(videoInterrupt, { key: 'vid-image' });
addSlideCue(videoInterrupt, 0, vidImage.id, 0);
addVideo(videoInterrupt, { key: 'interrupt-video', length: 100 }, 500);
assert.deepEqual(slideLayersAt(videoInterrupt, 499), [{ imageId: vidImage.id, alpha: 1 }]);
assert.deepEqual(slideLayersAt(videoInterrupt, 500), []);
assert.deepEqual(slideLayersAt(videoInterrupt, 700), []);

// Slide fades extend computed content end, while an explicit end marker remains
// authoritative in either direction.
assert.equal(endContent({ ...createShow(), acts: [], slideCues: [{ at: 100, fade: 250 }] }), 350);
assert.equal(endContent({ ...createShow(), acts: [], slideCues: [{ at: 100, fade: 250 }], markers: [{ id: 'end', kind: 'end', t: 200 }] }), 200);

console.log('slide model tests passed');
