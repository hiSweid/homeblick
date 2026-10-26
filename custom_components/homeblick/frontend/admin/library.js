// Bibliothek unter den Seiten: Widgets und Entities suchen, filtern und per Tipp auf die gewählte Seite (bzw. markierte Zelle) legen.
import { $, esc, fold, ic } from './ui.js';
import { DOM, avatar, entsFor, findEnts, stateText } from './entities.js';
import { TILE_DOM } from './meta.js';
import { S } from './state.js';
import { addEntity, addWidget, targetFace } from './edit.js';
import { sw } from './controls.js';

const FILTERS = [   // [Schlüssel, Name, Domains]
  ['light', 'Licht', ['light']], ['climate', 'Klima', ['climate']], ['cover', 'Rollos & Tore', ['cover']], ['lock', 'Schlösser', ['lock']],
  ['scene', 'Szenen & Skripte', ['scene', 'script']], ['switch', 'Schalter', ['switch', 'input_boolean', 'button', 'input_button']], ['media', 'Medien', ['media_player']],
  ['fan', 'Ventilatoren', ['fan']], ['camera', 'Kameras', ['camera']], ['sensor', 'Sensoren', ['sensor']], ['binary', 'Status', ['binary_sensor']], ['timer', 'Timer', ['timer']],
];
const WIDGETS = [['analog', 'Uhr analog', 'clock', '#636366', 'Zifferblatt mit Zeigern'], ['digital', 'Uhr digital', 'clock', '#636366', 'Ziffern, 2 × 1'], ['wx', 'Wetter', 'sun', '#32ade6', 'Aktuelles Wetter, 2 × 1']];
const SHOWN = 80, KEY = 'hb-admin.lib';
const store = { get: k => { try { return localStorage.getItem(`${KEY}.${k}`); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(`${KEY}.${k}`, v); } catch { /* Speicher gesperrt */ } } };

export function mountLibrary(host) {
  let open = store.get('open') === null ? !matchMedia('(max-width:640px)').matches : store.get('open') !== '0', h = Math.min(Math.max(+store.get('h') || 300, 180), innerHeight * .7), q = '', filter = '', room = '', hide = false, hi = -1, items = [];
  host.className = 'library';
  host.innerHTML = `<div class="lib-grip" role="separator" tabindex="0" aria-label="Höhe der Bibliothek ändern"></div>
    <div class="lib-head"><button class="lib-title" id="lib-toggle" aria-expanded="true" title="Tippe auf +, um etwas auf die gewählte Seite zu legen. Eine leere Zelle in der Vorschau markiert den Platz. ⌘K sucht überall.">${ic('down')}<span>Bibliothek</span></button>
      <label class="lib-search">${ic('search')}<input type="search" id="lib-q" placeholder="Name, Gerät oder Raum suchen …" aria-label="Eintrag hinzufügen" autocomplete="off" spellcheck="false"><kbd>/</kbd></label><span class="lib-count"></span></div>
    <div class="lib-body"><nav class="lib-rail"><div id="lib-filters"></div><div id="lib-rooms"></div><label class="lib-hide" title="Blendet aus, was schon auf diesem Display liegt"><span>Platziertes ausblenden</span>${sw(false, 'hide')}</label></nav>
      <div class="lib-list" id="lib-list" role="listbox" aria-live="polite"></div></div>`;
  const qi = $('#lib-q', host), list = $('#lib-list', host);

  const placedMap = () => { const m = new Map(); for (const f of S.cfg?.faces || []) for (const t of f.tiles || []) if (t.e) m.set(t.e, (m.get(t.e) || 0) + 1); return m; };
  const applyH = () => { host.style.height = open ? h + 'px' : '49px'; host.classList.toggle('shut', !open); $('#lib-toggle', host).setAttribute('aria-expanded', open); host.querySelector('.lib-body').toggleAttribute('inert', !open); };

  function pool() {
    const base = q.trim() ? findEnts(q, TILE_DOM) : entsFor(TILE_DOM), pl = placedMap();
    return base.filter(e => !(hide && pl.has(e.id)));
  }
  function draw() {
    const pl = placedMap(), all = pool(), counts = {}, rc = {};
    for (const [k, , d] of FILTERS) counts[k] = all.filter(e => d.includes(e.domain)).length;
    const byF = filter ? all.filter(e => FILTERS.find(f => f[0] === filter)[2].includes(e.domain)) : all;
    for (const e of byF) if (e.area) rc[e.area] = (rc[e.area] || 0) + 1;
    const res = room ? byF.filter(e => e.area === room) : byF;
    $('#lib-filters', host).innerHTML = [['', 'Alle', all.length], ...FILTERS.filter(f => counts[f[0]] || f[0] === filter).map(f => [f[0], f[1], counts[f[0]]])]
      .map(([k, n, c]) => `<button data-f="${k}" aria-pressed="${k === filter}"><span class="fi">${k ? avatar(FILTERS.find(f => f[0] === k)[2][0]) : ''}</span><span class="t">${esc(n)}</span><small>${c}</small></button>`).join('');
    const rooms = Object.keys(rc).sort((a, b) => a.localeCompare(b, 'de'));
    $('#lib-rooms', host).innerHTML = rooms.length ? `<div class="rail-h">Raum</div>${rooms.map(r => `<button data-r="${esc(r)}" aria-pressed="${r === room}"><span class="t">${esc(r)}</span><small>${rc[r]}</small></button>`).join('')}` : '';
    $('.lib-count', host).textContent = `${all.length} Entities`;
    const row = e => { const n = pl.get(e.id) || 0, i = items.push(e) - 1, ctx = [DOM[e.domain]?.[0] || e.domain, !room && !(q.trim() === '') ? e.area : '', e.device !== e.name && e.device].filter(Boolean).join(' · ');
      return `<button class="ent ${i === hi ? 'hi' : ''}" role="option" data-i="${i}" title="${esc(e.id)}${n ? ' · liegt schon auf diesem Display, nochmal für eine zweite Kachel' : ''}">${avatar(e.domain)}<span class="tx"><b>${esc(e.name)}</b><small>${esc(ctx || stateText(e))}</small></span><span class="add ${n ? 'mark' : ''}">${n ? (n > 1 ? '×' + n : '✓') : '+'}</span></button>`; };
    items = [];
    const shown = res.slice(0, SHOWN);
    let html = '';
    if (!q.trim() && !filter && !room) {
      html += `<div class="lib-group"><div class="lib-group-title">Widgets</div><div class="lib-grid">${WIDGETS.map(([k, n, i, c, s]) => `<button class="ent" role="option" data-w="${k}"><span class="av" style="--c:${c}">${ic(i)}</span><span class="tx"><b>${n}</b><small>${s}</small></span><span class="add">+</span></button>`).join('')}</div></div>`;
      const groups = new Map();
      for (const e of shown) { const g = e.area || 'Ohne Raum'; (groups.get(g) || groups.set(g, []).get(g)).push(e); }
      const names = [...groups.keys()].sort((a, b) => (a === 'Ohne Raum') - (b === 'Ohne Raum') || a.localeCompare(b, 'de'));
      html += names.map(g => `<div class="lib-group"><div class="lib-group-title">${esc(g)} <small>${groups.get(g).length}</small></div><div class="lib-grid">${groups.get(g).map(row).join('')}</div></div>`).join('');
    } else html += shown.length ? `<div class="lib-grid flat">${shown.map(row).join('')}</div>` : '';
    if (res.length > SHOWN) html += `<div class="hint lib-more">${res.length} Treffer. Weiter tippen, um einzugrenzen.</div>`;
    if (!res.length) html = `<div class="hint lib-none">${hide && !q && !filter ? 'Alles hier liegt schon auf diesem Display.' : 'Nichts gefunden. Versuche einen anderen Namen, Raum oder Filter.'}</div>`;
    list.innerHTML = html;
    $('.ent.hi', list)?.scrollIntoView({ block: 'nearest' });
  }
  const target = () => targetFace();
  const add = el => {
    if (!S.cfg) return;
    if (el.dataset.w) return addWidget(el.dataset.w);
    const e = items[+el.dataset.i]; if (e) addEntity(e);
  };
  host.addEventListener('click', e => {
    if (e.target.closest('#lib-toggle')) { open = !open; store.set('open', open ? '1' : '0'); applyH(); if (open) qi.focus({ preventScroll: true }); return; }
    const f = e.target.closest('[data-f]'), r = e.target.closest('[data-r]'), en = e.target.closest('.ent'), s = e.target.closest('.switch');
    if (f) { filter = f.dataset.f; room = ''; return draw(); }
    if (r) { room = room === r.dataset.r ? '' : r.dataset.r; return draw(); }
    if (s) { hide = s.getAttribute('aria-checked') !== 'true'; s.setAttribute('aria-checked', hide); return draw(); }
    if (en) add(en);
  });
  qi.addEventListener('input', () => { q = qi.value; hi = -1; if (!open) { open = true; applyH(); } draw(); host.classList.toggle('typing', !!q); });
  qi.addEventListener('keydown', e => {
    const n = items.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!open) { open = true; applyH(); } hi = n ? (hi + (e.key === 'ArrowDown' ? 1 : -1) + n) % n : -1; draw(); }
    else if (e.key === 'Enter') { const x = items[hi < 0 ? 0 : hi]; if (x && S.cfg) addEntity(x); }
    else if (e.key === 'Escape') { e.stopPropagation(); if (qi.value) { qi.value = ''; q = ''; hi = -1; draw(); } else { open = false; applyH(); qi.blur(); } }
  });
  // Höhe ziehen
  const grip = $('.lib-grip', host);
  grip.addEventListener('pointerdown', e => { e.preventDefault(); grip.setPointerCapture(e.pointerId); const y0 = e.clientY, h0 = open ? h : 49; host.classList.add('sizing'); document.body.style.userSelect = 'none';
    const mv = ev => { const v = h0 + y0 - ev.clientY; if (v < 108) { open = false; } else { open = true; h = Math.min(Math.max(v, 180), innerHeight * .7); } applyH(); };
    const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); host.classList.remove('sizing'); document.body.style.userSelect = ''; store.set('h', Math.round(h)); store.set('open', open ? '1' : '0'); };
    grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up); });
  grip.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); open = true; h = Math.min(Math.max(h + (e.key === 'ArrowUp' ? 40 : -40), 180), innerHeight * .7); applyH(); store.set('h', Math.round(h)); } });
  applyH(); draw();
  return {
    redraw: draw,
    focus(ch) { if (!open) { open = true; applyH(); } qi.focus({ preventScroll: true }); if (ch) { qi.value += ch; qi.dispatchEvent(new Event('input')); } },
    typing: () => document.activeElement === qi,
    target,
  };
}
