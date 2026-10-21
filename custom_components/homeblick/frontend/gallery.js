// Widget-Galerie nach dem Vorbild der iOS-Widgets (ref/vorlagen/EV-zxZWwts0): Kategorien suchen → Seite der Kategorie mit Größen zum Wischen → farbiger Knopf „Widget hinzufügen“.
// Läuft nur in admin.html (Symbole #i-* und CSS .pk*/.gal* stehen dort).
import { entsFor, entsIn, findEnts, pickEntity } from './entpicker.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fold = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Karussell auch mit der Maus bedienbar: Ziehen, Mausrad (senkrecht → waagerecht); danach rastet es auf die nächste Karte ein
export function swipable(el) {
  let d = null;
  const snap = () => { const c = [...el.children].filter(x => x.offsetWidth), mid = x => x.offsetLeft + x.offsetWidth / 2 - el.scrollLeft - el.clientWidth / 2, n = c.reduce((b, x) => Math.abs(mid(x)) < Math.abs(mid(b)) ? x : b, c[0]); n && el.scrollTo({ left: n.offsetLeft + n.offsetWidth / 2 - el.clientWidth / 2, behavior: 'smooth' }); };
  el.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch' && e.button === 0) d = { x: e.clientX, s: el.scrollLeft, id: e.pointerId, on: false }; });
  el.addEventListener('pointermove', e => {
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.on && Math.abs(dx) > 5) { d.on = true; el.style.scrollSnapType = 'none'; el.setPointerCapture(d.id); }
    if (d.on) el.scrollLeft = d.s - dx;
  });
  const end = () => { if (!d) return; const on = d.on; d = null; if (on) { el._drag = true; setTimeout(() => el._drag = false); el.style.scrollSnapType = ''; snap(); } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('click', e => { if (el._drag) { e.stopPropagation(); e.preventDefault(); } }, true);   // Ziehen ist kein Tippen auf eine Karte
  el.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); el.scrollBy({ left: e.deltaY * 2, behavior: 'smooth' }); } }, { passive: false });
}

export const CATS = [   // k, Name, Domains (ohne = keine Entity nötig), Farbe, Symbol
  ['light', 'Licht', ['light'], '#ff9f0a', 'bulb'], ['climate', 'Thermostat', ['climate'], '#ff6b35', 'thermo'], ['cover', 'Rollos & Tore', ['cover'], '#5e5ce6', 'cover'],
  ['lock', 'Schlösser', ['lock'], '#34c759', 'lock'], ['scene', 'Szenen & Skripte', ['scene', 'script'], '#ff9500', 'sun'], ['switch', 'Schalter', ['switch', 'input_boolean', 'button', 'input_button'], '#8e8e93', 'switch'],
  ['media', 'Medien', ['media_player'], '#ff2d55', 'play'], ['fan', 'Ventilatoren', ['fan'], '#30b0c7', 'fan'], ['camera', 'Kameras', ['camera'], '#5856d6', 'cam'],
  ['sensor', 'Sensoren', ['sensor', 'binary_sensor'], '#007aff', 'pulse'], ['timer', 'Timer', ['timer'], '#ff9f0a', 'timer'],
  ['analog', 'Analoguhr', null, '#636366', 'clock'], ['digital', 'Digitaluhr', null, '#636366', 'clock'], ['wx', 'Wetter', null, '#32ade6', 'sun'],
].map(([k, n, d, c, i]) => ({ k, n, d, c, i }));
const SZ = [[1, 1], [2, 1], [2, 2]];   // wie in der Kachel-Seite
const U = 92;   // Kantenlänge einer Zelle in der Vorschau (px)
const ico = (c, i) => `<span class="ico" style="background:${c.c}"><svg><use href="#i-${i || c.i}"/></svg></span>`;

// used: Entity-IDs, die auf dem Face schon liegen (die Vorauswahl nimmt die erste andere)
// area: Bereich des Displays → oben „Vorschläge für <Bereich>“ (Geräte des Raums, ein Tipp fügt sie als 1×1 hinzu)
// → { cat, en, size: [w, h] } oder null
export function pickWidget({ used = [], area = '' } = {}) {
  return new Promise(res => {
    const o = Object.assign(document.createElement('div'), { id: 'ov', className: 'pkov', innerHTML: '<div class="pk gal" role="dialog" aria-label="Widget hinzufügen"></div>' });
    const box = o.firstElementChild, done = v => { o.classList.remove('in'); setTimeout(() => o.remove(), 300); res(v); };
    const catOf = e => CATS.find(c => c.d?.includes(e.domain));
    const count = c => c.d ? entsFor(c.d).length : -1;
    const sug = area ? entsIn(area).filter(e => catOf(e) && !used.includes(e.id)).sort((a, b) => CATS.indexOf(catOf(a)) - CATS.indexOf(catOf(b)) || a.name.localeCompare(b.name, 'de')).slice(0, 12) : [];

    function list() {
      box.innerHTML = `<div class="pkh"><b>Widget hinzufügen</b><button data-gx>Abbrechen</button></div>
        <label class="pks"><svg class="chev"><use href="#i-search"/></svg><input type="search" placeholder="Widgets suchen" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></label><div class="pkl"></div>`;
      const q = box.querySelector('input'), l = box.querySelector('.pkl');
      const draw = () => {
        const w = fold(q.value).trim();
        const cs = CATS.filter(c => count(c) !== 0 && (!w || fold(c.n).includes(w)));
        const es = w ? findEnts(w, CATS.flatMap(c => c.d || [])).slice(0, 40) : [];
        l.innerHTML = (!w && sug.length ? `<div class="pks2">Vorschläge für ${esc(area)}</div>` + sug.map(e => { const c = catOf(e); return `<button class="pki" data-gs="${esc(e.id)}">${ico(c)}<span class="t"><b>${esc(e.name)}</b><small>${esc(c.n)}</small></span><svg class="chev"><use href="#i-plus"/></svg></button>`; }).join('') + '<div class="pks2">Kategorien</div>' : '')
          + cs.map(c => `<button class="pki" data-gc="${c.k}">${ico(c)}<span class="t"><b>${esc(c.n)}</b><small>${count(c) < 0 ? 'Ohne Entity' : count(c) + (count(c) === 1 ? ' Entity' : ' Entities')}</small></span><svg class="chev"><use href="#i-chev"/></svg></button>`).join('')
          + es.map(e => { const c = catOf(e); return `<button class="pki" data-ge="${esc(e.id)}">${ico(c)}<span class="t"><b>${esc(e.name)}</b><small>${esc([c.n, e.area].filter(Boolean).join(' · '))}</small></span></button>`; }).join('')
          || '<div class="pkn">Nichts gefunden</div>';
      };
      q.oninput = draw; draw();
    }

    function detail(c, en) {
      const need = !!c.d;
      en ||= need ? entsFor(c.d).find(e => !used.includes(e.id)) || entsFor(c.d)[0] : null;
      const name = en?.name || c.n;
      const card = ([w, h]) => `<div class="gs"><div class="gcard" style="width:${w * U + (w - 1) * 8}px;height:${h * U + (h - 1) * 8}px;background:linear-gradient(160deg,color-mix(in srgb,${c.c} 62%,#fff),${c.c})"><svg><use href="#i-${c.i}"/></svg><b>${esc(name)}</b><small>${esc(en ? en.area || c.n : c.k === 'wx' ? 'Wetter' : 'Uhr')}</small></div></div>`;
      box.innerHTML = `<div class="pkh"><button data-gb>‹ Widgets</button><b>${esc(c.n)}</b><button data-gx aria-label="Schließen">✕</button></div>
        <div class="gd"><div class="gt">${esc(name)}</div><div class="gcw"><div class="gc">${SZ.map(card).join('')}</div><button class="scb l" data-gn="-1" aria-label="Kleiner"><svg><use href="#i-chev"/></svg></button><button class="scb r" data-gn="1" aria-label="Größer"><svg><use href="#i-chev"/></svg></button></div><div class="gdots">${SZ.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
        ${need ? `<button class="row gent" data-gp><span class="l">Entity</span><span class="v"><span class="val">${esc(en ? en.name : 'Keine passende Entity')}</span><svg class="chev"><use href="#i-chev"/></svg></span></button>` : ''}
        <button class="gadd" data-ga style="background:${c.c}" ${need && !en ? 'disabled' : ''}>＋ Widget hinzufügen</button></div>`;
      const gc = box.querySelector('.gc'), dots = [...box.querySelectorAll('.gdots i')], at = () => Math.round(gc.scrollLeft / gc.clientWidth);
      swipable(gc);
      const arrows = () => box.querySelectorAll('.scb').forEach(b => b.disabled = at() + +b.dataset.gn < 0 || at() + +b.dataset.gn >= SZ.length);
      gc.onscroll = () => { dots.forEach((d, i) => d.classList.toggle('on', i === at())); arrows(); };
      box.querySelectorAll('.scb').forEach(b => b.onclick = () => gc.scrollTo({ left: (at() + +b.dataset.gn) * gc.clientWidth, behavior: 'smooth' }));
      arrows();
      box.querySelector('[data-ga]').onclick = () => done({ cat: c.k, en, size: SZ[at()] });
      box.querySelector('[data-gp]')?.addEventListener('click', async () => { const e = await pickEntity({ title: c.n, domains: c.d, current: en?.id }); if (e?.id) detail(c, e); });
    }

    o.onclick = e => {
      if (e.target === o || e.target.closest('[data-gx]')) return done(null);
      const gs = e.target.closest('[data-gs]');
      if (gs) { const en = sug.find(x => x.id === gs.dataset.gs); return detail(catOf(en), en); }
      const gc = e.target.closest('[data-gc]'), ge = e.target.closest('[data-ge]');
      if (gc) detail(CATS.find(c => c.k === gc.dataset.gc));
      else if (ge) { const en = findEnts(ge.dataset.ge, CATS.flatMap(c => c.d || [])).find(x => x.id === ge.dataset.ge); if (en) detail(catOf(en), en); }
      else if (e.target.closest('[data-gb]')) list();
    };
    o.onkeydown = e => e.key === 'Escape' && done(null);
    list(); document.body.append(o);
    requestAnimationFrame(() => { o.classList.add('in'); box.querySelector('input')?.focus({ preventScroll: true }); });
  });
}
