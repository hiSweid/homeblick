// Energie-Face. Keine Apple-Vorlage für Energie (ref/vorlagen/INDEX.md, Abdeckung) → Gestaltung nur aus der Designsprache der Vorlagen abgeleitet:
// - Raster, Kachelmaße, Glas, Press, Analoguhr oben rechts = Home-Face (Website highlights/dashboard, y-MO 03850, TGo 00475; Klassen .f-grid/.tile/.dial aus index.html)
// - Zahl + Titel + Untertitel in 1×1 = Thermostat-Kachel 1×1 (Zahl 10 cqw Medium, Titel/Untertitel 3 cqw)
// - 2×1 Solar/e-Golf = Widget-Aufbau (Wetter-Widget _Tbq 00360/TGo 00418: Ort oben links, große Zahl darunter), Zahl 13 cqw wie Thermostat 2×1
// - Füllstand Akku/e-Golf = Slider-Füllung (Kontrollzentrum _Tbq 00500, Licht-Vollbild y-MO 00005): weiße Fläche wie Kachel „an“, Text an der Füllkante geteilt
// - Autarkie = Strichkranz des Timers (TGo 00278), Glasscheibe wie die Uhr-Kachel
// - Vollbild (Tipp auf Solar/Akku/e-Golf) = Licht-/Klima-Vollbild: ✕ oben links, Titel mittig, Uhrzeit rechts, Zeile + große Zahl + Meta (Maße von #climate/#dimmer), Füllung = Wert
// - Energiefluss (aus Mockup A): Lichtpunkte gleiten über die Fugen zwischen Kachel und Haus, Tempo = Leistung (WAAPI playbackRate, weich gerampt), Richtung per Aus-/Einblenden
// Werte kommen alle aus evcc (ein gemeinsamer Stand); Haus = evcc-Heimverbrauch, Tageskurven aus der HA-History (Demo: simuliert).

// HA-Entities, per API geprüft 2026-10-21; Werte in W oder kW (Einheit wird gelesen). Netz: + = Bezug, − = Einspeisung; Akku: + = Entladen, − = Laden; e-Golf = evcc-Ladepunkt „garage“ (kW)
export const E = {
  pv: ['sensor.evcc_pv_power'],
  grid: ['sensor.evcc_grid_power'],
  home: ['sensor.evcc_home_power'],
  bat: ['sensor.evcc_battery_power'],
  soc: ['sensor.evcc_battery_soc'],
  cap: ['sensor.evcc_battery_capacity'],
  car: ['sensor.evcc_garage_charge_power'],
  carSoc: ['sensor.evcc_garage_vehicle_soc'],
  range: ['sensor.evcc_garage_vehicle_range'],
};
const C = { pv: '#ffd60a', bat: '#30d158', grid: '#64d2ff', car: '#bf5af2' };   // Systemfarben (dunkel) für Lichtpunkte und Autarkie
const CAR = '<path d="M3.5 15.5v-3l2-5.2A2 2 0 0 1 7.4 6h9.2a2 2 0 0 1 1.9 1.3l2 5.2v3M3.5 15.5h17M3.5 15.5V18h2.6v-2.5M20.5 15.5V18h-2.6v-2.5M3.8 12.5h16.4"/><circle cx="7.3" cy="13.9" r=".4"/><circle cx="16.7" cy="13.9" r=".4"/>';
const SUN = '<circle cx="12" cy="12" r="4.9" fill="currentColor" stroke="none"/><path d="M12 3.2v1.8M12 19v1.8M3.2 12H5M19 12h1.8M5.8 5.8l1.3 1.3M16.9 16.9l1.3 1.3M5.8 18.2l1.3-1.3M16.9 7.1l1.3-1.3" stroke-width="1.7"/>';
const de = (v, d = 1) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const kw = w => de(Math.abs(w) / 1000);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const still = () => root.classList.contains('perf') || matchMedia('(prefers-reduced-motion: reduce)').matches;   // Leistungsmodus / weniger Bewegung: keine JS-Animationen
const SPR = () => getComputedStyle(root).getPropertyValue('--spring').trim() || 'ease-out';   // globale Feder (index.html spring()), gestreckt = weicher

// Raster wie Home-Face: Kachel t = (100 − 2·1,9 − 2·1,65)/3 = 30,97 cqw; Fugenmitten (cqw) für den Fluss, --rot zeigt zum Haus (Mitte)
const SEAM = { pv: [50, 33.69, 0], bat: [33.69, 50, -90], grid: [66.31, 50, 90], car: [50, 66.31, 180] };
const cell = (r, c, h = 1, w = 1) => `grid-area:${r + 1}/${c + 1}/span ${h}/span ${w};--r:${r};--c:${c}`;
const nv = (k, u, cls = '') => `<div class="nv ${cls}"><b class="num" data-bind="e_${k}" data-digits></b><small>${u}</small></div>`;
const one = (k, ttl, u) => `${nv(k, u)}<div><div class="ttl">${ttl}</div><div class="sub" data-bind="e_${k}l"></div></div>`;
const car = () => `<div class="ttl lb">e-Golf</div>${nv('car', '%')}<div class="sub bl" data-bind="e_carl"></div><svg class="i cic" viewBox="0 0 24 24">${CAR}</svg>`;
const ticks = cls => `<svg class="${cls}" viewBox="-50 -50 100 100">${Array.from({ length: 60 }, (_, i) => `<line y1="-45.5" y2="-38" transform="rotate(${i * 6})" style="--i:${i}"/>`).join('')}</svg>`;
let gN = 0;

// Kurve beim Erscheinen des Faces einmal einzeichnen; Fluss nur animieren, solange das Face sichtbar ist
const io = new IntersectionObserver(es => { for (const e of es) {
  const f = e.target, vis = e.isIntersecting;
  if (vis && !f._vis) drawIn(f);
  f._vis = vis;
  for (const a of f._fl || []) vis && !still() ? a.play() : a.pause();
} });

export function energyFace(el) {
  const g = 'eg' + ++gN;
  el.classList.add('f-grid');   // Raster/Glas/Uhr-Stile des Home-Face
  el.insertAdjacentHTML('beforeend', `
<div class="tile et w pv" data-k="pv" data-act="edet" data-v="pv" style="${cell(0, 0, 1, 2)}">
  <div class="cw"><div class="ci"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="${g}" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".42"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    <path class="ar" fill="url(#${g})"/><path class="ln"/></svg><i class="nd"></i></div></div>
  <div class="ttl lb">Solar <svg class="i" viewBox="0 0 24 24">${SUN}</svg></div>${nv('pv', 'kW')}<div class="sub tr" data-bind="e_pvd"></div>
</div>
<div class="dial glass" style="grid-area:1/3"></div>
<div class="tile et bat" data-k="bat" data-act="edet" data-v="bat" style="${cell(1, 0)}"><div class="ef"><div class="in">${one('bat', 'Akku', '%')}</div></div>${one('bat', 'Akku', '%')}</div>
<div class="tile et home" data-k="home" style="${cell(1, 1)}">${one('home', 'Haus', 'kW')}</div>
<div class="tile et grid" data-k="grid" style="${cell(1, 2)}">${one('grid', 'Netz', 'kW')}</div>
<div class="ad glass" data-k="aut" style="grid-area:3/1">${ticks('t0')}${ticks('t1')}<div class="ac">${nv('aut', '%')}<span>autark</span></div></div>
<div class="tile et w car" data-k="car" data-act="edet" data-v="car" style="${cell(2, 1, 1, 2)}"><div class="ef"><div class="in">${car()}</div></div>${car()}</div>
<div class="efl">${Object.entries(SEAM).map(([k, [x, y, r]]) => `<div class="sm" data-fl="${k}" data-rot="${r}" style="left:${x}cqw;top:${y}cqw;rotate:${r}deg;--c:${C[k]}"><i></i></div>`).join('')}</div>`);
  // Punkte: Streifen um eine Periode verschieben, endlos; Tempo später nur über playbackRate
  el._fl = $$('.sm>i', el).map(i => { const a = i.animate([{ transform: 'none' }, { transform: 'translateY(5cqw)' }], { duration: 1000, iterations: Infinity }); a.pause(); i.parentNode._a = a; return a; });
  io.observe(el);
  if (V.pv != null) paint(el);
}

// ---------- Tagesverlauf (HA-History, Demo simuliert) ----------
const H = { pv: [], soc: [], carSoc: [] };   // [[ms, W bzw. %]]
let histFn = null, histAt = 0, demo = false;
export function energyInit(fn) { histFn = fn; }   // fn(ids, start) → Promise<{id: [{s, lu}]}> (WS history/history_during_period)
const day0 = () => new Date().setHours(0, 0, 0, 0);
async function loadHist(ents) {
  if (demo || !histFn || Date.now() - histAt < 3e5) return;
  histAt = Date.now();
  const ids = Object.fromEntries(Object.keys(H).map(k => [k, E[k].find(id => ents[id])]).filter(([, id]) => id));
  try {
    const r = await histFn(Object.values(ids), new Date(day0()));
    if (!r) return void (histAt = 0);   // noch keine Verbindung
    for (const [k, id] of Object.entries(ids)) {
      const f = /^kW/i.test(ents[id]?.attributes.unit_of_measurement) ? 1000 : 1;
      H[k] = (r[id] || []).map(x => [(x.lu ?? x.lc) * 1000, parseFloat(x.s) * f]).filter(p => isFinite(p[1]) && isFinite(p[0]));
    }
    for (const f of $$('.f-energy')) paint(f);
    detail();
  } catch (e) { histAt = Date.now() - 24e4; console.warn('Energie-History', e); }   // nach 1 min neu versuchen
}
const rec = (k, v, now = Date.now()) => {   // Live-Werte anhängen (höchstens jede Minute), Mitternacht schneidet ab
  const s = H[k], d = day0();
  while (s.length && s[0][0] < d) s.shift();
  if (v != null && (!s.length || now - s.at(-1)[0] >= 6e4)) s.push([now, v]);
};
// Mittelwert je 10 min (Zustand hält bis zur nächsten Änderung), x/y in 0…100
function bins(s, t0, t1, step = 6e5) {
  const out = [], end = Math.min(t1, Date.now());
  let i = 0, v = 0;
  while (i < s.length && s[i][0] <= t0) v = s[i++][1];
  for (let t = t0; t < end; t += step) {
    let sum = 0, a = t, b = Math.min(t + step, end);
    while (i < s.length && s[i][0] < b) { sum += v * (s[i][0] - a); a = s[i][0]; v = s[i++][1]; }
    sum += v * (b - a);
    out.push([Math.min(t + step / 2, end), sum / (b - t)]);
  }
  return out;
}
const kwh = s => s.reduce((a, [t, v], i) => a + Math.max(0, v) * ((s[i + 1]?.[0] ?? Date.now()) - t), 0) / 3.6e9;
// Catmull-Rom → Bézier (weiche Kurve ohne Knicke), Kontrollpunkte auf die Fläche geklemmt
const cl = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const smooth = p => p.map(([x, y], i) => {
  if (!i) return `M${x.toFixed(2)},${y.toFixed(2)}`;
  const a = p[i - 2] || p[i - 1], b = p[i - 1], c = p[i + 1] || [x, y];
  return `C${(b[0] + (x - a[0]) / 6).toFixed(2)},${cl(b[1] + (y - a[1]) / 6).toFixed(2)} ${(x - (c[0] - b[0]) / 6).toFixed(2)},${cl(y - (c[1] - b[1]) / 6).toFixed(2)} ${x.toFixed(2)},${y.toFixed(2)}`;
}).join('');
// Solarkurve: Tag 6–21 Uhr, y-Skala = Spitze (mind. 1 kW); top = Rand oben in % der Fläche
function pvPath(top = 10) {
  const d = day0(), t0 = d + 6 * 36e5, t1 = d + 21 * 36e5, b = bins(H.pv, t0, t1);
  if (b.length < 2) return null;
  const peak = Math.max(1000, ...H.pv.map(p => p[1]).filter((_, i) => H.pv[i][0] >= d)) * 1.08;
  const pts = b.map(([t, v]) => [100 * (t - t0) / (t1 - t0), 100 - (100 - top) * Math.max(0, v) / peak]);
  const ln = smooth(pts), [x0] = pts[0], [x1, y1] = pts.at(-1);
  return { ln, ar: `${ln}L${x1.toFixed(2)},100L${x0.toFixed(2)},100Z`, x: x1, y: y1 };
}

// ---------- Anzeige ----------
const V = {};   // letzter Stand (für neu gebaute Faces und die Detailansicht)
let R = null;   // roll() aus index.html
const bd = (k, t) => { for (const e of $$(`[data-bind="${k}"]`)) if (e.textContent !== t) e.textContent = t; };
// Zahl rollen; Richtung aus dem Wert (steigt → nach oben, sinkt → nach unten wie P2-5)
const rb = (k, t) => { for (const el of $$(`[data-bind="${k}"]`)) {
  const o = el.lastElementChild;
  if (o?.textContent === t) continue;
  const a = parseFloat(o?.textContent.replace(',', '.')), b = parseFloat(t.replace(',', '.'));
  R(el, t, !o || still() ? 0 : b < a ? -1 : 1);
} };
function paint(f) {
  const p = pvPath(14);
  if (p) {
    const [ar, ln] = $$('.cw path', f);
    if (ln.getAttribute('d') !== p.ln) { ln.setAttribute('d', p.ln); ar.setAttribute('d', p.ar); }
    const nd = $$('.nd', f)[0]; nd.style.left = p.x + '%'; nd.style.top = p.y + '%';
  }
  f.querySelector('.cw').hidden = !p;
}
function drawIn(f) {
  if (still()) return;
  const cw = f.querySelector('.cw'), o = { duration: 2000, easing: SPR(), fill: 'backwards' };   // Feder auf 2 s gestreckt: ≈ 90 % nach 0,6 s, läuft weich aus
  // Wischblende nur per transform: Fenster läuft nach rechts, Inhalt steht (Gegenbewegung); weiche Kante liegt in Ruhe außerhalb der Kachel
  cw.animate([{ transform: 'translateX(-38.5cqw)' }, { transform: 'none' }], o);
  cw.firstElementChild.animate([{ transform: 'translateX(38.5cqw)' }, { transform: 'none' }], o);
}
// Fluss: Richtung wechseln = ausblenden, drehen, einblenden; Tempo weich rampen (800 ms, ease-out)
function rate(a, r) {
  if (a._t === r) return;
  a._t = r; cancelAnimationFrame(a._raf);
  const r0 = a.playbackRate, t0 = performance.now();
  const f = now => { const k = Math.min(1, (now - t0) / 800); a.updatePlaybackRate(r0 + (r - r0) * (1 - (1 - k) ** 3)); if (k < 1) a._raf = requestAnimationFrame(f); };
  a._raf = requestAnimationFrame(f);
}
function flow(sm, w, show) {
  const on = show && Math.abs(w) > 50, rot = +sm.dataset.rot + (w < 0 ? 180 : 0);
  sm._on = on;
  if (on) rate(sm._a, Math.round(Math.min(3, .45 + Math.abs(w) / 1600) * 20) / 20);   // ponytail: lineare Skala bis ~4 kW, danach gedeckelt
  if (!on) return sm.classList.remove('on');
  if (sm._rot === rot) return sm.classList.add('on');
  sm._want = rot;
  if (sm._rot === undefined || !sm.classList.contains('on')) { sm._rot = rot; sm.style.rotate = rot + 'deg'; return sm.classList.add('on'); }
  sm.classList.remove('on'); clearTimeout(sm._tt);
  sm._tt = setTimeout(() => { sm._rot = sm._want; sm.style.rotate = sm._rot + 'deg'; if (sm._on) sm.classList.add('on'); }, 450);
}

// Aus index.html bei jedem render(); roll = Zahlen-Roll (index.html)
export function energy(ents, roll) {
  R = roll;
  const has = k => E[k].some(id => ents[id] && !isNaN(parseFloat(ents[id].state)));
  const v = k => E[k].map(id => ents[id]).filter(s => s && !isNaN(parseFloat(s.state)))
    .reduce((a, s) => a + parseFloat(s.state) * (/^kW/i.test(s.attributes.unit_of_measurement) && !/kWh/i.test(s.attributes.unit_of_measurement) ? 1000 : 1), 0);
  const pv = v('pv'), grid = v('grid'), home = v('home'), bat = v('bat'), soc = v('soc'), car = v('car'), carSoc = v('carSoc'), range = v('range'), cap = v('cap');
  const ok = { pv: has('pv'), grid: has('grid'), home: has('home'), bat: has('soc'), car: has('carSoc'), aut: has('grid') && has('home') };
  Object.assign(V, { pv, grid, home, bat, soc, car, carSoc, range, cap, ok });
  if (ok.pv) rec('pv', pv); if (ok.bat) rec('soc', soc); if (ok.car) rec('carSoc', carSoc);
  loadHist(ents);
  const faces = $$('.f-energy');
  if (!faces.length) return;
  rb('e_pv', kw(pv)); rb('e_home', kw(home)); rb('e_grid', kw(grid)); rb('e_bat', String(Math.round(soc))); rb('e_car', String(Math.round(carSoc)));
  const use = home + Math.max(0, car), aut = use > 0 ? Math.round(100 * (1 - Math.min(1, (grid > 50 ? grid : 0) / use))) : 100;   // Autarkie = Anteil des Verbrauchs (Haus + Auto) ohne Netzbezug; < 50 W = Regelrauschen („Ausgeglichen“)
  rb('e_aut', String(aut));
  const today = kwh(H.pv.filter(p => p[0] >= day0()));
  bd('e_pvd', H.pv.length > 1 ? `Heute ${de(today)} kWh` : '');
  bd('e_homel', 'Verbrauch');
  bd('e_gridl', grid > 50 ? 'Bezug' : grid < -50 ? 'Einspeisung' : 'Ausgeglichen');
  bd('e_batl', bat < -50 ? `lädt · ${kw(bat)} kW` : bat > 50 ? `entlädt · ${kw(bat)} kW` : 'Bereit');
  bd('e_carl', [has('range') && `${Math.round(range)} km`, car > 50 ? `lädt ${kw(car)} kW` : has('range') ? 'Reichweite' : ''].filter(Boolean).join(car > 50 ? ' · ' : ' '));
  const flows = { pv, grid, bat, car: -car };   // + = zum Haus
  for (const f of faces) {
    for (const [k, on] of Object.entries(ok)) for (const t of $$(`[data-k=${k}]`, f)) t.hidden = !on;
    f.querySelector('.et.bat').style.setProperty('--f', soc / 100);
    f.querySelector('.et.car').style.setProperty('--f', carSoc / 100);
    $$('.ad .t1 line', f).forEach((l, i) => l.classList.toggle('on', i < Math.round(aut * .6)));
    for (const sm of $$('.sm', f)) flow(sm, flows[sm.dataset.fl], ok[sm.dataset.fl] && ok.home);
    for (const a of f._fl) still() || !f._vis ? a.pause() : a.play();   // Leistungsmodus kann zur Laufzeit wechseln (applyK)
    paint(f);
  }
  detail();
}

// ---------- Vollbild (Tipp auf Solar, Akku, e-Golf) ----------
// Aufbau wie Licht-/Klima-Vollbild (index.html #dimmer/#climate): Zeile „Lädt mit …“ (Grundlinie 33,9), Zahl 29 cqw (Grundlinie 60,2), Meta (65,8).
// Farben: Solar = Licht-Vorlage (Creme #fefaec, Gelb #f9c100); Akku/e-Golf dieselbe Rolle mit ihrer Akzentfarbe. Füllung = Wert (Akku/e-Golf von unten, Solar = Tageskurve),
// Text an der Füllkante geteilt (Innen-Layer wie #dimmer). Verlaufslinie Akku/e-Golf: Ladestand 0–24 Uhr bis jetzt, endet an der Füllkante.
const DET = {
  pv: { name: 'Solar', u: 'kW', bg: '#fefaec', fc: '#f9c100' },
  bat: { name: 'Akku', u: '%', bg: '#effaf1', fc: '#30d158' },
  car: { name: 'e-Golf', u: '%', bg: '#f7f0fc', fc: '#bf5af2' },
};
let dk = null;
const layer = u => `<svg class="eh" viewBox="0 0 100 100" preserveAspectRatio="none"><path/></svg><div class="mode" data-bind="ed_m"></div><div class="pct"><b class="num" data-bind="ed_v" data-digits></b><small>${u}</small></div><div class="meta" data-bind="ed_x"></div>`;
export function energyDetail(k) {
  const view = document.getElementById('edet'), d = DET[k];
  dk = k;
  view.className = `view ${k} ${k === 'pv' ? 'ecv' : 'elv'} ni`;
  view.style.setProperty('--bg', d.bg); view.style.setProperty('--fc', d.fc); view.style.setProperty('--f', 0);
  view.querySelector('.ed').innerHTML = `<div class="eb">${layer(d.u)}</div><div class="ew"><div class="ef"><div class="in">${layer(d.u)}</div></div></div>`;
  bd('edn', d.name);
  detail();
  // Füllung federt nach der Kachel-Expansion (≈ 170 ms) auf den Wert; Solar: Kurve wischt von links ein
  const go = () => { view.classList.remove('ni'); detail(); };
  if (still()) return go();
  view.style.setProperty('--f', 0); getComputedStyle(view).transform;
  setTimeout(go, 140);
  if (k === 'pv') {
    const o = { duration: 2000, delay: 140, easing: SPR(), fill: 'backwards' };
    view.querySelector('.ew').animate([{ transform: 'translateX(-112cqw)' }, { transform: 'none' }], o);
    view.querySelector('.ef').animate([{ transform: 'translateX(112cqw)' }, { transform: 'none' }], o);
  }
}
function detail() {
  const view = document.getElementById('edet');
  if (!dk || !view || view.hidden || !R || !V.ok) return;
  const { pv, bat, soc, car, carSoc, range, cap, ok } = V;
  if (dk === 'pv') {
    const s = H.pv.filter(p => p[0] >= day0()), peak = Math.max(0, ...s.map(p => p[1]));
    bd('ed_m', pv > 50 ? 'Erzeugt gerade' : 'Keine Erzeugung');
    rb('ed_v', kw(pv));
    bd('ed_x', s.length > 1 ? `Heute ${de(kwh(s))} kWh · Spitze ${kw(peak)} kW` : '');
    const p = pvPath(74);   // Fläche unter dem Text (Spitze bei 74 % Höhe), wie die Stundenkarte der Wetter-App unten (y-MO 08900)
    view.style.setProperty('--m', p ? `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${p.ar}"/></svg>`)}")` : 'none');
    return;
  }
  const v = dk === 'bat' ? soc : carSoc, w = dk === 'bat' ? -bat : car;   // w > 0 = lädt
  bd('ed_m', w > 50 ? `Lädt mit ${kw(w)} kW` : dk === 'bat' && w < -50 ? `Entlädt mit ${kw(w)} kW` : dk === 'bat' ? 'Bereit' : 'Lädt nicht');
  rb('ed_v', String(Math.round(v)));
  bd('ed_x', dk === 'bat' ? (cap ? `${de(cap * v / 100)} von ${de(cap)} kWh` : '') : ok.car && range ? `${Math.round(range)} km Reichweite` : '');
  if (!view.classList.contains('ni')) view.style.setProperty('--f', v / 100);
  const s = H[dk === 'bat' ? 'soc' : 'carSoc'], d0 = day0(), span = Math.max(1, Date.now() - d0);
  const pts = bins(s, d0, Date.now(), 9e5).map(([t, y]) => [100 * (t - d0) / span, 100 - y]);   // 15-min-Mittel, weich
  if (pts.length) pts.push([100, 100 - v]);
  const dPath = pts.length > 1 ? smooth(pts) : '';
  for (const p of $$('.eh path', view)) if (p.getAttribute('d') !== dPath) p.setAttribute('d', dPath);
}

// ---------- Demo ----------
// Oktobertag in Schwäbisch Gmünd: PV ~7:40–18:30, mittags ~4,3 kW mit durchziehenden Wolken, Grundlast + Wasserkocher/Kochen,
// Akku regelt auf Netz ≈ 0 (bis 2,5 kW, 10,24 kWh), e-Golf lädt bei Überschuss (35,8 kWh). Der Tag bis jetzt wird beim Start einmal durchgerechnet (Tageskurven).
const S = { soc: 52, socC: 41, last: 0, car: false };
function model(now, s, live = true) {
  const d = new Date(now), h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600, n = k => (Math.sin(now / k) + Math.sin(now / k / 2.7 + 1)) / 2;
  const sun = Math.max(0, Math.sin(Math.PI * (h - 7.65) / 10.9)) ** 1.25;
  const cloud = (.74 + .26 * Math.sin(now / 2.3e6 + 1)) * (1 - .18 * Math.max(0, Math.sin(now / 4.1e5)) ** 2) * (live ? 1 - .5 * Math.max(0, Math.sin(now / 2.6e4)) ** 3 : 1);   // langsame Bewölkung; live zusätzlich alle ~3 min eine Wolke (Verlauf geglättet, sonst Alias-Zacken)
  const pv = sun ? Math.max(0, 4300 * sun * cloud + 35 * n(7e3)) : 0;
  const home = 360 + 170 * n(5e4) + (Math.sin(now / 7e4) > .93 ? 1900 : 0) + (h > 18 && h < 19.4 ? 1300 : 0);
  if (s.socC >= 85 || pv - home < 900) s.car = false; else if (pv - home > 1700) s.car = true;   // Hysterese wie evcc „PV“
  const car = s.car ? Math.min(3700, Math.max(1400, pv - home - 150)) : 0;
  let bat = Math.max(-2500, Math.min(2500, home + car - pv));   // ponytail: eine Lade-/Entladegrenze von 2,5 kW, damit Bezug/Einspeisung in der Demo sichtbar werden
  if (bat > 0 && s.soc <= 10.5 || bat < 0 && s.soc >= 99.5) bat = 0;
  const dt = s.last ? (now - s.last) / 3.6e6 : 0;
  s.soc = Math.min(100, Math.max(10, s.soc - bat * dt / 102.4)); s.socC = Math.min(100, s.socC + car * dt / 358); s.last = now;
  return { pv, home, car, bat, grid: home + car - pv - bat + 25 * n(6e3) };
}
export function energyDemo(now = Date.now()) {
  if (!demo) {   // einmal: Tag ab Mitternacht in 2-min-Schritten, schreibt die History
    demo = true;
    for (let t = day0(); t < now; t += 12e4) { const m = model(t, S, false); H.pv.push([t, m.pv]); H.soc.push([t, S.soc]); H.carSoc.push([t, S.socC]); }
  }
  const m = model(now, S), W = { unit_of_measurement: 'W' }, P = { unit_of_measurement: '%' };
  return { [E.pv[0]]: [Math.round(m.pv), W], [E.grid[0]]: [Math.round(m.grid), W], [E.home[0]]: [Math.round(m.home), W],
    [E.bat[0]]: [Math.round(m.bat), W], [E.soc[0]]: [Math.round(S.soc), P], [E.cap[0]]: [10.24, { unit_of_measurement: 'kWh' }],
    [E.car[0]]: [Math.round(m.car), W], [E.carSoc[0]]: [Math.round(S.socC), P], [E.range[0]]: [Math.round(S.socC * 1.9), { unit_of_measurement: 'km' }] };
}

document.head.insertAdjacentHTML('beforeend', `<style>
/* eigener Stapelkontext: Fluss-Ebene (z 3) bleibt unter Vollbild-Ansichten (z 2) */
.f-energy{isolation:isolate}
/* Kacheln: Grundstil .tile (Glas, Radius 4,3, Press .96) aus index.html; hier nur Inhalt */
.et{overflow:hidden}
.et:not([data-act]):active{transform:none}
.et .num{font-variant-numeric:tabular-nums}
.et .nv{display:flex;align-items:baseline;gap:.5cqw;line-height:1}
.et .nv .num{font-size:10cqw}                               /* Thermostat 1×1 */
.et .nv small{font-size:3.4cqw;font-weight:600}
.et .ttl .i{font-size:2.9cqw;color:${C.pv};vertical-align:-.3cqw;margin-left:.4cqw}
/* 2×1 = Widget-Aufbau (Wetter-Widget): Titel oben links 5/4, Zahl darunter, Untertitel unten links */
.et.w{display:block;padding:0;text-align:left}
.et.w .lb{position:absolute;left:5cqw;top:4cqw;font-size:3.1cqw}
.et.w .nv{position:absolute;left:5cqw;top:9.6cqw}
.et.w .nv .num{font-size:13cqw}                             /* Thermostat 2×1 */
.et.w .nv small{font-size:4.2cqw}
.et.w .bl{position:absolute;left:5cqw;bottom:4.4cqw}
.et.w .tr{position:absolute;right:5cqw;top:4cqw;text-align:right;color:#ffffffb3}.light .et.w .tr{color:#0000008c}   /* wie „H:72° L:58°“ im Wetter-Widget: Weiß statt Ton, auf hellem Glasrand sonst unlesbar */
.et.w .cic{position:absolute;right:5cqw;top:50%;translate:0 -50%;font-size:9.5cqw}
/* Solarkurve 6–21 Uhr rechts neben der Zahl (wie ein Aktien-Widget), unten/rechts randlos; Fenster ragt 8 cqw rechts hinaus (weiche Wischkante liegt in Ruhe draußen) */
.et .cw{position:absolute;left:52%;right:-8cqw;top:34%;bottom:0;overflow:hidden;color:${C.pv};pointer-events:none;
  -webkit-mask:linear-gradient(90deg,#000 calc(100% - 8cqw),#0000);mask:linear-gradient(90deg,#000 calc(100% - 8cqw),#0000)}
.et .ci{position:absolute;left:0;top:0;bottom:0;right:8cqw}
.et .ci svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.et .ci .ln{fill:none;stroke:currentColor;stroke-width:.42cqw;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.et .nd{position:absolute;width:1.9cqw;height:1.9cqw;margin:-.95cqw;border-radius:50%;background:currentColor;box-shadow:0 0 0 .55cqw color-mix(in srgb,currentColor 30%,transparent)}
.light .et .cw{color:#e0a800}
/* Füllstand (Slider-Füllung, Kontrollzentrum/Licht): Fläche wie Kachel „an“, Text darin dunkel; Feder auf neue Werte (gestreckt = weicher) */
.et .ef{position:absolute;inset:0;z-index:1;overflow:hidden;border-radius:inherit;background:linear-gradient(#fffc,#ffffff99);color:var(--ink);pointer-events:none;
  transform:translateY(calc((1 - var(--f,0)) * 100%));transition:transform calc(var(--sd) * 2.2) var(--spring)}
.et .ef .in{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:5.3cqw 1cqw 4.9cqw;
  transform:translateY(calc((1 - var(--f,0)) * -100%));transition:transform calc(var(--sd) * 2.2) var(--spring)}
.et.w .ef{transform:translateX(calc((var(--f,0) - 1) * 100%))}
.et.w .ef .in{display:block;padding:0;transform:translateX(calc((1 - var(--f,0)) * 100%))}
.et .ef .sub{color:var(--ink2)}
.light .et .ef{background:#c6c2e3;color:#6a6393}.light .et .ef .sub{color:#9590b7}
/* Autarkie: Glasscheibe wie die Uhr-Kachel, Strichkranz wie der Timer (60 Striche), leuchtende Striche blenden gestaffelt */
.ad{position:relative;height:100%;aspect-ratio:1;justify-self:center;border-radius:50%;display:grid;place-items:center;box-shadow:inset 0 0 0 .13cqw #ffffff59,inset 0 .5cqw .8cqw #fff3,0 .6cqw 2cqw #0001}
.light .ad{box-shadow:none}
.ad svg{position:absolute;inset:0;width:100%;height:100%;stroke-width:2.3;stroke-linecap:round}
.ad .t0{stroke:currentColor;opacity:.2}
.ad .t1{stroke:currentColor}.ad .t1 line{opacity:0;transition:opacity .3s calc(var(--i) * 9ms)}.ad .t1 line.on{opacity:1}
.ad .ac{position:relative;display:grid;justify-items:center;gap:.7cqw}
.ad .nv{display:flex;align-items:baseline;gap:.3cqw;line-height:1}
.ad .num{font-size:8cqw;font-variant-numeric:tabular-nums}.ad small{font-size:3cqw;font-weight:600}
.ad .ac>span{font-size:2.7cqw;color:var(--tint)}
/* Fluss: zwei Lichtpunkte je Fuge (Kern weiß, Hof in Akzentfarbe), Enden weich ausgeblendet */
.efl{position:absolute;inset:0;z-index:3;pointer-events:none}
.sm{position:absolute;width:2.6cqw;height:10cqw;translate:-50% -50%;overflow:hidden;opacity:0;transition:opacity .45s ease;
  -webkit-mask:linear-gradient(#0000,#000 30%,#000 70%,#0000);mask:linear-gradient(#0000,#000 30%,#000 70%,#0000)}
.sm.on{opacity:1}
/* Komet je Periode (5 cqw): Kopf (Kern weiß, Hof Akzent) + kurzer Schweif dahinter */
.sm>i{position:absolute;left:0;right:0;top:-5cqw;height:15cqw;will-change:transform;
  background:radial-gradient(circle 1.25cqw at 50% 70%,#fff 0 .38cqw,var(--c) .62cqw,color-mix(in srgb,var(--c) 30%,transparent) .95cqw,transparent),
    radial-gradient(.32cqw 1.9cqw at 50% 42%,color-mix(in srgb,var(--c) 70%,transparent),transparent) 0 0/2.6cqw 5cqw repeat-y;
  background-size:2.6cqw 5cqw}
/* Vollbild (Maße von #climate/#dimmer übernommen) */
#edet{--ty:-86.35%;background:var(--bg);color:#111}
#edet .x{left:6cqw;top:5.8cqw;width:8.75cqw;height:8.75cqw;font-size:6.8cqw;background:#0000000f}
#edet .top{top:10.6cqw;translate:0 -50%;line-height:1;font-size:3.8cqw;font-weight:400;color:#1c1c1e}
#edet .top time{right:8.6cqw}
#edet :is(.ed,.eb,.ef,.in){position:absolute;inset:0}
#edet .ew{position:absolute;left:0;top:0;bottom:0;right:-12cqw;overflow:hidden}
#edet .ef{right:12cqw;overflow:hidden;background:var(--fc);color:var(--bg)}
#edet.ecv .ew{-webkit-mask:linear-gradient(90deg,#000 calc(100% - 12cqw),#0000);mask:linear-gradient(90deg,#000 calc(100% - 12cqw),#0000)}
#edet.ecv .ef{-webkit-mask:var(--m) 0 0/100% 100% no-repeat;mask:var(--m) 0 0/100% 100% no-repeat}
#edet.elv .ef{transform:translateY(calc((1 - var(--f,0)) * 100%));transition:transform calc(var(--sd) * 2.6) var(--spring)}
#edet.elv .in{transform:translateY(calc((1 - var(--f,0)) * -100%));transition:transform calc(var(--sd) * 2.6) var(--spring)}
#edet.ni :is(.ef,.in){transition:none}
#edet .mode{position:absolute;left:0;right:0;top:33.9cqw;translate:0 var(--ty);text-align:center;font-size:4.8cqw;line-height:1}
#edet .pct{position:absolute;left:50%;top:60.2cqw;translate:-50% var(--ty);font-size:29cqw;font-weight:500;line-height:1;letter-spacing:-.02em;white-space:nowrap}
#edet .num{display:inline-grid;font-variant-numeric:tabular-nums}
#edet small{display:inline-block;width:0;margin-left:.9cqw;font-size:14cqw;font-weight:400;letter-spacing:0;color:#0000006e}
#edet.pv small{font-size:9cqw}
#edet .ef small{color:color-mix(in srgb,var(--bg) 70%,transparent)}
#edet .meta{position:absolute;left:0;right:0;top:65.8cqw;text-align:center;font-size:4.55cqw;font-weight:500;line-height:1}
#edet .eh{position:absolute;inset:0;width:100%;height:100%}
#edet .eh path{fill:none;stroke:currentColor;stroke-opacity:.3;stroke-width:.5cqw;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
</style>`);
