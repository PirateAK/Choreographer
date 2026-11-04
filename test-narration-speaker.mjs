// Narration speakers: a clip is attached to a cast member, un-attached clips have no speaker,
// and a cast member with clips attached is reported so removal can be blocked.
import assert from 'node:assert/strict';
import { addNarration, setNarrationSpeaker, clipsSpokenBy } from './src/model.js';

const show = { narration: [], cast: [{ id: 'd1', name: 'Ada', number: 1 }, { id: 'd2', name: 'Bea', number: 2 }] };

// A clip added without a speaker has none, and is not spoken by anyone.
const a = addNarration(show, { key: 'k1', name: '01', length: 5000, at: 0 });
assert.equal(a.speaker, null);
assert.deepEqual(clipsSpokenBy(show, 'd1'), []);

// Attaching it makes Ada the speaker; only Ada's clips are listed for her.
setNarrationSpeaker(show, a.id, 'd1');
assert.equal(a.speaker, 'd1');
assert.deepEqual(clipsSpokenBy(show, 'd1').map((c) => c.id), [a.id]);
assert.deepEqual(clipsSpokenBy(show, 'd2'), []);

// Un-attaching clears the speaker, and the clip is no longer Ada's.
setNarrationSpeaker(show, a.id, '');
assert.equal(a.speaker, null);
assert.deepEqual(clipsSpokenBy(show, 'd1'), []);

// Several clips can share a speaker, and a speaker can be changed.
const b = addNarration(show, { key: 'k2', name: '02', length: 3000, speaker: 'd2' });
const c = addNarration(show, { key: 'k3', name: '03', length: 3000, speaker: 'd1' });
assert.deepEqual(clipsSpokenBy(show, 'd2').map((x) => x.id), [b.id]);
setNarrationSpeaker(show, c.id, 'd2');
assert.deepEqual(clipsSpokenBy(show, 'd2').map((x) => x.id), [b.id, c.id]);
assert.deepEqual(clipsSpokenBy(show, 'd1'), []);

// No speaker id means nothing is spoken by anyone.
assert.deepEqual(clipsSpokenBy(show, null), []);
console.log('narration speakers: attach, un-attach, reassign, and blocked-removal lookup passed');
