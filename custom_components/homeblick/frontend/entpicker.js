// Entity-Auswahl wie in Home Assistant: Suche über Name, Bereich, Gerät und ID, dazu Filter nach Domain.
// Mit `domains` zeigt sie nur passende Entities (ausgeblendet: deaktivierte, versteckte, Diagnose/Konfiguration);
// „Alle Entities zeigen“ hebt das auf. Läuft nur in admin.html (Symbole #i-* und CSS .pk* stehen dort).
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fold = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

// domain: [Name, Farbe, Symbol]
export const DOM = {
  light: ['Licht', '#ff9f0a', 'bulb'], switch: ['Schalter', '#8e8e93', 'switch'], lock: ['Schloss', '#34c759', 'lock'],
  cover: ['Tor', '#5e5ce6', 'cover'], climate: ['Thermostat', '#ff6b35', 'thermo'], scene: ['Szene', '#ff9500', 'sun'],
  script: ['Skript', '#8e8e93', 'script'], media_player: ['Medien', '#ff2d55', 'play'], fan: ['Ventilator', '#30b0c7', 'fan'],
  timer: ['Timer', '#ff9f0a', 'timer'], camera: ['Kamera', '#5856d6', 'cam'], sensor: ['Sensor', '#007aff', 'pulse'],
  binary_sensor: ['Binärsensor', '#007aff', 'pulse'], weather: ['Wetter', '#32ade6', 'sun'], calendar: ['Kalender', '#ff3b30', 'cal'],
  event: ['Ereignis', '#af52de', 'bolt'], input_boolean: ['Schalter', '#8e8e93', 'switch'], button: ['Taster', '#8e8e93', 'switch'], input_button: ['Taster', '#8e8e93', 'switch'],
};
const STATE = { on: 'an', off: 'aus', locked: 'verriegelt', unlocked: 'entsperrt', open: 'offen', closed: 'zu', opening: 'öffnet', closing: 'schließt',
  playing: 'spielt', paused: 'pausiert', idle: 'bereit', active: 'läuft', unavailable: 'nicht verfügbar', unknown: 'unbekannt', home: 'zuhause', not_home: 'abwesend',
  heat: 'Heizen', cool: 'Kühlen', heat_cool: 'Auto', auto: 'Auto', dry: 'Trocknen', fan_only: 'Lüften', standby: 'Standby', detected: 'erkannt', clear: 'frei' };
const NOSTATE = ['scene', 'button', 'event', 'script'];   // Zustand ist ein Zeitstempel oder nichtssagend

const SKIP = new Set(['friendly_name', 'icon', 'entity_picture', 'supported_features', 'device_class', 'unit_of_measurement', 'state_class', 'attribution', 'editable', 'id', 'restored', 'entity_id']);
let EN = [], BY = new Map();
export const entOf = id => BY.get(id);
export const areasOf = () => [...new Set(EN.map(e => e.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
export const entsIn = area => EN.filter(e => e.area === area && !e.hide);
export const entsFor = domains => EN.filter(e => domains.includes(e.domain) && !e.hide).sort((a, b) => a.name.localeCompare(b.name, 'de'));
export function findEnts(q, domains) {   // Suche über Name, Bereich, Gerät, ID (wie der Picker), nur passende Domains
  const w = fold(q).split(/\s+/).filter(Boolean);
  return EN.filter(e => domains.includes(e.domain) && !e.hide).map(e => [rank(e, w), e]).filter(x => x[0] >= 0).sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name, 'de')).map(x => x[1]);
}
export const entsOf = domain => EN.filter(e => e.domain === domain).sort((a, b) => a.name.localeCompare(b.name, 'de'));

// states aus get_states; Bereiche/Geräte aus den Registries (fehlen sie, bleiben Bereich und Gerät leer)
export async function loadEntities(conn, states) {
  const q = type => conn.sendMessagePromise({ type }).catch(() => []);
  const [er, dr, ar] = await Promise.all([q('config/entity_registry/list'), q('config/device_registry/list'), q('config/area_registry/list')]);
  const area = Object.fromEntries(ar.map(a => [a.area_id, a.name])), dev = Object.fromEntries(dr.map(d => [d.id, d])), reg = Object.fromEntries(er.map(e => [e.entity_id, e]));
  EN = states.map(s => {
    const id = s.entity_id, r = reg[id] || {}, d = dev[r.device_id], a = s.attributes;
    return { id, domain: id.split('.')[0], name: a.friendly_name || id, area: area[r.area_id || d?.area_id] || '', device: d ? d.name_by_user || d.name || '' : '',
      state: s.state, unit: a.unit_of_measurement, dc: a.device_class, attrs: Object.keys(a).filter(k => !SKIP.has(k) && ['number', 'string'].includes(typeof a[k])), hide: !!(r.disabled_by || r.hidden_by || r.entity_category) };
  });
  BY = new Map(EN.map(e => [e.id, e]));
}

const stateText = e => {
  if (NOSTATE.includes(e.domain)) return '';
  const s = STATE[e.state] ?? (/^-?\d+(\.\d+)?$/.test(e.state) ? (+e.state).toLocaleString('de-DE') + (e.unit ? ' ' + e.unit : '') : e.state);
  return s.length > 22 ? s.slice(0, 21) + '…' : s;
};
// alle Suchwörter müssen vorkommen; Treffer im Namen zählen mehr als in Bereich/Gerät/ID
function rank(e, words) {
  const n = e._n ||= fold(e.name), h = e._h ||= fold(`${e.name} ${DOM[e.domain]?.[0] || ''} ${e.area} ${e.device} ${e.id}`);
  let s = 0;
  for (const w of words) { if (!h.includes(w)) return -1; s += n.startsWith(w) ? 3 : n.includes(' ' + w) ? 2 : n.includes(w) ? 1 : 0; }
  return s;
}

// → gewählte Entity ({ id, name, area, domain, … }) oder null
// dcs: nur diese device_class; none: Text einer ersten Zeile „keine Auswahl“ (liefert { id: '' })
export function pickEntity({ title = 'Entity wählen', domains, dcs, none, current = '' } = {}) {
  return new Promise(res => {
    let dom = '', all = !domains, hi = 0, items = [];
    const o = Object.assign(document.createElement('div'), { id: 'ov', className: 'pkov', innerHTML: `<div class="pk" role="dialog" aria-label="${esc(title)}">
      <div class="pkh"><b>${esc(title)}</b><button data-x>Abbrechen</button></div>
      <label class="pks"><svg class="chev"><use href="#i-search"/></svg><input type="search" placeholder="Name, Bereich oder ID suchen" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <div class="pkc"></div><div class="pkl"></div>${domains ? '<button class="pkf" data-any></button>' : ''}</div>` });
    const q = o.querySelector('input'), chips = o.querySelector('.pkc'), list = o.querySelector('.pkl'), foot = o.querySelector('.pkf');
    const pool = () => EN.filter(e => all ? true : domains.includes(e.domain) && (!dcs || dcs.includes(e.dc)) && (!e.hide || e.id === current));
    const done = v => { o.classList.remove('in'); setTimeout(() => o.remove(), 300); res(v); };
    const mark = () => list.querySelectorAll('.pki').forEach((b, i) => b.classList.toggle('hi', i === hi));
    function draw() {
      const base = pool(), n = {};
      for (const e of base) n[e.domain] = (n[e.domain] || 0) + 1;
      if (dom && !n[dom]) dom = '';
      const doms = Object.keys(n).sort((a, b) => n[b] - n[a]);
      chips.innerHTML = doms.length > 1 ? [['', 'Alle', base.length], ...doms.map(d => [d, DOM[d]?.[0] || d, n[d]])].map(([d, t, c]) => `<button data-dm="${d}" class="${d === dom ? 'on' : ''}">${esc(t)} <small>${c}</small></button>`).join('') : '';
      const words = fold(q.value).split(/\s+/).filter(Boolean);
      const hits = base.filter(e => !dom || e.domain === dom).map(e => [rank(e, words), e]).filter(x => x[0] >= 0).sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name, 'de'));
      items = hits.slice(0, 150).map(x => x[1]);
      if (none && !words.length && !dom) items.unshift({ id: '', name: none });
      hi = Math.min(hi, Math.max(items.length - 1, 0));
      list.innerHTML = items.map((e, i) => {
        if (!e.id) return `<button class="pki" data-i="${i}"><span class="ico" style="background:#8e8e93"><svg><use href="#i-x"/></svg></span><span class="t"><b>${esc(e.name)}</b></span>${current ? '' : '<svg class="ok"><use href="#i-check"/></svg>'}</button>`;
        const [, c, ic] = DOM[e.domain] || ['', '#8e8e93', 'dot'], ctx = [DOM[e.domain]?.[0] || e.domain, e.area, e.device !== e.name && e.device].filter(Boolean).join(' · '), s = stateText(e);
        return `<button class="pki" data-i="${i}"><span class="ico" style="background:${c}"><svg><use href="#i-${ic}"/></svg></span><span class="t"><b>${esc(e.name)}</b><small>${esc(ctx)}</small></span>`
          + `<span class="r"><small>${esc(s)}</small><small class="id">${esc(e.id)}</small></span>${e.id === current ? '<svg class="ok"><use href="#i-check"/></svg>' : ''}</button>`;
      }).join('') + (hits.length > 150 ? `<div class="pkn">${hits.length - 150} weitere – Suche eingrenzen</div>` : '')
        || `<div class="pkn">${base.length ? 'Nichts gefunden' : 'Keine passenden Entities'}</div>`;
      if (foot) foot.textContent = all ? 'Nur passende Entities zeigen' : 'Alle Entities zeigen';
      mark();
    }
    o.onclick = e => {
      if (e.target === o || e.target.closest('[data-x]')) return done(null);
      const d = e.target.closest('[data-dm]'), b = e.target.closest('.pki');
      if (d) { dom = d.dataset.dm; hi = 0; draw(); list.scrollTop = 0; }
      else if (b) done(items[+b.dataset.i]);
      else if (e.target.closest('[data-any]')) { all = !all; dom = ''; hi = 0; draw(); }
    };
    q.oninput = () => { hi = 0; draw(); list.scrollTop = 0; };
    o.onkeydown = e => {
      if (e.key === 'Escape') done(null);
      else if (e.key === 'Enter' && items[hi]) done(items[hi]);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); hi = Math.max(0, Math.min(items.length - 1, hi + (e.key === 'ArrowDown' ? 1 : -1))); mark(); list.children[hi]?.scrollIntoView({ block: 'nearest' });
      }
    };
    draw(); hi = Math.max(0, items.findIndex(e => e.id === current)); mark(); document.body.append(o);
    requestAnimationFrame(() => { o.classList.add('in'); q.focus({ preventScroll: true }); list.querySelector('.pki.hi')?.scrollIntoView({ block: 'nearest' }); });
  });
}
