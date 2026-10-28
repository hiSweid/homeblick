// Themes ab 0.5.49 (Henryk 2026-10-28: „finde alle super“): vier Apple-Gerätefarben (Starlight, Rose Pink, Space Grau, Silber; Pixelproben aus ref/site, product-viewer/hero)
// und sechs eigene Looks (Klar, Nacht, Lagune, Getönt, Papier, Pastell). Liquid und Flat bleiben die Grundlooks in index.html.
// Ein Theme setzt Tokens (--th-*) auf <html> und data-theme=<id>; themes.css zieht sie in alle Flächen (Kacheln, Pillen, Karten, Listen, Uhren, Overlays).
// bg = Hintergrund für alle Ansichten mit „Tageszeit“ (Wert wie in wallpapers.js) oder null = einfarbig (Papier/Schwarz je nach mode); Info, Kalender und Datum kennen nur hell/dunkel.
import { tx } from './i18n.js';
const T = (id, name, mode, bg, v) => ({ id, name, mode, bg, v });
export const THEMES = [
  T('starlight', tx('Starlight'), 'light', 'champagne', {   // Apple „Starlight“ (Champagner): Warmglas, Gold
    glass: 'linear-gradient(165deg,#ffffff80,#ffffff48)', rim: 'inset 0 0 0 .25cqw #ffffff99', ink: '#4d3d28', sub: '#7d6c54',
    on: 'linear-gradient(#fffaf0f2,#fff6e6e0)', onink: '#6b5230', onsub: '#9a8461', acc: '#b8923f', line: '#4d3d2833', pill: '#fffaf0cc', pillink: '#4d3d28', accent: '#b8923f', accink: '#fff', clk: '#4d3d28eb', clk2: '#8a7556d9', cb: '#8a6d33', cr: '#b8923f', cd: '#d2b46a', cc: '#4d3d28', cpaper: '#faf6ec', hue: 38 }),
  T('rosepink', tx('Rose Pink'), 'light', 'orb:345:28', {   // Apple „Rose Pink“
    glass: 'linear-gradient(165deg,#ffffff7a,#ffffff40)', rim: 'inset 0 0 0 .25cqw #ffffff99', ink: '#6a2a42', sub: '#9a5b72',
    on: 'linear-gradient(#fff6f8f2,#ffeaf0e0)', onink: '#9a3d5f', onsub: '#bd7a93', acc: '#d4668a', line: '#6a2a4233', pill: '#fff3f6cc', pillink: '#6a2a42', accent: '#d4668a', accink: '#fff', clk: '#6a2a42eb', clk2: '#b5718a', cb: '#9a3d5f', cr: '#d4668a', cd: '#eb9ab4', cc: '#6a2a42', cpaper: '#fdf1f4', hue: 345 }),
  T('spacegrau', tx('Space Grau'), 'dark', null, {   // Apple „Space Gray“: Graphit, dunkles Glas, helle An-Fläche
    glass: 'linear-gradient(165deg,#ffffff1f,#ffffff0d)', rim: 'inset 0 0 0 .25cqw #ffffff22', ink: '#ececf1', sub: '#8e8e96',
    on: 'linear-gradient(#e8e8ee,#dcdce3)', onink: '#1c1c1e', onsub: '#6a6a72', acc: '#1c1c1e', line: '#ffffff26', cl: '62%', pill: '#ffffff1f', pillink: '#ececf1', accent: '#ff9f0a', blk: '#1b1b1f', accink: '#1c1c1e', clk: '#ececf1f2', clk2: '#8e8e96', cb: '#ececf1', cr: '#ff9f0a', cd: '#ff9f0a', cc: '#ff9f0a', cpaper: '#1b1b1f', hue: 225 }),
  T('silber', tx('Silber'), 'light', 'metal', {   // Apple „Silver“: kühles Metall, Blaugrau-Tinte
    glass: 'linear-gradient(165deg,#ffffff88,#ffffff4d)', rim: 'inset 0 0 0 .25cqw #ffffffaa', ink: '#2c3440', sub: '#64707e',
    on: 'linear-gradient(#fffffff2,#f4f7fbe6)', onink: '#33598f', onsub: '#7c93b4', acc: '#33598f', line: '#2c344033', pill: '#ffffffb3', pillink: '#2c3440', accent: '#33598f', accink: '#fff', clk: '#2c3440eb', clk2: '#7c8b9d', cb: '#33598f', cr: '#5878a6', cd: '#9db3d1', cc: '#1f3a63', cpaper: '#f1f4f8', hue: 215 }),
  T('klar', tx('Klar'), 'dark', 'prism:222', {   // fast durchsichtiges Glas mit feiner Kante (Henryk 21.10.: „ein bisschen transparent“)
    glass: 'linear-gradient(165deg,#ffffff1a,#ffffff08)', rim: 'inset 0 0 0 .4cqw #ffffff66', sh: '0 0 0 #0000', ink: '#fff', sub: '#ffffffb8',
    on: 'linear-gradient(165deg,#ffffff4d,#ffffff2e)', onink: '#fff', onsub: '#ffffffcc', onrim: 'inset 0 0 0 .5cqw #ffffffcc', acc: '#fff', line: '#ffffff40', pill: '#0a1a4d80', pillink: '#fff', accent: '#fff', accink: '#0b2a5c', clk: '#fffffff2', clk2: '#ffffffa6', cb: '#fff', cr: '#a9cbff', cd: '#a9cbff', cc: '#4a7de8', cpaper: '#000', hue: 222 }),
  T('nacht', tx('Nacht'), 'dark', null, {   // wie StandBy-Nachtmodus: Schwarz mit gedimmtem Rot/Bernstein
    glass: '#1a0907', rim: 'inset 0 0 0 .25cqw #3a1612', sh: '0 0 0 #0000', ink: '#c9573c', sub: '#7e3627',
    on: '#4d1c13', onink: '#ff8f60', onsub: '#c4603f', onrim: 'inset 0 0 0 .25cqw #7a2e1f', acc: '#ff8f60', line: '#3a1612', cl: '38%', pill: '#1a0907', pillink: '#c9573c', accent: '#ff8f60', blk: '#000', accink: '#1a0907', clk: '#c9573c', clk2: '#7e3627', cb: '#c9573c', cr: '#ff8f60', cd: '#ff8f60', cc: '#c9573c', cpaper: '#000', hue: 12 }),
  T('lagune', tx('Lagune'), 'dark', 'fan:172', {   // Teal-Fächer (Apple wall_mount): getönte Teal-Kacheln, An = helles Weiß mit Tiefgrün
    glass: 'linear-gradient(165deg,#0a6e6a55,#0a5a5640)', rim: 'inset 0 0 0 .25cqw #ffffff4d', ink: '#e9fffb', sub: '#a7e3dc',
    on: 'linear-gradient(#ffffffe6,#ffffffcc)', onink: '#0b544f', onsub: '#4f8f89', acc: '#0b7f77', line: '#ffffff40', pill: '#0a5a5666', pillink: '#e9fffb', accent: '#0b7f77', accink: '#fff', clk: '#e9fffbf2', clk2: '#a7e3dc', cb: '#fff', cr: '#7ff0e0', cd: '#7ff0e0', cc: '#0b7f77', cpaper: '#000', hue: 172 }),
  T('getont', tx('Getönt'), 'dark', 'flow:232', {   // Flow-Hintergrund; aus = dunkel getönt, An = volle Akzentfarbe (wie Apple-Home-App)
    glass: 'linear-gradient(165deg,#0d0d4a66,#0d0d4a44)', rim: 'inset 0 0 0 .25cqw #ffffff33', ink: '#fff', sub: '#ffffffa6',
    on: 'linear-gradient(165deg,#8f8fff,#6a6af0)', onink: '#fff', onsub: '#ffffffcc', onsh: '0 1.2cqw 3.5cqw #4a4af080', acc: '#fff', line: '#ffffff40', pill: '#0d0d4a66', pillink: '#fff', accent: '#fff', accink: '#3a3ae0', clk: '#fffffff2', clk2: '#ffffffb0', cb: '#fff', cr: '#b8b8ff', cd: '#b8b8ff', cc: '#6a6af0', cpaper: '#000', hue: 232 }),
  T('papier', tx('Papier'), 'light', null, {   // Kontrast-Look wie E-Ink: Papierweiß, schwarze Linien, An = schwarz gefüllt (passt auch zur ESP-Firmware)
    glass: '#fbfaf5', rim: 'inset 0 0 0 .45cqw #1a1a1a', sh: '0 0 0 #0000', ink: '#1a1a1a', sub: '#5c5c58',
    on: '#1a1a1a', onink: '#f2efe7', onsub: '#bdbab0', acc: '#f2efe7', line: '#1a1a1a', pill: '#fbfaf5', pillink: '#1a1a1a', accent: '#1a1a1a', paper: '#f2efe7', fw: '700', accink: '#f2efe7', clk: '#1a1a1a', clk2: '#5c5c58', cb: '#1a1a1a', cr: '#1a1a1a', cd: '#d6d1c4', cc: '#1a1a1a', cpaper: '#f2efe7', hue: 40 }),
  T('pastell', tx('Pastell'), 'light', null, {   // flach, Henryks HA-Dashboard-Pastellpalette: An = Farbe je Art (themes.css)
    glass: '#efece6', rim: 'inset 0 0 0 0 #0000', sh: '0 0 0 #0000', ink: '#6b6963', sub: '#9a9790',
    on: '#FFE896', onink: '#5a4a3a', onsub: '#8a7a68', acc: '#5a4a3a', line: '#6b696326', pill: '#efece6', pillink: '#6b6963', accent: '#5a4a3a', paper: '#fbf8f2', accink: '#fbf8f2', clk: '#6b6963', clk2: '#b9b6ae', cb: '#6b6963', cr: '#e8956f', cd: '#F5C8BC', cc: '#e8956f', cpaper: '#fbf8f2', hue: 335 }),
];
export const TH = id => THEMES.find(t => t.id === id) || null;
const PLAIN = new Set(['info', 'calendar', 'date']);
// Hintergrund einer Ansicht unter diesem Theme oder null (dann gilt der eigene Wert): nur „Tageszeit“; Kalender/Datum zusätzlich bei Weiß, das ist ihr Standard
export const themeBg = (th, f) => {
  const plain = PLAIN.has(f.type);
  if (f.bg !== 'auto' && !(plain && f.bg === 'white')) return null;
  return th.bg && !plain ? th.bg : th.mode === 'light' ? 'white' : 'black';
};

// Tokens auf <html>: alte entfernen, neue setzen; data-th schaltet die Regeln in themes.css ein (Liquid/Flat bleiben unberührt)
let set = [];
export function applyThemeVars(root, th) {
  for (const k of set) root.style.removeProperty(k);
  set = [];
  if (!th) return root.removeAttribute('data-th');
  root.setAttribute('data-th', '');
  for (const [k, v] of Object.entries(th.v)) { root.style.setProperty(`--th-${k}`, v); set.push(`--th-${k}`); }
}
