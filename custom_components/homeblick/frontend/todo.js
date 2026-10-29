// Aufgaben-Face: Glasliste einer todo.*-Entität (Einkaufsliste, Lokale Aufgaben, Google Tasks …), Farbe je Liste und Abhaken wie Apple Erinnerungen (Vorlage y-MO 2,33 s: farbige Listen, runde Haken).
// Animationen: Ring füllt sich mit der Listenfarbe, Haken wird gezeichnet, Funken, Text wird durchgestrichen, danach gleitet die Zeile (FLIP) zu „Erledigt"; neue Zeilen federn ein, entfernte klappen zu.
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

function items(id) {   // Anzeige = Server-Stand mit lokalen Änderungen; offene zuerst, Reihenfolge der Liste bleibt. Eine eben abgehakte Zeile bleibt kurz in ihrer Gruppe (settle), damit man den Haken sieht, bevor sie wandert
  const L = lists.get(id); if (!L) return [];
  const all = [...L.items.map(x => (x.uid in L.pend ? { ...x, status: L.pend[x.uid] } : x)), ...L.tmp].map(x => ({ ...x, key: L.alias[x.uid] || x.uid, grp: (L.settle.get(x.uid)?.g ?? x.status) === 'completed' }));
  return [...all.filter(x => !x.grp), ...all.filter(x => x.grp)];
}
// Neu angelegte Zeile bekommt vom Server eine echte uid: gleiche Schlüssel behalten, damit sie nicht aus- und wieder einblendet
function adopt(L, prev, next) {
  const had = new Set(prev.map(x => x.uid)), used = new Set();
  for (const t of L.tmp) { const m = next.find(x => !had.has(x.uid) && !used.has(x.uid) && x.summary === t.summary); if (m) { used.add(m.uid); L.alias[m.uid] = t.uid; } }
}
const settle = (L, x, ms) => { clearTimeout(L.settle.get(x.uid)?.t); L.settle.set(x.uid, { g: L.settle.get(x.uid)?.g ?? x.status, t: setTimeout(() => { L.settle.delete(x.uid); paintAll(L); }, ms) }); };
const paintAll = L => { for (const [id, l] of lists) if (l === L) paint(id); };

function subscribe(id) {
  if (lists.has(id)) return;
  const L = { items: [], pend: {}, tmp: [], settle: new Map(), alias: {}, un: null, err: false, got: false }; lists.set(id, L);
  const got = it => { it ||= []; adopt(L, L.items, it); L.items = it; L.pend = {}; L.tmp = []; L.got = true; L.err = false; paint(id); };
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
  adopt(L, L.items, it); L.items = it; setTimeout(() => { L.pend = {}; L.tmp = []; paint(id); }, 250);   // „Antwort“ des Servers verzögert, damit man das Abhaken sofort und dann bestätigt sieht
  return Promise.resolve();
}

function paint(id) { for (const el of faces) if (pick(el) === id) paintFace(el); }
const PAL = ['#0a84ff', '#ff9f0a', '#af52de', '#ff453a', '#32ade6', '#ff375f'];
const lcolor = id => shop(id) ? '#34c759' : PAL[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % PAL.length];   // Einkaufsliste grün wie „Groceries“ bei Apple, andere Listen reihum
const EASE = 'cubic-bezier(.22,1.2,.36,1)';
const calm = el => el.closest('.perf') || matchMedia('(prefers-reduced-motion:reduce)').matches;
const enter = (e, i = 0) => calm(e) || e.animate([{ opacity: 0, translate: '0 3cqw', scale: .96 }, { opacity: 1, translate: '0 0', scale: 1 }], { duration: 520, delay: Math.min(i, 12) * 40, easing: EASE, fill: 'backwards' });
function leave(e, i = 0) {   // Zeile klappt zu (Höhe, Abstand, Deckkraft), dann weg; Schlüssel sofort frei, damit sie wiederkommen kann
  delete e.dataset.k; e.style.pointerEvents = 'none';
  if (calm(e) || e.classList.contains('tnone')) return void (calm(e) ? e.remove() : e.animate({ opacity: [1, 0] }, { duration: 160 }).onfinish = () => e.remove());
  const c = getComputedStyle(e), gap = parseFloat(getComputedStyle(e.parentNode).rowGap) || 0, h = e.offsetHeight + 'px';
  e.style.overflow = 'hidden';
  e.animate([{ opacity: 1, height: h, minHeight: h, paddingTop: c.paddingTop, paddingBottom: c.paddingBottom, marginBottom: '0px', scale: 1 }, { opacity: 0, height: '0px', minHeight: '0px', paddingTop: '0px', paddingBottom: '0px', marginBottom: -gap + 'px', scale: .96 }],
    { duration: 440, delay: Math.min(i, 8) * 35, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => e.remove();
}
// Abgleich nach Schlüssel: vorhandene Elemente bleiben (Animationen laufen weiter), neue federn ein, fehlende klappen zu, verschobene gleiten (FLIP)
function sync(body, specs) {
  const old = new Map([...body.children].filter(e => e.dataset.k).map(e => [e.dataset.k, e])), first = new Map([...old].map(([k, e]) => [k, e.getBoundingClientRect().top]));
  const fresh = !old.size, keep = new Set(), made = [];
  let prev = null;
  specs.forEach((sp, i) => {
    let e = old.get(sp.key);
    if (!e) { e = sp.make(); e.dataset.k = sp.key; made.push([e, i]); }
    sp.upd(e); keep.add(sp.key);
    if ((prev ? prev.nextElementSibling : body.firstElementChild) !== e) body.insertBefore(e, prev ? prev.nextSibling : body.firstChild);
    prev = e;
  });
  let n = 0; for (const [k, e] of old) if (!keep.has(k)) leave(e, n++);
  for (const [e, i] of made) enter(e, fresh ? i : 0);
  if (!calm(body)) for (const [k, e] of old) if (keep.has(k)) { const dy = first.get(k) - e.getBoundingClientRect().top; if (Math.abs(dy) > 1) e.animate([{ translate: `0 ${dy}px` }, { translate: '0 0' }], { duration: 560, easing: EASE }); }
}
const rowMake = () => { const b = document.createElement('button'); b.className = 'trow'; b.innerHTML = '<b class="tsh"></b><i class="tck"><svg viewBox="0 0 24 24"><path pathLength="1" d="M6.8 12.6l3.4 3.4 7-7.6"/></svg></i><span><em></em></span>'; return b; };
function burst(row) {   // Abhaken: Ring federt, Haken poppt, Welle läuft vom Ring aus, zehn Funken (Listenfarbe und weiß) fliegen heraus, Glanz streift über die Zeile, Rand leuchtet kurz
  const tck = row.querySelector('.tck'); if (calm(tck)) return;
  tck.animate([{ scale: 1 }, { scale: 1.3, offset: .3 }, { scale: .92, offset: .6 }, { scale: 1 }], { duration: 560, easing: EASE });
  tck.querySelector('svg').animate([{ scale: .3 }, { scale: 1.3, offset: .6 }, { scale: 1 }], { duration: 480, delay: 140, easing: EASE, fill: 'backwards' });
  const w = document.createElement('b'); w.className = 'tdot tpulse'; tck.append(w);
  w.animate([{ scale: 1, opacity: .75 }, { scale: 2.6, opacity: 0 }], { duration: 640, easing: 'ease-out' }).onfinish = () => w.remove();
  for (let i = 0; i < 10; i++) {
    const a = (i + Math.random() * .6) * Math.PI / 5, r = 4.2 + Math.random() * 2.6, z = .8 + Math.random() * .9, d = document.createElement('b'); d.className = 'tdot'; tck.append(d);
    d.style.cssText = `width:${z}cqw;height:${z}cqw;margin:${-z / 2}cqw 0 0 ${-z / 2}cqw` + (i % 2 ? ';background:#fff' : '');
    d.animate([{ translate: '0 0', scale: 1, opacity: 1 }, { translate: `${Math.cos(a) * r}cqw ${Math.sin(a) * r}cqw`, scale: 0, opacity: 0 }], { duration: 520 + Math.random() * 240, delay: 90 + i * 12, easing: 'cubic-bezier(.1,.8,.3,1)', fill: 'backwards' }).onfinish = () => d.remove();
  }
  row.querySelector('.tsh').animate({ backgroundPosition: ['100% 0', '0% 0'] }, { duration: 780, delay: 120, easing: 'ease-in-out' });
  row.animate([{ boxShadow: 'inset 0 0 0 .25cqw #ffffff47' }, { boxShadow: 'inset 0 0 0 .4cqw color-mix(in srgb,var(--lc) 85%,transparent)', offset: .3 }, { boxShadow: 'inset 0 0 0 .25cqw #ffffff47' }], { duration: 900, easing: 'ease-out' });
}
function paintFace(el) {
  const id = pick(el), L = lists.get(id), a = api.ents()[id]?.attributes, sf = feat(id), all = sorted(), body = el.querySelector('.tbody');
  if (el._id !== id) { body.replaceChildren(); el._id = id; }   // andere Liste: nicht abgleichen, sondern neu aufbauen
  el.style.setProperty('--lc', lcolor(id));
  el.classList.toggle('multi', all.length > 1 && !el.dataset.todo);
  el.querySelector('.tplus').hidden = !(sf & CREATE) || !id;
  if (!(sf & CREATE)) el.classList.remove('adding');
  el.querySelector('.tn').textContent = id ? a?.friendly_name || id : tx('Aufgaben');
  const list = items(id), open = list.filter(x => x.status !== 'completed').length, ts = el.querySelector('.ts');
  const sub = !id || !L?.got ? '' : open ? tx('{n} offen', { n: open }) : list.length ? tx('Alles erledigt') : tx('Leer');
  if (ts.textContent !== sub) { const was = ts.textContent; ts.textContent = sub; if (was && sub && !calm(el)) ts.animate([{ translate: '0 45%', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 420, easing: EASE }); }   // Zähler rollt von unten ein
  el.querySelector('.tprog i').style.width = list.length ? (list.length - open) / list.length * 100 + '%' : '0';
  const chips = all.length > 1 && !el.dataset.todo ? all.map(i => `<button class="tchip${i === id ? ' on' : ''}" data-list="${esc(i)}" style="--lc:${lcolor(i)}">${esc(api.ents()[i].attributes.friendly_name || i)}</button>`).join('') : '';
  if (el._ch !== chips) { el._ch = chips; el.querySelector('.tchips').innerHTML = chips; }
  const msg = !id ? `${tx('Keine Liste in Home Assistant')}<small>${tx('Füge die Integration „Einkaufsliste“ oder „Lokale Aufgaben“ hinzu')}</small>`
    : L?.err ? `${tx('Liste nicht lesbar')}<small>${tx('Home Assistant hat das Abonnement abgelehnt')}</small>`
    : !L?.got ? `${tx('Lädt …')}`
    : !list.length ? `<svg class="tbig" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" pathLength="1"/><path pathLength="1" d="M14.5 25l6.5 6.5 12.5-14"/></svg>${tx('Nichts auf der Liste')}<small>${tx('Mit + etwas hinzufügen')}</small>` : '';
  const specs = msg ? [{ key: 'msg', make: () => Object.assign(document.createElement('p'), { className: 'tnone' }), upd: e => { if (e._h !== msg) { e._h = msg; e.innerHTML = msg; } } }]
    : list.flatMap((x, i) => {
      const sep = x.grp && (i === 0 || !list[i - 1].grp) ? [{ key: 'sep', make: () => Object.assign(document.createElement('div'), { className: 'tsep' }), upd: e => { const h = `<span>${tx('Erledigt')}</span>${sf & DELETE ? `<button data-clear>${tx('Entfernen')}</button>` : ''}`; if (e._h !== h) { e._h = h; e.innerHTML = h; } } }] : [];
      return [...sep, { key: 'r:' + x.key, make: rowMake, upd: e => { e.dataset.u = x.uid; e.classList.toggle('done', x.status === 'completed'); e.disabled = !(sf & UPDATE); const t = e.lastChild.firstChild; if (t.textContent !== x.summary) t.textContent = x.summary; } }];
    });
  sync(body, specs);
}

export function todoFace(el, f) {
  if (f.todo) el.dataset.todo = f.todo;
  el.innerHTML = `<header><b class="tn">${tx('Aufgaben')}</b><small class="ts"></small></header><button class="tplus" aria-label="${tx('Hinzufügen')}" hidden><svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
<div class="tprog"><i></i></div><div class="tchips"></div><div class="tbody"></div>
<form class="tadd"><input maxlength="255" placeholder="${tx('Neuer Eintrag')}" autocomplete="off" enterkeyhint="done"><button aria-label="${tx('Hinzufügen')}"><svg class="i" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button></form>`;
  const inp = el.querySelector('input');
  new MutationObserver(m => {   // Ansicht kommt ins Bild (.act): Kopf und Zeilen federn nacheinander ein
    if (!m.some(r => r.oldValue?.split(' ').includes('act') === false && el.classList.contains('act')) || calm(el)) return;
    el.querySelectorAll('header,.trow,.tsep').forEach((e, i) => e.animate([{ opacity: 0, translate: '0 3cqw', scale: .96 }, { opacity: 1, translate: '0 0', scale: 1 }], { duration: 560, delay: Math.min(i, 12) * 45, easing: EASE, fill: 'backwards' }));
  }).observe(el, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  el.addEventListener('click', e => {
    const id = pick(el), L = lists.get(id), t = e.target;
    if (t.closest('.tplus')) { el.classList.toggle('adding'); if (el.classList.contains('adding')) inp.focus(); else inp.blur(); return; }
    const chip = t.closest('.tchip'); if (chip) { el._sel = chip.dataset.list; subscribe(el._sel); todoSync(faces); return; }
    if (!L) return;
    if (t.closest('[data-clear]')) return void svc(id, 'remove_completed_items').catch(e => fail(el, e));
    const row = t.closest('.trow'); if (!row || row.disabled) return;
    const x = items(id).find(y => y.uid === row.dataset.u); if (!x) return;
    const status = x.status === 'completed' ? 'needs_action' : 'completed';
    L.pend[x.uid] = status; settle(L, x, status === 'completed' ? 950 : 380); paint(id);   // Zeile bleibt kurz stehen: Haken und Durchstreichen sind zu sehen, dann gleitet sie
    if (status === 'completed') burst(row);
    else if (!calm(row)) row.querySelector('.tck').animate([{ scale: 1 }, { scale: .8, offset: .35 }, { scale: 1.1, offset: .7 }, { scale: 1 }], { duration: 420, easing: EASE });   // wieder öffnen: Ring wackelt kurz
    svc(id, 'update_item', { item: x.uid, status }).catch(e => { delete L.pend[x.uid]; clearTimeout(L.settle.get(x.uid)?.t); L.settle.delete(x.uid); paint(id); fail(el, e); });   // Erfolg: die nächste Meldung von HA ersetzt den lokalen Stand
  });
  el.querySelector('.tadd').addEventListener('submit', e => {
    e.preventDefault();
    const id = pick(el), L = lists.get(id), text = inp.value.trim(); if (!L || !text) return;
    inp.value = ''; const tmp = { uid: 'neu' + Date.now(), summary: text, status: 'needs_action' }; L.tmp.push(tmp); paint(id);
    const body = el.querySelector('.tbody'), r = body.querySelector(`[data-k="r:${tmp.uid}"]`);   // neue Zeile ins Bild scrollen (nur der Listenbehälter, nicht die Ansichten)
    if (r) { const need = r.offsetTop + r.offsetHeight - body.clientHeight + 12; if (need > body.scrollTop) body.scrollTo({ top: need, behavior: calm(el) ? 'auto' : 'smooth' }); }
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
.tchips{position:absolute;left:5cqw;right:5cqw;top:24.4cqw;display:none;gap:2cqw;overflow-x:auto;scrollbar-width:none;touch-action:pan-x}
.tchips::-webkit-scrollbar{display:none}
.f-todo.multi .tchips{display:flex}
.tchip{flex:none;height:7.4cqw;padding:0 3.4cqw;border-radius:9cqw;font-size:3.5cqw;font-weight:600;color:inherit;background:#ffffff26;white-space:nowrap;transition:background .3s,color .3s}
.tchip.on{background:var(--lc,#ffffffd9);color:#fff}
.tprog{position:absolute;left:7cqw;right:7cqw;top:22.2cqw;height:.9cqw;border-radius:1cqw;background:#ffffff26;overflow:hidden}
.tprog i{display:block;height:100%;width:0;border-radius:inherit;background:var(--lc,#fff);transition:width .7s var(--spring)}
.tbody{position:absolute;left:5cqw;right:5cqw;top:25cqw;bottom:4cqw;display:flex;flex-direction:column;gap:2cqw;overflow-y:auto;scrollbar-width:none;touch-action:pan-y}
.tbody::-webkit-scrollbar{display:none}
.f-todo.multi .tbody{top:33cqw}
.f-todo.adding .tbody{bottom:19cqw}
.trow{position:relative;flex:none;display:flex;align-items:center;gap:3.4cqw;min-height:12.5cqw;padding:2cqw 4cqw;border-radius:4.3cqw;corner-shape:squircle;text-align:left;color:inherit;font-size:4.2cqw;font-weight:500;
  background:var(--glass,linear-gradient(165deg,#ffffff3d,#ffffff29 50%,#ffffff1f));box-shadow:inset 0 0 0 .25cqw #ffffff47;transition:scale .25s}
.trow:active{scale:.97;transition:scale .12s ease-out}
.trow span{flex:1;min-width:0;line-height:1.3;overflow-wrap:anywhere;transition:opacity .45s .1s}
.trow em{font-style:normal;background:linear-gradient(currentColor,currentColor) 0 62%/0 .3cqw no-repeat;-webkit-box-decoration-break:clone;box-decoration-break:clone;transition:background-size .4s ease .12s}
.tck{flex:none;position:relative;width:6.4cqw;height:6.4cqw;border-radius:50%;box-shadow:inset 0 0 0 .5cqw var(--tring,#ffffffb3);transition:box-shadow .3s,scale .2s}
.trow:active .tck{scale:.86}
.tsh{position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(105deg,transparent 38%,#ffffff6b 50%,transparent 62%) 100% 0/250% 100% no-repeat}
.tdot.tpulse{inset:0;width:100%;height:100%;margin:0;background:none;box-shadow:inset 0 0 0 .4cqw var(--tfill,var(--lc,#34c759))}
.tck::before{content:"";position:absolute;inset:0;border-radius:50%;background:var(--tfill,var(--lc,#34c759));scale:0;transition:scale .45s var(--spring)}
.tck svg{position:absolute;inset:0;width:100%;height:100%;fill:none;stroke:var(--tchk,#fff);stroke-width:2.7;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset .3s ease-out}
.tdot{position:absolute;left:50%;top:50%;width:1.2cqw;height:1.2cqw;margin:-.6cqw 0 0 -.6cqw;border-radius:50%;background:var(--tfill,var(--lc,#34c759));pointer-events:none}
.trow.done span{opacity:.5}.trow.done em{background-size:100% .3cqw}
.trow.done .tck{box-shadow:inset 0 0 0 .5cqw var(--tfill,var(--lc,#34c759))}.trow.done .tck::before{scale:1}.trow.done .tck svg{stroke-dashoffset:0;transition-delay:.14s}
.tsep{flex:none;display:flex;align-items:center;justify-content:space-between;padding:2cqw 2cqw 0 3cqw;font-size:3.4cqw;font-weight:600;opacity:.75;text-transform:uppercase;letter-spacing:.06em}
.tsep button{color:inherit;font-size:3.4cqw;font-weight:600;letter-spacing:0;text-transform:none;padding:1.4cqw 3cqw;border-radius:9cqw;background:#ffffff26}
.tbig{display:block;margin:0 auto 3cqw;width:16cqw;height:16cqw;fill:none;stroke:var(--lc,#fff);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;opacity:.85}
.tbig :is(circle,path){stroke-dasharray:1;stroke-dashoffset:1;animation:tdraw 1s ease-out .1s forwards}.tbig path{animation-delay:.55s}
@keyframes tdraw{to{stroke-dashoffset:0}}
.perf .tbig :is(circle,path){stroke-dashoffset:0}
.tnone{position:absolute;left:0;right:0;top:28cqw;text-align:center;opacity:.6;font-size:4cqw}
.tnone small{display:block;margin:1.6cqw 8cqw 0;font-size:3.2cqw;line-height:1.35}
.tadd{position:absolute;left:5cqw;right:5cqw;bottom:4cqw;display:none;gap:2cqw}
.f-todo.adding .tadd{display:flex;animation:evin var(--sd) var(--spring) both}
.tadd input{flex:1;min-width:0;height:11cqw;padding:0 4.5cqw;border:0;border-radius:9cqw;background:#ffffffd9;color:#1c1c1e;font:inherit;font-size:max(16px,4cqw)}
.tadd button{flex:none;width:11cqw;height:11cqw;border-radius:50%;display:grid;place-items:center;background:#007aff;color:#fff;transition:scale .25s}
.tadd button:active{scale:.9;transition:scale .12s ease-out}
.tadd svg{width:5.4cqw;height:5.4cqw;stroke-width:2.4}
</style>`);
