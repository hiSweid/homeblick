// ⌘K: Displays, Seiten, Einstellungen und Aktionen suchen; im Layout auch Entities hinzufügen.
import { $, esc, fold, ic } from './ui.js';
import { S, dirty, redo, select, undo } from './state.js';
import { INDEX, spot } from './settings.js';
import { faceName } from './meta.js';
import { TILE_DOM } from './meta.js';
import { findEnts, avatar } from './entities.js';
import { addEntity } from './edit.js';
import { addPageFlow, openPreview } from './layout.js';

export function openPalette() {
  if ($('.palette-bg')) return;
  const here = location.hash.replace(/^#\/?/, '').split('/'), onScreen = here[0] === 'd' && S.cfg && S.sel, layout = onScreen && here[2] !== 'settings';
  const go = h => () => { location.hash = h; };
  const all = [];
  const add = (group, label, icon, run, sub = '') => all.push({ group, label, icon, run, sub, k: fold(label + ' ' + sub) });
  for (const d of S.displays.filter(x => !x.new)) add('Displays', d.name, 'monitor', go(`#/d/${encodeURIComponent(d.id)}`), d.area || '');
  if (onScreen) {
    S.cfg.faces.forEach((f, i) => add('Seiten', faceName(f), 'layout', () => { if (!layout) location.hash = `#/d/${encodeURIComponent(S.sel)}`; setTimeout(() => select({ k: 'page', f: f.id }), 60); }, `Seite ${i + 1}`));
    for (const [k, n] of INDEX) add('Einstellungen', n, 'sliders', () => { spot.key = k; const h = `#/d/${encodeURIComponent(S.sel)}/settings`; if (location.hash === h) { location.hash = '#/'; setTimeout(() => (location.hash = h), 0); } else location.hash = h; }, 'Einstellung');
    if (layout) { add('Aktionen', 'Seite hinzufügen', 'page-add', addPageFlow); add('Aktionen', 'Vorschau', 'play', () => openPreview(0)); add('Aktionen', 'Rückgängig', 'undo', undo); add('Aktionen', 'Wiederholen', 'redo', redo); }
  }
  add('Aktionen', 'Neues Display einrichten', 'plus', go('#/new')); add('Aktionen', 'Einstellungen: Kameras und Türklingel', 'cog', go('#/settings')); add('Aktionen', 'Benachrichtigungen', 'bell', go('#/alerts'));
  const bg = Object.assign(document.createElement('div'), { className: 'palette-bg', innerHTML: `<div class="palette" role="dialog" aria-label="Suchen"><input type="search" placeholder="Display, Seite, Einstellung oder Entity suchen …" autocomplete="off" spellcheck="false" aria-label="Suchen"><div class="list" role="listbox"></div><div class="foot"><span>↑↓ wählen</span><span>↵ öffnen</span><span>esc schließen</span></div></div>` });
  const q = $('input', bg), list = $('.list', bg);
  let items = [], hi = 0;
  const draw = () => {
    const w = fold(q.value).split(/\s+/).filter(Boolean);
    let hits = all.filter(x => w.every(t => x.k.includes(t))).slice(0, w.length ? 30 : 12);
    if (layout && q.value.trim().length >= 2) hits = hits.concat(findEnts(q.value, TILE_DOM).slice(0, 8).map(e => ({ group: 'Entity hinzufügen', label: e.name, icon: null, ent: e, sub: e.area || e.id, run: () => addEntity(e) })));
    items = hits; hi = Math.min(hi, Math.max(items.length - 1, 0));
    let last = '';
    list.innerHTML = items.map((x, i) => `${x.group !== last ? `<div class="grp">${esc(last = x.group)}</div>` : ''}<div class="pitem ${i === hi ? 'hi' : ''}" role="option" data-i="${i}">${x.ent ? avatar(x.ent.domain) : ic(x.icon)}<span class="t"><span>${esc(x.label)}</span></span>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</div>`).join('') || '<div class="hint" style="padding:18px;text-align:center">Nichts gefunden</div>';
    $('.hi', list)?.scrollIntoView({ block: 'nearest' });
  };
  const close = () => { bg.remove(); document.removeEventListener('keydown', key, true); };
  const run = i => { const x = items[i]; if (!x) return; close(); x.run(); };
  const key = e => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hi = (hi + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(items.length, 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(hi); }
  };
  q.addEventListener('input', () => { hi = 0; draw(); });
  bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
  list.addEventListener('click', e => { const p = e.target.closest('[data-i]'); if (p) run(+p.dataset.i); });
  list.addEventListener('mousemove', e => { const p = e.target.closest('[data-i]'); if (p && +p.dataset.i !== hi) { hi = +p.dataset.i; list.querySelectorAll('.pitem').forEach((x, i) => x.classList.toggle('hi', i === hi)); } });
  document.addEventListener('keydown', key, true);
  document.body.append(bg); draw(); q.focus();
}
