// Inspector: schwebende Karte mit den Einstellungen der Auswahl (Seite, Kachel oder mehrere Kacheln), gruppiert wie die iOS-Einstellungen, tiefere Ebenen schieben sich herein.
// Jede Änderung geht sofort in den Entwurf (ein Rückgängig-Schritt, die Vorschau zeigt sie gleich).
import { $, esc, ic, menu, rapidTap, toast } from './ui.js';
import { DOM, entOf, entsOf, pickEntity } from './entities.js';
import { S, byId, call, mutate, on, select, setSetting } from './state.js';
import { BG, COLORS, ENERGY, FACE, energyGuess, ICONS, LOOKS, SIZES, TILE_DOM, TOGGLE_DOM, autoTitle, bgCss, bgVal, designCur, designs, faceName, svOf, tileIcon, tileTitle, withDesign, xi } from './meta.js';
import { canHold, copyTiles, faceBy, faceIx, hidePage, lost, moveTile, removePage, removeTiles, resizeTile, resizeTiles, tilesOf } from './edit.js';
import { bind, entityBtn, selectBtn, sroww, sw, textRow } from './controls.js';
import { pageMenu } from './layout.js';
import { openGallery } from './gallery.js';
import { ago, setPath } from './util.js';
import { EN_NAMES, enSizes, hasTiles } from '../faces.js';

const grp = (title, body, foot = '') => `<div class="sect">${title ? `<div class="group-h">${title}</div>` : ''}<div class="group">${body}</div>${foot ? `<div class="group-f">${foot}</div>` : ''}</div>`;
const stack = (label, control) => `<div class="stack"><span class="s-label">${label}</span>${control}</div>`;
const navRow = (label, value, push, icon = '') => `<button class="row tap" data-push="${push}">${icon}<span class="t"><b>${label}</b></span><span class="s-val">${value}</span>${ic('right')}</button>`;
const segB = (k, list, v) => `<span class="seg fill">${list.map(([a, n]) => `<button type="button" data-k="${k}" data-v="${esc(a)}" aria-pressed="${String(a) === String(v)}">${esc(n)}</button>`).join('')}</span>`;
const dots = (k, list, cur, css) => `<div class="swatches">${list.map(([v, n]) => `<button type="button" class="sw-dot ${v === '' ? 'auto' : ''}" data-k="${k}" data-v="${esc(v)}" aria-pressed="${String(v) === String(cur)}" aria-label="${esc(n)}" title="${esc(n)}"><i style="background:${css(v)}"></i></button>`).join('')}</div>`;
const glyph = v => { const [w, h] = v.split('x').map(Number); return `<span class="gl">${[0, 1, 2, 3].map(i => `<i class="${i % 2 < w && Math.floor(i / 2) < h ? 'on' : ''}"></i>`).join('')}</span>`; };
const sizePick = (k, cur, only) => `<div class="size-pick">${SIZES.filter(([v]) => !only || only.includes(v)).map(([v, n]) => `<button type="button" data-k="${k}" data-v="${v}" aria-pressed="${v === cur}">${glyph(v)}${n}</button>`).join('')}</div>`;
const SUB_VALS = en => [['', 'Keine'], ['state', 'Zustand'], ...(en?.attrs || []).map(a => [a, a])];
const ACTS = en => [['default', 'Standard'], ...(TOGGLE_DOM.includes(en?.domain) ? [['toggle', 'Umschalten']] : []), ['service', 'Dienst aufrufen'], ['face', 'Ansicht öffnen'], ['none', 'Nichts']];
const SKIP_ATTR = new Set(['icon', 'entity_picture', 'supported_features', 'entity_id']);

export function mount(ed) {
  const el = Object.assign(document.createElement('aside'), { className: 'inspector', ariaLabel: 'Einstellungen der Auswahl' });
  el.inert = true; ed.append(el);
  let path = [], lastSel = '';
  const dev = () => byId(S.sel);
  const cfgFace = () => S.ui.sel && faceBy(S.ui.sel.f);
  const curTile = () => { const f = cfgFace(); return S.ui.sel?.k === 'tile' ? f?.tiles?.[S.ui.sel.j] : null; };
  const mt = (label, fn, merge) => mutate(label, c => { const f = c.faces.find(x => x.id === S.ui.sel?.f); if (f) fn(f, f.tiles?.[S.ui.sel.j]); }, merge);
  const colorOf = t => t.kind ? '#8e8e93' : DOM[entOf(t.e)?.domain]?.[1] || '#8e8e93';

  // ---- Kachel ----
  function tileRoot(f, t) {
    const en = entOf(t.e), clock = t.kind === 'clock', wx = t.kind === 'wx', enk = t.kind === 'en', mk = t.kind === 'multi', ent = !clock && !wx && !enk && !mk, sv = svOf(t, S.states), sz = `${t.w || 1}x${t.h || 1}`, vals = SUB_VALS(en);
    const vv = t.val && !vals.some(x => x[0] === t.val) ? [...vals, [t.val, t.val]] : vals;
    const act = k => { const a = t[k]; return a?.do ? ACTS(en).find(x => x[0] === a.do)?.[1] || a.do : 'Standard'; };
    let h = `<div class="insp-id"><button class="av" style="--c:${colorOf(t)}" data-push="icon" aria-label="Symbol ändern">${xi(tileIcon(t))}</button></div>`;
    h += grp('Name auf dem Display', `<div class="srow"><input class="name-in" id="tile-name" data-k="t.title" value="${esc(t.title || '')}" maxlength="60" placeholder="${esc(ent ? (en ? autoTitle(en) : 'Name') : clock ? 'Uhr' : wx ? 'Wetter' : mk ? 'Gruppe' : EN_NAMES[t.k])}" autocomplete="off"></div>`);
    if (ent) h += grp('Entität', `<button class="ent-row" data-pick-ent><span class="av" style="--c:${colorOf(t)}">${xi(tileIcon(t))}</span><span class="t"><b class="${t.e && !en ? 'bad' : ''}">${esc(en?.name || t.e || 'Wählen …')}</b><small>${esc(t.e && !en ? 'in Home Assistant nicht gefunden' : t.e || '')}</small></span>${ic('right')}</button>`);
    if (mk) { const ns = (t.ents || []).map(id => entOf(id)?.name || id); h += grp('Enthält', `<div class="row"><span class="t"><b>${ns.length} ${t.dom === 'cover' ? 'Rollläden' : 'Lichter und Schalter'}</b><small>${esc(ns.slice(0, 4).join(', ') + (ns.length > 4 ? ' …' : ''))}</small></span></div>`, 'Tippen schaltet alle, Halten zeigt die Einzelnen. Die Mitglieder werden beim Anlegen aus dem Raum übernommen; zum Ändern die Kachel neu anlegen.'); }
    h += grp('Größe', sizePick('t.size', sz, enk && enSizes(t.k)), enk ? 'Die Werte kommen aus den Entitäten der Ansicht („Entitäten“ in den Ansichtseinstellungen).' : '');
    const styles = (sv ? stack('Stil', segB('t.sv', sv, t.sv || '')) : '') + (clock ? stack('Zifferblatt', segB('t.cs', [['', 'Striche'], ['numbers', 'Zahlen'], ['digital', 'Digital']], t.cs || '')) : '') + (ent ? stack('Look', segB('t.look', LOOKS.map(([a, n]) => [a, n]), t.look || '')) : '');
    if (styles) h += grp('Stil', styles, ent ? 'Theme: wie im Display eingestellt. Liquid oder Flat gilt nur für diese Kachel.' : '');
    if (ent) {
      h += grp('Symbol und Farbe', navRow('Symbol', esc(t.icon || 'Automatisch'), 'icon', `<span class="av" style="--c:${colorOf(t)}">${xi(tileIcon(t))}</span>`) + stack('Farbe', dots('t.color', COLORS, t.color || '', v => v || 'linear-gradient(135deg,#d8d8dc,#8e8e93)')), 'Die Farbe färbt das Symbol, wenn die Kachel an ist.');
      h += grp('Anzeige', sroww('Untertitel', '', `<input data-k="t.sub" value="${esc(t.sub || '')}" maxlength="60" autocomplete="off">`)
        + (t.kind === 'thermo' ? '' : sroww('Zusätzlich anzeigen', '', selectBtn('t.val', vv, t.val || '')))
        + (t.sv === 'live' ? sroww('Bewegungssensor', '', entityBtn('t.motion', t.motion || '', { domains: ['binary_sensor'], none: 'Automatisch', title: 'Bewegungssensor' }, 'Automatisch')) : ''),
        t.kind === 'thermo' ? '' : 'Zustand oder Attribut steht live hinter dem Untertitel.');
      if (t.kind !== 'thermo') h += grp('Aktionen', navRow('Tippen', esc(act('tap')), 'tap') + navRow('Halten', esc(act('hold')), 'hold'), 'Standard: Licht schaltet, Halten öffnet den Dimmer; Schloss, Tor, Szene … wie bisher.');
      if (t.e) h += grp('', navRow('Aktuelle Daten', esc(en ? [en.state, en.unit].filter(Boolean).join(' ') : ''), 'data'));
    }
    if (!(f.bg && typeof f.bg === 'object')) h += grp('Hintergrund der Ansicht', `<div class="stack">${dots('f.bg', BG, f.bg, bgCss)}</div>`, 'Gilt für die ganze Ansicht, nicht nur für diese Kachel.');
    h += grp('', `<button class="row danger" data-act="rm">Kachel entfernen</button>`);
    return { title: tileTitle(t), sub: faceName(f), more: true, del: ['rm', 'Kachel entfernen'], body: h };
  }
  function tileSub(f, t, view) {
    const en = entOf(t.e), back = 'Kachel';
    if (view === 'icon') return { title: 'Symbol', back, body: grp('', `<div class="icon-grid">${ICONS.map(n => `<button data-ic="${n}" class="${t.icon === n ? 'on' : ''}" aria-label="${n}" title="${n}">${xi(n)}</button>`).join('')}</div>`) + grp('', `<button class="row tap" data-ic="-"><span class="t"><b>Automatisches Symbol</b></span>${!t.icon ? ic('check', 'ok') : ''}</button>`) };
    if (view === 'tap' || view === 'hold') {
      const a = t[view] || {}, faceList = S.cfg.faces.map(x => [x.id, faceName(x)]);
      return { title: view === 'tap' ? 'Tippen' : 'Halten', back, body: grp('', sroww('Aktion', '', selectBtn(view + '.do', ACTS(en), a.do || 'default'))
        + (a.do === 'service' ? sroww('Dienst', '', `<input data-k="${view}.service" value="${esc(a.service || '')}" placeholder="light.turn_on" autocapitalize="off" autocorrect="off" spellcheck="false">`) + sroww('Daten (JSON)', '', `<input data-k="${view}.data" value="${esc(a.data ? JSON.stringify(a.data) : '')}" placeholder='{"brightness_pct":50}' autocapitalize="off" autocorrect="off" spellcheck="false">`) : '')
        + (a.do === 'face' ? sroww('Ansicht', '', selectBtn(view + '.face', faceList, a.face || faceList[0]?.[0])) : ''),
        view === 'tap' ? 'Standard: Licht schaltet um, Schloss und Tor wie bisher.' : 'Standard: Licht öffnet den Dimmer, Thermostat die Klimasteuerung.') };
    }
    if (view === 'data') {
      const st = S.states[t.e];
      if (!st) return { title: 'Aktuelle Daten', back, body: '<div class="notice flat">Keine Daten: die Entität gibt es in Home Assistant nicht (mehr).</div>' };
      const val = v => typeof v === 'object' ? JSON.stringify(v) : String(v), r = (k, v) => `<div class="srow data-row"><span><span class="s-label">${esc(k)}</span></span><span class="s-val">${esc(val(v))}</span></div>`;
      return { title: 'Aktuelle Daten', sub: t.e, back, body: grp('Zustand', r('Zustand', st.state) + r('Geändert', ago(st.last_changed)) + r('Aktualisiert', ago(st.last_updated)), 'Live aus Home Assistant, wird alle 15 Sekunden erneuert.')
        + grp('Attribute', Object.entries(st.attributes).filter(([k]) => !SKIP_ATTR.has(k)).map(([k, v]) => r(k, v)).join('') || '<div class="srow"><span class="s-label muted">Keine Attribute</span></div>') };
    }
  }

  // ---- Mehrere Kacheln ----
  function multi(f) {
    const js = S.ui.sel.js, ts = js.map(j => f.tiles[j]), lim = ts.filter(t => t.kind === 'en').map(t => enSizes(t.k)), only = lim.length ? SIZES.map(s => s[0]).filter(v => lim.every(l => l.includes(v))) : null, s0 = `${ts[0].w || 1}x${ts[0].h || 1}`, sz = ts.every(t => `${t.w || 1}x${t.h || 1}` === s0) ? s0 : '';
    const others = S.cfg.faces.filter(x => x.id !== f.id && ts.every(t => canHold(x, t))), row = (act, label, icon) => `<button class="row tap" data-act="${act}">${ic(icon)}<span class="t"><b>${label}</b></span></button>`;
    return { title: `${js.length} Kacheln`, sub: faceName(f), del: ['mrm', `${js.length} Kacheln entfernen`], body: grp('Größe', sizePick('m.size', sz, only), 'Alle gewählten Kacheln bekommen dieselbe Größe.')
      + grp('', (others.length ? row('mmove', 'Auf andere Ansicht verschieben …', 'layout') : '') + row('mcopy', 'Kopieren', 'copy') + row('mcut', 'Ausschneiden', 'cut'))
      + grp('', `<button class="row danger" data-act="mrm">${js.length} Kacheln entfernen</button>`, '⇧ oder ⌘ plus Klick wählt weitere Kacheln, ⌘A alle der Ansicht.') };
  }

  // ---- Seite ----
  function pageRoot(f, i) {
    const d = dev(), s = d?.settings || {}, meta = FACE[f.type] || [f.type, '#8e8e93', 'grid'], photo = f.bg && typeof f.bg === 'object', sty = designs(f), n = lost(f);
    const bgList = BG.filter(([v]) => !['calendar', 'date'].includes(f.type) || ['auto', 'black', 'white'].includes(v));
    const tile = (t, j) => { const en = entOf(t.e), sz = `${t.w || 1}×${t.h || 1}`; return `<button class="trow" data-tile="${j}"><span class="av" style="--c:${colorOf(t)}">${xi(tileIcon(t))}</span><span class="t"><b>${esc(tileTitle(t))}</b><small>${esc([t.sub, t.kind ? '' : en?.name || t.e, sz !== '1×1' && sz].filter(Boolean).join(' · '))}</small></span>${ic('right')}</button>`; };
    let h = `<div class="insp-id"><span class="av" style="--c:${meta[1]}">${ic(meta[2])}</span></div>`;
    if (!photo) h += grp('Hintergrund', `<div class="stack">${dots('f.bg', bgList, f.bg, bgCss)}</div>`, esc(bgList.find(([v]) => String(v) === String(f.bg))?.[1] || ''));
    if (sty?.length) h += grp('Stil', sty.length <= 3 && sty.every(x => x[1].length < 12) ? stack('Design', segB('f.design', sty, designCur(f))) : navRow('Design', esc(sty.find(x => x[0] === designCur(f))?.[1] || ''), 'design'));
    if (hasTiles(f)) h += grp(`Kacheln · ${tilesOf(f).length}`, (tilesOf(f).map(tile).join('') || '<div class="srow"><span class="s-label muted">Noch keine Kacheln</span></div>') + `<button class="row accent" data-lib>${ic('plus')}Kachel hinzufügen</button>`, n ? `<span class="warn">${n} Kachel${n > 1 ? 'n passen' : ' passt'} nicht mehr ins Raster und ${n > 1 ? 'werden' : 'wird'} nicht angezeigt.</span>` : '');
    if (f.type === 'weather') h += grp('Wetter', sroww('Wetter-Entität', '', entityBtn('s.weather', s.weather, { domains: ['weather'], title: 'Wetter-Entität' })) + sroww('Ortsname', '', `<input data-k="s.place" value="${esc(s.place || '')}" maxlength="40" autocomplete="off">`), 'Gilt sofort für alle Wetter-Anzeigen dieses Displays.');
    if (f.type === 'energy') h += grp('', navRow('Entitäten', `${Object.keys(f.ents || {}).filter(k => k !== 'carName').length || 'Standard'}`, 'energy', `<span class="av" style="--c:${meta[1]}">${ic('bolt')}</span>`), 'Ohne Auswahl liest die Ansicht die Standard-Entitäten (evcc, Kostal, Solcast).');
    if (f.type === 'calendar' || f.type === 'info') { const cs = entsOf('calendar'); h += grp('Kalender', cs.map(e => sroww(esc(e.name), '', sw(!f.cals || f.cals.includes(e.id), 'cal:' + e.id))).join('') || '<div class="srow"><span class="s-label muted">Keine Kalender in Home Assistant</span></div>'); }
    if (f.type === 'cams') h += grp('Kameras', `<button class="row tap" data-goto="#/settings"><span class="av" style="--c:#8e8e93">${ic('cam')}</span><span class="t"><b>Kameras und Türklingel</b><small>gelten für alle Displays</small></span>${ic('right')}</button>`);
    if (f.type === 'todo') h += grp('Liste', sroww('Liste', '', entityBtn('f.todo', f.todo || '', { domains: ['todo'], none: 'Erste Liste', title: 'Liste wählen' }, 'Erste Liste')), 'Ohne Auswahl zeigt die Ansicht die erste Liste, bei mehreren kann man am Display wechseln.');
    if (f.type === 'check') h += grp('Ausnahmen', textRow('Ignorieren', 'f.skip', f.skip || '', { ph: 'z. B. Garage, Gästezimmer', max: 200 }, 'Namen oder Entitäten, mit Komma getrennt, werden nicht geprüft'), 'Der Haus-Check liest Tür- und Fenstersensoren, Schlösser, Garagentore, Wassermelder und Batterien.');
    h += grp('', `<button class="row tap" data-act="show" ${d?.connected ? '' : 'disabled'}>${ic('monitor-eye')}<span class="t"><b>Auf dem Display zeigen</b></span></button><button class="row tap" data-act="hide">${ic('eye-off')}<span class="t"><b>Ansicht ausblenden</b></span></button>`);
    h += grp('', `<button class="row danger" data-act="del">Ansicht löschen</button>`);
    return { title: faceName(f), sub: `Ansicht ${i + 1} · ${meta[0]}`, more: true, del: ['del', 'Ansicht löschen'], body: h };
  }
  function pageSub(f, view) {
    if (view === 'design') return { title: 'Design', sub: faceName(f), back: faceName(f), body: (f.bg && typeof f.bg === 'object' ? '' : grp('Hintergrund', `<div class="stack">${dots('f.bg', BG, f.bg, bgCss)}</div>`)) + grp('Live-Vorschau', '<iframe class="dz" title="Designs" src="index.html?preview&designs"></iframe>', 'Tippe ein Design an. Die Farbe oben gilt sofort für alle Vorschauen.') };
    if (view === 'energy') return { title: 'Entitäten', sub: faceName(f), back: faceName(f), body: grp('', `<button class="row accent" data-energy-auto>${ic('refresh')}Fehlende automatisch erkennen</button>`, 'Sucht Solar, Netz, Haus, Akku, Auto und Prognose in Home Assistant: Energie-Dashboard, Einheiten und Namen. Was du schon gewählt hast, bleibt.') + grp('', textRow('Bezeichnung Auto', 'e.carName', f.ents?.carName || '', { ph: 'e-Golf', max: 20 }), 'Name der Auto-Kachel.') + grp('', ENERGY.map(([k, n, dm = ['sensor']]) => sroww(esc(n), '', entityBtn('e.' + k, f.ents?.[k] || '', { domains: dm, none: 'Standard', title: n }, 'Standard'))).join(''), 'Ohne Auswahl liest die Ansicht die Standard-Entitäten.') };
  }

  // ---- Zeichnen ----
  function draw(o = {}) {
    const sel = S.ui.sel;
    ed.classList.toggle('has-insp', !!sel); el.classList.toggle('open', !!sel); el.inert = !sel;
    if (!sel || !S.cfg) { lastSel = ''; path = []; return; }   // Inhalt bleibt stehen, bis die Karte weggeglitten ist
    const f = faceBy(sel.f), key = JSON.stringify(sel);
    if (!f) return select(null);
    if (key !== lastSel) { if (!o.keep) path = []; lastSel = key; }
    if (sel.k === 'page' && path.at(-1) === 'design' && $('.dz', el)) return designSync(f);   // Live-Vorschau bleibt stehen (kein Neuladen des Frames)
    let v;
    if (sel.k === 'tile') { const t = f.tiles?.[sel.j]; if (!t) return select({ k: 'page', f: f.id }); const top = path.at(-1); v = (top && tileSub(f, t, top)) || (path = [], tileRoot(f, t)); }
    else if (sel.k === 'tiles') v = multi(f);
    else { const top = path.at(-1); v = (top && pageSub(f, top)) || (path = [], pageRoot(f, faceIx(f.id))); }
    const sc = o.keep ? $('.insp-body', el)?.scrollTop : 0;
    el.innerHTML = `<div class="insp-bar"><span class="l">${v.back ? `<button class="bk" data-back aria-label="Zurück">${ic('left')}<span>${esc(v.back)}</span></button>` : ''}</span><div class="tx"><b>${esc(v.title)}</b>${v.sub ? `<small>${esc(v.sub)}</small>` : ''}</div><span class="r">${v.del ? `<button class="icon-btn" data-act="${v.del[0]}" aria-label="${esc(v.del[1])}" title="${esc(v.del[1])}">${ic('trash')}</button>` : ''}${v.more ? `<button class="icon-btn" id="in-more" aria-label="Mehr">${ic('dots')}</button>` : ''}<button class="done" id="in-x">Fertig</button></span></div><div class="insp-body"><div class="insp-view ${o.anim || ''}" ${o.anim ? '' : 'style="animation:none"'}>${v.body}</div></div>`;
    if (sc) $('.insp-body', el).scrollTop = sc;
    if (sel.k === 'tile' && sel.focus) { delete sel.focus; $('#tile-name', el)?.focus(); $('#tile-name', el)?.select(); }
  }
  // Design-Auswahl: der Frame (index.html?preview&designs) zeichnet alle Designs live in der gewählten Hintergrundfarbe
  const designSync = f => {
    const fr = $('.dz', el); if (!fr) return;
    for (const b of el.querySelectorAll('[data-k="f.bg"]')) b.setAttribute('aria-pressed', String(b.dataset.v === String(f.bg)));
    fr.contentWindow?.postMessage({ hb: 'preview', states: S.states, designs: { list: designs(f), bg: f.bg, cur: designCur(f) } }, location.origin);
  };
  addEventListener('message', e => {
    const fr = $('.dz', el), m = e.data; if (!fr || e.source !== fr.contentWindow || e.origin !== location.origin) return;
    if (m?.hb === 'preview-ready') designSync(cfgFace()); else if (m?.hb === 'design-h') fr.style.height = m.h + 'px'; else if (m?.hb === 'design') mt('Stil geändert', g => { Object.assign(g, withDesign(S.cfg, g, m.v)); });
  });
  const push = view => { path.push(view); draw({ anim: 'fwd', keep: true }); };
  const back = () => { if (!path.length) return false; path.pop(); draw({ anim: 'back', keep: true }); return true; };

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
    if (ns === 's') { if (phase === 'input') return; return setSetting(S.sel, { [p]: typeof v === 'string' ? v.trim() : v }); }
    if (ns === 'm') { const [w, h] = v.split('x').map(Number); return resizeTiles(sel.f, sel.js, w, h) || draw({ keep: true }); }
    if (ns === 'f') {
      if (p === 'bg') return mt('Hintergrund geändert', g => { g.bg = bgVal(v); });
      if (p === 'design') return mt('Stil geändert', g => { Object.assign(g, withDesign(S.cfg, g, v)); });
      if (p === 'todo') return mt('Liste geändert', g => { v ? g.todo = v : delete g.todo; });
      if (p === 'skip') { if (phase === 'input') return; return mt('Ausnahmen geändert', g => { const t = String(v).trim(); t ? g.skip = t : delete g.skip; }); }
      return;
    }
    if (ns === 'e' && p === 'carName' && phase === 'input') return;
    if (ns === 'e') return mt('Entität geändert', g => { setPath(g, 'ents.' + p, v || undefined); if (g.ents && !Object.keys(g.ents).length) delete g.ents; });
    if (ns === 't' || ns === 'tap' || ns === 'hold') {
      const t = curTile(); if (!t) return;
      if (ns === 't' && p === 'size') { const [w, h] = v.split('x').map(Number); if (!resizeTile(sel.f, sel.j, w, h)) draw({ keep: true }); return; }
      if (ns === 't' && p === 'title') return mt('Name geändert', (g, x) => { x.title = v; }, `tile:${sel.f}:${sel.j}:title`);
      if (ns === 't' && p === 'sub') return mt('Untertitel geändert', (g, x) => { if (v) x.sub = v; else delete x.sub; }, `tile:${sel.f}:${sel.j}:sub`);
      if (ns === 't' && p === 'motion') return mt('Bewegungssensor geändert', (g, x) => { v ? x.motion = v : delete x.motion; });
      if (ns === 't') { mt('Kachel geändert', (g, x) => { v ? x[p] = v : delete x[p]; }); return p === 'val' ? draw({ keep: true }) : undefined; }
      if (p === 'do') { mt('Aktion geändert', (g, x) => { if (v === 'default') delete x[ns]; else x[ns] = { do: v, ...(v === 'face' && { face: S.cfg.faces[0].id }) }; }); return draw({ keep: true }); }
      if (p === 'data') {
        let o; try { o = v ? JSON.parse(v) : undefined; if (o && (typeof o !== 'object' || Array.isArray(o))) throw 0; } catch { return toast('Daten müssen ein JSON-Objekt sein', { bad: true }); }
        return mt('Aktion geändert', (g, x) => setPath(x, `${ns}.data`, o));
      }
      return mt('Aktion geändert', (g, x) => setPath(x, `${ns}.${p}`, v.trim() || undefined), phase === 'input' ? `tile:${sel.f}:${sel.j}:${k}` : undefined);
    }
  };
  bind(el, {
    on: onChange,
    listOf: k => {
      const t = curTile(), f = cfgFace(); if (!f) return [];
      if (k === 'f.design') return designs(f);
      if (k === 't.val') { const vals = SUB_VALS(entOf(t?.e)); return t?.val && !vals.some(x => x[0] === t.val) ? [...vals, [t.val, t.val]] : vals; }
      const p = k.split('.')[1];
      if (p === 'do') return ACTS(entOf(t?.e));
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
  el.addEventListener('click', async e => {
    const q = s => e.target.closest(s);
    if (q('#in-x')) return select(null);
    if (q('[data-back]')) return back();
    const ps = q('[data-push]'); if (ps) return push(ps.dataset.push);
    if (q('[data-lib]')) return openGallery();
    if (q('[data-energy-auto]')) {
      const g = energyGuess(), f = cfgFace(), fresh = Object.keys(g).filter(k => !f.ents?.[k]);
      if (!fresh.length) return toast(Object.keys(g).length ? 'Alles Erkennbare ist schon gewählt' : 'Nichts erkannt. Wähle die Entitäten selbst.', { bad: !Object.keys(g).length });
      mt('Energie erkannt', x => { x.ents = { ...g, ...(x.ents || {}) }; }); return toast(`${fresh.length} Wert${fresh.length > 1 ? 'e' : ''} erkannt`);
    }
    const tr = q('[data-tile]'); if (tr) return select({ k: 'tile', f: S.ui.sel.f, j: +tr.dataset.tile });
    const pe = q('[data-pick-ent]');
    if (pe) {
      const t = curTile(), en = await pickEntity({ title: 'Entität der Kachel', domains: t.kind === 'thermo' ? ['climate'] : TILE_DOM, current: t.e }); if (!en) return;
      const old = entOf(t.e);   // Titel/Untertitel mitführen, solange sie noch die Vorgabe der alten Entität sind
      return mt('Entität geändert', (g, x) => {
        if (!x.title || x.title === 'Neu' || (old && x.title === autoTitle(old))) x.title = autoTitle(en);
        if (!x.sub || x.sub === old?.area) x.sub = en.area;
        x.e = en.id;
        if (x.val && x.val !== 'state' && !en.attrs.includes(x.val)) delete x.val;
        for (const a of ['tap', 'hold']) if (x[a]?.do === 'toggle' && !TOGGLE_DOM.includes(en.domain)) delete x[a];
        if (en.domain === 'sensor' || en.domain === 'binary_sensor') x.val ||= 'state';
      });
    }
    const pi = q('[data-ic]');
    if (pi) { mt('Symbol geändert', (g, x) => { pi.dataset.ic === '-' ? delete x.icon : x.icon = pi.dataset.ic; }); return back(); }
    const a = q('[data-act]');
    if (a && !a.disabled) {
      const f = cfgFace(), id = f.id, sel = S.ui.sel, act = a.dataset.act;
      if (act === 'rm') return rapidTap(e) || removeTiles(id, [sel.j]);
      if (act === 'hide') return hidePage(id);
      if (act === 'del') return rapidTap(e) || removePage(id);
      if (act === 'show') return call('command', { display: S.sel, action: 'face', face: f.type }).then(() => toast('Gesendet')).catch(er => toast(er?.message || 'Fehler', { bad: true }));
      if (act === 'mrm') return rapidTap(e) || removeTiles(id, sel.js);
      if (act === 'mcopy') return copyTiles(id, sel.js);
      if (act === 'mcut') return copyTiles(id, sel.js, true);
      if (act === 'mmove') {
        const others = S.cfg.faces.filter(x => x.id !== id && sel.js.every(j => canHold(x, faceBy(id).tiles[j])));
        return menu(a, others.map(x => ({ label: faceName(x), icon: 'layout', run: () => [...sel.js].sort((m, n) => n - m).forEach(j => moveTile(id, j, x.id)) })), { width: 250, align: 'start' });
      }
    }
    if (q('#in-more')) {
      const f = cfgFace(), i = faceIx(f.id), sel = S.ui.sel;
      if (sel.k !== 'tile') return pageMenu(q('#in-more'), i);
      const t = curTile(), others = S.cfg.faces.filter(x => x.id !== f.id && canHold(x, t));
      return menu(q('#in-more'), [
        { label: 'Umbenennen', icon: 'pencil', run: () => { $('#tile-name', el)?.focus(); $('#tile-name', el)?.select(); } },
        ...(t.kind ? [] : [{ label: 'Andere Entität zeigen', icon: 'swap', run: () => $('[data-pick-ent]', el)?.click() }]),
        '-', { group: 'Auf Ansicht verschieben' }, ...(others.length ? others.map(x => ({ label: faceName(x), icon: 'layout', run: () => moveTile(f.id, sel.j, x.id) })) : [{ label: 'Keine andere Smart-Home-Ansicht', icon: 'blank', disabled: true }]),
        '-', { label: 'Kopieren', icon: 'copy', end: '⌘C', run: () => copyTiles(f.id, [sel.j]) }, { label: 'Ausschneiden', icon: 'cut', end: '⌘X', run: () => copyTiles(f.id, [sel.j], true) },
        '-', { label: 'Kachel entfernen', icon: 'trash', danger: true, end: '⌫', run: () => removeTiles(f.id, [sel.j]) },
      ], { width: 250 });
    }
  });
  const soft = () => { const t = curTile(), b = $('.insp-bar .tx b', el); if (t && b) b.textContent = tileTitle(t); };
  const offs = [on('sel', () => draw()), on('doc', () => { const a = document.activeElement; if (el.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return soft(); draw({ keep: true }); }),
    on('states', () => { if (path.at(-1) === 'data') draw({ keep: true }); })];
  draw();
  return { back, unmount() { offs.forEach(f => f()); el.remove(); ed.classList.remove('has-insp'); } };
}
