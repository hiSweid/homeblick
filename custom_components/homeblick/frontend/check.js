// Haus-Check: ein Blick, ob alles zu ist — offene Türen/Fenster/Garage, entriegelte Schlösser, Wassermelder, schwache Batterien, ausgefallene Melder.
// Liest nur die Zustände der Entitäten (kein Ersatz für Rauchmelder oder Alarmanlage). Unbekannt/nicht erreichbar gilt nie als „zu“, sondern steht unter „Nicht erreichbar“.
// Tippen auf ein Schloss oder Tor schließt es (nur Schließen, nie Öffnen). Eigener Entwurf, keine Apple-Vorlage.
const OPENING = new Set(['door', 'window', 'opening', 'garage_door']);   // binary_sensor-Geräteklassen: an = offen
const COVERS = new Set(['garage', 'gate', 'door', 'window']);            // Rollläden/Jalousien gehören nicht dazu
const BAD_LOCK = new Set(['unlocked', 'unlocking', 'open', 'opening', 'jammed']);
const GONE = new Set(['unavailable', 'unknown']);
const NOISE = /handy|phone|iphone|ipad|tablet|pixel|galaxy|watch|uhr\b|auto\b|car\b|golf|tesla|display|laptop|airpods|kopfh/i;   // Geräte mit Akku, die man nicht „leer“ im Haus sucht
const LOW = 20;   // % Batterie
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const TEXT = { on: 'Offen', open: 'Offen', opening: 'Öffnet', closing: 'Schließt', stopped: 'Offen', unlocked: 'Entriegelt', unlocking: 'Entriegelt', jammed: 'Klemmt' };
let api;   // { ents(), call(domain, service, data) }
export function checkInit(o) { api = o; }

// Reine Auswertung (Selbsttest unten): skip = Teilstrings oder Entitäts-IDs, die ignoriert werden
export function scan(ents, skip = []) {
  const out = { open: [], water: [], bat: [], off: [], checked: 0 }, sk = skip.map(x => String(x).trim().toLowerCase()).filter(Boolean);
  for (const [id, s] of Object.entries(ents)) {
    const [dom] = id.split('.'), a = s.attributes || {}, dc = a.device_class, name = a.friendly_name || id;
    if (sk.some(x => id.toLowerCase().includes(x) || name.toLowerCase().includes(x))) continue;
    let kind = null;
    if (dom === 'binary_sensor' && OPENING.has(dc)) kind = 'door';
    else if (dom === 'lock') kind = 'lock';
    else if (dom === 'cover' && COVERS.has(dc)) kind = 'cover';
    else if (dom === 'binary_sensor' && dc === 'moisture') kind = 'water';
    else if ((dom === 'sensor' && dc === 'battery') || (dom === 'binary_sensor' && dc === 'battery')) kind = 'bat';
    if (!kind) continue;
    if (kind === 'bat') {
      if (NOISE.test(name) || GONE.has(s.state)) continue;   // ausgefallene Melder meldet ihre eigene Entität, nicht ihre Batterie
      out.checked++;
      const pct = parseFloat(s.state);
      if (dom === 'binary_sensor' ? s.state === 'on' : isFinite(pct) && pct < LOW) out.bat.push({ id, name, kind, pct: dom === 'binary_sensor' ? null : Math.round(pct) });
      continue;
    }
    out.checked++;
    if (GONE.has(s.state)) { out.off.push({ id, name, kind }); continue; }
    const bad = kind === 'door' ? s.state === 'on' : kind === 'lock' ? BAD_LOCK.has(s.state) : kind === 'cover' ? s.state !== 'closed' : s.state === 'on';
    if (bad) out[kind === 'water' ? 'water' : 'open'].push({ id, name, kind, state: s.state });
  }
  for (const k of ['open', 'water', 'bat', 'off']) out[k].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return out;
}

const ICO = {   // Symbole 24×24, Strich
  door: '<path d="M7 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M5 20h14"/><circle cx="14" cy="12.5" r=".8" fill="currentColor"/>', lock: '<rect x="6" y="11" width="12" height="9" rx="2.2"/><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0"/>',
  cover: '<path d="M4 20V9l8-5 8 5v11M8 20v-6h8v6"/>', water: '<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z"/>', bat: '<rect x="3.5" y="8" width="15" height="8.5" rx="2"/><path d="M21 11v3M7 11v2.6"/>',
  off: '<path d="M3 3l18 18M5.2 9.2a10 10 0 0 1 13.6 0M8.4 12.6a5.5 5.5 0 0 1 7.2 0"/>', ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', warn: '<path d="M12 4 3 19.5h18zM12 10v4.5M12 17.2v.1"/>' };
const COL = { door: '#ff9f0a', lock: '#ff9f0a', cover: '#ff9f0a', water: '#0a84ff', bat: '#ffd60a', off: '#8e8e93' };
const ico = n => `<svg class="i" viewBox="0 0 24 24">${ICO[n]}</svg>`;
const section = (title, rows) => rows.length ? `<h4>${title}</h4>${rows.join('')}` : '';
const row = (x, detail, act) => `<div class="crow" style="--c:${COL[x.kind]}"><i>${ico(x.kind)}</i><span>${esc(x.name)}</span><em>${esc(detail)}</em>${act ? `<button data-close="${esc(x.id)}">Schließen</button>` : ''}</div>`;

export function checkFace(el, f) {
  el.dataset.skip = (f.skip || '').toString();
  el.innerHTML = '<header>Haus-Check</header><div class="chero"></div><div class="cbody"></div>';
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-close]'); if (!b) return;
    const id = b.dataset.close, dom = id.split('.')[0];
    api.call(dom, dom === 'lock' ? 'lock' : 'close_cover', { entity_id: id });
  });
}
export function checkSync(els) {
  for (const el of els) {
    const r = scan(api.ents(), el.dataset.skip.split(',')), bad = r.open.length + r.water.length;
    const hero = r.water.length ? ['water', 'Wasser erkannt', r.water.map(x => x.name).join(', ')] : r.open.length ? ['warn', `${r.open.length} offen`, r.open.map(x => x.name).join(', ')]
      : r.checked ? ['ok', 'Alles zu', ''] : ['off', 'Keine Melder', 'Der Check liest Tür- und Fenstersensoren, Schlösser, Garagentore und Wassermelder.'];
    const foot = r.checked ? `${r.checked} Melder geprüft${r.off.length ? ` · ${r.off.length} nicht erreichbar` : ''}` : '';
    const head = `<div class="chero ${bad ? 'bad' : r.checked ? 'good' : ''}"><i>${ico(hero[0])}</i><span><b>${esc(hero[1])}</b><small>${esc(hero[2])}</small></span></div>`;
    const body = section('Offen', r.open.map(x => row(x, TEXT[x.state] || x.state, (x.kind === 'lock' || x.kind === 'cover') && x.state !== 'jammed')))
      + section('Wasser', r.water.map(x => row(x, 'Nass'))) + section('Batterie schwach', r.bat.map(x => row(x, x.pct == null ? 'Schwach' : x.pct + ' %')))
      + section('Nicht erreichbar', r.off.map(x => row(x, 'Keine Daten'))) + (foot ? `<p class="cfoot">${esc(foot)}</p>` : '');
    const html = head + '\u0001' + body;   // Hash: nur bei Änderung neu zeichnen
    if (el._h === html) continue;
    el._h = html; el.querySelector('.chero').outerHTML = head; el.querySelector('.cbody').innerHTML = body;
  }
}

if (typeof document !== 'undefined') document.head.insertAdjacentHTML('beforeend', `<style>
.f-check{padding:0;overflow:hidden}
.f-check header{position:absolute;left:7cqw;top:8cqw;font-size:7cqw;font-weight:600;letter-spacing:-.03em}
.chero{position:absolute;left:5cqw;right:5cqw;top:21cqw;display:flex;align-items:center;gap:3.6cqw;padding:3.4cqw 4.4cqw;border-radius:5cqw;corner-shape:squircle;
  background:var(--glass,linear-gradient(165deg,#ffffff3d,#ffffff29 50%,#ffffff1f));box-shadow:inset 0 0 0 .25cqw #ffffff47}
.chero>i{flex:none;width:11cqw;height:11cqw;border-radius:50%;display:grid;place-items:center;background:#ffffff40}
.chero>i svg{width:6.2cqw;height:6.2cqw;stroke-width:2.2}
.chero.good>i{background:#30d158;color:#fff}.chero.bad>i{background:#ff9f0a;color:#fff}
.chero span{min-width:0}.chero b{display:block;font-size:5.4cqw;font-weight:600;letter-spacing:-.02em;line-height:1.15}
.chero small{display:block;margin-top:.8cqw;font-size:3.3cqw;opacity:.75;line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.cbody{position:absolute;left:5cqw;right:5cqw;top:44cqw;bottom:4cqw;overflow-y:auto;scrollbar-width:none;display:flex;flex-direction:column;gap:1.8cqw}
.cbody::-webkit-scrollbar{display:none}
.cbody h4{flex:none;margin:1.6cqw 0 0 3cqw;font-size:3.2cqw;font-weight:600;letter-spacing:.06em;text-transform:uppercase;opacity:.7}
.crow{flex:none;display:flex;align-items:center;gap:3cqw;min-height:11cqw;padding:1.6cqw 3.4cqw 1.6cqw 2.4cqw;border-radius:4cqw;corner-shape:squircle;font-size:3.9cqw;font-weight:500;
  background:var(--glass,linear-gradient(165deg,#ffffff3d,#ffffff29 50%,#ffffff1f));box-shadow:inset 0 0 0 .25cqw #ffffff47}
.crow>i{flex:none;width:7.4cqw;height:7.4cqw;border-radius:50%;display:grid;place-items:center;background:var(--c);color:#fff}
.crow>i svg{width:4.2cqw;height:4.2cqw;stroke-width:2.2}
.crow span{flex:1;min-width:0;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.crow em{flex:none;font-style:normal;font-size:3.3cqw;opacity:.75}
.crow button{flex:none;height:6.6cqw;padding:0 3cqw;border-radius:9cqw;font-size:3.3cqw;font-weight:600;color:#fff;background:#007aff;transition:scale .25s}
.crow button:active{scale:.93;transition:scale .12s ease-out}
.cfoot{flex:none;text-align:center;font-size:3.2cqw;opacity:.55;margin-top:1cqw}
</style>`);

// Selbsttest: node check.js
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('check.js')) {
  const E = (id, state, a = {}) => [id, { state, attributes: { friendly_name: id.split('.')[1], ...a } }], t = (c, m) => console.assert(c, m);
  const ents = Object.fromEntries([E('binary_sensor.fenster', 'on', { device_class: 'window' }), E('binary_sensor.tuer', 'off', { device_class: 'door' }), E('lock.haustuer', 'locked'), E('lock.neben', 'unlocked'),
    E('cover.garage', 'open', { device_class: 'garage' }), E('cover.rollladen', 'open', { device_class: 'shutter' }), E('binary_sensor.keller', 'off', { device_class: 'moisture' }), E('binary_sensor.bad', 'on', { device_class: 'moisture' }),
    E('sensor.melder_akku', '12', { device_class: 'battery' }), E('sensor.iphone_akku', '5', { device_class: 'battery' }), E('sensor.sensor_ok', '88', { device_class: 'battery' }), E('binary_sensor.terrasse', 'unavailable', { device_class: 'door' }), E('lock.kaputt', 'unknown')]);
  const r = scan(ents);
  t(r.open.map(x => x.id).join() === 'binary_sensor.fenster,cover.garage,lock.neben', 'offen: Garage, Fenster, entriegeltes Schloss (Rollladen nicht)');
  t(r.water.length === 1 && r.water[0].id === 'binary_sensor.bad', 'Wasser nur wenn nass');
  t(r.bat.length === 1 && r.bat[0].pct === 12, 'Batterie: unter 20 %, Handy zählt nicht');
  t(r.off.map(x => x.id).join() === 'lock.kaputt,binary_sensor.terrasse', 'unbekannt ist nie „zu“, sondern nicht erreichbar');
  t(r.checked === 11, 'geprüft: ' + r.checked);
  t(scan(ents, ['fenster', 'lock.neben']).open.length === 1, 'skip nach Teilstring oder ID');
  t(scan({ 'cover.x': { state: 'closing', attributes: { device_class: 'garage' } } }).open[0]?.state === 'closing', 'Zwischenzustand zählt als offen');
  console.log('ok');
}
