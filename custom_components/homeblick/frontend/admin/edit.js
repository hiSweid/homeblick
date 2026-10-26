// Bearbeiten von Seiten (Faces) und Kacheln im Entwurf: jede Funktion ist genau ein Rückgängig-Schritt.
import { faceId, moveTo, pack, rows, GROUP } from '../faces.js';
import { S, mutate, select, undo } from './state.js';
import { toast } from './ui.js';
import { faceName, tileOf, tileTitle, bgVal, FACE_BG } from './meta.js';

export const faceBy = id => S.cfg?.faces.find(f => f.id === id);
export const faceIx = id => S.cfg?.faces.findIndex(f => f.id === id) ?? -1;
export const tilesOf = f => f.tiles || [];
export const fits = f => pack(tilesOf(f), rows(f)).every(Boolean);   // alle Kacheln haben einen Platz im 3er-Raster
export const lost = f => pack(tilesOf(f), rows(f)).filter(p => !p).length;
export const used = f => tilesOf(f).reduce((n, t) => n + (t.w || 1) * (t.h || 1), 0);
export const cells = f => rows(f) * 3;
const NO_ROOM = 'Kein Platz mehr auf dieser Seite: erst eine Kachel verkleinern oder entfernen';

/** Seite, auf die neue Kacheln kommen: die gewählte (wenn Smart Home), sonst die erste Smart-Home-Seite. */
export function targetFace() {
  const sel = S.ui.sel, f = sel && faceBy(sel.f);
  return f?.type === 'grid' ? f : S.cfg.faces.find(x => x.type === 'grid') || null;
}

// ---- Kacheln ----
export const widgetTile = kind => kind === 'wx' ? { kind: 'wx', w: 2 } : kind === 'digital' ? { kind: 'clock', cs: 'digital', w: 2, h: 1 } : { kind: 'clock', w: 2, h: 2 };

/** Kachel(n) am Ende bzw. auf der markierten Zelle einer Seite einfügen; liefert die neuen Kacheln oder null (kein Platz). */
export function addTiles(list, label, { face = targetFace(), pickIt = true } = {}) {
  if (!face) { toast('Kacheln gibt es auf Smart-Home-Seiten: lege über „Seite hinzufügen“ eine an', { bad: true }); return null; }
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
export const addEntity = en => addTiles([tileOf(en)], `${tileTitle(tileOf(en))} hinzugefügt`);
export const addWidget = kind => addTiles([widgetTile(kind)], `${{ wx: 'Wetter', analog: 'Uhr', digital: 'Uhr' }[kind]} hinzugefügt`);

export function removeTiles(fid, js) {
  const f = faceBy(fid); if (!f) return;
  const names = js.map(j => tileTitle(f.tiles[j]));
  mutate(js.length > 1 ? `${js.length} Kacheln entfernt` : `${names[0]} entfernt`, () => { [...js].sort((a, b) => b - a).forEach(j => faceBy(fid).tiles.splice(j, 1)); });
  select({ k: 'page', f: fid });
  toast(js.length > 1 ? `${js.length} Kacheln entfernt` : `„${names[0]}“ entfernt`, { action: 'Rückgängig', run: undo });
}
export function moveTile(fid, j, to) {
  const from = faceBy(fid), dest = faceBy(to);
  if (!from || !dest || dest.type !== 'grid' || from === dest) return;
  let ok = true;
  mutate(`${tileTitle(from.tiles[j])} auf eine andere Seite verschoben`, () => {
    const a = faceBy(fid), b = faceBy(to), [t] = a.tiles.splice(j, 1), n0 = lost(b);
    (b.tiles ||= []).push(t);
    if (!pack(b.tiles, rows(b)).at(-1) || lost(b) > n0) { b.tiles.pop(); a.tiles.splice(j, 0, t); ok = false; }
  });
  if (!ok) return toast(`Auf „${faceName(dest)}“ ist kein Platz`, { bad: true });
  select({ k: 'tile', f: to, j: faceBy(to).tiles.length - 1 });
  toast(`Verschoben nach „${faceName(dest)}“`);
}
export function resizeTile(fid, j, w, h) {
  const f = faceBy(fid), t = f?.tiles[j]; if (!t) return true;
  const was = [t.w, t.h], n = lost(f);
  let ok = true;
  mutate('Größe geändert', () => {
    const x = faceBy(fid).tiles[j];
    w > 1 ? x.w = w : delete x.w; h > 1 ? x.h = h : delete x.h;
    if (lost(faceBy(fid)) > n) { was[0] ? x.w = was[0] : delete x.w; was[1] ? x.h = was[1] : delete x.h; ok = false; }
  });
  if (!ok) toast('Kein Platz für diese Größe', { bad: true });
  return ok;
}

// ---- Kopieren und Einfügen (übersteht Display- und Tabwechsel) ----
const CLIP = 'hb-admin.copied';
const clipGet = () => { try { return JSON.parse(localStorage.getItem(CLIP)) || []; } catch { return []; } };
export const hasClip = () => clipGet().length > 0;
export function copyTiles(fid, js, cut) {
  const f = faceBy(fid); if (!f || !js.length) return;
  try { localStorage.setItem(CLIP, JSON.stringify(js.map(j => f.tiles[j]))); } catch { return toast('Der Browser erlaubt kein Zwischenspeichern', { bad: true }); }
  const n = js.length;
  if (cut) removeTiles(fid, js), toast(`${n} Kachel${n > 1 ? 'n' : ''} ausgeschnitten`, { action: 'Rückgängig', run: undo });
  else toast(`${n} Kachel${n > 1 ? 'n' : ''} kopiert. Mit ⌘V auf jeder Seite oder jedem Display einfügen`);
}
export function pasteTiles() {
  const list = clipGet();
  if (!list.length) return toast('Noch nichts kopiert');
  const f = targetFace(), j = addTiles(list, `${list.length} Kachel${list.length > 1 ? 'n' : ''} eingefügt`, { face: f, pickIt: false });
  if (j) { select({ k: 'tile', f: f.id, j: j[0] }); toast(`${list.length} Kachel${list.length > 1 ? 'n' : ''} eingefügt`, { action: 'Rückgängig', run: undo }); }
}

// ---- Seiten ----
export const pageTypes = () => {   // Typen, die man neu anlegen kann (Uhr, Kalender, Datum je Display nur einmal)
  const have = [...S.cfg.faces, ...(S.cfg.off || [])];
  return (types => types.filter(t => !GROUP[t] || (!['analog', 'info'].includes(t) && !have.some(x => GROUP[x.type] === GROUP[t]))))(Object.keys(FACE_BG));
};
export function addPage(type) {
  const id = faceId(S.cfg, type);
  mutate(`Seite „${faceName({ type, id })}“ hinzugefügt`, c => { c.faces.push({ type, id, bg: FACE_BG[type] ?? 'black', ...(type === 'grid' && { tiles: [] }) }); });
  select({ k: 'page', f: id });
  return id;
}
export function showPage(id) {
  mutate('Seite eingeblendet', c => { const i = (c.off || []).findIndex(f => f.id === id); if (i >= 0) c.faces.push(...c.off.splice(i, 1)); });
  select({ k: 'page', f: id });
}
export function hidePage(id) {
  if (S.cfg.faces.length < 2) return toast('Mindestens eine Seite muss bleiben', { bad: true });
  mutate(`Seite „${faceName(faceBy(id))}“ ausgeblendet`, c => { const i = c.faces.findIndex(f => f.id === id); (c.off ||= []).push(...c.faces.splice(i, 1)); });
  select(null);
}
export function removePage(id) {
  if (S.cfg.faces.length < 2) return toast('Mindestens eine Seite muss bleiben', { bad: true });
  const f = faceBy(id), n = tilesOf(f).length, name = faceName(f);
  mutate(`Seite „${name}“ gelöscht`, c => { c.faces.splice(c.faces.findIndex(x => x.id === id), 1); });
  select(null);
  toast(n ? `Seite „${name}“ und ${n} Kachel${n > 1 ? 'n' : ''} gelöscht` : `Seite „${name}“ gelöscht`, { action: 'Rückgängig', run: undo });
}
export function duplicatePage(id) {
  const f = faceBy(id);
  if (GROUP[f.type]) return toast('Uhr, Kalender und Datum gibt es je Display nur einmal', { bad: true });
  const nid = faceId(S.cfg, f.type);
  mutate(`Seite „${faceName(f)}“ dupliziert`, c => { const i = c.faces.findIndex(x => x.id === id); c.faces.splice(i + 1, 0, { ...structuredClone(f), id: nid }); });
  select({ k: 'page', f: nid });
}
export function movePage(from, to) {
  const n = S.cfg.faces.length;
  if (from === to || to < 0 || to >= n) return;
  mutate(`Seite „${faceName(S.cfg.faces[from])}“ auf Platz ${to + 1} verschoben`, c => { const [f] = c.faces.splice(from, 1); c.faces.splice(to, 0, f); });
}
/** Hintergrund / Design einer Seite (Wert aus data-Attributen). */
export const setBg = (id, v) => mutate('Hintergrund geändert', () => { faceBy(id).bg = bgVal(v); });
