// Jedes Theme (themes.js) setzt alle Tokens, die themes.css ohne Rückfall liest; Hintergründe sind echte Wallpaper: node tests/themes.test.mjs
import fs from 'node:fs';
import { THEMES, TH, themeBg } from '../custom_components/homeblick/frontend/themes.js';
import { MOTIF, hueOf } from '../custom_components/homeblick/frontend/wallpapers.js';
const css = fs.readFileSync(new URL('../custom_components/homeblick/frontend/themes.css', import.meta.url), 'utf8');
const need = [...new Set([...css.matchAll(/var\(--th-([a-z0-9]+)\)/g)].map(m => m[1]))];
const own = new Set([...css.matchAll(/--th-([a-z0-9]+):/g)].map(m => m[1]));   // in themes.css selbst berechnet (z. B. fill)
let bad = 0; const t = (c, m) => { if (!c) { bad++; console.error(m); } };
t(THEMES.length === 10 && new Set(THEMES.map(x => x.id)).size === 10, 'zehn Themes mit eindeutiger ID');
for (const th of THEMES) {
  for (const k of need) t(th.v[k] != null || own.has(k), `${th.id}: Token ${k} fehlt`);
  t(th.mode === 'light' || th.mode === 'dark', `${th.id}: mode`);
  t(th.bg == null || hueOf(th.bg) != null, `${th.id}: Hintergrund ${th.bg} ist kein Wallpaper`);
}
t(TH('nacht') && !TH('liquid'), 'TH findet nur eigene Themes');
const nacht = TH('nacht'), star = TH('starlight');
t(themeBg(nacht, { type: 'grid', bg: 'auto' }) === 'black', 'einfarbig dunkel → schwarz');
t(themeBg(star, { type: 'grid', bg: 'auto' }) === 'champagne', 'Tageszeit → Hintergrund des Themes');
t(themeBg(star, { type: 'calendar', bg: 'white' }) === 'white' && themeBg(nacht, { type: 'calendar', bg: 'white' }) === 'black', 'Kalender folgt hell/dunkel des Themes');
t(themeBg(star, { type: 'grid', bg: 'black' }) === null && themeBg(star, { type: 'grid', bg: 228 }) === null, 'eigene Wahl bleibt');
console.log(bad ? `${bad} Fehler` : `ok (${THEMES.length} Themes, ${need.length} Tokens)`); process.exit(bad ? 1 : 0);
