// Rechte Schublade (Inspector): Einstellungen der gewählten Seite oder Kachel. Jede Änderung geht sofort in den Entwurf (ein Rückgängig-Schritt, die Vorschau zeigt sie gleich).
import { pack, rows } from '../faces.js';
import { $, $$, esc, ic, menu, popover, closePop, toast } from './ui.js';
import { DOM, entOf, entsOf, pickEntity } from './entities.js';
import { S, byId, mutate, on, select, setSetting } from './state.js';
import { BG, COLORS, ENERGY, FACE, GROUP, ICONS, LEGACY, LOOKS, SIZES, STYLES, TILE_DOM, TOGGLE_DOM, autoTitle, bgCss, bgVal, designCur, designs, faceName, svOf, tileIcon, tileTitle, withDesign, xi } from './meta.js';
import { copyTiles, faceBy, faceIx, hidePage, lost, moveTile, removePage, removeTiles, resizeTile, tilesOf } from './edit.js';
import { bind, entityBtn, selectBtn, sroww, sw } from './controls.js';
import { pageMenu } from './layout.js';
import { setPath } from './util.js';
import { call } from './state.js';

const fold = (id, title, body, open, aside = '') => `<section class="insp-sec"><div class="insp-sec-head">${open === undefined ? `<h3>${title}</h3>` : `<button class="fold-btn" data-fold="${id}" aria-expanded="${open}">${ic('down')}<h3>${title}</h3></button>`}${aside ? `<small>${aside}</small>` : ''}</div>${open === false ? '' : `<div class="insp-sec-body">${body}</div>`}</section>`;
const prop = (label, control, { note = '', stack = false, icon = '' } = {}) => `<div class="prop ${stack ? 'stack' : ''}"><span class="prop-label">${icon ? ic(icon) : ''}${label}</span><div class="prop-value">${control}</div>${note ? `<div class="prop-note"><small>${note}</small></div>` : ''}</div>`;
const segB = (k, list, v) => `<span class="seg fill">${list.map(([a, n]) => `<button type="button" data-k="${k}" data-v="${esc(a)}" aria-pressed="${String(a) === String(v)}">${esc(n)}</button>`).join('')}</span>`;
const swatches = (k, list, cur, css) => `<div class="swatches">${list.map(([v, n]) => `<button type="button" class="sw-dot ${v === '' ? 'auto' : ''}" data-k="${k}" data-v="${esc(v)}" aria-pressed="${String(v) === String(cur)}" aria-label="${esc(n)}" title="${esc(n)}"><i style="background:${css(v)}"></i></button>`).join('')}</div>`;
const list = (rows_, foot = '') => `<div class="rows">${rows_}</div>${foot}`;

export function mount(el, { lib }) {
  const open = new Set();   // gefaltete Abschnitte, die aufgeklappt sind (je Auswahl neu)
  let lastSel = '';
  const dev = () => byId(S.sel);
  const selKey = () => JSON.stringify(S.ui.sel);
  const cfgFace = () => S.ui.sel && faceBy(S.ui.sel.f);
  const curTile = () => { const f = cfgFace(); return S.ui.sel?.k === 'tile' ? f?.tiles?.[S.ui.sel.j] : null; };
  const mt = (label, fn, merge) => mutate(label, c => { const f = c.faces.find(x => x.id === S.ui.sel?.f); if (f) fn(f, f.tiles?.[S.ui.sel.j]); }, merge);

  // ---- Kopf ----
  function head({ kind, title, sub, av, back, crumbs = [], more }) {
    return `<div class="dr-head kind-${kind}">${back ? `<button class="dr-back" data-back title="Zurück · Esc">${ic('left')}<span>${esc(back)}</span></button>` : ''}
      <span class="av">${av}</span><div class="tx"><span class="dr-kind">${kind === 'tile' ? 'Kachel' : 'Seite'}</span><b ${kind === 'tile' ? 'class="rename" data-rename title="Namen ändern"' : ''}>${esc(title)}${kind === 'tile' ? ic('pencil') : ''}</b>
      ${crumbs.length ? `<div class="crumbs">${crumbs.map(([t, go, mono]) => go ? `<button data-crumb="${go}" class="${mono ? 'mono' : ''}">${esc(t)}</button>` : `<span class="${mono ? 'mono' : ''}">${esc(t)}</span>`).join(ic('right', 'sep'))}</div>` : ''}</div>
      ${more ? `<button class="icon-btn" id="dr-more" aria-label="Mehr">${ic('dots')}</button>` : ''}<button class="icon-btn" id="dr-x" aria-label="Schließen" title="Schließen · Esc">${ic('x')}</button></div>`;
  }

  // ---- Seite ----
  function pageBody(f, i) {
    const d = dev(), s = d?.settings || {}, meta = FACE[f.type] || [f.type, '#8e8e93', 'grid'], photo = f.bg && typeof f.bg === 'object', sty = designs(f);
    const bgList = BG.filter(([v]) => !['calendar', 'date'].includes(f.type) || ['auto', 'black', 'white'].includes(v));
    const tile = (t, j) => { const en = entOf(t.e), sz = `${t.w || 1}×${t.h || 1}`; return `<button class="trow" data-tile="${j}"><span class="av sm" style="--c:${t.kind ? '#8e8e93' : DOM[en?.domain]?.[1] || '#8e8e93'}">${xi(tileIcon(t))}</span><span class="t"><b>${esc(tileTitle(t))}</b><small>${esc([t.sub, t.kind ? '' : en?.name || t.e, sz !== '1×1' && sz].filter(Boolean).join(' · '))}</small></span>${ic('right')}</button>`; };
    let h = '';
    if (!photo) h += fold('bg', 'Hintergrund', swatches('f.bg', bgList, f.bg, bgCss), undefined, esc(bgList.find(([v]) => String(v) === String(f.bg))?.[1] || ''));
    if (sty?.length) h += fold('design', 'Stil', prop('Design', sty.length <= 3 && sty.every(x => x[1].length < 12) ? segB('f.design', sty, designCur(f)) : selBtn('f.design', sty, designCur(f)), { stack: sty.length <= 3 && sty.every(x => x[1].length < 12) }));
    if (f.type === 'grid') {
      const n = lost(f);
      h += fold('tiles', 'Kacheln', `${list(tilesOf(f).map(tile).join('') || '<div class="hint pad">Noch keine Kacheln</div>')}<button class="ghost-btn" data-lib>${ic('plus')}Kachel hinzufügen</button>${n ? `<div class="notice warn" style="margin-top:8px">${ic('alert')}<span>${n} Kachel${n > 1 ? 'n passen' : ' passt'} nicht mehr ins Raster.</span></div>` : ''}`, undefined, `${tilesOf(f).length}`);
    }
    if (f.type === 'weather') h += fold('wx', 'Wetter', prop('Wetter-Entity', entityBtn('s.weather', s.weather, { domains: ['weather'], title: 'Wetter-Entity' }), { stack: false }) + prop('Ortsname', `<input data-k="s.place" value="${esc(s.place || '')}" maxlength="40" autocomplete="off">`, { note: 'Gilt sofort für alle Wetter-Anzeigen dieses Displays.' }));
    if (f.type === 'energy') h += fold('en', 'Entities', ENERGY.map(([k, n, dm = ['sensor']]) => prop(esc(n), entityBtn('e.' + k, f.ents?.[k] || '', { domains: dm, none: 'Standard', title: n }, 'Standard'), { stack: true })).join('') + '<small class="hint">Ohne Auswahl liest die Seite die Standard-Entities (evcc, Kostal, Solcast).</small>', !!open.has('en'));
    if (f.type === 'calendar' || f.type === 'info') { const cs = entsOf('calendar'); h += fold('cal', 'Kalender', list(cs.map(e => sroww(esc(e.name), '', sw(!f.cals || f.cals.includes(e.id), 'cal:' + e.id))).join('') || '<div class="hint pad">Keine Kalender in Home Assistant</div>'), undefined); }
    if (f.type === 'cams') h += fold('cams', 'Kameras', `<p class="hint">Kameras und Türklingel gelten für alle Displays und stehen unter Einstellungen.</p><button class="btn quiet" data-goto="#/settings">${ic('cam')}Kameras & Türklingel öffnen</button>`);
    h += fold('act', 'Seite', `<div class="btn-col"><button class="btn quiet" data-act="show" ${d?.connected ? '' : 'disabled'}>${ic('monitor-eye')}Auf dem Display zeigen</button><button class="btn quiet" data-act="hide" ${S.cfg.faces.length > 1 ? '' : 'disabled'}>${ic('eye-off')}Seite ausblenden</button><button class="btn danger" data-act="del" ${S.cfg.faces.length > 1 ? '' : 'disabled'}>${ic('trash')}Seite löschen</button></div>`);
    return h;
  }

  // ---- Kachel ----
  const SUB_VALS = (t, en) => [['', 'Keine'], ['state', 'Zustand'], ...(en?.attrs || []).map(a => [a, a])];
  function tileBody(f, t) {
    const en = entOf(t.e), clock = t.kind === 'clock', wx = t.kind === 'wx', ent = !clock && !wx, sv = svOf(t, S.states), sz = `${t.w || 1}x${t.h || 1}`, j = S.ui.sel.j;
    const faceList = S.cfg.faces.map(x => [x.id, faceName(x)]);
    const acts = [['default', 'Standard'], ...(TOGGLE_DOM.includes(en?.domain) ? [['toggle', 'Umschalten']] : []), ['service', 'Dienst aufrufen'], ['face', 'Seite öffnen'], ['none', 'Nichts']];
    const act = (k, label) => { const a = t[k] || {}; return prop(label, selBtn(k + '.do', acts, a.do || 'default'))
      + (a.do === 'service' ? prop('Dienst', `<input data-k="${k}.service" value="${esc(a.service || '')}" placeholder="light.turn_on" autocapitalize="off" autocorrect="off" spellcheck="false">`) + prop('Daten (JSON)', `<input data-k="${k}.data" value="${esc(a.data ? JSON.stringify(a.data) : '')}" placeholder='{"brightness_pct":50}' autocapitalize="off" autocorrect="off" spellcheck="false">`, { stack: false }) : '')
      + (a.do === 'face' ? prop('Seite', selBtn(k + '.face', faceList, a.face || faceList[0]?.[0])) : ''); };
    let h = '';
    h += fold('name', 'Name auf dem Display', `<input class="name-in" id="tile-name" data-k="t.title" value="${esc(t.title || '')}" maxlength="60" placeholder="${esc(ent ? (en ? autoTitle(en) : 'Name') : clock ? 'Uhr' : 'Wetter')}" autocomplete="off">`);
    if (ent) h += fold('ent', 'Entity', `<button class="ent-row" data-pick-ent><span class="av sm" style="--c:${DOM[en?.domain]?.[1] || '#8e8e93'}">${xi(tileIcon(t))}</span><span class="t"><b class="${t.e && !en ? 'bad' : ''}">${esc(en?.name || t.e || 'Wählen …')}</b><small>${esc(t.e && !en ? 'in Home Assistant nicht gefunden' : t.e || '')}</small></span>${ic('right')}</button>`);
    h += fold('size', 'Größe und Stil', `${prop('Größe', segB('t.size', SIZES, sz), { stack: false })}${sv ? prop('Stil', segB('t.sv', sv, t.sv || '')) : ''}${clock ? prop('Zifferblatt', segB('t.cs', [['', 'Striche'], ['numbers', 'Zahlen'], ['digital', 'Digital']], t.cs || '')) : ''}${ent ? prop('Look', segB('t.look', LOOKS.map(([a, n]) => [a, n]), t.look || ''), { note: 'Theme: wie im Display eingestellt. Liquid oder Flat gilt nur für diese Kachel.' }) : ''}`);
    if (ent) h += fold('style', 'Symbol und Farbe', `${prop('Symbol', `<button class="choice icon-choice" data-pick-icon aria-haspopup="dialog"><span class="gl">${xi(tileIcon(t))}</span><span>${esc(t.icon || 'Automatisch')}</span>${ic('right')}</button>`)}${prop('Farbe', swatches('t.color', COLORS, t.color || '', v => v || 'linear-gradient(135deg,#d8d8dc,#8e8e93)'), { stack: true, note: 'Die Farbe färbt das Symbol, wenn die Kachel an ist.' })}`);
    if (ent) {
      const vals = SUB_VALS(t, en), vv = t.val && !vals.some(x => x[0] === t.val) ? [...vals, [t.val, t.val]] : vals, more = open.has('more');
      h += fold('more', 'Weitere Einstellungen', `${prop('Untertitel', `<input data-k="t.sub" value="${esc(t.sub || '')}" maxlength="60" autocomplete="off">`)}${t.kind === 'thermo' ? '' : prop('Zusätzlich anzeigen', selBtn('t.val', vv, t.val || ''), { note: 'Zustand oder Attribut steht live hinter dem Untertitel.' })}${t.kind === 'thermo' ? '' : `<div class="insp-sub">Aktionen</div>${act('tap', 'Tippen')}${act('hold', 'Halten')}<small class="hint">Standard: Licht schaltet, Halten öffnet den Dimmer; Schloss, Tor, Szene … wie bisher.</small>`}${t.sv === 'live' ? prop('Bewegungssensor', entityBtn('t.motion', t.motion || '', { domains: ['binary_sensor'], none: 'Automatisch', title: 'Bewegungssensor' }, 'Automatisch'), { note: 'Automatisch: ein Sensor der Kamera mit „motion“, „person“ oder „bewegung“ im Namen.' }) : ''}`, more);
    }
    h += fold('act', 'Kachel', `<button class="btn danger" data-act="rm">${ic('trash')}Kachel entfernen</button>`);
    return h;
  }
  const selBtn = (k, l, v) => selectBtn(k, l, v);
  const LISTS = {};   // Listen der offenen Auswahlfelder je Schlüssel

  function draw(keepScroll) {
    const sel = S.ui.sel;
    el.classList.toggle('open', !!sel);
    if (!sel || !S.cfg) { el.innerHTML = ''; lastSel = ''; return; }
    const f = faceBy(sel.f), i = faceIx(sel.f);
    if (!f) return select(null);
    const key = selKey(); if (key !== lastSel) { open.clear(); lastSel = key; }
    const sc = keepScroll ? $('.dr-body', el)?.scrollTop : 0;
    Object.keys(LISTS).forEach(k => delete LISTS[k]);
    let headHTML, body;
    if (sel.k === 'tile') {
      const t = f.tiles?.[sel.j]; if (!t) return select({ k: 'page', f: f.id });
      const en = entOf(t.e), clock = t.kind === 'clock', wx = t.kind === 'wx';
      headHTML = head({ kind: 'tile', title: tileTitle(t), av: xi(tileIcon(t)), crumbs: [[faceName(f), 'page'], ...(t.e ? [[t.e, '', true]] : [])], more: true });
      body = tileBody(f, t);
      el.style.setProperty('--kc', clock || wx ? '#8e8e93' : DOM[en?.domain]?.[1] || '#8e8e93');
    } else {
      const meta = FACE[f.type] || [f.type, '#8e8e93', 'grid'];
      headHTML = head({ kind: 'page', title: faceName(f), av: ic(meta[2]), crumbs: [[`Seite ${i + 1}`, ''], [meta[0], '']], more: true });
      body = pageBody(f, i);
    }
    el.innerHTML = `${headHTML}<div class="dr-body">${body}</div>`;
    if (sc) $('.dr-body', el).scrollTop = sc;
    if (sel.k === 'tile' && sel.focus) { delete sel.focus; $('#tile-name', el)?.focus(); $('#tile-name', el)?.select(); }
  }

  // ---- Änderungen ----
  const onChange = async (k, v, b, en, phase) => {
    const sel = S.ui.sel, f = cfgFace(); if (!sel || !f) return;
    const [ns, ...rest] = k.split('.'), p = rest.join('.');
    if (k.startsWith('cal:')) {   // Kalender-Auswahl: alle = nicht gesetzt
      const id = k.slice(4), all = entsOf('calendar').map(e => e.id);
      let c = f.cals || all; c = v ? [...new Set([...c, id])] : c.filter(x => x !== id);
      if (!c.length) { b.setAttribute('aria-checked', 'true'); return toast('Mindestens ein Kalender', { bad: true }); }
      return mt('Kalender geändert', g => { if (c.length === all.length) delete g.cals; else g.cals = c; });
    }
    if (ns === 's') { const patch = { [p]: typeof v === 'string' ? v.trim() : v }; if (phase === 'input') return; return setSetting(S.sel, patch); }
    if (ns === 'f') {
      if (p === 'bg') return mt('Hintergrund geändert', g => { g.bg = bgVal(v); });
      if (p === 'design') return mt('Stil geändert', g => { Object.assign(g, withDesign(S.cfg, g, v)); });
      return;
    }
    if (ns === 'e') return mt('Entity geändert', g => { setPath(g, 'ents.' + p, v || undefined); if (g.ents && !Object.keys(g.ents).length) delete g.ents; });
    if (ns === 't' || ns === 'tap' || ns === 'hold') {
      const t = curTile(); if (!t) return;
      if (ns === 't' && p === 'size') { const [w, h] = v.split('x').map(Number); if (!resizeTile(sel.f, sel.j, w, h)) draw(true); return; }
      if (ns === 't' && p === 'title') return mt('Name geändert', (g, x) => { x.title = v; }, `tile:${sel.f}:${sel.j}:title`);
      if (ns === 't' && p === 'sub') return mt('Untertitel geändert', (g, x) => { if (v) x.sub = v; else delete x.sub; }, `tile:${sel.f}:${sel.j}:sub`);
      if (ns === 't' && p === 'motion') return mt('Bewegungssensor geändert', (g, x) => { v ? x.motion = v : delete x.motion; });
      if (ns === 't') {
        mt('Kachel geändert', (g, x) => { v ? x[p] = v : delete x[p]; });
        return p === 'val' ? draw(true) : undefined;
      }
      // Aktion: tap.do / tap.service / tap.data / tap.face
      if (p === 'do') { mt('Aktion geändert', (g, x) => { if (v === 'default') delete x[ns]; else x[ns] = { do: v, ...(v === 'face' && { face: S.cfg.faces[0].id }) }; }); return draw(true); }
      if (p === 'data') {
        let o; try { o = v ? JSON.parse(v) : undefined; if (o && (typeof o !== 'object' || Array.isArray(o))) throw 0; } catch { return toast('Daten müssen ein JSON-Objekt sein', { bad: true }); }
        return mt('Aktion geändert', (g, x) => setPath(x, `${ns}.data`, o));
      }
      return mt('Aktion geändert', (g, x) => setPath(x, `${ns}.${p}`, v.trim() || undefined), phase === 'input' ? `tile:${sel.f}:${sel.j}:${k}` : undefined);
    }
  };
  bind(el, {
    on: async (k, v, b, en, phase) => {
      if (k === 't.sv' || k === 't.look' || k === 't.cs' || k === 't.color') { return onChange(k, v, b, en, phase); }
      return onChange(k, v, b, en, phase);
    },
    listOf: (k, b) => {
      const t = curTile(), f = cfgFace(); if (!f) return [];
      if (k === 'f.design') return designs(f);
      if (k === 't.val') { const en = entOf(t?.e); const vals = SUB_VALS(t, en); return t?.val && !vals.some(x => x[0] === t.val) ? [...vals, [t.val, t.val]] : vals; }
      const [o, p] = k.split('.');
      if (p === 'do') { const en = entOf(t?.e); return [['default', 'Standard'], ...(TOGGLE_DOM.includes(en?.domain) ? [['toggle', 'Umschalten']] : []), ['service', 'Dienst aufrufen'], ['face', 'Seite öffnen'], ['none', 'Nichts']]; }
      if (p === 'face') return S.cfg.faces.map(x => [x.id, faceName(x)]);
      return [];
    },
    valueOf: k => {
      const t = curTile(), f = cfgFace();
      if (k === 'f.design') return designCur(f);
      if (k === 't.val') return t?.val || '';
      if (k === 's.weather') return dev()?.settings.weather;
      if (k === 't.motion') return t?.motion || '';
      if (k.startsWith('e.')) return f?.ents?.[k.slice(2)] || '';
      const [o, p] = k.split('.'); if (p === 'do') return t?.[o]?.do || 'default'; if (p === 'face') return t?.[o]?.face;
      return '';
    },
  });
  // Segmente, die nicht über bind laufen (Größe/Stil nutzen data-k + data-v → bind kümmert sich), Rest per Klick:
  el.addEventListener('click', async e => {
    const q = s => e.target.closest(s);
    if (q('#dr-x')) return select(null);
    if (q('[data-back]')) return select({ k: 'page', f: S.ui.sel.f });
    const c = q('[data-crumb]'); if (c) return select({ k: 'page', f: S.ui.sel.f });
    const fo = q('[data-fold]'); if (fo) { const id = fo.dataset.fold; open.has(id) ? open.delete(id) : open.add(id); return draw(true); }
    if (q('[data-lib]')) return lib?.focus();
    const tr = q('[data-tile]'); if (tr) return select({ k: 'tile', f: S.ui.sel.f, j: +tr.dataset.tile });
    const g = q('[data-goto]'); if (g) { location.hash = g.dataset.goto; return; }
    if (q('[data-rename]')) return $('#tile-name', el)?.focus(), $('#tile-name', el)?.select();
    const pe = q('[data-pick-ent]');
    if (pe) {
      const t = curTile(), en = await pickEntity({ title: 'Entity der Kachel', domains: t.kind === 'thermo' ? ['climate'] : TILE_DOM, current: t.e }); if (!en) return;
      const old = entOf(t.e);   // Titel/Untertitel mitführen, solange sie noch die Vorgabe der alten Entity sind
      return mt('Entity geändert', (g, x) => {
        if (!x.title || x.title === 'Neu' || (old && x.title === autoTitle(old))) x.title = autoTitle(en);
        if (!x.sub || x.sub === old?.area) x.sub = en.area;
        x.e = en.id;
        if (x.val && x.val !== 'state' && !en.attrs.includes(x.val)) delete x.val;
        for (const a of ['tap', 'hold']) if (x[a]?.do === 'toggle' && !TOGGLE_DOM.includes(en.domain)) delete x[a];
        if (en.domain === 'sensor' || en.domain === 'binary_sensor') x.val ||= 'state';
      });
    }
    const pi = q('[data-pick-icon]');
    if (pi) {
      const t = curTile(), p = popover(pi, `<div class="icon-grid">${ICONS.map(n => `<button data-ic="${n}" class="${t.icon === n ? 'on' : ''}" aria-label="${n}" title="${n}">${xi(n)}</button>`).join('')}</div><button class="mi" data-ic="-">${ic('blank')}<span class="t">Automatisches Symbol</span></button>`, { cls: 'icons', width: 292 });
      p.addEventListener('click', ev => { const b = ev.target.closest('[data-ic]'); if (!b) return; closePop(); mt('Symbol geändert', (g, x) => { b.dataset.ic === '-' ? delete x.icon : x.icon = b.dataset.ic; }); });
      return;
    }
    const a = q('[data-act]');
    if (a) {
      const f = cfgFace(), id = f.id;
      if (a.dataset.act === 'rm') return removeTiles(id, [S.ui.sel.j]);
      if (a.dataset.act === 'hide') return hidePage(id);
      if (a.dataset.act === 'del') return removePage(id);
      if (a.dataset.act === 'show') return call('command', { display: S.sel, action: 'face', face: f.type }).then(() => toast('Gesendet')).catch(er => toast(er?.message || 'Fehler', { bad: true }));
    }
    if (q('#dr-more')) {
      const f = cfgFace(), i = faceIx(f.id);
      if (S.ui.sel.k === 'page') return pageMenu(q('#dr-more'), i);
      const t = curTile(), others = S.cfg.faces.filter(x => x.type === 'grid' && x.id !== f.id);
      return menu(q('#dr-more'), [
        { label: 'Umbenennen', icon: 'pencil', run: () => { $('#tile-name', el)?.focus(); $('#tile-name', el)?.select(); } },
        ...(t.kind ? [] : [{ label: 'Andere Entity zeigen', icon: 'swap', run: () => $('[data-pick-ent]', el)?.click() }]),
        '-', { group: 'Auf Seite verschieben' }, ...(others.length ? others.map(x => ({ label: faceName(x), icon: 'layout', run: () => moveTile(f.id, S.ui.sel.j, x.id) })) : [{ label: 'Keine andere Smart-Home-Seite', icon: 'blank', disabled: true }]),
        '-', { label: 'Kopieren', icon: 'copy', end: '⌘C', run: () => copyTiles(f.id, [S.ui.sel.j]) }, { label: 'Ausschneiden', icon: 'cut', end: '⌘X', run: () => copyTiles(f.id, [S.ui.sel.j], true) },
        '-', { label: 'Kachel entfernen', icon: 'trash', danger: true, end: '⌫', run: () => removeTiles(f.id, [S.ui.sel.j]) },
      ], { width: 250 });
    }
  });
  const soft = () => { const t = curTile(); if (t) $('.dr-head .tx b', el) && ($('.dr-head .tx b', el).firstChild.textContent = tileTitle(t)); };
  const offs = [on('sel', () => draw()), on('doc', why => { const a = document.activeElement; if (el.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return soft(); draw(true); })];
  draw();
  return { unmount() { offs.forEach(f => f()); } };
}
