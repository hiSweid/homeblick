// Aufgaben-Face: Glasliste einer todo.*-Entität (Einkaufsliste, Lokale Aufgaben, Google Tasks …). Eigener Entwurf, keine Apple-Vorlage.
// Tippen hakt ab (Feder, sofort sichtbar, bei Fehler zurück), „+“ öffnet die Eingabe, „Entfernen“ löscht die Erledigten. Die Liste kommt live per todo/item/subscribe
// (HA schickt bei jeder Änderung die ganze Liste, auch wenn Handy oder Assist etwas ändern). Ohne f.todo gilt die erste Liste, bei mehreren wählt man per Chip.
// Funktionsumfang laut supported_features der Entität: 1 anlegen, 2 löschen, 4 ändern.
import { tx } from './i18n.js';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const CREATE = 1, DELETE = 2, UPDATE = 4;
const lists = new Map();   // Entität → { items: Server-Stand, pend: { uid: Status } (lokal, bis zur nächsten Meldung), tmp: [] (neu angelegt), un: Promise | null, err }
let api;                   // { conn, live, ents, down } aus index.html
let faces = new Set();

// Demo (ohne ?live): zwei Listen im Speicher; die Dienste verändern sie wie HA
const DEMO = { 'todo.einkaufsliste': [tx('Milch'), tx('Brot'), tx('Äpfel'), tx('Waschmittel'), [tx('Nudeln'), 1]], 'todo.aufgaben': [tx('Reifen wechseln'), tx('Steuererklärung'), [tx('Paket abholen'), 1]] };
const demoItems = id => (DEMO[id] || []).map((x, i) => ({ uid: id + i, summary: [].concat(x)[0], status: [].concat(x)[1] ? 'completed' : 'needs_action' }));

export function todoInit(o) { api = o; }

const shop = i => /einkauf|shopping/i.test(i);   // die Einkaufsliste ist die Standardliste
const sorted = () => Object.keys(api.ents()).filter(i => i.startsWith('todo.')).sort((a, b) => shop(b) - shop(a) || (a < b ? -1 : 1));
const pick = el => { const a = sorted(), f = el.dataset.todo; return (f && a.includes(f) ? f : a.includes(el._sel) ? el._sel : a[0]) || ''; };
const feat = id => +api.ents()[id]?.attributes.supported_features || 0;

function items(id) {   // Anzeige = Server-Stand mit lokalen Änderungen; offene zuerst, Reihenfolge der Liste bleibt
  const L = lists.get(id); if (!L) return [];
  const all = [...L.items.map(x => (x.uid in L.pend ? { ...x, status: L.pend[x.uid] } : x)), ...L.tmp];
  return [...all.filter(x => x.status !== 'completed'), ...all.filter(x => x.status === 'completed')];
}

function subscribe(id) {
  if (lists.has(id)) return;
  const L = { items: [], pend: {}, tmp: [], un: null, err: false, got: false }; lists.set(id, L);
  const got = it => { L.items = it || []; L.pend = {}; L.tmp = []; L.got = true; L.err = false; paint(id); };
  if (!api.live) return got(demoItems(id));
  L.un = api.conn().subscribeMessage(m => got(m.items), { type: 'todo/item/subscribe', entity_id: id });
  L.un.catch(e => { console.warn('Aufgaben', id, e); L.err = true; paint(id); });
}

// Aus index.html bei jedem render(): neue Listen abonnieren, nicht mehr gezeigte beenden, Kopf und Chips auffrischen
export function todoSync(els) {
  faces = new Set(els);
  const want = new Set([...faces].map(pick).filter(Boolean));
  for (const id of want) subscribe(id);
  for (const [id, L] of lists) if (!want.has(id)) { L.un?.then(f => f()).catch(() => 0); lists.delete(id); }
  for (const el of faces) paintFace(el);
}

const svc = (id, service, data) => api.live
  ? api.down() ? Promise.reject(new Error('offline')) : api.conn().sendMessagePromise({ type: 'call_service', domain: 'todo', service, service_data: { entity_id: id, ...data } })
  : demo(id, service, data);
function demo(id, service, data) {
  const L = lists.get(id); let it = L.items.slice();
  if (service === 'update_item') it = it.map(x => x.uid === data.item ? { ...x, status: data.status } : x);
  else if (service === 'add_item') it.push({ uid: id + Date.now(), summary: data.item, status: 'needs_action' });
  else if (service === 'remove_completed_items') it = it.filter(x => x.status !== 'completed');
  L.items = it; setTimeout(() => { L.pend = {}; L.tmp = []; paint(id); }, 250);   // „Antwort“ des Servers verzögert, damit man das Abhaken sofort und dann bestätigt sieht
  return Promise.resolve();
}

function paint(id) { for (const el of faces) if (pick(el) === id) paintFace(el); }
function paintFace(el) {
  const id = pick(el), L = lists.get(id), a = api.ents()[id]?.attributes, sf = feat(id), all = sorted();
  el.classList.toggle('multi', all.length > 1 && !el.dataset.todo);
  el.querySelector('.tplus').hidden = !(sf & CREATE) || !id;
  if (!(sf & CREATE)) el.classList.remove('adding');
  el.querySelector('.tn').textContent = id ? a?.friendly_name || id : tx('Aufgaben');
  const list = items(id), open = list.filter(x => x.status !== 'completed').length;
  el.querySelector('.ts').textContent = !id || !L?.got ? '' : open ? tx('{n} offen', { n: open }) : list.length ? tx('Alles erledigt') : tx('Leer');
  const chips = all.length > 1 && !el.dataset.todo ? all.map(i => `<button class="tchip${i === id ? ' on' : ''}" data-list="${esc(i)}">${esc(api.ents()[i].attributes.friendly_name || i)}</button>`).join('') : '';
  const body = !id ? `<p class="tnone">${tx('Keine Liste in Home Assistant')}<small>${tx('Füge die Integration „Einkaufsliste“ oder „Lokale Aufgaben“ hinzu')}</small></p>`
    : L?.err ? `<p class="tnone">${tx('Liste nicht lesbar')}<small>${tx('Home Assistant hat das Abonnement abgelehnt')}</small></p>`
    : !L?.got ? `<p class="tnone">${tx('Lädt …')}</p>`
    : !list.length ? `<p class="tnone">${tx('Nichts auf der Liste')}<small>${tx('Mit + etwas hinzufügen')}</small></p>`
    : list.map((x, i) => {
      const done = x.status === 'completed', first = done && (i === 0 || list[i - 1].status !== 'completed');
      return (first ? `<div class="tsep"><span>${tx('Erledigt')}</span>${sf & DELETE ? `<button data-clear>${tx('Entfernen')}</button>` : ''}</div>` : '')
        + `<button class="trow${done ? ' done' : ''}" data-u="${esc(x.uid)}"${sf & UPDATE ? '' : ' disabled'}><i class="tck"></i><span>${esc(x.summary)}</span></button>`;
    }).join('');
  const html = chips + '\u0001' + body;   // Hash: nur bei Änderung neu zeichnen, sonst bricht die Feder-Animation des Hakens ab
  if (el._h === html) return;
  el._h = html; el.querySelector('.tchips').innerHTML = chips; el.querySelector('.tbody').innerHTML = body;
}

export function todoFace(el, f) {
  if (f.todo) el.dataset.todo = f.todo;
  el.innerHTML = `<header><b class="tn">${tx('Aufgaben')}</b><small class="ts"></small></header><button class="tplus" aria-label="${tx('Hinzufügen')}" hidden><svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
<div class="tchips"></div><div class="tbody"></div>
<form class="tadd"><input maxlength="255" placeholder="${tx('Neuer Eintrag')}" autocomplete="off" enterkeyhint="done"><button aria-label="${tx('Hinzufügen')}"><svg class="i" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button></form>`;
  const inp = el.querySelector('input');
  el.addEventListener('click', e => {
    const id = pick(el), L = lists.get(id), t = e.target;
    if (t.closest('.tplus')) { el.classList.toggle('adding'); if (el.classList.contains('adding')) inp.focus(); else inp.blur(); return; }
    const chip = t.closest('.tchip'); if (chip) { el._sel = chip.dataset.list; subscribe(el._sel); todoSync(faces); return; }
    if (!L) return;
    if (t.closest('[data-clear]')) return void svc(id, 'remove_completed_items').catch(e => fail(el, e));
    const row = t.closest('.trow'); if (!row || row.disabled) return;
    const x = items(id).find(y => y.uid === row.dataset.u); if (!x) return;
    const status = x.status === 'completed' ? 'needs_action' : 'completed';
    L.pend[x.uid] = status; paint(id);
    svc(id, 'update_item', { item: x.uid, status }).catch(e => { delete L.pend[x.uid]; paint(id); fail(el, e); });   // Erfolg: die nächste Meldung von HA ersetzt den lokalen Stand
  });
  el.querySelector('.tadd').addEventListener('submit', e => {
    e.preventDefault();
    const id = pick(el), L = lists.get(id), text = inp.value.trim(); if (!L || !text) return;
    inp.value = ''; const tmp = { uid: 'neu' + Date.now(), summary: text, status: 'needs_action' }; L.tmp.push(tmp); paint(id);
    svc(id, 'add_item', { item: text }).catch(e => { L.tmp = L.tmp.filter(x => x !== tmp); paint(id); inp.value = text; fail(el, e); });
  });
}
const fail = (el, e) => { console.warn('Aufgaben', e); el.animate([{ translate: '0' }, { translate: '-1.2cqw' }, { translate: '1.2cqw' }, { translate: '0' }], { duration: 280 }); };

document.head.insertAdjacentHTML('beforeend', `<style>
.f-todo{padding:0;overflow:hidden}
.f-todo header{position:absolute;left:7cqw;right:22cqw;top:8cqw}
.f-todo header b{display:block;font-size:7cqw;font-weight:600;letter-spacing:-.03em;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.f-todo header small{display:block;font-size:3.6cqw;opacity:.7;margin-top:.8cqw;min-height:4cqw}
.tplus{position:absolute;right:6cqw;top:8.5cqw;width:10cqw;height:10cqw;border-radius:50%;display:grid;place-items:center;color:inherit;background:var(--glass,linear-gradient(165deg,#ffffff3d,#ffffff29 50%,#ffffff1f));box-shadow:inset 0 0 0 .25cqw #ffffff47;transition:scale .25s,rotate var(--sd) var(--spring)}
.tplus:active{scale:.9;transition:scale .12s ease-out}
.f-todo.adding .tplus{rotate:45deg}
.tplus svg{width:5cqw;height:5cqw;stroke-width:2.2}
.tchips{position:absolute;left:5cqw;right:5cqw;top:23cqw;display:none;gap:2cqw;overflow-x:auto;scrollbar-width:none;touch-action:pan-x}
.tchips::-webkit-scrollbar{display:none}
.f-todo.multi .tchips{display:flex}
.tchip{flex:none;height:7.4cqw;padding:0 3.4cqw;border-radius:9cqw;font-size:3.5cqw;font-weight:600;color:inherit;background:#ffffff26;white-space:nowrap}
.tchip.on{background:#ffffffd9;color:#3c3c3c}
.tbody{position:absolute;left:5cqw;right:5cqw;top:25cqw;bottom:4cqw;display:flex;flex-direction:column;gap:2cqw;overflow-y:auto;scrollbar-width:none}
.tbody::-webkit-scrollbar{display:none}
.f-todo.multi .tbody{top:33cqw}
.f-todo.adding .tbody{bottom:19cqw}
.trow{flex:none;display:flex;align-items:center;gap:3.4cqw;min-height:12.5cqw;padding:2cqw 4cqw;border-radius:4.3cqw;corner-shape:squircle;text-align:left;color:inherit;font-size:4.2cqw;font-weight:500;
  background:var(--glass,linear-gradient(165deg,#ffffff3d,#ffffff29 50%,#ffffff1f));box-shadow:inset 0 0 0 .25cqw #ffffff47;transition:scale .25s,opacity .4s}
.trow:active{scale:.97;transition:scale .12s ease-out}
.trow span{flex:1;min-width:0;line-height:1.2;overflow-wrap:anywhere}
.tck{flex:none;position:relative;width:6.4cqw;height:6.4cqw;border-radius:50%;box-shadow:inset 0 0 0 .5cqw #ffffffb3;transition:background .3s,box-shadow .3s}
.tck::after{content:"";position:absolute;left:1.9cqw;top:1.3cqw;width:1.6cqw;height:2.9cqw;border:solid #3c3c3c;border-width:0 .6cqw .6cqw 0;rotate:40deg;scale:0;transition:scale var(--sd) var(--spring)}
.trow.done{opacity:.55}.trow.done span{text-decoration:line-through}
.trow.done .tck{background:#ffffffe6;box-shadow:none}.trow.done .tck::after{scale:1}
.tsep{flex:none;display:flex;align-items:center;justify-content:space-between;padding:2cqw 2cqw 0 3cqw;font-size:3.4cqw;font-weight:600;opacity:.75;text-transform:uppercase;letter-spacing:.06em}
.tsep button{color:inherit;font-size:3.4cqw;font-weight:600;letter-spacing:0;text-transform:none;padding:1.4cqw 3cqw;border-radius:9cqw;background:#ffffff26}
.tnone{position:absolute;left:0;right:0;top:30cqw;text-align:center;opacity:.6;font-size:4cqw}
.tnone small{display:block;margin:1.6cqw 8cqw 0;font-size:3.2cqw;line-height:1.35}
.tadd{position:absolute;left:5cqw;right:5cqw;bottom:4cqw;display:none;gap:2cqw}
.f-todo.adding .tadd{display:flex;animation:evin var(--sd) var(--spring) both}
.tadd input{flex:1;min-width:0;height:11cqw;padding:0 4.5cqw;border:0;border-radius:9cqw;background:#ffffffd9;color:#1c1c1e;font:inherit;font-size:max(16px,4cqw)}
.tadd button{flex:none;width:11cqw;height:11cqw;border-radius:50%;display:grid;place-items:center;background:#007aff;color:#fff;transition:scale .25s}
.tadd button:active{scale:.9;transition:scale .12s ease-out}
.tadd svg{width:5.4cqw;height:5.4cqw;stroke-width:2.4}
</style>`);
