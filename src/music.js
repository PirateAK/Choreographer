// Music: the show's track, and the clock the whole app runs on.
//
// The audio context is the master. The picture is read off `ctx.currentTime`, not
// counted in animation frames, because a frame counter drifts against a real
// recording and five minutes is long enough for the difference to show. With no
// track attached the context still ticks, so there is one clock either way.
//
// Audio files are far too big for localStorage, so the bytes live in IndexedDB
// and the show file keeps only the name, the entry point and the length. The
// store is shared with narration, which keeps its clips in the same database
// under a different key prefix.

import { storeAudio, readAudio, dropAudio, peaksOf } from './audiostore.js';

export class MusicEngine {
  constructor() {
    this.ctx = null;
    this.gain = null;
    this.buffer = null;
    this.peaks = null;
    this.ready = null;
    this.source = null;
    this.track = null;
    this.running = false;
    this.onClock = true;
    this.anchorShow = 0;
    this.anchorAt = 0;
    this.wallShow = 0;
    this.wallAt = 0;
    this.muted = false;
    // The show's fades, as a gain. Kept apart from `muted`, which is the eye on
    // the row: hiding the row silences it whatever the fades say.
    this.level = 1;
    // A show has a list of tracks and the engine plays whichever one covers the
    // playhead. Decoded audio is kept for the track playing and the one after
    // it, because a five-minute stereo track is over 100 MB of floats and a
    // whole evening of them would not fit.
    this.cache = new Map();
    this.status = new Map();
    // Waveforms are small and stored with the audio, so every row can draw its
    // own peaks without decoding the track.
    this.peaksByKey = new Map();
    this.key = null;
  }

  peaksFor(key) {
    const cached = this.cache.get(key);
    if (cached) return cached.peaks;
    return this.peaksByKey.get(key) || null;
  }

  statusOf(track) {
    if (!track) return 'missing';
    return this.status.get(track.key) || (this.cache.has(track.key) ? 'ready' : 'unknown');
  }

  // Is the audio for this track in the browser at all? Answered without decoding
  // it, so a show with six tracks does not decode six files on startup.
  async probe(tracks) {
    for (const t of tracks || []) {
      if (!t || !t.key || this.status.has(t.key)) continue;
      let rec = null;
      try {
        rec = await readAudio(t.key);
      } catch (e) {
        rec = null;
      }
      this.status.set(t.key, rec && rec.bytes ? 'ready' : 'missing');
      if (rec && rec.peaks) this.peaksByKey.set(t.key, Float32Array.from(rec.peaks));
    }
  }

  trimCache(keepKey) {
    let extra = this.cache.size - 2;
    for (const key of [...this.cache.keys()]) {
      if (extra <= 0) break;
      if (key === keepKey) continue;
      this.cache.delete(key);
      extra--;
    }
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    // Every piece of show sound (music, narration) goes through this bus, so a recording
    // can take the whole mix from one place without re-routing the speakers.
    this.bus = this.ctx.createGain();
    this.bus.connect(this.ctx.destination);
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.effectiveGain();
    this.gain.connect(this.bus);
    return this.ctx;
  }

  // A MediaStream audio track carrying exactly what the speakers hear. Calling it again
  // returns the same track; stopCaptureAudio() detaches the tap so nothing is kept open.
  captureAudio() {
    if (!this.ensure() || typeof this.ctx.createMediaStreamDestination !== 'function') return null;
    if (!this.captureNode) {
      this.captureNode = this.ctx.createMediaStreamDestination();
      this.bus.connect(this.captureNode);
    }
    const tracks = this.captureNode.stream.getAudioTracks();
    return tracks[0] || null;
  }

  stopCaptureAudio() {
    if (!this.captureNode) return;
    try { this.bus.disconnect(this.captureNode); } catch (_) { /* already detached */ }
    this.captureNode = null;
  }

  // Decode from the store, or take it from the cache. Resolves true only when
  // the bytes are there and playable, so the panel can say "the file is missing"
  // instead of lying — and a switch between two tracks is instant the second
  // time either of them is reached.
  async load(track) {
    if (!track) return false;
    const cached = this.cache.get(track.key);
    if (cached) {
      this.buffer = cached.buffer;
      this.peaks = cached.peaks;
      this.status.set(track.key, 'ready');
      return true;
    }
    const ctx = this.ensure();
    if (!ctx) return false;
    let record = null;
    try {
      record = await readAudio(track.key);
    } catch (e) {
      record = null;
    }
    if (!record || !record.bytes) {
      this.status.set(track.key, 'missing');
      return false;
    }
    let buffer = null;
    try {
      buffer = await ctx.decodeAudioData(record.bytes.slice(0));
    } catch (e) {
      this.status.set(track.key, 'missing');
      return false;
    }
    const peaks = peaksOf(buffer);
    this.cache.set(track.key, { buffer, peaks });
    this.peaksByKey.set(track.key, peaks);
    this.trimCache(track.key);
    this.status.set(track.key, 'ready');
    this.buffer = buffer;
    this.peaks = peaks;
    return true;
  }

  // The one call the frame loop makes: point the engine at whichever track
  // covers this moment, and keep a source running for it. A track of unknown
  // length is started without waiting for a length to be known.
  sync(track, showMs, playing) {
    const key = track ? track.key : null;
    if (key !== this.key) {
      this.key = key;
      this.stopSource();
      this.track = track || null;
      this.buffer = null;
      this.peaks = null;
      if (track && playing) this.boot();
      return;
    }
    this.track = track || null;
    if (!playing) {
      if (this.running) this.pause();
      return;
    }
    if (!this.running) this.play(showMs, track);
    else if (!this.source) this.boot();
  }

  // Loading is asynchronous, so a switch checks on the way out that it is still
  // the track it set out to load and that the show is still running.
  async boot() {
    const key = this.key;
    const track = this.track;
    if (!track || !this.running) return;
    const ok = await this.load(track);
    if (!ok || this.key !== key || !this.running || this.source) return;
    this.startSource(this.now());
  }

  get hasBytes() {
    return !!this.buffer;
  }

  // Take a file from disk: decode it, keep the peaks for the row, and store the
  // bytes so the track survives a reload without asking for the file again.
  async attach(file) {
    const ctx = this.ensure();
    if (!ctx) throw new Error('This browser cannot play audio');
    const bytes = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    const key = 'music-' + Date.now().toString(36);
    const peaks = peaksOf(buffer);
    try {
      await storeAudio(key, { name: file.name, bytes, peaks: Array.from(peaks) });
    } catch (e) {
      // Storage blocked: the track still plays this session, it just will not
      // come back on reload. Not fatal.
    }
    this.cache.set(key, { buffer, peaks });
    this.peaksByKey.set(key, peaks);
    this.status.set(key, 'ready');
    return { key, name: file.name, length: Math.round(buffer.duration * 1000) };
  }

  async forget(track) {
    if (track && track.key === this.key) {
      this.stopSource();
      this.buffer = null;
      this.peaks = null;
      this.track = null;
      this.key = null;
    }
    if (track && track.key) {
      this.cache.delete(track.key);
      this.status.delete(track.key);
    }
    if (!track || !track.key) return;
    try {
      await dropAudio(track.key);
    } catch (e) {
      /* nothing to remove */
    }
  }

  effectiveGain() {
    if (this.muted) return 0;
    return Math.max(0, Math.min(1, Number.isFinite(this.level) ? this.level : 1));
  }

  setMuted(muted) {
    const next = !!muted;
    if (next === this.muted) return;
    this.muted = next;
    if (this.gain) this.gain.gain.value = this.effectiveGain();
  }

  // Called from the frame loop with `musicLevelAt(show, playhead)`. Written only
  // when it has actually moved, so a still track is not seventy audio-param
  // writes a second.
  setLevel(level) {
    const v = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
    if (Math.abs(v - this.level) < 0.004) return;
    this.level = v;
    if (this.gain) this.gain.gain.value = this.effectiveGain();
  }

  anchor(showMs) {
    this.anchorShow = showMs;
    if (this.ctx) this.anchorAt = this.ctx.currentTime;
    this.wallShow = showMs;
    this.wallAt = performance.now();
  }

  startSource(showMs) {
    this.stopSource();
    const t = this.track;
    if (!this.buffer || !t || !this.ctx) return;
    const into = (showMs - t.start) / 1000;
    const file = this.buffer.duration;
    // How much of the file plays: the trimmed span if there is one (`play`, the same
    // rule as musicSpan() in the model), otherwise all of it. Passing the duration to
    // start() makes the trim sample-accurate instead of waiting for a frame to notice.
    const span = Number.isFinite(Number(t.play)) ? Math.min(Number(t.play) / 1000, file) : file;
    const playFor = span - Math.max(0, into);
    if (playFor <= 0.01) return; // the track is over, or over its trim, by here
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.gain);
    // Before its entry point the source waits, sample-accurate, rather than
    // starting late when the playhead reaches the cue.
    const when = this.ctx.currentTime + Math.max(0, -into);
    src.start(when, Math.max(0, into), playFor);
    this.source = src;
  }

  stopSource() {
    if (!this.source) return;
    try {
      this.source.stop();
    } catch (e) {
      /* already finished */
    }
    this.source = null;
  }

  async play(showMs, track) {
    if (track !== undefined) {
      this.track = track || null;
      this.key = track ? track.key : null;
    }
    this.running = true;
    const ctx = this.ensure();
    // Anchor on the wall clock straight away. `running` is already true, so a
    // frame may ask for the time before resume() settles; a stale anchor there
    // would read as a huge drift and throw the playhead. The wall clock is
    // always sane, and the audio clock takes over once the context starts.
    this.onClock = false;
    this.anchor(showMs);
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        /* blocked until a gesture; the wall clock covers it */
      }
    }
    if (ctx && ctx.state === 'running') {
      // Hand the clock to the audio, continuing from where the wall says so the
      // playhead does not jump at the handover.
      const at = this.now();
      this.onClock = true;
      this.anchorAt = ctx.currentTime;
      this.anchorShow = at;
    }
    this.startSource(this.now());
  }

  pause() {
    this.running = false;
    this.stopSource();
  }

  // The playhead was moved while the show was running: re-anchor and restart the
  // track at the new moment.
  seek(showMs) {
    if (!this.running) return;
    this.anchor(showMs);
    this.startSource(showMs);
  }

  // Show time in ms, or null when the show is not running.
  now() {
    if (!this.running) return null;
    if (this.onClock && this.ctx) return this.anchorShow + (this.ctx.currentTime - this.anchorAt) * 1000;
    return this.wallShow + (performance.now() - this.wallAt);
  }
}

// Drop stored audio without touching what is playing: used when a show is
// replaced or a track swapped out after the new one is already decoded.
export function dropStored(key) {
  if (!key) return Promise.resolve();
  return dropAudio(key).catch(() => {});
}

// One player for the app: the timeline draws its waveform and the transport
// drives it, so they have to be the same engine.
export const music = new MusicEngine();

