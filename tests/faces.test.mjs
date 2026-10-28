// Face-ids und Kachel-Bereinigung beim Import: node tests/faces.test.mjs
import assert from 'node:assert/strict';
import { normFaces } from '../custom_components/homeblick/frontend/faces.js';

const c = { faces: [{ type: 'grid', id: 'grid', tiles: [{ e: 'light.a', w: -1e9, tap: { data: 'abc' } }, { e: '__proto__.x' }] }, { type: 'grid', id: 'grid' }, { type: 'music' }, { type: 'weather', id: 'a b' }, { type: 'bogus' }], off: [{ type: 'todo', id: 'todo' }, { type: 'todo', id: 'todo' }] };
normFaces(c);
assert.deepEqual(c.faces.map(f => f.id), ['grid', 'grid2', 'music', 'weather']);   // doppelte und unbrauchbare ids ersetzt, Unbekanntes weg
assert.deepEqual(c.off.map(f => f.id), ['todo', 'todo2']);   // auch gegen die angezeigten eindeutig
const [a, b] = c.faces[0].tiles;
assert.deepEqual([a.w, a.tap.data, b.e], [undefined, undefined, undefined]);   // Größe, Aktionsdaten und Domain __proto__ verworfen
console.log('ok');
