// Audio bytes live in IndexedDB, not in the show file.
//
// A show is a small JSON document; a recording is megabytes. Keeping them apart is
// what lets a show be exported, e-mailed and reopened on another machine, where the
// cue is present and the audio simply reports itself missing until it is attached
// again. Music tracks and narration clips share this one database, told apart by the
// prefix of their key ('music-' and 'voice-').

const DB_NAME = 'choreographer.music.v1';
const STORE = 'files';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no storage'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('no storage'));
  });
}

function idbRun(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error || new Error('storage failed'));
        tx.onabort = () => reject(tx.error || new Error('storage failed'));
      })
  );
}

export const storeAudio = (key, record) => idbRun('readwrite', (s) => s.put(record, key));
export const readAudio = (key) => idbRun('readonly', (s) => s.get(key));
export const dropAudio = (key) => idbRun('readwrite', (s) => s.delete(key));

// A waveform is all a row needs: the loudest sample in each slice, which is enough
// to see where the beats and the quiet bars are — or, for narration, where the
// pauses between sentences fall.
export function peaksOf(buffer, buckets = 900) {
  const data = buffer.getChannelData(0);
  const out = new Float32Array(buckets);
  const size = Math.max(1, Math.floor(data.length / buckets));
  for (let i = 0; i < buckets; i++) {
    let peak = 0;
    const start = i * size;
    const end = Math.min(data.length, start + size);
    for (let j = start; j < end; j++) {
      const v = data[j] < 0 ? -data[j] : data[j];
      if (v > peak) peak = v;
    }
    out[i] = peak;
  }
  return out;
}
