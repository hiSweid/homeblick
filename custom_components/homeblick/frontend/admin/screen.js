// Ansicht eines Displays: Editor (schwebende Leiste, Seiten-Karussell, Dock, Inspector-Karte) oder Einstellungen (Master/Detail).
// Der Entwurf wird laufend im Browser gesichert; nach einem Absturz oder Neuladen bietet eine Zeile an, ihn wiederherzustellen.
import { $, choose, esc, ic, menu, toast } from './ui.js';
import { S, byId, call, cur, dirty, discard, emit, openDoc, redo, save, select, on, undo } from './state.js';
import { ledOf } from './util.js';
import * as layout from './layout.js';
import * as inspector from './inspector.js';
import * as settings from './settings.js';
import { openGallery } from './gallery.js';
import { openPalette } from './palette.js';
import { copyLayoutFrom, exportEsp, exportLayout, importLayout, applyToOthers, removeDisplay, renameDisplay, replaceDraft, screenshot } from './actions.js';
import { copyTiles, faceBy, pasteTiles, removeTiles, tilesOf } from './edit.js';
import { backBtn, gbtn, page } from './nav.js';

const editable = t => t?.closest?.('input,textarea,select,[contenteditable=true]');
const mem = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* Speicher gesperrt */ } }, del: k => { try { localStorage.removeItem(k); } catch { /* Speicher gesperrt */ } } };

export async function mount(el, route) {
  const id = route.id, d0 = byId(id);
  if (!d0 || d0.new) { toast('Dieses Display gibt es nicht (mehr)', { bad: true }); location.hash = '#/'; return; }
  el.innerHTML = '<div class="empty" style="padding-top:34vh"><span class="spin"></span></div>';
  if (S.sel !== id) await openDoc(id);
  if (route.tab === 'settings') return settings.mount(el, route);
  if (!S.cfg) {
    el.innerHTML = page({ title: cur().name, left: backBtn('#/', 'Displays'), right: gbtn(`data-goto="#/d/${encodeURIComponent(id)}/settings"`, 'cog', 'Einstellungen') }, `<div class="empty"><div class="ico48">${ic('monitor')}</div><h2>Noch keine Konfiguration</h2><p>Öffne Homeblick einmal auf dem Gerät, dann erscheinen hier seine Ansichten.</p></div>`);
    return;
  }

  const DK = `hb-admin.draft.${id}`;
  S.draftOffer = null;
  const raw = mem.get(DK);
  if (raw) { try { const o = JSON.parse(raw); if (o.base === S.saved && o.json !== S.saved) S.draftOffer = o; else mem.del(DK); } catch { mem.del(DK); } }

  el.innerHTML = `<div class="ed" id="ed"><div class="ed-bar">
    <div class="ed-l"><button class="back" data-goto="#/" aria-label="Zurück zu den Displays">${ic('left')}<span>Displays</span></button><span class="gpill group"><button class="icon-btn" id="undo" aria-label="Rückgängig">${ic('undo')}</button><button class="icon-btn" id="redo" aria-label="Wiederholen">${ic('redo')}</button></span></div>
    <button class="ed-title" id="title" aria-label="Display-Menü"><b><span id="screen-name"></span>${ic('down')}</b><span class="st" id="status"></span></button>
    <div class="ed-r"><span id="dirty"></span><button class="gpill tinted" id="save"></button><button class="gbtn" id="search" aria-label="Suchen" title="Suchen · ⌘K">${ic('search')}</button><button class="gbtn" id="more" aria-label="Mehr">${ic('dots')}</button></div></div></div>`;
  const ed = $('#ed', el);
  const lay = layout.mount(ed), insp = inspector.mount(ed);

  // ---- Leiste ----
  const paint = () => {
    const d = cur(); if (!d) return;
    $('#screen-name', el).textContent = d.name;
    const l = ledOf(d);
    $('#status', el).innerHTML = `<i class="led ${l}"></i>${l === 'ok' ? 'Online' : l === 'update' ? 'Alte Version' : 'Offline'}`;
    $('#title', el).title = d.connected ? 'Das Display ist geöffnet und verbunden' : 'Offline: Änderungen werden gespeichert und beim nächsten Öffnen übernommen';
    const u = $('#undo', el), r = $('#redo', el);
    u.disabled = !S.undo.length; r.disabled = !S.redo.length;
    u.title = S.undo.length ? `Rückgängig: ${S.undo.at(-1).label} · ⌘Z` : 'Rückgängig · ⌘Z'; r.title = S.redo.length ? `Wiederholen: ${S.redo.at(-1).label} · ⇧⌘Z` : 'Wiederholen · ⇧⌘Z';
    const dt = $('#dirty', el), sv = $('#save', el);
    dt.innerHTML = dirty() ? '<span class="chip dirty">Nicht gesendet</span>' : `<span class="saved-note ${S.justSaved ? 'sent' : ''}">${ic('check')}${S.justSaved ? 'Gesendet' : 'Alles gesendet'}</span>`;
    sv.hidden = !dirty(); sv.disabled = S.busy; sv.title = 'Speichern und ans Display senden · ⌘S';
    sv.innerHTML = S.busy ? '<span class="spin small"></span><span>Sendet …</span>' : `${ic('send')}<span>Senden</span>`;
  };
  paint();
  let pt, warned = false;
  const persist = () => { clearTimeout(pt); pt = setTimeout(flush, 400); };
  const flush = () => { clearTimeout(pt); if (dirty()) mem.set(DK, JSON.stringify({ base: S.saved, json: JSON.stringify(S.cfg), at: Date.now() })); else if (!S.draftOffer) mem.del(DK); };
  const offs = [on('doc', paint), on('doc', persist), on('list', paint)];
  const stor = e => { if (e.key === DK && e.newValue && !warned && dirty()) { warned = true; toast('Dieses Display wird auch in einem anderen Tab bearbeitet. Wer zuletzt sendet, überschreibt.', { bad: true }); } };
  addEventListener('storage', stor);
  const doSave = async () => { if (!dirty() || S.busy) return; await save(); if (!dirty()) toast(cur().connected ? 'Gesendet. Dein Display wird aktualisiert.' : 'Gespeichert. Das Display übernimmt es beim nächsten Öffnen.'); };
  el.addEventListener('click', e => {
    const q = c => e.target.closest(c);
    if (q('#save')) return doSave();
    if (q('#undo')) return undo(); if (q('#redo')) return redo();
    if (q('#search')) return openPalette();
    const m = q('#more') || q('#title'); if (m) return moreMenu(m);
    const dr = q('[data-draft]');
    if (dr) {
      const o = S.draftOffer; S.draftOffer = null;
      if (dr.dataset.draft === 'restore' && o) { replaceDraft('Entwurf wiederhergestellt', JSON.parse(o.json)); toast('Entwurf wiederhergestellt', { action: 'Rückgängig', run: undo }); }
      else { mem.del(DK); emit('doc'); }
    }
  });
  function moreMenu(a) {
    const d = cur(), others = S.displays.filter(x => x.id !== id && !x.new);
    menu(a, [
      { group: d.name }, { label: 'Umbenennen', icon: 'pencil', run: renameDisplay },
      { label: 'Neu laden', icon: 'refresh', end: 'am Gerät', disabled: !d.connected, title: d.connected ? '' : 'Das Display ist offline', run: () => call('command', { display: id, action: 'reload' }).then(() => toast('Gesendet')).catch(er => toast(er?.message || 'Fehler', { bad: true })) },
      { label: 'Bildschirmfoto', icon: 'image', disabled: !d.connected, run: async () => { const img = await screenshot(); img && toast('Bildschirmfoto aktualisiert'); } },
      { label: 'Änderungen verwerfen', icon: 'undo', disabled: !dirty(), run: () => { discard(); toast('Änderungen verworfen'); } },
      '-', { group: 'Layout' },
      { label: 'Layout kopieren von …', icon: 'copy', end: String(others.length), disabled: !others.length, run: async () => { const v = await choose(a, others.map(x => [x.id, x.name, x.area]), '', { width: 260 }); if (v) copyLayoutFrom(v); } },
      { label: 'Layout exportieren', icon: 'download', end: 'JSON', run: exportLayout },
      { label: 'Layout importieren …', icon: 'upload', end: 'JSON', run: importLayout },
      { label: 'Auf andere anwenden …', icon: 'send', disabled: !others.length, run: applyToOthers },
      { label: 'Für ESP-Display exportieren', icon: 'download', run: exportEsp },
      '-', { label: 'So funktioniert es', icon: 'help', run: layout.openHelp },
      { label: 'Display entfernen', icon: 'trash', danger: true, run: removeDisplay },
    ], { width: 330 });
  }

  // ---- Tastatur ----
  const curTiles = () => { const s = S.ui.sel; return s?.k === 'tile' ? { f: s.f, js: [s.j] } : s?.k === 'tiles' ? { f: s.f, js: s.js } : null; };
  const key = e => {
    if (document.querySelector('.alert,.palette-bg,.sheet')) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase(), t = e.target;
    if (mod && k === 's') { e.preventDefault(); return doSave(); }
    if (mod && !e.altKey && k === 'z' && !editable(t)) { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
    if (editable(t) || t.closest?.('.pop')) return;
    const sel = curTiles();
    if ((k === 'delete' || k === 'backspace') && sel) { e.preventDefault(); return removeTiles(sel.f, sel.js); }
    if (mod && !e.altKey && !e.shiftKey) {
      if (k === 'c' && sel && !getSelection().toString()) { e.preventDefault(); return copyTiles(sel.f, sel.js); }
      if (k === 'x' && sel) { e.preventDefault(); return copyTiles(sel.f, sel.js, true); }
      if (k === 'v') { e.preventDefault(); return pasteTiles(); }
      if (k === 'a') {
        const f = faceBy(S.ui.page); if (f?.type !== 'grid') return;
        const n = tilesOf(f).length; if (!n) return;
        e.preventDefault(); const js = [...Array(n).keys()];
        return select(n > 1 ? { k: 'tiles', f: f.id, js } : { k: 'tile', f: f.id, j: 0 });
      }
      return;
    }
    if (mod) return;
    if (e.key === 'Escape' && !document.querySelector('.pop')) { if (insp.back()) return; if (lay.mode() === 'pages') return lay.setMode('deck'); return S.ui.sel && select(null); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); return lay.step(e.key === 'ArrowLeft' ? -1 : 1); }
    if (e.key === '/' || e.key === '+') { e.preventDefault(); return openGallery(); }
  };
  document.addEventListener('keydown', key);
  const before = e => { flush(); if (dirty()) { e.preventDefault(); e.returnValue = ''; } };
  addEventListener('beforeunload', before);
  return () => { offs.forEach(f => f()); flush(); clearTimeout(pt); S.draftOffer = null; document.removeEventListener('keydown', key); removeEventListener('beforeunload', before); removeEventListener('storage', stor); lay.unmount(); insp.unmount(); };
}
