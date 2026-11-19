// Beat-map utilities for the existing millisecond show clock. Estimates are deliberately a
// reviewable grid; they are never presented as ground-truth beat detection.
import { countGrid } from './model.js';

// Estimate beat markers from transient energy in a decoded Web Audio buffer. Work on a 10 ms
// envelope rather than every sample: cheap enough for browser-side use, and adequate for a draft.
export function estimateBeatMarkers(buffer) {
  if (!buffer || !Number.isFinite(buffer.duration) || buffer.duration <= 0 || !buffer.numberOfChannels) return [];
  // Downsample long pieces to at most 90 seconds of the same 50 Hz envelope, distributed over the
  // recording. This keeps the autocorrelation bounded for orchestral files without a worker.
  const rate = 50;
  const stride = Math.max(1, Math.ceil((buffer.duration * rate) / 4500));
  const hop = Math.max(1, Math.floor(buffer.sampleRate / rate)) * stride;
  const effectiveRate = buffer.sampleRate / hop;
  const length = Math.ceil(buffer.length / hop);
  const energy = new Float32Array(length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const a = i * hop;
      const b = Math.min(data.length, a + hop);
      let sum = 0;
      for (let j = a; j < b; j++) sum += data[j] * data[j];
      energy[i] += Math.sqrt(sum / Math.max(1, b - a)) / buffer.numberOfChannels;
    }
  }
  const onset = new Float32Array(length);
  onset[0] = energy[0]; // the track opening counts as an onset from silence
  let mean = 0;
  for (let i = 0; i < length; i++) {
    if (i > 0) onset[i] = Math.max(0, energy[i] - energy[i - 1]);
    mean += onset[i];
  }
  mean /= Math.max(1, length);
  if (mean < 1e-5) return [];
  for (let i = 0; i < length; i++) onset[i] = Math.max(0, onset[i] - mean * 0.35);
  let bestLag = 0;
  let bestScore = -Infinity;
  const minLag = Math.max(1, Math.floor(effectiveRate * 60 / 240));
  const maxLag = Math.min(Math.floor(effectiveRate * 60 / 40), Math.floor(length / 3));
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0;
    const corrStride = Math.max(1, Math.ceil(length / 1000));
    for (let i = lag; i < length; i += corrStride) score += onset[i] * onset[i - lag];
    const bpm = 60 * effectiveRate / lag;
    score *= bpm >= 70 && bpm <= 180 ? 1.025 : 1;
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }
  if (!bestLag || !(bestScore > 0)) return [];
  const period = bestLag / rate;
  let phase = 0;
  let phaseScore = -Infinity;
  for (let p = 0; p < bestLag; p++) {
    let score = 0;
    for (let i = p; i < length; i += bestLag) score += onset[i];
    if (score > phaseScore) { phaseScore = score; phase = p; }
  }
  const beats = [];
  // Find the strongest local transient near each expected beat. The global period estimates tempo;
  // local peak snapping allows rubato/drift to appear as individually editable marker positions.
  for (let expected = phase; expected < length; expected += bestLag) {
    const lo = Math.max(0, Math.round(expected - bestLag * 0.22));
    const hi = Math.min(length - 1, Math.round(expected + bestLag * 0.22));
    let peak = Math.max(0, Math.min(length - 1, Math.round(expected)));
    for (let i = lo; i <= hi; i++) if (onset[i] > onset[peak]) peak = i;
    const ms = Math.round(peak * 1000 / effectiveRate);
    if (!beats.length || ms > beats[beats.length - 1]) beats.push(ms);
  }
  return beats;
}

export function tempoFromMarkers(markers) {
  const gaps = (Array.isArray(markers) ? markers : []).slice(1).map((v, i) => Number(v) - Number(markers[i]))
    .filter((gap) => Number.isFinite(gap) && gap >= 200 && gap <= 3000).sort((a, b) => a - b);
  if (!gaps.length) return null;
  const mid = gaps.length >> 1;
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  return Math.max(20, Math.min(300, Math.round(60000 / median)));
}

export function makeBeatGridMarkers(lengthMs, bpm, phaseMs = 0) {
  const length = Math.max(0, Number(lengthMs) || 0);
  const tempo = Math.max(20, Math.min(300, Number(bpm) || 120));
  const period = 60000 / tempo;
  const phase = Number(phaseMs) || 0;
  const first = ((phase % period) + period) % period;
  const markers = [];
  for (let ms = first; ms < length; ms += period) {
    const at = Math.round(ms);
    if (!markers.length || at > markers[markers.length - 1]) markers.push(at);
  }
  return markers;
}

// Musical counts are 1-based eight-count phrases. Editable marker times are relative to their
// track; beatOne is the index of the marker assigned count one. If markers run out, extrapolate
// using the last interval. Without markers, use the show's existing tempo/downbeat grid.
export function translateCountToMs(show, track, phrase, count) {
  const p = Math.floor(Number(phrase));
  const c = Math.floor(Number(count));
  if (!(p >= 1) || !(c >= 1 && c <= 8)) return null;
  const ordinal = (p - 1) * 8 + c - 1;
  const start = Math.max(0, Math.round(Number(track && track.start) || 0));
  const markers = track && Array.isArray(track.beatMarkers) ? track.beatMarkers : [];
  if (markers.length) {
    const firstIndex = Math.max(0, Math.min(markers.length - 1, Math.round(Number(track.beatOne) || 0)));
    const target = firstIndex + ordinal;
    if (target < markers.length) return start + markers[target];
    const tail = markers.length > 1 ? markers[markers.length - 1] - markers[markers.length - 2] : countGrid(show).count;
    return start + markers[markers.length - 1] + (target - markers.length + 1) * tail;
  }
  const grid = countGrid(show);
  const origin = Number.isFinite(Number(show && show.prefs && show.prefs.downbeat)) && show.prefs.downbeat !== null
    ? Math.max(0, Number(show.prefs.downbeat))
    : start;
  return origin + ordinal * grid.count;
}
