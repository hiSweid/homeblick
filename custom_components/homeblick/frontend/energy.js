import { EN_NAMES } from './faces.js';
import { bins, smooth } from './curve.js';
// Energie-Face. Vorlage = Entwurf 1 des Users (statt Apple-Bildern; Bild scratchpad en/Entwurf1.png, Mockup en/m5.html Abschnitt #d1, Maße dort in cqw bei 784 px).
// Raster/Glas/Press/Analoguhr = Home-Face (.f-grid/.tile/.dial aus index.html), Zahlen-Roll = roll() aus index.html, Federn = --spring/--sd.
// Reihe 1: Solar jetzt 2×1 (kW + Tageskurve: Ist gelb gefüllt, Rest gestrichelte Solcast-Prognose) · autark (Ring)
// Reihe 2: Verbrauch (Haus-kW, Netzbalken: Mitte = 0, rechts grün Einspeisung, links orange Bezug) · Akku · e-Golf (weiße An-Kacheln)
// Reihe 3: Heute (kWh von Prognose) · Morgen (Prognose + Spitzenzeit) · Analoguhr
// Das sind die Standard-Kacheln (ENERGY_TILES in faces.js): jede ist eine Kachel (kind 'en') der Kachelliste des Face und lässt sich wie bei „Smart Home“ verschieben, vergrößern, umbenennen, entfernen und doppelt anlegen.

// HA-Entities (Prod-HA geprüft 2026-10-21), im Live-Editor je Face änderbar (f.ents). Leistung in W oder kW (Einheit wird gelesen).
// Netz: + = Bezug, − = Einspeisung; Akku: + = Entladen, − = Laden
export const E = {
  pv: 'sensor.evcc_pv_power', home: 'sensor.evcc_home_power', grid: 'sensor.evcc_grid_power',
  bat: 'sensor.evcc_battery_power', soc: 'sensor.evcc_battery_soc',
  car: 'sensor.evcc_garage_charge_power', carSoc: 'sensor.evcc_garage_vehicle_soc', range: 'sensor.evcc_garage_vehicle_range',
  today: 'sensor.kostal_piko_daily_energy', todayFc: 'sensor.solcast_pv_forecast_prognose_heute',
  tomorrow: 'sensor.solcast_pv_forecast_prognose_morgen', tomorrowPeak: 'sensor.solcast_pv_forecast_zeitpunkt_spitzenleistung_morgen',
  // nur Detailansichten
  pvPeak: 'sensor.solcast_pv_forecast_prognose_spitzenleistung_heute', pvPeakAt: 'sensor.solcast_pv_forecast_zeitpunkt_spitzenleistung_heute',
  day3: 'sensor.solcast_pv_forecast_prognose_tag_3', day4: 'sensor.solcast_pv_forecast_prognose_tag_4', solarPct: 'sensor.evcc_stat_total_solar_percentage',
  cap: 'sensor.evcc_battery_capacity', batIn1: 'sensor.marstek_venus_modbus_total_daily_charging_energy_2', batOut1: 'sensor.marstek_venus_modbus_total_daily_discharging_energy_2',
  batIn2: 'sensor.marstek_venus_modbus_rechts_total_daily_charging_energy', batOut2: 'sensor.marstek_venus_modbus_rechts_total_daily_discharging_energy',
  carConn: 'binary_sensor.evcc_garage_connected', carChg: 'binary_sensor.evcc_garage_charging', carRem: 'sensor.evcc_garage_charge_remaining_duration',
  carLim: 'number.evcc_garage_limit_soc', carMode: 'select.evcc_garage_mode',
  sesE: 'sensor.evcc_garage_session_energy', sesSol: 'sensor.evcc_garage_session_solar_percentage', sesPrice: 'sensor.evcc_garage_session_price',
};
const E0 = { ...E };
let CAR = 'e-Golf';   // Name der Auto-Kachel; erkannte Konfigurationen sagen „Auto“ (ents.carName), im Editor änderbar
export const energyEnts = (m = {}) => { for (const k in E) E[k] = m[k] || E0[k]; CAR = m.carName || 'e-Golf'; };

// Symbole aus dem Entwurf (m5.html)
const SYM = {
  sun: '<circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/><path d="M12 1.8v2.5M12 19.7v2.5M1.8 12h2.5M19.7 12h2.5M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7"/>',
  home: '<path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  bat: '<rect x="6.5" y="4.5" width="11" height="17" rx="2.4"/><path d="M10 2.5h4M9.5 14.5l2.5-4v3h2.5l-2.5 4v-3z" stroke-width="1.4"/>',
  car: '<path d="M3.5 15.5v-3l2-5.2A2 2 0 0 1 7.4 6h9.2a2 2 0 0 1 1.9 1.3l2 5.2v3M3.5 15.5h17M3.5 15.5V18h2.6v-2.5M20.5 15.5V18h-2.6v-2.5M3.8 12.5h16.4"/>',
};
const de = (v, d = 1) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const kw = w => de(Math.abs(w) / 1000);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const still = () => root.classList.contains('perf') || matchMedia('(prefers-reduced-motion: reduce)').matches;   // Leistungsmodus / weniger Bewegung
const SPR = () => getComputedStyle(root).getPropertyValue('--spring').trim() || 'ease-out';

const cell = (r, c, w = 1) => `grid-area:${r + 1}/${c + 1}/span 1/span ${w};--r:${r};--c:${c}`;
const ttl = (s, t, cls = '') => `<div class="ttl"><svg class="i ${cls}" viewBox="0 0 24 24">${SYM[s]}</svg> ${t}</div>`;
const val = (k, u = '') => `<div class="enum"><b class="num" data-bind="e_${k}" data-digits></b>${u && `<small>${u}</small>`}</div>`;
const bar = k => `<div class="bar ${k}"><div class="cl"><i></i></div></div>`;
let gN = 0;

// Kurve einmal einzeichnen, wenn das Face steht (≥ 95 % sichtbar = Pager eingerastet); ganz weg → beim nächsten Erscheinen wieder
const io = new IntersectionObserver(es => { for (const e of es) {
  const f = e.target;
  if (e.intersectionRatio >= .95 && !f._drawn) { f._drawn = true; drawIn(f); }
  else if (!e.isIntersecting && f._drawn) { f._drawn = false; veil(f, !still()); }
} }, { threshold: [0, .95] });

const esc = s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
// Kachel (kind 'en') → { cls, html }; index.html tileEl setzt Raster-Platz und Größe. Inhalt steht in .ez: bei 2 × 2 wird er auf das Doppelte gezogen (--z), sonst wie Entwurf 1.
export function energyTile(t) {
  const k = t.k, g = 'eg' + ++gN, nm = esc(t.title || (k === 'car' ? CAR : EN_NAMES[k]));
  const html = {
    pv: () => `${ttl('sun', nm, 'y')}${val('pv', ' kW')}
  <div class="cw"><div class="ci"><svg viewBox="0 0 100 30" preserveAspectRatio="none"><defs><linearGradient id="${g}" x2="0" y2="1"><stop offset="0" stop-color="#ffd60a" stop-opacity=".6"/><stop offset="1" stop-color="#ffd60a" stop-opacity="0"/></linearGradient></defs>
    <path class="ar" fill="url(#${g})"/><path class="ln"/><path class="fc"/></svg></div></div>`,
    aut: () => `<svg class="rg" viewBox="-50 -50 100 100"><circle r="44"/><circle class="on" r="44" pathLength="100" transform="rotate(-90)"/></svg>${val('aut', '%')}<div class="sub">${esc(t.title || 'autark')}</div>`,
    use: () => `${ttl('home', nm)}${val('home', ' kW')}<div class="bar g mid"><div class="cl l"><i></i></div><div class="cl r"><i></i></div></div><div class="sub gl" data-bind="e_gl"></div>`,
    bat: () => `${ttl('bat', nm, 'gr')}${val('soc', '%')}${bar('soc')}<div class="sub" data-bind="e_batl"></div>`,
    car: () => `${ttl('car', nm, 'bl')}${val('carSoc', '%')}${bar('carSoc')}<div class="sub" data-bind="e_carl"></div>`,
    day: () => `${ttl('sun', nm, 'y')}${val('today')}<div class="sub dim" data-bind="e_todayl"></div>${bar('today')}`,
    tmr: () => `${ttl('sun', nm)}${val('tomorrow')}<div class="sub dim">kWh Prognose</div><div class="sub pk" data-bind="e_peak"></div>`,
  }[k]();
  const sz = `${t.w || 1}x${t.h || 1}`, z = k !== 'pv' && sz === '2x2' ? 2 : 1;
  return { cls: `tile et${k === 'bat' || k === 'car' ? ' on' : ''} ${k}`, z, html: `<div class="ez" style="--z:${z}">${html}</div>` };
}
// Kurve und Wischblende gehören zu den Solar-Kacheln (.cw) – ohne sie bleibt alles still
export function energyFace(el) {
  el.classList.add('f-grid');   // Raster/Glas/Uhr des Home-Face
  veil(el, !still());   // Kurve bis zum Einzeichnen verdeckt, auch während das Face hereingleitet
  io.observe(el);
  if (V) paint(el);
}

// ---------- Tageskurve ----------
// Ist = HA-History der PV-Leistung (Demo: simuliert), Prognose = Solcast detailedForecast (pv_estimate kW je 30 min) des Heute-Sensors
let H = [], F = [], FB = [];   // [[ms, W]]; FB = Prognose-Band [[ms, W10, W90]]
const HD = { home: [], grid: [], soc: [] };   // Detailansichten: Verlauf heute (Haus/Netz in W, Akku in %)
let histFn = null, histAt = 0, demo = false, CALL = null, CLOSE = null;
// fn(ids, start) → Promise<{id: [{s, lu}]}> (WS history/history_during_period); o.call = callService aus index.html (Demo: nie aufgerufen), o.close = Vollbild schließen
export function energyInit(fn, o = {}) { histFn = fn; CALL = o.call; CLOSE = o.close; }
const day0 = () => new Date().setHours(0, 0, 0, 0);
const isKW = s => /^kW$/i.test(s?.attributes.unit_of_measurement);
const hpts = (l, f = 1) => (l || []).map(x => [(x.lu ?? x.lc) * 1000, parseFloat(x.s) * f]).filter(p => isFinite(p[1]) && isFinite(p[0]));
// Detail öffnen: Verlauf heute von Haus, Netz, Akku-Ladestand einmal holen, danach schreibt energy() live fort
async function loadDet(ents) {
  if (demo || !histFn) return;
  const ks = ['home', 'grid', 'soc'].filter(k => ents[E[k]]);
  try {
    const r = await histFn(ks.map(k => E[k]), new Date(day0()));
    if (!r) return;
    for (const k of ks) HD[k] = hpts(r[E[k]], k !== 'soc' && isKW(ents[E[k]]) ? 1000 : 1);
    detail();
  } catch (e) { console.warn('Energie-History (Detail)', e); }
}
async function loadHist(ents) {
  if (demo || !histFn || !ents[E.pv] || Date.now() - histAt < 3e5) return;
  histAt = Date.now();
  try {
    const r = await histFn([E.pv], new Date(day0()));
    if (!r) return void (histAt = 0);   // noch keine Verbindung
    H = hpts(r[E.pv], isKW(ents[E.pv]) ? 1000 : 1);
    for (const f of $$('.f-energy')) paint(f);
    detail();
  } catch (e) { histAt = Date.now() - 24e4; console.warn('Energie-History', e); }   // nach 1 min neu versuchen
}
const rec = (A, v, now = Date.now()) => {   // Live-Werte anhängen (höchstens jede Minute), Mitternacht schneidet ab
  const d = day0();
  while (A.length && A[0][0] < d) A.shift();
  if (v != null && (!A.length || now - A.at(-1)[0] >= 6e4)) A.push([now, v]);
};
// Fläche 100×30 wie im Entwurf: x = Erzeugungsfenster laut Prognose (sonst 6–21 Uhr), y = 30 (0 W) … 2 (Tagesspitze aus Ist/Prognose)
// band: Detailansicht mit Solcast-Band 10–90 % (geht in die Skala ein); t0/t1/peak für die Achse
function curve(band) {
  const now = Date.now(), d = day0(), nz = F.filter(p => p[1] > 0);
  const t0 = nz.length ? nz[0][0] - 36e5 : d + 6 * 36e5, t1 = nz.length ? nz.at(-1)[0] + 36e5 : d + 21 * 36e5;   // F-Punkte = Periodenmitte; ±1 h = Nullpunkt mit Rand
  const peak = Math.max(1000, ...H.filter(p => p[0] >= d).map(p => p[1]), ...F.map(p => p[1]), ...(band ? FB.map(p => p[2]) : []));
  const P = ([t, v]) => [100 * (t - t0) / (t1 - t0), 30 - 28 * Math.max(0, v) / peak];
  const ist = now > t0 ? bins(H, t0, Math.min(now, t1), 9e5).map(P) : [];
  if (ist.length) ist.unshift([0, 30]);
  const end = ist.at(-1), rest = F.filter(p => p[0] > Math.max(now, t0) + 18e5 && p[0] < t1).map(P);
  const fc = rest.length ? [end || P([t0, 0]), ...rest, [100, 30]] : [];
  const ln = ist.length > 1 ? smooth(ist) : '';
  const fb = FB.filter(p => p[0] > t0 && p[0] < t1), hi = fb.map(([t, , w]) => P([t, w])), lo = fb.map(([t, w]) => P([t, w])).reverse();
  const bd = band && hi.length > 1 ? `${smooth([[0, 30], ...hi, [100, 30]])}L${smooth([[100, 30], ...lo, [0, 30]]).slice(1)}Z` : '';
  return { ln, ar: ln && `${ln}V30H0Z`, fc: fc.length > 1 ? smooth(fc) : '', bd, t0, t1, peak };
}
function paint(f) {
  const c = V.ok?.pv ? curve() : { ln: '', ar: '', fc: '' };
  for (const k of ['ln', 'ar', 'fc']) for (const p of f.querySelectorAll('.cw .' + k)) if (p.getAttribute('d') !== c[k]) p.setAttribute('d', c[k]);
}
// Einzeichnen per Wischblende (nur transform): Fenster nach links geschoben, Inhalt gegenläufig → verdeckt; weiche Kante liegt in Ruhe rechts neben der Kurve
const VEIL = ['translateX(-29cqw)', 'translateX(29cqw)'];
function veil(f, on) { for (const cw of f.querySelectorAll('.cw')) [cw, cw.firstElementChild].forEach((n, i) => n.style.transform = on ? VEIL[i] : ''); }
function drawIn(f) {
  if (still()) return veil(f, false);
  const o = { duration: 1600, easing: SPR(), fill: 'forwards' };   // Feder gestreckt: zeichnet weich von links nach rechts
  const as = [...f.querySelectorAll('.cw')].flatMap(cw => [cw, cw.firstElementChild].map((n, i) => n.animate([{ transform: VEIL[i] }, { transform: 'none' }], o)));
  if (as[0]) as[0].onfinish = () => { veil(f, false); as.forEach(a => a.cancel()); };
}

// ---------- Anzeige ----------
let V = null, R = null;   // letzter Stand ({ ok, x: Werte je Schlüssel, st }); roll() aus index.html
export const energyNow = () => V && { pv: V.x.pv, soc: V.x.soc, okPv: V.ok.pv, okSoc: V.ok.soc };   // für das Modular-Watchface
const bd = (k, t) => { for (const e of $$(`[data-bind="${k}"]`)) if (e.textContent !== t) e.textContent = t; };
// Zahl rollen; Richtung aus dem Wert (steigt → nach oben, sinkt → nach unten wie STEUERUNG P2-5)
const rb = (k, t) => { for (const el of $$(`[data-bind="${k}"]`)) {
  const o = el.lastElementChild;
  if (o?.textContent === t) continue;
  const a = parseFloat(o?.textContent.replace(',', '.')), b = parseFloat(t.replace(',', '.'));
  R(el, t, !o || still() || isNaN(a) || isNaN(b) ? 0 : b < a ? -1 : 1);
} };
const hhmm = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); };

// Aus index.html bei jedem render(); roll = Zahlen-Roll (index.html)
export function energy(ents, roll) {
  R = roll;
  const st = k => ents[E[k]], has = k => !!st(k) && isFinite(parseFloat(st(k).state));
  const v = k => { const s = st(k), u = s?.attributes.unit_of_measurement || '', x = parseFloat(s?.state); return !has(k) ? 0 : /^kW$/i.test(u) ? x * 1000 : /^Wh$/i.test(u) ? x / 1000 : x; };   // Leistung → W, Energie → kWh
  const ok = Object.fromEntries(Object.keys(E).map(k => [k, has(k)]));
  const x = Object.fromEntries(Object.keys(E).map(k => [k, v(k)]));
  for (const k of ['pv', 'home', 'car']) x[k] = Math.max(0, x[k]);   // Erzeugung, Verbrauch und Ladeleistung sind nie negativ (Messrauschen/Offset würde sonst als Wert erscheinen und -0,0 kW/Verlauf verzerren)
  const { pv, home, grid, bat, soc, car, carSoc, range, today, todayFc, tomorrow } = x;
  const fa = st('todayFc')?.attributes, fl = fa?.detailedForecast || fa?.detailedHourly || [];
  const step = fl.length > 1 ? Date.parse(fl[1].period_start) - Date.parse(fl[0].period_start) : 0;
  const inDay = p => isFinite(p[0]) && isFinite(p[1]) && p[0] >= day0() && p[0] < day0() + 864e5;
  F = fl.map(p => [Date.parse(p.period_start) + step / 2, p.pv_estimate * 1000]).filter(inDay);
  FB = fl.map(p => [Date.parse(p.period_start) + step / 2, p.pv_estimate10 * 1000, p.pv_estimate90 * 1000]).filter(p => inDay(p) && isFinite(p[2]));
  if (ok.pv) rec(H, pv);
  for (const k of ['home', 'grid', 'soc']) if (ok[k]) rec(HD[k], x[k]);
  V = { ok, x, st };
  loadHist(ents);
  detail();
  const faces = $$('.f-energy');
  if (!faces.length) return;
  const n = (k, t) => rb('e_' + k, ok[k] ? t : '–');
  n('pv', kw(pv)); n('home', kw(home)); n('soc', String(Math.round(soc))); n('carSoc', String(Math.round(carSoc))); n('today', de(today)); n('tomorrow', de(tomorrow));
  const imp = grid > 50, exp = grid < -50;   // |Netz| ≤ 50 W = Regelrauschen → 0 (Text, Balken und Autarkie gleich)
  const all = home + car;   // evcc-Hausverbrauch schließt die Ladepunkte nicht ein (Demo: Netz = Haus + Auto − PV − Akku) → Auto addieren, sonst 0 % obwohl das Haus aus PV läuft
  const aut = ok.home && ok.grid ? (all > 0 ? Math.round(100 * (1 - Math.min(1, (imp ? grid : 0) / all))) : 100) : null;   // Autarkie = 1 − Netzbezug / Verbrauch (Haus + Auto)
  rb('e_aut', aut == null ? '–' : String(aut));
  // „Bezug“ statt „aus dem Netz“: passt auch bei ≥ 10 kW (Wallbox) in die 1×1-Kachel (3 cqw), sonst abgeschnitten
  bd('e_gl', !ok.grid ? '' : imp ? `↓ ${kw(grid)} kW Bezug` : exp ? `↑ ${kw(grid)} kW ins Netz` : '0,0 kW Netz');
  bd('e_batl', !ok.bat ? '' : bat < -50 ? `lädt · ${kw(bat)} kW` : bat > 50 ? `entlädt · ${kw(bat)} kW` : 'bereit');
  bd('e_carl', ok.car && car > 50 ? `lädt · ${kw(car)} kW` : ok.range ? `${Math.round(range)} km` : '');
  bd('e_todayl', ok.todayFc ? `kWh von ${de(todayFc)}` : 'kWh');
  const pk = hhmm(st('tomorrowPeak')?.state);
  bd('e_peak', pk ? `☀︎ Spitze ${pk}` : '');
  const c01 = x => Math.min(1, Math.max(0, x));
  for (const f of faces) {
    const set = (s, k, x, show = true) => { for (const b of f.querySelectorAll(s)) { b.style.setProperty(k, x); b.style.visibility = show ? '' : 'hidden'; } };
    set('.rg .on', '--v', aut == null ? 0 : aut / 100);
    set('.bar.g', '--g', imp || exp ? Math.max(-1, Math.min(1, -grid / 4000)) : 0, ok.grid);   // ponytail: halbe Balkenbreite = 4 kW, darüber voll
    set('.bar.soc', '--v', c01(soc / 100), ok.soc);
    set('.bar.carSoc', '--v', c01(carSoc / 100), ok.carSoc);
    set('.bar.today', '--v', c01(today / todayFc), ok.today && ok.todayFc && todayFc > 0);
    for (const [t, has] of [['bat', ok.soc || ok.bat], ['car', ok.carSoc || ok.car], ['day', ok.today], ['tmr', ok.tomorrow]]) for (const n of f.querySelectorAll('.tile.' + t)) n.classList.toggle('na', !has);   // ohne passende Entity abgeblendet
    for (const gl of f.querySelectorAll('.gl')) { gl.classList.toggle('imp', imp); gl.classList.toggle('z', !imp && !exp); }
    paint(f);
  }
}

// ---------- Detailansichten ----------
// Tipp auf eine Kachel (außer Uhr) → Vollbild #edet (index.html); Öffnen/Schließen = fly() wie Klima/Licht (FLIP aus der Kachel, #dim, weiße Karte, Chrome gestaffelt).
// Vorlagen: Kopf (✕, Titel, Uhr) und Zahl Medium = Vollbild Klima/Licht (_Tbq 01260, y-MO 00005, Maße wie #climate/#dimmer);
// Aufbau „Werte mittig, darunter Glaskarte mit Titel, Untertitel, Segment und Stundenleiste“ = Wetter-Detail y-MO 08900 (Klassen .wcard/.wsub/.wseg/.whours aus weather.js, gleiche Maße).
// Hintergrund = Wallpaper-Blur des Face, also das Kachelglas im Großen. Ohne Vorlage (Annahme): Karteninhalte (Kurven, Stundenbalken, Anteile, Ladesteuerung), Wisch runter / Escape.
const DT = { pv: 'Solar', aut: 'Autarkie', use: 'Verbrauch', bat: 'Akku', get car() { return CAR; }, day: 'Heute', tmr: 'Morgen' };
const MODE = { off: 'Aus', now: 'Sofort', minpv: 'Min+PV', pv: 'PV' };
const WD = { Monday: 'Mo', Tuesday: 'Di', Wednesday: 'Mi', Thursday: 'Do', Friday: 'Fr', Saturday: 'Sa', Sunday: 'So' };   // Solcast dayname (englisch)
const BOLT = '<path d="M13.5 2.5 5.5 13.5h5.8l-1.3 8 8-11h-5.8z" fill="currentColor" stroke="none"/>';
let dk = null, sg = 'home', hold = {}, drag = null;   // offenes Detail, Segment Verbrauch, lokale Werte bis HA nachzieht (Modus/Limit), Limit-Ziehen
const $d = () => document.getElementById('edet');
const hx = (v, s) => `${v}<small> ${s}</small>`;
// Stundenbalken: mind. eine Balkenbreite hoch (2,8 von 13 cqw), sonst schneidet die Rundung der .hb ein Oval; „0,0“ (< 50 Wh) → kein Balken
const hv = (w, max, c) => w >= 50 ? `<i class="${c}" style="--v:${Math.max(w / max, .215).toFixed(3)}"></i>` : '';
const chart = (g, svg) => `<div class="ech"><div class="cv"><div class="cvi"><svg viewBox="0 0 100 30" preserveAspectRatio="none"><defs><linearGradient id="${g}" x2="0" y2="1"><stop offset="0" style="stop-color:var(--c);stop-opacity:.55"/><stop offset="1" style="stop-color:var(--c);stop-opacity:0"/></linearGradient></defs>${svg.replaceAll('#G', `url(#${g})`)}</svg></div></div><div class="ax"></div></div>`;
const area = '<path class="ar" fill="#G"/><path class="ln"/>';
const card = (t, inner, head = '') => `<section class="wcard"><header><div><b>${t}</b><span class="wsub" data-bind="d_s"></span></div>${head}</header>${inner}</section>`;
const strip = (c = '') => `<div class="whours ${c}" data-h></div>`;
function body(k, g) {
  const u = { pv: 'kW', aut: '%', use: 'kW', bat: '%', car: '%', day: 'kWh', tmr: 'kWh' }[k], b = { bat: 'gr', car: 'bl', day: 'y' }[k];
  const hero = `<div class="dh${b ? ' wb' : ''}"><div class="dl" data-bind="d_l"></div><div class="dv"><b class="num" data-bind="d_v" data-digits></b><small>${u}</small></div>`
    + (b ? `<div class="dbr ${b}"><div class="cl"><i></i></div>${k === 'car' ? '<b class="lm"></b>' : ''}</div>` : '') + '<div class="dm m1" data-bind="d_m1"></div><div class="dm m2" data-bind="d_m2"></div></div>';
  const lt = '<div class="t"><span>Ladelimit</span><b data-bind="d_lim"></b></div>';
  return hero + {
    pv: () => card('Tagesverlauf', chart(g, '<path class="bd"/>' + area + '<path class="fc"/>') + strip()),
    aut: () => card('Verbrauch jetzt', `<div class="sb"><i class="so"></i><i class="ak"></i><i class="nz"></i></div>${strip('ecol')}`),
    use: () => card('Tagesverlauf', chart(g, `<g class="hh">${area}</g><clipPath id="${g}a"><rect class="ka" width="100"/></clipPath><clipPath id="${g}b"><rect class="kb" width="100"/></clipPath>`
      + `<g class="gg ex" clip-path="url(#${g}a)"><path class="ar"/><path class="ln"/></g><g class="gg im" clip-path="url(#${g}b)"><path class="ar"/><path class="ln"/></g><path class="gg z"/>`),
      `<div class="wseg">${[['home', SYM.home], ['grid', BOLT]].map(([s, p]) => `<button data-sg="${s}" aria-label="${s === 'home' ? 'Haus' : 'Netz'}"><i class="wi"><svg viewBox="0 0 24 24">${p}</svg></i></button>`).join('')}</div>`),
    bat: () => card('Ladestand heute', chart(g, area) + strip('ecol')),
    car: () => card('Laden', `<div class="wseg emode"></div><div class="sl" role="slider" tabindex="0" aria-label="Ladelimit">${lt}<div class="f"><div class="in">${lt}</div></div></div>${strip('ecol')}`),
    day: () => card('Stunden heute', strip('ebars')),
    tmr: () => card('Stunden morgen', strip('ebars')),
  }[k]();
}
export function energyDetail(k, tile) {
  const view = $d(), f = tile.closest('.face');
  dk = k; sg = 'home'; hold = {}; drag = null;
  view.className = 'view ' + k + (still() ? '' : ' ni');   // ni: Balken/Werte stehen auf 0, bis die Karte aufgeklappt ist
  for (const c of ['light', 'mono']) view.classList.toggle(c, f.classList.contains(c));
  view.style.setProperty('--wpb', f.style.getPropertyValue('--wpb') || 'none');
  view.style.setProperty('--wp', f.style.getPropertyValue('--wp') || 'none');   // deckend unter dem Blur (dessen Rand läuft transparent aus)
  view.style.setProperty('--h', f.style.getPropertyValue('--h') || '220');
  view.style.setProperty('--eb', getComputedStyle(f).backgroundColor);
  view.dataset.sg = sg;
  bd('d_t', DT[k]);
  $('.ed', view).innerHTML = body(k, 'ed' + ++gN);
  wire(view);
  loadDet(V?.st ? Object.fromEntries(['home', 'grid', 'soc'].map(x => [E[x], V.st(x)]).filter(e => e[1])) : {});
  detail(true);
  if (still()) return;
  setTimeout(() => view.classList.remove('ni'), 170);   // nach der Expansion (fly ≈ 170 ms): Balken federn, Werte gleiten ein
  wipe(view, 170);
}
// Kurve einzeichnen wie auf dem Face: Fenster und Inhalt gegenläufig (nur transform), weiche Kante läuft vorneweg
function wipe(view, delay = 0) {
  const cv = $('.cv', view);
  if (!cv || still()) return;
  const o = { duration: 1600, delay, easing: SPR(), fill: 'backwards' };
  cv.getAnimations().forEach(a => a.cancel()); cv.firstElementChild.getAnimations().forEach(a => a.cancel());
  cv.animate([{ transform: 'translateX(-88cqw)' }, { transform: 'none' }], o);
  cv.firstElementChild.animate([{ transform: 'translateX(88cqw)' }, { transform: 'none' }], o);
}
const $ = (s, r = document) => r.querySelector(s);
// Dienste: live über callService (index.html), in der Demo nur der Simulationszustand
function svc(domain, service, data) {
  if (demo) { if (service === 'select_option') S.mode = data.option; if (service === 'set_value') S.lim = data.value; return; }
  CALL?.(domain, service, data);
}
function limA() {
  const s = V?.st('carLim'), a = s?.attributes || {}, v = parseFloat(s?.state);
  return isFinite(v) ? { v, min: a.min ?? 0, max: a.max ?? 100, step: a.step || 1 } : null;
}
const held = k => hold[k] && Date.now() < hold[k][1] ? hold[k][0] : null;
function wire(view) {
  if (view._w) return;
  view._w = true;
  view.addEventListener('click', e => {
    const b = e.target.closest('.wseg button');
    if (!b) return;
    if (b.dataset.sg) { sg = view.dataset.sg = b.dataset.sg; detail(); wipe(view); }
    else if (b.dataset.mode) { hold.mode = [b.dataset.mode, Date.now() + 5e3]; svc('select', 'select_option', { entity_id: E.carMode, option: b.dataset.mode }); detail(); }
  });
  // Ladelimit: relativ ziehen wie die Regler im Kontrollzentrum (Tippen springt nicht), Senden beim Loslassen
  const snap = (a, v) => Math.min(a.max, Math.max(a.min, a.min + Math.round((v - a.min) / a.step) * a.step));
  const send = v => { hold.lim = [v, Date.now() + 5e3]; svc('number', 'set_value', { entity_id: E.carLim, value: v }); detail(); };
  let sw = null;   // Wisch runter schließt (Annahme; belegt ist nur ✕)
  view.addEventListener('pointerdown', e => {
    if (e.button) return;
    const s = e.target.closest('.sl'), a = s && limA();
    if (a) { drag = { x: e.clientX, v: held('lim') ?? a.v, w: s.clientWidth, a }; s.setPointerCapture(e.pointerId); s.classList.add('drag'); return; }
    if (!e.target.closest('.x')) sw = { x: e.clientX, y: e.clientY };
  });
  view.addEventListener('pointermove', e => {
    if (drag) { const v = snap(drag.a, drag.v + (e.clientX - drag.x) / drag.w * (drag.a.max - drag.a.min)); if (v !== held('lim')) { hold.lim = [v, Infinity]; detail(); } return; }
    if (sw && e.clientY - sw.y > .12 * view.clientHeight && e.clientY - sw.y > 2 * Math.abs(e.clientX - sw.x)) { sw = null; CLOSE?.(); }
  });
  for (const n of ['pointerup', 'pointercancel']) view.addEventListener(n, () => {
    sw = null;
    if (!drag) return;
    $('.sl', view).classList.remove('drag'); drag = null;
    const v = held('lim'); if (v != null) send(v);
  });
  view.addEventListener('keydown', e => {
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key], a = e.target.closest('.sl') && limA();
    if (d && a) { e.preventDefault(); send(snap(a, (held('lim') ?? a.v) + d * a.step)); }
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && dk && !view.hidden) CLOSE?.(); });
}
// Stundenwerte (W Mittel = kWh): detailedHourly, sonst detailedForecast (30 min) zu Stunden zusammengefasst
function hourly(s) {
  const a = s?.attributes || {};
  if (a.detailedHourly?.length) return a.detailedHourly.map(p => [Date.parse(p.period_start), p.pv_estimate * 1000]).filter(p => isFinite(p[0]) && isFinite(p[1]));
  const m = new Map();
  for (const p of a.detailedForecast || []) { const t = new Date(p.period_start).setMinutes(0, 0, 0); if (isFinite(t) && isFinite(p.pv_estimate)) m.set(t, (m.get(t) || 0) + p.pv_estimate * 500); }
  return [...m];
}
const hr = t => new Date(t).getHours();
const wdOf = (k, n) => WD[V.st(k)?.attributes.dayname] || new Date(day0() + n * 864e5 + 432e5).toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2);
const setD = (p, d) => { if (p && p.getAttribute('d') !== d) p.setAttribute('d', d); };
const setH = (el, h) => { if (el && el._h !== h) { el._h = h; el.innerHTML = h; } };
// Tagesachse: Beschriftung alle `every` Stunden innerhalb t0…t1
function axis(view, t0, t1, every) {
  let h = '';
  for (let t = new Date(t0).setMinutes(0, 0, 0) + 36e5; t < t1; t += 36e5) if (hr(t) % every === 0 && t - t0 > 18e5 && t1 - t > 18e5) h += `<span style="left:${(100 * (t - t0) / (t1 - t0)).toFixed(2)}%">${hx(hr(t), 'Uhr')}</span>`;
  setH($('.ax', view), h);
}
// Tagesverlauf 0–24 Uhr als Kurve (15-min-Mittel); y: lo…hi → 30…2
function dayPath(s, lo, hi, y0) {
  const d = day0(), P = ([t, v]) => [100 * (t - d) / 864e5, 30 - 28 * (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)];
  const p = bins(s, d, Date.now(), 9e5).map(P);
  if (p.length < 2) return { ln: '', ar: '' };
  const ln = smooth(p);
  return { ln, ar: `${ln}V${y0}H${p[0][0].toFixed(2)}Z` };
}
function detail(force) {
  const view = $d();
  if (!dk || !view || !V || !R || view.hidden && !force) return;
  const { ok, x, st } = V, now = Date.now(), k = dk, c01 = v => Math.min(1, Math.max(0, v));
  const n = (t, okk = true) => rb('d_v', okk ? t : '–');
  const sub = t => bd('d_s', t), m = (a, b = '') => { bd('d_m1', a); bd('d_m2', b); };
  const col = (l, v, i, extra = '', after = '') => `<div style="--i:${i}"><b>${l}</b>${extra}<span>${v}</span>${after}</div>`;
  const ebar = v => { const e = $('.dbr', view); if (e) { e.style.setProperty('--v', c01(v)); e.style.visibility = isFinite(v) ? '' : 'hidden'; } };
  const days = () => [['day3', 2], ['day4', 3]].filter(([q]) => ok[q]).map(([q, d]) => `${wdOf(q, d)} ${de(x[q])} kWh`).join(' · ');
  bd('d_l', '');
  if (k === 'pv') {
    n(kw(x.pv), ok.pv);
    bd('d_l', !ok.pv ? '' : x.pv > 50 ? 'Erzeugt gerade' : 'Keine Erzeugung');
    const pt = hhmm(st('pvPeakAt')?.state);
    m(ok.today ? `Heute ${de(x.today)} kWh${ok.todayFc ? ` von ${de(x.todayFc)}` : ''}` : '', ok.pvPeak ? `Spitze heute ${kw(x.pvPeak)} kW${pt ? ` um ${pt}` : ''}` : '');
    const cv = ok.pv ? curve(true) : null;
    sub(cv?.fc ? 'Leistung (kW) · gestrichelt: Prognose' : 'Leistung (kW)');
    for (const q of ['ln', 'ar', 'fc', 'bd']) setD($('.cvi .' + q, view), cv?.[q] || '');
    if (cv) axis(view, cv.t0, cv.t1, 3);
    const l = [...hourly(st('todayFc')), ...hourly(st('tomorrow'))].filter(([t, w]) => t + 36e5 > now && t < now + 864e5 && w >= 50).slice(0, 12);   // Schwelle wie hv()
    const nd = l.findIndex(([t]) => t >= day0() + 864e5);   // erste Stunde von morgen mit Wochentag (Spalte 14 cqw fasst nur „Do 7 Uhr“)
    setH($('[data-h]', view), l.map(([t, w], i) => col(t <= now ? 'Jetzt' : (i === nd ? new Date(t).toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2) + ' ' : '') + hx(hr(t), 'Uhr'), hx(t <= now && ok.pv ? kw(x.pv) : de(w / 1000), 'kW'), i)).join(''));   // „Jetzt“ = Live-Wert wie die große Zahl
  } else if (k === 'aut') {
    const H0 = Math.max(0, x.home) + x.car, net = ok.grid && x.grid > 50 ? Math.min(H0, x.grid) : 0, akku = ok.bat && x.bat > 50 ? Math.min(H0 - net, x.bat) : 0, sol = Math.max(0, H0 - net - akku);
    const aut = ok.home && ok.grid ? (H0 > 0 ? Math.round(100 * (1 - net / H0)) : 100) : null;   // wie die Kachel: 1 − Netzbezug / (Haus + Auto)
    n(String(aut), aut != null); bd('d_l', 'Autarkie jetzt');
    m(ok.solarPct ? `Solaranteil gesamt ${Math.round(x.solarPct)} %` : '');
    sub(ok.home ? `Anteile an ${kw(H0)} kW Verbrauch` : '');
    const sh = [['so', 'Solar', sol], ['ak', 'Akku', akku], ['nz', 'Netz', net]], f = v => H0 > 0 ? v / H0 : 0;
    let acc = 0;
    for (const [c, , v] of sh) { const e = $('.sb .' + c, view); e.style.setProperty('--x', acc); e.style.setProperty('--w', f(v)); acc += f(v); }
    $('.sb', view).style.visibility = ok.home ? '' : 'hidden';
    setH($('[data-h]', view), ok.home ? sh.map(([c, l, v], i) => col(`<i class="dot ${c}"></i>${l}`, hx(kw(v), 'kW'), i, '', `<em>${Math.round(100 * f(v))} %</em>`)).join('') : '');
  } else if (k === 'use') {
    n(kw(x.home), ok.home); bd('d_l', 'Hausverbrauch');
    const imp = x.grid > 50, exp = x.grid < -50;
    m(!ok.grid ? '' : imp ? `↓ ${kw(x.grid)} kW Bezug aus dem Netz` : exp ? `↑ ${kw(x.grid)} kW ins Netz` : '0,0 kW Netz');
    $('.m1', view).className = 'dm m1' + (imp ? ' imp' : exp ? ' exp' : '');
    for (const b of $$('.wseg button', view)) b.classList.toggle('on', b.dataset.sg === sg);
    if (sg === 'home') {
      sub('Hausverbrauch (kW)');
      const s = HD.home, hi = Math.max(1000, ...s.filter(p => p[0] >= day0()).map(p => p[1])), p = dayPath(s, 0, hi, 30);
      setD($('.hh .ln', view), p.ln); setD($('.hh .ar', view), p.ar);
    } else {
      sub('Netz (kW) · ↑ Einspeisung ↓ Bezug');
      const s = HD.grid.map(([t, w]) => [t, -w]), d = s.filter(p => p[0] >= day0()).map(p => p[1]);
      const up = Math.max(300, ...d), dn = Math.max(300, ...d.map(v => -v)), Z = 2 + 26 * up / (up + dn);
      const p = dayPath(s, -dn, up, Z);
      for (const g of $$('.gg.ex,.gg.im', view)) { setD($('.ln', g), p.ln); setD($('.ar', g), p.ar); }
      const ca = $('.ka', view), cb = $('.kb', view);
      ca.setAttribute('height', Z); cb.setAttribute('y', Z); cb.setAttribute('height', 30 - Z);
      setD($('.gg.z', view), `M0,${Z.toFixed(2)}H100`);
    }
    axis(view, day0(), day0() + 864e5, 6);
  } else if (k === 'bat') {
    n(String(Math.round(x.soc)), ok.soc); ebar(ok.soc ? x.soc / 100 : NaN);
    bd('d_l', !ok.bat ? '' : x.bat < -50 ? `Lädt mit ${kw(x.bat)} kW` : x.bat > 50 ? `Entlädt mit ${kw(x.bat)} kW` : 'Bereit');
    m(ok.cap && ok.soc ? `${de(x.cap * x.soc / 100)} von ${de(x.cap)} kWh gespeichert` : '');
    sub('Ladestand (%)');
    const p = dayPath(HD.soc, 0, 100, 30);
    setD($('.ln', view), p.ln); setD($('.ar', view), p.ar);
    axis(view, day0(), day0() + 864e5, 6);
    const sum = ks => ks.some(q => ok[q]) ? de(ks.reduce((a, q) => a + (ok[q] ? x[q] : 0), 0)) : null;
    const io = [['Heute geladen', sum(['batIn1', 'batIn2'])], ['Heute entladen', sum(['batOut1', 'batOut2'])]].filter(e => e[1] != null);
    setH($('[data-h]', view), io.map(([l, v], i) => col(l, hx(v, 'kWh'), i)).join(''));
  } else if (k === 'car') {
    const conn = st('carConn')?.state === 'on', chg = st('carChg')?.state === 'on' || ok.car && x.car > 50, a = limA(), lim = held('lim') ?? a?.v;
    n(String(Math.round(x.carSoc)), ok.carSoc); ebar(ok.carSoc ? x.carSoc / 100 : NaN);
    const lm = $('.lm', view); lm.style.visibility = a ? '' : 'hidden'; if (a) lm.style.setProperty('--l', c01(lim / 100));
    bd('d_l', chg ? `Lädt mit ${kw(x.car)} kW` : conn ? 'Verbunden' : st('carConn') ? 'Nicht verbunden' : '');
    const rs = st('carRem'), ru = rs?.attributes.unit_of_measurement, rm = ok.carRem && x.carRem > 0 ? x.carRem * ({ s: 1 / 60, min: 1, h: 60, d: 1440 }[ru] ?? 1 / 60) : 0;   // ponytail: ohne Einheit Sekunden (evcc)
    m([ok.range && `${Math.round(x.range)} km`, chg && rm >= 1 && `noch ${rm >= 60 ? `${Math.floor(rm / 60)}:${String(Math.round(rm % 60)).padStart(2, '0')} h` : `${Math.round(rm)} min`}`].filter(Boolean).join(' · '));
    sub(a || st('carMode') ? 'Lademodus und Ladelimit' : '');
    const ms = st('carMode'), md = held('mode') ?? ms?.state, op = ms?.attributes.options || [];
    const sg2 = $('.emode', view); sg2.style.display = op.length ? '' : 'none';
    setH(sg2, op.map(o => `<button data-mode="${o}"${o === md ? ' class="on"' : ''}>${MODE[o] || o}</button>`).join(''));
    const sl = $('.sl', view); sl.style.display = a ? '' : 'none';
    if (a) { sl.style.setProperty('--f', c01((lim - a.min) / (a.max - a.min))); sl.setAttribute('aria-valuenow', lim); bd('d_lim', `${Math.round(lim)} %`); }
    const pu = st('sesPrice')?.attributes.unit_of_measurement || '€';
    const ss = [['Geladen', ok.sesE && hx(de(x.sesE), 'kWh')], ['Solaranteil', ok.sesSol && hx(Math.round(x.sesSol), '%')], ['Kosten', ok.sesPrice && hx(de(x.sesPrice, 2), /eur/i.test(pu) ? '€' : pu.replace(/\/.*/, ''))]].filter(e => e[1]);
    setH($('[data-h]', view), ss.map(([l, v], i) => col(l, v, i)).join(''));
    $('.wcard', view).style.visibility = op.length || a || ss.length ? '' : 'hidden';   // nichts zu steuern/zeigen → keine leere Karte
  } else {   // Heute / Morgen: Stundenbalken (Prognose blass, heute Ist gelb davor)
    const td = k === 'day', fk = td ? 'todayFc' : 'tomorrow', d = day0() + (td ? 0 : 864e5);
    n(de(td ? x.today : x.tomorrow), td ? ok.today : ok.tomorrow);
    bd('d_l', td ? 'Erzeugt heute' : 'Prognose morgen');
    if (td) ebar(ok.today && ok.todayFc && x.todayFc > 0 ? x.today / x.todayFc : NaN);
    let l = hourly(st(fk)).filter(([t]) => t >= d && t < d + 864e5);
    if (!l.length && td) l = Array.from({ length: 24 }, (_, i) => [d + i * 36e5, 0]);   // ohne Prognose: nur Ist-Stunden
    const ist = t => { const e = Math.min(36e5, now - t); return td && e > 0 && H.length ? bins(H, t, t + e, e)[0][1] * e / 36e5 : null; };
    const rows = l.map(([t, w]) => [t, w, ist(t)]).filter(([, w, a]) => w >= 50 || a >= 50), max = Math.max(100, ...rows.flatMap(r => [r[1], r[2] || 0]));
    const pk = l.reduce((a, p) => p[1] > a[1] ? p : a, [0, 0]), pt = hhmm(st('tomorrowPeak')?.state) || (pk[1] ? hhmm(pk[0]) : '');
    m(td ? (ok.todayFc ? `von ${de(x.todayFc)} kWh Prognose` : '') : pk[1] ? `Spitze ${kw(pk[1])} kW um ${pt}` : '', days());
    sub(td ? 'kWh je Stunde · gelb: erzeugt' : 'kWh je Stunde (Prognose)');
    setH($('[data-h]', view), rows.map(([t, w, a], i) => col(t <= now && now < t + 36e5 ? 'Jetzt' : hx(hr(t), 'Uhr'),
      de((a ?? w) / 1000), i, `<i class="hb">${hv(w, max, 'p')}${a != null ? hv(a, max, 'a') : ''}</i>`)).join(''));
    const hs = $('[data-h]', view);
    $('.wcard', view).style.visibility = rows.length ? '' : 'hidden';
    if (force && td) { const j = rows.findIndex(r => r[0] + 36e5 > now); requestAnimationFrame(() => hs.scrollLeft = Math.max(0, j - 2) * hs.firstElementChild?.offsetWidth || 0); }   // „Jetzt“ in Sicht
  }
}

// ---------- Demo ----------
// Oktobertag in Schwäbisch Gmünd: PV ~7:40–18:30, mittags ~4,3 kW mit durchziehenden Wolken, Grundlast + Wasserkocher/Kochen,
// Akku regelt auf Netz ≈ 0 (Laden 1,2 kW, vormittags 0,7 kW / Entladen 1,5 kW, 10,24 kWh), e-Golf lädt bei Überschuss (35,8 kWh) → Bezug und Einspeisung wechseln (Wolken, Wasserkocher).
const S = { soc: 70, socC: 41, last: 0, car: false, mode: 'pv', lim: 85, bIn: 0, bOut: 0, ses: 0, sesPv: 0 };   // mode/lim: evcc-Lademodus und -Limit (Detail e-Golf schaltet sie in der Demo)
let kd = [];
const sunAt = h => Math.max(0, Math.sin(Math.PI * (h - 7.65) / 10.9)) ** 1.25;
const haze = t => .74 + .26 * Math.sin(t / 2.3e6 + 1);   // langsame Bewölkung
// Heute-Prognose: fester Tagesfaktor = sonnengewichteter Mittelwert von haze × 1,06 (Solcast leicht optimistisch) → Ist bleibt am Abend knapp darunter
const kDay = d => { let a = 0, b = 0; for (let t = d; t < d + 864e5; t += 6e5) { const w = sunAt(new Date(t).getHours() + new Date(t).getMinutes() / 60); a += w * haze(t); b += w; } return 1.06 * a / b; };
function model(now, s, live = true) {
  const d = new Date(now), h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600, n = k => (Math.sin(now / k) + Math.sin(now / k / 2.7 + 1)) / 2;
  const sun = sunAt(h);
  const cloud = haze(now) * (live ? (1 - .18 * Math.max(0, Math.sin(now / 4.1e5)) ** 2) * (1 - .5 * Math.max(0, Math.sin(now / 2.6e4)) ** 3) : 1);   // langsame Bewölkung; live zusätzlich Wolkenzüge (Verlauf ohne, sonst zackige Tageskurve)
  const pv = sun ? Math.max(0, 4300 * sun * cloud + 35 * n(7e3)) : 0;
  const cyc = Math.sin(now / 5e4);   // Demo-Zyklus ≈ 5 min: Ladepause → Einspeisung; Wasserkocher während das Auto lädt → Bezug
  const base = 360 + 170 * n(5e4) + (h > 18 && h < 19.4 ? 1300 : 0), home = base + (live && cyc < -.85 ? 2400 : 0);   // Wasserkocher ~55 s (nur live; im Tagesverlauf sonst Sägezahn)
  const full = s.socC >= s.lim;
  if (full || s.mode === 'off' || pv - base < 900) s.car = false; else if (pv - base > 1700) s.car = true;   // Hysterese wie evcc „PV“
  const car = full || s.mode === 'off' ? 0 : s.mode === 'now' ? 3700 : s.mode === 'minpv' ? Math.min(3700, Math.max(1400, pv - base - 1200))
    : s.car && cyc < .2 ? Math.min(3700, Math.max(1400, pv - base - 1200)) : 0;   // PV: Auto nimmt den Überschuss nach Akku-Laden (1,2 kW); Pause ≈ 2 min
  let bat = Math.max(h < 12 ? -700 : -1200, Math.min(1500, home + car - pv));   // prognosebasiertes Laden: vormittags gedrosselt → Einspeisung
  if (bat > 0 && (s.soc <= 10.5 || car) || bat < 0 && s.soc >= 99.5) bat = 0;   // evcc: Akku-Entladung gesperrt, solange das Auto lädt → Lastspitzen kommen aus dem Netz
  const dt = s.last ? (now - s.last) / 3.6e6 : 0;
  s.soc = Math.min(100, Math.max(10, s.soc - bat * dt / 102.4)); s.socC = Math.min(100, s.socC + car * dt / 358); s.last = now;
  s.bIn += Math.max(0, -bat) * dt / 1e3; s.bOut += Math.max(0, bat) * dt / 1e3; s.ses += car * dt / 1e3; s.sesPv += Math.min(car, Math.max(0, pv - home)) * dt / 1e3;   // kWh heute
  return { pv, home, car, bat, grid: home + car - pv - bat + 25 * n(6e3) };
}
// Solcast-artige Prognose (30-min-Perioden, kW): klarer Tag × Faktor; morgen sonniger als heute
// Solcast-artige Prognose (30-min-Perioden, kW, Band 10/90 %): klarer Tag × Faktor; morgen sonniger als heute, Tag 3/4 trüber
const fcDay = (d, k) => Array.from({ length: 48 }, (_, i) => { const e = 4.3 * k * sunAt(i / 2 + .25), r = x => +x.toFixed(4); return { period_start: new Date(d + i * 18e5).toISOString(), pv_estimate: r(e), pv_estimate10: r(e * .58), pv_estimate90: r(Math.min(4.5, e * 1.14)) }; });
const fcHour = l => l.filter((_, i) => !(i % 2)).map((p, i) => ({ ...p, pv_estimate: +((p.pv_estimate + l[2 * i + 1].pv_estimate) / 2).toFixed(4) }));
export function energyDemo(now = Date.now()) {
  if (!demo) {   // einmal: Tag ab Mitternacht in 2-min-Schritten, schreibt die History (auch Haus, Netz, Akku für die Detailansichten)
    demo = true;
    for (let t = day0(); t < now; t += 12e4) { const m = model(t, S, false); H.push([t, m.pv]); HD.home.push([t, m.home]); HD.grid.push([t, m.grid]); HD.soc.push([t, S.soc]); }
  }
  const m = model(now, S), W = { unit_of_measurement: 'W' }, P = { unit_of_measurement: '%' }, K = { unit_of_measurement: 'kWh' };
  const d = day0(), fc = fcDay(d, kd[0] === d ? kd[1] : (kd = [d, kDay(d)])[1]), fc2 = fcDay(d + 864e5, 1), sum = l => l.reduce((a, p) => a + p.pv_estimate / 2, 0);
  const fc3 = fcDay(d + 2 * 864e5, .74), fc4 = fcDay(d + 3 * 864e5, .41), top = l => l.reduce((a, p) => p.pv_estimate > a.pv_estimate ? p : a);
  const pk = top(fc2), pk1 = top(fc), ts = { device_class: 'timestamp' }, day = l => ({ ...K, detailedForecast: l, detailedHourly: fcHour(l) });
  const today = H.reduce((a, [t, w], i) => a + w * ((H[i + 1]?.[0] ?? now) - t), 0) / 3.6e9;
  const rem = m.car > 0 ? Math.round((S.lim - S.socC) / 100 * 35.8 / (m.car / 1000) * 3600) : 0, on = v => v ? 'on' : 'off';
  return { [E.pv]: [Math.round(m.pv), W], [E.grid]: [Math.round(m.grid), W], [E.home]: [Math.round(m.home), W],
    [E.bat]: [Math.round(m.bat), W], [E.soc]: [Math.round(S.soc), P], [E.cap]: [10.24, K],
    [E.batIn1]: [(S.bIn * .5).toFixed(2), K], [E.batOut1]: [(S.bOut * .5).toFixed(2), K], [E.batIn2]: [(S.bIn * .5).toFixed(2), K], [E.batOut2]: [(S.bOut * .5).toFixed(2), K],   // zwei Marstek-Speicher je zur Hälfte
    [E.car]: [Math.round(m.car), W], [E.carSoc]: [Math.round(S.socC), P], [E.range]: [Math.round(S.socC * 1.9), { unit_of_measurement: 'km' }],
    [E.carConn]: [on(true), {}], [E.carChg]: [on(m.car > 0), {}], [E.carRem]: [rem, { unit_of_measurement: 's', device_class: 'duration' }],
    [E.carLim]: [S.lim, { min: 20, max: 100, step: 5, unit_of_measurement: '%' }], [E.carMode]: [S.mode, { options: ['off', 'now', 'minpv', 'pv'] }],
    [E.sesE]: [S.ses.toFixed(2), K], [E.sesSol]: [S.ses ? Math.round(100 * S.sesPv / S.ses) : 0, P], [E.sesPrice]: [(S.sesPv * .082 + (S.ses - S.sesPv) * .31).toFixed(2), { unit_of_measurement: '€' }],
    [E.solarPct]: [76.4, P],
    [E.today]: [today.toFixed(2), K], [E.todayFc]: [sum(fc).toFixed(4), day(fc)],
    [E.pvPeak]: [Math.round(pk1.pv_estimate * 1000), W], [E.pvPeakAt]: [new Date(Date.parse(pk1.period_start)).toISOString(), ts],
    [E.tomorrow]: [sum(fc2).toFixed(4), day(fc2)], [E.tomorrowPeak]: [new Date(Date.parse(pk.period_start)).toISOString(), ts],
    [E.day3]: [sum(fc3).toFixed(4), { ...day(fc3), dayname: new Date(d + 2.5 * 864e5).toLocaleDateString('en-US', { weekday: 'long' }) }], [E.day4]: [sum(fc4).toFixed(4), day(fc4)] };
}

// Maße/Farben aus m5.html #d1 (cqw bei 784 px)
document.head.insertAdjacentHTML('beforeend', `<style>
@property --g{syntax:'<number>';inherits:true;initial-value:0}
.f-energy{--eink:hsl(calc(var(--h,30) - 4) 88% 19%);--eink2:hsl(calc(var(--h,30) - 4) 38% 44%);--trk:#ffffff38}   /* Orange-Face: #5a2a06 / #9a6a45 wie Entwurf */
.f-energy.mono{--eink:#1c1c1e;--eink2:#1c1c1e99}
.f-energy.light{--trk:#0000001a}
.f-energy .et{display:block;padding:0;text-align:left;line-height:normal;white-space:nowrap;overflow:hidden}
.f-energy .ez{position:absolute;left:0;top:0;box-sizing:border-box;width:calc(100% / var(--z,1));height:calc(100% / var(--z,1));padding:4.6cqw 3.4cqw;transform:scale(var(--z,1));transform-origin:0 0}   /* Inhalt: 2 × 2 = Entwurfsmaß ×2 */
.f-energy .et.pv .ez{padding:4.4cqw 5cqw}
.f-energy .et .ttl{line-height:normal}
.f-energy .et svg.i{vertical-align:-.12em}
.f-energy .i.y{color:#ffd60a}.f-energy .i.gr{color:#28b04a}.f-energy .i.bl{color:#1d8fd8}
.f-energy.light .i.y{color:#e0a800}
.f-energy .enum{display:flex;align-items:baseline;font-size:8.6cqw;margin-top:1.4cqw;font-weight:600;letter-spacing:-.025em;font-variant-numeric:tabular-nums}
.f-energy .enum .num{font-weight:inherit;line-height:inherit;letter-spacing:inherit;justify-items:start}
.f-energy .enum small{font-size:3.4cqw;white-space:pre}
.f-energy .pv .enum{font-size:14cqw;line-height:1;margin-top:1.6cqw}
.f-energy .pv .enum small{font-size:5cqw;font-weight:500}
.f-energy .use .enum small{font-weight:500}   /* „ kW“ Medium, „%“ wie die Zahl */
.f-energy .et .sub{font-size:3cqw;line-height:normal;color:inherit;transition:color .3s}
.f-energy .dim{color:#ffffff9e}.f-energy.light .dim{color:#828284}
/* Autarkie: Ring 24,2 cqw (r 44, Strich 6 von 100), Zahl 8 cqw */
.f-energy .aut .ez{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0}
.f-energy .aut .enum{font-size:8cqw;line-height:1;margin:0}
.f-energy .aut .sub{margin-top:.6cqw}
.f-energy .rg{position:absolute;left:3.4cqw;top:3.4cqw;width:24.2cqw;height:24.2cqw;fill:none;stroke-width:6}
.f-energy .rg circle{stroke:var(--trk)}
.f-energy .rg .on{stroke:#30d158;stroke-linecap:round;stroke-dasharray:100 100;stroke-dashoffset:calc((1 - var(--v,0)) * 100);transition:stroke-dashoffset calc(var(--sd) * 2.2) var(--spring)}
/* Balken 1,3 cqw; Füllung gleitet per transform (Feder) */
.f-energy .bar{position:relative;height:1.3cqw;margin-top:2.6cqw;border-radius:1cqw;background:var(--trk)}
.f-energy .bar.g{margin-top:3cqw;transition:--g calc(var(--sd) * 2.2) var(--spring)}
.f-energy .bar.today{margin-top:2.4cqw}
.f-energy .on .bar{background:color-mix(in srgb,currentColor 15%,transparent)}
.f-energy .cl{position:absolute;inset:0;overflow:hidden;border-radius:1cqw}
.f-energy .cl>i{position:absolute;inset:0;border-radius:1cqw;transform:translateX(calc((var(--v,0) - 1) * 100%));transition:transform calc(var(--sd) * 2.2) var(--spring)}
.f-energy .soc i{background:#28b04a}.f-energy .carSoc i{background:#1d8fd8}.f-energy .today i{background:#ffd60a}
/* Netz: Mitte = 0, rechts grün Einspeisung, links orange Bezug; --g (−1…1) federt durch die Mitte */
.f-energy .bar.g .r{left:50%}.f-energy .bar.g .l{right:50%}
.f-energy .bar.g .r i{background:#30d158;transform:translateX(calc((max(var(--g),0) - 1) * 100%));transition:none}
.f-energy .bar.g .l i{background:#ff9f0a;transform:translateX(calc((1 + min(var(--g),0)) * 100%));transition:none}
.f-energy .bar.mid::after{content:"";position:absolute;left:50%;top:-.6cqw;bottom:-.6cqw;width:.3cqw;margin-left:-.15cqw;background:currentColor;border-radius:.2cqw}
.f-energy .use .sub{margin-top:1.8cqw;color:#c8ffd4}.f-energy .use .sub.imp{color:#ffd9a8}
.f-energy.light .use .sub{color:#248a3d}.f-energy.light .use .sub.imp{color:#c93400}
.f-energy .use .sub.z{color:#ffffff9e}.f-energy.light .use .sub.z{color:#828284}
.f-energy .et.on .sub{margin-top:1.8cqw}
.f-energy .tmr .pk{margin-top:2cqw}
/* Weiße An-Kacheln (Akku, e-Golf): Fläche #fffe → #ffffffc8, Schrift im Face-Ton */
/* Glas wie Home-Kachel, aber wie im Entwurf gesättigter (backdrop saturate 1.3 + Weiß 6 %): Wallpaper-Schicht als ::after mit Filter (statisch, einmal gerastert) */
/* Uhr: dieselbe Glasfläche, rund (Entwurf: .g mit border-radius 50 %) */
.f-energy:not(.light) :is(.et,.dial.glass){background:none}
.f-energy:not(.light) :is(.et,.dial.glass){isolation:isolate;box-shadow:0 0 0 .13cqw #0000002e,0 .6cqw 2cqw #0003}   /* nur Außenlinie + Schatten: die helle Kante zeichnet ::after, sonst steht sie doppelt */
.f-energy:not(.light) :is(.et,.dial.glass)::after{content:"";position:absolute;inset:0;z-index:-2;border-radius:inherit;filter:saturate(1.3);
  box-shadow:inset 0 .25cqw .1cqw #ffffff59,inset 0 -.25cqw .1cqw #ffffff40,inset 0 0 0 .25cqw #ffffff2e;   /* helle Glaskante: ::after (isolation) liegt über den inset-Schatten des Elements */
  background:linear-gradient(165deg,#fff3,#fff1 45%,#fff0 75%),linear-gradient(#ffffff0f,#ffffff0f),var(--wpb) calc(-1*(var(--pad) + var(--c)*(var(--t) + var(--gap)))) calc(-1*(var(--pad) + var(--r)*(var(--t) + var(--gap))))/100cqw 100cqw}
@supports (corner-shape:squircle){.f-energy:not(.light) .et::after{corner-shape:squircle}}   /* corner-shape erbt nicht: ohne das ist die Glaskante rund, die Kachel selbst Squircle → versetzter Doppelrand an den Ecken */
.f-energy:not(.light) .et.on{color:var(--eink)}.f-energy:not(.light) .et.on .sub{color:var(--eink2)}
.f-energy:not(.light) .et.on::before{background:linear-gradient(#fffe,#ffffffc8)}
/* Solarkurve: Fläche 24×11 cqw, rechts 4 / unten 4,4; Fenster 1 cqw größer + 4 cqw weiche Kante rechts (Wischblende) */
.f-energy .cw{position:absolute;right:0;bottom:3.4cqw;width:29cqw;height:13cqw;overflow:hidden;pointer-events:none;
  -webkit-mask:linear-gradient(90deg,#000 calc(100% - 4cqw),#0000);mask:linear-gradient(90deg,#000 calc(100% - 4cqw),#0000)}
.f-energy .ci{position:absolute;left:1cqw;top:1cqw;width:24cqw;height:11cqw}
.f-energy .ci svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.f-energy .ci .ln{fill:none;stroke:#ffd60a;stroke-width:1.6;vector-effect:non-scaling-stroke}
.f-energy .ci .fc{fill:none;stroke:currentColor;stroke-opacity:.45;stroke-width:1.4;stroke-dasharray:2 3;vector-effect:non-scaling-stroke}
.f-energy.light .ci .ln{stroke:#e0a800}
@media (prefers-reduced-motion:reduce){.f-energy *{transition:none!important}}
/* ---------- Detailansicht #edet: Kopf/✕/Uhr = #climate/#dimmer (index.html), Karte = .wcard Wetter-Detail y-MO 08900 (weather.js) ---------- */
#edet{--trk:#ffffff38;--sb:hsl(var(--h) 100% 84%);--y:#ffd60a;--gn:#30d158;--bl:#0a84ff;--or:#ff9f0a;color:#fff;background:var(--wpb) 0 0/100% 100%,var(--wp) 0 0/100% 100%,var(--eb,#000);touch-action:none}
#edet.mono{--sb:#ebebf599}
#edet.light{--trk:#0000001a;--sb:#828284;--y:#e0a800;--gn:#28b04a;--bl:#1d8fd8;color:#1c1c1e}
#edet.light .x{background:#0000000f}
/* Werte mittig (Wetter-Detail: Zahl 16,2 cqw, Zeilen 3,85 cqw im Abstand 4,8; Zustandszeile wie „Cooling to“ 4,8 cqw); Zahl Medium wie Klima/Licht */
#edet .dh>*{position:absolute;left:0;right:0;text-align:center;line-height:1;white-space:nowrap}
#edet .dl{top:14.7cqw;font-size:4.8cqw}
#edet .dv{top:19.7cqw;display:flex;justify-content:center;align-items:baseline;font-size:16.2cqw;font-weight:500;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
#edet .dv small{font-size:.48em;font-weight:400;margin-left:.12em;letter-spacing:0;opacity:.62}   /* Einheit wie „%“ im Licht-Vollbild (#dimmer small: 14 von 29 cqw, Regular, blass) */
#edet .dm{font-size:3.85cqw}
#edet .m1{top:38.4cqw}#edet .m2{top:43.2cqw}
#edet .wb .m1{top:42.2cqw}#edet .wb .m2{top:47cqw}
#edet .dm.imp{color:#ffd9a8}#edet .dm.exp{color:#c8ffd4}#edet.light .dm.imp{color:#c93400}#edet.light .dm.exp{color:#248a3d}   /* Netztext wie Kachel Verbrauch */
/* Füllstand: Kachelbalken (Entwurf) groß, Füllung per transform */
#edet .dbr{left:30cqw;right:30cqw;top:37.8cqw;height:1.6cqw;border-radius:.8cqw;background:var(--trk)}
#edet .dbr .cl{position:absolute;inset:0;overflow:hidden;border-radius:inherit}
#edet .dbr i{position:absolute;inset:0;border-radius:inherit;background:var(--y);transform:translateX(calc((var(--v,0) - 1) * 100%));transition:transform calc(var(--sd) * 2.2) var(--spring)}
#edet .dbr.gr i{background:var(--gn)}#edet .dbr.bl i{background:var(--bl)}
#edet .dbr .lm{position:absolute;left:0;right:0;top:-.6cqw;bottom:-.6cqw;pointer-events:none;transform:translateX(calc(var(--l,1) * 100%));transition:transform calc(var(--sd) * 2.2) var(--spring)}
#edet .dbr .lm::before{content:'';position:absolute;left:-.15cqw;top:0;bottom:0;width:.3cqw;border-radius:.2cqw;background:currentColor}   /* Ladelimit-Strich wie die Nullmarke der Kachel Verbrauch */
/* Karte: Maße/Schrift aus .wcard; Glas = dunkler Ton des Face wie rgb(11 78 149/.5) auf dem Wetterhimmel, ohne Live-Blur (Hintergrund ist schon Blur-Wallpaper) */
#edet .wcard{position:absolute;top:53cqw;background:hsl(var(--h) 86% 31% / .5);-webkit-backdrop-filter:none;backdrop-filter:none;transition:none}
#edet.mono .wcard{background:#ffffff1a}#edet.light .wcard{background:#e8e8e8}
#edet .wsub{color:var(--sb)}
#edet.light .wseg button.on{background:#fff}
#edet .whours span{margin-top:1.4cqw}
#edet .whours em{font-style:normal;font-size:3cqw;font-weight:500;margin-top:1cqw;color:var(--sb)}
#edet .ecol{overflow:visible}#edet .ecol>div{flex:1 1 0}
#edet .dot{display:inline-block;width:2.2cqw;height:2.2cqw;margin-right:1cqw;border-radius:50%;vertical-align:-.1em}
#edet .so{background:var(--y)}#edet .ak{background:var(--gn)}#edet .nz{background:var(--or)}#edet.light .nz{background:#c93400}   /* hell: Netz wie .dm.imp, sonst neben Solar #e0a800 kaum unterscheidbar */
/* Werte gleiten nach dem Aufklappen ein wie die Stundenleiste (fillHours: 40 %, Feder, 25 ms Versatz) */
#edet .whours>div>:not(b,.hb){transition:opacity .5s,transform .5s var(--spring);transition-delay:calc(var(--i,0) * 25ms)}
#edet.ni .whours>div>:not(b,.hb){opacity:0;transform:translateY(40%)}
/* Kurve: Fläche 13 cqw, Achse darunter; Fenster 5 cqw breiter mit weicher Kante (Einzeichnen wie die Kachel) */
#edet .ech{position:relative;height:16.4cqw;margin:2.45cqw 4.6cqw 0 4.2cqw;--c:currentColor}
#edet .cv{position:absolute;left:0;top:0;right:-5cqw;height:13cqw;overflow:hidden;pointer-events:none;-webkit-mask:linear-gradient(90deg,#000 calc(100% - 4cqw),#0000);mask:linear-gradient(90deg,#000 calc(100% - 4cqw),#0000)}
#edet .cvi{position:absolute;left:0;top:0;bottom:0;right:5cqw}
#edet .cvi svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
#edet .cvi .ln{fill:none;stroke:var(--c);stroke-width:.3cqw;stroke-linejoin:round;vector-effect:non-scaling-stroke}
#edet .cvi .fc{fill:none;stroke:currentColor;stroke-opacity:.5;stroke-width:.22cqw;stroke-dasharray:.4cqw .6cqw;vector-effect:non-scaling-stroke}
#edet .cvi .bd{fill:currentColor;fill-opacity:.1}
#edet.pv .ech{--c:var(--y)}#edet.bat .ech{--c:var(--gn)}
#edet .gg .ar{fill:var(--c);fill-opacity:.3}#edet .ex{--c:var(--gn)}#edet .im{--c:var(--or)}
#edet .gg.z{fill:none;stroke:currentColor;stroke-opacity:.45;stroke-width:.15cqw;vector-effect:non-scaling-stroke}
#edet[data-sg=home] .gg,#edet[data-sg=grid] .hh{display:none}
#edet .ax{position:absolute;left:0;right:0;top:13.6cqw}
#edet .ax span{position:absolute;translate:-50% 0;font-size:2.9cqw;font-weight:500;line-height:1;color:var(--sb);white-space:nowrap}
#edet .ax small,#edet .whours small{font-size:.76em}
/* Autarkie: Anteile als ein Balken, Teile federn per transform */
#edet .sb{position:relative;height:3.6cqw;margin:3cqw 4.6cqw 0 4.2cqw;border-radius:1.8cqw;overflow:hidden;background:var(--trk)}
#edet .sb i{position:absolute;inset:0;transform-origin:0 0;transform:translateX(calc(var(--x,0) * 100%)) scaleX(var(--w,0));transition:transform calc(var(--sd) * 2.2) var(--spring)}
#edet.ni .sb i{transform:scaleX(0)}
/* Stundenbalken (Heute/Morgen): Prognose blass, heute Ist gelb davor */
#edet .hb{position:relative;width:2.8cqw;height:13cqw;margin-top:1.6cqw;overflow:hidden;border-radius:1.4cqw}
#edet .hb i{position:absolute;inset:0;border-radius:inherit;transform:translateY(calc((1 - var(--v,0)) * 100%));transition:transform calc(var(--sd) * 2.2) var(--spring) calc(var(--i,0) * 25ms)}
#edet .hb .p{background:currentColor;opacity:.3}#edet .hb .a{background:var(--y)}
#edet.ni .hb i{transform:translateY(100%)}#edet.ni .dbr i{transform:translateX(-100%)}
/* e-Golf: Lademodus = .wseg mit Text, Ladelimit = Regler wie Licht/Kontrollzentrum (Füllung per transform, Text an der Füllkante geteilt) */
#edet .emode{margin:2.2cqw 4.6cqw 0 4.2cqw}
#edet .emode button{flex:1;width:auto;font-size:3.3cqw;font-weight:600}
#edet .sl{position:relative;height:6.6cqw;margin:2.2cqw 4.6cqw 0 4.2cqw;border-radius:2.2cqw;overflow:hidden;background:var(--trk);cursor:pointer;touch-action:none;transition:scale var(--sd) var(--spring);outline:0}
#edet .sl.drag{scale:.97}
#edet .sl:focus-visible{outline:.4cqw solid currentColor;outline-offset:.3cqw}
#edet .sl .t{position:absolute;inset:0;display:flex;justify-content:space-between;align-items:center;padding:0 3.2cqw;font-size:3.3cqw;font-weight:600}
#edet .sl .f{position:absolute;inset:0;overflow:hidden;background:#fff;transform:translateX(calc((var(--f,0) - 1) * 100%));transition:transform calc(var(--sd) * 2.2) var(--spring)}
#edet .sl .in{position:absolute;inset:0;color:hsl(var(--h) 88% 19%);transform:translateX(calc((1 - var(--f,0)) * 100%));transition:transform calc(var(--sd) * 2.2) var(--spring)}
#edet.mono .sl .in,#edet.light .sl .in{color:#1c1c1e}
#edet .sl.drag :is(.f,.in){transition:none}
#edet.ni .sl .f{transform:translateX(-100%)}#edet.ni .sl .in{transform:translateX(100%)}
.perf #edet *,#edet.ni *{transition-duration:0s}
@media (prefers-reduced-motion:reduce){#edet *{transition:none!important}}
</style>`);
