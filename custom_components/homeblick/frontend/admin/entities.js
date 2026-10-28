// Entities, Bereiche und Auswahl-Dialog. Daten aus get_states + Registries; fehlen die Registries, bleiben Bereich und Gerät leer.
import { esc, fold, ic, modal } from './ui.js';
import { tx, LOC } from '../i18n.js';

// domain: [Name, Farbe, Symbol]
export const DOM = {
  light: [tx('Licht'), '#d9930f', 'bulb'], switch: [tx('Schalter'), '#6b7280', 'switch'], lock: [tx('Schloss'), '#1e9a5f', 'lock'],
  cover: [tx('Tor'), '#5e5ce6', 'cover'], climate: [tx('Thermostat'), '#e0602b', 'thermo'], scene: [tx('Szene'), '#d9822b', 'sun'],
  script: [tx('Skript'), '#6b7280', 'script'], media_player: [tx('Medien'), '#d6336c', 'play'], fan: [tx('Ventilator'), '#1096b0', 'fan'],
  timer: [tx('Timer'), '#d9930f', 'timer'], camera: [tx('Kamera'), '#5856d6', 'cam'], sensor: [tx('Sensor'), '#266df0', 'pulse'],
  binary_sensor: [tx('Binärsensor'), '#266df0', 'pulse'], weather: [tx('Wetter'), '#1d8fd0', 'cloud'], calendar: [tx('Kalender'), '#d93f3f', 'cal'],
  event: [tx('Ereignis'), '#9b51e0', 'bolt'], todo: [tx('Aufgaben'), '#ff9500', 'check'], input_boolean: [tx('Schalter'), '#6b7280', 'switch'], button: [tx('Taster'), '#6b7280', 'switch'], input_button: [tx('Taster'), '#6b7280', 'switch'],
};
const STATE = { on: tx('an‖Zustand'), off: tx('aus‖Zustand'), locked: tx('verriegelt'), unlocked: tx('entsperrt'), open: tx('offen‖Zustand'), closed: tx('zu‖Zustand'), opening: tx('öffnet'), closing: tx('schließt'),
  playing: tx('spielt'), paused: tx('pausiert'), idle: tx('bereit‖Zustand'), active: tx('läuft‖Zustand'), unavailable: tx('nicht verfügbar'), unknown: tx('unbekannt'), home: tx('zuhause'), not_home: tx('abwesend'),
  heat: tx('Heizen'), cool: tx('Kühlen'), heat_cool: tx('Auto‖Modus'), auto: tx('Auto‖Modus'), dry: tx('Trocknen'), fan_only: tx('Lüften'), standby: tx('Standby'), detected: tx('erkannt'), clear: tx('frei‖Zustand') };
const NOSTATE = ['scene', 'button', 'event', 'script'];   // Zustand ist ein Zeitstempel oder nichtssagend
const SKIP = new Set(['friendly_name', 'icon', 'entity_picture', 'supported_features', 'device_class', 'unit_of_measurement', 'state_class', 'attribution', 'editable', 'id', 'restored', 'entity_id']);
let EN = [], BY = new Map(), PREFS = null;   // PREFS: Energie-Dashboard von HA (fehlt, wenn nicht eingerichtet)
export const entOf = id => BY.get(id);
export const areasOf = () => [...new Set(EN.map(e => e.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, LOC));
export const entsIn = area => EN.filter(e => e.area === area && !e.hide);
export const entsFor = domains => EN.filter(e => domains.includes(e.domain) && !e.hide).sort((a, b) => a.name.localeCompare(b.name, LOC));
export const entsOf = domain => EN.filter(e => e.domain === domain).sort((a, b) => a.name.localeCompare(b.name, LOC));
export const allEnts = () => EN;
export const energyPrefs = () => PREFS;
export function findEnts(q, domains) {   // Suche über Name, Bereich, Gerät, ID, nur passende Domains
  const w = fold(q).split(/\s+/).filter(Boolean);
  return EN.filter(e => domains.includes(e.domain) && !e.hide).map(e => [rank(e, w), e]).filter(x => x[0] >= 0).sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name, 'de')).map(x => x[1]);
}
export async function loadEntities(conn, states) {
  const q = type => conn.sendMessagePromise({ type }).catch(() => []);
  const [er, dr, ar] = await Promise.all([q('config/entity_registry/list'), q('config/device_registry/list'), q('config/area_registry/list'), conn.sendMessagePromise({ type: 'energy/get_prefs' }).then(p => { PREFS = p; }, () => {})]);
  const area = Object.fromEntries(ar.map(a => [a.area_id, a.name])), dev = Object.fromEntries(dr.map(d => [d.id, d])), reg = Object.fromEntries(er.map(e => [e.entity_id, e]));
  EN = states.map(s => {
    const id = s.entity_id, r = reg[id] || {}, d = dev[r.device_id], a = s.attributes;
    return { id, domain: id.split('.')[0], name: a.friendly_name || id, area: area[r.area_id || d?.area_id] || '', device: d ? d.name_by_user || d.name || '' : '',
      state: s.state, unit: a.unit_of_measurement, dc: a.device_class, attrs: Object.keys(a).filter(k => !SKIP.has(k) && ['number', 'string'].includes(typeof a[k])),
      hide: !!(r.disabled_by || r.hidden_by || r.entity_category || r.platform === 'homeblick') };   // eigene Entities der Displays (Bildschirmschoner, Helligkeit …) sind keine Kacheln
  });
  BY = new Map(EN.map(e => [e.id, e]));
}
export const stateText = e => {
  if (NOSTATE.includes(e.domain)) return '';
  const s = STATE[e.state] ?? (/^-?\d+(\.\d+)?$/.test(e.state) ? (+e.state).toLocaleString(LOC) + (e.unit ? ' ' + e.unit : '') : e.state);
  return s.length > 22 ? s.slice(0, 21) + '…' : s;
};
// alle Suchwörter müssen vorkommen; Treffer im Namen zählen mehr als in Bereich/Gerät/ID
function rank(e, words) {
  const n = e._n ||= fold(e.name), h = e._h ||= fold(`${e.name} ${DOM[e.domain]?.[0] || ''} ${e.area} ${e.device} ${e.id}`);
  let s = 0;
  for (const w of words) { if (!h.includes(w)) return -1; s += n.startsWith(w) ? 3 : n.includes(' ' + w) ? 2 : n.includes(w) ? 1 : 0; }
  return s;
}
export const avatar = (domain, cls = '') => { const [, c, i] = DOM[domain] || ['', '#6b7280', 'dot']; return `<span class="av ${cls}" style="--c:${c}">${ic(i)}</span>`; };

// → gewählte Entität ({ id, name, area, domain, … }) oder null; dcs: nur diese device_class; none: Text der Zeile „keine Auswahl“ (liefert { id: '' })
export function pickEntity({ title = tx('Entität wählen'), domains, dcs, none, current = '' } = {}) {
  let dom = '', all = !domains, hi = 0, items = [], key;
  const p = modal(`<div class="sheet-bar"><span class="l"><button class="done" data-r="">${tx('Abbrechen')}</button></span><h2>${esc(title)}</h2></div>
    <div class="pk-search"><label class="search-field">${ic('search')}<input type="search" placeholder="${tx('Name, Bereich oder ID suchen')}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${tx('Suchen')}"></label></div>
    <div class="pk-chips"></div><div class="pk-list"></div>${domains ? '<div class="pk-foot"><button class="btn link pk-any"></button></div>' : ''}`, { cls: 'picker', label: title, init: (dlg, done) => {
    const q = dlg.querySelector('input'), chips = dlg.querySelector('.pk-chips'), list = dlg.querySelector('.pk-list'), foot = dlg.querySelector('.pk-any');
    const pool = () => EN.filter(e => all ? true : domains.includes(e.domain) && (!dcs || dcs.includes(e.dc)) && (!e.hide || e.id === current));
    const mark = () => list.querySelectorAll('.pk-item').forEach((b, i) => b.classList.toggle('hi', i === hi));
    function draw() {
      const base = pool(), n = {};
      for (const e of base) n[e.domain] = (n[e.domain] || 0) + 1;
      if (dom && !n[dom]) dom = '';
      const doms = Object.keys(n).sort((a, b) => n[b] - n[a]);
      chips.innerHTML = doms.length > 1 ? `<div class="seg wrap">${[['', tx('Alle'), base.length], ...doms.map(d => [d, DOM[d]?.[0] || d, n[d]])].map(([d, t, c]) => `<button data-dm="${d}" aria-pressed="${d === dom}">${esc(t)} <small style="display:inline;margin-left:3px">${c}</small></button>`).join('')}</div>` : '';
      const words = fold(q.value).split(/\s+/).filter(Boolean);
      const hits = base.filter(e => !dom || e.domain === dom).map(e => [rank(e, words), e]).filter(x => x[0] >= 0).sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name, 'de'));
      items = hits.slice(0, 150).map(x => x[1]);
      if (none && !words.length && !dom) items.unshift({ id: '', name: none });
      hi = Math.min(hi, Math.max(items.length - 1, 0));
      const rows = items.map((e, i) => {
        if (!e.id) return `<button class="pk-item" data-i="${i}"><span class="av" style="--c:#8e8e93">${ic('x')}</span><span class="t"><b>${esc(e.name)}</b></span>${!current ? ic('check', 'ok') : ''}</button>`;
        const ctx = [DOM[e.domain]?.[0] || e.domain, e.area, e.device !== e.name && e.device].filter(Boolean).join(' · '), s = stateText(e);
        return `<button class="pk-item" data-i="${i}">${avatar(e.domain)}<span class="t"><b>${esc(e.name)}</b><small>${esc(ctx)}</small></span><span class="r"><small>${esc(s)}</small><small class="id">${esc(e.id)}</small></span>${e.id === current ? ic('check', 'ok') : ''}</button>`;
      }).join('');
      list.innerHTML = (rows ? `<div class="group">${rows}</div>` : `<div class="hint" style="padding:28px;text-align:center">${base.length ? tx('Nichts gefunden') : tx('Keine passenden Entitäten')}</div>`)
        + (hits.length > 150 ? `<div class="hint" style="padding:10px;text-align:center">${tx('{n} weitere – Suche eingrenzen', { n: hits.length - 150 })}</div>` : '');
      if (foot) foot.textContent = all ? tx('Nur passende Entitäten zeigen') : tx('Alle Entitäten zeigen');
      mark();
    }
    dlg.addEventListener('click', e => {
      const d = e.target.closest('[data-dm]'), b = e.target.closest('.pk-item');
      if (d) { dom = d.dataset.dm; hi = 0; draw(); list.scrollTop = 0; }
      else if (b) done(items[+b.dataset.i]);
      else if (e.target.closest('.pk-any')) { all = !all; dom = ''; hi = 0; draw(); }
    });
    q.addEventListener('input', () => { hi = 0; draw(); list.scrollTop = 0; });
    key = e => {   // das Blatt selbst ignoriert Escape, solange eine Auswahl offen ist (sie liegt über anderen Blättern)
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      else if (e.key === 'Enter' && items[hi]) done(items[hi]);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(0, Math.min(items.length - 1, hi + (e.key === 'ArrowDown' ? 1 : -1))); mark(); list.querySelectorAll('.pk-item')[hi]?.scrollIntoView({ block: 'nearest' }); }
    };
    document.addEventListener('keydown', key, true);
    draw(); hi = Math.max(0, items.findIndex(e => e.id === current)); mark();
    list.querySelector('.pk-item.hi')?.scrollIntoView({ block: 'nearest' });
  } });
  p.then(() => document.removeEventListener('keydown', key, true));
  return p;
}
