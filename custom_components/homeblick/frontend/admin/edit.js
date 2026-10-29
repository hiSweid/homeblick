// Bearbeiten von Seiten (Faces) und Kacheln im Entwurf: jede Funktion ist genau ein Rückgängig-Schritt.
import { faceId, moveTo, pack, rows, GROUP, hasTiles, ENERGY_TILES } from '../faces.js';
import { S, mutate, select, undo } from './state.js';
import { toast } from './ui.js';
import { tx } from '../i18n.js';
import { faceName, tileOf, tileTitle, bgVal, FACE_BG } from './meta.js';

export const faceBy = id => S.cfg?.faces.find(f => f.id === id);
export const faceIx = id => S.cfg?.faces.findIndex(f => f.id === id) ?? -1;
export const tilesOf = f => f.tiles || [];
export const fits = f => pack(tilesOf(f), rows(f)).every(Boolean);   // alle Kacheln haben einen Platz im 3er-Raster
export const lost = f => pack(tilesOf(f), rows(f)).filter(p => !p).length;
export const used = f => tilesOf(f).reduce((n, t) => n + (t.w || 1) * (t.h || 1), 0);
export const cells = f => rows(f) * 3;
const NO_ROOM = tx('Kein Platz mehr auf dieser Ansicht: erst eine Kachel verkleinern oder entfernen');

/** Seite, auf die neue Kacheln kommen: die gewählte bzw. vordere (wenn Smart Home), sonst die erste Smart-Home-Seite. */
export function targetFace() {
  const f = faceBy(S.ui.sel?.f || S.ui.insert?.f || S.ui.page);
  return f && hasTiles(f) ? f : S.cfg.faces.find(x => x.type === 'grid') || S.cfg.faces.find(hasTiles) || null;
}
/** Energie-Kacheln (kind 'en') gibt es nur auf der Energie-Ansicht, alles andere auf beiden. */
export const canHold = (f, t) => f.type === 'energy' || (f.type === 'grid' && t.kind !== 'en');

// ---- Kacheln ----
export const widgetTile = kind => kind.startsWith('en:') ? { kind: 'en', k: kind.slice(3), ...(kind === 'en:pv' && { w: 2 }) } : kind === 'wx' ? { kind: 'wx', w: 2 } : kind === 'digital' ? { kind: 'clock', cs: 'digital', w: 2, h: 1 } : { kind: 'clock', w: 2, h: 2 };

/** Kachel(n) am Ende bzw. auf der markierten Zelle einer Seite einfügen; liefert die neuen Kacheln oder null (kein Platz). */
export function addTiles(list, label, { face = targetFace(), pickIt = true } = {}) {
  if (!face) { toast(tx('Kacheln gibt es auf Smart-Home-Ansichten: lege über „Ansicht hinzufügen“ eine an'), { bad: true }); return null; }
  list = list.filter(t => canHold(face, t));
  if (!list.length) { toast(tx('Energie-Kacheln gibt es nur auf der Energie-Ansicht'), { bad: true }); return null; }
  const cell = S.ui.insert?.f === face.id ? S.ui.insert.cell : null;
  let added = null;
  mutate(label, () => {
    const f = faceBy(face.id);
    f.tiles ||= [];
    const keep = f.tiles.slice(), n0 = lost(f), fresh = list.map(t => structuredClone(t));
    for (const t of fresh) {
      f.tiles.push(t);
      if (cell && t === fresh[0]) f.tiles = moveTo(f.tiles, f.tiles.length - 1, cell, rows(f));
    }
    const p = pack(f.tiles, rows(f));
    if (fresh.some(t => !p[f.tiles.indexOf(t)]) || lost(f) > n0) { f.tiles = keep; return; }   // passt nicht: Änderung zurücknehmen (kein Verlaufsschritt)
    added = fresh.map(t => f.tiles.indexOf(t));
  });
  if (!added) { toast(NO_ROOM, { bad: true }); return null; }
  if (pickIt) select({ k: 'tile', f: face.id, j: added[0] }, null);
  else S.ui.insert = null;
  S.flash = { f: face.id, j: added[0] };
  return added;
}
export const addEntity = en => addTiles([tileOf(en)], tx('{name} hinzugefügt', { name: tileTitle(tileOf(en)) }));
export const addWidget = kind => addTiles([widgetTile(kind)], tx('{name} hinzugefügt', { name: { wx: tx('Wetter'), analog: tx('Uhr'), digital: tx('Uhr') }[kind] }));

export function removeTiles(fid, js) {
  const f = faceBy(fid); if (!f) return;
  const names = js.map(j => tileTitle(f.tiles[j]));
  mutate(js.length > 1 ? tx('{n} Kacheln entfernt', { n: js.length }) : tx('{name} entfernt', { name: names[0] }), () => { [...js].sort((a, b) => b - a).forEach(j => faceBy(fid).tiles.splice(j, 1)); });
  select(null);
  toast(js.length > 1 ? tx('{n} Kacheln entfernt', { n: js.length }) : tx('„{name}“ entfernt', { name: names[0] }), { action: tx('Rückgängig'), run: undo });
}
export function moveTile(fid, j, to) {
  const from = faceBy(fid), dest = faceBy(to);
  if (!from || !dest || !canHold(dest, from.tiles[j]) || from === dest) return;
  let ok = true;
  mutate(tx('{name} auf eine andere Ansicht verschoben', { name: tileTitle(from.tiles[j]) }), () => {
    const a = faceBy(fid), b = faceBy(to), [t] = a.tiles.splice(j, 1), n0 = lost(b);
    (b.tiles ||= []).push(t);
    if (!pack(b.tiles, rows(b)).at(-1) || lost(b) > n0) { b.tiles.pop(); a.tiles.splice(j, 0, t); ok = false; }
  });
  if (!ok) return toast(tx('Auf „{name}“ ist kein Platz', { name: faceName(dest) }), { bad: true });
  select({ k: 'tile', f: to, j: faceBy(to).tiles.length - 1 });
  toast(tx('Verschoben nach „{name}“', { name: faceName(dest) }));
}
export function resizeTile(fid, j, w, h) {
  const f = faceBy(fid), t = f?.tiles[j]; if (!t) return true;
  const was = [t.w, t.h], n = lost(f);
  let ok = true;
  mutate(tx('Größe geändert'), () => {
    const x = faceBy(fid).tiles[j];
    w > 1 ? x.w = w : delete x.w; h > 1 ? x.h = h : delete x.h;
    if (lost(faceBy(fid)) > n) { was[0] ? x.w = was[0] : delete x.w; was[1] ? x.h = was[1] : delete x.h; ok = false; }
  });
  if (!ok) toast(tx('Kein Platz für diese Größe'), { bad: true });
  return ok;
}

/** Mehrere Kacheln auf einmal in eine Größe bringen (ein Schritt); passt eine dann nicht, bleibt alles wie es war. */
export function resizeTiles(fid, js, w, h) {
  const f = faceBy(fid); if (!f) return false;
  const was = js.map(j => [f.tiles[j].w, f.tiles[j].h]), n = lost(f);
  let ok = true;
  mutate(tx('{n} Kacheln: Größe geändert', { n: js.length }), () => {
    const g = faceBy(fid);
    js.forEach(j => { const x = g.tiles[j]; w > 1 ? x.w = w : delete x.w; h > 1 ? x.h = h : delete x.h; });
    if (lost(g) > n) { js.forEach((j, i) => { const x = g.tiles[j]; was[i][0] ? x.w = was[i][0] : delete x.w; was[i][1] ? x.h = was[i][1] : delete x.h; }); ok = false; }
  });
  if (!ok) toast(tx('Kein Platz für diese Größe'), { bad: true });
  return ok;
}

// ---- Kopieren und Einfügen (übersteht Display- und Tabwechsel) ----
const CLIP = 'hb-admin.copied';
const clipGet = () => { try { return JSON.parse(localStorage.getItem(CLIP)) || []; } catch { return []; } };
export const hasClip = () => clipGet().length > 0;
export function copyTiles(fid, js, cut) {
  const f = faceBy(fid); if (!f || !js.length) return;
  try { localStorage.setItem(CLIP, JSON.stringify(js.map(j => f.tiles[j]))); } catch { return toast(tx('Der Browser erlaubt kein Zwischenspeichern'), { bad: true }); }
  const n = js.length;
  if (cut) removeTiles(fid, js), toast(n > 1 ? tx('{n} Kacheln ausgeschnitten', { n }) : tx('1 Kachel ausgeschnitten'), { action: tx('Rückgängig'), run: undo });
  else toast(n > 1 ? tx('{n} Kacheln kopiert. Mit ⌘V auf jeder Ansicht oder jedem Display einfügen', { n }) : tx('1 Kachel kopiert. Mit ⌘V auf jeder Ansicht oder jedem Display einfügen'));
}
export function pasteTiles() {
  const list = clipGet();
  if (!list.length) return toast(tx('Noch nichts kopiert'));
  const f = targetFace(), j = addTiles(list, list.length > 1 ? tx('{n} Kacheln eingefügt', { n: list.length }) : tx('1 Kachel eingefügt'), { face: f, pickIt: false });
  if (j) { select({ k: 'tile', f: f.id, j: j[0] }); toast(list.length > 1 ? tx('{n} Kacheln eingefügt', { n: list.length }) : tx('1 Kachel eingefügt'), { action: tx('Rückgängig'), run: undo }); }
}

// ---- Seiten ----
export const pageTypes = () => {   // Typen, die man neu anlegen kann (Uhr, Kalender, Datum je Display nur einmal)
  const have = [...S.cfg.faces, ...(S.cfg.off || [])];
  return (types => types.filter(t => !GROUP[t] || (!['analog', 'info'].includes(t) && !have.some(x => GROUP[x.type] === GROUP[t]))))(Object.keys(FACE_BG));
};
export function addPage(type) {
  const id = faceId(S.cfg, type);
  mutate(tx('Ansicht „{name}“ hinzugefügt', { name: faceName({ type, id }) }), c => { c.faces.push({ type, id, bg: FACE_BG[type] ?? 'black', ...(type === 'grid' && { tiles: [] }), ...(type === 'energy' && { style: 'list', tiles: structuredClone(ENERGY_TILES) }) }); });
  select({ k: 'page', f: id });
  return id;
}
export function showPage(id) {
  mutate(tx('Ansicht eingeblendet'), c => { const i = (c.off || []).findIndex(f => f.id === id); if (i >= 0) c.faces.push(...c.off.splice(i, 1)); });
  select({ k: 'page', f: id });
}
export function hidePage(id) {
  if (S.cfg.faces.length < 2) return toast(tx('Mindestens eine Ansicht muss bleiben'), { bad: true });
  const name = faceName(faceBy(id));
  mutate(tx('Ansicht „{name}“ ausgeblendet', { name }), c => { const i = c.faces.findIndex(f => f.id === id); (c.off ||= []).push(...c.faces.splice(i, 1)); });
  select(null);
  toast(tx('Ansicht „{name}“ ausgeblendet', { name }), { action: tx('Rückgängig'), run: undo });
}
export function removePage(id) {
  if (S.cfg.faces.length < 2) return toast(tx('Mindestens eine Ansicht muss bleiben'), { bad: true });
  const f = faceBy(id), n = tilesOf(f).length, name = faceName(f);
  mutate(tx('Ansicht „{name}“ gelöscht', { name }), c => {
    c.faces.splice(c.faces.findIndex(x => x.id === id), 1);
    for (const g of [...c.faces, ...(c.off || [])]) for (const t of g.tiles || []) for (const a of ['tap', 'hold']) if (t[a]?.face === id) delete t[a];   // Verweise auf die gelöschte Ansicht fallen auf die Standardaktion zurück
  });
  select(null);
  toast(n ? (n > 1 ? tx('Ansicht „{name}“ und {n} Kacheln gelöscht', { name, n }) : tx('Ansicht „{name}“ und 1 Kachel gelöscht', { name })) : tx('Ansicht „{name}“ gelöscht', { name }), { action: tx('Rückgängig'), run: undo });
}
export function duplicatePage(id) {
  const f = faceBy(id);
  if (GROUP[f.type]) return toast(tx('Uhr, Kalender und Datum gibt es je Display nur einmal'), { bad: true });
  const nid = faceId(S.cfg, f.type);
  mutate(tx('Ansicht „{name}“ dupliziert', { name: faceName(f) }), c => { const i = c.faces.findIndex(x => x.id === id); c.faces.splice(i + 1, 0, { ...structuredClone(f), id: nid }); });
  select({ k: 'page', f: nid });
}
export function movePage(from, to) {
  const n = S.cfg.faces.length;
  if (from === to || to < 0 || to >= n) return;
  mutate(tx('Ansicht „{name}“ auf Platz {n} verschoben', { name: faceName(S.cfg.faces[from]), n: to + 1 }), c => { const [f] = c.faces.splice(from, 1); c.faces.splice(to, 0, f); });
}
/** Hintergrund / Design einer Seite (Wert aus data-Attributen). */
export const setBg = (id, v) => mutate(tx('Hintergrund geändert'), () => { faceBy(id).bg = bgVal(v); });
