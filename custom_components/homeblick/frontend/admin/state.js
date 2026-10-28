// Gemeinsamer Zustand des Admins: Verbindung, Displays, Entwurf der Konfiguration (mit Rückgängig) und Speichern.
import { tx, LOC } from '../i18n.js';
import { normFaces } from '../faces.js';
import { loadEntities } from './entities.js';
import { ask, guard, sleep, toast } from './ui.js';

export const S = {
  conn: null, displays: [], shots: {}, states: {}, pipelines: [], ttss: [],
  cams: { cameras: { list: [], bell: null }, auto: true }, camEnts: [],
  sel: null, cfg: null, rev: 0, saved: '', undo: [], redo: [], busy: false, justSaved: false,
  ui: { sel: null, insert: null, page: null },   // Auswahl im Editor: { k: 'page', f } | { k: 'tile', f, j } | { k: 'tiles', f, js } | null; insert = markierte leere Zelle { f, cell }; page = Seite im Vordergrund
};
export const call = (type, p = {}) => S.conn.sendMessagePromise({ type: 'homeblick/' + type, ...p });
/** Auswahl im Editor setzen (Seite oder Kachel); insert merkt eine markierte leere Zelle. */
export function select(sel, insert = null) { S.ui.sel = sel; S.ui.insert = insert; if (sel?.f) S.ui.page = sel.f; else if (insert?.f) S.ui.page = insert.f; emit('sel'); }
export const cur = () => S.displays.find(d => d.id === S.sel);
export const byId = id => S.displays.find(d => d.id === id);

// ---- kleiner Ereignisbus: 'doc' (Entwurf geändert), 'list' (Displays geändert) ----
const subs = {};
export const on = (k, f) => ((subs[k] ||= new Set()).add(f), () => subs[k].delete(f));
export const emit = (k, a) => subs[k]?.forEach(f => f(a));

// ---- Verbindung & Start ----
async function connect() {
  // Im HA-Panel die Verbindung des HA-Frontends (gleicher Origin) statt eines zweiten Logins
  const p = (() => { try { return parent !== window && parent.hassConnection; } catch { return null; } })();
  if (p) return (await p).conn;
  const ha = await import('../vendor/ha-websocket.js');
  const auth = await ha.getAuth({ hassUrl: location.origin, saveTokens: t => localStorage.hassTokens = JSON.stringify(t), loadTokens: async () => JSON.parse(localStorage.hassTokens || 'null') });
  if (location.search.includes('auth_callback')) history.replaceState(null, '', location.pathname);
  return ha.createConnection({ auth, setupRetry: -1 });
}
export async function start() {
  S.conn = await connect();
  const [states, pl, cs] = await Promise.all([S.conn.sendMessagePromise({ type: 'get_states' }), S.conn.sendMessagePromise({ type: 'assist_pipeline/pipeline/list' }).catch(() => null), call('cameras').catch(() => null)]);
  if (cs) S.cams = cs;
  const nameOf = x => x.attributes.friendly_name || x.entity_id;
  S.camEnts = states.filter(x => x.entity_id.startsWith('camera.')).map(x => [x.entity_id, nameOf(x)]).sort((a, b) => a[1].localeCompare(b[1], LOC));
  await loadEntities(S.conn, states);
  S.states = Object.fromEntries(states.map(x => [x.entity_id, x]));
  S.ttss = states.filter(x => x.entity_id.startsWith('tts.')).map(x => [x.entity_id, nameOf(x)]);
  S.pipelines = pl?.pipelines?.map(p => [p.id, p.name]) || [];
  await reload();
  setInterval(() => { if (!document.hidden) loadStates(); }, 15000);
  setInterval(() => { if (!document.hidden && !document.querySelector('input:focus,.dialog')) poll(); }, 5000);
}
export const loadStates = () => S.conn.sendMessagePromise({ type: 'get_states' }).then(a => { S.states = Object.fromEntries(a.map(x => [x.entity_id, x])); emit('states'); }).catch(() => {});

// ---- Displays ----
export async function reload() {
  S.displays = await call('displays');
  const todo = S.displays.filter(d => !d.new && !S.shots[d.id]);   // letztes Bild vom Server (auch offline) vor dem ersten Zeichnen holen, sonst blitzt erst der Platzhalter
  await Promise.all(todo.map(async d => { const { image } = await call('get_shot', { display: d.id }).catch(() => ({})); if (image) S.shots[d.id] = image; }));
  emit('list'); perfNotice();
  todo.filter(d => d.connected).forEach(d => snap(d.id));   // neues Bild im Hintergrund
}
// Popup, sobald ein Display im Leistungsmodus läuft (einmal je Zustand): „Deaktivieren“ schaltet ihn und die automatische Erkennung aus
const perfSeen = new Set();
function perfNotice() {
  for (const d of S.displays) {
    if (!d.connected || !d.info?.perf) { perfSeen.delete(d.id); continue; }
    if (perfSeen.has(d.id)) continue;
    perfSeen.add(d.id);
    toast(d.info.perfAuto ? tx('{name}: Leistungsmodus aktiv, automatisch erkannt. Animationen sind aus.', { name: d.name }) : tx('{name}: Leistungsmodus aktiv. Animationen sind aus.', { name: d.name }), { action: tx('Deaktivieren'), run: () => setSetting(d.id, { perf: false, perfauto: false }).then(() => toast(tx('Leistungsmodus aus, automatische Erkennung aus'))) });
  }
}
export async function poll() {   // Status nachführen, ohne Formulare neu zu zeichnen
  const n = await call('displays').catch(() => null);
  if (!n) return;
  if (n.length !== S.displays.length || n.some(x => !byId(x.id))) return reload();   // auch Tausch (eines weg, eines neu) bei gleicher Anzahl
  let ext = false;   // Einstellungen/Name von außen geändert (HA-Entity, Kontrollzentrum, anderer Admin): Formular neu zeichnen
  n.forEach(x => {
    const d = byId(x.id);
    ext ||= JSON.stringify(d.settings) !== JSON.stringify(x.settings) || d.name !== x.name || d.area !== x.area;
    Object.assign(d, { name: x.name, area: x.area, settings: x.settings, faces: x.faces, new: x.new, connected: x.connected, face: x.face, saver: x.saver, info: x.info, seen: x.seen, logs: x.logs, outdated: x.outdated, windows: x.windows });
  });
  emit('list', ext ? 'ext' : undefined); perfNotice();
}
// Bildschirmfoto als Bild der Karte (das Display antwortet asynchron); null = keine Antwort
export async function snap(id) {
  if (!byId(id)?.connected) return null;
  try {
    await call('command', { display: id, action: 'screenshot' });
    for (let i = 0; i < 10; i++) {
      await sleep(500);
      const { image } = await call('get_shot', { display: id });
      if (image && image !== S.shots[id]) { S.shots[id] = image; emit('list'); return image; }
    }
  } catch { /* Display antwortet nicht */ }
  return null;
}

// ---- Entwurf der Konfiguration ----
// Änderungen am Layout gehen in einen Entwurf (Rückgängig/Wiederholen); erst „Speichern & senden“ schickt sie an das Display.
const snapOf = c => JSON.stringify(c);
export const dirty = () => !!S.cfg && snapOf(S.cfg) !== S.saved;
export async function openDoc(id) {
  const c = await call('get_config', { display: id }).catch(() => null);
  if (!c?.config?.faces) { S.sel = id; S.cfg = null; S.saved = ''; S.undo = []; S.redo = []; emit('doc'); return false; }
  S.sel = id; S.cfg = c.config; S.rev = c.rev ?? 0; normFaces(S.cfg); S.saved = snapOf(S.cfg); S.undo = []; S.redo = []; S.justSaved = false; S.ui = { sel: null, insert: null, page: null };
  emit('doc'); return true;
}
export function closeDoc() { S.sel = null; S.cfg = null; S.saved = ''; S.undo = []; S.redo = []; S.ui = { sel: null, insert: null, page: null }; emit('doc'); }
let lastKey = '', lastAt = 0;
/** Ändert den Entwurf: fn(cfg) verändert ihn; label benennt den Schritt; merge fasst schnelle gleiche Änderungen (Tippen) zusammen. */
export function mutate(label, fn, merge) {
  if (!S.cfg) return;
  const before = snapOf(S.cfg), now = Date.now();
  fn(S.cfg);
  if (snapOf(S.cfg) === before) return;
  if (!(merge && merge === lastKey && now - lastAt < 1200)) { S.undo.push({ label, json: before }); if (S.undo.length > 100) S.undo.shift(); }
  lastKey = merge || ''; lastAt = now; S.redo = []; S.justSaved = false;
  emit('doc');
}
export function undo() {
  const u = S.undo.pop(); if (!u) return;
  S.redo.push({ label: u.label, json: snapOf(S.cfg) }); S.cfg = JSON.parse(u.json); lastKey = ''; S.justSaved = false; emit('doc', 'undo');
  toast(tx('Rückgängig: {label}', { label: u.label }), { action: tx('Wiederholen‖Redo'), run: redo });
}
export function redo() {
  const r = S.redo.pop(); if (!r) return;
  S.undo.push({ label: r.label, json: snapOf(S.cfg) }); S.cfg = JSON.parse(r.json); lastKey = ''; S.justSaved = false; emit('doc', 'undo');
}
export async function save() {
  if (!S.cfg || S.busy) return;
  const id = S.sel, sent = snapOf(S.cfg);   // gesendeter Stand: Änderungen während des Sendens bleiben „nicht gesendet“
  S.busy = true; emit('doc');
  try {
    const slow = () => new Promise((_, no) => setTimeout(() => no(new Error(tx('Keine Verbindung zu Home Assistant'))), 15000));   // tote Verbindung hält sonst „Sendet …“ ewig; je Versuch neu (der Überschreiben-Dialog kann länger dauern)
    const send = base_rev => Promise.race([call('admin_config', { display: id, config: JSON.parse(sent), base_rev }), slow()]);
    const r = await guard(send(S.rev).catch(async e => {   // base_rev: Stand beim Öffnen; jemand anderes hat inzwischen gesendet
      if (e?.code !== 'conflict') throw e;
      const a = await ask(tx('Die Konfiguration dieses Displays wurde inzwischen von jemand anderem geändert. Überschreiben löscht diese Änderungen, Neu laden verwirft deinen Entwurf.'), { alt: tx('Neu laden'), ok: tx('Überschreiben'), danger: true });
      if (a === 'alt') await openDoc(id);
      return a === true ? send(undefined) : false;   // ohne base_rev: bewusst überschreiben
    }));
    if (r !== false) {   // false: Konflikt, nicht gesendet
      if (S.sel === id) { S.saved = sent; S.rev = r?.rev ?? S.rev; S.justSaved = !dirty(); }
      setTimeout(() => snap(id), 2500);
    }
  }
  catch { /* guard zeigt den Fehler */ }
  S.busy = false; emit('doc');
}
export function discard() { if (S.saved) { S.cfg = JSON.parse(S.saved); S.undo = []; S.redo = []; emit('doc', 'undo'); } }
/** Konfiguration nach Import/Übernehmen neu laden. */
export async function reloadDoc() { const id = S.sel; await openDoc(id); }

// ---- Einstellungen eines Displays: sofort wirksam, kein Entwurf ----
export function setSetting(id, patch) {
  const d = byId(id); if (!d) return Promise.resolve();
  const old = Object.fromEntries(Object.keys(patch).map(k => [k, d.settings[k]]));
  Object.assign(d.settings, patch); emit('list');
  return guard(call('update', { display: id, settings: patch })).catch(() => { Object.assign(d.settings, old); emit('list', 'ext'); });   // vom Server abgelehnt: Anzeige zurück auf den echten Stand
}
