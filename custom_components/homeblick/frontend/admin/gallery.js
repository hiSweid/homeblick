// Hinzufügen-Blatt (wie die Widget-Galerie von iOS): Vorschläge für den Raum, Widgets, Kategorien und Räume; die Suche läuft über alles.
// Ein Tipp legt die Kachel auf die Seite, das Blatt bleibt für weitere offen. Ersetzt die Bibliothek unter den Seiten.
import { $, esc, ic, modal } from './ui.js';
import { tx, LOC } from '../i18n.js';
import { DOM, avatar, areasOf, entsFor, entsIn, findEnts, stateText } from './entities.js';
import { ROOM_DOM, TILE_DOM, faceName, tileOf, tileTitle } from './meta.js';
import { S, byId } from './state.js';
import { addPage, addTiles, targetFace, widgetTile } from './edit.js';

const FILTERS = [   // [Schlüssel, Name, Domains]
  ['light', tx('Licht'), ['light']], ['climate', tx('Klima'), ['climate']], ['cover', tx('Rollos & Tore'), ['cover']], ['lock', tx('Schlösser'), ['lock']],
  ['scene', tx('Szenen & Skripte'), ['scene', 'script']], ['switch', tx('Schalter'), ['switch', 'input_boolean', 'button', 'input_button']], ['media', tx('Medien'), ['media_player']],
  ['fan', tx('Ventilatoren'), ['fan']], ['camera', tx('Kameras'), ['camera']], ['sensor', tx('Sensoren'), ['sensor']], ['binary', tx('Status'), ['binary_sensor']], ['timer', tx('Timer'), ['timer']],
];
const WIDGETS = [['analog', tx('Uhr analog'), 'clock', '#636366', tx('Zifferblatt mit Zeigern')], ['digital', tx('Uhr digital'), 'clock', '#636366', tx('Ziffern, 2 × 1')], ['wx', tx('Wetter'), 'sun', '#32ade6', tx('Aktuelles Wetter, 2 × 1')]];
const SHOWN = 80;
const EN_W = [['en:pv', tx('Solar jetzt'), 'sun', '#ffd60a', tx('Leistung und Tageskurve, 2 × 1')], ['en:aut', tx('Autarkie'), 'bolt', '#30d158', tx('Ring in Prozent')], ['en:use', tx('Verbrauch'), 'house', '#ff9f0a', tx('Haus und Netzbalken')],
  ['en:bat', tx('Akku'), 'bolt', '#28b04a', tx('Ladestand')], ['en:car', tx('Auto‖Fahrzeug'), 'bolt', '#1d8fd8', tx('Ladestand und Reichweite')], ['en:day', tx('Heute'), 'sun', '#ffd60a', tx('Ertrag von der Prognose')], ['en:tmr', tx('Morgen'), 'sun', '#8e8e93', tx('Prognose und Spitzenzeit')]];
const wLabel = { wx: tx('Wetter'), analog: tx('Uhr'), digital: tx('Uhr'), ...Object.fromEntries(EN_W.map(x => [x[0], x[1]])) };
const widgets = () => targetFace()?.type === 'energy' ? [...EN_W, ...WIDGETS] : WIDGETS;

export function openGallery() {
  if ($('.sheet.gal')) return;
  const pool = entsFor(TILE_DOM), area = byId(S.sel)?.area || '';
  let q = '', view = null, items = [], hi = 0, dlg;   // view: null = Start, { k: 'cat' | 'room', id }
  const placed = () => { const m = new Map(); for (const f of S.cfg?.faces || []) for (const t of f.tiles || []) if (t.e) m.set(t.e, (m.get(t.e) || 0) + 1); return m; };
  const byRoom = () => { const m = new Map(); for (const e of pool) if (e.area) (m.get(e.area) || m.set(e.area, []).get(e.area)).push(e); return m; };

  const row = (e, pl) => {
    const n = pl.get(e.id) || 0, i = items.push({ e }) - 1, ctx = [DOM[e.domain]?.[0] || e.domain, view?.k === 'room' ? '' : e.area, e.device !== e.name && e.device].filter(Boolean).join(' · ');
    return `<button class="ent" data-i="${i}" title="${esc(e.id)}${n ? ' · ' + tx('liegt schon auf diesem Display, nochmal für eine zweite Kachel') : ''}">${avatar(e.domain)}<span class="tx"><b>${esc(e.name)}</b><small>${esc(ctx || stateText(e))}</small></span>${n > 1 ? `<span class="cnt">×${n}</span>` : ''}<span class="addc ${n ? 'done' : ''}">${ic(n ? 'check' : 'plus')}</span></button>`;
  };
  const wrow = ([k, n, i, c, s]) => { const idx = items.push({ w: k }) - 1; return `<button class="ent" data-i="${idx}"><span class="av" style="--c:${c}">${ic(i)}</span><span class="tx"><b>${n}</b><small>${s}</small></span><span class="addc">${ic('plus')}</span></button>`; };
  const grp = (title, body) => `<div class="sect">${title ? `<div class="group-h">${title}</div>` : ''}<div class="group">${body}</div></div>`;

  function where() {
    const f = targetFace(), cell = f && S.ui.insert?.f === f.id;
    if (!f) return `<div class="gal-where">${ic('info')}<span>${tx('Kacheln gibt es auf Smart-Home- und Energie-Ansichten.')}</span><button class="btn mini quiet" data-newpage style="margin-left:auto">${tx('Ansicht anlegen')}</button></div>`;
    return `<div class="gal-where">${ic('layout')}<span>${esc(tx('Kommt auf „{name}“', { name: faceName(f) }))}${cell ? ' · ' + tx('auf den markierten Platz') : ''}</span></div>`;
  }
  function draw(dir = '') {
    items = []; hi = 0;
    const pl = placed(), bar = $('#gb-bar', dlg), body = $('#gb', dlg), rooms = byRoom(), s = q.trim();
    let title = tx('Hinzufügen'), html = where();
    if (s) {
      const w = widgets().filter(x => x[1].toLowerCase().includes(s.toLowerCase())), hits = findEnts(s, TILE_DOM);
      html += (w.length ? grp(tx('Widgets'), w.map(wrow).join('')) : '') + (hits.length ? grp(tx('{n} Treffer', { n: hits.length }), hits.slice(0, SHOWN).map(e => row(e, pl)).join('')) + (hits.length > SHOWN ? `<p class="hint center" style="padding:10px">${tx('Weiter tippen, um einzugrenzen.')}</p>` : '') : '') + (!w.length && !hits.length ? `<div class="gal-none">${tx('Nichts gefunden.')}<br><small>${tx('Versuche einen anderen Namen, Raum oder ein Gerät.')}</small></div>` : '');
    } else if (view) {
      const list = view.k === 'cat' ? pool.filter(e => FILTERS.find(f => f[0] === view.id)[2].includes(e.domain)) : rooms.get(view.id) || [];
      title = view.k === 'cat' ? FILTERS.find(f => f[0] === view.id)[1] : view.id;
      if (view.k === 'room') {   // im Raum nach Art gliedern
        const by = new Map(); for (const e of list.slice().sort((a, b) => ROOM_DOM.indexOf(a.domain) - ROOM_DOM.indexOf(b.domain) || a.name.localeCompare(b.name, LOC))) (by.get(DOM[e.domain]?.[0] || e.domain) || by.set(DOM[e.domain]?.[0] || e.domain, []).get(DOM[e.domain]?.[0] || e.domain)).push(e);
        const gr = [['light', tx('Alle Lichter'), tx('Lichter {room}', { room: view.id })], ['cover', tx('Alle Rollläden'), tx('Rollläden {room}', { room: view.id })]].map(([d, n, s]) => [d, n, s, list.filter(e => e.domain === d && e.dc !== 'garage')]).filter(g => g[3].length > 1);   // Sammelkachel: ein Tipp für alle
        html += gr.length ? grp(tx('Als eine Kachel'), gr.map(([d, n, s, es]) => { const i = items.push({ g: { kind: 'multi', dom: d, title: s, ents: es.map(e => e.id) } }) - 1; return `<button class="ent" data-i="${i}">${avatar(d)}<span class="tx"><b>${n}</b><small>${esc(tx('{n} in {room} · Tippen schaltet alle', { n: es.length, room: view.id }))}</small></span><span class="addc">${ic('plus')}</span></button>`; }).join('')) : '';
        html += [...by].map(([n, es]) => grp(n, es.map(e => row(e, pl)).join(''))).join('');
      } else html += grp('', list.slice(0, SHOWN).map(e => row(e, pl)).join('')) + (list.length > SHOWN ? `<p class="hint center" style="padding:10px">${tx('{n} Einträge: suche, um einzugrenzen.', { n: list.length })}</p>` : '');
    } else {
      const sug = area ? entsIn(area).filter(e => ROOM_DOM.includes(e.domain) && !pl.has(e.id)).sort((a, b) => ROOM_DOM.indexOf(a.domain) - ROOM_DOM.indexOf(b.domain) || a.name.localeCompare(b.name, LOC)).slice(0, 12) : [];
      if (sug.length) html += `<div class="sect"><div class="group-h">${esc(tx('Vorschläge für {area}', { area }))}</div><div class="sug">${sug.map(e => { const i = items.push({ e }) - 1; return `<button class="sug-card" data-i="${i}">${avatar(e.domain, 'lg')}<span class="tx"><b>${esc(e.name)}</b><small>${esc(DOM[e.domain]?.[0] || e.domain)}</small></span><span class="addc">${ic('plus')}</span></button>`; }).join('')}</div></div>`;
      html += grp(tx('Widgets'), widgets().map(wrow).join(''));
      const cats = FILTERS.map(f => [f, pool.filter(e => f[2].includes(e.domain)).length]).filter(x => x[1]);
      html += grp(tx('Kategorien'), cats.map(([f, n]) => `<button class="ent" data-cat="${f[0]}">${avatar(f[2][0])}<span class="tx"><b>${f[1]}</b></span><span class="cnt">${n}</span>${ic('right')}</button>`).join(''));
      const rs = [...rooms].sort((a, b) => a[0].localeCompare(b[0], LOC));
      if (rs.length) html += grp(tx('Räume'), rs.map(([r, es]) => `<button class="ent" data-room="${esc(r)}"><span class="av" style="--c:#8e8e93">${ic('house')}</span><span class="tx"><b>${esc(r)}</b></span><span class="cnt">${es.length}</span>${ic('right')}</button>`).join(''));
    }
    bar.innerHTML = `<span class="l">${view && !s ? `<button class="bk" data-nav aria-label="${tx('Zurück')}">${ic('left')}<span>${tx('Hinzufügen')}</span></button>` : ''}</span><h2>${esc(title)}</h2><span class="r"><button class="done" data-r="">${tx('Fertig')}</button></span>`;
    body.innerHTML = `<div class="gal-view ${dir}" ${dir ? '' : 'style="animation:none"'}>${html}</div>`;
    if (dir) body.scrollTop = 0;
    $('.ent[data-i]', body)?.classList.toggle('hi', !!s);
  }
  function add(btn) {
    if (!S.cfg) return;
    const it = items[+btn.dataset.i]; if (!it) return;
    const r = it.g ? addTiles([it.g], tx('{name} hinzugefügt', { name: it.g.title }), { pickIt: false }) : it.w ? addTiles([widgetTile(it.w)], tx('{name} hinzugefügt', { name: wLabel[it.w] }), { pickIt: false }) : addTiles([tileOf(it.e)], tx('{name} hinzugefügt', { name: tileTitle(tileOf(it.e)) }), { pickIt: false });
    if (!r) return;
    const c = $('.addc', btn); c.classList.add('done'); c.innerHTML = ic('check');
    if (S.ui.insert === null) $('.gal-where span', dlg) && ($('.gal-where span', dlg).textContent = $('.gal-where span', dlg).textContent.replace(' · ' + tx('auf den markierten Platz'), ''));
  }
  modal(`<div class="sheet-bar" id="gb-bar"></div><div class="gal-search"><label class="search-field">${ic('search')}<input type="search" id="gq" placeholder="${tx('Lampen, Szenen, Geräte suchen')}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${tx('Suchen')}"></label></div><div class="gal-body" id="gb"></div>`, { cls: 'gal', label: tx('Hinzufügen'), init: d => {
    dlg = d; draw();
    const inp = $('#gq', d);
    inp.addEventListener('input', () => { q = inp.value; draw(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && q.trim()) { e.preventDefault(); const b = $('.ent[data-i]', d); b && add(b); } });
    d.addEventListener('click', e => {
      const t = s => e.target.closest(s);
      if (t('[data-nav]')) { view = null; return draw('pback'); }
      const c = t('[data-cat]'); if (c) { view = { k: 'cat', id: c.dataset.cat }; return draw('fwd'); }
      const r = t('[data-room]'); if (r) { view = { k: 'room', id: r.dataset.room }; return draw('fwd'); }
      if (t('[data-newpage]')) { addPage('grid'); return draw(); }
      const a = t('[data-i]'); if (a) add(a);
    });
  } });
}
