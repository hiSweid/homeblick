// Sprachausgabe (frontend/speak.js): Musik anderer Player runter und wieder hoch, Ansage am Player per announce: node tests/speak.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../custom_components/homeblick/frontend/speak.js', import.meta.url));
const { playSpeech } = await import('data:text/javascript;base64,' + src.toString('base64'));
globalThis.Audio = class { constructor() { setTimeout(() => { this.duration = 0.01; this.onloadedmetadata?.(); }, 0); } };   // Datei-Dauer 10 ms
const calls = [], conn = { sendMessagePromise: m => (calls.push(m.service_data && { s: m.service, ...m.service_data }), Promise.resolve()) };
const mp = (id, state, v, dc) => ({ entity_id: id, state, attributes: { volume_level: v, device_class: dc } });
const ents = { 'media_player.a': mp('media_player.a', 'playing', 0.5), 'media_player.b': mp('media_player.b', 'paused', 0.5), 'media_player.tv': mp('media_player.tv', 'playing', 0.5, 'tv'), 'media_player.out': mp('media_player.out', 'playing', 0.8) };
const s = playSpeech(conn, () => ents, { path: '/x.mp3', media: 'http://ha/x.mp3', out: 'media_player.out', duck: 30, volume: 60 });
assert.deepEqual(calls.map(c => [c.s, c.entity_id]), [['volume_set', 'media_player.a'], ['play_media', 'media_player.out']]);   // nur laufende, kein TV, nicht das Ausgabegerät
assert.equal(calls[0].volume_level, 0.15);
assert.deepEqual([calls[1].announce, calls[1].extra.volume], [true, 60]);
await s.done;
assert.deepEqual(calls[2], { s: 'volume_set', entity_id: 'media_player.a', volume_level: 0.5 });   // zurück auf den alten Wert
calls.length = 0;
playSpeech(conn, () => ents, { path: '/x.mp3', media: 'm', out: 'media_player.out', duck: 100, volume: 60 }).stop();
assert.deepEqual(calls.map(c => c.s), ['play_media']);   // 100 % = nicht senken
console.log('ok');
