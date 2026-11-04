// Narration bundle: the voice audio for one show, in a single file.
//
// The show file carries the clips (key, name, speaker, timing) but not their bytes,
// which live in this browser's IndexedDB. The bundle carries the bytes too, tied to
// the show by its name and its ID, so the voice can travel with the show and come
// back after a reload or on another machine. Storage is passed in, so this module
// does not touch the browser database itself and can be tested in Node.

const FORMAT = 'choreographer-narration';
const VERSION = 1;

function toBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  return btoa(s);
}

function fromBase64(text) {
  const bin = atob(String(text));
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

// Collects the audio for every clip in the show. A clip whose bytes are missing from
// this browser is listed as missing rather than failing the whole bundle.
export async function buildBundle(show, readAudio) {
  const clips = Array.isArray(show.narration) ? show.narration : [];
  const audio = [];
  const missing = [];
  for (const c of clips) {
    if (!c || !c.key) continue;
    let record = null;
    try {
      record = await readAudio(c.key);
    } catch (e) {
      record = null;
    }
    if (!record || !record.bytes) {
      missing.push(c.key);
      continue;
    }
    audio.push({
      key: String(c.key),
      name: String(record.name || c.name || 'narration'),
      peaks: Array.isArray(record.peaks) ? record.peaks : null,
      bytes: toBase64(record.bytes),
    });
  }
  return {
    format: FORMAT,
    version: VERSION,
    showName: String(show.name || ''),
    showId: String(show.showId || ''),
    audio,
    missing,
  };
}

export function bundleFileName(show) {
  const safe = String(show.name || 'show').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'show';
  return safe + '.narration.json';
}

// Checks a parsed bundle against the open show. Returns a verdict the UI can act on:
// 'ok' (same show), 'other' (a different show: ask before loading), or 'invalid'.
export function checkBundle(bundle, show) {
  if (!bundle || bundle.format !== FORMAT || !Array.isArray(bundle.audio)) return { verdict: 'invalid' };
  if (bundle.showId && bundle.showId === String(show.showId || '')) return { verdict: 'ok' };
  return { verdict: 'other', showName: bundle.showName || 'another show' };
}

// Writes every audio entry back under its key. Entries whose key is not used by the
// open show are still stored, so a later clip attached to them works; the caller
// decides whether to proceed when the show does not match.
export async function applyBundle(bundle, storeAudio) {
  let stored = 0;
  for (const a of bundle.audio) {
    if (!a || !a.key || !a.bytes) continue;
    const bytes = fromBase64(a.bytes);
    try {
      await storeAudio(a.key, { name: a.name, bytes, peaks: a.peaks });
      stored++;
    } catch (e) {
      // Storage blocked for this entry: skip it and report the count.
    }
  }
  return { stored, total: bundle.audio.length };
}

export const BUNDLE_FORMAT = FORMAT;
