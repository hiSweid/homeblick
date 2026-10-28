// Sammelkachel (kind „multi“): eine Kachel für mehrere Lichter/Schalter/Rollläden, z. B. „Wohnzimmer Lichter · 3 an“.
// Tippen: alles aus (bei 0 an: alles an), Rollläden: alles zu (bei 0 offen: alles auf); Halten: Blatt mit den Einzelnen.
// Die Mitglieder stehen in der Konfiguration (t.ents, vom Editor aus dem Raum aufgelöst): das Display braucht keine Registry-Rechte.
const OPENS = ['open', 'opening'];
const isOn = s => s.attributes && (s.state === 'on' || OPENS.includes(s.state));
const dom = id => id.split('.')[0];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Reine Zählung: Mitglieder ohne Zustand/„nicht erreichbar“ zählen nicht mit
export function count(ents, st) {
  const ok = (ents || []).filter(id => { const s = st(id); return s && !['unavailable', 'unknown'].includes(s.state); });
  return { n: ok.filter(id => isOn(st(id))).length, total: ok.length, all: ents?.length || 0 };
}
export const textOf = (d, c) => !c.total ? 'nicht erreichbar' : d === 'cover' ? (c.n ? (c.n === c.total ? 'alle offen' : `${c.n} offen`) : 'alle zu') : c.n ? (c.n === c.total ? 'alle an' : `${c.n} an`) : 'alle aus';
// Dienste je Domain (eine Liste je Aufruf): [domain, service, entity_ids][]
export function plan(ents, st, c = count(ents, st)) {
  const by = {};
  for (const id of ents || []) if (st(id) && !['unavailable', 'unknown'].includes(st(id).state)) (by[dom(id)] ||= []).push(id);
  return Object.entries(by).map(([d, ids]) => [d, d === 'cover' ? (c.n ? 'close_cover' : 'open_cover') : (c.n ? 'turn_off' : 'turn_on'), ids]);
}

let api = null, OPEN = null;
// o.st(id) → Zustand, o.call(domain, service, data), o.shake(el), o.name(id), o.root: Element für das Blatt
export const multiInit = o => { api = o; };

export function multiSync(els) {
  for (const t of els) {
    const d = t._t?.dom || 'light', c = count(t._t?.ents, api.st);
    if (Date.now() < (t._mu || 0)) continue;   // gerade getippt: Zustand zieht nach, Kachel nicht zurückspringen lassen
    t.classList.toggle('on', c.n > 0); t.classList.toggle('na', !c.total);
    const sub = t.querySelector('.sub'), txt = textOf(d, c);
    if (sub && sub.textContent !== txt) sub.textContent = txt;
  }
  if (OPEN) paintSheet();
}
export function multiTap(t) {
  const ents = t._t?.ents, c = count(ents, api.st);
  if (!c.total) return api.shake(t);
  t._mu = Date.now() + 1500; t.classList.toggle('on', !c.n);
  for (const [d, s, ids] of plan(ents, api.st, c)) api.call(d, s, { entity_id: ids });
  setTimeout(() => multiSync([t]), 1600);   // nach der Schonzeit den echten Zustand nachziehen, auch wenn keine Änderung kam
}

// Blatt mit den Einzelnen: Tippen schaltet eine, außerhalb tippen schließt
function paintSheet() {
  const ents = OPEN.t._t?.ents || [], h = ents.map(id => {
    const s = api.st(id), off = ['unavailable', 'unknown'].includes(s.state), cov = dom(id) === 'cover';
    return `<button data-id="${esc(id)}"${isOn(s) ? ' class="on"' : ''}${off ? ' disabled' : ''}><span>${esc(api.name(id))}</span><em>${off ? 'nicht erreichbar' : cov ? (isOn(s) ? 'offen' : 'zu') : isOn(s) ? 'an' : 'aus'}</em></button>`;
  }).join('');
  if (OPEN.h !== h) { OPEN.h = h; OPEN.el.querySelector('.msl').innerHTML = h; }
}
export function multiSheet(t) {
  if (OPEN) return;
  const el = document.createElement('div');
  el.id = 'msheet'; el.innerHTML = `<div class="msp"><div class="msh">${esc(t._t?.title || 'Gruppe')}</div><div class="msl"></div></div>`;
  (api.root || document.body).append(el);
  OPEN = { t, el };
  paintSheet();
  const shut = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); OPEN = null; };
  el.addEventListener('click', e => {
    const b = e.target.closest('.msl button');
    if (!b) return e.target.closest('.msp') ? 0 : shut();
    const id = b.dataset.id, s = api.st(id), cov = dom(id) === 'cover';
    api.call(dom(id), cov ? (isOn(s) ? 'close_cover' : 'open_cover') : 'toggle', { entity_id: id });
  });
  return shut;
}

if (typeof document !== 'undefined') document.head.insertAdjacentHTML('beforeend', `<style>
#msheet{position:absolute;inset:0;z-index:30;display:flex;align-items:flex-end;justify-content:center;background:#0006;-webkit-backdrop-filter:blur(1.2cqw);backdrop-filter:blur(1.2cqw);animation:msin .25s ease-out}
#msheet.out{opacity:0;transition:opacity .2s}
.msp{width:100%;max-height:70%;display:flex;flex-direction:column;border-radius:5cqw 5cqw 0 0;background:#1c1c1ee6;color:#fff;padding:3cqw 3cqw 5cqw;box-sizing:border-box;animation:msup .3s cubic-bezier(.3,.8,.3,1)}
.msh{font-size:4.2cqw;font-weight:600;text-align:center;padding:1cqw 0 2.4cqw}
.msl{overflow-y:auto;display:flex;flex-direction:column;gap:1cqw}
.msl button{display:flex;align-items:center;justify-content:space-between;gap:2cqw;padding:2.6cqw 3.4cqw;border-radius:3cqw;background:#ffffff1a;font-size:3.6cqw;text-align:left}
.msl button span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.msl button em{font-style:normal;font-size:3.2cqw;opacity:.6;flex:none}
.msl button.on{background:#fff;color:#1c1c1e}.msl button:disabled{opacity:.4}
@keyframes msin{from{opacity:0}}@keyframes msup{from{translate:0 100%}}
</style>`);

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('multi.js')) {
  const t = (c, m) => console.assert(c, m), S = { 'light.a': { state: 'on', attributes: {} }, 'light.b': { state: 'off', attributes: {} }, 'light.c': { state: 'unavailable', attributes: {} }, 'switch.d': { state: 'on', attributes: {} } };
  const st = id => S[id], L = ['light.a', 'light.b', 'light.c', 'switch.d'];
  const c = count(L, st);
  t(c.n === 2 && c.total === 3 && c.all === 4, 'zählt ohne nicht erreichbare');
  t(textOf('light', c) === '2 an' && textOf('light', count(['light.b'], st)) === 'alle aus' && textOf('light', count(['light.a'], st)) === 'alle an' && textOf('light', count(['light.c'], st)) === 'nicht erreichbar', 'Texte Licht');
  t(JSON.stringify(plan(L, st)) === '[["light","turn_off",["light.a","light.b"]],["switch","turn_off",["switch.d"]]]', 'einer an → alle aus, je Domain ein Aufruf, ohne Unerreichbare');
  t(plan(['light.b'], st)[0][1] === 'turn_on', 'keiner an → alle an');
  S['cover.x'] = { state: 'closed', attributes: {} };
  t(textOf('cover', count(['cover.x'], st)) === 'alle zu' && plan(['cover.x'], st)[0][1] === 'open_cover' && textOf('cover', { n: 1, total: 2 }) === '1 offen', 'Rollläden');
  console.log('ok');
}
