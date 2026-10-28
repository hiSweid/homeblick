// Wetter-Face (Video t ≈ 8,6 s) + -Himmel für alle 15 HA-Wetterzustände × Tag/Dämmerung/Nacht.
// Wolken, Regen, Schnee, Hagel, Sterne werden einmal per Canvas gerastert und nur per transform/opacity bewegt (Compositor).

const Q = new URLSearchParams(location.search), DEMO = !Q.has('live');

export const COND = { 'clear-night': 'Klar', cloudy: 'Bewölkt', exceptional: 'Unwetter', fog: 'Nebel', hail: 'Hagel', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter', partlycloudy: 'Teilweise bewölkt', pouring: 'Starkregen', rainy: 'Regen', snowy: 'Schnee', 'snowy-rainy': 'Schneeregen', sunny: 'Sonnig', windy: 'Windig', 'windy-variant': 'Windig, bewölkt' };

// ---------- Paletten: Himmel oben/Mitte/unten, Wolken Licht/Schatten ----------
const SKY = {
  clear: { day: ['#1a5bb4', '#3a80d2', '#74b2ec'], dusk: ['#1d3a7a', '#3b4f96 24%', '#7a68a8 46%', '#c47c9a 66%', '#e88a5e 88%', '#ee9a64'], night: ['#030918', '#0a1834', '#1a325e'] },
  partly: { day: ['#2a5b9b', '#3268a8', '#5a90d0'], dusk: ['#26407a', '#46558f 26%', '#7d6b9e 50%', '#bd7f94 70%', '#e0906a 90%', '#e89c6e'], night: ['#08101f', '#111e38', '#22375a'] },
  cloudy: { day: ['#56697f', '#6e8096', '#8595a8'], dusk: ['#4c5470', '#837889', '#b69384'], night: ['#10151d', '#1b222d', '#2b3440'] },
  rain: { day: ['#3c4a5c', '#526276', '#78889b'], dusk: ['#383e52', '#5a5868', '#837680'], night: ['#0b1017', '#141b25', '#222b37'] },
  storm: { day: ['#1c222c', '#2e3644', '#4a5464'], dusk: ['#211f2b', '#3a3443', '#5d4f57'], night: ['#06080c', '#0d1117', '#191f28'] },
  snow: { day: ['#5f7089', '#7a8ba2', '#8a9bb0'], dusk: ['#666c88', '#a196a8', '#b09698'], night: ['#19202e', '#273144', '#3b475e'] },
  fog: { day: ['#6c7782', '#7f8993', '#8e979f'], dusk: ['#6c6a77', '#857c83', '#9a8b88'], night: ['#1b2027', '#293038', '#3a414a'] },
  dust: { day: ['#6b5138', '#8a6a48', '#a7855c'], dusk: ['#5a3e30', '#7a5440', '#946650'], night: ['#160e0a', '#2a190f', '#432719'] },
};
const CLOUD = { white: ['#dce7fa', '#6f8fbd'], grey: ['#cfd6df', '#6f7c8c'], dark: ['#a7b0bc', '#434e5d'], storm: ['#79838f', '#1d242e'], fog: ['#e2e6ea', '#a9b2bc'], dust: ['#d8bb92', '#86664a'], lit: ['#dfe6ff', '#56628a'] };
const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (hex(b)[i] - v) * t);
function cloudPal(name, tod) {
  let [l, s] = CLOUD[name].map(hex);
  if (tod === 'night') { l = mix(l, '#27354d', .7); s = mix(s, '#070b14', .7); }
  if (tod === 'dusk') return [mix(l, '#ffc49c', name === 'storm' || name === 'dark' ? .15 : .42), mix(s, '#4b3d62', .45), .5];   // Sonne tief links unten
  return [l, s];
}

// ---------- Szenen ----------
// Wolkenschicht: Seed, Perioden je Breite (ganzzahlig → nahtlos), Bedeckung 0–1, Band oben/unten (0–1 der Höhe),
// Höhe + Oberkante in cqw, Sekunden je Bildbreite, Deckkraft, Eigenschatten
const cl = (s, k, c, y0, y1, h, t, d, o = 1, ab = .6, soft = 1.4, ay = 1) => ({ s, k, c, y0, y1, h, t, d, o, ab, soft, ay });
// Niederschlag: Dichte je 100×100 cqw, Länge bzw. Radius (cqw), Strichbreite (cqw), Deckkraft, Kachelhöhe (cqw), Fallgeschwindigkeit (cqw/s).
// Kacheln sind 120 cqw breit (keine Wiederholung nebeneinander), Höhen/Tempo je Ebene verschieden (kein gemeinsamer Takt).
const rn = (n, len, w, a, h, v) => ({ n, len, w, a, h, v, tw: 120 });
const sn = (n, r0, r1, a, h, v, soft = .5, tw = 120) => ({ n, r0, r1, a, h, v, soft, tw });
const SCENES = {
  sunny: { sky: 'clear', sun: 1, cloud: 'white', clouds: [cl(21, 2, .2, 0, .45, 40, -4, 260, .7)] },
  'clear-night': { sky: 'clear', stars: 1 },
  partlycloudy: { sky: 'partly', sun: 1, stars: 1, cloud: 'white', clouds: [cl(3, 2, .8, 0, 1, 76, -6, 170, .85, .6, 1.3), cl(7, 1, .66, 0, 1, 68, -8, 120, .9, .6, 1.2)] },
  cloudy: { sky: 'cloudy', cloud: 'grey', clouds: [cl(5, 2, .9, 0, 1.35, 104, -4, 220, 1, .7, 1.6), cl(9, 2, .7, 0, .9, 66, -6, 140, .9), cl(13, 3, .55, .1, .95, 56, 30, 90, .85)] },
  fog: { sky: 'fog', cloud: 'grey', clouds: [cl(2, 2, .6, 0, .9, 50, -6, 260, .7, .6, 2, 2.5)], fog: 1 },
  rainy: { sky: 'rain', cloud: 'dark', clouds: [cl(4, 2, .85, 0, 1, 70, -4, 200), cl(8, 1, .6, 0, .85, 55, -6, 120)],
    rain: [rn(200, 4.5, .11, .38, 90, 170), rn(55, 8, .17, .6, 105, 260)] },
  pouring: { sky: 'rain', cloud: 'dark', clouds: [cl(4, 2, .95, 0, 1, 80, -4, 160), cl(8, 1, .7, 0, .9, 60, -6, 90)], haze: 1,
    rain: [rn(300, 3.5, .1, .3, 85, 170), rn(130, 6, .14, .42, 100, 220), rn(40, 10, .2, .55, 115, 280)] },
  lightning: { sky: 'storm', cloud: 'storm', clouds: [cl(6, 2, .95, 0, 1.35, 104, -4, 150, 1, .8, 1.6), cl(10, 2, .7, 0, .9, 62, -6, 85)], bolt: 1 },
  'lightning-rainy': { sky: 'storm', cloud: 'storm', clouds: [cl(6, 2, .95, 0, 1.35, 104, -4, 150, 1, .8, 1.6), cl(10, 2, .7, 0, .9, 62, -6, 85)], bolt: 1,
    rain: [rn(220, 4, .11, .32, 90, 170), rn(70, 7.5, .18, .5, 105, 240)] },
  hail: { sky: 'rain', cloud: 'dark', clouds: [cl(12, 2, .9, 0, 1, 75, -4, 170), cl(14, 1, .65, 0, .85, 58, -6, 100)],
    // Hagel = kurze, dicke, helle Striche (Eiskorn mit Bewegungsunschärfe), drei Tiefen
    rain: [rn(70, 3, .1, .25, 90, 150)], hail: [rn(110, 1.8, .3, .6, 70, 95), rn(60, 2.5, .45, .9, 85, 130), rn(22, 3.2, .65, 1, 100, 170)] },
  snowy: { sky: 'snow', cloud: 'grey', clouds: [cl(15, 2, .8, 0, 1, 70, -4, 240), cl(17, 1, .55, 0, .8, 52, -6, 150)],
    snow: [sn(250, .25, .5, .7, 70, 8), sn(90, .45, .8, .85, 85, 12), sn(20, .9, 1.5, .55, 100, 18, .9)] },
  'snowy-rainy': { sky: 'cloudy', cloud: 'dark', clouds: [cl(16, 2, .85, 0, 1, 72, -4, 200), cl(18, 1, .6, 0, .85, 55, -6, 120)],
    rain: [rn(110, 4.5, .12, .4, 90, 150)], snow: [sn(110, .3, .6, .8, 75, 14), sn(30, .5, .9, .85, 95, 20)] },
  windy: { sky: 'clear', sun: 1, cloud: 'white', clouds: [cl(19, 2, .4, 0, .65, 58, -6, 26, .9)], gust: 1 },
  'windy-variant': { sky: 'cloudy', cloud: 'grey', clouds: [cl(25, 2, .85, 0, 1.25, 104, -4, 60, 1, .6, 1.4, 1.6), cl(27, 2, .65, 0, .9, 62, -6, 34, .9, .6, 1.4, 1.8), cl(29, 3, .5, .1, .95, 50, 26, 22, .85, .6, 1.4, 2)], gust: 1 },
  exceptional: { sky: 'dust', cloud: 'dust', clouds: [cl(31, 2, .9, 0, 1.35, 104, -4, 70, .9, .3, 2.4, 3), cl(33, 3, .7, 0, 1.2, 104, -4, 40, .7, .3, 2.6, 4)], fog: 1, gust: 1 },
};

// ---------- Texturen ----------
const rng = a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// Texturen entstehen im Worker (weather-tex.js); ohne OffscreenCanvas oder unter file:// (Tests) im Hauptthread
const cache = new Map(), pend = new Map(), OFF = typeof OffscreenCanvas !== 'undefined' && location.protocol !== 'file:';
let worker = OFF && new Worker(new URL('./weather-tex.js', import.meta.url), { type: 'module' });
// Hauptthread-Pfad (auch Rückfall, wenn der Worker nicht lädt/abstürzt)
const draw = ({ kind, w, h, args }) => import('./weather-tex.js').then(({ DRAW }) => new Promise(res => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h; DRAW[kind](c.getContext('2d'), w, h, ...args);
  c.toBlob(b => res(`url(${URL.createObjectURL(b)})`));
}));
if (worker) {
  worker.onmessage = ({ data }) => { const q = pend.get(data.id); data.err ? q.shift().rej(new Error(data.err)) : q.shift()(`url(${URL.createObjectURL(data.blob)})`); if (!q.length) pend.delete(data.id); };   // je Anfrage ein Resolver (gleicher Key kann nach cache.clear() doppelt laufen)
  // Worker tot (Ladefehler, CSP, Absturz): offene Jobs im Hauptthread nachholen, neue gehen direkt dorthin
  worker.onerror = e => {
    console.warn('weather-tex Worker, Rückfall auf Hauptthread:', e.message); worker.terminate(); worker = null;
    for (const q of pend.values()) for (const r of q) r(draw(r.m));
    pend.clear();
  };
}
function tex(kind, w, h, ...args) {
  const key = `${kind}${w}x${h}${JSON.stringify(args)}`, m = { id: key, kind, w, h, args };
  if (!cache.has(key)) cache.set(key, (worker ? new Promise((res, rej) => { res.m = m; res.rej = rej; pend.set(key, [...pend.get(key) || [], res]); worker.postMessage(m); }) : draw(m))
    // scheitert auch das: Ebene bleibt leer (statt Szene komplett zu verwerfen), nicht gecacht → nächster Aufbau versucht es erneut
    .catch(e => { cache.delete(key); console.warn('weather-tex', e.message || e); return 'none'; }));
  return cache.get(key);
}
const cloudTex = (o, pal, px) => { const W = Math.min(1024, Math.round(px * 100)); return tex('cloud', W, Math.round(W * o.h / 100), o, pal); };
// Kachelgröße in Pixeln: Display-Auflösung, längste Seite max. 1600 px; Striche dürfen etwas weicher sein (Bewegungsunschärfe)
const tile = (o, px, k = 1) => { const p = Math.min(px * k, 20, 1600 / Math.max(o.tw, o.h)); return [Math.round(o.tw * p), Math.round(o.h * p)]; };
const rainTex = (o, px) => tex('rain', ...tile(o, px, .75), o);
const dotTex = (o, px, seed) => tex('dot', ...tile(o, px), o, seed);

// ---------- Szene aufbauen ----------
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// Schwelle nötig: Nachbar-Faces berühren den Scrollport nur an der Kante und zählen ohne sie als sichtbar
const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('off', !e.isIntersecting)), { threshold: .01 });
// deutlich größer geworden (Drehen, Vollbild) → Texturen neu in passender Auflösung
const ro = new ResizeObserver(es => {
  if (!last.length || !es.some(({ target: s }) => Math.max(s.clientWidth, s.clientHeight) > (s._b || 0) * 1.4)) return;
  // alte Auflösung einmal für alle Faces freigeben (nicht je Face, sonst sterben frische URLs), sobald die neue Szene eingeblendet ist
  for (const p of cache.values()) p.then(u => setTimeout(() => URL.revokeObjectURL(u.slice(4, -1)), 5e3));
  cache.clear(); for (const s of $$('.wsky')) s.dataset.k = '';
  weather(...last);
});
let uid = 0;
async function build(sky, cond, tod, wind, key) {
  // Himmel liegt in einer quadratischen Box über die längere Seite → jedes Seitenverhältnis, Texturen in Display-Auflösung
  const bw = sky._b = Math.max(sky.clientWidth, sky.clientHeight), px = bw * devicePixelRatio / 100 || 10;
  const S = SCENES[cond] || SCENES.cloudy, r = rng(key.length * 31 + 7);
  const c = document.createElement('div'), G = SKY[S.sky][tod], h = [];
  c.className = 'wsc';
  c.style.background = `linear-gradient(${G.length > 3 ? G : [G[0], G[1] + ' 55%', G[2]]})`;
  sky.style.background = c.style.background;   // Himmelsfarbe sofort, Texturen folgen (kein hellblauer Kaltstart)
  const lay = (cls, style, inner = '') => `<i class="${cls}" style="${style}">${inner}</i>`;
  if (S.sun && tod !== 'night') h.push(tod === 'dusk' ? lay('wsun dusk', '--x:18cqw;--y:104cqw') : lay('wsun', '--x:26cqw;--y:-8cqw'));
  if (S.stars && tod === 'night') {
    // 4 Ebenen, Kachelgrößen und Perioden teilerfremd → kein sichtbares Raster, kein gemeinsames Atmen
    const ST = [[130, .05, .16, 59, 3.7], [90, .06, .2, 41, 5.3], [60, .07, .24, 53, 4.4], [30, .09, .28, 67, 6.1]];
    (await Promise.all(ST.map(([n, a, b, t], i) => dotTex(sn(n, a, b, 1, t, 0, .6, t), px, i + 1))))
      .forEach((u, i) => h.push(lay('wst', `--img:${u};--t:${ST[i][3]}cqw;--d:${ST[i][4]}s;--dl:-${(r() * 5).toFixed(1)}s`)));
    for (let i = 0; i < 6; i++) h.push(lay('wbs', `left:${8 + r() * 84}cqw;top:${4 + r() * 46}cqw;--d:${2 + r() * 3}s;--dl:-${r() * 4}s`));
  }
  const pal = cloudPal(S.cloud || 'white', tod), cls = await Promise.all((S.clouds || []).map(o => cloudTex(o, pal, px))), lit = S.bolt && await cloudTex(S.clouds[0], cloudPal('lit', tod === 'night' ? 'day' : tod), px);
  cls.forEach((u, i) => {
    const o = S.clouds[i];
    if (i === cls.length - 1 && S.sun && tod === 'day') h.push(lay('wsun hi', '--x:26cqw;--y:-8cqw'));
    const st = `top:${o.t}cqw;height:${o.h}cqw;--d:${o.d}s;--dl:-${(r() * o.d).toFixed(1)}s`;
    if (i === 0 && S.bolt) h.push(lay('wfl', '--x:50%'));
    h.push(lay('wcl', `${st};opacity:${o.o};--img:${u}`));
    if (i === 0 && S.bolt) h.push(lay('wcl wlit', `${st};--img:${lit}`));
    if (i === 0 && S.bolt) h.push(`<svg class="wbo" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><filter id="wbg${++uid}" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter></defs><path class="g" filter="url(#wbg${uid})"/><path class="b"/><path class="m"/></svg>`);
  });
  if (S.fog) {
    const fp = cloudPal(S.cloud === 'dust' ? 'dust' : 'fog', tod), fo = [cl(41, 2, .7, .15, 1.15, 100, 0, 300, .5, .1, 3, 3.5), cl(43, 3, .6, .3, 1.2, 100, 0, 190, .45, .1, 3, 4)];
    (await Promise.all(fo.map(o => cloudTex(o, fp, px)))).forEach((u, i) =>
      h.push(lay(`wcl${i ? ' rev' : ''}`, `top:0;height:100cqw;opacity:${fo[i].o};--img:${u};--d:${fo[i].d}s;--dl:-${(r() * 100).toFixed(1)}s`)));
  }
  if (S.fog || S.haze) h.push(lay('whz', ''));
  const pre = [], fall = (u, o) => `--img:${u};--s:${o.h}cqw;--w:${o.tw}cqw;--d:${(o.h / o.v).toFixed(3)}s;--dl:-${(r() * o.h / o.v).toFixed(3)}s;background-position-x:${(r() * o.tw).toFixed(1)}cqw`;
  // Dünne Vorderebenen (große Körner/Flocken) als Einzelteilchen mit eigenem Tempo → Muster wiederholt sich nie
  const pts = (o, snow) => Array.from({ length: Math.round(o.n * 1.9) }, () => {
    const d = snow && 2 * (o.r0 + (o.r1 - o.r0) * r() ** 2), T = 150 / (o.v * (.85 + .3 * r()));
    return lay(snow ? 'wpt sn' : 'wpt', `left:${(r() * 138).toFixed(1)}cqw;width:${(d || o.w).toFixed(2)}cqw;height:${(d || o.len * (.55 + .45 * r())).toFixed(2)}cqw;--o:${(o.a * (.5 + .5 * r())).toFixed(2)};--k:${100 - (o.soft || 0) * 100}%;animation-duration:${T.toFixed(2)}s,${(3 + r() * 2).toFixed(1)}s;animation-delay:-${(r() * T).toFixed(2)}s,-${(r() * 4).toFixed(1)}s`);
  }).join('');
  for (const o of [...S.rain || [], ...S.hail || []]) pre.push(o.n > 30 ? rainTex(o, px).then(u => lay('wpr', fall(u, o))) : pts(o));
  const sno = (S.snow || []).map((o, i) => o.n > 30 ? dotTex(o, px, 9).then(u => lay('wsw', `--sx:${(.6 + i * 1.4).toFixed(1)}cqw;--d:${(2.6 + i * 1.3 + r()).toFixed(1)}s;--dl:-${(r() * 4).toFixed(1)}s`, lay('wpr', fall(u, o)))) : pts(o, 1));
  // Regen fällt schräg, mit Wind schräger; Schnee fällt langsamer und wird deshalb stärker verweht
  const tilt = async (a, l) => l.length && h.push(lay('wtilt', `--a:${a.toFixed(1)}deg`, (await Promise.all(l)).join('')));
  await tilt(Math.min(22, 5 + (wind || 0) * .5), pre);
  await tilt(Math.min(30, 6 + (wind || 0) * 1.2), sno);
  // Böen: weiche Strähnenbündel (2–3 Linien, vorab geblurrt) in den freien Bändern über/unter der Temperatur
  if (S.gust) for (let i = 0; i < 4; i++) {
    const id = 'wg' + ++uid, y = [.5, 57, 3, 62][i] + r() * 3, L = 40 + r() * 35, n = 2 + (r() < .5);
    let p = '';
    for (let k = 0; k < n; k++) { const o = k * 2.6, a = 2 + r() * 3; p += `M${(k * 9).toFixed(0)} ${(5 + o).toFixed(1)}c${(25 - k * 4).toFixed(0)} ${-a} ${(55 - k * 6).toFixed(0)} ${a} ${(110 - k * 18).toFixed(0)} ${(-a * .4).toFixed(1)}`; }
    h.push(lay('wgu', `top:${y.toFixed(1)}cqw;width:${L.toFixed(0)}cqw;--d:${(6 + r() * 3).toFixed(1)}s;--dl:-${(r() * 8).toFixed(1)}s`,
      `<svg viewBox="0 0 120 14" preserveAspectRatio="none"><defs><linearGradient id="${id}"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="${id}f" x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation=".35"/></filter></defs><path d="${p}" stroke="url(#${id})" filter="url(#${id}f)"/></svg>`));
  }
  if (sky.dataset.k !== key) return;   // inzwischen anderes Wetter
  c.innerHTML = `<div class="wbox">${h.join('')}</div>`;
  sky.append(c);
  const old = [...sky.children].slice(0, -1);
  if (old.length) c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease-in-out' }).onfinish = () => old.forEach(o => o.remove());
  if (S.bolt) storm(sky, c);
}
// Blitz: zufälliger Zickzack mit Ästen, Himmel leuchtet kurz auf
function jag(r, ax, ay, bx, by, s, lv) {   // Mittelpunkt-Verschiebung → fraktaler Zickzack
  let p = [[ax, ay], [bx, by]];
  for (; lv--; s *= .58) p = p.flatMap((q, i) => i ? [[(p[i - 1][0] + q[0]) / 2 + (r() - .5) * s, (p[i - 1][1] + q[1]) / 2 + (r() - .5) * s * .35], q] : [q]);
  return p;
}
const pd = p => 'M' + p.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L');
function boltPath(r) {
  const x0 = 30 + r() * 40, main = jag(r, x0, -4, x0 + (r() - .5) * 24, 45 + r() * 23, 24, 6);
  let br = '';
  for (let k = 0, n = 2 + (r() * 3 | 0); k < n; k++) {
    const [sx, sy] = main[4 + (r() * main.length * .6 | 0)], dir = r() < .5 ? -1 : 1, L = 8 + r() * 16;
    br += pd(jag(r, sx, sy, sx + dir * L * (.5 + r() * .5), sy + L, L * .5, 4));
  }
  return [pd(main), br, x0.toFixed(0)];
}
function storm(sky, c) {
  const r = Math.random, bo = c.querySelector('.wbo'), fl = c.querySelector('.wfl'), li = c.querySelector('.wlit');
  const strike = () => {
    if (!c.isConnected) return;
    if (!document.hidden && !sky.classList.contains('off') && !reduced.matches && !document.documentElement.classList.contains('perf')) {
      const [m, b, x] = boltPath(r), [g, br, mn] = bo.querySelectorAll('path');
      g.setAttribute('d', m + b); br.setAttribute('d', b); mn.setAttribute('d', m);
      fl.style.setProperty('--x', x + '%');
      // Rückschläge: 3 kurze Pulse in ~160 ms, dann Nachglühen (lineare Segmente, nur das letzte weich)
      // s staucht die Pulse der längeren Wolken-/Schein-Animation auf den Takt des Blitzes (420/700)
      const k = (p, s = 1) => [{ opacity: 0 }, { opacity: p, offset: .03 * s }, { opacity: p * .2, offset: .1 * s }, { opacity: p, offset: .16 * s }, { opacity: p * .4, offset: .28 * s }, { opacity: p * .8, offset: .34 * s, easing: 'cubic-bezier(.2,.6,.3,1)' }, { opacity: 0 }];
      bo.animate(k(1), 420); li.animate(k(.9, .6), 700); fl.animate(k(.55, .6), 700);
    }
    setTimeout(strike, 2500 + r() * 7000);
  };
  setTimeout(strike, 800 + r() * 2000);
}

// ---------- Icons (SF-Symbols-Ersatz, eigene Zeichnung) ----------
const CL = (x = 0, y = 0, s = 1, sy = s) => `<g transform="translate(${x} ${y}) scale(${s} ${sy})"><circle cx="11" cy="10.5" r="5.4"/><circle cx="16.6" cy="13.6" r="4"/><circle cx="6" cy="14" r="3.6"/><rect x="6" y="13" width="10.6" height="4.6"/></g>`;
const RAYS = (cx, cy, r0, r1, n = 8, a0 = 0, skip = []) => Array.from({ length: n }, (_, i) => i).filter(i => !skip.includes(i)).map(i => {
  const a = a0 + i * 2 * Math.PI / n, c = Math.cos(a), s = Math.sin(a);
  return `M${(cx + c * r0).toFixed(2)} ${(cy + s * r0).toFixed(2)}L${(cx + c * r1).toFixed(2)} ${(cy + s * r1).toFixed(2)}`;
}).join('');
const SUN = (cx, cy, r, skip, w = 1.9, g = 2, l = 4.2) => `<g class="s"><circle cx="${cx}" cy="${cy}" r="${r}"/><path d="${RAYS(cx, cy, r + g, r + l, 8, 0, skip)}" fill="none" stroke-width="${w}" stroke-linecap="round"/></g>`;   // .s: in der Stundenleiste gelb
const MOON = (cx, cy, r) => { const id = 'wm' + ++uid; return `<mask id="${id}"><rect x="-9" y="-9" width="50" height="50" fill="#fff"/><circle cx="${cx + r * .62}" cy="${cy - r * .5}" r="${r * .86}" fill="#000"/></mask><circle cx="${cx}" cy="${cy}" r="${r}" mask="url(#${id})"/>`; };
// vorderes Motiv schneidet eine schmale Lücke ins hintere (wie bei SF Symbols)
const behind = (back, front) => { const id = 'wm' + ++uid; return `<mask id="${id}"><rect x="-9" y="-9" width="50" height="50" fill="#fff"/><g fill="#000" stroke="#000" stroke-width="3" stroke-linejoin="round">${front}</g></mask><g mask="url(#${id})">${back}</g>${front}`; };
const UP = CL(1.5, -3.6, 1);
const lines = (d, w = 1.9) => `<path d="${d}" fill="none" stroke-width="${w}" stroke-linecap="round"/>`;
const BOLT = '<path d="M14.6 12.5 10.4 18.6h3.4l-1.6 5 5.2-7h-3.5l2-4.1z"/>';
const ICON = {
  sunny: (n, h) => h ? SUN(14, 9, 4.3, [], 1.1, 2.7, 4.2) : SUN(14, 12, 4.6),   // h: Stundenleiste (feiner, 3 Einheiten höher)
  'clear-night': () => MOON(12.5, 13, 8) + '<path d="M22 3.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7zM25 9.5l.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z"/>',
  partlycloudy: n => behind(n ? MOON(19, 8, 5) : SUN(18.5, 8.5, 3.6, [2]), CL(-.2, 1.3, .9, .83)),
  cloudy: () => behind(CL(6, -3.6, .72, .66), CL(.3, 1.6, .9, .83)),
  fog: () => UP + lines('M4 18.8h17M7.5 22.3h14'),
  rainy: () => UP + lines('M8 17.5l-1.2 3.4M13 17.5l-1.2 3.4M18 17.5l-1.2 3.4'),
  pouring: () => UP + lines('M6.6 17.3l-2 5.4M11.2 17.3l-2 5.4M15.8 17.3l-2 5.4M20.4 17.3l-2 5.4', 1.7),
  snowy: () => UP + '<circle cx="7.5" cy="18.6" r="1.25"/><circle cx="12.5" cy="18.6" r="1.25"/><circle cx="17.5" cy="18.6" r="1.25"/><circle cx="10" cy="22.4" r="1.25"/><circle cx="15" cy="22.4" r="1.25"/>',
  'snowy-rainy': () => UP + lines('M8 17.5l-1.2 3.4M16 17.5l-1.2 3.4') + '<circle cx="12" cy="19.4" r="1.3"/><circle cx="19.3" cy="22.2" r="1.3"/><circle cx="11" cy="23" r="1.3"/>',
  hail: () => UP + '<circle cx="7.6" cy="19" r="1.7"/><circle cx="13" cy="19" r="1.7"/><circle cx="18.4" cy="19" r="1.7"/><circle cx="10.3" cy="22.9" r="1.4"/><circle cx="15.7" cy="22.9" r="1.4"/>',
  lightning: () => behind(UP, BOLT),
  'lightning-rainy': () => behind(UP, BOLT) + lines('M8.4 17.5l-1.2 3.4M20 17.5l-1.2 3.4'),
  windy: () => lines('M3 8.5h13a3.2 3.2 0 1 0-3.2-3.2M3 13h18.5a3.4 3.4 0 1 1-3.4 3.4M3 17.5h9'),
  'windy-variant': () => CL(5, -4, .85) + lines('M2.5 16.5h15a2.8 2.8 0 1 1-2.8 2.8M2.5 21h8'),
  exceptional: () => '<path fill-rule="evenodd" d="M14 2.8 26 22H2zM12.9 9h2.2l-.4 7.2h-1.4zM14 17.8a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z"/>',
};
const icon = (cond, night, h) => `<svg viewBox="0 0 28 24">${(ICON[cond] || ICON.cloudy)(night, h)}</svg>`;
const FOOT = {
  set: d => `<svg viewBox="0 0 32 24"><path d="M9 19.6a7 7 0 0 1 14 0z" fill="#fff" stroke="none"/>${lines(`M16 ${d ? '.4v8.2M12.7 5.3 16 8.6l3.3-3.3' : '8.6V.4M12.7 3.7 16 .4l3.3 3.3'}${RAYS(16, 19.6, 9.4, 12, 1, -Math.PI * 3 / 4)}${RAYS(16, 19.6, 9.4, 12, 1, -Math.PI / 4)}M1.8 19.6h3.8M26.4 19.6h3.8M.9 23.2h30.2`, 1.3)}</svg>`,
  wind: `<svg viewBox="0 0 32 24">${lines('M4.5 8.6c4.2-.9 8.6-.9 11.7-.3 2.6.5 4.4-1 4.4-3s-1.6-3.2-3.3-3.2-2.8 1.3-2.7 2.7M4.5 13.4c6-.8 13.2-1 18-.2 2.8.5 5-1.1 5-3.3 0-2-1.6-3.3-3.4-3.3S21 7.9 21.2 9.4M4.5 18.1c3.9-.8 8.3-.9 11.4-.4 2.4.4 4.4 1.1 4.4 3.1s-1.5 3-3.1 3-2.7-1.2-2.6-2.5', 1.2)}</svg>`,
  hum: `<svg viewBox="0 0 32 24">${lines('M3.6 6.4c3.4 1.7 6.6 1.6 9.8-.2 3.6-2 7.4-2.6 11.2-1.4M3.6 12.2c3.4 1.7 6.6 1.6 9.8-.2 2.4-1.3 4.5-2 6.6-2.1M3.6 18c3.4 1.7 6.6 1.6 9.8-.2 1-.6 2-1 3-1.3', 1.2)}<path d="M25.4 8.2s-4.9 6.1-4.9 9.7a4.9 4.9 0 0 0 9.8 0c0-3.6-4.9-9.7-4.9-9.7z" fill="#fff" stroke="none"/></svg>`,
  uv: `<svg viewBox="0 0 32 24"><circle cx="16" cy="12" r="4.4" fill="#fff" stroke="none"/>${lines(RAYS(16, 12, 6.8, 9.6))}</svg>`,
};

// ---------- Face ----------
export function weatherFace(el, f, place = '') {
  if (f?.style === 'cond') return condFace(el, place);
  el.innerHTML = `<div class="wsky"></div>
<header><div class="wc"><i class="wi" data-wxi></i><span data-bind="wxc"></span></div><div data-bind="wxhl"></div></header>
<time data-bind="time"></time>
<div class="wt" data-wxt></div>
<footer><div><i data-wxsi></i><b data-bind="wxsun"></b><span data-bind="wxsunl"></span></div><div>${FOOT.wind}<b data-bind="wxw"></b><span>Wind</span></div><div>${FOOT.hum}<b data-bind="wxh"></b><span>Feuchte</span></div><div>${FOOT.uv}<b data-bind="wxuv"></b><span>UV</span></div></footer>`;
  io.observe(el.firstChild); ro.observe(el.firstChild);
  if (DEMO) el.addEventListener('click', () => {   // Demo: Tippen zeigt der Reihe nach alle Wetter-Szenen
    if (el.closest('.gallery,.custom')) return;
    pick = ((pick ?? LIST.findIndex(([c, t]) => c === now[0] && t === now[1])) + 1) % LIST.length;
    weather(...last);
  });
}
// Stil „Bedingungen“ (Vorlage product-viewer/display_endframe, frames/pv-display_1…5): Ort, große Temperatur, Zustand, H/T mittig;
// darunter Glaskarte mit Segment Temperatur/Niederschlag/Wind und horizontal scrollender Stundenleiste (HA-Vorhersage hourly).
// Abweichung: Vorlage lässt die Karte unten aus dem Bild laufen → hier ganz sichtbar (Rand 4,3 cqw wie seitlich, Werte unter den Icons), Ort/Temperatur/Zustand dafür 3 cqw höher
const MODES = { t: ['Temperatur (°C)', `<svg viewBox="0 2 28 24">${behind('<circle cx="20" cy="11.3" r="4.2"/>', CL(0, 3.5, 1))}</svg>`], p: ['Niederschlag (%)', '<svg viewBox="0 0 28 24"><path d="M14 2.5s-6.5 8-6.5 12.6a6.5 6.5 0 0 0 13 0C20.5 10.5 14 2.5 14 2.5z"/></svg>'], w: ['Wind (km/h)', FOOT.wind] };
let hours = [], far = false;   // far: Fern-Ansicht (nur Text), sonst Nah mit Karte
const setFar = (el, v) => { if (el.closest('.gallery,.custom')) return; el.toggleAttribute('data-far', v); };
// Aus index.html: Präsenzmelder an → Nah, aus → Fern; ohne Melder bleibt Nah (Tipp wechselt immer)
export function weatherNear(on) { far = !on; for (const e of $$('.wcond')) setFar(e, far); }
function condFace(el, place) {
  el.classList.add('wcond'); el.dataset.m = 't'; setFar(el, far);
  el.addEventListener('click', e => { if (!e.target.closest('.wcard,.wlist,.wpl')) setFar(el, !el.hasAttribute('data-far')); });
  el.innerHTML = `<div class="wsky"></div><time data-bind="time"></time>
<div class="wtop"><b>${place.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)}</b><div data-bind="wxt"></div><span data-bind="wxc"></span><span data-bind="wxhl"></span></div>
<button class="wlist" aria-label="Orte"><svg viewBox="0 0 24 24"><path d="M4 7h1.6M9 7h11M4 12h1.6M9 12h11M4 17h1.6M9 17h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button><div class="wpl"></div>
<section class="wcard"><header><div><b>Bedingungen</b><span class="wsub">${MODES.t[0]}</span></div>
<div class="wseg">${Object.entries(MODES).map(([k, [, ic]], i) => `<button data-m="${k}"${i ? '' : ' class="on"'}><i class="wi">${ic}</i></button>`).join('')}</div></header>
<div class="whours"></div></section>`;
  io.observe(el.firstChild); ro.observe(el.firstChild);
  el.querySelector('.wseg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || el.closest('.gallery,.custom')) return;
    el.dataset.m = b.dataset.m; el.querySelector('.wseg .on')?.classList.remove('on'); b.classList.add('on');
    el.querySelector('.wsub').textContent = MODES[b.dataset.m][0];
    fillHours(el.querySelector('.whours'), true);
  });
  fillHours(el.querySelector('.whours'));
  const pl = el.querySelector('.wpl');
  el.querySelector('.wlist').addEventListener('click', () => { if (!el.closest('.gallery,.custom')) pl.classList.toggle('open'); });
  pl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pl.classList.remove('open'); places?.pick(b.dataset.id); });
  el.addEventListener('click', e => { if (!e.target.closest('.wlist,.wpl')) pl.classList.remove('open'); });
  fillPlaces(el);
}
// Orte (Vorlage display_endframe: runder Glas-Listenknopf oben links): alle weather.*-Entities, Auswahl merkt index.html; erst ab zwei Orten sichtbar
let places = null;
function fillPlaces(el) {
  el.toggleAttribute('data-pl', (places?.list.length || 0) > 1);
  el.querySelector('.wpl').innerHTML = (places?.list || []).map(([id, n]) => `<button data-id="${id}"${id === places.cur ? ' class="on"' : ''}><span>${n.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)}</span><i>✓</i></button>`).join('');
}
export function weatherPlaces(list, cur, pick) {
  if (places && places.cur === cur && JSON.stringify(places.list) === JSON.stringify(list)) return;
  places = { list, cur, pick }; for (const e of $$('.wcond')) fillPlaces(e);
}
// Nacht je Stunde aus sun.sun (nächster Unter-/Aufgang), sonst grob 20–6 Uhr
function nightAt(t) {
  const a = last[1]?.attributes, ns = Date.parse(a?.next_setting), nr = Date.parse(a?.next_rising);
  if (!ns || !nr) { const h = new Date(t).getHours(); return h < 6 || h >= 20; }
  return nr > ns ? t >= ns && t < nr : t < nr || t >= ns;
}
function fillHours(row, anim) {
  const m = row.closest('.wcond').dataset.m, cut = Date.now() - 3600e3;
  const list = hours.filter(h => Date.parse(h.datetime) > cut).slice(0, 24);
  row.innerHTML = list.map((h, i) => {
    const t = Date.parse(h.datetime), n = nightAt(t), c = h.condition === 'sunny' && n ? 'clear-night' : h.condition;
    const v = m === 't' ? Math.round(h.temperature) + '°' : m === 'p' ? (h.precipitation_probability ?? 0) + '<small> %</small>' : h.wind_speed == null ? '–' : Math.round(h.wind_speed) + '';
    return `<div><b>${i ? new Date(t).getHours() + '<small> Uhr</small>' : 'Jetzt'}</b><i class="wi">${icon(c in ICON ? c : 'cloudy', n, 1)}</i><span>${v}</span></div>`;
  }).join('');
  if (anim) row.querySelectorAll('span').forEach((x, i) => x.animate([{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: i * 25, easing: getComputedStyle(document.documentElement).getPropertyValue('--spring') || 'ease-out', fill: 'backwards' }));
}
// Aus index.html: Stundenvorhersage (weather/subscribe_forecast hourly)
export function weatherHours(list) { hours = list || []; for (const r of $$('.whours')) fillHours(r); }

const LIST = [...Object.keys(COND).filter(c => c !== 'clear-night').map(c => [c, 'day']), ['clear-night', 'night'],
  ['partlycloudy', 'night'], ['cloudy', 'night'], ['rainy', 'night'], ['snowy', 'night'], ['lightning-rainy', 'night'], ['sunny', 'dusk'], ['partlycloudy', 'dusk'], ['rainy', 'dusk']];
let pick = null, last = [], now = [];
if (Object.hasOwn(COND, Q.get('wx'))) {   // ?wx=&tod= erzwingt jede Kombination, auch außerhalb der Demo-Liste
  const q = [Q.get('wx'), ['day', 'dusk', 'night'].includes(Q.get('tod')) ? Q.get('tod') : 'day'];
  pick = LIST.findIndex(([c, t]) => c === q[0] && t === q[1]);
  if (pick < 0) pick = LIST.push(q) - 1;
}

const $$ = s => document.querySelectorAll(s);
const bind = (k, v) => { v = String(v); for (const e of $$(`[data-bind=${k}]`)) if (e.textContent !== v) e.textContent = v; };
const hm = d => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
function tod(sun) {
  if (['day', 'dusk', 'night'].includes(Q.get('tod'))) return Q.get('tod');   // Test-Parameter ?tod= gilt wie bei den Home-Faces überall
  const e = sun?.attributes?.elevation;
  if (e != null) return e > 6 ? 'day' : e > -5 ? 'dusk' : 'night';
  const h = new Date().getHours() + new Date().getMinutes() / 60;   // ponytail: ohne sun.sun grob nach Uhrzeit
  return h < 6.5 || h >= 19.5 ? 'night' : h < 8 || h >= 18 ? 'dusk' : 'day';
}
// Zahlen-Roll wie bei der Uhr: alt raus, neu mit der Feder rein
const glass = t => `<svg viewBox="0 0 90 40"><text x="0" y="33.4" font-size="38.5" font-weight="400" style="font-variation-settings:'wght' 450" letter-spacing="-.8" filter="url(#wxgi)" fill="#fff">${t.replace('°', '<tspan font-size="30" dx="-2.8" dy="-6">°</tspan>')}</text></svg>`;
function roll(el, txt, dir) {
  const old = el.lastElementChild, n = document.createElement('span');
  n.innerHTML = glass(txt); el.append(n);
  if (!dir || !old) return old?.remove();
  const cs = getComputedStyle(document.documentElement), sd = parseFloat(cs.getPropertyValue('--sd')) || 640;
  old.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${-dir * 40}%)`, opacity: 0 }], { duration: 220, easing: 'ease-in' }).onfinish = () => old.remove();
  n.animate([{ transform: `translateY(${dir * 40}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: sd, easing: cs.getPropertyValue('--spring') || 'ease-out' });
}

// Aus index.html bei jedem render(): HA-Wetter-Entity, sun.sun, Tagesvorhersage (erstes Element)
export function weather(ws, sun, fc) {
  last = [ws, sun, fc];
  const w = ws?.attributes || {}, up = sun?.state === 'above_horizon' || sun?.state !== 'below_horizon' && tod(sun) !== 'night';   // unavailable o. Ä. → nach Elevation/Uhr
  const known = Object.hasOwn(COND, ws?.state);
  let t = tod(sun), cond = known ? ws.state : 'cloudy';
  if (pick != null) [cond, t] = LIST[pick];
  if (cond === 'sunny' && t === 'night') cond = 'clear-night';
  if (cond === 'clear-night' && t !== 'night') cond = 'sunny';
  now = [cond, t];
  const temp = w.temperature == null ? '–' : Math.round(w.temperature) + '°';
  bind('wxt', temp);
  bind('wxc', pick != null || known ? COND[cond] : '–');   // umgemappten Zustand beschriften (sunny nachts = Klar)
  bind('wxhl', fc ? [['H', fc.temperature], ['T', fc.templow]].filter(([, v]) => v != null).map(([k, v]) => `${k}:${Math.round(v)}°`).join(' ') : '');
  bind('wxw', w.wind_speed == null ? '–' : `${Math.round(w.wind_speed)} ${w.wind_speed_unit || 'km/h'}`);
  bind('wxh', w.humidity == null ? '–' : Math.round(w.humidity) + ' %');
  bind('wxuv', w.uv_index == null ? '–' : Math.round(w.uv_index));
  const next = sun?.attributes?.[up ? 'next_setting' : 'next_rising'];
  const nd = next && new Date(next);   // Festzeit nur in der Demo (ohne sun.sun); echte Entity ohne gültige Zeit → –
  bind('wxsun', nd && !isNaN(nd) ? hm(nd) : sun ? '–' : up ? '18:26' : '07:46');
  bind('wxsunl', up ? 'Untergang' : 'Aufgang');
  for (const e of $$('[data-wxsi]')) if (e.dataset.v !== String(up)) { e.dataset.v = up; e.outerHTML = FOOT.set(up).replace('<svg', `<svg data-wxsi data-v="${up}"`); }
  const ik = cond + (t === 'night');
  for (const e of $$('[data-wxi]')) if (e.dataset.v !== ik) { e.dataset.v = ik; e.innerHTML = icon(cond, t === 'night'); }
  for (const e of $$('[data-wxt]')) {
    const o = e.lastElementChild?.textContent;
    if (o !== temp) roll(e, temp, o == null ? 0 : Math.sign(parseInt(temp) - parseInt(o)) || 1);
  }
  const key = `${cond}|${t}|${Math.round((w.wind_speed || 0) / 10)}`;
  for (const s of $$('.wsky')) if (s.dataset.k !== key) { s.dataset.k = key; build(s, cond, t, w.wind_speed, key); }
}

document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<filter id="wxgi" x="-5%" y="-5%" width="110%" height="115%" color-interpolation-filters="sRGB"><feColorMatrix in="SourceAlpha" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.15 0" result="f"/><feOffset in="SourceAlpha" dy=".45" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.13 0" result="t"/><feOffset in="SourceAlpha" dy="-.5" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.13 0" result="b"/><feOffset in="SourceAlpha" dx=".45" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.07 0" result="l"/><feOffset in="SourceAlpha" dy="-1.8" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out"/><feGaussianBlur stdDeviation=".7"/><feComposite in2="SourceAlpha" operator="in"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.07 0" result="g"/><feMerge><feMergeNode in="f"/><feMergeNode in="g"/><feMergeNode in="l"/><feMergeNode in="t"/><feMergeNode in="b"/></feMerge></filter>
</defs></svg>`);
document.head.insertAdjacentHTML('beforeend', `<style>
.f-weather{color:#fff;text-shadow:0 .1cqmin .8cqmin #0000003a}
.f-weather>:not(.wsky){position:absolute;z-index:1}
.wsky,.wsc{position:absolute;inset:0;overflow:hidden}
.wbox{position:absolute;left:50%;top:0;width:100cqmax;height:100cqmax;translate:-50% 0;container-type:size;overflow:hidden}
.wsky{background:#2b5c9c}
.wsc i{position:absolute;display:block;pointer-events:none}
.wsc svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.wsky.off *,.wsky.off *::before{animation-play-state:paused!important}
@media (prefers-reduced-motion:reduce){.wsky *{animation-play-state:paused!important}}
.wcl{left:0;width:200cqw;background:var(--img) 0 0/100cqw 100% repeat-x;animation:wx-x var(--d) linear var(--dl) infinite}
.wcl.rev{animation-direction:reverse}
@keyframes wx-x{to{transform:translateX(-100cqw)}}
/* 138cqw: deckt das Bild bis 30° Neigung (50·(cos30°+sin30°) = 68,3) */
.wtilt{inset:-19cqw;rotate:var(--a)}
.wsw{inset:0 calc(-1*var(--sx))}
.wpr{inset:auto 0;top:calc(-1*var(--s));height:calc(138cqw + var(--s));background:var(--img) 0 0/var(--w) var(--s);animation:wx-y var(--d) linear var(--dl) infinite}
@keyframes wx-y{to{transform:translateY(var(--s))}}
.wsw{animation:wx-sw var(--d) ease-in-out var(--dl) infinite alternate}
@keyframes wx-sw{from{transform:translateX(calc(-1*var(--sx,2.2cqw)))}to{transform:translateX(var(--sx,2.2cqw))}}
.wtilt>.wpt{inset:0 auto auto;border-radius:9cqw;background:linear-gradient(#fff0,rgb(255 255 255/var(--o)) 75%);animation:wx-p linear infinite}
.wtilt>.wpt.sn{background:radial-gradient(closest-side,rgb(255 255 255/var(--o)),rgb(255 255 255/calc(var(--o)*.85)) var(--k),#fff0);animation:wx-p linear infinite,wx-sw ease-in-out infinite alternate}
@keyframes wx-p{from{translate:0 -6cqw}to{translate:0 144cqw}}
.wsun{left:calc(var(--x) - 60cqw);top:calc(var(--y) - 60cqw);width:120cqw;height:120cqw;border-radius:50%}
.wsun{background:radial-gradient(closest-side,#fbfdff,#f2f7ffe6 6%,#e4eeff70 16%,#d8e6ff33 32%,#d8e6ff10 52%,#d8e6ff00);animation:wx-pulse 6s ease-in-out infinite alternate}
.wsun.hi{opacity:.75;animation:none}
.wsun.dusk{background:radial-gradient(closest-side,#fff4e0,#ffd9a8d9 6%,#ffb27a75 18%,#ff946033 38%,#ff8a5a00 62%)}
@keyframes wx-pulse{to{transform:scale(1.08);opacity:.88}}
.wst{inset:0 0 25cqw;background:var(--img) 0 0/var(--t) var(--t);-webkit-mask-image:linear-gradient(#000 50%,#0000);mask-image:linear-gradient(#000 50%,#0000);animation:wx-tw var(--d) ease-in-out var(--dl) infinite alternate}
@keyframes wx-tw{to{opacity:.4}}
.wbs{width:.55cqw;height:.55cqw;border-radius:50%;background:#fff;box-shadow:0 0 1cqw .3cqw #cfe0ff99;animation:wx-bs var(--d) ease-in-out var(--dl) infinite alternate}
@keyframes wx-bs{to{opacity:.2;transform:scale(.5)}}
.wbo{opacity:0}
.wbo path{fill:none;stroke:#fff;stroke-width:.45;stroke-linejoin:round;stroke-linecap:round}.wbo .b{stroke-width:.25;opacity:.65}.wbo .g{stroke:#a9bcff;stroke-width:2.2;opacity:.55}
.wlit{opacity:0}
.wsc::after{content:'';position:absolute;inset:50% 0 0;background:linear-gradient(#0b162400,#0b16242e);pointer-events:none}
.wfl{inset:0;opacity:0;background:radial-gradient(circle at var(--x) 12%,#eef2ffeb,#c8d4ff70 32%,#c8d4ff00 72%)}
.whz{inset:0;background:linear-gradient(#fff0 15%,#ffffff26)}
.wgu{left:0;width:60cqw;height:6cqw;animation:wx-gu var(--d) ease-in-out var(--dl) infinite}
.wgu path{fill:none;stroke-width:.9;stroke-linecap:round}
@keyframes wx-gu{0%{transform:translateX(-75cqw);opacity:0}12%,34%{opacity:1}46%,100%{transform:translateX(110cqw);opacity:0}}
.f-weather header{left:8cqmin;top:7.6cqmin;font-size:4.5cqmin;font-weight:500;line-height:1.27}
.f-weather .wc{display:flex;align-items:center;gap:.9cqmin}
.wi{display:inline-block;height:1.05em;aspect-ratio:28/24;flex:none;vertical-align:-.15em}
.wi svg{display:block;width:100%;height:100%;fill:currentColor;stroke:currentColor;overflow:visible}
.f-weather>time{right:8.3cqmin;top:6.8cqmin;font-size:7.95cqmin;font-weight:600;line-height:1;letter-spacing:0}
.f-weather .wt{left:7cqmin;top:20.2cqmin;display:grid;text-shadow:none;mix-blend-mode:plus-lighter}
.wt span{grid-area:1/1;width:90cqmin;height:40cqmin}
.wt svg{display:block;width:100%;height:100%;overflow:visible}
.f-weather footer{left:8.5cqmin;right:9cqmin;bottom:7.4cqmin;display:flex;justify-content:space-between;font-size:4.6cqmin;font-weight:500;line-height:1.24}
.f-weather footer div{display:flex;flex-direction:column;align-items:center}
.f-weather footer b{font-weight:500}
.f-weather footer span{opacity:.72}
/* Stil „Bedingungen“ — Maße aus Website-Bild product-viewer/display_endframe (Nah) und display_startframe (Fern), je auf 784 px skaliert und gemessen:
   Ort Kappenhöhe 40 px (7,0 cqw, 600, Laufweite −.045em wie SF Display), Temperatur 93 px Ziffernhöhe, Zustand/H-T Kappenhöhe 22 px (3,85 cqw, Regular), Uhr Kappenhöhe 22 px (3,93 cqw);
   Karte Titel 4,9 cqw, Untertitel 3,3 cqw, Segment 29 × 7,9 cqw (Schaltfläche 9,2 × 6,5), Stundenspalte 14,0 cqw (erste Mitte 12,3 cqw), Symbole 41 px (Sonne mit Strahlen), Gelb #ffcc00.
   Fern: Text größer (Ort ×1,21, Temperatur ×1,66, Zustand/H-T ×1,45) und tiefer, ohne Uhr und Karte; Nah: Karte + Uhr kommen gestaffelt dazu. Auslöser (Präsenzmelder/Tipp) ist keine Vorlage, nur Annahme. */
.wlist{display:none;position:absolute;left:4.2cqw;top:4.2cqw;width:8.6cqw;height:8.6cqw;padding:0;border:0;border-radius:50%;place-items:center;color:#fff;background:#ffffff38;-webkit-backdrop-filter:blur(2cqw);backdrop-filter:blur(2cqw);z-index:4;transition:opacity .4s .2s,scale .2s}.wlist:active{scale:.92}.wlist svg{width:4.6cqw;height:4.6cqw}
.wcond[data-pl] .wlist{display:grid}.wcond[data-far] .wlist{opacity:0;pointer-events:none;transition-delay:0s}
.wpl{corner-shape:squircle;position:absolute;left:4.2cqw;top:14.6cqw;min-width:44cqw;max-width:70cqw;padding:1.6cqw;border-radius:5cqw;background:rgb(11 78 149/.62);-webkit-backdrop-filter:blur(4cqw);backdrop-filter:blur(4cqw);z-index:4;transform-origin:0 0;scale:.6;opacity:0;pointer-events:none;transition:scale var(--sd,.64s) var(--spring,ease-out),opacity .25s}.wpl.open{scale:1;opacity:1;pointer-events:auto}.wcond[data-far] .wpl{display:none}
.wpl button{display:flex;justify-content:space-between;align-items:center;gap:4cqw;width:100%;padding:2.6cqw 3cqw;border:0;border-radius:3.6cqw;background:none;color:#fff;font-family:inherit;font-size:4.2cqw;font-weight:500;text-align:left}.wpl button.on{background:#ffffff26}.wpl i{font-style:normal;opacity:0}.wpl .on i{opacity:1}
.wcond>time{right:8.8cqw;top:8.4cqw;font-size:3.93cqw;font-weight:400;transition:opacity .4s .2s}
.wcond .wtop{left:0;right:0;top:0;height:60cqw;text-align:center}
.wcond .wtop>*{position:absolute;left:0;right:0;line-height:1;transform-origin:50% 0;transition:transform var(--sd,.64s) var(--spring,ease-out)}
.wcond .wtop b{top:16.1cqw;font-size:7cqw;font-weight:600;letter-spacing:-.045em}
.wcond .wtop>div{top:24.7cqw;font-size:16.2cqw;font-weight:300;padding-left:3.8cqw}
.wcond .wtop span{font-size:3.85cqw;font-weight:400;letter-spacing:-.045em}
.wcond .wtop span:nth-of-type(1){top:41.9cqw}
.wcond .wtop span:nth-of-type(2){top:46.7cqw;word-spacing:.34em}
.wcond[data-far] .wtop b{transform:translateY(8.1cqw) scale(1.2)}
.wcond[data-far] .wtop>div{transform:translateY(10.35cqw) scale(1.66)}
.wcond[data-far] .wtop span:nth-of-type(1){transform:translateY(21.5cqw) scale(1.46)}
.wcond[data-far] .wtop span:nth-of-type(2){transform:translateY(23.7cqw) scale(1.44)}
.wcond[data-far]>time{opacity:0;transition-delay:0s}
.wcard{corner-shape:squircle;left:4.4cqw;right:4.3cqw;bottom:4.3cqw;padding-bottom:3.65cqw;border-radius:5.1cqw;background:rgb(11 78 149/.5);-webkit-backdrop-filter:blur(3cqw);backdrop-filter:blur(3cqw);text-shadow:none;overflow:hidden;transition:transform var(--sd,.64s) var(--spring,ease-out) .1s,opacity .4s .1s}
.wcond[data-far] .wcard{transform:translateY(40cqw);opacity:0;pointer-events:none;transition-delay:0s}
.wcard header{display:flex;justify-content:space-between;align-items:flex-start;padding:3.65cqw 4.6cqw 0 4.2cqw}
.wcard header b{display:block;font-size:4.9cqw;font-weight:600;line-height:1.15;letter-spacing:-.03em}
.wsub{display:block;margin-top:.25cqw;font-size:3.3cqw;color:#acf4ff;line-height:1.2}
.wseg{display:flex;margin-top:1.12cqw;padding:.7cqw;border-radius:9cqw;background:#00001e1f}
.wseg button{width:9.2cqw;height:6.5cqw;border-radius:9cqw;display:grid;place-items:center;font-size:3.6cqw;transition:background-color .25s,scale var(--sd) var(--spring)}
.wseg button.on{background:#ffffff26}
.wseg button:active{scale:.9;transition:scale .12s ease-out}
.wseg .wi{height:1.32em}
.wseg [data-m=p] .wi{height:1.06em}
.wseg [data-m=w] .wi{height:.99em}
.whours{display:flex;margin-top:2.45cqw;padding:0 .9cqw;overflow:hidden;overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain;touch-action:pan-x}
.whours::-webkit-scrollbar{display:none}
.whours>div{flex:0 0 14cqw;display:flex;flex-direction:column;align-items:center}
.whours b{font-size:3.2cqw;font-weight:600;line-height:1;white-space:nowrap}
.whours small{font-size:.76em}
.whours .wi{height:7.1cqw;margin-top:5.5cqw}
.whours .s{fill:#ffcc00;stroke:#ffcc00}
.whours .s path{stroke-width:1.2}
.whours span{margin-top:0;font-size:3.3cqw;font-weight:500;line-height:1}
.f-weather footer svg{width:9.3cqmin;height:7cqmin;margin-bottom:2.9cqmin;fill:none;stroke:#fff;stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
</style>`);
