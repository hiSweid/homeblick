// Gerüst-Zustand, den mehrere Module brauchen: Phone-Breite und die Seitenleiste als Blatt.
export const mq = matchMedia('(max-width:640px)');
export const isPhone = () => mq.matches;
let sideOpen = false;
export const sideIsOpen = () => sideOpen;
export function openSide(v) { sideOpen = v; document.querySelector('#side')?.classList.toggle('sheet-open', v); const d = document.querySelector('#side-dim'); if (d) d.hidden = !v; }
