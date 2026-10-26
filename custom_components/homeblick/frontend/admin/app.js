// Homeblick-Admin: Gerüst (Seitenleiste, Adresse, Übersicht). Die Ansichten liegen in screen.js und panels.js.
import { $, $$, esc, ic, toast, ask } from './ui.js';
import { S, byId, call, dirty, discard, closeDoc, emit, on, reload, start } from './state.js';
import { ago, issues, ledOf } from './util.js';
import { openPalette } from './palette.js';
import * as screen from './screen.js';
import * as panels from './panels.js';
import { isPhone, mq, openSide, sideIsOpen } from './shell.js';

// ---- Adresse: #/ · #/d/<id>[/settings] · #/new[/<id>] · #/settings · #/alerts ----
export function parse() {
  const [a, b, c] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if (a === 'd' && b) return { name: 'screen', id: b, tab: c === 'settings' ? 'settings' : 'layout' };
  if (a === 'new') return { name: 'new', id: b || '' };
  if (a === 'settings' || a === 'alerts') return { name: a };
  return { name: 'home' };
}
export const href = r => r.name === 'home' ? '#/' : r.name === 'screen' ? `#/d/${encodeURIComponent(r.id)}${r.tab === 'settings' ? '/settings' : ''}` : r.name === 'new' ? `#/new${r.id ? '/' + encodeURIComponent(r.id) : ''}` : `#/${r.name}`;
export const go = r => { const h = typeof r === 'string' ? r : href(r); if (location.hash === h) navigate(); else location.hash = h; };
let route = parse(), lastHash = location.hash, unmount = null;
export const here = () => route;

// ---- Phone: Seitenleiste als Blatt von links ----
const app = $('#app');
app.innerHTML = `<aside class="side" id="side"></aside><div class="side-dim" id="side-dim" hidden></div><main class="main"><div class="mbar"><button class="icon-btn" id="mbar-burger" aria-label="Menü">${ic('menu')}</button><span>Homeblick</span></div><div class="stage" id="main"></div></main>`;
$('#side-dim').onclick = () => openSide(false);
$('#mbar-burger').onclick = () => openSide(true);
mq.addEventListener('change', () => { openSide(false); renderSide(true); emit('phone'); });

// ---- Seitenleiste ----
const FOLD = 'hb-admin.folded';
let folded = false; try { folded = localStorage.getItem(FOLD) === '1'; } catch { /* Speicher gesperrt */ }
function setFold(v) { folded = v; app.classList.toggle('folded', v && !isPhone()); try { localStorage.setItem(FOLD, v ? '1' : '0'); } catch { /* Speicher gesperrt */ } }
let lastSide = '';
export function renderSide(force) {
  const list = S.displays.filter(d => !d.new), fresh = S.displays.filter(d => d.new), on_ = route;
  const item = d => {
    const w = issues(d)[0], here_ = on_.name === 'screen' && on_.id === d.id;
    return `<button class="nav-item" data-go="${esc(href({ name: 'screen', id: d.id, tab: 'layout' }))}" ${here_ ? 'aria-current="true"' : ''} title="${esc(d.name)}">${ic('monitor')}<span class="name">${esc(d.name)}</span>${here_ && dirty() ? '<i class="pend" title="Nicht gesendet"></i>' : ''}${w && w[1] === 'down' ? '<small>offline</small>' : w ? '<small class="warn">!</small>' : ''}</button>`;
  };
  const html = `<div class="side-top"><button class="brand" data-go="#/" ${on_.name === 'home' ? 'aria-current="page"' : ''} title="Alle Displays"><img class="mark" src="icon.svg" alt=""><span class="txt">Homeblick</span></button><button class="icon-btn" id="fold" aria-label="${folded ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}" aria-pressed="${folded}">${ic('dock')}</button></div>
    <button class="search-btn" id="open-palette">${ic('search')}<span class="txt">Suchen</span><kbd>⌘K</kbd></button>
    <div class="side-label"><span>Displays</span><span><button class="icon-btn" id="refresh" aria-label="Aktualisieren">${ic('refresh')}</button><button class="icon-btn" data-go="#/new" aria-label="Neues Display" ${on_.name === 'new' ? 'aria-current="true"' : ''}>${ic('plus')}</button></span></div>
    <div class="nav-list" id="screens">${list.map(item).join('')}${fresh.map(d => `<button class="nav-item" data-go="#/new/${encodeURIComponent(d.id)}" title="${esc(d.name)} einrichten">${ic('plus')}<span class="name">${esc(d.name)}</span><small class="warn">neu</small></button>`).join('')}</div>
    <div class="spacer"></div>
    <div class="side-more"><button class="nav-item" data-go="#/alerts" ${on_.name === 'alerts' ? 'aria-current="true"' : ''}>${ic('bell')}<span class="txt name">Benachrichtigungen</span></button><button class="nav-item" data-go="#/settings" ${on_.name === 'settings' ? 'aria-current="true"' : ''}>${ic('cog')}<span class="txt name">Einstellungen</span></button></div>`;
  if (html === lastSide && !force) return;
  lastSide = html; $('#side').innerHTML = html;
  app.classList.toggle('folded', folded && !isPhone());
}
$('#side').addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) { openSide(false); return go(g.dataset.go); }
  if (e.target.closest('#fold')) { setFold(!folded); return renderSide(true); }
  if (e.target.closest('#open-palette')) { openSide(false); return openPalette(); }
  if (e.target.closest('#refresh')) { reload(); toast('Aktualisiert'); }
});
on('list', () => renderSide());
on('doc', () => { const p = $('#side [aria-current=true] .pend'), want = route.name === 'screen' && dirty(); if (!!p !== want) renderSide(true); });

// ---- Übersicht ----
function home(el) {
  const draw = () => {
    const list = S.displays.filter(d => !d.new), fresh = S.displays.filter(d => d.new), on_ = list.filter(d => d.connected).length;
    const card = d => {
      const w = issues(d)[0], sub = w ? [w[0], w[1]] : [[d.area, d.connected ? 'Online' : `Offline · ${ago(d.seen)}`].filter(Boolean).join(' · '), ''];
      return `<button class="home-card ${d.connected ? '' : 'off'}" data-go="${esc(href({ name: 'screen', id: d.id, tab: 'layout' }))}"><div class="home-stage">${S.shots[d.id] ? `<img src="${S.shots[d.id]}" alt="">` : `<div class="none">${ic('layout')}<span>Noch kein Bild</span></div>`}</div><div class="home-foot"><span class="led ${ledOf(d)}"></span><span class="t"><strong>${esc(d.name)}</strong><small class="${sub[1] === 'down' ? 'd' : sub[1] ? 'w' : ''}">${esc(sub[0])}</small></span>${ic('right')}</div></button>`;
    };
    const newCard = d => `<button class="home-card fresh" data-go="${esc(href({ name: 'new', id: d.id }))}"><div class="home-foot"><span class="led ${d.connected ? 'update' : 'down'}"></span><span class="t"><strong>${esc(d.name)}</strong><small>${d.connected ? 'Wartet auf die Einrichtung' : 'Nicht verbunden'}</small></span><span class="chip update">Einrichten</span></div></button>`;
    el.innerHTML = `<section class="home"><div class="home-head"><h1>Deine Displays</h1><p>${list.length ? `${on_} von ${list.length} online` : 'Noch kein Display eingerichtet'}</p></div>
      <div class="home-grid">${fresh.map(newCard).join('')}${list.map(card).join('')}<button class="home-new" data-go="#/new">${ic('plus')}Neues Display</button></div></section>`;
  };
  draw();
  const off = on('list', draw);
  el.onclick = e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); };
  return () => { off(); el.onclick = null; };
}

// ---- Wechsel der Ansicht ----
const VIEWS = { home, screen: screen.mount, settings: panels.settings, alerts: panels.alerts, new: panels.newDisplay };
async function navigate() {
  const next = parse(), leaving = route.name === 'screen' && (next.name !== 'screen' || next.id !== route.id);
  if (leaving && dirty()) {
    if (!await ask('Es gibt Änderungen, die noch nicht an das Display gesendet sind. Verwerfen?', { ok: 'Verwerfen und öffnen', danger: true })) { history.replaceState(null, '', lastHash || '#/'); return; }
    discard();
  }
  unmount?.(); unmount = null;   // erst die Ansicht abbauen, dann den Entwurf schließen (sonst zeichnet sie auf leerem Stand)
  if (leaving) closeDoc();
  lastHash = location.hash; route = next;
  try { sessionStorage.setItem('hb-admin.route', location.hash); } catch { /* Speicher gesperrt */ }
  try { const o = window.top; if (o && o !== window && o.location.origin === location.origin) o.history.replaceState(o.history.state, '', `${o.location.pathname}${o.location.search}${location.hash}`); } catch { /* fremdes Fenster */ }
  renderSide(true); app.dataset.view = next.name;
  const main = $('#main'); main.innerHTML = ''; main.scrollTop = 0;
  unmount = (await VIEWS[next.name](main, next)) || null;
}
addEventListener('hashchange', navigate);
addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !$('.dialog')) { e.preventDefault(); openPalette(); } else if (e.key === 'Escape' && sideIsOpen()) openSide(false); });

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
  $('#main').innerHTML = `<div class="empty"><div class="ico48">${ic('wifi-off')}</div><h2>Keine Verbindung zu Home Assistant</h2><p>${esc(e?.message || e)}<br>Die Seite braucht ein Administrator-Konto.</p></div>`;
}
