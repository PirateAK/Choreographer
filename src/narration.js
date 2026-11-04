// Narration: voice clips, recorded here or attached from disk, played in sync.
//
// Narration is not exclusive the way music is: any number of clips can be
// sounding at once, so there is no "which track" question to answer. What there
// is, is a start and a length per clip, which is all the engine needs — and that
// also means the picture and the voice cannot drift, because the offset into a
// clip is computed from the show clock every time one begins.
//
// The audio itself lives in the shared store with the music, under a 'voice-'
// key, so a show exports as text and its voice just reports itself missing on a
// machine that has never had it.

import { music } from './music.js';
import { storeAudio, readAudio, peaksOf } from './audiostore.js';

// A clip that is more than this far from where it should be is restarted rather
// than nudged: a quarter of a second is audible in speech, and anything smaller
// is the frame we happened to look at it on.
const RESYNC_MS = 250;
// Decoded audio is huge compared with a show file (a minute of mono voice is
// ~10 MB of floats), so only the clips near the playhead are kept decoded.
const KEEP_DECODED = 6;

export class NarrationEngine {
  constructor() {
    // key -> { buffer, peaks }
    this.cache = new Map();
    // key -> 'ready' | 'missing'
    this.status = new Map();
    // clip id -> the one source that is sounding for it right now
    this.live = new Map();
    this.loading = new Set();
    // Peaks for clips whose audio has not been decoded here yet, read from the
    // store, so the row can draw a shape it has never played.
    this.storedPeaks = new Map();
    // Recording state, kept here so the panel can show that the mic is open
    // without owning the stream.
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
    this.recording = false;
    this.recordingSince = 0;
    this.finished = null;
    // The permission prompt is asynchronous: a second click while it is open
    // must not open a second microphone.
    this.starting = false;
  }

  // The narration rides on the show's audio context: one clock for the music,
  // the voice and the playhead, so a clip cannot land late against the picture.
  ensure() {
    return music.ensure();
  }

  statusOf(clip) {
    if (!clip) return 'missing';
    return this.status.get(clip.key) || (this.cache.has(clip.key) ? 'ready' : 'unknown');
  }

  // Peaks are stored beside the audio, so the row draws a shape without the clip
  // ever being decoded.
  peaksFor(key) {
    const held = this.cache.get(key);
    if (held) return held.peaks;
    return this.storedPeaks.get(key) || null;
  }

  // Is the voice for these clips in this browser? Answered without decoding, so
  // a show with a dozen lines opens without decoding a dozen files.
  async probe(clips) {
    for (const c of clips || []) {
      if (!c || !c.key || this.status.has(c.key)) continue;
      let rec = null;
      try {
        rec = await readAudio(c.key);
      } catch (e) {
        rec = null;
      }
      this.status.set(c.key, rec && rec.bytes ? 'ready' : 'missing');
      if (rec && rec.peaks) this.storedPeaks.set(c.key, Float32Array.from(rec.peaks));
    }
  }

  /* ------------------------------------------------------------ recording */

  get canRecord() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined');
  }

  elapsedRecording() {
    return this.recording ? performance.now() - this.recordingSince : 0;
  }

  // Opens the microphone. He asks for the stream inside a click, which is the
  // only time a browser will allow it.
  async startRecording() {
    if (this.recording || this.starting) return false;
    if (!this.canRecord) throw new Error('This browser cannot record audio');
    this.starting = true;
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } finally {
      this.starting = false;
    }
    let rec = null;
    try {
      rec = new MediaRecorder(stream);
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('This browser cannot record audio');
    }
    this.chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) this.chunks.push(e.data);
    };
    // A take is cut into slices rather than one buffer at the end: a long
    // rehearsal should not be held in a single growing blob.
    rec.start(250);
    this.finished = new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' }));
    });
    this.recorder = rec;
    this.stream = stream;
    this.recording = true;
    this.recordingSince = performance.now();
    return true;
  }

  // Stops the microphone and resolves with the take, ready to be saved.
  async stopRecording() {
    const rec = this.recorder;
    if (!rec) return null;
    this.recording = false;
    if (rec.state !== 'inactive') rec.stop();
    let blob = null;
    try {
      blob = await this.finished;
    } catch (e) {
      blob = null;
    }
    this.releaseMic();
    return blob && blob.size ? blob : null;
  }

  releaseMic() {
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
    }
    this.stream = null;
    this.recorder = null;
  }

  /* --------------------------------------------------------------- storing */

  // Decode, keep the shape for the row, and store the bytes so the clip is there
  // after a reload without asking for anything again.
  async saveAudio(bytes, name) {
    const ctx = this.ensure();
    if (!ctx) throw new Error('This browser cannot play audio');
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    const key = 'voice-' + Date.now().toString(36);
    const peaks = peaksOf(buffer);
    try {
      await storeAudio(key, { name: name || 'narration', bytes, peaks: Array.from(peaks) });
    } catch (e) {
      // Storage blocked: the clip still plays this session, it just will not come
      // back on reload. Not fatal.
    }
    this.cache.set(key, { buffer, peaks });
    this.storedPeaks.set(key, peaks);
    this.status.set(key, 'ready');
    this.trimCache(key);
    return { key, name: name || 'Narration', length: Math.round(buffer.duration * 1000) };
  }

  async saveBlob(blob, name) {
    return this.saveAudio(await blob.arrayBuffer(), name);
  }

  async attachFile(file) {
    if (!file) return null;
    return this.saveAudio(await file.arrayBuffer(), file.name);
  }

  trimCache(keepKey) {
    let extra = this.cache.size - KEEP_DECODED;
    for (const key of [...this.cache.keys()]) {
      if (extra <= 0) break;
      if (key === keepKey) continue;
      this.cache.delete(key);
      extra--;
    }
  }

  async load(clip) {
    if (!clip || !clip.key) return null;
    const held = this.cache.get(clip.key);
    if (held) return held.buffer;
    // A clip whose audio is already known to be absent is not looked for again,
    // frame after frame.
    if (this.status.get(clip.key) === 'missing') return null;
    if (this.loading.has(clip.key)) return null;
    const ctx = this.ensure();
    if (!ctx) return null;
    this.loading.add(clip.key);
    let record = null;
    try {
      record = await readAudio(clip.key);
    } catch (e) {
      record = null;
    }
    this.loading.delete(clip.key);
    if (!record || !record.bytes) {
      this.status.set(clip.key, 'missing');
      return null;
    }
    let buffer = null;
    try {
      buffer = await ctx.decodeAudioData(record.bytes.slice(0));
    } catch (e) {
      this.status.set(clip.key, 'missing');
      return null;
    }
    const peaks = peaksOf(buffer);
    this.cache.set(clip.key, { buffer, peaks });
    this.storedPeaks.set(clip.key, peaks);
    this.status.set(clip.key, 'ready');
    this.trimCache(clip.key);
    return buffer;
  }

  /* -------------------------------------------------------------- playback */

  // Called from the frame loop. `showMs` is the playhead, and every clip is
  // placed against it rather than against a running tally, so a scrub, a seek or
  // a moved clip all land in the right part of the take.
  sync(show, showMs, playing, muted) {
    const clips = (show && show.narration) || [];
    const audible = playing && !muted;
    const want = new Map();
    if (audible) {
      for (const c of clips) {
        // A clip with no speaker is silent: nothing sounds from the house without a voice on stage.
        if (!c.speaker) continue;
        if (showMs >= c.at && showMs < c.at + (c.length || 0) && (c.length || 0) > 0) want.set(c.id, c);
      }
    }

    for (const id of [...this.live.keys()]) {
      const clip = want.get(id);
      if (!clip) {
        this.stopLive(id);
        continue;
      }
      const entry = this.live.get(id);
      const ctx = this.ensure();
      if (!ctx) {
        this.stopLive(id);
        continue;
      }
      const expected = entry.startOffset + (ctx.currentTime - entry.anchorCtx) * 1000;
      const desired = showMs - clip.at;
      if (Math.abs(expected - desired) > RESYNC_MS) this.stopLive(id);
    }

    if (!audible) return;
    for (const [, clip] of want) {
      if (this.live.has(clip.id)) continue;
      this.startLive(clip, showMs);
    }
  }

  // Decode the voice that is about to be needed, so pressing play does not spend
  // the first second of a line reading it off the disk.
  preload(show, showMs) {
    const clips = (show && show.narration) || [];
    for (const c of clips) {
      if (c.at + (c.length || 0) < showMs) continue;
      if (c.at > showMs + 15000) continue;
      if (this.cache.has(c.key) || this.status.get(c.key) === 'missing') continue;
      this.load(c);
    }
  }

  stopAll() {
    for (const id of [...this.live.keys()]) this.stopLive(id);
  }

  stopLive(id) {
    const entry = this.live.get(id);
    if (!entry) return;
    this.live.delete(id);
    try {
      entry.source.onended = null;
      entry.source.stop();
    } catch (e) {
      /* already finished */
    }
    try {
      entry.gain.disconnect();
    } catch (e) {
      /* already gone */
    }
  }

  startLive(clip, showMs) {
    const ctx = this.ensure();
    if (!ctx) return;
    const offset = Math.max(0, showMs - clip.at);
    // The cache holds the decoded buffer *and* its peaks, so the record is not
    // the thing an audio source can be given.
    const held = this.cache.get(clip.key);
    const audio = held && held.buffer;
    if (!audio) {
      // The first time a clip is reached its audio has to be read and decoded;
      // it joins on the next frame, from wherever the show has reached by then,
      // so it is late rather than out of time. `preload` makes that rare.
      this.load(clip);
      return;
    }
    if (offset / 1000 >= audio.duration) return;
    let source = null;
    let gain = null;
    try {
      source = ctx.createBufferSource();
      source.buffer = audio;
      gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0, offset / 1000);
    } catch (e) {
      return;
    }
    const entry = { source, gain, anchorCtx: ctx.currentTime, startOffset: offset };
    this.live.set(clip.id, entry);
    source.onended = () => {
      // Only clear the entry if it is still this source: stopping one by hand
      // also fires this, and a restart replaces the entry.
      const now = this.live.get(clip.id);
      if (now && now.source === source) this.live.delete(clip.id);
    };
  }
}

// One player for the app: the row draws its shape and the frame loop keeps it in
// time with the show.
export const narration = new NarrationEngine();
