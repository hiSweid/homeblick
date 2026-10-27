// Editor-Fläche: die Seiten des Displays als Karussell (echte Vorschau je Seite), darunter Titel und Punkte, schwebendes Dock.
// „Seiten“ zeigt dieselben Frames als Raster zum Umsortieren und Ausblenden (wie „Seiten bearbeiten“ auf dem iPhone); die Frames wandern nie im DOM, nur ihre Position ändert sich.
// Jede Seite ist ein ?preview-Frame der echten App; Konfiguration und Zustände gehen per postMessage hin, Antippen/Ziehen/Größe kommen zurück.
import { moveTo, rows } from '../faces.js';
import { $, $$, clamp, esc, ic, menu, modal, toast } from './ui.js';
import { S, byId, call, emit, mutate, on, select } from './state.js';
import { FACE, GROUP, faceName } from './meta.js';
import { ago } from './util.js';
import { addPage, cells, duplicatePage, faceBy, hidePage, lost, movePage, pageTypes, removePage, removeTiles, resizeTile, showPage, tilesOf, used } from './edit.js';
import { openGallery } from './gallery.js';

const SC = [1, .7, .52, .42], GAP = 26, OP = [1, .62, .3, 0];
const xOf = (d, S_) => { let x = 0; for (let k = 0; k < Math.min(Math.abs(d), 4); k++) x += S_ * (SC[k] ?? .4) / 2 + GAP + S_ * (SC[k + 1] ?? .4) / 2; return Math.sign(d) * x; };
const PAGE_SUB = { grid: 'Kacheln für Lampen, Szenen und Geräte', music: 'Wiedergabe und Cover', bigclock: 'Große Uhr', analog: 'Analoge Uhr', weather: 'Wetter und Vorhersage', energy: 'Solar, Netz, Batterie, Auto', calendar: 'Termine', date: 'Datum groß', cams: 'Kameras und Türklingel', people: 'Wer ist zuhause', info: 'Info' };

export function mount(ed) {
  let mode = 'deck', slots = new Map(), ghosts = new Map(), offs = [], drag = null, lastIx = 0;
  ed.insertAdjacentHTML('beforeend', `<div class="notices" id="notices"></div>
    <div class="ed-main" id="edmain"><div class="deck-wrap"><div class="deck" id="deck"></div></div>
      <div class="deck-meta" id="meta"></div></div>
    <nav class="dock" id="dock" aria-label="Werkzeuge"></nav>`);
  const main = $('#edmain', ed), deck = $('#deck', ed), meta = $('#meta', ed), dock = $('#dock', ed), notices = $('#notices', ed);

  const dev = () => byId(S.sel);
  const faces = () => S.cfg.faces;
  const selTile = f => { const x = S.ui.sel; return !x || x.f !== f.id ? -1 : x.k === 'tile' ? x.j : x.k === 'tiles' ? x.js : -1; };
  const activeIx = () => { const i = faces().findIndex(f => f.id === S.ui.page); if (i >= 0) return lastIx = i; S.ui.page = faces()[Math.min(lastIx, faces().length - 1)]?.id || null; return Math.max(0, faces().findIndex(f => f.id === S.ui.page)); };
  const setPage = i => { const f = faces()[clamp(i, 0, faces().length - 1)]; if (!f || f.id === S.ui.page) return; S.ui.page = f.id; if (S.ui.sel && S.ui.sel.f !== f.id) S.ui.sel = null; S.ui.insert = null; emit('sel'); };

  // ---- Größe und Platz ----
  const gridGeo = (W, n) => { const gap = 30, cmin = 128, cols = Math.max(1, Math.min(n, Math.floor((W - 40 + gap) / (cmin + gap)))), cw = clamp((W - 40 - (cols - 1) * gap) / cols, cmin, 190), total = cols * cw + (cols - 1) * gap; return { gap, cap: 66, cols, cw, x0: (W - total) / 2 }; };
  const dims = () => {
    const w = ed.clientWidth, h = ed.clientHeight, small = innerWidth <= 960, ri = ed.classList.contains('has-insp') && !small ? 400 : 0;
    const bot = ed.classList.contains('has-insp') && small ? Math.min(h * .64, 560) + 24 : 112, top = 78 + (parseFloat(ed.style.getPropertyValue('--nt')) || 0);
    const W = w - ri, H = h - top - bot;
    return { W, H, S: clamp(Math.min(W - 40, H - (mode === 'deck' && !(small && ed.classList.contains('has-insp')) ? 112 : 0)), 190, 560) };
  };
  function place() {
    if (!S.cfg) return;
    const { W, S: S_ } = dims(), fs = faces(), a = activeIx(), n = fs.length;
    deck.style.setProperty('--S', S_ + 'px'); ed.style.setProperty('--S', S_ + 'px');
    const items = [...fs.map(f => ({ id: f.id, el: slots.get(f.id)?.el, kind: 'page' })), ...(mode === 'pages' ? [...(S.cfg.off || []).map(f => ({ id: 'off:' + f.id, el: ghosts.get('off:' + f.id)?.el, kind: 'off', f })), { id: 'add', el: ghosts.get('add')?.el, kind: 'add' }] : [])];
    if (drag) { const order = fs.map(f => f.id).filter(id => id !== drag.id); order.splice(drag.to, 0, drag.id); items.splice(0, n, ...order.map(id => ({ id, el: slots.get(id)?.el, kind: 'page' }))); }
    if (mode === 'deck') {
      deck.classList.remove('grid'); deck.style.removeProperty('--GH');
      items.forEach(({ el }, i) => { if (!el) return; const d = i - a, k = Math.min(Math.abs(d), 3), s = SC[k], cx = W / 2 + xOf(d, S_);
        set(el, { x: cx - S_ / 2, y: 0, s, o: OP[k], z: 10 - k });
        el.className = `slot ${d === 0 ? 'active' : k < 3 ? 'side' : 'far'}`; });
    } else {
      const { gap, cap, cols, cw, x0 } = gridGeo(W, items.length), rowsN = Math.ceil(items.length / cols);
      deck.classList.add('grid'); deck.style.setProperty('--GH', rowsN * (cw + cap) + 20 + 'px'); deck.style.setProperty('--cw', cw + 'px');
      items.forEach(({ el, kind }, i) => { if (!el || (drag && el.classList.contains('dragging'))) return;
        const cx = x0 + (i % cols) * (cw + gap) + cw / 2, cy = 14 + Math.floor(i / cols) * (cw + cap) + cw / 2;
        set(el, { x: cx - S_ / 2, y: cy - S_ / 2, s: cw / S_, o: 1, z: 1 });
        el.classList.remove('active', 'side', 'far'); });
    }
    chrome();
  }
  const set = (el, { x, y, s, o, z }) => { el.style.setProperty('--x', x + 'px'); el.style.setProperty('--y', y + 'px'); el.style.setProperty('--s', s); el.style.setProperty('--o', o); el.style.setProperty('--z', z); };

  // ---- Slots (nach Seite, nicht nach Platz: Umsortieren bewegt nur die Position, die Frames laden nie neu) ----
  function ensureSlots() {
    const ids = new Set(faces().map(f => f.id));
    for (const [id, s] of slots) if (!ids.has(id)) { s.el.inert = true; s.el.style.setProperty('--o', 0); s.el.style.setProperty('--s', .4); slots.delete(id); setTimeout(() => s.el.remove(), 400); }
    for (const f of faces()) {
      if (slots.has(f.id)) continue;
      const el = Object.assign(document.createElement('section'), { className: 'slot' });
      el.innerHTML = `<div class="dev"><iframe title="" tabindex="-1" src="index.html?preview"></iframe></div><div class="veil"></div><div class="cap"><span class="cap-name"></span><button class="chk" data-chk aria-label="Ansicht zeigen oder ausblenden">${ic('check')}</button></div><button class="gbtn sm more" data-more aria-label="Mehr">${ic('dots')}</button><button class="gbtn sm del" data-del aria-label="Ansicht löschen">${ic('minus')}</button>`;
      set(el, { x: dims().W / 2 - dims().S / 2, y: 0, s: .5, o: 0, z: 1 });
      deck.append(el);
      slots.set(f.id, { el, frame: el.querySelector('iframe'), ready: false, sent: '', sel: '', edit: undefined, id: f.id });
      void el.offsetWidth;
    }
    // Ausgeblendete Seiten und „Seite hinzufügen“ gibt es nur im Raster
    const want = mode === 'pages' ? [...(S.cfg.off || []).map(f => ['off:' + f.id, f]), ['add', null]] : [];
    for (const [id, g] of ghosts) if (!want.some(([k]) => k === id)) { g.el.remove(); ghosts.delete(id); }
    for (const [id, f] of want) {
      if (ghosts.has(id)) continue;
      const meta_ = f ? FACE[f.type] || [f.type, '#8e8e93', 'grid'] : null;
      const el = Object.assign(document.createElement('section'), { className: f ? 'slot hidden-pg' : 'slot addpg' });
      el.dataset.ghost = id;
      el.innerHTML = f ? `<div class="dev" role="button" tabindex="0">${ic(meta_[2])}</div><div class="cap"><span class="cap-name">${esc(faceName(f))} · ausgeblendet</span><button class="chk off" data-show="${esc(f.id)}" aria-label="Ansicht einblenden">${ic('check')}</button></div>` : `<div class="dev" role="button" tabindex="0" aria-label="Ansicht hinzufügen">${ic('plus')}</div><div class="cap"><span class="cap-name">Neue Ansicht</span></div>`;
      set(el, { x: dims().W / 2 - dims().S / 2, y: 0, s: .5, o: 0, z: 1 });
      deck.append(el); void el.offsetWidth; ghosts.set(id, { el });
    }
  }
  const post = (s, m) => s.frame.contentWindow?.postMessage({ hb: 'preview', ...m }, location.origin);
  function syncSlot(s, f, i, a) {
    if (!f || !s.ready) return;
    const conf = { ...S.cfg, off: [], faces: [f] }, key = JSON.stringify(conf), m = {}, j = selTile(f), jk = JSON.stringify(j), edit = f.type === 'grid' && mode === 'deck' && i === a;
    if (key !== s.sent) { s.sent = key; m.conf = conf; m.face = f.id; m.sel = j; s.sel = jk; }
    else if (jk !== s.sel) { s.sel = jk; m.sel = j; }
    if (edit !== s.edit) { s.edit = edit; m.edit = edit; }
    if (S.flash?.f === f.id) { m.flash = S.flash.j; S.flash = null; }
    if (Object.keys(m).length) post(s, m);
  }
  function sync() {
    if (!S.cfg) return;
    ensureSlots(); const a = activeIx();
    faces().forEach((f, i) => { const s = slots.get(f.id); if (!s) return; s.frame.title = faceName(f); $('.cap-name', s.el).textContent = faceName(f); s.el.dataset.f = f.id; syncSlot(s, f, i, a); });
    place(); page_meta();
  }

  // ---- Titel, Punkte, Dock, Hinweise ----
  function page_meta() {
    const fs = faces(), a = activeIx(), f = fs[a], n = fs.length, tiles = f && tilesOf(f).length;
    meta.hidden = mode !== 'deck';
    if (f) meta.innerHTML = `<button class="page-title" data-ptitle title="Ansicht anpassen">${esc(faceName(f))}${ic('right')}</button>
      <small>${f.type === 'grid' ? `${tiles} Kachel${tiles === 1 ? '' : 'n'} · ${used(f)} von ${cells(f)} Plätzen` : esc(PAGE_SUB[f.type] || '')}</small>
      <div class="pager"><button class="gbtn sm" id="pl" aria-label="Vorherige Ansicht" ${a === 0 ? 'disabled' : ''}>${ic('left')}</button><div class="dots" role="tablist" aria-label="Ansichten">${fs.map((x, i) => `<button role="tab" data-i="${i}" class="${i === a ? 'on' : ''}" aria-selected="${i === a}" aria-label="Ansicht ${i + 1}: ${esc(faceName(x))}"></button>`).join('')}<button class="add" data-addpage aria-label="Ansicht hinzufügen">${ic('plus')}</button></div><button class="gbtn sm" id="pr" aria-label="Nächste Ansicht" ${a >= n - 1 ? 'disabled' : ''}>${ic('right')}</button></div>`;
    dock.dataset.mode = mode;
    dock.innerHTML = mode === 'deck'
      ? `<button class="dock-i main" data-d="add" ${S.cfg.faces.some(x => x.type === 'grid') ? '' : 'title="Kacheln gibt es auf Smart-Home-Ansichten"'}>${ic('plus')}<span>Hinzufügen</span></button><button class="dock-i" data-d="pages">${ic('pages')}<span>Ansichten</span></button><button class="dock-i" data-d="preview">${ic('play')}<span>Vorschau</span></button><button class="dock-i" data-d="settings">${ic('cog')}<span>Einstellungen</span></button>`
      : `<button class="dock-i" data-d="newpage">${ic('page-add')}<span>Neue Ansicht</span></button><button class="dock-i main" data-d="pages">${ic('check')}<span>Fertig</span></button>`;
    main.classList.toggle('pages', mode === 'pages');
    $$('[data-chk]', deck).forEach(b => { b.classList.remove('off'); });
    chrome();
  }
  function chrome() {
    if (!S.cfg) return;
    const w = [], lostF = faces().filter(f => f.type === 'grid' && lost(f));
    if (S.draftOffer) w.push(['draft', `Ungesendeter Entwurf von ${ago(S.draftOffer.at)} gefunden.`, 'undo']);
    if (dev() && !dev().connected) w.push(['info', 'Das Display ist offline. Änderungen werden gespeichert und beim nächsten Öffnen übernommen.']);
    for (const f of lostF) w.push(['warn', `${lost(f)} Kachel${lost(f) > 1 ? 'n passen' : ' passt'} auf „${faceName(f)}“ nicht mehr ins Raster und ${lost(f) > 1 ? 'werden' : 'wird'} nicht angezeigt.`]);
    if (!faces().some(f => f.type === 'grid')) w.push(['info', 'Kacheln gibt es auf Smart-Home-Ansichten: lege über „Ansichten“ eine an.']);
    else if (!faces().some(f => tilesOf(f).length)) w.push(['info', 'Tippe auf „Hinzufügen“, um die erste Lampe, Szene oder das erste Gerät auf die Ansicht zu legen.', 'plus']);
    const nt0 = ed.style.getPropertyValue('--nt');
    notices.innerHTML = w.slice(0, 2).map(([k, t, i]) => `<div class="notice ${k === 'warn' ? 'warn' : ''}" role="status">${ic(i || (k === 'warn' ? 'alert' : 'info'))}<span>${esc(t)}</span>${k === 'draft' ? '<span class="n-acts"><button data-draft="restore">Wiederherstellen</button><button data-draft="drop">Verwerfen</button></span>' : ''}</div>`).join('');
    const nt = notices.offsetHeight ? notices.offsetHeight + 6 + 'px' : '0px';
    if (nt !== nt0) { ed.style.setProperty('--nt', nt); place(); }
  }

  // ---- Nachrichten aus den Frames ----
  const onMessage = e => {
    const m = e.data;
    if (e.origin !== location.origin || !m?.hb) return;
    const s = [...slots.values()].find(x => x.frame.contentWindow === e.source);
    if (!s) return;
    window.focus();   // Tastaturfokus aus dem Vorschau-Rahmen zurückholen (Entf, ⌘Z/C/X/V, Esc, Pfeile, ⌘S)
    const f = faceBy(s.id);
    if (m.hb === 'preview-ready') { s.ready = true; s.sent = ''; s.edit = undefined; post(s, { states: S.states }); return sync(); }
    if (m.hb === 'swipe') return mode === 'deck' && s.id === S.ui.page && step(m.dir);   // Wischen auf der aktiven Seite meldet der Rahmen
    if (!f || m.face !== f.id || mode !== 'deck' || f.id !== S.ui.page) return;
    if (m.hb === 'tile') {
      const x = S.ui.sel, base = x?.f !== f.id ? [] : x.k === 'tile' ? [x.j] : x.k === 'tiles' ? x.js : [];
      if (!m.mod) select({ k: 'tile', f: f.id, j: m.j });
      else { const js = base.includes(m.j) ? base.filter(v => v !== m.j) : [...base, m.j]; select(js.length > 1 ? { k: 'tiles', f: f.id, js } : js.length ? { k: 'tile', f: f.id, j: js[0] } : { k: 'page', f: f.id }); }
    }
    else if (m.hb === 'facetap') select({ k: 'page', f: f.id });
    else if (m.hb === 'empty') { select(null, { f: f.id, cell: m.cell }); openGallery(); }
    else if (m.hb === 'move') {
      const t = f.tiles[m.j];
      mutate('Kachel verschoben', () => { const g = faceBy(f.id); g.tiles = moveTo(g.tiles, m.j, m.cell, rows(g)); });
      select({ k: 'tile', f: f.id, j: faceBy(f.id).tiles.indexOf(t) });
    }
    else if (m.hb === 'resize') { if (!resizeTile(f.id, m.j, m.w, m.h)) { s.sent = ''; syncSlot(s, f, activeIx(), activeIx()); } }
    else if (m.hb === 'remove') removeTiles(f.id, [m.j]);
  };
  addEventListener('message', onMessage);
  function validate() {   // Auswahl, die es nicht mehr gibt, schließen
    const sel = S.ui.sel; if (!sel) return;
    const f = faceBy(sel.f);
    if (!f || (sel.k === 'tile' && !f.tiles?.[sel.j]) || (sel.k === 'tiles' && sel.js.some(j => !f.tiles?.[j]))) { S.ui.sel = null; S.ui.insert = null; queueMicrotask(() => emit('sel')); }
    if (S.ui.insert && !faceBy(S.ui.insert.f)) S.ui.insert = null;
  }
  offs.push(on('doc', () => { validate(); sync(); }), on('sel', sync), on('states', () => slots.forEach(s => s.ready && post(s, { states: S.states }))));
  const ro = new ResizeObserver(() => place()); ro.observe(ed); offs.push(() => ro.disconnect());
  const cls = new MutationObserver(() => place()); cls.observe(ed, { attributes: true, attributeFilter: ['class'] }); offs.push(() => cls.disconnect());

  // ---- Bedienung ----
  const step = d => setPage(activeIx() + d);
  function setMode(m) {
    if (m === mode) return; mode = m; if (m === 'pages') select(null);
    sync();
    ed.classList.toggle('pages-mode', m === 'pages');
  }
  ed.addEventListener('click', e => {
    const q = c => e.target.closest(c);
    if (Date.now() - suppress < 400) { e.stopPropagation(); e.preventDefault(); return; }
    const d = q('[data-d]');
    if (d) {
      const k = d.dataset.d;
      if (k === 'add') return openGallery();
      if (k === 'pages') return setMode(mode === 'pages' ? 'deck' : 'pages');
      if (k === 'newpage') return addPageFlow();
      if (k === 'preview') return openPreview(activeIx());
      if (k === 'settings') { location.hash = `#/d/${encodeURIComponent(S.sel)}/settings`; return; }
    }
    if (q('#pl')) return step(-1); if (q('#pr')) return step(1);
    const dot = q('.dots [data-i]'); if (dot) return setPage(+dot.dataset.i);
    if (q('[data-addpage]')) return addPageFlow();
    if (q('[data-ptitle]')) return select({ k: 'page', f: faces()[activeIx()].id });
    const chk = q('[data-chk]'); if (chk) { const id = chk.closest('.slot').dataset.f; return id && hidePage(id); }
    const sh = q('[data-show]'); if (sh) return showPage(sh.dataset.show);
    const mo = q('[data-more]'); if (mo) { const id = mo.closest('.slot').dataset.f; return pageMenu(mo, faceIx(id)); }
    const gh = q('.slot.addpg .dev'); if (gh) return addPageFlow();
    const gp = q('.slot.hidden-pg .dev'); if (gp) return showPage(gp.closest('.slot').dataset.ghost.slice(4));
    const dl = q('[data-del]'); if (dl) return removePage(dl.closest('.slot').dataset.f);
    const veil = q('.slot .veil');
    if (veil) { const id = veil.closest('.slot').dataset.f, i = faces().findIndex(f => f.id === id); if (mode === 'pages') { S.ui.page = id; return setMode('deck'); } return setPage(i); }
    // Klick auf die freie Fläche schließt die Auswahl
    if (q('.ed-main') && !q('.slot,.dots,.page-title,button,.deck-meta small')) select(null);
  });
  const faceIx = id => faces().findIndex(f => f.id === id);
  ed.addEventListener('contextmenu', e => { const s = e.target.closest('.slot[data-f]'); if (!s || mode !== 'pages' || e.target.closest('iframe')) return; e.preventDefault(); pageMenu(s.querySelector('[data-more]'), faceIx(s.dataset.f)); });
  // Wischen auf der freien Fläche und Ziehen im Seitenraster
  let suppress = 0;
  main.addEventListener('pointerdown', e => {
    if (e.button) return;
    const veil = e.target.closest('.deck.grid .slot:not(.addpg):not(.hidden-pg) .veil');
    if (veil) return startDrag(e, veil.closest('.slot'));
    if (mode !== 'deck' || e.target.closest('iframe,button,.dots,.slot.active')) return;
    const x0 = e.clientX, y0 = e.clientY; let done = false;
    const mv = ev => { if (done) return; const dx = ev.clientX - x0; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(ev.clientY - y0)) { done = true; suppress = Date.now(); step(dx < 0 ? 1 : -1); } };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
  main.addEventListener('wheel', e => { if (mode !== 'deck' || Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 28 || e.target.closest('iframe')) return; e.preventDefault(); if (Date.now() - wheelAt > 420) { wheelAt = Date.now(); step(e.deltaX > 0 ? 1 : -1); } }, { passive: false });
  let wheelAt = 0;
  function startDrag(e, el) {
    const id = el.dataset.f, from = faceIx(id), x0 = e.clientX, y0 = e.clientY, dev_ = $('.dev', el), v = e.target;
    let began = false; v.setPointerCapture(e.pointerId);
    const base = () => { const r = deck.getBoundingClientRect(); return { x: parseFloat(el.style.getPropertyValue('--x')), y: parseFloat(el.style.getPropertyValue('--y')), r }; };
    const b0 = base();
    const mv = ev => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!began) { if (Math.hypot(dx, dy) < 6) return; began = true; drag = { id, from, to: from }; el.classList.add('dragging'); }
      el.style.setProperty('--x', b0.x + dx + 'px'); el.style.setProperty('--y', b0.y + dy + 'px'); 
      // nächstgelegene Zelle (nur echte Seiten zählen)
      const { S: S_ } = dims(), n = faces().length, cx = b0.x + dx + S_ / 2, cy = b0.y + dy + S_ / 2;
      let best = from, bd = 1e12;
      const { gap, cap, cols, cw, x0: x0g } = gridGeo(dims().W, n + (S.cfg.off || []).length + 1);
      for (let i = 0; i < n; i++) { const gx = x0g + (i % cols) * (cw + gap) + cw / 2, gy = 14 + Math.floor(i / cols) * (cw + cap) + cw / 2, dd = (gx - cx) ** 2 + (gy - cy) ** 2; if (dd < bd) { bd = dd; best = i; } }
      if (best !== drag.to) { drag.to = best; place(); }
    };
    const up = ev => {
      v.removeEventListener('pointermove', mv); v.removeEventListener('pointerup', up); v.removeEventListener('pointercancel', up);
      if (!began) return;
      suppress = Date.now(); const d = drag; drag = null; el.classList.remove('dragging');
      if (d.to !== d.from && ev.type === 'pointerup') movePage(d.from, d.to); else place();
    };
    v.addEventListener('pointermove', mv); v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
  }
  main.addEventListener('keydown', e => { if (e.target.closest('.slot .dev[role=button]') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); } });

  ensureSlots(); sync();
  return { step, setMode, mode: () => mode, activeIx, unmount() { offs.forEach(f => f()); removeEventListener('message', onMessage); slots.clear(); ghosts.clear(); } };
}

export function pageMenu(anchor, i) {
  const f = S.cfg.faces[i], n = S.cfg.faces.length, d = byId(S.sel);
  menu(anchor, [
    { label: 'Ansicht anpassen', icon: 'sliders', run: () => select({ k: 'page', f: f.id }) },
    { label: 'Auf dem Display zeigen', icon: 'monitor-eye', disabled: !d?.connected, title: d?.connected ? '' : 'Das Display ist offline', run: () => call('command', { display: S.sel, action: 'face', face: f.type }).then(() => toast('Gesendet')).catch(e => toast(e?.message || 'Fehler', { bad: true })) },
    '-', { group: 'Reihenfolge' },
    { label: 'Nach links', icon: 'arrow-left', disabled: i === 0, run: () => movePage(i, i - 1) },
    { label: 'Nach rechts', icon: 'arrow-right', disabled: i === n - 1, run: () => movePage(i, i + 1) },
    '-', { label: 'Ansicht duplizieren', icon: 'copy', disabled: !!GROUP[f.type], title: GROUP[f.type] ? 'Uhr, Kalender und Datum gibt es je Display nur einmal' : '', run: () => duplicatePage(f.id) },
    { label: 'Ansicht ausblenden', icon: 'eye-off', run: () => hidePage(f.id) },
    '-', { label: 'Ansicht löschen', icon: 'trash', danger: true, end: tilesOf(f).length ? `${tilesOf(f).length} Kacheln` : '', run: () => removePage(f.id) },
  ], { width: 270 });
}

// ---- Seite hinzufügen ----
export async function addPageFlow() {
  const hidden = S.cfg.off || [], types = pageTypes();
  const row = (k, v, name, sub, m) => `<button class="pgc" data-r="${k}:${esc(v)}"><span class="av" style="--c:${m[1]}">${ic(m[2])}</span><span class="t"><b>${esc(name)}</b><small>${esc(sub)}</small></span>${ic('right')}</button>`;
  const r = await modal(`<div class="sheet-bar"><span class="l"><button class="done" data-r="">Abbrechen</button></span><h2>Neue Ansicht</h2></div><div class="sheet-body">
    ${hidden.length ? `<div class="sect"><div class="group-h">Ausgeblendet · wieder einblenden</div><div class="group pgl">${hidden.map(f => row('show', f.id, faceName(f), 'behält ihre Einstellungen', FACE[f.type] || [f.type, '#8e8e93', 'grid'])).join('')}</div></div>` : ''}
    <div class="sect"><div class="group-h">${hidden.length ? 'Neue Ansicht' : 'Art der Ansicht'}</div><div class="group pgl">${types.map(t => row('new', t, { grid: 'Smart Home', music: 'Musik' }[t] || (GROUP[t] ? ({ clock: 'Uhr', calendar: 'Kalender', date: 'Datum' })[GROUP[t]] : FACE[t][0]), PAGE_SUB[t] || '', FACE[t])).join('')}</div></div></div>`, { label: 'Ansicht hinzufügen' });
  if (!r) return;
  const [k, v] = [r.slice(0, r.indexOf(':')), r.slice(r.indexOf(':') + 1)];
  if (k === 'show') showPage(v); else addPage(v);
}

// ---- Hilfe ----
export function openHelp() {
  modal(`<div class="sheet-bar"><span class="l"></span><h2>So funktioniert es</h2><span class="r"><button class="done" data-r="">Fertig</button></span></div><div class="sheet-body"><div class="group"><div class="help-pop" style="padding:16px">${[
    ['pencil', 'Ändern', 'Tippe auf eine Kachel: rechts öffnen sich ihre Einstellungen. Tippe auf den Titel der Ansicht für deren Einstellungen.'],
    ['plus', 'Hinzufügen', 'Tippe unten auf „Hinzufügen“ oder in der Vorschau auf eine leere Stelle. Das Blatt zeigt Vorschläge für den Raum.'],
    ['grip', 'Verschieben', 'Kachel in der Vorschau ziehen; der Griff unten rechts ändert die Größe; „−“ entfernt sie.'],
    ['pages', 'Ansichten', 'Zeigt alle Ansichten als Raster: ziehen sortiert, „−“ löscht, der Haken blendet aus.'],
    ['play', 'Wechseln und Auswählen', 'Wische zur nächsten Ansicht, oder nutze Punkte und Pfeiltasten. Umschalt oder ⌘ plus Klick wählt mehrere Kacheln, Entf entfernt sie.'],
    ['copy', 'Kopieren', 'Kachel wählen, dann ⌘C und ⌘V auf einer anderen Ansicht oder einem anderen Display.'],
    ['send', 'Senden', 'Änderungen bleiben ein Entwurf, bis du „Senden“ drückst.']].map(([i, t, d]) => `<div class="help-tip-row"><span class="hi">${ic(i)}</span><span><b>${t}</b><br>${d}</span></div>`).join('')}</div></div></div>`, { label: 'Hilfe' });
}

// ---- Vorschau: durch die Seiten wischen wie am Display ----
export function openPreview(start = 0) {
  const fs = S.cfg.faces;
  let i = Math.min(start, fs.length - 1), ready = false, frame;
  const send = (anim = false, full = true) => { if (!ready) return; frame.contentWindow.postMessage({ hb: 'preview', ...(full && { conf: { ...S.cfg, off: [] } }), face: fs[i].id, edit: false, sel: -1, ...(anim && { anim: true }), states: S.states }, location.origin); };
  const dots = d => { $$('.pv-dots i', d).forEach((x, k) => x.classList.toggle('on', k === i)); $('.pv-name', d).textContent = faceName(fs[i]); };
  const go = (d, n) => { if (n < 0 || n >= fs.length || n === i) return; i = n; send(true, false); dots(d); };
  const onMsg = (d, e, done) => { if (e.origin !== location.origin || e.source !== frame.contentWindow) return; if (e.data?.hb === 'preview-ready') { ready = true; send(); } else if (e.data?.hb === 'swipe') go(d, i + e.data.dir); else if (e.data?.hb === 'menu') { done(null); e.data.item === 'add' ? openGallery() : select({ k: 'page', f: fs[i].id }); } };   // Langdruck-Menü: Widget hinzufügen / Anpassen / Hintergrund
  modal(`<div class="sheet-bar"><span class="l"></span><h2 class="pv-name"></h2><span class="r"><button class="done" data-r="">Fertig</button></span></div>
    <div class="sheet-body"><div class="pv-device"><iframe title="Vorschau" src="index.html?preview"></iframe></div>
    <div class="pv-bar"><button class="gbtn sm" data-d="-1" aria-label="Vorherige Ansicht">${ic('left')}</button><span class="pv-dots">${fs.map(() => '<i></i>').join('')}</span><button class="gbtn sm" data-d="1" aria-label="Nächste Ansicht">${ic('right')}</button></div>
    <p class="hint center">Nur zum Ausprobieren: Wische durch die Ansichten. Es wird nichts geschaltet.</p></div>`, { cls: 'pv', label: 'Vorschau', init: (d, done) => {
    frame = $('iframe', d); dots(d);
    const h = e => onMsg(d, e, done), k = e => { if (e.key === 'ArrowLeft') go(d, i - 1); else if (e.key === 'ArrowRight') go(d, i + 1); };
    addEventListener('message', h); document.addEventListener('keydown', k);
    d.addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) go(d, i + +b.dataset.d); });
    const obs = new MutationObserver(() => { if (!d.isConnected) { removeEventListener('message', h); document.removeEventListener('keydown', k); obs.disconnect(); } }); obs.observe(document.body, { childList: true });
  } });
}
