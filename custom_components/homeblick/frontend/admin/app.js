// Homeblick-Admin: Gerüst (Adresse, Tab-Leiste, Übersicht). Die Ansichten liegen in screen.js und panels.js.
import { tx } from '../i18n.js';
import { $, ask, enhance, esc, ic, toast } from './ui.js';
import { S, call, dirty, discard, closeDoc, emit, on, reload, save, start } from './state.js';
import { ago, issues, ledOf } from './util.js';
import { openPalette } from './palette.js';
import * as screen from './screen.js';
import * as panels from './panels.js';
import { collapse, gbtn, page } from './nav.js';

// ---- Adresse: #/ · #/d/<id>[/settings[/<abschnitt>]] · #/new[/<id>] · #/settings · #/alerts ----
export function parse(h = location.hash) {
  const [a, b, c, d] = h.replace(/^#\/?/, '').split('/').map(s => { try { return decodeURIComponent(s); } catch { return s; } });   // kaputter %-Code (von Hand getippt) darf die Seite nicht kippen
  if (a === 'd' && b) return { name: 'screen', id: b, tab: c === 'settings' ? 'settings' : 'layout', section: d || '' };
  if (a === 'new') return { name: 'new', id: b || '' };
  if (a === 'settings' || a === 'alerts') return { name: a };
  return { name: 'home' };
}
export const href = r => r.name === 'home' ? '#/' : r.name === 'screen' ? `#/d/${encodeURIComponent(r.id)}${r.tab === 'settings' ? '/settings' + (r.section ? '/' + r.section : '') : ''}` : r.name === 'new' ? `#/new${r.id ? '/' + encodeURIComponent(r.id) : ''}` : `#/${r.name}`;
let route = parse(), lastHash = location.hash, unmount = null;
const leaves = next => route.name === 'screen' && (next.name !== 'screen' || next.id !== route.id);
// Link-Klick: ungesendete Änderungen VOR dem Wechsel klären, sonst bliebe nach „Abbrechen“ ein doppelter Verlaufseintrag (Zurück/Vor klärt doNavigate nachträglich)
export const go = async r => { const h = typeof r === 'string' ? r : href(r); if (location.hash === h) return navigate(); if (dirty() && leaves(parse(h)) && !(await settle())) return; location.hash = h; };
export const here = () => route;

// ---- Gerüst: Ansicht + schwebende Tab-Leiste ----
const app = $('#app');
app.innerHTML = `<main class="view" id="main"></main><nav class="tabbar" id="tabbar" aria-label="${tx('Bereiche')}"></nav>`;
const TABS = [['home', '#/', 'monitor', tx('Displays')], ['alerts', '#/alerts', 'bell', tx('Mitteilungen')], ['settings', '#/settings', 'cog', tx('Einstellungen')]];
function renderTabs() {
  const on_ = ['new', 'screen'].includes(route.name) ? 'home' : route.name;
  $('#tabbar').innerHTML = TABS.map(([k, h, i, n]) => `<button class="tab" data-goto="${h}" ${k === on_ ? 'aria-current="page"' : ''}>${ic(i)}<span>${n}</span></button>`).join('');
}
app.addEventListener('click', e => {
  const g = e.target.closest('[data-goto],[data-go]');
  if (g) { e.preventDefault(); return go(g.dataset.goto || g.dataset.go); }
  if (e.target.closest('#open-palette')) return openPalette();
  const c = e.target.closest('[data-copy]'); if (c) return panels.copy(c.dataset.copy, tx('Adresse'));
});

// ---- Übersicht ----
const LIVE = new URL('index.html?live', location.href).href;   // Adresse des Displays (Tablet-Browser, auch ohne HA-Seitenleiste)
function home(el) {
  let last = '';
  const seen = new Set(S.displays.map(d => d.id)), first = !S.displays.some(d => !d.new);   // noch nichts eingerichtet: Willkommen; meldet sich jetzt ein Display, geht es direkt in die Einrichtung
  const draw = () => {
    const list = S.displays.filter(d => !d.new), fresh = S.displays.filter(d => d.new), on_ = list.filter(d => d.connected).length;
    const found = first && fresh.find(d => !seen.has(d.id));
    if (found) { toast(tx('„{name}“ hat sich gemeldet', { name: found.name })); return go({ name: 'new', id: found.id }); }
    const card = d => {
      const w = issues(d)[0], sub = w ? w : [[d.area, d.connected ? tx('Online') : tx('Offline · {t}', { t: ago(d.seen) })].filter(Boolean).join(' · '), ''];
      return `<button class="home-card ${d.connected ? '' : 'off'}" data-goto="${esc(href({ name: 'screen', id: d.id, tab: 'layout' }))}"><span class="home-shot">${S.shots[d.id] ? `<img src="${esc(S.shots[d.id])}" alt="">` : `<span class="none">${ic('layout')}<span>${tx('Noch kein Bild')}</span></span>`}</span><span class="home-meta"><strong>${esc(d.name)}</strong><small class="${sub[1] === 'down' ? 'd' : sub[1] ? 'w' : ''}"><i class="led ${ledOf(d)}"></i>${esc(sub[0])}</small></span></button>`;
    };
    const newCard = d => `<button class="home-card fresh" data-goto="${esc(href({ name: 'new', id: d.id }))}"><span class="home-shot">${ic('plus')}</span><span class="home-meta"><strong>${esc(d.name)}</strong><small>${d.connected ? tx('Wartet auf die Einrichtung') : tx('Nicht verbunden')}</small></span></button>`;
    const sc = $('.scroller', el)?.scrollTop || 0;
    if (!list.length) {
      const w = page({ title: tx('Displays'), sub: tx('Willkommen bei Homeblick') }, `<div class="empty" style="padding-bottom:8px"><div class="ico48">${ic('monitor')}</div><h2>${tx('Dein erstes Display')}</h2><p>${tx('Das Wandpanel für Home Assistant steht in drei Schritten.')}</p></div>
        <div class="sect"><div class="group"><ol class="steps"><li><b>${tx('Display öffnen.')}</b> ${tx('Auf dem Tablet: Seitenleiste → Homeblick, oder diese Adresse im Browser (mit https, sonst gibt es kein Mikrofon):')}<br><code>${esc(LIVE)}</code></li><li><b>${tx('Einrichten.')}</b> ${tx('Name, Bereich und Vorlage wählen. „Standard“ bringt alle wichtigen Ansichten mit.')}</li><li><b>${tx('Feinschliff.')}</b> ${tx('Kacheln und Ansichten im Editor anordnen, dann ist es fertig.')}</li></ol></div></div>
        ${fresh.length ? `<div class="home-grid">${fresh.map(newCard).join('')}</div>` : `<p class="hint" style="display:flex;align-items:center;justify-content:center;gap:8px;margin:6px 0 14px"><span class="spin small"></span>${tx('Warte auf das erste Display …')}</p>`}
        <div class="actions"><a class="btn big" href="${esc(LIVE)}" target="_blank" rel="noopener">${ic('monitor')}${tx('Hier öffnen')}</a><button class="btn quiet big" data-copy="${esc(LIVE)}">${ic('copy')}${tx('Adresse kopieren')}</button></div>`);
      if (w === last) return;   // alle 5 s kommt 'list': unverändert lassen, sonst springt der Spinner und die Markierung der Adresse geht verloren
      last = w; el.innerHTML = w; return collapse(el);
    }
    last = '';
    el.innerHTML = page({ title: tx('Displays'), right: gbtn('data-goto="#/new"', 'plus', tx('Neues Display')), sub: tx('{on} von {total} online', { on: on_, total: list.length }) },
      `<button class="search-pill" id="open-palette">${ic('search')}<span>${tx('Suchen')}</span><kbd>⌘K</kbd></button>
       <div class="home-grid">${fresh.map(newCard).join('')}${list.map(card).join('')}<button class="home-card home-new" data-goto="#/new"><span class="home-shot">${ic('plus')}</span><span class="home-meta"><strong>${tx('Neues Display')}</strong><small>${tx('Name, Bereich und Vorlage wählen')}</small></span></button></div>`);
    collapse(el); const s = $('.scroller', el); if (s) { s.style.scrollBehavior = 'auto'; s.scrollTop = sc; s.style.scrollBehavior = ''; }
  };
  draw();
  const off = on('list', draw);
  return () => off();
}

// ---- Wechsel der Ansicht ----
const VIEWS = { home, screen: screen.mount, settings: panels.settings, alerts: panels.alerts, new: panels.newDisplay };
// Wechsel laufen nacheinander: ein zweiter Hash-Wechsel mitten im await der ersten Ansicht ließe sonst deren Abbau und Listener verwaisen
let queue = Promise.resolve();
const navigate = () => (queue = queue.catch(() => {}).then(doNavigate));
// Zurück/Vor: Eintrag behalten und den Bildschirm neu davor setzen; Link-Klick (nur ohne go): den neuen Eintrag ersetzen
const stay = () => history[history.state?.hb ? 'pushState' : 'replaceState']({ hb: 1 }, '', lastHash || '#/');
// Ungesendeten Entwurf klären: true = weiter (gesendet oder verworfen), false = bleiben
async function settle() {
  if (!dirty()) return true;
  const online = S.displays.find(d => d.id === S.sel)?.connected;
  const r = await ask(tx('Es gibt Änderungen, die noch nicht an das Display gesendet sind.'), { ok: tx('Verwerfen'), danger: true, alt: tx('Senden') });
  if (!r) return false;
  if (r === 'alt') { const sent = await save(); if (dirty()) return false; if (sent) toast(online ? tx('Gesendet. Dein Display wird aktualisiert.') : tx('Gespeichert. Das Display übernimmt es beim nächsten Öffnen.')); }   // Senden fehlgeschlagen: bleiben, guard zeigt den Fehler
  else discard();
  return true;
}
async function doNavigate() {
  const next = parse(), leaving = leaves(next);
  if (leaving && !(await settle())) return stay();
  unmount?.(); unmount = null;   // erst die Ansicht abbauen, dann den Entwurf schließen (sonst zeichnet sie auf leerem Stand)
  if (leaving) closeDoc();
  lastHash = location.hash; route = next;
  history.replaceState({ hb: 1 }, '', location.hash);   // Eintrag als besucht markieren (stay)
  try { sessionStorage.setItem('hb-admin.route', location.hash); } catch { /* Speicher gesperrt */ }
  try { const o = window.top; if (o && o !== window && o.location.origin === location.origin) o.history.replaceState(o.history.state, '', `${o.location.pathname}${o.location.search}${location.hash}`); } catch { /* fremdes Fenster */ }
  app.dataset.view = next.name; renderTabs();
  const old = $('#main'), main = old.cloneNode(false); old.replaceWith(main);   // frisches Element: Listener der letzten Ansicht (click/input/change auf #main) fallen mit weg
  main.classList.remove('view-in'); void main.offsetWidth; main.classList.add('view-in');
  unmount = (await VIEWS[next.name](main, next)) || null;
  if (next.name !== 'home') queueMicrotask(() => collapse(main));
}
// Display von außen entfernt (anderer Admin, Dienst): Editor/Einstellungen eines toten Displays verlassen
on('list', () => {
  if (route.name !== 'screen' || S.sel !== route.id || S.displays.some(d => d.id === route.id && !d.new)) return;
  S.cfg = null; S.saved = ''; toast(tx('Dieses Display gibt es nicht (mehr)'), { bad: true }); location.hash = '#/';
});
addEventListener('hashchange', navigate);
addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !$('.alert')) { e.preventDefault(); openPalette(); } });
enhance();

// ---- Start ----
fetch('index.html').then(r => r.text()).then(h => {   // Symbole der Kachel-Icons liegen nur in index.html (eine Quelle): als #x-<name> einhängen
  const syms = [...new DOMParser().parseFromString(h, 'text/html').querySelectorAll('symbol')];
  document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${syms.map(x => x.outerHTML.replace('id="', 'id="x-')).join('')}</svg>`);
  emit('icons');
}).catch(() => {});
try {
  await start();
  if (location.hash.length < 3) { try { const k = sessionStorage.getItem('hb-admin.route') || (window.top !== window && window.top.location.hash); if (k && k.startsWith('#/')) history.replaceState(null, '', k); } catch { /* nichts gemerkt */ } }
  await navigate();
} catch (e) {
  $('#main').innerHTML = `<div class="empty" style="padding-top:20vh"><div class="ico48">${ic('wifi-off')}</div><h2>${tx('Keine Verbindung zu Home Assistant')}</h2><p>${esc(e?.message || e)}<br>${tx('Die Seite braucht ein Administrator-Konto.')}</p></div>`;
}
