// Foto-Face (Diashow): Bilder aus einer Home-Assistant-Medienquelle (Immich-Album, Medienordner …), weich überblendet mit unscharfem Hintergrund.
// Auch als Bildschirmschoner wählbar (Einstellungen → Bildschirmschoner → Ansicht „Fotos“; Wecken und Musik-Vorrang macht kiosk.js).
// Quelle: f.src = Medieninhalts-ID (media-source://…), f.sec = Sekunden je Bild. Die Liste wird einmal per media_source/browse_media geholt (Ordner bis Tiefe 2),
// jedes Bild erst kurz vor der Anzeige per media_source/resolve_media aufgelöst (signierte Adressen laufen ab). Es liegen höchstens zwei Bilder im DOM; keine Bilder in der Konfiguration.
import { tx } from './i18n.js';
const MAX = 300, DIRS = 25, DEPTH = 2, SEC = 20;

// Reine Sammlung: browse(id) → { children: [...] } | null; liefert Bild-IDs (Mischen macht der Aufrufer)
export async function collect(browse, root, { max = MAX, dirs = DIRS, depth = DEPTH } = {}) {
  const out = [];
  let left = dirs;
  const walk = async (id, d) => {
    if (left-- <= 0 || out.length >= max) return;
    const r = await browse(id).catch(() => null);
    const sub = [];
    for (const c of r?.children || []) {
      if (c.media_class === 'image' && c.can_play && /^image\/(jpeg|png|webp|gif)/.test(c.media_content_type || 'image/jpeg')) { if (out.length < max) out.push(c.media_content_id); }
      else if (c.can_expand && d < depth) sub.push(c.media_content_id);
    }
    for (const s of sub) await walk(s, d + 1);
  };
  await walk(root, 0);
  return out;
}
export const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

let api = null;
// o.send(msg) → Promise (HA-Websocket) | null (Demo), o.abs(url) → absolute Adresse, o.hidden(): Gastmodus, o.demo: Demo-Bilder
export function photosInit(o) { api = o; setInterval(tick, 1000); }

export function photosFace(el, f) {
  el.innerHTML = '<div class="pls"><div class="pl"><div class="pb"></div><div class="pi"></div></div><div class="pl"><div class="pb"></div><div class="pi"></div></div></div><div class="pe"></div>';
  el._f = f;
  el._p = { list: [], i: -1, at: 0, src: null, top: 0, busy: false, vis: false };
  new IntersectionObserver(([e]) => { el._p.vis = e.isIntersecting; if (e.isIntersecting) el._p.at = 0; }, { threshold: .5 }).observe(el);   // nur zeigen, wenn die Ansicht im Bild ist
}
const msg = (el, t) => { const e = el.querySelector('.pe'); e.textContent = t || ''; e.hidden = !t; };

async function load(el, f) {
  const p = el._p;
  p.src = f.src || ''; p.list = []; p.i = -1; p.busy = true; p.at = Date.now();
  try {
    if (api.demo) p.list = shuffle(api.demo);
    else if (p.src) p.list = shuffle(await collect(id => api.send({ type: 'media_source/browse_media', media_content_id: id }), p.src));
  } catch (e) { console.warn('Fotos', e); }
  p.busy = false;
  msg(el, p.list.length ? '' : p.src ? tx('Keine Bilder in dieser Quelle gefunden') : tx('Medienquelle im Editor wählen (Ansicht → Quelle)'));
}
async function url(id) {
  if (api.demo) return id;
  const r = await api.send({ type: 'media_source/resolve_media', media_content_id: id, expires: 3600 });
  return r?.url ? api.abs(r.url) : null;
}
// Nächstes Bild laden (unsichtbar), dann überblenden; unlesbare Bilder (HEIC …) überspringen
async function next(el, tries = 3) {
  const p = el._p;
  if (p.busy || !p.list.length) return;
  p.busy = true;
  let shown = false;
  try {
    for (let n = 0; n < tries; n++) {
      p.i = (p.i + 1) % p.list.length;
      const u = await url(p.list[p.i]).catch(() => null);
      if (!u) continue;
      const ok = await new Promise(res => { const im = new Image(), t = setTimeout(() => { im.src = ''; res(false); }, 10000); im.onload = () => { clearTimeout(t); res(true); }; im.onerror = () => { clearTimeout(t); res(false); }; im.src = u; });   // Timeout: hängender Server hält sonst busy ewig
      if (!ok) continue;
      const ls = el.querySelectorAll('.pl'), nx = ls[p.top ^ 1];
      for (const q of nx.children) q.style.backgroundImage = `url(${JSON.stringify(u)})`;
      nx.classList.add('on'); ls[p.top].classList.remove('on'); p.top ^= 1;
      shown = true; break;
    }
    msg(el, shown || el.querySelector('.pl.on') ? '' : tx('Bilder nicht ladbar'));   // nichts lesbar und noch nichts zu sehen: Hinweis statt schwarz
  } finally { p.busy = false; p.at = Date.now(); }
}
function tick() {
  if (!api || document.hidden) return;
  for (const el of document.querySelectorAll('.f-photos')) {
    const p = el._p, f = el._f;
    if (!p || !p.vis || p.busy || api.hidden()) continue;
    const want = f.src || '';
    if (p.src !== want || (!p.list.length && (want || api.demo) && Date.now() - p.at > 6e4)) { load(el, f).then(() => next(el)); continue; }   // Quelle geändert oder leer: neu laden, leer höchstens jede Minute
    if (p.list.length && Date.now() - p.at >= Math.max(5, Math.min(300, +f.sec || SEC)) * 1000) next(el);
  }
}

if (typeof document !== 'undefined') document.head.insertAdjacentHTML('beforeend', `<style>
.f-photos{background:#000;color:#fff;overflow:hidden}
.f-photos .pls,.f-photos .pl,.f-photos .pl>*{position:absolute;inset:0}
.f-photos .pl{opacity:0;transition:opacity 1.4s ease-in-out}.f-photos .pl.on{opacity:1}
.f-photos .pb{background:center/cover no-repeat;filter:blur(4cqw) brightness(.65);transform:scale(1.15)}
.f-photos .pi{background:center/contain no-repeat}
.perf .f-photos .pb{filter:none;opacity:.35}
.f-photos .pe{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 12cqw;text-align:center;font-size:3.8cqw;opacity:.7}
.f-photos .pe[hidden]{display:none}
</style>`);

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('photos.js')) (async () => {
  const t = (c, m) => console.assert(c, m);
  const tree = { r: { children: [{ media_class: 'image', can_play: true, media_content_id: 'a', media_content_type: 'image/jpeg' }, { media_class: 'image', can_play: true, media_content_id: 'heic', media_content_type: 'image/heic' }, { media_class: 'directory', can_expand: true, media_content_id: 'd1' }, { media_class: 'video', can_play: true, media_content_id: 'v' }] },
    d1: { children: [{ media_class: 'image', can_play: true, media_content_id: 'b', media_content_type: 'image/png' }, { media_class: 'album', can_expand: true, media_content_id: 'd2' }] },
    d2: { children: [{ media_class: 'image', can_play: true, media_content_id: 'c' }, { media_class: 'album', can_expand: true, media_content_id: 'd3' }] }, d3: { children: [{ media_class: 'image', can_play: true, media_content_id: 'zu tief' }] } };
  const br = async id => tree[id] || null;
  const l = await collect(br, 'r');
  t(l.join() === 'a,b,c', 'Bilder (jpeg/png), ohne HEIC/Video, bis Tiefe 2');
  t((await collect(br, 'r', { max: 2 })).length === 2, 'Obergrenze');
  t((await collect(async () => { throw new Error('x'); }, 'r')).length === 0, 'Fehler → leer');
  t((await collect(br, 'fehlt')).length === 0, 'unbekannte Quelle → leer');
  t(shuffle(l).sort().join() === 'a,b,c', 'Mischen behält alle');
  console.log('ok');
})();
