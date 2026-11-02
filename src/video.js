import { storeAudio, readAudio, dropAudio } from './audiostore.js';
import { videoAt } from './model.js';

const PREFIX = 'video-';
const RESYNC_SECONDS = 0.08;
const HARD_RESYNC_SECONDS = 0.5;
const TIMELINE_JUMP_MS = 80;
const MAX_RATE_ADJUSTMENT = 0.03;

function mediaBlob(bytes) {
  if (typeof Blob !== 'undefined' && bytes instanceof Blob) return bytes;
  if (bytes instanceof ArrayBuffer || ArrayBuffer.isView(bytes)) {
    return new Blob([bytes]);
  }
  return null;
}

function activeClip(clips, playheadMs) {
  return videoAt({ videos: Array.isArray(clips) ? clips : [] }, playheadMs);
}

export class VideoEngine {
  constructor() {
    this.element = null;
    this.objectUrl = null;
    this.key = null;
    this.status = new Map();
    this.loadingKey = null;
    this.loadToken = 0;
    this.playheadMs = 0;
    this.lastSyncPlayheadMs = null;
    this.playing = false;
    this.playRequested = false;
    this.playPending = false;
    this.playToken = 0;
    this.clips = [];
  }

  ensureElement() {
    if (this.element) return this.element;
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    try {
      const video = document.createElement('video');
      video.playsInline = true;
      video.preload = 'auto';
      video.controls = false;
      this.element = video;
      return video;
    } catch (error) {
      return null;
    }
  }

  async attachFile(file) {
    if (!file || typeof file.arrayBuffer !== 'function') throw new Error('A video file is required');
    const blob = typeof Blob !== 'undefined' && file instanceof Blob
      ? file
      : new Blob([await file.arrayBuffer()], { type: file.type || '' });
    const key = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    let length = 0;
    const url = this.makeObjectUrl(blob);
    if (!url) throw new Error('This browser cannot load video files');
    try {
      length = await this.readDuration(url);
      await storeAudio(PREFIX + key, { name: file.name || 'Video', bytes: blob });
    } catch (error) {
      throw new Error(error && error.message ? error.message : 'Could not store or read the video file');
    } finally {
      this.revokeObjectUrl(url);
    }
    this.status.set(key, true);
    return { key, name: file.name || 'Video', length: Math.round(length * 1000) };
  }

  makeObjectUrl(blob) {
    try {
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
      return URL.createObjectURL(blob);
    } catch (error) {
      return null;
    }
  }

  revokeObjectUrl(url) {
    if (!url) return;
    try {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
    } catch (error) {
      // URL cleanup must not interrupt playback or file attachment.
    }
  }

  readDuration(url) {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        reject(new Error('This browser cannot load video files'));
        return;
      }
      let probe;
      try { probe = document.createElement('video'); } catch (error) {
        reject(new Error('This browser cannot load video files'));
        return;
      }
      let settled = false;
      const finish = (error, duration) => {
        if (settled) return;
        settled = true;
        probe.removeEventListener('loadedmetadata', onMetadata);
        probe.removeEventListener('error', onError);
        probe.removeAttribute('src');
        try { probe.load(); } catch (ignored) { /* optional */ }
        if (error) reject(error);
        else resolve(duration);
      };
      const onMetadata = () => {
        if (Number.isFinite(probe.duration) && probe.duration > 0) finish(null, probe.duration);
        else finish(new Error('The video has no usable duration'));
      };
      const onError = () => finish(new Error('This browser cannot read the video file'));
      probe.preload = 'metadata';
      probe.addEventListener('loadedmetadata', onMetadata, { once: true });
      probe.addEventListener('error', onError, { once: true });
      probe.src = url;
      try { probe.load(); } catch (error) { finish(error); }
    });
  }

  async has(key) {
    if (typeof key !== 'string' || !key) return false;
    try {
      const record = await readAudio(PREFIX + key);
      const found = !!(record && mediaBlob(record.bytes));
      this.status.set(key, found);
      return found;
    } catch (error) {
      this.status.set(key, false);
      return false;
    }
  }

  async probe(clips) {
    const missing = [];
    for (const clip of clips || []) {
      if (!clip || typeof clip.key !== 'string' || !clip.key) continue;
      if (!(await this.has(clip.key))) missing.push(clip.key);
    }
    return missing;
  }

  sync(clips, playheadMs, playing) {
    const clip = activeClip(clips, playheadMs);
    this.playheadMs = playheadMs;
    const previousPlayheadMs = this.lastSyncPlayheadMs;
    this.lastSyncPlayheadMs = playheadMs;
    this.playing = !!playing;
    this.clips = clips || [];
    const video = this.ensureElement();
    if (!video) return;
    if (!clip) {
      this.playing = false;
      if (this.key !== null || this.objectUrl) this.releaseSource();
      return;
    }
    if (this.status.get(clip.key) === false) { this.pause(); return; }
    this.applyAudio(clip);
    if (this.key !== clip.key) {
      this.releaseSource();
      this.key = clip.key;
      const token = ++this.loadToken;
      this.loadingKey = clip.key;
      this.loadClip(clip, token);
      return;
    }
    if (this.loadingKey === clip.key) return;
    const timelineJump = previousPlayheadMs !== null
      && Math.abs(playheadMs - previousPlayheadMs) > TIMELINE_JUMP_MS;
    if (timelineJump) {
      video.playbackRate = 1;
      this.seekTo(clip, playheadMs);
    } else if (playing) {
      this.correctDrift(clip, playheadMs);
    } else {
      video.playbackRate = 1;
      this.seekTo(clip, playheadMs);
    }
    if (playing) this.play();
    else this.pause();
  }

  async loadClip(clip, token) {
    let record = null;
    try {
      record = await readAudio(PREFIX + clip.key);
    } catch (error) {
      record = null;
    }
    const blob = record && mediaBlob(record.bytes);
    if (!blob) {
      this.status.set(clip.key, false);
      if (this.key === clip.key && this.loadToken === token) this.releaseSource();
      return;
    }
    this.status.set(clip.key, true);
    const url = this.makeObjectUrl(blob);
    if (!url) {
      if (this.key === clip.key && this.loadToken === token) this.releaseSource();
      return;
    }
    if (this.key !== clip.key || this.loadToken !== token) {
      this.revokeObjectUrl(url);
      return;
    }
    const video = this.element;
    this.objectUrl = url;
    this.loadingKey = null;
    try {
      video.src = url;
      video.load();
      const current = activeClip(this.clips, this.playheadMs);
      if (!current) {
        this.releaseSource();
        return;
      }
      video.playbackRate = 1;
      this.seekTo(current, this.playheadMs);
      this.applyAudio(current);
      if (this.playing) this.play();
      else this.pause();
    } catch (error) {
      this.releaseSource();
    }
  }

  sourceTime(clip, playheadMs) {
    const length = Number.isFinite(Number(clip.length)) ? Math.max(0, Number(clip.length)) : Infinity;
    const sourceStart = Number.isFinite(Number(clip.trimIn))
      ? Math.max(0, Math.min(length, Number(clip.trimIn)))
      : 0;
    const sourceEnd = Number.isFinite(Number(clip.trimOut))
      ? Math.max(sourceStart, Math.min(length, Number(clip.trimOut)))
      : length;
    return Math.max(sourceStart, Math.min(sourceEnd, sourceStart + playheadMs - clip.at)) / 1000;
  }

  correctDrift(clip, playheadMs) {
    const video = this.element;
    if (!video || video.seeking || !Number.isFinite(video.currentTime)) return;
    const drift = this.sourceTime(clip, playheadMs) - video.currentTime;
    const magnitude = Math.abs(drift);
    if (magnitude > HARD_RESYNC_SECONDS) {
      video.playbackRate = 1;
      this.seekTo(clip, playheadMs);
    } else if (magnitude > RESYNC_SECONDS) {
      video.playbackRate = 1 + Math.max(-MAX_RATE_ADJUSTMENT, Math.min(MAX_RATE_ADJUSTMENT, drift * 0.1));
    } else {
      video.playbackRate = 1;
    }
  }

  seekTo(clip, playheadMs) {
    const video = this.element;
    if (!video || !Number.isFinite(playheadMs) || video.seeking) return;
    const target = this.sourceTime(clip, playheadMs);
    try {
      if (!Number.isFinite(video.currentTime) || Math.abs(video.currentTime - target) > RESYNC_SECONDS) {
        video.currentTime = target;
      }
    } catch (error) {
      // Seeking can be unavailable until metadata has arrived; the next sync retries.
    }
  }

  applyAudio(clip) {
    const video = this.element;
    if (!video) return;
    video.muted = !!clip.muted;
    const level = Number(clip.level);
    video.volume = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 1));
  }

  play() {
    if (!this.element || this.playRequested || this.playPending) return;
    this.playRequested = true;
    const token = ++this.playToken;
    try {
      const result = this.element.play();
      if (result && typeof result.then === 'function') {
        this.playPending = true;
        result.then(() => {
          if (token !== this.playToken) return;
          this.playPending = false;
          if (!this.playing || !this.playRequested) this.pause();
        }, () => {
          if (token !== this.playToken) return;
          this.playPending = false;
          this.playRequested = false;
        });
      }
    } catch (error) {
      this.playRequested = false;
      // Autoplay policies may reject; a later user-initiated sync can retry.
    }
  }

  pause() {
    const video = this.element;
    const shouldPause = this.playRequested || (video && video.paused === false);
    this.playToken++;
    this.playRequested = false;
    this.playPending = false;
    if (!shouldPause) return;
    try { if (video) video.pause(); } catch (error) { /* optional */ }
  }

  activeElement(clips, playheadMs) {
    const clip = activeClip(clips, playheadMs);
    if (!clip || this.status.get(clip.key) !== true || this.key !== clip.key || !this.objectUrl) return null;
    return this.element;
  }

  releaseSource() {
    this.loadToken++;
    this.loadingKey = null;
    this.pause();
    const video = this.element;
    if (video) {
      video.playbackRate = 1;
      try {
        video.removeAttribute('src');
        video.load();
      } catch (error) { /* optional */ }
    }
    this.revokeObjectUrl(this.objectUrl);
    this.objectUrl = null;
    this.key = null;
  }

  stop() {
    this.playing = false;
    this.pause();
  }

  async forget(key) {
    if (typeof key !== 'string' || !key) return;
    if (this.key === key) this.releaseSource();
    this.status.delete(key);
    try { await dropAudio(PREFIX + key); } catch (error) { /* best-effort cleanup */ }
  }
}
