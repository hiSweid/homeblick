// Ansicht eines Displays: Kopf (Name, Status, Reiter, Speichern, Menü), Layout-Reiter mit Inspector oder Einstellungs-Reiter.
import { $, choose, esc, ic, menu, toast } from './ui.js';
import { S, byId, call, cur, dirty, discard, openDoc, redo, save, select, on, undo } from './state.js';
import { ledOf } from './util.js';
import * as layout from './layout.js';
import * as inspector from './inspector.js';
import * as settings from './settings.js';
import { copyLayoutFrom, exportEsp, exportLayout, importLayout, applyToOthers, removeDisplay, renameDisplay, screenshot } from './actions.js';
import { copyTiles, faceBy, hasClip, pasteTiles, removeTiles } from './edit.js';
import { openSide, isPhone } from './shell.js';

const editable = t => t?.closest?.('input,textarea,select,[contenteditable=true]');

export async function mount(el, route) {
  const id = route.id, d0 = byId(id);
  if (!d0 || d0.new) { toast('Dieses Display gibt es nicht (mehr)', { bad: true }); location.hash = '#/'; return; }
  el.innerHTML = '<div class="view"><div class="empty"><span class="spin"></span></div></div>';
  if (S.sel !== id) await openDoc(id);
  const tab = route.tab === 'settings' || !S.cfg ? route.tab : 'layout';
  el.innerHTML = `<header class="head"><div class="title"><button class="icon-btn phone-only" id="burger" aria-label="Menü">${ic('menu')}</button><h1 id="screen-name"></h1><span class="chip" id="status"></span></div>
    <div class="seg tabs" role="tablist" aria-label="Ansicht"><button role="tab" data-tab="layout" aria-pressed="${tab === 'layout'}" id="tab-layout">${ic('layout')}Layout</button><button role="tab" data-tab="settings" aria-pressed="${tab === 'settings'}" id="tab-settings">${ic('cog')}Einstellungen</button></div>
    <div class="right"><span id="dirty"></span><button class="btn primary" id="save"></button><button class="icon-btn" id="more" aria-label="Mehr">${ic('dots')}</button></div></header>
    <div class="body"><div class="work" id="work"></div><aside class="drawer" id="drawer" aria-label="Einstellungen der Auswahl"></aside></div>`;
  const work = $('#work', el), drawer = $('#drawer', el);
  let lay = null, insp = null, view = null;
  if (tab === 'settings') view = settings.mount(work, { here: route });
  else if (!S.cfg) work.innerHTML = `<div class="empty"><div class="ico48">${ic('monitor')}</div><h2>Noch keine Konfiguration</h2><p>Öffne Homeblick einmal auf dem Gerät, dann erscheinen hier seine Seiten.</p></div>`;
  else { lay = layout.mount(work, {}); insp = inspector.mount(drawer, { lib: lay.lib }); }

  // ---- Kopf ----
  const paint = () => {
    const d = cur(); if (!d) return;
    $('#screen-name', el).textContent = d.name;
    const st = $('#status', el), l = ledOf(d);
    st.className = `chip ${l === 'ok' ? 'good' : l === 'update' ? 'update' : 'off'}`;
    st.innerHTML = `<i class="dot"></i>${l === 'ok' ? 'Online' : l === 'update' ? 'Alte Version' : 'Offline'}`;
    st.title = d.connected ? 'Das Display ist geöffnet und verbunden' : 'Offline: Änderungen werden gespeichert und beim nächsten Öffnen übernommen';
    const dt = $('#dirty', el), sv = $('#save', el), has = !!S.cfg;
    if (!has || tab === 'settings' && !dirty()) { dt.innerHTML = ''; sv.hidden = true; return; }
    dt.innerHTML = dirty() ? '<span class="chip dirty">Nicht gesendet</span>' : `<span class="saved-note ${S.justSaved ? 'sent' : ''}">${ic('check')}${S.justSaved ? 'Gespeichert · ans Display gesendet' : 'Alles gespeichert'}</span>`;
    sv.hidden = !dirty(); sv.disabled = S.busy; sv.title = '⌘S';
    sv.innerHTML = S.busy ? '<span class="spin small"></span>Speichert …' : `${ic('send')}Speichern & senden`;
  };
  paint();
  const offs = [on('doc', paint), on('list', paint)];
  const doSave = async () => { if (!dirty() || S.busy) return; await save(); if (!dirty()) toast(cur().connected ? 'Gespeichert. Dein Display wird aktualisiert.' : 'Gespeichert. Das Display übernimmt es beim nächsten Öffnen.'); };
  el.addEventListener('click', async e => {
    const t = e.target.closest('[data-tab]');
    if (t) { if (t.dataset.tab !== tab) location.hash = `#/d/${encodeURIComponent(id)}${t.dataset.tab === 'settings' ? '/settings' : ''}`; return; }
    if (e.target.closest('#save')) return doSave();
    if (e.target.closest('#burger')) return openSide(true);
    const m = e.target.closest('#more'); if (m) return moreMenu(m);
  });
  function moreMenu(a) {
    const d = cur(), has = !!S.cfg, others = S.displays.filter(x => x.id !== id && !x.new);
    menu(a, [
      ...(isPhone() && tab === 'layout' && has ? [{ label: 'Vorschau', icon: 'play', run: () => layout.openPreview(0) }, { label: 'Rückgängig', icon: 'undo', disabled: !S.undo.length, run: undo }, { label: 'Wiederholen', icon: 'redo', disabled: !S.redo.length, run: redo }, '-'] : []),
      { group: 'Dieses Display' },
      { label: 'Umbenennen', icon: 'pencil', run: renameDisplay },
      { label: 'Neu laden', icon: 'refresh', end: 'am Gerät', disabled: !d.connected, title: d.connected ? '' : 'Das Display ist offline', run: () => call('command', { display: id, action: 'reload' }).then(() => toast('Gesendet')).catch(er => toast(er?.message || 'Fehler', { bad: true })) },
      { label: 'Bildschirmfoto', icon: 'image', disabled: !d.connected, run: async () => { const img = await screenshot(); img && toast('Bildschirmfoto aktualisiert'); } },
      { label: 'Änderungen verwerfen', icon: 'undo', disabled: !dirty(), run: () => { discard(); toast('Änderungen verworfen'); } },
      '-', { group: 'Layout' },
      { label: 'Layout kopieren von …', icon: 'copy', end: others.length ? `${others.length} Display${others.length > 1 ? 's' : ''}` : 'kein weiteres', disabled: !has || !others.length, run: async () => { const v = await choose(a, others.map(x => [x.id, x.name, x.area]), '', { width: 260 }); if (v) copyLayoutFrom(v); } },
      { label: 'Layout exportieren', icon: 'download', end: 'JSON', disabled: !has, run: exportLayout },
      { label: 'Layout importieren …', icon: 'upload', end: 'JSON', disabled: !has, run: importLayout },
      { label: 'Auf andere Displays anwenden …', icon: 'send', disabled: !has || !others.length, run: applyToOthers },
      { label: 'Für ESP-Display exportieren', icon: 'download', disabled: !has, run: exportEsp },
      '-', { label: 'Display entfernen', icon: 'trash', danger: true, run: removeDisplay },
    ], { width: 280 });
  }

  // ---- Tastatur ----
  const key = e => {
    if (document.querySelector('.dialog,.palette-bg')) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase(), t = e.target;
    if (mod && k === 's') { e.preventDefault(); return doSave(); }
    if (tab !== 'layout' || !S.cfg) return;
    if (mod && !e.altKey && k === 'z' && !editable(t)) { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
    if (editable(t) || t.closest?.('.pop')) return;
    const sel = S.ui.sel, tile = sel?.k === 'tile' ? sel : null;
    if ((k === 'delete' || k === 'backspace') && tile) { e.preventDefault(); return removeTiles(tile.f, [tile.j]); }
    if (mod && !e.altKey && !e.shiftKey) {
      if (k === 'c' && tile && !getSelection().toString()) { e.preventDefault(); return copyTiles(tile.f, [tile.j]); }
      if (k === 'x' && tile) { e.preventDefault(); return copyTiles(tile.f, [tile.j], true); }
      if (k === 'v') { e.preventDefault(); return pasteTiles(); }
      return;
    }
    if (e.key === 'Escape' && sel && !document.querySelector('.pop')) return select(null);
    if (e.key === '/' ) { e.preventDefault(); return lay?.lib.focus(); }
    if (e.key.length === 1 && !mod && !e.altKey && !/\s/.test(e.key) && !isPhone()) { e.preventDefault(); lay?.lib.focus(e.key); }
  };
  document.addEventListener('keydown', key);
  const before = e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } };
  addEventListener('beforeunload', before);
  return () => { offs.forEach(f => f()); document.removeEventListener('keydown', key); removeEventListener('beforeunload', before); lay?.unmount(); insp?.unmount(); (typeof view === 'function') && view(); };
}
