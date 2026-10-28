// Bedienelemente als HTML-Bausteine (Schalter, Auswahl, Regler, Entity-Zeile) plus die Verdrahtung per Ereignis-Delegation.
// Jedes Element trägt data-k (Schlüssel); bind(root, handler) ruft handler(key, value, el) bei einer Änderung.
import { tx } from '../i18n.js';
import { choose, esc, ic } from './ui.js';
import { entOf, pickEntity } from './entities.js';

export const sw = (on, k, extra = '') => `<button type="button" class="switch" role="switch" aria-checked="${!!on}" data-k="${esc(k)}" ${extra}></button>`;
export const sroww = (label, hint, control, id = '') => `<div class="srow" ${id ? `data-row="${esc(id)}"` : ''}><span><span class="s-label">${label}</span>${hint ? `<small>${hint}</small>` : ''}</span>${control}</div>`;
const nm = label => `aria-label="${esc(String(label).replace(/<[^>]*>/g, ''))}"`;   // Etikett (kann Markup enthalten) als zugänglicher Name
export const switchRow = (label, k, on, hint, id) => sroww(label, hint, sw(on, k, nm(label)), id);
export const sliderRow = (label, k, lo, hi, step, v, hint, unit = ' %', id) => sroww(label, hint, `<span class="slider" data-unit="${esc(unit)}"><input type="range" ${nm(label)} data-k="${k}" min="${lo}" max="${hi}" step="${step}" value="${v}"><output>${v}${unit}</output></span>`, id);
export const numberRow = (label, k, v, { min, max, step = 1, unit = '' } = {}, hint, id) => sroww(label, hint, `<span class="stepper"><output data-min="${min}" data-max="${max}" data-stp="${step}" data-unit="${esc(unit)}">${v}${unit}</output><span class="pm"><button type="button" data-step="-1" data-k="${k}" aria-label="${tx('Weniger')}">${ic('minus')}</button><button type="button" data-step="1" data-k="${k}" aria-label="${tx('Mehr')}">${ic('plus')}</button></span></span>`, id);
export const timeRow = (label, k, v, hint, id) => sroww(label, hint, `<input type="time" data-k="${k}" value="${esc(String(v || '').slice(0, 5))}">`, id);
export const textRow = (label, k, v, { ph = '', max = 80, type = 'text' } = {}, hint, id) => sroww(label, hint, `<input type="${type}" data-k="${k}" value="${esc(v)}" placeholder="${esc(ph)}" maxlength="${max}" autocomplete="off" autocapitalize="off" spellcheck="false">`, id);
export const segRow = (label, k, list, v, hint, id) => sroww(label, hint, `<span class="seg">${list.map(([a, n]) => `<button type="button" data-k="${k}" data-v="${esc(a)}" aria-pressed="${String(a) === String(v)}">${esc(n)}</button>`).join('')}</span>`, id);
// Auswahl als Popover; list = [[wert, text, hinweis?]]
export const selectRow = (label, k, list, v, hint, id, search = false) => sroww(label, hint, selectBtn(k, list, v, search), id);
export const selectBtn = (k, list, v, search = false) => `<button type="button" class="choice" data-k="${esc(k)}" data-choose="${search ? 's' : ''}" aria-haspopup="listbox"><span>${esc(list.find(x => String(x[0]) === String(v))?.[1] ?? v ?? '')}</span>${ic('chev-ud')}</button>`;
// Entity-Zeile: öffnet den Auswahl-Dialog; opts = pickEntity-Optionen (domains, dcs, none, title)
export const entityRow = (label, k, v, opts, hint, id) => sroww(label, hint, entityBtn(k, v, opts, opts.none), id);
export const entityBtn = (k, v, opts, none = tx('Wählen …')) => { const e = entOf(v); return `<button type="button" class="choice" data-k="${esc(k)}" data-ep='${esc(JSON.stringify(opts))}' ><span class="${v && !e ? 'bad' : ''}">${esc(e?.name || v || none)}</span>${ic('right')}</button>`; };

/** Verdrahtet Änderungen in root. get(k) liefert die aktuelle Liste für Popover-Auswahlen, on(k, wert, el) bekommt jede Änderung. */
export function bind(root, { on, listOf = () => [], valueOf = () => '' }) {
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-k]');
    if (!b || !root.contains(b)) return;
    const k = b.dataset.k;
    if (b.classList.contains('switch')) { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', v); return on(k, v, b); }
    if (b.dataset.step) {
      const o = b.closest('.stepper').querySelector('output'), lo = +o.dataset.min, hi = +o.dataset.max, st = +o.dataset.stp, cur = parseFloat(o.textContent);
      const v = Math.min(hi, Math.max(lo, +(cur + st * +b.dataset.step).toFixed(6)));
      o.textContent = v + (o.dataset.unit || ''); return on(k, v, b);
    }
    if (b.dataset.v !== undefined && b.closest('.seg,.size-pick,.swatches')) {
      b.closest('.seg,.size-pick,.swatches').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      return on(k, b.dataset.v, b);
    }
    if (b.dataset.choose !== undefined) {
      const list = listOf(k, b), v = await choose(b, list, valueOf(k, b), { search: b.dataset.choose === 's' });
      if (v === undefined) return;
      b.querySelector('span').textContent = list.find(x => String(x[0]) === String(v))?.[1] ?? v;
      return on(k, v, b);
    }
    if (b.dataset.ep) {
      const o = JSON.parse(b.dataset.ep), en = await pickEntity({ ...o, current: valueOf(k, b) });
      if (!en) return;
      b.querySelector('span').textContent = en.name || o.none || tx('Wählen …');
      return on(k, en.id, b, en);
    }
  });
  root.addEventListener('input', e => {
    const t = e.target;
    if (!t.dataset?.k) return;
    if (t.type === 'range') { t.closest('.slider').querySelector('output').textContent = t.value + (t.closest('.slider').dataset.unit ?? ' %'); on(t.dataset.k, +t.value, t, null, 'input'); }
    else if (t.type === 'text' || t.type === 'search' || t.type === 'url') on(t.dataset.k, t.value, t, null, 'input');
  });
  root.addEventListener('change', e => {
    const t = e.target;
    if (!t.dataset?.k) return;
    if (t.type === 'time') { if (!t.value) { t.value = t.defaultValue; return; } t.defaultValue = t.value; on(t.dataset.k, t.value + ':00', t); }   // geleertes Feld: alter Wert bleibt (Server lehnt ':00' ab)
    else if (t.type === 'range') on(t.dataset.k, +t.value, t, null, 'change');
    else if (t.type === 'text' || t.type === 'search' || t.type === 'url') on(t.dataset.k, t.value, t, null, 'change');
    else if (t.type === 'number') on(t.dataset.k, +t.value, t);
    else if (t.type === 'checkbox') on(t.dataset.k, t.checked, t);
  });
}
