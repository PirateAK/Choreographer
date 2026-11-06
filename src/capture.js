// Recording the show to a WebM file. Two modes:
//   'house'  records the House canvas, the audience's view, for capturing a performance.
//   'app'    records the whole window by screen share, for showing the app in use.
// Both take the show's sound (music and narration) from the audio bus, not the speakers,
// so what is heard in the file is the mix the show is making.
// Nothing is stored in the browser: the file is offered as a download when recording stops.
import { music } from './music.js';

const MIME_CHOICES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export const CAPTURE_MODES = {
  house: { label: 'House (performance)', hint: 'Records the House view and the show sound. Keep this tab visible while recording.' },
  app: { label: 'Whole app (demonstration)', hint: 'Records this window by screen share, panels included. Pick this tab when the browser asks.' },
};

export function captureSupport() {
  if (typeof MediaRecorder === 'undefined') return 'This browser cannot record video.';
  return null;
}

export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  return MIME_CHOICES.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

// The file name carries the mode and the moment it was made, so recordings never collide.
export function captureFileName(mode, when = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}_${pad(when.getHours())}-${pad(when.getMinutes())}-${pad(when.getSeconds())}`;
  return `choreographer-${mode}-${stamp}.webm`;
}

export class Recorder {
  // onState({ recording, mode, seconds }) is told on start, once a second, and on stop.
  constructor({ onState = () => {} } = {}) {
    this.onState = onState;
    this.recorder = null;
    this.chunks = [];
    this.mode = null;
    this.startedAt = 0;
    this.tracks = [];
    this.timer = null;
    this.starting = false;
  }

  get recording() {
    return !!this.recorder && this.recorder.state !== 'inactive';
  }

  // houseCanvas is the House <canvas>; used only in 'house' mode.
  async start(mode, { houseCanvas = null } = {}) {
    if (this.starting || this.recording) return;
    const unsupported = captureSupport();
    if (unsupported) throw new Error(unsupported);
    if (!CAPTURE_MODES[mode]) throw new Error(`Unknown capture mode: ${mode}`);

    this.starting = true;
    this.onState({ recording: false, mode, seconds: 0, starting: true });
    let tracks = [];
    try {
      const videoTrack = mode === 'house'
        ? this.houseTrack(houseCanvas)
        : await this.screenTrack();
      tracks = [videoTrack];
      const audioTrack = music.captureAudio();
      if (audioTrack) tracks.push(audioTrack);

      const mimeType = pickMime();
      const stream = new MediaStream(tracks);
      const recorder = new MediaRecorder(stream, mimeType
        ? { mimeType, videoBitsPerSecond: 6_000_000 }
        : { videoBitsPerSecond: 6_000_000 });
      this.tracks = tracks;
      this.recorder = recorder;
      this.chunks = [];
      this.mode = mode;
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
      recorder.onstop = () => this.finish();
      // The browser's own "stop sharing" button ends the recording cleanly rather than leaving it hanging.
      if (mode === 'app') videoTrack.addEventListener('ended', () => this.stop());

      recorder.start(1000);
      this.startedAt = Date.now();
      this.timer = setInterval(() => this.report(), 1000);
      this.report();
    } catch (err) {
      for (const track of tracks) track.stop();
      this.tracks = [];
      this.recorder = null;
      this.chunks = [];
      this.mode = null;
      music.stopCaptureAudio();
      throw err;
    } finally {
      this.starting = false;
      this.onState({ recording: this.recording, mode: this.mode, seconds: this.recording ? Math.floor((Date.now() - this.startedAt) / 1000) : 0, starting: false });
    }
  }

  stop() {
    if (this.recording) this.recorder.stop();
  }

  houseTrack(canvas) {
    if (!canvas || typeof canvas.captureStream !== 'function') {
      throw new Error('The House view is not on screen to record.');
    }
    const track = canvas.captureStream(30).getVideoTracks()[0];
    if (!track) throw new Error('This browser cannot take a picture from the House view.');
    return track;
  }

  async screenTrack() {
    const media = typeof navigator !== 'undefined' && navigator.mediaDevices;
    if (!media || typeof media.getDisplayMedia !== 'function') {
      throw new Error('Screen sharing is not available in this browser, so the whole app cannot be recorded.');
    }
    // Only the picture is taken from the share. The sound is the show's own mix, so the
    // share's audio is refused to keep it from being recorded twice.
    const share = await media.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
      preferCurrentTab: true,
    });
    const track = share.getVideoTracks()[0];
    if (!track) throw new Error('No picture was shared.');
    return track;
  }

  report() {
    this.onState({
      recording: this.recording,
      mode: this.mode,
      seconds: Math.floor((Date.now() - this.startedAt) / 1000),
    });
  }

  finish() {
    clearInterval(this.timer);
    this.timer = null;
    const type = (this.recorder && this.recorder.mimeType) || 'video/webm';
    const blob = new Blob(this.chunks, { type });
    const mode = this.mode;
    for (const t of this.tracks) t.stop();
    music.stopCaptureAudio();
    this.tracks = [];
    this.recorder = null;
    this.chunks = [];
    this.mode = null;
    if (blob.size) this.download(blob, mode);
    this.onState({ recording: false, mode, seconds: 0, blob });
  }

  download(blob, mode) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = captureFileName(mode);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
