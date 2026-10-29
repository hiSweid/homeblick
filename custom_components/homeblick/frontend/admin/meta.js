// Konstanten und Hilfen für Faces, Kacheln, Themes und Vorlagen (aus dem bisherigen Admin übernommen).
import { tx, LOC } from '../i18n.js';
import { EN_NAMES, GROUP, ICON, normFaces, pack, rows } from '../faces.js';
import { entsIn } from './entities.js';
export { GROUP };
import { entOf, DOM, allEnts, energyPrefs } from './entities.js';
import { detect, ready } from './detect.js';
import { THEMES as OWN } from '../themes.js';
export const FACE = {
  grid: ['Smart Home', '#ff9500', 'grid'], music: [tx('Musik'), '#ff2d55', 'music'], bigclock: [tx('Uhr digital'), '#636366', 'clock'], analog: [tx('Uhr analog'), '#5856d6', 'clock'],
  calendar: [tx('Kalender'), '#ff3b30', 'cal'], date: [tx('Datum'), '#8e8e93', 'cal'], weather: [tx('Wetter'), '#32ade6', 'sun'], energy: [tx('Energie'), '#34c759', 'bolt'], info: ['Info', '#30b0c7', 'info'], cams: [tx('Kameras'), '#8e8e93', 'cam'], people: [tx('Personen'), '#5ac8fa', 'person'], todo: [tx('Aufgaben'), '#ff9500', 'check'], check: [tx('Haus-Check'), '#30d158', 'lock'], photos: [tx('Fotos'), '#ff2d55', 'cam'],
};
export const TYPES = Object.entries(FACE).map(([k, v]) => [k, v[0]]);
export const BG = [['auto', tx('Tageszeit')], ['black', tx('Schwarz')], ['white', tx('Weiß')], ['metal', tx('Metall')], ['prism', tx('Prisma')], ['teal', 'Teal'], ['champagne', tx('Champagner')], ['flow:232', 'Flow'], [30, tx('Orange')], [5, tx('Rot')], [340, tx('Rosa')], [285, tx('Violett')], [307, 'Pink'], [228, tx('Blau')], [205, tx('Türkis')], [212, tx('Himmel')], [150, tx('Grün')]];
export const STYLES = { weather: [['', tx('Kompakt')], ['cond', tx('Bedingungen')]], bigclock: [['stack', tx('Gestapelt')], ['line', tx('Lavalampe')], ['flow', 'Flow'], ['typo', 'Typograph'], ['rings', tx('Ringe')], ['solar', 'Solar Graph'], ['moon', tx('Mond')], ['modular', 'Modular']], analog: [['big', tx('Große Ziffern')], ['relief', 'Relief'], ['chrono', 'Chronograph'], ['utility', 'Utility'], ['meridian', 'Meridian']], info: [['events', tx('Termine')], ['music', tx('Musik')]] };
export const LEGACY = { bigclock: [['depth', tx('Tiefe')]], analog: [['numbers', tx('Zahlen')], ['ticks', tx('Striche')], ['minimal', tx('Minimal')]] };   // ohne Vorlage: nur sichtbar, wenn gespeichert
// Uhr und Kalender gibt es je Display nur einmal; Design (digital/analog bzw. Monat/Datum) und Farbe stellt man am Face ein. Wert = "Typ:Stil"
export const DESIGN = { clock: [['bigclock:stack', tx('Digital · Gestapelt')], ['bigclock:line', tx('Digital · Lavalampe')], ['bigclock:flow', tx('Digital · Flow')], ['bigclock:typo', tx('Digital · Typograph')], ['bigclock:rings', tx('Digital · Ringe')], ['bigclock:solar', tx('Digital · Solar Graph')], ['bigclock:moon', tx('Digital · Mond')], ['bigclock:modular', tx('Digital · Modular')], ['analog:big', tx('Analog · Große Ziffern')], ['analog:relief', tx('Analog · Relief')], ['analog:chrono', tx('Analog · Chronograph')], ['analog:utility', tx('Analog · Utility')], ['analog:meridian', tx('Analog · Meridian')], ['info:events', tx('Info · Termine')], ['info:music', tx('Info · Musik')]],
  calendar: [['calendar:', tx('Monat')], ['calendar:plain', tx('Monat schlicht')], ['calendar:week', tx('Woche')], ['calendar:sheet', tx('Blatt')]]};
// Kalender-Farbe (face.acc): '' = Apples Blau/Rot, Zahl = Farbton, 'gray' = Graphit
export const ACC = [['', tx('Blau & Rot')], [5, tx('Rot')], [30, tx('Orange')], [145, tx('Grün')], [190, tx('Türkis')], [275, tx('Violett')], [335, 'Pink'], ['gray', tx('Graphit')]];
export const accCss = v => v === '' ? 'linear-gradient(135deg,#0064ff 50%,#ff4646 50%)' : v === 'gray' ? '#8e8e93' : `hsl(${v} 85% 55%)`;
export const GNAME = { clock: tx('Uhr') };
export const faceName = x => (GNAME[GROUP[x.type]] || FACE[x.type]?.[0] || x.type) + (/\d+$/.exec(x.id) ? ' ' + /\d+$/.exec(x.id)[0] : '');   // nur der Zähler (grid2); die id bleibt beim Design-Wechsel stehen (bigclock → analog)
export const designs = f => DESIGN[GROUP[f.type]] ? DESIGN[GROUP[f.type]].concat((LEGACY[f.type] || []).filter(([v]) => v === f.style).map(([v, n]) => [`${f.type}:${v}`, `${{ bigclock: tx('Digital'), analog: tx('Analog'), info: 'Info' }[f.type]} · ${n}`])) : STYLES[f.type];
export const designCur = f => DESIGN[GROUP[f.type]] ? `${f.type}:${f.style || STYLES[f.type]?.[0][0] || ''}` : f.style || STYLES[f.type]?.[0][0];
export const withDesign = (cfg, f, v) => { if (!DESIGN[GROUP[f.type]]) return { ...f, style: v }; const [type, style] = v.split(':'); return { ...f, type, style: style || undefined }; };
export const WAKE = [['off', tx('Aus')], ['hey_jarvis', 'Hey Jarvis'], ['alexa', 'Alexa']];
export const bgCss = bg => bg === 'auto' ? 'linear-gradient(135deg,#ffb36b,#5a6bb5)' : bg === 'black' ? '#1c1c1e' : bg === 'white' ? '#f2f2f7' : bg === 'metal' ? 'linear-gradient(135deg,#b5c4d6,#8795ad)' : /^(prism|fan):\d+$/.test(bg) ? `linear-gradient(135deg,hsl(${bg.split(':')[1]} 70% 62%),hsl(${bg.split(':')[1]} 60% 28%))` : /^orb:\d+(:\d+)?$/.test(bg) || bg === 'champagne' ? (([, h, sat = 24]) => `radial-gradient(circle at 62% 66%,hsl(${h} ${sat}% 90%) 0 22%,transparent 23%),linear-gradient(135deg,hsl(${h} ${sat}% 76%),hsl(${h} ${sat}% 50%))`)(bg === 'champagne' ? [0, 38, 24] : bg.split(':')) : /^flow:\d+$/.test(bg) ? `radial-gradient(circle at 36% 40%,hsl(${bg.split(':')[1]} 85% 66%) 0 24%,transparent 25%),radial-gradient(circle at 68% 68%,hsl(322 85% 62%) 0 20%,transparent 21%),linear-gradient(135deg,#ecc9f7,#f488cc)` : bg === 'prism' ? 'linear-gradient(135deg,#8483f3,#3c3cae)' : bg === 'teal' ? 'linear-gradient(135deg,#4fae9f,#1d5f56)' : typeof bg === 'number' ? `linear-gradient(135deg,hsl(${bg} 75% 66%),hsl(${bg + 25} 70% 52%))` : '#8e8e93';
export const bgName = bg => BG.find(b => String(b[0]) === String(bg))?.[1] || BG_SETS.flatMap(g => g[1]).find(t => String(t[0]) === String(bg))?.[1] || tx('Foto');
export const bgVal = v => /^\d+$/.test(v) ? +v : v;

export const stripArea = (en, area) => area ? en.name.replace(new RegExp('^' + area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s:_-]*', 'i'), '').trim() : en.name;
export const tileOf = (en, area = en.area) => ({ e: en.id, title: stripArea(en, area) || autoTitle(en), sub: area, ...(['sensor', 'binary_sensor'].includes(en.domain) && { val: 'state' }) });

export const FACE_BG = { grid: 'auto', music: 'black', bigclock: 150, weather: 212, energy: 'auto', calendar: 'white', date: 'auto', analog: 150, info: 'auto', cams: 'black', people: 'auto', todo: 'auto', check: 'auto', photos: 'black' };
// Standard: alle wichtigen Ansichten. Was das Haus nicht hergibt (kein Player, kein Wetter, keine Kamera, kein evcc …), liegt versteckt bereit statt leer zu laufen.
const HAS = { music: e => e.domain === 'media_player', weather: e => e.domain === 'weather', cams: e => e.domain === 'camera', people: e => e.domain === 'person', todo: e => e.domain === 'todo', check: e => e.domain === 'lock' || (e.domain === 'binary_sensor' && ['door', 'window', 'opening', 'garage_door', 'moisture'].includes(e.dc)) };
export const energyGuess = () => detect(allEnts(), energyPrefs());   // Energie-Face: Entities aus Energie-Dashboard bzw. Namen/Einheiten
const stdHas = type => type === 'energy' ? ready(energyGuess()) : !HAS[type] || allEnts().some(HAS[type]);
export const SETUP = [   // [Schlüssel, Name, Beschreibung, Faces]
  ['std', tx('Standard'), tx('Alle wichtigen Ansichten, passend zu deinem Haus'), ['grid', 'music', 'bigclock', 'weather', 'calendar', 'energy', 'cams', 'people', 'todo', 'check']],
  ['room', tx('Raum-Panel'), tx('Kacheln aus dem Bereich, Musik, Wetter, Kalender und Uhr'), ['grid', 'music', 'weather', 'calendar', 'bigclock']],
  ['clock', tx('Uhr & Wetter'), tx('Uhr, Wetter, Kalender und Datum – ganz ohne Entities'), ['bigclock', 'weather', 'calendar', 'date']],
  ['all', tx('Alle Ansichten'), tx('Jede Ansicht einmal; was nicht passt, blendest du später aus'), Object.keys(FACE).filter(t => !['analog', 'info'].includes(t))],
];
export const ROOM_DOM = ['climate', 'light', 'cover', 'lock', 'scene', 'switch', 'fan', 'media_player', 'script'];   // Reihenfolge = Wichtigkeit
// Kacheln aus den Entities eines Bereichs: Thermostat groß, je Art höchstens 3, insgesamt 9 Zellen
export function roomTiles(area) {
  const pool = (area ? entsIn(area) : allEnts().filter(e => !e.hide)).filter(e => ROOM_DOM.includes(e.domain)).sort((a, b) => ROOM_DOM.indexOf(a.domain) - ROOM_DOM.indexOf(b.domain) || a.name.localeCompare(b.name, LOC));
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
  const types = SETUP.find(x => x[0] === key)[3], std = key === 'std', found = energyGuess(), ents = Object.keys(found).length ? { ...found, carName: tx('Auto‖Fahrzeug') } : null;   // „Auto“ statt „e-Golf“ (Standardname des Face)
  const mk = type => ({ type, bg: FACE_BG[type], ...(type === 'grid' && { tiles: roomTiles(area) }), ...(type === 'energy' && ents && { ents }) });
  const c = { cams: 1, energy: 1, dyn: 2, off: std ? types.filter(t => !stdHas(t)).map(mk) : [], faces: types.filter(t => !std || stdHas(t)).map(mk) };
  normFaces(c);
  return c;
}

export const ENERGY = [['pv', tx('Solar-Leistung')], ['grid', tx('Netz-Leistung (+ Bezug)')], ['home', tx('Hausverbrauch')], ['bat', tx('Batterie-Leistung (− Laden)')], ['soc', tx('Batterie-Ladestand')], ['car', tx('Auto: Ladeleistung')], ['carSoc', tx('Auto: Ladestand')], ['range', tx('Auto: Reichweite')], ['today', tx('Solar heute (kWh)')], ['todayFc', tx('Prognose heute (Solcast, Tageskurve)')], ['tomorrow', tx('Prognose morgen')], ['tomorrowPeak', tx('Morgen: Zeitpunkt Spitze')],
  // nur Detailansichten (Tipp auf eine Kachel); dritter Eintrag = Domains, sonst sensor
  ['pvPeak', tx('Detail Solar: Spitzenleistung heute')], ['pvPeakAt', tx('Detail Solar: Zeitpunkt Spitze heute')], ['day3', tx('Detail Heute/Morgen: Prognose Tag 3')], ['day4', tx('Detail Heute/Morgen: Prognose Tag 4')],
  ['solarPct', tx('Detail Autarkie: Solaranteil gesamt')], ['cap', tx('Detail Akku: Kapazität (kWh)')], ['batIn1', tx('Detail Akku: heute geladen (1)')], ['batOut1', tx('Detail Akku: heute entladen (1)')],
  ['batIn2', tx('Detail Akku: heute geladen (2)')], ['batOut2', tx('Detail Akku: heute entladen (2)')], ['carConn', tx('Detail Auto: verbunden'), ['binary_sensor']], ['carChg', tx('Detail Auto: lädt'), ['binary_sensor']],
  ['carRem', tx('Detail Auto: Restladedauer')], ['carLim', tx('Detail Auto: Ladelimit'), ['number']], ['carMode', tx('Detail Auto: Lademodus'), ['select']],
  ['sesE', tx('Detail Auto: Sitzung Energie')], ['sesSol', tx('Detail Auto: Sitzung Solaranteil')], ['sesPrice', tx('Detail Auto: Sitzung Preis')]];
export const TILE_DOM = ['light', 'switch', 'input_boolean', 'lock', 'cover', 'climate', 'scene', 'script', 'media_player', 'fan', 'timer', 'camera', 'button', 'input_button', 'sensor', 'binary_sensor'];
export const TOGGLE_DOM = ['light', 'switch', 'input_boolean', 'fan', 'cover', 'media_player', 'script'];   // Domains mit Dienst .toggle

// Hintergrund-Auswahl (gilt für das ganze Display): [Gruppe, [[bg, Name], …]]; Look und Hell/Dunkel stehen getrennt in cfg.theme / cfg.mode
export const BG_SETS = [
  [tx('Klassisch'), [['auto', tx('Tageszeit')], ['black', tx('Schwarz')], ['white', tx('Weiß')], ['metal', tx('Metall')]]],
  [tx('Kurven'), [[30, tx('Dämmerung')], [5, tx('Rot')], [25, tx('Pfirsich')], [50, tx('Gelb')], [150, tx('Grün')], [170, tx('Mint')], [205, tx('Türkis')], [212, tx('Himmel')], [228, tx('Blau')], [285, tx('Violett')], [307, 'Pink'], [340, tx('Rosa')]]],
  [tx('Prisma'), [['prism:245', tx('Prisma')], ['prism:222', tx('Saphir')], ['prism:212', tx('Ozean')], ['prism:255', tx('Mitternacht')], ['prism:165', tx('Nordlicht')], ['prism:152', tx('Smaragd')], ['prism:48', tx('Topas')], ['prism:35', tx('Bernstein')], ['prism:8', tx('Koralle')], ['prism:350', tx('Rubin')]]],
  [tx('Fächer'), [['fan:172', 'Teal'], ['fan:190', tx('Lagune')], ['fan:140', tx('Wald')], ['fan:160', tx('Mint')], ['fan:95', tx('Limette')], ['fan:42', tx('Gold')], ['fan:18', tx('Sonnenuntergang')], ['fan:330', tx('Beere')], ['fan:310', tx('Orchidee')], ['fan:285', tx('Amethyst')], ['fan:262', tx('Lavendel')]]],
  [tx('Kugeln'), [['champagne', tx('Champagner')], ['orb:12:30', tx('Roségold')], ['orb:210:4', tx('Silber')], ['orb:330:18', tx('Mauve')]]],
  ['Flow', [['flow:232', 'Flow'], ['flow:30', tx('Pfirsich')], ['flow:268', tx('Lila')], ['flow:190', tx('Aqua')]]],
];
export const THEME_TYPES = ['grid', 'analog', 'bigclock', 'energy', 'info', 'people', 'todo', 'check'];   // Faces, deren Hintergrund ein Theme mitnimmt (Foto-Hintergründe bleiben)
export const themeBg = f => !f.bg || typeof f.bg !== 'object';
export const themeGrid = cfg => cfg.faces.find(f => f.type === 'grid') || cfg.faces[0];
export const bgCur = cfg => { const b = themeGrid(cfg).bg; return { prism: 'prism:245', teal: 'fan:172' }[b] ?? b; };   // Kurzformen wie die Auswahl schreiben
export const bgAll = (cfg, v) => cfg.faces.forEach(f => { if (THEME_TYPES.includes(f.type) && themeBg(f)) f.bg = v; });
export const THEMES = [['liquid', 'Liquid', 'linear-gradient(135deg,#e29b56,#a8541a)'], ['flat', 'Flat', 'linear-gradient(135deg,#e8e8e8 50%,#c6c2e3 50%)']];
export const THEME_LIST = [...THEMES, ...OWN.map(t => [t.id, t.name, ''])];   // Look-Auswahl: Liquid, Flat und die eigenen Themes (themes.js)
export const MODES = [['dark', tx('Dunkel'), 'linear-gradient(135deg,#3a3a3c,#1c1c1e)'], ['light', tx('Hell'), 'linear-gradient(135deg,#fff,#d8d8dc)']];
export const LOOKS = [['', 'Theme', 'linear-gradient(135deg,#d8d8dc,#8e8e93)'], ...THEMES];
export const SV = { light: [['', tx('Standard')], ['fill', tx('Füllstand')]], value: [['', tx('Standard')], ['value', tx('Wert')]], circle: [['', tx('Standard')], ['circle', tx('Kreis')]], blind: [['', tx('Standard')], ['blind', tx('Fläche')]], spark: [['', tx('Standard')], ['value', tx('Wert')], ['spark', tx('Verlauf')]], media: [['', tx('Standard')], ['cover', tx('Cover')]], camera: [['', tx('Standard')], ['live', tx('Livebild')]] };   // Stil-Varianten (Ideen-Galerie) je Kachel-Art
export const svOf = (t, states = {}) => { const d = t.e?.split('.')[0]; return d === 'light' ? SV.light : d === 'cover' ? (states[t.e]?.attributes.device_class === 'garage' ? null : SV.blind) : d === 'camera' ? SV.camera : d === 'media_player' ? SV.media : d === 'climate' ? SV.thermo : d === 'sensor' ? SV.spark : d === 'binary_sensor' ? SV.value : ['scene', 'script', 'switch', 'input_boolean', 'fan', 'button', 'input_button'].includes(d) ? SV.circle : null; };

export const SIZES = [['1x1', '1 × 1'], ['2x1', '2 × 1'], ['2x2', '2 × 2']];
export const COLORS = [['', tx('Standard')], ['#ff9500', tx('Orange')], ['#ff3b30', tx('Rot')], ['#ff2d55', tx('Rosa')], ['#af52de', tx('Violett')], ['#007aff', tx('Blau')], ['#30b0c7', tx('Türkis')], ['#34c759', tx('Grün')]];
export const ICONS = ['bulb', 'pendant', 'lock', 'unlock', 'garage', 'blind', 'video', 'fan', 'timer', 'sun', 'moon', 'house', 'power', 'play', 'thermo', 'drop', 'wind', 'cloud', 'intercom', 'note'];

export const xi = id => `<svg><use href="#x-${id}"/></svg>`;
const EN_ICON = { pv: 'sun', aut: 'power', use: 'house', bat: 'power', car: 'garage', day: 'sun', tmr: 'sun' };
export const tileIcon = t => t.icon || (t.kind === 'clock' ? 'timer' : t.kind === 'wx' ? 'cloud' : t.kind === 'multi' ? (t.dom === 'cover' ? 'blind' : ICON[t.dom]) : t.kind === 'en' ? EN_ICON[t.k] : (e => e?.domain === 'cover' && e.dc !== 'garage' ? 'blind' : ICON[t.e?.split('.')[0]])(entOf(t.e))) || 'house';
export const tileTitle = t => t.title || (t.kind === 'clock' ? tx('Uhr') : t.kind === 'wx' ? tx('Wetter') : t.kind === 'multi' ? tx('Gruppe') : t.kind === 'en' ? EN_NAMES[t.k] : entOf(t.e)?.name || t.e || tx('Kachel'));
export const autoTitle = en => ['sensor', 'binary_sensor'].includes(en.domain) ? en.name : DOM[en.domain]?.[0] || en.name;
