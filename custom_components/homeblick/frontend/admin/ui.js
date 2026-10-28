// Kleine UI-Bausteine des Admins: Symbole, Hinweis-Pille, Alerts, Popover/Menü, Auswahl, Sheets und die kleinen Feinheiten (Segment-Schieber, Regler-Füllung).
import { tx } from '../i18n.js';
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fold = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Doppeltipp auf einen Löschknopf: das zweite Tippen träfe, was gerade an die Stelle gerutscht ist. Gemessen wird die Zeit des Tippens, nicht der Verarbeitung (Ruckler)
let lastRm = -1e9;   // absolute Zeit (ms), damit auch Tipps im Vorschau-Rahmen vergleichbar sind
export const rapidAt = at => { const r = at - lastRm < 500; if (!r) lastRm = at; return r; };
export const rapidTap = e => rapidAt(performance.timeOrigin + e.timeStamp);
// ---- Hinweis: schwarze Pille oben (wie die Dynamic Island), nur eine, ersetzt die alte; 5 s, mit Aktion 8 s ----
let tt;
export function toast(text, o = {}) {
  $('.toast')?.remove(); clearTimeout(tt);
  const el = Object.assign(document.createElement('div'), { className: 'toast' + (o.bad ? ' bad' : ''), role: 'status' });
  el.innerHTML = `<span>${esc(text)}</span>${o.action ? `<button>${esc(o.action)}</button>` : ''}`;
  const off = () => { clearTimeout(tt); el.classList.add('out'); setTimeout(() => el.remove(), 240); };
  const t0 = performance.now();   // Doppeltipp auf „Rückgängig“ träfe sonst gleich das nachfolgende „Wiederholen“
  el.querySelector('button')?.addEventListener('click', e => { if (e.timeStamp - t0 < 350) return; off(); o.run?.(); });
  document.body.append(el); tt = setTimeout(off, o.action ? 8000 : 5000);
}
// Speichern mit Rückmeldung: Fehler als Hinweis, danach wieder werfen
export const guard = (p, ok) => p.then(r => (ok && toast(ok), r), e => (toast(e?.message || tx('Fehler'), { bad: true }), Promise.reject(e)));

// ---- Rückfragen als Alert: erst Abbrechen im Fokus, Escape bricht ab, Klick daneben tut nichts ----
const queue = [];
let busy = false;
function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const { text, o, res } = queue.shift(), prompt = o.value !== undefined;
  const dim = Object.assign(document.createElement('div'), { className: 'dim' });
  const dlg = Object.assign(document.createElement('div'), { className: 'alert', role: 'alertdialog' });
  dlg.innerHTML = `<p>${esc(text)}</p>${prompt ? `<input maxlength="${o.max || 60}" value="${esc(o.value)}">` : ''}${o.alt ? `<div class="acts three"><button class="pri" data-r="alt">${esc(o.alt)}</button><button class="${o.danger ? 'bad' : ''}" data-r="1">${esc(o.ok || tx('OK'))}</button><button data-r="">${tx('Abbrechen')}</button></div>` : `<div class="acts"><button data-r="">${tx('Abbrechen')}</button><button class="${o.danger ? 'bad' : ''}" data-r="1">${esc(o.ok || tx('OK'))}</button></div>`}`;
  const back = document.activeElement, inp = dlg.querySelector('input');
  const done = v => { dim.remove(); dlg.remove(); document.removeEventListener('keydown', key, true); busy = false; back?.focus?.(); res(v); pump(); };
  const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(prompt ? null : false); } else if (e.key === 'Enter' && prompt && e.target === inp) done(inp.value); };
  dlg.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) done(b.dataset.r ? (prompt ? inp.value : b.dataset.r === 'alt' ? 'alt' : true) : (prompt ? null : false)); });   // 'alt' = dritter Knopf (o.alt)
  document.addEventListener('keydown', key, true);
  document.body.append(dim, dlg);
  if (inp) { inp.focus(); inp.select(); } else dlg.querySelector('[data-r=""]').focus();
}
export const ask = (text, o = {}) => new Promise(res => { queue.push({ text, o, res }); pump(); });
export const prompt = (text, value, o = {}) => ask(text, { ...o, value });

// ---- Popover: hängt am Auslöser, schließt bei Klick daneben/Escape ----
let openPop = null;
export function closePop() { if (!openPop) return; const { el, anchor, off } = openPop; openPop = null; el.remove(); anchor?.setAttribute?.('aria-expanded', 'false'); document.removeEventListener('pointerdown', off, true); document.removeEventListener('keydown', off, true); }
export function popover(anchor, html, { cls = '', side = 'bottom', align = 'start', width } = {}) {
  closePop();
  const el = Object.assign(document.createElement('div'), { className: `pop ${cls}`, innerHTML: html });
  document.body.append(el);
  anchor.setAttribute('aria-expanded', 'true');
  const r = anchor.getBoundingClientRect(), pw = width || (cls.includes('same') ? r.width : 0);
  if (pw) el.style.minWidth = el.style.width = pw + 'px';
  const w = el.offsetWidth, h = el.offsetHeight;
  let x = side === 'right' ? r.right + 8 : align === 'end' ? r.right - w : r.left, y = side === 'right' ? r.top : r.bottom + 6, up = false;
  if (y + h > innerHeight - 8) { y = Math.max(8, side === 'right' ? innerHeight - 8 - h : r.top - h - 6); up = side !== 'right'; }
  x = clamp(x, 8, innerWidth - w - 8);
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el.style.setProperty('--ox', clamp(r.left + r.width / 2 - x, 12, w - 12) + 'px'); el.style.setProperty('--oy', up ? '100%' : '0');
  const off = e => { if (e.type === 'keydown') { if (e.key === 'Escape') { e.stopPropagation(); closePop(); anchor.focus?.(); } } else if (!el.contains(e.target) && !anchor.contains(e.target)) closePop(); };
  document.addEventListener('pointerdown', off, true); document.addEventListener('keydown', off, true);
  openPop = { el, anchor, off };
  return el;
}
// Menü: items = [{ label, icon, end, danger, disabled, title, run }] | { group } | '-'
export function menu(anchor, items, o = {}) {
  const acts = [];
  const html = items.map(it => it === '-' ? '<div class="msep"></div>' : it.group ? `<div class="ml">${esc(it.group)}</div>`
    : `<button class="mi ${it.danger ? 'danger' : ''}" data-m="${acts.push(it) - 1}" ${it.disabled ? 'disabled' : ''} ${it.title ? `title="${esc(it.title)}"` : ''}><span class="t">${esc(it.label)}</span>${it.end ? `<span class="end">${esc(it.end)}</span>` : ''}${it.icon && it.icon !== 'blank' ? ic(it.icon) : ''}</button>`).join('');
  const el = popover(anchor, html, { cls: 'menu', align: 'end', ...o });
  el.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; closePop(); acts[+b.dataset.m].run?.(); });
  el.addEventListener('keydown', e => { if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return; const b = [...el.querySelectorAll('.mi:not(:disabled)')], i = b.indexOf(document.activeElement); b[(i + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length]?.focus(); e.preventDefault(); });
  el.querySelector('.mi:not(:disabled)')?.focus();
  return el;
}
// Auswahl wie ein Menü-Picker: options = [[wert, text, hinweis?]] → Promise<wert|undefined>
export function choose(anchor, options, current, { search = false, width } = {}) {
  return new Promise(res => {
    const draw = q => options.filter(([, t]) => !q || fold(t).includes(fold(q))).map(([v, t, s]) => `<button class="mi ${String(v) === String(current) ? 'hi' : ''}" data-v="${esc(v)}"><span class="t">${esc(t)}${s ? `<small>${esc(s)}</small>` : ''}</span>${String(v) === String(current) ? ic('check', 'ok') : ''}</button>`).join('') || `<div class="hint" style="padding:10px 12px">${tx('Nichts gefunden')}</div>`;
    const el = popover(anchor, `${search ? `<input class="pq" placeholder="${tx('Suchen')}" style="margin-bottom:6px">` : ''}<div class="pl">${draw('')}</div>`, { cls: 'same', width: width || Math.max(anchor.getBoundingClientRect().width, 220) });
    const pl = el.querySelector('.pl');
    let done = false;
    const fin = v => { if (done) return; done = true; closePop(); res(v); };
    el.querySelector('.pq')?.addEventListener('input', e => { pl.innerHTML = draw(e.target.value); });
    el.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) fin(options.find(([v]) => String(v) === b.dataset.v)?.[0]); });
    const obs = new MutationObserver(() => { if (!el.isConnected) { obs.disconnect(); fin(undefined); } }); obs.observe(document.body, { childList: true });
    (el.querySelector('.pq') || el.querySelector('.mi.hi') || el.querySelector('.mi'))?.focus();
    el.querySelector('.mi.hi')?.scrollIntoView({ block: 'nearest' });
  });
}

// ---- Sheet mit eigenem Inhalt: Klick auf [data-r] schließt mit diesem Wert, Escape/Klick daneben mit null; init(dlg, done) darf Ereignisse anhängen ----
// Kopf: <div class="sheet-bar"><span class="l"></span><h2>Titel</h2><span class="r"><button data-r="">Fertig</button></span></div>, Inhalt: <div class="sheet-body">
export function modal(html, { cls = '', label = '', init, dismiss = true } = {}) {
  return new Promise(res => {
    const dim = Object.assign(document.createElement('div'), { className: 'dim' });
    const dlg = Object.assign(document.createElement('div'), { className: `sheet ${cls}`, role: 'dialog', ariaLabel: label, innerHTML: `<div class="grabber"></div>${html}` });
    const back = document.activeElement;
    let closing = false;
    const hc = () => done(null);   // Seitenwechsel (Browser-Zurück): Blatt gehört zur alten Seite und schließt mit
    const done = v => { if (closing) return; closing = true; removeEventListener('hashchange', hc); dlg.classList.add('out'); dim.style.transition = 'opacity .24s'; dim.style.opacity = '0'; document.removeEventListener('keydown', key, true); setTimeout(() => { dim.remove(); dlg.remove(); }, 230); back?.focus?.({ preventScroll: true }); res(v); };
    const key = e => { if (e.key === 'Escape' && !$('.pop') && !$('.picker') && !$('.alert')) { e.stopPropagation(); done(null); } };
    dlg.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b && !b.disabled) done(b.dataset.r); });
    if (dismiss) dim.onclick = () => done(null);
    document.addEventListener('keydown', key, true); addEventListener('hashchange', hc);
    document.body.append(dim, dlg);
    init?.(dlg, done);
    if (!matchMedia('(pointer:coarse)').matches) (dlg.querySelector('[autofocus]') || dlg.querySelector('input:not([type=range])'))?.focus({ preventScroll: true });   // am Touchgerät kein Tastatur-Aufklappen
  });
}

// ---- Feinheiten: Segment-Schieber und Regler-Füllung, überall automatisch ----
export function enhance() {
  let raf = 0;
  const run = () => {
    raf = 0;
    for (const s of $$('.seg')) {
      const b = s.querySelector('[aria-pressed=true]');
      if (!b || !b.offsetWidth) { s.classList.remove('ready'); continue; }
      s.style.setProperty('--tx', b.offsetLeft + 'px'); s.style.setProperty('--tw', b.offsetWidth + 'px');
      if (!s.classList.contains('ready')) { s.classList.add('ready'); requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('go'))); }
    }
    for (const r of $$('input[type=range]')) r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min || 1) * 100) + '%');
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(run); };
  new MutationObserver(kick).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'value'] });
  document.addEventListener('input', e => { if (e.target.type === 'range') e.target.style.setProperty('--p', ((e.target.value - e.target.min) / (e.target.max - e.target.min || 1) * 100) + '%'); }, true);
  addEventListener('resize', kick); kick();
}
