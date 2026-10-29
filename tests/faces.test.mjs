// Raster, Konfig-Bereinigung und Bereichs-Umstellung: node tests/faces.test.mjs
import assert from 'node:assert/strict';
import { pack, moveTo, cleanConf, normFaces, rows, ENERGY_TILES } from '../custom_components/homeblick/frontend/faces.js';
import { remapConfig } from '../custom_components/homeblick/frontend/share.js';

// pack: erste freie Stelle von oben links, 2×2 belegt vier Zellen, null = passt nicht
assert.deepEqual(pack([{}, {}, {}, {}], 3), [[0, 0], [0, 1], [0, 2], [1, 0]]);
assert.deepEqual(pack([{ w: 2, h: 2 }, {}, {}], 3), [[0, 0], [0, 2], [1, 2]]);
assert.deepEqual(pack([{ w: 2 }, { w: 2 }], 1), [[0, 0], null]);
assert.deepEqual(pack([{ h: 4 }], 3), [null]);
assert.equal(rows({ greet: true }), 2); assert.equal(rows({}), 3);

// moveTo: Kachel landet auf der Zielzelle, die Reihenfolge der anderen bleibt
const T = ['a', 'b', 'c', 'd'].map(k => ({ k }));
assert.deepEqual(moveTo(T, 0, [0, 2], 3).map(t => t.k), ['b', 'c', 'a', 'd']);
assert.deepEqual(moveTo(T, 3, [0, 0], 3).map(t => t.k), ['d', 'a', 'b', 'c']);

// cleanConf: unbekannte Typen und kaputte Kachelfelder fliegen raus, nichts wirft
const c = cleanConf({ faces: [{ type: 'nope' }, { type: 'grid', tiles: [{ e: 'light.a', w: 9, title: 5, tap: 'x', ents: ['__proto__.x', 'light.b'] }, null, { kind: 'en', k: 'pv' }] }, null, 'x'] });
assert.equal(c.faces.length, 1);
assert.deepEqual(c.faces[0].tiles, [{ e: 'light.a', ents: ['light.b'] }]);   // w ungültig, title/tap falscher Typ, Energiekachel nur auf der Energie-Ansicht
assert.deepEqual(cleanConf({ faces: 'kaputt' }).faces, []);
assert.deepEqual(cleanConf({ faces: [{ type: 'energy' }] }).faces[0].tiles, ENERGY_TILES);   // ohne gespeicherte Kacheln die Standardkacheln
assert.deepEqual(cleanConf({ faces: [{ type: 'energy', tiles: [] }] }).faces[0].tiles, []);   // leeres Feld bleibt leer

// normFaces: Uhr/Kalender nur einmal, fehlende Standard-Faces ausgeschaltet ergänzt, Ids vergeben, zweiter Lauf ändert nichts
const conf = { faces: [{ type: 'bigclock' }, { type: 'analog' }, { type: 'grid', tiles: [] }] };
assert.equal(normFaces(conf, [{ type: 'weather' }, { type: 'bigclock' }]), true);
assert.deepEqual(conf.faces.map(f => f.type), ['bigclock', 'grid']);   // analog = zweite Uhr, wird verworfen
assert.ok(conf.faces.every(f => f.id) && conf.off.some(f => f.type === 'weather') && !conf.off.some(f => f.type === 'bigclock'));
assert.equal(normFaces(conf, [{ type: 'weather' }, { type: 'bigclock' }]), false);

// remapConfig: gleiche Domain + device_class im Zielbereich, jede Entity einmal, ohne Gegenstück fällt die Kachel weg, Nachtvariante weg
const E = { 'light.a': { id: 'light.a', domain: 'light', area: 'Wohnzimmer', name: 'Deckenlicht' }, 'light.k': { id: 'light.k', domain: 'light', area: 'Küche', name: 'Küchenlicht' }, 'lock.a': { id: 'lock.a', domain: 'lock', area: 'Wohnzimmer' } };
const r = remapConfig({ faces: [{ type: 'grid', tiles: [{ e: 'light.a', night: { e: 'light.a' } }, { e: 'light.a' }, { e: 'lock.a' }, { kind: 'clock' }] }] }, 'Küche', { en: id => E[id], inArea: a => Object.values(E).filter(e => e.area === a), title: (e, a) => e.name });
assert.deepEqual(r.config.faces[0].tiles.map(t => t.e ?? t.kind), ['light.k', 'clock']);   // zweite Lampe und Schloss ohne Gegenstück
assert.equal(r.dropped, 2); assert.equal('night' in r.config.faces[0].tiles[0], false); assert.equal(r.config.faces[0].tiles[0].sub, 'Küche');
console.log('ok');
