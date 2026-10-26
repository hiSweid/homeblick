// Seitenrahmen im Stil von iOS: schwebende Navigationsleiste, großer Titel, der beim Scrollen in die Leiste wandert.
import { esc, ic } from './ui.js';

/** o = { title, left, right, sub, cls, wrap } → Seite mit Leiste und scrollendem Inhalt */
export const page = (o, body) => `<div class="page ${o.cls || ''}">${pane(o, body)}</div>`;
/** Ein Bereich (Leiste + Scroller); in der geteilten Ansicht gibt es zwei davon */
export const pane = (o, body) => `<header class="nav"><div class="nav-l">${o.left || ''}</div><h2 class="nav-t">${esc(o.title)}</h2><div class="nav-r">${o.right || ''}</div></header>
  <div class="scroller"><div class="wrap ${o.wrap || ''}"><h1 class="large">${esc(o.title)}</h1>${o.sub ? `<p class="lead">${o.sub}</p>` : ''}${body}</div></div>`;
export const backBtn = (hash, label) => `<button class="back" data-goto="${hash}">${ic('left')}<span>${esc(label)}</span></button>`;
export const gbtn = (attrs, icon, label) => `<button class="gbtn" ${attrs} aria-label="${esc(label)}" title="${esc(label)}">${ic(icon)}</button>`;

/** Titel in der Leiste einblenden, sobald der große Titel hochgescrollt ist; gibt die Aufräumfunktion zurück */
export function collapse(root) {
  const offs = [];
  for (const sc of root.querySelectorAll('.scroller')) {
    const nav = sc.parentElement.querySelector(':scope > .nav'), h = sc.querySelector('.large');
    if (!nav || !h) continue;
    const f = () => nav.classList.toggle('collapsed', sc.scrollTop > h.offsetTop - 56 + h.offsetHeight * .5);
    sc.addEventListener('scroll', f, { passive: true }); f(); offs.push(() => sc.removeEventListener('scroll', f));
  }
  return () => offs.forEach(f => f());
}
