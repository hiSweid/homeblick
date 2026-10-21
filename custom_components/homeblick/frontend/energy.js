// Energie-Face. Vorlage = Entwurf 1 des Users (statt Apple-Bildern; Bild scratchpad en/Entwurf1.png, Mockup en/m5.html Abschnitt #d1, Maße dort in cqw bei 784 px).
// Raster/Glas/Press/Analoguhr = Home-Face (.f-grid/.tile/.dial aus index.html), Zahlen-Roll = roll() aus index.html, Federn = --spring/--sd.
// Reihe 1: Solar jetzt 2×1 (kW + Tageskurve: Ist gelb gefüllt, Rest gestrichelte Solcast-Prognose) · autark (Ring)
// Reihe 2: Verbrauch (Haus-kW, Netzbalken: Mitte = 0, rechts grün Einspeisung, links orange Bezug) · Akku · e-Golf (weiße An-Kacheln)
// Reihe 3: Heute (kWh von Prognose) · Morgen (Prognose + Spitzenzeit) · Analoguhr

// HA-Entities (Prod-HA geprüft 2026-10-21), im Live-Editor je Face änderbar (f.ents). Leistung in W oder kW (Einheit wird gelesen).
// Netz: + = Bezug, − = Einspeisung; Akku: + = Entladen, − = Laden
export const E = {
  pv: 'sensor.evcc_pv_power', home: 'sensor.evcc_home_power', grid: 'sensor.evcc_grid_power',
  bat: 'sensor.evcc_battery_power', soc: 'sensor.evcc_battery_soc',
  car: 'sensor.evcc_garage_charge_power', carSoc: 'sensor.evcc_garage_vehicle_soc', range: 'sensor.evcc_garage_vehicle_range',
  today: 'sensor.kostal_piko_daily_energy', todayFc: 'sensor.solcast_pv_forecast_prognose_heute',
  tomorrow: 'sensor.solcast_pv_forecast_prognose_morgen', tomorrowPeak: 'sensor.solcast_pv_forecast_zeitpunkt_spitzenleistung_morgen',
};
const E0 = { ...E };
export const energyEnts = (m = {}) => { for (const k in E) E[k] = m[k] || E0[k]; };

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
const bar = (k, mid = '') => `<div class="bar ${k} ${mid}"><div class="cl"><i></i></div></div>`;
let gN = 0;

// Kurve einmal einzeichnen, wenn das Face steht (≥ 95 % sichtbar = Pager eingerastet); ganz weg → beim nächsten Erscheinen wieder
const io = new IntersectionObserver(es => { for (const e of es) {
  const f = e.target;
  if (e.intersectionRatio >= .95 && !f._drawn) { f._drawn = true; drawIn(f); }
  else if (!e.isIntersecting && f._drawn) { f._drawn = false; veil(f, !still()); }
} }, { threshold: [0, .95] });

export function energyFace(el) {
  const g = 'eg' + ++gN;
  el.classList.add('f-grid');   // Raster/Glas/Uhr des Home-Face
  el.insertAdjacentHTML('beforeend', `
<div class="tile et pv" style="${cell(0, 0, 2)}">${ttl('sun', 'Solar jetzt', 'y')}${val('pv', ' kW')}
  <div class="cw"><div class="ci"><svg viewBox="0 0 100 30" preserveAspectRatio="none"><defs><linearGradient id="${g}" x2="0" y2="1"><stop offset="0" stop-color="#ffd60a" stop-opacity=".6"/><stop offset="1" stop-color="#ffd60a" stop-opacity="0"/></linearGradient></defs>
    <path class="ar" fill="url(#${g})"/><path class="ln"/><path class="fc"/></svg></div></div></div>
<div class="tile et aut" style="${cell(0, 2)}"><svg class="rg" viewBox="-50 -50 100 100"><circle r="44"/><circle class="on" r="44" pathLength="100" transform="rotate(-90)"/></svg>${val('aut', '%')}<div class="sub">autark</div></div>
<div class="tile et use" style="${cell(1, 0)}">${ttl('home', 'Verbrauch')}${val('home', ' kW')}<div class="bar g mid"><div class="cl l"><i></i></div><div class="cl r"><i></i></div></div><div class="sub gl" data-bind="e_gl"></div></div>
<div class="tile et on bat" style="${cell(1, 1)}">${ttl('bat', 'Akku', 'gr')}${val('soc', '%')}${bar('soc')}<div class="sub" data-bind="e_batl"></div></div>
<div class="tile et on car" style="${cell(1, 2)}">${ttl('car', 'e-Golf', 'bl')}${val('carSoc', '%')}${bar('carSoc')}<div class="sub" data-bind="e_carl"></div></div>
<div class="tile et day" style="${cell(2, 0)}">${ttl('sun', 'Heute', 'y')}${val('today')}<div class="sub dim" data-bind="e_todayl"></div>${bar('today', 'mid')}</div>
<div class="tile et tmr" style="${cell(2, 1)}">${ttl('sun', 'Morgen')}${val('tomorrow')}<div class="sub dim">kWh Prognose</div><div class="sub pk" data-bind="e_peak"></div></div>
<div class="dial glass" style="grid-area:3/3;--r:2;--c:2"></div>`);
  veil(el, !still());   // Kurve bis zum Einzeichnen verdeckt, auch während das Face hereingleitet
  io.observe(el);
  if (V) paint(el);
}

// ---------- Tageskurve ----------
// Ist = HA-History der PV-Leistung (Demo: simuliert), Prognose = Solcast detailedForecast (pv_estimate kW je 30 min) des Heute-Sensors
let H = [], F = [];   // [[ms, W]]
let histFn = null, histAt = 0, demo = false;
export function energyInit(fn) { histFn = fn; }   // fn(ids, start) → Promise<{id: [{s, lu}]}> (WS history/history_during_period)
const day0 = () => new Date().setHours(0, 0, 0, 0);
const isKW = s => /^kW$/i.test(s?.attributes.unit_of_measurement);
async function loadHist(ents) {
  if (demo || !histFn || !ents[E.pv] || Date.now() - histAt < 3e5) return;
  histAt = Date.now();
  try {
    const r = await histFn([E.pv], new Date(day0()));
    if (!r) return void (histAt = 0);   // noch keine Verbindung
    const f = isKW(ents[E.pv]) ? 1000 : 1;
    H = (r[E.pv] || []).map(x => [(x.lu ?? x.lc) * 1000, parseFloat(x.s) * f]).filter(p => isFinite(p[1]) && isFinite(p[0]));
    for (const f of $$('.f-energy')) paint(f);
  } catch (e) { histAt = Date.now() - 24e4; console.warn('Energie-History', e); }   // nach 1 min neu versuchen
}
const rec = (v, now = Date.now()) => {   // Live-Werte anhängen (höchstens jede Minute), Mitternacht schneidet ab
  const d = day0();
  while (H.length && H[0][0] < d) H.shift();
  if (v != null && (!H.length || now - H.at(-1)[0] >= 6e4)) H.push([now, v]);
};
// Mittelwert je Schritt (Kurve: 15 min) (Zustand hält bis zur nächsten Änderung)
function bins(s, t0, t1, step) {
  const out = [];
  let i = 0, v = 0;
  while (i < s.length && s[i][0] <= t0) v = s[i++][1];
  for (let t = t0; t < t1; t += step) {
    let sum = 0, a = t;
    const b = Math.min(t + step, t1);
    while (i < s.length && s[i][0] < b) { sum += v * (s[i][0] - a); a = s[i][0]; v = s[i++][1]; }
    sum += v * (b - a);
    out.push([Math.min(t + step / 2, t1), sum / (b - t)]);
  }
  return out;
}
// Catmull-Rom → Bézier (weiche Kurve ohne Knicke), Kontrollpunkte auf die Fläche geklemmt
const cl = (v, lo = 0, hi = 30) => Math.min(hi, Math.max(lo, v));
const smooth = p => p.map(([x, y], i) => {
  if (!i) return `M${x.toFixed(2)},${y.toFixed(2)}`;
  const a = p[i - 2] || p[i - 1], b = p[i - 1], c = p[i + 1] || [x, y];
  return `C${(b[0] + (x - a[0]) / 6).toFixed(2)},${cl(b[1] + (y - a[1]) / 6).toFixed(2)} ${(x - (c[0] - b[0]) / 6).toFixed(2)},${cl(y - (c[1] - b[1]) / 6).toFixed(2)} ${x.toFixed(2)},${y.toFixed(2)}`;
}).join('');
// Fläche 100×30 wie im Entwurf: x = Erzeugungsfenster laut Prognose (sonst 6–21 Uhr), y = 30 (0 W) … 2 (Tagesspitze aus Ist/Prognose)
function curve() {
  const now = Date.now(), d = day0(), nz = F.filter(p => p[1] > 0);
  const t0 = nz.length ? nz[0][0] - 36e5 : d + 6 * 36e5, t1 = nz.length ? nz.at(-1)[0] + 36e5 : d + 21 * 36e5;   // F-Punkte = Periodenmitte; ±1 h = Nullpunkt mit Rand
  const peak = Math.max(1000, ...H.filter(p => p[0] >= d).map(p => p[1]), ...F.map(p => p[1]));
  const P = ([t, v]) => [100 * (t - t0) / (t1 - t0), 30 - 28 * Math.max(0, v) / peak];
  const ist = now > t0 ? bins(H, t0, Math.min(now, t1), 9e5).map(P) : [];
  if (ist.length) ist.unshift([0, 30]);
  const end = ist.at(-1), rest = F.filter(p => p[0] > Math.max(now, t0) + 18e5 && p[0] < t1).map(P);
  const fc = rest.length ? [end || P([t0, 0]), ...rest, [100, 30]] : [];
  const ln = ist.length > 1 ? smooth(ist) : '';
  return { ln, ar: ln && `${ln}V30H0Z`, fc: fc.length > 1 ? smooth(fc) : '' };
}
function paint(f) {
  const c = V.ok?.pv ? curve() : { ln: '', ar: '', fc: '' };
  for (const k of ['ln', 'ar', 'fc']) { const p = f.querySelector('.cw .' + k); if (p.getAttribute('d') !== c[k]) p.setAttribute('d', c[k]); }
}
// Einzeichnen per Wischblende (nur transform): Fenster nach links geschoben, Inhalt gegenläufig → verdeckt; weiche Kante liegt in Ruhe rechts neben der Kurve
const VEIL = ['translateX(-29cqw)', 'translateX(29cqw)'];
function veil(f, on) { const cw = f.querySelector('.cw'); [cw, cw.firstElementChild].forEach((n, i) => n.style.transform = on ? VEIL[i] : ''); }
function drawIn(f) {
  if (still()) return veil(f, false);
  const cw = f.querySelector('.cw'), o = { duration: 1600, easing: SPR(), fill: 'forwards' };   // Feder gestreckt: zeichnet weich von links nach rechts
  const as = [cw, cw.firstElementChild].map((n, i) => n.animate([{ transform: VEIL[i] }, { transform: 'none' }], o));
  as[0].onfinish = () => { veil(f, false); as.forEach(a => a.cancel()); };
}

// ---------- Anzeige ----------
let V = null, R = null;   // letzter Stand; roll() aus index.html
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
  const [pv, home, grid, bat, soc, car, carSoc, range, today, todayFc, tomorrow] = ['pv', 'home', 'grid', 'bat', 'soc', 'car', 'carSoc', 'range', 'today', 'todayFc', 'tomorrow'].map(v);
  const fa = st('todayFc')?.attributes, fl = fa?.detailedForecast || fa?.detailedHourly || [];
  const step = fl.length > 1 ? Date.parse(fl[1].period_start) - Date.parse(fl[0].period_start) : 0;
  F = fl.map(p => [Date.parse(p.period_start) + step / 2, p.pv_estimate * 1000]).filter(p => isFinite(p[0]) && isFinite(p[1]) && p[0] >= day0() && p[0] < day0() + 864e5);
  if (ok.pv) rec(pv);
  V = { ok };
  loadHist(ents);
  const faces = $$('.f-energy');
  if (!faces.length) return;
  const n = (k, t) => rb('e_' + k, ok[k] ? t : '–');
  n('pv', kw(pv)); n('home', kw(home)); n('soc', String(Math.round(soc))); n('carSoc', String(Math.round(carSoc))); n('today', de(today)); n('tomorrow', de(tomorrow));
  const imp = grid > 50, exp = grid < -50;   // |Netz| ≤ 50 W = Regelrauschen → 0 (Text, Balken und Autarkie gleich)
  const aut = ok.home && ok.grid ? (home > 0 ? Math.round(100 * (1 - Math.min(1, (imp ? grid : 0) / home))) : 100) : null;   // Autarkie = 1 − Netzbezug / Verbrauch
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
    const set = (s, k, x, show = true) => { const b = f.querySelector(s); b.style.setProperty(k, x); b.style.visibility = show ? '' : 'hidden'; };
    set('.rg .on', '--v', aut == null ? 0 : aut / 100);
    set('.bar.g', '--g', imp || exp ? Math.max(-1, Math.min(1, -grid / 4000)) : 0, ok.grid);   // ponytail: halbe Balkenbreite = 4 kW, darüber voll
    set('.bar.soc', '--v', c01(soc / 100), ok.soc);
    set('.bar.carSoc', '--v', c01(carSoc / 100), ok.carSoc);
    set('.bar.today', '--v', c01(today / todayFc), ok.today && ok.todayFc && todayFc > 0);
    const gl = f.querySelector('.gl'); gl.classList.toggle('imp', imp); gl.classList.toggle('z', !imp && !exp);
    paint(f);
  }
}

// ---------- Demo ----------
// Oktobertag in Schwäbisch Gmünd: PV ~7:40–18:30, mittags ~4,3 kW mit durchziehenden Wolken, Grundlast + Wasserkocher/Kochen,
// Akku regelt auf Netz ≈ 0 (Laden 1,2 kW, vormittags 0,7 kW / Entladen 1,5 kW, 10,24 kWh), e-Golf lädt bei Überschuss (35,8 kWh) → Bezug und Einspeisung wechseln (Wolken, Wasserkocher).
const S = { soc: 70, socC: 41, last: 0, car: false };
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
  const base = 360 + 170 * n(5e4) + (h > 18 && h < 19.4 ? 1300 : 0), home = base + (cyc < -.85 ? 2400 : 0);   // Wasserkocher ~55 s
  if (s.socC >= 85 || pv - base < 900) s.car = false; else if (pv - base > 1700) s.car = true;   // Hysterese wie evcc „PV“
  const car = s.car && cyc < .2 ? Math.min(3700, Math.max(1400, pv - base - 1200)) : 0;   // Auto nimmt den Überschuss nach Akku-Laden (1,2 kW); Pause ≈ 2 min
  let bat = Math.max(h < 12 ? -700 : -1200, Math.min(1500, home + car - pv));   // prognosebasiertes Laden: vormittags gedrosselt → Einspeisung
  if (bat > 0 && (s.soc <= 10.5 || car) || bat < 0 && s.soc >= 99.5) bat = 0;   // evcc: Akku-Entladung gesperrt, solange das Auto lädt → Lastspitzen kommen aus dem Netz
  const dt = s.last ? (now - s.last) / 3.6e6 : 0;
  s.soc = Math.min(100, Math.max(10, s.soc - bat * dt / 102.4)); s.socC = Math.min(100, s.socC + car * dt / 358); s.last = now;
  return { pv, home, car, bat, grid: home + car - pv - bat + 25 * n(6e3) };
}
// Solcast-artige Prognose (30-min-Perioden, kW): klarer Tag × Faktor; morgen sonniger als heute
const fcDay = (d, k) => Array.from({ length: 48 }, (_, i) => ({ period_start: new Date(d + i * 18e5).toISOString(), pv_estimate: +(4.3 * k * sunAt(i / 2 + .25)).toFixed(4) }));
export function energyDemo(now = Date.now()) {
  if (!demo) {   // einmal: Tag ab Mitternacht in 2-min-Schritten, schreibt die History
    demo = true;
    for (let t = day0(); t < now; t += 12e4) H.push([t, model(t, S, false).pv]);
  }
  const m = model(now, S), W = { unit_of_measurement: 'W' }, P = { unit_of_measurement: '%' }, K = { unit_of_measurement: 'kWh' };
  const d = day0(), fc = fcDay(d, kd[0] === d ? kd[1] : (kd = [d, kDay(d)])[1]), fc2 = fcDay(d + 864e5, 1), sum = l => l.reduce((a, p) => a + p.pv_estimate / 2, 0);
  const pk = fc2.reduce((a, p) => p.pv_estimate > a.pv_estimate ? p : a);
  const today = H.reduce((a, [t, w], i) => a + w * ((H[i + 1]?.[0] ?? now) - t), 0) / 3.6e9;
  return { [E.pv]: [Math.round(m.pv), W], [E.grid]: [Math.round(m.grid), W], [E.home]: [Math.round(m.home), W],
    [E.bat]: [Math.round(m.bat), W], [E.soc]: [Math.round(S.soc), P],
    [E.car]: [Math.round(m.car), W], [E.carSoc]: [Math.round(S.socC), P], [E.range]: [Math.round(S.socC * 1.9), { unit_of_measurement: 'km' }],
    [E.today]: [today.toFixed(2), K], [E.todayFc]: [sum(fc).toFixed(4), { ...K, detailedForecast: fc }],
    [E.tomorrow]: [sum(fc2).toFixed(4), { ...K, detailedForecast: fc2 }], [E.tomorrowPeak]: [new Date(Date.parse(pk.period_start)).toISOString(), { device_class: 'timestamp' }] };
}

// Maße/Farben aus m5.html #d1 (cqw bei 784 px)
document.head.insertAdjacentHTML('beforeend', `<style>
@property --g{syntax:'<number>';inherits:true;initial-value:0}
.f-energy{--eink:hsl(calc(var(--h,30) - 4) 88% 19%);--eink2:hsl(calc(var(--h,30) - 4) 38% 44%);--trk:#ffffff38}   /* Orange-Face: #5a2a06 / #9a6a45 wie Entwurf */
.f-energy.mono{--eink:#1c1c1e;--eink2:#1c1c1e99}
.f-energy.light{--trk:#0000001a}
.f-energy .et{display:block;padding:4.6cqw 3.4cqw;text-align:left;line-height:normal;white-space:nowrap;overflow:hidden}
.f-energy .et.pv{padding:4.4cqw 5cqw}
.f-energy .et .ttl{line-height:normal}
.f-energy svg.i{vertical-align:-.12em}
.f-energy .i.y{color:#ffd60a}.f-energy .i.gr{color:#28b04a}.f-energy .i.bl{color:#1d8fd8}
.f-energy.light .i.y{color:#e0a800}
.f-energy .enum{display:flex;align-items:baseline;font-size:8.6cqw;margin-top:1.4cqw;font-weight:600;letter-spacing:-.025em;font-variant-numeric:tabular-nums}
.f-energy .enum .num{font-weight:inherit;line-height:inherit;letter-spacing:inherit;justify-items:start}
.f-energy .enum small{font-size:3.4cqw;white-space:pre}
.f-energy .pv .enum{font-size:14cqw;line-height:1;margin-top:1.6cqw}
.f-energy .pv .enum small{font-size:5cqw;font-weight:500}
.f-energy .use .enum small{font-weight:500}   /* „ kW“ Medium, „%“ wie die Zahl */
.f-energy .sub{font-size:3cqw;line-height:normal;color:inherit;transition:color .3s}
.f-energy .dim{color:#ffffff9e}.f-energy.light .dim{color:#828284}
/* Autarkie: Ring 24,2 cqw (r 44, Strich 6 von 100), Zahl 8 cqw */
.f-energy .aut{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0}
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
.f-energy .on .sub{margin-top:1.8cqw}
.f-energy .tmr .pk{margin-top:2cqw}
/* Weiße An-Kacheln (Akku, e-Golf): Fläche #fffe → #ffffffc8, Schrift im Face-Ton */
/* Glas wie Home-Kachel, aber wie im Entwurf gesättigter (backdrop saturate 1.3 + Weiß 6 %): Wallpaper-Schicht als ::after mit Filter (statisch, einmal gerastert) */
/* Uhr: dieselbe Glasfläche, rund (Entwurf: .g mit border-radius 50 %) */
.f-energy:not(.light) :is(.et,.dial.glass){background:none}
.f-energy:not(.light) .dial.glass{isolation:isolate;box-shadow:inset 0 .25cqw .1cqw #ffffff59,inset 0 -.25cqw .1cqw #ffffff40,inset 0 0 0 .25cqw #ffffff2e,0 0 0 .13cqw #0000002e,0 .6cqw 2cqw #0003}
.f-energy:not(.light) :is(.et,.dial.glass)::after{content:"";position:absolute;inset:0;z-index:-2;border-radius:inherit;filter:saturate(1.3);
  box-shadow:inset 0 .25cqw .1cqw #ffffff59,inset 0 -.25cqw .1cqw #ffffff40,inset 0 0 0 .25cqw #ffffff2e;   /* helle Glaskante: ::after (isolation) liegt über den inset-Schatten des Elements */
  background:linear-gradient(165deg,#fff3,#fff1 45%,#fff0 75%),linear-gradient(#ffffff0f,#ffffff0f),var(--wpb) calc(-1*(var(--pad) + var(--c)*(var(--t) + var(--gap)))) calc(-1*(var(--pad) + var(--r)*(var(--t) + var(--gap))))/100cqw 100cqw}
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
</style>`);
