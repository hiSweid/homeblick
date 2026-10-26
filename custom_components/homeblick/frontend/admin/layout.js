// Layout-Reiter: die Seiten des Displays nebeneinander (echte Vorschau je Seite), Werkzeugleiste, Bibliothek darunter.
// Jede Seite ist ein ?preview-Frame der echten App; Konfiguration und Zustände gehen per postMessage hin, Antippen/Ziehen/Größe kommen zurück.
import { moveTo, pack, rows } from '../faces.js';
import { $, $$, esc, ic, menu, modal, popover, toast } from './ui.js';
import { S, byId, call, emit, mutate, on, redo, select, undo } from './state.js';
import { FACE, DESIGN, GROUP, bgName, designCur, designs, faceName } from './meta.js';
import { addPage, cells, duplicatePage, faceBy, hidePage, lost, movePage, pageTypes, removePage, removeTiles, resizeTile, showPage, tilesOf, used } from './edit.js';
import { mountLibrary } from './library.js';

const ZOOMS = [.5, .67, .75, .8, .9, 1, 1.1, 1.25, 1.5, 1.75, 2], ZKEY = 'hb-admin.zoom', BASE = 300;
const zget = () => { try { return +localStorage.getItem(ZKEY) || 1; } catch { return 1; } };

export function mount(el, { onLibrary } = {}) {
  let zoom = zget(), slots = [], offs = [];
  el.innerHTML = `<div class="canvas" id="canvas"><div class="notices" id="notices"></div>
    <div class="toolbar"><span class="tool-group"><button class="icon-btn" id="undo" aria-label="Rückgängig">${ic('undo')}</button><button class="icon-btn" id="redo" aria-label="Wiederholen">${ic('redo')}</button></span>
      <button class="btn quiet" id="prev">${ic('play')}Vorschau</button><button class="btn quiet" id="addpage">${ic('plus')}Seite hinzufügen</button><span class="grow"></span>
      <span class="toolbar-count" id="count"></span><button class="icon-btn" id="help" aria-label="So funktioniert es">${ic('help')}</button></div>
    <div class="pages" id="pages" aria-label="Seiten des Displays"></div>
    <div class="zoom-dock"><div class="zoom-pill" role="group" aria-label="Größe der Seiten"><button class="icon-btn" id="zout" aria-label="Verkleinern">${ic('minus')}</button><button id="zreset" title="Zurück auf 100 %"></button><button class="icon-btn" id="zin" aria-label="Vergrößern">${ic('plus')}</button></div></div></div>
    <div id="library"></div>`;
  const canvas = $('#canvas', el), pages = $('#pages', el), lib = mountLibrary($('#library', el));
  onLibrary?.(lib);

  const dev = () => byId(S.sel);
  const faces = () => S.cfg.faces;
  const selTile = f => S.ui.sel?.k === 'tile' && S.ui.sel.f === f.id ? S.ui.sel.j : -1;

  // ---- Seiten als Slots (nach Platz, nicht nach Face: Umsortieren schickt nur neuen Inhalt, die Frames laden nicht neu) ----
  function ensureSlots() {
    const n = faces().length;
    while (slots.length > n) { slots.pop().el.remove(); }
    while (slots.length < n) {
      const s = { el: Object.assign(document.createElement('section'), { className: 'page' }), ready: false, sent: '', flash: -1 };
      s.el.innerHTML = '<div class="page-head"></div><div class="device"><iframe title="" tabindex="-1" loading="lazy" src="index.html?preview"></iframe></div>';
      s.frame = s.el.querySelector('iframe'); s.head = s.el.querySelector('.page-head');
      pages.insertBefore(s.el, $('.page.ghost', pages));
      slots.push(s);
    }
    slots.forEach((s, i) => { s.el.dataset.i = i; });
  }
  function ghost() {
    let g = $('.page.ghost', pages);
    if (!g) { g = Object.assign(document.createElement('section'), { className: 'page ghost' }); pages.append(g); }
    g.innerHTML = `<div class="page-head"><span class="page-name muted">Seite ${faces().length + 1}</span></div><div class="device" id="add-page" role="button" tabindex="0" aria-label="Seite hinzufügen"><span class="plus">${ic('plus')}</span><span>Seite hinzufügen</span></div>`;
  }
  const headHTML = (f, i) => {
    const grid = f.type === 'grid', meta = FACE[f.type] || [f.type], design = DESIGN[GROUP[f.type]] ? designs(f)?.find(([v]) => v === designCur(f))?.[1] : '';
    const chosen = S.ui.sel?.f === f.id, ins = S.ui.insert?.f === f.id ? S.ui.insert.cell : null;
    return `${faces().length > 1 ? `<button class="grab ${chosen ? 'sel' : ''}" data-grab title="Ziehen ändert die Reihenfolge, die Pfeiltasten ← → verschieben um einen Platz" aria-label="Seite ${i + 1} verschieben">${ic('grip', 'grip')}<span class="page-name">Seite ${i + 1}</span></button>` : `<span class="page-name ${chosen ? 'sel' : ''}">Seite 1</span>`}
      <span class="page-title" title="${esc(faceName(f))}">${esc(faceName(f))}${design ? `<small> · ${esc(design)}</small>` : ''}</span>
      ${ins ? `<button class="insert-chip" data-clear-insert title="Markierung aufheben">Neue Kachel: Zeile ${ins[0] + 1}, Spalte ${ins[1] + 1} ${ic('x')}</button>` : ''}
      <span class="page-side">${grid ? `<span class="page-count ${used(f) > cells(f) ? 'over' : ''}" title="Belegte Zellen">${used(f)}/${cells(f)}</span>` : `<span class="page-count" title="Hintergrund">${esc(bgName(f.bg))}</span>`}<button class="icon-btn" data-pm aria-label="Seite ${i + 1}: mehr">${ic('dots')}</button></span>`;
  };

  // ---- Vorschau-Frames ----
  const post = (s, m) => s.frame.contentWindow?.postMessage({ hb: 'preview', ...m }, location.origin);
  function syncSlot(s, i) {
    const f = faces()[i]; if (!f || !s.ready) return;
    const conf = { ...S.cfg, off: [] };
    conf.faces = [f];
    const key = JSON.stringify(conf), m = {};
    const j = selTile(f);
    if (key !== s.sent) { s.sent = key; m.conf = conf; m.face = f.id; m.edit = f.type === 'grid'; m.sel = j; s.sel = j; }
    else if (j !== s.sel) { s.sel = j; m.sel = j; }
    if (S.flash?.f === f.id) { m.flash = S.flash.j; S.flash = null; }
    if (Object.keys(m).length) post(s, m);
  }
  function sync() { if (!S.cfg) return; ensureSlots(); slots.forEach((s, i) => { s.frame.title = faceName(faces()[i]); s.head.innerHTML = headHTML(faces()[i], i); s.el.classList.toggle('chosen', S.ui.sel?.f === faces()[i].id); s.el.classList.toggle('plain', faces()[i].type !== 'grid'); syncSlot(s, i); }); ghost(); chrome(); }
  function chrome() {
    const n = faces().length, tiles = faces().reduce((a, f) => a + tilesOf(f).length, 0), d = S.undo.at(-1), r = S.redo.at(-1);
    $('#count', el).textContent = `${n} Seite${n === 1 ? '' : 'n'} · ${tiles} Kachel${tiles === 1 ? '' : 'n'}`;
    for (const [id, x, t] of [['undo', d, 'Rückgängig'], ['redo', r, 'Wiederholen']]) { const b = $('#' + id, el); b.disabled = !x; b.title = x ? `${t}: ${x.label} · ${id === 'undo' ? '⌘Z' : '⇧⌘Z'}` : t; b.setAttribute('aria-label', b.title); }
    $('#zreset', el).textContent = Math.round(zoom * 100) + '%';
    el.style.setProperty('--pw', Math.round(BASE * zoom) + 'px');
    // Hinweise
    const w = [];
    const lostF = faces().filter(f => f.type === 'grid' && lost(f));
    if (dev() && !dev().connected) w.push(['info', 'Das Display ist gerade offline. Änderungen werden gespeichert und beim nächsten Öffnen übernommen.']);
    for (const f of lostF) w.push(['warn', `${lost(f)} Kachel${lost(f) > 1 ? 'n passen' : ' passt'} auf „${faceName(f)}“ nicht mehr ins Raster und ${lost(f) > 1 ? 'werden' : 'wird'} nicht angezeigt.`]);
    if (!faces().some(f => f.type === 'grid')) w.push(['info', 'Kacheln gibt es auf Smart-Home-Seiten: lege über „Seite hinzufügen“ eine an.']);
    else if (!faces().some(f => tilesOf(f).length)) w.push(['info', 'Lege deine erste Lampe, Szene oder dein erstes Gerät aus der Bibliothek auf eine Seite.', 'plus']);
    $('#notices', el).innerHTML = w.map(([k, t, i]) => `<div class="notice ${k === 'warn' ? 'warn' : ''}" role="status">${ic(i || (k === 'warn' ? 'alert' : 'info'))}<span>${esc(t)}</span></div>`).join('');
  }

  const onMessage = e => {
    const m = e.data;
    if (e.origin !== location.origin || !m?.hb) return;
    const i = slots.findIndex(s => s.frame.contentWindow === e.source);
    if (i < 0) return;
    const s = slots[i], f = faces()[i];
    if (m.hb === 'preview-ready') { s.ready = true; s.sent = ''; post(s, { states: S.states }); return syncSlot(s, i); }
    if (!f || m.face !== f.id) return;
    if (m.hb === 'tile') select({ k: 'tile', f: f.id, j: m.j });
    else if (m.hb === 'facetap') select({ k: 'page', f: f.id });
    else if (m.hb === 'empty') { select({ k: 'page', f: f.id }, { f: f.id, cell: m.cell }); lib.focus(); }
    else if (m.hb === 'move') {
      const t = f.tiles[m.j];
      mutate('Kachel verschoben', () => { const g = faceBy(f.id); g.tiles = moveTo(g.tiles, m.j, m.cell, rows(g)); });
      select({ k: 'tile', f: f.id, j: faceBy(f.id).tiles.indexOf(t) });
    }
    else if (m.hb === 'resize') { if (!resizeTile(f.id, m.j, m.w, m.h)) { s.sent = ''; syncSlot(s, i); } }
    else if (m.hb === 'remove') removeTiles(f.id, [m.j]);
  };
  addEventListener('message', onMessage);
  const offs_ = [on('doc', () => { validate(); sync(); }), on('sel', () => { sync(); scrollToSel(); }), on('states', () => slots.forEach(s => s.ready && post(s, { states: S.states })))];
  offs.push(...offs_);
  function validate() {   // Auswahl, die es nicht mehr gibt, schließen
    const sel = S.ui.sel; if (!sel) return;
    const f = faceBy(sel.f);
    if (!f || (sel.k === 'tile' && !f.tiles?.[sel.j])) { S.ui.sel = null; S.ui.insert = null; queueMicrotask(() => emit('sel')); }
    if (S.ui.insert && !faceBy(S.ui.insert.f)) S.ui.insert = null;
  }
  function scrollToSel() { const f = S.ui.sel && faces().findIndex(x => x.id === S.ui.sel.f); if (f >= 0) slots[f]?.el.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' }); }

  // ---- Bedienung ----
  el.addEventListener('click', e => {
    const pm = e.target.closest('[data-pm]');
    if (pm) { const i = +pm.closest('.page').dataset.i; return pageMenu(pm, i); }
    if (e.target.closest('[data-clear-insert]')) return select(S.ui.sel);
    if (e.target.closest('#add-page')) return addPageFlow();
    const pg = e.target.closest('.page:not(.ghost)');
    if (pg && !e.target.closest('iframe,button:not([data-grab])')) { const f = faces()[+pg.dataset.i]; if (f) select({ k: 'page', f: f.id }); return; }
    if (e.target.closest('#undo')) return undo();
    if (e.target.closest('#redo')) return redo();
    if (e.target.closest('#prev')) return openPreview(Math.max(0, faces().findIndex(f => f.id === S.ui.sel?.f)));
    if (e.target.closest('#addpage')) return addPageFlow();
    if (e.target.closest('#help')) return helpPop(e.target.closest('#help'));
    const z = e.target.closest('#zin,#zout,#zreset');
    if (z) setZoom(z.id === 'zreset' ? 1 : z.id === 'zin' ? ZOOMS.find(v => v > zoom + 1e-6) ?? zoom : [...ZOOMS].reverse().find(v => v < zoom - 1e-6) ?? zoom);
  });
  el.addEventListener('keydown', e => {
    if (e.target.id === 'add-page' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return addPageFlow(); }
    const g = e.target.closest?.('[data-grab]');
    if (g && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); const i = +g.closest('.page').dataset.i, j = i + (e.key === 'ArrowLeft' ? -1 : 1); if (j >= 0 && j < faces().length) { movePage(i, j); requestAnimationFrame(() => slots[j]?.el.querySelector('[data-grab]')?.focus()); } }
  });
  el.addEventListener('contextmenu', e => {
    const pg = e.target.closest('.page:not(.ghost)');
    if (!pg || e.target.closest('iframe')) return;
    e.preventDefault(); const i = +pg.dataset.i; select({ k: 'page', f: faces()[i].id }); pageMenu(pg.querySelector('[data-pm]'), i);
  });
  // Klick auf die freie Fläche schließt die Auswahl
  canvas.addEventListener('click', e => { if (e.target === canvas || e.target === pages || e.target.classList.contains('notices') || e.target.classList.contains('toolbar')) select(null); });
  function setZoom(v) {
    const mid = (pages.scrollLeft + pages.clientWidth / 2) / zoom;
    zoom = v; try { localStorage.setItem(ZKEY, String(zoom)); } catch { /* Speicher gesperrt */ }
    chrome(); pages.scrollLeft = mid * zoom - pages.clientWidth / 2;
  }
  // Seite per Griff umsortieren: die Seite folgt dem Zeiger, die anderen rücken per Transform, erst beim Loslassen ändert sich der Entwurf
  pages.addEventListener('pointerdown', e => {
    const g = e.target.closest('[data-grab]');
    if (!g || e.button) return;
    const from = +g.closest('.page').dataset.i, els = slots.map(s => s.el), rects = els.map(x => x.getBoundingClientRect()), x0 = e.clientX;
    let to = from, moved = false;
    g.setPointerCapture(e.pointerId);
    const mv = ev => {
      const dx = ev.clientX - x0;
      if (!moved && Math.abs(dx) < 6) return;
      if (!moved) { moved = true; els[from].classList.add('carried'); els.forEach(x => x.style.transition = 'transform .2s var(--ease)'); els[from].style.transition = 'none'; }
      els[from].style.transform = `translateX(${dx}px)`;
      const c = rects[from].left + rects[from].width / 2 + dx;
      to = Math.max(0, Math.min(els.length - 1, rects.reduce((b, r, k) => Math.abs(r.left + r.width / 2 - c) < Math.abs(rects[b].left + rects[b].width / 2 - c) ? k : b, 0)));
      const pitch = rects[1] ? rects[1].left - rects[0].left : 0;
      els.forEach((x, k) => { if (k === from) return; x.style.transform = from < to && k > from && k <= to ? `translateX(${-pitch}px)` : from > to && k < from && k >= to ? `translateX(${pitch}px)` : ''; });
    };
    const up = () => {
      g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
      els.forEach(x => { x.style.transition = 'none'; x.style.transform = ''; x.classList.remove('carried'); });
      if (moved) { suppress = Date.now(); movePage(from, to); select({ k: 'page', f: faces()[to].id }); }
    };
    g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  });
  let suppress = 0;
  el.addEventListener('click', e => { if (Date.now() - suppress < 400) { e.stopPropagation(); e.preventDefault(); } }, true);

  ensureSlots(); sync();
  return { lib, unmount() { offs.forEach(f => f()); removeEventListener('message', onMessage); slots = []; } };
}

export function pageMenu(anchor, i) {
  const f = S.cfg.faces[i], n = S.cfg.faces.length, d = byId(S.sel);
  menu(anchor, [
    { label: 'Seiteneinstellungen', icon: 'sliders', run: () => select({ k: 'page', f: f.id }) },
    { label: 'Auf dem Display zeigen', icon: 'monitor-eye', disabled: !d?.connected, title: d?.connected ? '' : 'Das Display ist offline', run: () => call('command', { display: S.sel, action: 'face', face: f.type }).then(() => toast('Gesendet')).catch(e => toast(e?.message || 'Fehler', { bad: true })) },
    '-', { group: 'Reihenfolge' },
    { label: 'Nach links', icon: 'arrow-left', disabled: i === 0, run: () => movePage(i, i - 1) },
    { label: 'Nach rechts', icon: 'arrow-right', disabled: i === n - 1, run: () => movePage(i, i + 1) },
    '-', { label: 'Seite duplizieren', icon: 'copy', disabled: !!GROUP[f.type], title: GROUP[f.type] ? 'Uhr, Kalender und Datum gibt es je Display nur einmal' : '', run: () => duplicatePage(f.id) },
    { label: 'Seite ausblenden', icon: 'eye-off', disabled: n < 2, end: 'bleibt gespeichert', run: () => hidePage(f.id) },
    '-', { label: 'Seite löschen', icon: 'trash', danger: true, disabled: n < 2, end: tilesOf(f).length ? `${tilesOf(f).length} Kacheln` : '', run: () => removePage(f.id) },
  ], { width: 260 });
}

// ---- Seite hinzufügen ----
export async function addPageFlow() {
  const hidden = S.cfg.off || [], types = pageTypes();
  const row = (k, v, name, sub, m) => `<button class="pgc" data-r="${k}:${esc(v)}"><span class="ico" style="background:${m[1]}">${ic(m[2])}</span><span class="t"><b>${esc(name)}</b><small>${esc(sub)}</small></span>${ic('right')}</button>`;
  const r = await modal(`<div class="dh"><h2>Seite hinzufügen</h2><button class="icon-btn" data-r="" aria-label="Schließen">${ic('x')}</button></div>
    ${hidden.length ? `<div class="ml">Ausgeblendet · wieder einblenden</div><div class="pgl">${hidden.map(f => row('show', f.id, faceName(f), 'behält ihre Einstellungen', FACE[f.type] || [f.type, '#8e8e93', 'grid'])).join('')}</div>` : ''}
    <div class="ml">Neue Seite</div><div class="pgl">${types.map(t => row('new', t, { grid: 'Smart Home', music: 'Musik' }[t] || (GROUP[t] ? ({ clock: 'Uhr', calendar: 'Kalender', date: 'Datum' })[GROUP[t]] : FACE[t][0]), { grid: 'Kacheln für Lampen, Szenen, Geräte', music: 'Wiedergabe und Cover', bigclock: 'Große Uhr', weather: 'Wetter und Vorhersage', energy: 'Solar, Netz, Batterie, Auto', calendar: 'Termine', date: 'Datum groß', cams: 'Kameras und Türklingel', people: 'Wer ist zuhause' }[t] || '', FACE[t])).join('')}</div>`, { cls: 'wide add-page', label: 'Seite hinzufügen' });
  if (!r) return;
  const [k, v] = [r.slice(0, r.indexOf(':')), r.slice(r.indexOf(':') + 1)];
  if (k === 'show') showPage(v); else addPage(v);
}

// ---- Hilfe ----
function helpPop(anchor) {
  popover(anchor, `<div class="help-pop"><h3>So funktioniert es</h3>${[
    ['pencil', 'Ändern', 'Tippe auf eine Kachel oder eine Seite: rechts öffnen sich die Einstellungen.'],
    ['plus', 'Hinzufügen', 'Tippe auf eine leere Stelle der Seite und dann auf etwas in der Bibliothek, oder nur in der Bibliothek auf +.'],
    ['grip', 'Verschieben', 'Kachel in der Vorschau ziehen. Seiten am Griff „Seite n“ ziehen.'],
    ['copy', 'Kopieren', 'Kachel wählen, dann ⌘C und ⌘V auf einer anderen Seite oder einem anderen Display.'],
    ['play', 'Vorschau', 'Wische durch die Seiten wie am Display. Es wird nichts geschaltet.'],
    ['send', 'Senden', 'Änderungen bleiben ein Entwurf, bis du „Speichern & senden“ drückst.']].map(([i, t, d]) => `<div class="help-tip-row"><span class="hi">${ic(i)}</span><span><b>${t}</b> ${d}</span></div>`).join('')}</div>`, { cls: 'help', width: 330 });
}

// ---- Vorschau: durch die Seiten wischen wie am Display ----
export function openPreview(start = 0) {
  const fs = S.cfg.faces;
  let i = Math.min(start, fs.length - 1), ready = false, frame;
  const send = (anim = false, full = true) => { if (!ready) return; frame.contentWindow.postMessage({ hb: 'preview', ...(full && { conf: { ...S.cfg, off: [] } }), face: fs[i].id, edit: false, sel: -1, ...(anim && { anim: true }), states: S.states }, location.origin); };
  const dots = d => { $$('.pv-dots i', d).forEach((x, k) => x.classList.toggle('on', k === i)); $('.pv-name', d).textContent = faceName(fs[i]); };
  const go = (d, n, dir) => { if (n < 0 || n >= fs.length || n === i) return; i = n; send(true, false); dots(d); };
  const onMsg = (d, e) => { if (e.origin !== location.origin || e.source !== frame.contentWindow) return; if (e.data?.hb === 'preview-ready') { ready = true; send(); } else if (e.data?.hb === 'swipe') go(d, i + e.data.dir); else if (e.data?.hb === 'facetap') { /* nur Vorschau */ } };
  modal(`<div class="dh"><h2>Vorschau</h2><span class="pv-name"></span><button class="icon-btn" data-r="" aria-label="Schließen">${ic('x')}</button></div>
    <div class="pv-device"><iframe title="Vorschau" src="index.html?preview"></iframe></div>
    <div class="pv-bar"><button class="icon-btn" data-d="-1" aria-label="Vorherige Seite">${ic('left')}</button><span class="pv-dots">${fs.map(() => '<i></i>').join('')}</span><button class="icon-btn" data-d="1" aria-label="Nächste Seite">${ic('right')}</button></div>
    <p class="hint center">Nur zum Ausprobieren: Wische durch die Seiten. Es wird nichts geschaltet.</p>`, { cls: 'pv', label: 'Vorschau', init: (d, done) => {
    frame = $('iframe', d); dots(d);
    const h = e => onMsg(d, e), k = e => { if (e.key === 'ArrowLeft') go(d, i - 1); else if (e.key === 'ArrowRight') go(d, i + 1); };
    addEventListener('message', h); document.addEventListener('keydown', k);
    d.addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) go(d, i + +b.dataset.d); });
    const obs = new MutationObserver(() => { if (!d.isConnected) { removeEventListener('message', h); document.removeEventListener('keydown', k); obs.disconnect(); } }); obs.observe(document.body, { childList: true });
  } });
}
