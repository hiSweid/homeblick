// Sprache: Deutsch ist der Quelltext, Englisch kommt aus lang/en-*.js (Schlüssel = deutscher Text).
// Wahl: ?lang=de|en · localStorage hb_lang · Browsersprache (alles außer Deutsch → Englisch).
const pick = s => (/^(de|en)/i.exec(s || '') || [])[1]?.toLowerCase();
const stored = () => { try { return globalThis.localStorage.getItem('hb_lang'); } catch { return null; } };
export const LANG = pick(new URLSearchParams(globalThis.location?.search).get('lang')) || pick(stored()) || (globalThis.document ? (globalThis.navigator?.languages?.length ? navigator.languages : [globalThis.navigator?.language]).map(pick).find(Boolean) || 'en' : 'de');   // ohne Browser (Node-Selbsttests) gilt der deutsche Quelltext
export const LOC = LANG === 'de' ? 'de-DE' : 'en-GB';   // Datum/Zahlen/24-Stunden-Uhr
export const setLang = l => { try { l ? localStorage.setItem('hb_lang', l) : localStorage.removeItem('hb_lang'); } catch {} location.reload(); };

const FILES = ['en-index', 'en-faces', 'en-info', 'en-device', 'en-admin', 'en-editor', 'en-themes'];
const EN = LANG === 'de' ? {} : Object.assign({}, ...(await Promise.all(FILES.map(f => import(`./lang/${f}.js`)))).map(m => m.default));

// tx('Text mit {n} Platzhalter', { n }) · Kontext bei gleichem deutschem Text: tx('Zu‖Fenster') (alles ab ‖ wird nie angezeigt)
const base = s => s.split('‖')[0];
export const tx = (s, v) => { const r = (LANG === 'de' ? null : EN[s]) ?? base(s); return v ? r.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '') : r; };

// statisches HTML (Textknoten + placeholder/title/aria-label/alt) einmalig übersetzen; dynamisches Markup nutzt tx()
export function txDom(root = document.body) {
  if (LANG === 'de') return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) ? 3 : 1 }), nodes = [];
  for (let n; (n = w.nextNode());) nodes.push(n);
  for (const n of nodes) { const k = n.nodeValue.trim(); if (k && EN[k]) n.nodeValue = n.nodeValue.replace(k, EN[k]); }
  for (const a of ['placeholder', 'title', 'aria-label', 'alt']) for (const e of root.querySelectorAll(`[${a}]`)) { const k = e.getAttribute(a).trim(); if (EN[k]) e.setAttribute(a, EN[k]); }
}
if (globalThis.document) document.documentElement.lang = LANG;
if (globalThis.document && LANG !== 'de') { txDom(); if (document.title) document.title = EN[document.title] ?? document.title; }
