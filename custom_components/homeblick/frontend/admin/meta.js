// Konstanten und Hilfen für Faces, Kacheln, Themes und Vorlagen (aus dem bisherigen Admin übernommen).
import { GROUP, ICON, normFaces, pack, rows } from '../faces.js';
import { entsIn } from './entities.js';
export { GROUP };
import { entOf, DOM, allEnts, energyPrefs } from './entities.js';
import { detect, ready } from './detect.js';
export const FACE = {
  grid: ['Smart Home', '#ff9500', 'grid'], music: ['Musik', '#ff2d55', 'music'], bigclock: ['Uhr digital', '#636366', 'clock'], analog: ['Uhr analog', '#5856d6', 'clock'],
  calendar: ['Kalender', '#ff3b30', 'cal'], date: ['Datum', '#8e8e93', 'cal'], weather: ['Wetter', '#32ade6', 'sun'], energy: ['Energie', '#34c759', 'bolt'], info: ['Info', '#30b0c7', 'info'], cams: ['Kameras', '#8e8e93', 'cam'], people: ['Personen', '#5ac8fa', 'person'],
};
export const TYPES = Object.entries(FACE).map(([k, v]) => [k, v[0]]);
export const BG = [['auto', 'Tageszeit'], ['black', 'Schwarz'], ['white', 'Weiß'], ['metal', 'Metall'], ['prism', 'Prisma'], ['teal', 'Teal'], [30, 'Orange'], [5, 'Rot'], [340, 'Rosa'], [285, 'Violett'], [307, 'Pink'], [228, 'Blau'], [205, 'Türkis'], [212, 'Himmel'], [150, 'Grün']];
export const STYLES = { weather: [['', 'Kompakt'], ['cond', 'Bedingungen']], bigclock: [['stack', 'Gestapelt'], ['line', 'Lavalampe'], ['flow', 'Flow'], ['typo', 'Typograph'], ['rings', 'Ringe'], ['solar', 'Solar Graph'], ['moon', 'Mond'], ['modular', 'Modular']], analog: [['big', 'Große Ziffern'], ['relief', 'Relief'], ['chrono', 'Chronograph'], ['utility', 'Utility'], ['meridian', 'Meridian']], info: [['events', 'Termine'], ['music', 'Musik']] };
export const LEGACY = { bigclock: [['depth', 'Tiefe']], analog: [['numbers', 'Zahlen'], ['ticks', 'Striche'], ['minimal', 'Minimal']] };   // ohne Vorlage: nur sichtbar, wenn gespeichert
// Uhr und Kalender gibt es je Display nur einmal; Design (digital/analog bzw. Monat/Datum) und Farbe stellt man am Face ein. Wert = "Typ:Stil"
export const DESIGN = { clock: [['bigclock:stack', 'Digital · Gestapelt'], ['bigclock:line', 'Digital · Lavalampe'], ['bigclock:flow', 'Digital · Flow'], ['bigclock:typo', 'Digital · Typograph'], ['bigclock:rings', 'Digital · Ringe'], ['bigclock:solar', 'Digital · Solar Graph'], ['bigclock:moon', 'Digital · Mond'], ['bigclock:modular', 'Digital · Modular'], ['analog:big', 'Analog · Große Ziffern'], ['analog:relief', 'Analog · Relief'], ['analog:chrono', 'Analog · Chronograph'], ['analog:utility', 'Analog · Utility'], ['analog:meridian', 'Analog · Meridian'], ['info:events', 'Info · Termine'], ['info:music', 'Info · Musik']]};
export const GNAME = { clock: 'Uhr' };
export const faceName = x => (GNAME[GROUP[x.type]] || FACE[x.type]?.[0] || x.type) + (x.id !== x.type ? ' ' + x.id.replace(x.type, '') : '');
export const designs = f => DESIGN[GROUP[f.type]] ? DESIGN[GROUP[f.type]].concat((LEGACY[f.type] || []).filter(([v]) => v === f.style).map(([v, n]) => [`${f.type}:${v}`, `${{ bigclock: 'Digital', analog: 'Analog', info: 'Info' }[f.type]} · ${n}`])) : STYLES[f.type];
export const designCur = f => DESIGN[GROUP[f.type]] ? `${f.type}:${f.style || STYLES[f.type]?.[0][0] || ''}` : f.style || STYLES[f.type]?.[0][0];
export const withDesign = (cfg, f, v) => { if (!DESIGN[GROUP[f.type]]) return { ...f, style: v }; const [type, style] = v.split(':'); return { ...f, type, style: style || undefined }; };
export const WAKE = [['off', 'Aus'], ['hey_jarvis', 'Hey Jarvis'], ['alexa', 'Alexa']];
export const bgCss = bg => bg === 'auto' ? 'linear-gradient(135deg,#ffb36b,#5a6bb5)' : bg === 'black' ? '#1c1c1e' : bg === 'white' ? '#f2f2f7' : bg === 'metal' ? 'linear-gradient(135deg,#b5c4d6,#8795ad)' : /^(prism|fan):\d+$/.test(bg) ? `linear-gradient(135deg,hsl(${bg.split(':')[1]} 70% 62%),hsl(${bg.split(':')[1]} 60% 28%))` : bg === 'prism' ? 'linear-gradient(135deg,#8483f3,#3c3cae)' : bg === 'teal' ? 'linear-gradient(135deg,#4fae9f,#1d5f56)' : typeof bg === 'number' ? `linear-gradient(135deg,hsl(${bg} 75% 66%),hsl(${bg + 25} 70% 52%))` : '#8e8e93';
export const bgName = bg => BG.find(b => String(b[0]) === String(bg))?.[1] || THEME_SET.find(t => String(t[2]) === String(bg))?.[1] || 'Foto';
export const bgVal = v => /^\d+$/.test(v) ? +v : v;

export const stripArea = (en, area) => area ? en.name.replace(new RegExp('^' + area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s:_-]*', 'i'), '').trim() : en.name;
export const tileOf = (en, area = en.area) => ({ e: en.id, title: stripArea(en, area) || autoTitle(en), sub: area, ...(['sensor', 'binary_sensor'].includes(en.domain) && { val: 'state' }) });

export const FACE_BG = { grid: 'auto', music: 'black', bigclock: 150, weather: 212, energy: 'auto', calendar: 'white', date: 'auto', analog: 150, info: 'auto', cams: 'black', people: 'auto' };
// Standard: alle wichtigen Ansichten. Was das Haus nicht hergibt (kein Player, kein Wetter, keine Kamera, kein evcc …), liegt versteckt bereit statt leer zu laufen.
const HAS = { music: e => e.domain === 'media_player', weather: e => e.domain === 'weather', cams: e => e.domain === 'camera', people: e => e.domain === 'person' };
export const energyGuess = () => detect(allEnts(), energyPrefs());   // Energie-Face: Entities aus Energie-Dashboard bzw. Namen/Einheiten
const stdHas = type => type === 'energy' ? ready(energyGuess()) : !HAS[type] || allEnts().some(HAS[type]);
export const SETUP = [   // [Schlüssel, Name, Beschreibung, Faces]
  ['std', 'Standard', 'Alle wichtigen Ansichten, passend zu deinem Haus', ['grid', 'music', 'bigclock', 'weather', 'calendar', 'energy', 'cams', 'people']],
  ['room', 'Raum-Panel', 'Kacheln aus dem Bereich, Musik, Wetter, Kalender und Uhr', ['grid', 'music', 'weather', 'calendar', 'bigclock']],
  ['clock', 'Uhr & Wetter', 'Uhr, Wetter, Kalender und Datum – ganz ohne Entities', ['bigclock', 'weather', 'calendar', 'date']],
  ['all', 'Alle Faces', 'Jedes Face einmal; was nicht passt, blendest du später aus', Object.keys(FACE).filter(t => !['analog', 'info'].includes(t))],
];
export const ROOM_DOM = ['climate', 'light', 'cover', 'lock', 'scene', 'switch', 'fan', 'media_player', 'script'];   // Reihenfolge = Wichtigkeit
// Kacheln aus den Entities eines Bereichs: Thermostat groß, je Art höchstens 3, insgesamt 9 Zellen
export function roomTiles(area) {
  const pool = (area ? entsIn(area) : allEnts().filter(e => !e.hide)).filter(e => ROOM_DOM.includes(e.domain)).sort((a, b) => ROOM_DOM.indexOf(a.domain) - ROOM_DOM.indexOf(b.domain) || a.name.localeCompare(b.name, 'de'));
  const tiles = [], n = {};
  let cells = 9;
  for (const en of pool) {
    const big = en.domain === 'climate' && !tiles.some(t => t.w === 2), need = big ? 4 : 1;
    if (cells < need || (n[en.domain] = (n[en.domain] || 0) + 1) > 3) continue;
    cells -= need;
    tiles.push({ ...tileOf(en, area), ...(big && { w: 2, h: 2 }) });
  }
  return tiles;
}
export function setupConfig(key, area) {
  const types = SETUP.find(x => x[0] === key)[3], std = key === 'std', found = energyGuess(), ents = Object.keys(found).length ? { ...found, carName: 'Auto' } : null;   // „Auto“ statt „e-Golf“ (Standardname des Face)
  const mk = type => ({ type, bg: FACE_BG[type], ...(type === 'grid' && { tiles: roomTiles(area) }), ...(type === 'energy' && ents && { ents }) });
  const c = { cams: 1, energy: 1, dyn: 2, off: std ? types.filter(t => !stdHas(t)).map(mk) : [], faces: types.filter(t => !std || stdHas(t)).map(mk) };
  normFaces(c);
  return c;
}

export const ENERGY = [['pv', 'Solar-Leistung'], ['grid', 'Netz-Leistung (+ Bezug)'], ['home', 'Hausverbrauch'], ['bat', 'Batterie-Leistung (− Laden)'], ['soc', 'Batterie-Ladestand'], ['car', 'Auto: Ladeleistung'], ['carSoc', 'Auto: Ladestand'], ['range', 'Auto: Reichweite'], ['today', 'Solar heute (kWh)'], ['todayFc', 'Prognose heute (Solcast, Tageskurve)'], ['tomorrow', 'Prognose morgen'], ['tomorrowPeak', 'Morgen: Zeitpunkt Spitze'],
  // nur Detailansichten (Tipp auf eine Kachel); dritter Eintrag = Domains, sonst sensor
  ['pvPeak', 'Detail Solar: Spitzenleistung heute'], ['pvPeakAt', 'Detail Solar: Zeitpunkt Spitze heute'], ['day3', 'Detail Heute/Morgen: Prognose Tag 3'], ['day4', 'Detail Heute/Morgen: Prognose Tag 4'],
  ['solarPct', 'Detail Autarkie: Solaranteil gesamt'], ['cap', 'Detail Akku: Kapazität (kWh)'], ['batIn1', 'Detail Akku: heute geladen (1)'], ['batOut1', 'Detail Akku: heute entladen (1)'],
  ['batIn2', 'Detail Akku: heute geladen (2)'], ['batOut2', 'Detail Akku: heute entladen (2)'], ['carConn', 'Detail Auto: verbunden', ['binary_sensor']], ['carChg', 'Detail Auto: lädt', ['binary_sensor']],
  ['carRem', 'Detail Auto: Restladedauer'], ['carLim', 'Detail Auto: Ladelimit', ['number']], ['carMode', 'Detail Auto: Lademodus', ['select']],
  ['sesE', 'Detail Auto: Sitzung Energie'], ['sesSol', 'Detail Auto: Sitzung Solaranteil'], ['sesPrice', 'Detail Auto: Sitzung Preis']];
export const TILE_DOM = ['light', 'switch', 'input_boolean', 'lock', 'cover', 'climate', 'scene', 'script', 'media_player', 'fan', 'timer', 'camera', 'button', 'input_button', 'sensor', 'binary_sensor'];
export const TOGGLE_DOM = ['light', 'switch', 'input_boolean', 'fan', 'cover', 'media_player', 'script'];   // Domains mit Dienst .toggle

export const THEME_SET = [
  ['prisma', 'Prisma', 'prism:245', 'liquid', 'dark'], ['teal', 'Teal', 'fan:172', 'liquid', 'dark'], ['amethyst', 'Amethyst', 'fan:285', 'liquid', 'dark'], ['ozean', 'Ozean', 'prism:212', 'liquid', 'dark'],
  ['nordlicht', 'Nordlicht', 'prism:165', 'liquid', 'dark'], ['bernstein', 'Bernstein', 'prism:35', 'liquid', 'dark'], ['koralle', 'Koralle', 'prism:8', 'liquid', 'dark'], ['beere', 'Beere', 'fan:330', 'liquid', 'dark'],
  ['wald', 'Wald', 'fan:140', 'liquid', 'dark'], ['daemmerung', 'Dämmerung', 30, 'liquid', 'dark'], ['rot', 'Rot', 5, 'liquid', 'dark'], ['rosa', 'Rosa', 340, 'liquid', 'dark'], ['violett', 'Violett', 285, 'liquid', 'dark'],
  ['pink', 'Pink', 307, 'liquid', 'dark'], ['blau', 'Blau', 228, 'liquid', 'dark'], ['tuerkis', 'Türkis', 205, 'liquid', 'dark'], ['himmel', 'Himmel', 212, 'liquid', 'dark'], ['gruen', 'Grün', 150, 'liquid', 'dark'],
  ['metall', 'Metall', 'metal', 'liquid', 'dark'], ['p-rosa', 'Pastell Rosa', 340, 'liquid', 'light'], ['p-blau', 'Pastell Blau', 212, 'liquid', 'light'], ['p-gruen', 'Pastell Grün', 150, 'liquid', 'light'], ['p-gelb', 'Pastell Gelb', 50, 'liquid', 'light'],
  ['saphir', 'Saphir', 'prism:222', 'liquid', 'dark'], ['smaragd', 'Smaragd', 'prism:152', 'liquid', 'dark'], ['rubin', 'Rubin', 'prism:350', 'liquid', 'dark'], ['topas', 'Topas', 'prism:48', 'liquid', 'dark'],
  ['lagune', 'Lagune', 'fan:190', 'liquid', 'dark'], ['lavendel', 'Lavendel', 'fan:262', 'liquid', 'dark'], ['orchidee', 'Orchidee', 'fan:310', 'liquid', 'dark'], ['limette', 'Limette', 'fan:95', 'liquid', 'dark'],
  ['sonnenuntergang', 'Sonnenuntergang', 'fan:18', 'liquid', 'dark'], ['mitternacht', 'Mitternacht', 'prism:255', 'liquid', 'dark'], ['gold', 'Gold', 'fan:42', 'liquid', 'dark'], ['mint', 'Mint', 'fan:160', 'liquid', 'dark'],
  ['p-lila', 'Pastell Lila', 285, 'liquid', 'light'], ['p-mint', 'Pastell Mint', 170, 'liquid', 'light'], ['p-pfirsich', 'Pastell Pfirsich', 25, 'liquid', 'light'], ['p-himmel', 'Pastell Himmel', 200, 'liquid', 'light'],
  ['p-prisma', 'Prisma Hell', 'prism:245', 'liquid', 'light'], ['p-teal', 'Teal Hell', 'fan:172', 'liquid', 'light'],
  ['flat-dunkel', 'Flat Dunkel', 'black', 'flat', 'dark'], ['flat-hell', 'Flat Hell', 'white', 'flat', 'light'],
];
export const THEME_TYPES = ['grid', 'analog', 'bigclock', 'energy', 'info', 'people'];   // Faces, deren Hintergrund ein Theme mitnimmt (Foto-Hintergründe bleiben)
export const themeBg = f => !f.bg || typeof f.bg !== 'object';
export const themeGrid = cfg => cfg.faces.find(f => f.type === 'grid') || cfg.faces[0];
export const themeCur = cfg => { const g = themeGrid(cfg); return THEME_SET.find(t => t[3] === (cfg.theme || 'liquid') && t[4] === (cfg.mode || 'dark') && String(t[2]) === String(g.bg))?.[0] ?? ''; };
export const themeConf = (cfg, v) => { const t = THEME_SET.find(x => x[0] === v) || THEME_SET[0], g = themeGrid(cfg); return { conf: { ...cfg, theme: t[3], mode: t[4], faces: [{ ...g, bg: t[2] }] }, face: g.id }; };
export const themeApply = (cfg, v) => { const t = THEME_SET.find(x => x[0] === v); if (!t) return; cfg.theme = t[3]; cfg.mode = t[4]; cfg.faces.forEach(f => { if (THEME_TYPES.includes(f.type) && themeBg(f)) f.bg = t[2]; }); };
export const THEMES = [['liquid', 'Liquid', 'linear-gradient(135deg,#e29b56,#a8541a)'], ['flat', 'Flat', 'linear-gradient(135deg,#e8e8e8 50%,#c6c2e3 50%)']];
export const MODES = [['dark', 'Dunkel', 'linear-gradient(135deg,#3a3a3c,#1c1c1e)'], ['light', 'Hell', 'linear-gradient(135deg,#fff,#d8d8dc)']];
export const LOOKS = [['', 'Theme', 'linear-gradient(135deg,#d8d8dc,#8e8e93)'], ...THEMES];
export const SV = { light: [['', 'Standard'], ['fill', 'Füllstand']], value: [['', 'Standard'], ['value', 'Wert']], circle: [['', 'Standard'], ['circle', 'Kreis']], blind: [['', 'Standard'], ['blind', 'Fläche']], media: [['', 'Standard'], ['cover', 'Cover']], camera: [['', 'Standard'], ['live', 'Livebild']] };   // Stil-Varianten (Ideen-Galerie) je Kachel-Art
export const svOf = (t, states = {}) => { const d = t.e?.split('.')[0]; return d === 'light' ? SV.light : d === 'cover' ? (states[t.e]?.attributes.device_class === 'garage' ? null : SV.blind) : d === 'camera' ? SV.camera : d === 'media_player' ? SV.media : d === 'climate' ? SV.thermo : ['sensor', 'binary_sensor'].includes(d) ? SV.value : ['scene', 'script', 'switch', 'input_boolean', 'fan', 'button', 'input_button'].includes(d) ? SV.circle : null; };

export const SIZES = [['1x1', '1 × 1'], ['2x1', '2 × 1'], ['2x2', '2 × 2']];
export const COLORS = [['', 'Standard'], ['#ff9500', 'Orange'], ['#ff3b30', 'Rot'], ['#ff2d55', 'Rosa'], ['#af52de', 'Violett'], ['#007aff', 'Blau'], ['#30b0c7', 'Türkis'], ['#34c759', 'Grün']];
export const ICONS = ['bulb', 'pendant', 'lock', 'unlock', 'garage', 'blind', 'video', 'fan', 'timer', 'sun', 'moon', 'house', 'power', 'play', 'thermo', 'drop', 'wind', 'cloud', 'intercom', 'note'];

export const xi = id => `<svg><use href="#x-${id}"/></svg>`;
export const tileIcon = t => t.icon || (t.kind === 'clock' ? 'timer' : t.kind === 'wx' ? 'cloud' : (e => e?.domain === 'cover' && e.dc !== 'garage' ? 'blind' : ICON[t.e?.split('.')[0]])(entOf(t.e))) || 'house';
export const tileTitle = t => t.title || (t.kind === 'clock' ? 'Uhr' : t.kind === 'wx' ? 'Wetter' : entOf(t.e)?.name || t.e || 'Kachel');
export const autoTitle = en => ['sensor', 'binary_sensor'].includes(en.domain) ? en.name : DOM[en.domain]?.[0] || en.name;
