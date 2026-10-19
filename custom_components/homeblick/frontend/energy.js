// Energie-Face (eigener Entwurf, nicht im Video; User will Solar, Netz, Akku, e-Golf + Digitaluhr oben rechts wie im Wetter-Face):
// Solar → Haus ← Netz, darunter Akku und e-Golf, mit fließenden Punkten.
// Werte kommen alle aus evcc (ein gemeinsamer Stand); Haus = evcc-Heimverbrauch.

// HA-Entities, per API geprüft 2026-10-19; Werte in W oder kW (Einheit wird gelesen). Netz: + = Bezug, − = Einspeisung; Akku: + = Entladen, − = Laden; e-Golf = evcc-Ladepunkt „garage“ (kW)
export const E = {
  pv: ['sensor.evcc_pv_power'],
  grid: ['sensor.evcc_grid_power'],
  home: ['sensor.evcc_home_power'],
  bat: ['sensor.evcc_battery_power'],
  soc: ['sensor.evcc_battery_soc'],
  car: ['sensor.evcc_garage_charge_power'],
  carSoc: ['sensor.evcc_garage_vehicle_soc'],
  range: ['sensor.evcc_garage_vehicle_range'],
};
// Knoten: Lage (cqw), Farbe, Name, Icon, Fluss-Pfad (läuft immer vom Knoten zum Haus)
const N = {
  pv: [17, 44, '#ffd60a', 'Solar', '<circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/><path d="M12 1.8v2.5M12 19.7v2.5M1.8 12h2.5M19.7 12h2.5M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7"/>', 'M25 44H37.5'],
  grid: [83, 44, '#64d2ff', 'Netz', '<path d="M8 22 11 3h2l3 19M9.6 12h4.8M6 6.5h12M8.7 17h6.6"/>', 'M75 44H62.5'],
  bat: [30, 78, '#30d158', 'Akku', '<rect x="6.5" y="4.5" width="11" height="17" rx="2.4"/><path d="M10 2.5h4M9.5 14.5l2.5-4v3h2.5l-2.5 4v-3z" stroke-width="1.4"/>', 'M34 70.3L44 55.6'],
  car: [70, 78, '#bf5af2', 'e-Golf', '<path d="M3.5 15.5v-3l2-5.2A2 2 0 0 1 7.4 6h9.2a2 2 0 0 1 1.9 1.3l2 5.2v3M3.5 15.5h17M3.5 15.5V18h2.6v-2.5M20.5 15.5V18h-2.6v-2.5M3.8 12.5h16.4"/><circle cx="7.3" cy="13.9" r=".4"/><circle cx="16.7" cy="13.9" r=".4"/>', 'M66 70.3L56 55.6'],
};
const kw = w => (w / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kW';

export function energyFace(el) {
  el.insertAdjacentHTML('beforeend', `<div class="eh"><b>Energie</b><span data-bind="e_aut"></span></div><time data-bind="time"></time>
<svg class="el" viewBox="0 0 100 100">${Object.entries(N).map(([k, [, , c, , , d]]) => `<path class="tr" d="${d}"/><path class="fl" data-fl="${k}" style="--c:${c}" d="${d}"/>`).join('')}</svg>
${Object.entries(N).map(([k, [x, y, c, name, ico]]) => `<div class="en ${k}" style="--x:${x}cqw;--y:${y}cqw;--c:${c}">${k === 'bat' || k === 'car' ? '<svg class="ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" pathLength="100"/></svg>' : ''}<svg class="i" viewBox="0 0 24 24">${ico}</svg></div>
<div class="lb ${k}" style="--x:${x}cqw;--y:${y}cqw"><b class="rv" data-bind="e_${k}"></b><span data-bind="e_${k}l">${name}</span></div>`).join('')}
<div class="en home" style="--x:50cqw;--y:44cqw"><b class="rv" data-bind="e_home"></b><span>kW Haus</span></div>`);
  // Punkte laufen per WAAPI; Geschwindigkeit = Leistung über playbackRate (weich, ohne Neustart)
  for (const p of el.querySelectorAll('.fl')) p._a = p.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -3.2 }], { duration: 1000, iterations: Infinity });
}

// Aus index.html bei jedem render()
export function energy(ents, rollBind) {
  const faces = document.querySelectorAll('.f-energy');
  if (!faces.length) return;
  const v = ids => ids.map(id => ents[id]).filter(s => s && !isNaN(parseFloat(s.state)))
    .reduce((a, s) => a + parseFloat(s.state) * (/^kW/i.test(s.attributes.unit_of_measurement) ? 1000 : 1), 0);
  const pv = v(E.pv), grid = v(E.grid), home = v(E.home), bat = v(E.bat), soc = v(E.soc), car = v(E.car), carSoc = v(E.carSoc), flow = { pv, grid, bat, car: -car };   // + = zum Haus
  rollBind('e_home', (home / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  rollBind('e_pv', kw(pv));
  rollBind('e_grid', kw(Math.abs(grid)));
  rollBind('e_bat', Math.round(soc) + ' % · ' + kw(Math.abs(bat)));
  rollBind('e_car', Math.round(carSoc) + ' % · ' + kw(car));
  const bind = (k, t) => { for (const e of document.querySelectorAll(`[data-bind=${k}]`)) if (e.textContent !== t) e.textContent = t; };
  bind('e_gridl', grid > 50 ? 'Bezug' : grid < -50 ? 'Einspeisung' : 'Netz');
  bind('e_batl', bat < -50 ? 'Akku lädt' : bat > 50 ? 'Akku entlädt' : 'Akku');
  bind('e_carl', car > 50 ? 'e-Golf lädt' : v(E.range) ? `e-Golf · ${Math.round(v(E.range))} km` : 'e-Golf');
  bind('e_aut', home > 0 ? `${Math.round(100 * (1 - Math.min(1, Math.max(0, grid) / home)))} % autark` : '');
  for (const f of faces) for (const p of f.querySelectorAll('.fl')) {
    f.querySelector('.en.bat').style.setProperty('--soc', soc); f.querySelector('.en.car').style.setProperty('--soc', carSoc);
    const w = flow[p.dataset.fl], on = Math.abs(w) > 50, dir = w < 0 ? 'reverse' : 'normal';
    p.classList.toggle('on', on); f.querySelector('.en.' + p.dataset.fl).classList.toggle('idle', !on);
    if (!on) continue;
    if (p._a.effect.getTiming().direction !== dir) p._a.effect.updateTiming({ direction: dir });
    const r = Math.round(Math.min(3, .5 + Math.abs(w) / 1500) * 20) / 20;   // ponytail: lineare Skala bis ~4 kW, danach gedeckelt
    if (p._r !== r) p._a.updatePlaybackRate(p._r = r);
  }
}

// Demo: Tageskurve Oktober (PV ~7:30–18:30, mittags ~4 kW), Grundlast + gelegentlich Wasserkocher,
// Akku regelt auf Netz ≈ 0 (wie pv_backup, 2 × 2,5 kW, 2 × 5,12 kWh), Rest übers Netz
let soc = 64, socC = 58, last = 0;
export function energyDemo(now = Date.now()) {
  const d = new Date(now), h = d.getHours() + d.getMinutes() / 60, n = k => (Math.sin(now / k) + Math.sin(now / k / 2.7 + 1)) / 2;
  const pv = Math.max(0, 4200 * Math.sin(Math.PI * (h - 7.5) / 11) * (.85 + .15 * n(9e4)));
  const home = 520 + 220 * n(4e4) + (Math.sin(now / 9e4) > .96 ? 1900 : 0), W = { unit_of_measurement: 'W' };
  const car = socC < 80 && pv - home > 1400 ? Math.min(3700, pv - home) : 0, dt = last ? (now - last) / 3.6e6 : 0, P = { unit_of_measurement: '%' };
  let bat = Math.max(-5000, Math.min(5000, home + car - pv));
  if (bat > 0 && soc <= 11 || bat < 0 && soc >= 100) bat = 0;
  soc = Math.min(100, Math.max(10, soc - bat * dt / 102.4)); socC = Math.min(100, socC + car * dt / 358); last = now;   // e-Golf ~35,8 kWh
  return { [E.pv[0]]: [Math.round(pv), W], [E.grid[0]]: [Math.round(home + car - pv - bat + 30 * n(7e3)), W], [E.home[0]]: [Math.round(home), W],
    [E.bat[0]]: [Math.round(bat), W], [E.soc[0]]: [Math.round(soc), P], [E.car[0]]: [Math.round(car), W], [E.carSoc[0]]: [Math.round(socC), P], [E.range[0]]: [Math.round(socC * 1.5), { unit_of_measurement: 'km' }] };
}

document.head.insertAdjacentHTML('beforeend', `<style>
.f-energy{color:#fff}
.f-energy .eh{position:absolute;left:8cqmin;top:7.6cqmin;display:grid;gap:.6cqw;line-height:1.27}
.f-energy .eh b{font-size:4.5cqmin;font-weight:500}
.f-energy .eh span{font-size:3cqw;color:#ffffffa6}
.f-energy>time{position:absolute;right:8.3cqmin;top:6.8cqmin;font-size:7.95cqmin;font-weight:600;line-height:1}
.f-energy.light{color:#000}.f-energy.light .eh span{color:#0000008c}
.f-energy .el{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.el .tr{stroke:currentColor;stroke-opacity:.14;stroke-width:.5;stroke-linecap:round}
.el .fl{stroke:var(--c);stroke-width:1.3;stroke-linecap:round;stroke-dasharray:0 3.2;opacity:0;transition:opacity .6s;filter:drop-shadow(0 0 .5px var(--c))}
.el .fl.on{opacity:1}
.f-energy .en{position:absolute;left:var(--x);top:var(--y);translate:-50% -50%;width:16cqw;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;
  background:color-mix(in srgb,currentColor 9%,transparent);box-shadow:inset 0 0 0 .2cqw color-mix(in srgb,currentColor 10%,transparent)}
.f-energy .en>.i{color:var(--c);font-size:6.6cqw;transition:color .6s,opacity .6s}.f-energy .en.idle>.i{color:currentColor;opacity:.4}
.en:is(.bat,.car) .ring{position:absolute;inset:0;width:100%;height:100%;rotate:-90deg;fill:none;stroke:var(--c);stroke-width:3.2;stroke-linecap:round;
  stroke-dasharray:var(--soc,0) 100;transition:stroke-dasharray var(--sd) var(--spring)}
.f-energy .home{width:25cqw;align-content:center;gap:.4cqw}
.home b{font-size:8.6cqw;font-weight:600;letter-spacing:-.02em;line-height:1}
.home>span{font-size:2.8cqw;color:#ffffffa6}.f-energy.light .home>span{color:#0000008c}
.f-energy .rv{display:inline-grid;justify-items:inherit}.f-energy .rv>span{grid-area:1/1}
.f-energy .lb{position:absolute;display:grid;gap:.3cqw;white-space:nowrap;left:var(--x);top:calc(var(--y) + 9.6cqw);translate:-50% 0;text-align:center;justify-items:center}
.lb b{font-size:3.4cqw;font-weight:600}
.lb>span{font-size:2.7cqw;color:#ffffffa6}.f-energy.light .lb>span{color:#0000008c}
@media (prefers-reduced-motion:reduce){.el .fl{stroke-dasharray:none}}
</style>`);
