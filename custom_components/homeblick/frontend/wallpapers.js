// Hintergründe (Wallpaper) als SVG, einmal gerastert; die Blur-Version dient als Glas unter den Kacheln.
// Vorlagen (Apple-Website, ~/homeview/ref/site/overview): Kurven = media-hero/hero_endframe (Bernstein), Prisma = incentive/installation (Indigo),
// Fächer = product-viewer/wall_mount (Teal), Kugeln = highlights/dashboard (Champagner), Flow = faces/faces_enhanced (Rosa/Blau).
// bg: Zahl = Kurven in Farbton | 'metal' | 'prism|fan|orb|flow:H[:S]' | Kurzformen 'prism' (= prism:245), 'teal' (= fan:172), 'champagne' (= orb:38:24)
const hs = (h, s, l, a = 1) => `hsl(${Math.round(h)} ${s}% ${l}% / ${a})`;
const P = ps => ps.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
export const svgData = s => 'data:image/svg+xml,' + encodeURIComponent(s);
export const svgUrl = s => `url("${svgData(s)}")`;
// Alle Motive zeichnen im 100×100-Raum. slice: Kreise bleiben rund (Kugeln, Flow), sonst wird auf das Display gestreckt
const doc = (defs, body, blur, slice = false) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="${slice ? 'xMidYMid slice' : 'none'}"><defs>${defs}`
  + `<filter id="bl" x="0" y="0" width="1" height="1"><feGaussianBlur stdDeviation="${blur}" edgeMode="duplicate"/></filter>`
  + `<filter id="s1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2"/></filter>`
  + `<filter id="s3" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.2"/></filter></defs>`
  + `<g ${blur ? 'filter="url(#bl)"' : ''}>${body}</g></svg>`;
const stops = st => st.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
const lin = (id, st, [x1, y1, x2, y2] = [0, 0, 1, 1], abs = false) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${abs ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops(st)}</linearGradient>`;
const rad = (id, [cx, cy, r], st) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(st)}</radialGradient>`;
const fill = id => `<rect width="100" height="100" fill="url(#${id})"/>`;
let uid = 0;

// ---- Kurven (Home-Face, Bernstein): glatter Verlauf, große Flächen mit Lichtkante, Licht oben rechts ----
const curves = (h, blur, light) => {
  const L = light ? [92, 82, 70] : [66, 43, 19], S = light ? [85, 72, 62] : [74, 84, 78], hi = light ? 100 : 86;
  const defs = lin('g', [[0, hs(h + 4, S[0], L[0])], [.52, hs(h - 6, S[1], L[1])], [1, hs(h - 14, S[2], L[2])]])
    + rad('p', [.92, .04, .78], [[0, hs(h + 8, 100, light ? 99 : 78, light ? .85 : .45)], [1, hs(h + 8, 100, 80, 0)]])
    + rad('q', [0, .8, .62], [[0, hs(h - 6, 92, light ? 88 : 52, .55)], [1, hs(h - 6, 92, 52, 0)]])
    + lin('a', [[0, hs(h + 6, 95, light ? 99 : 76, light ? .8 : .36)], [1, hs(h, 90, light ? 90 : 52, 0)]], [.7, 0, .2, 1])
    + lin('b', [[0, hs(h - 10, 80, light ? 70 : 28, 0)], [1, hs(h - 14, 75, light ? 60 : 10, light ? .5 : .62)]], [.4, 0, .6, 1])
    + lin('c', [[0, hs(h + 8, 100, light ? 100 : 86, light ? .75 : .42)], [.6, hs(h + 4, 95, light ? 92 : 66, light ? .25 : .12)], [1, hs(h, 90, 60, 0)]], [0, 0, 1, .9]);
  return doc(defs, fill('g') + fill('p') + fill('q')
    // große Mulde oben rechts, Lichtkante an der Schnittlinie
    + `<path d="M42-6C28 36 58 70 108 78V-6z" fill="url(#a)"/><path d="M42-6C28 36 58 70 108 78" fill="none" stroke="${hs(h + 8, 100, hi, light ? .7 : .42)}" stroke-width=".55"/>`
    // Band quer über die Mulde
    + `<path d="M26-6C14 40 52 78 108 92V80C62 68 34 36 46-6z" fill="url(#c)"/><path d="M26-6C14 40 52 78 108 92" fill="none" stroke="${hs(h + 10, 100, hi, light ? .8 : .5)}" stroke-width=".4"/>`
    // dunkle Kuppe unten links mit weichem Rand
    + `<circle cx="-6" cy="102" r="52" fill="url(#b)"/><path d="M-6 50C20 52 40 80 36 106H-6z" fill="${hs(h - 14, 70, light ? 66 : 12, light ? .22 : .3)}"/>`
    + `<path d="M-6 50C20 52 40 80 36 106" fill="none" stroke="${hs(h + 6, 95, hi, light ? .5 : .22)}" stroke-width=".35"/>`, blur);
};
export const wp = (h, blur = 0) => curves(h, blur, false);
export const wpL = (h, blur = 0) => curves(h, blur, true);

// ---- Metall (Vorlage TGo1gI0QtfU 00475): entsättigtes Graublau, dunkle Welle, weiche Lichtbahn ----
export const wpMetal = (blur = 0) => doc(
  lin('g', [[0, 'hsl(212 44% 80%)'], [.5, 'hsl(213 40% 64%)'], [1, 'hsl(215 38% 50%)']])
  + rad('p', [.85, .05, .7], [[0, 'hsl(210 60% 96% / .75)'], [1, 'hsl(210 60% 96% / 0)']])
  + lin('w', [[0, 'hsl(218 34% 52% / .5)'], [1, 'hsl(220 34% 28% / .55)']], [.2, 0, .8, 1])
  + lin('r', [[0, 'hsl(210 60% 98% / .6)'], [1, 'hsl(210 50% 90% / 0)']]),
  fill('g') + fill('p')
  + `<path d="M-6 32C22 8 44 46 32 76S62 116 108 96V108H-6z" fill="url(#w)"/><path d="M-6 32C22 8 44 46 32 76S62 116 108 96" fill="none" stroke="hsl(210 60% 96% / .55)" stroke-width=".5"/>`
  + `<path d="M48-6C72 22 96 28 108 54V-6z" fill="url(#r)"/><path d="M48-6C72 22 96 28 108 54" fill="none" stroke="hsl(210 60% 98% / .6)" stroke-width=".4"/>`
  + `<path d="M-6 82C26 62 62 72 108 42" stroke="hsl(210 40% 94% / .38)" stroke-width="8" fill="none" filter="url(#s1)"/>`, blur);

// ---- Prisma & Fächer: extrudierte Balken (Licht von links oben) über flachen Kristallflächen ----
// Balken um die Mittellinie mit Breite w; Seitenflächen je Kante nach Lage getönt, weicher Schlagschatten; tone = heller/dunkler
const beam = (h, [x1, y1, x2, y2], w, tone = 0, sat = 80, e = [3, 3.4]) => {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), nx = -dy / d * w / 2, ny = dx / d * w / 2, id = 'k' + uid++, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const t = [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]];
  let out = `<polygon points="${P(t.map(([x, y]) => [x + e[0] * 2.4, y + e[1] * 2.4]))}" fill="hsl(${h} 70% 8% / .4)" filter="url(#s3)"/>`;
  t.forEach((a, i) => {   // Seitenfläche nur an Kanten, deren Normale entlang der Extrusion zeigt
    const b = t[(i + 1) % 4], k = Math.hypot(b[1] - a[1], b[0] - a[0]);
    let n = [-(b[1] - a[1]) / k, (b[0] - a[0]) / k];
    if (n[0] * (a[0] + b[0] - 2 * cx) + n[1] * (a[1] + b[1] - 2 * cy) < 0) n = [-n[0], -n[1]];
    if (n[0] * e[0] + n[1] * e[1] <= 0) return;
    out += `<polygon points="${P([a, b, [b[0] + e[0], b[1] + e[1]], [a[0] + e[0], a[1] + e[1]]])}" fill="${hs(h, sat - 18, Math.max(10, Math.round(32 - 10 * (n[0] + n[1]) * .7071 + tone)))}"/>`;
  });
  return out + `<defs>${lin(id, [[0, hs(h, sat, 78 + tone)], [1, hs(h, sat - 12, 60 + tone)]], [x1, y1, x2, y2], true)}</defs><polygon points="${P(t)}" fill="url(#${id})"/>`
    + `<path d="M${P([t[0]])}L${P([t[1]])}" stroke="${hs(h, 95, 92, .55)}" stroke-width=".3"/>`;
};
const facet = (h, pts, s, l, a = 1) => `<polygon points="${P(pts)}" fill="${hs(h, s, l, a)}"/>`;
// Fächer: Blätter um (cx,cy), jedes aus einer hellen und einer dunklen Hälfte (gefaltet), Spitzen überlappen wie ein Windrad
const blades = (h, n = 12, cx = 4, cy = 12, r = 54) => Array.from({ length: n }, (_, i) => {
  const a = i * 2 * Math.PI / n + .2, d = 1.35 * Math.PI / n, q = (t, k) => [cx + r * k * Math.cos(t), cy + r * k * Math.sin(t)], tip = q(a, 1), id = 'f' + uid++;
  const half = s => `M${cx} ${cy}C${P([q(a + s * d * 2.2, .3), q(a + s * d * 1.5, .8), tip])}z`;   // Kurve von der Mitte zur Spitze, z schließt gerade zurück
  return `<defs>${lin(id, [[0, hs(h, 58, 44, .75)], [1, hs(h, 62, 18, .8)]], [cx, cy, tip[0], tip[1]], true)}</defs>`
    + `<path d="${half(-1)}" fill="${hs(h, 62, 74, .34)}"/><path d="${half(1)}" fill="url(#${id})"/><path d="M${cx} ${cy}L${P([tip])}" stroke="${hs(h, 80, 86, .3)}" stroke-width=".3"/>`;
}).join('');
export const wpPrism = (h, blur = 0, fan = false) => {
  const defs = lin('g', [[0, hs(h, 62, 52)], [.55, hs(h - 4, 62, 40)], [1, hs(h - 8, 62, 26)]])
    + rad('r', [.25, 0, .85], [[0, 'hsl(0 0% 100% / .16)'], [1, 'hsl(0 0% 100% / 0)']]);
  const flats = facet(h, [[0, 46], [26, 38], [58, 74], [34, 86]], 74, 74, .17) + facet(h, [[0, 66], [34, 54], [48, 100], [0, 100]], 58, 18, .4)
    + facet(h, [[56, 100], [78, 60], [100, 72], [100, 100]], 54, 20, .5) + facet(h, [[30, 88], [60, 74], [74, 100], [40, 100]], 72, 66, .2)
    + facet(h, [[78, 40], [100, 30], [100, 62], [88, 66]], 62, 30, .35) + facet(h, [[60, -2], [100, -2], [100, 24], [84, 20]], 70, 70, .12);
  const k = fan ? -14 : 0, sat = fan ? 52 : 80;   // Fächer: Balken zurückgenommen und gedämpft, das Blatt trägt das Bild
  const bars = beam(h, [-10, 2, 52, 64], 14, k, sat) + beam(h, [10, -18, 82, 54], 11, k - 3, sat) + beam(h, [40, -20, 116, 56], 15, k + 3, sat)
    + beam(h, [114, 14, 46, 82], 12, k - 6, sat) + beam(h, [108, 58, 62, 104], 9, k - 8, sat);
  return doc(defs, fill('g') + flats + (fan ? blades(h) : '') + bars + fill('r'), blur);
};

// ---- Kugeln / Champagner (Vorlage dashboard): warme matte Fläche, große Bögen, metallische Kugeln mit Spiegellicht ----
export const wpOrb = (h, s = 24, blur = 0) => {
  const c = (l, a = 1, ds = 0) => hs(h, Math.max(0, s + ds), l, a);
  const ball = id => rad(id, [.36, .3, .78], [[0, c(95)], [.3, c(82)], [.62, c(60, 1, 4)], [1, c(36, 1, 8)]])
    + rad(id + 'r', [.62, 1.02, .6], [[0, c(88, .75, 6)], [1, c(80, 0)]]);
  const defs = lin('g', [[0, c(76)], [.5, c(66, 1, 2)], [1, c(48, 1, 6)]]) + rad('p', [.8, .1, .7], [[0, c(92, .6)], [1, c(92, 0)]])
    + lin('d', [[0, c(82, .9)], [1, c(60, .55, 4)]], [.2, 0, .8, 1]) + lin('e', [[0, c(56, 0)], [1, c(26, .6, 8)]], [.5, 0, .5, 1]) + ball('s1') + ball('s2');
  return doc(defs, fill('g') + fill('p')
    // große Scheibe links oben (hell → matt) und dunklere unten links, beide mit Lichtkante
    + `<circle cx="34" cy="26" r="46" fill="url(#d)"/><circle cx="34" cy="26" r="46" fill="none" stroke="${c(100, .6)}" stroke-width=".5"/>`
    + `<circle cx="6" cy="102" r="44" fill="url(#e)"/><circle cx="6" cy="102" r="44" fill="none" stroke="${c(96, .4)}" stroke-width=".4"/>`
    // kleine Kugel hinten rechts
    + `<ellipse cx="86" cy="30" rx="15" ry="3.4" fill="${c(30, .35)}" filter="url(#s3)"/><circle cx="84" cy="18" r="15" fill="url(#s2)"/><circle cx="84" cy="18" r="15" fill="url(#s2r)"/>`
    // große Kugel vorn: Schlagschatten, Körper, Spiegellicht unten, Glanzpunkt, feiner Rand
    + `<ellipse cx="68" cy="94" rx="30" ry="5" fill="${c(30, .4)}" filter="url(#s3)"/><circle cx="66" cy="66" r="27" fill="url(#s1)"/><circle cx="66" cy="66" r="27" fill="url(#s1r)"/>`
    + `<ellipse cx="57" cy="52" rx="8" ry="5" transform="rotate(-32 57 52)" fill="${c(100, .5)}" filter="url(#s1)"/><circle cx="66" cy="66" r="27" fill="none" stroke="${c(100, .35)}" stroke-width=".4"/>`, blur, true);
};

// ---- Flow (Vorlage faces_enhanced, Flow-Zifferblatt): große weiche Blasen mit Glasrand auf Lila-Rosa ----
const blob = (cx, cy, r, k) => {   // glatte Blase: Radius mit zwei Sinus-Wellen moduliert, Catmull-Rom → Bézier
  const n = 14, p = Array.from({ length: n }, (_, i) => { const t = i * 2 * Math.PI / n, m = 1 + .2 * Math.sin(2 * t + k) + .12 * Math.sin(3 * t + k * 1.7); return [cx + r * m * Math.cos(t), cy + r * m * Math.sin(t) * .92]; });
  const g = i => p[(i + n) % n];
  return 'M' + P([p[0]]) + p.map((_, i) => { const a = g(i - 1), b = g(i), c = g(i + 1), d = g(i + 2); return `C${P([[b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6], [c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6], c])}`; }).join('') + 'z';
};
export const wpFlow = (h, blur = 0) => {
  const h2 = Math.abs((h - 322 + 540) % 360 - 180) < 50 ? 232 : 322, B = [[42, 38, 21, 1.2, h, 0], [68, 32, 15, 2.4, h, 1], [34, 68, 20, 3.6, h2, 2], [64, 66, 18, 5, h, 3], [82, 54, 8, .4, h2, 4], [16, 18, 8, 5.3, h2, 5], [52, 90, 7, 2.9, h2, 6]];
  const defs = lin('g', [[0, hs(h2 - 40, 78, 88)], [.55, hs(h2 - 16, 80, 80)], [1, hs(h2 + 6, 88, 68)]], [0, 0, .7, 1])
    + B.map(([, , , , hh, i]) => rad('b' + i, [.34, .26, .85], [[0, hs(hh, 92, 82, .86)], [.55, hs(hh, 88, 66, .86)], [1, hs(hh - 6, 84, 54, .86)]])
      + `<clipPath id="c${i}"><path d="${blob(...B[i].slice(0, 4))}"/></clipPath>`).join('');
  return doc(defs, fill('g') + B.map(([cx, cy, r, k, hh, i]) => {
    const d = blob(cx, cy, r, k);
    return `<path d="${d}" fill="${hs(hh, 70, 26, .3)}" transform="translate(.8 2)" filter="url(#s3)"/><path d="${d}" fill="url(#b${i})"/>`
      + `<g clip-path="url(#c${i})"><path d="${d}" fill="none" stroke="${hs(hh - 40, 100, 88, .75)}" stroke-width="3" filter="url(#s1)"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".7"/></g>`;
  }).join(''), blur, true);
};

// ---- Zuordnung bg → Motiv ----
const NAMED = { prism: ['prism', 245], teal: ['fan', 172], champagne: ['orb', 38, 24] };
export const MOTIF = b => {
  if (typeof b !== 'string') return null;
  const m = b.match(/^(prism|fan|orb|flow):(\d+)(?::(\d+))?$/) || (NAMED[b] && [b, ...NAMED[b]]);
  return m ? { k: m[1], h: +m[2], s: m[3] == null ? (m[1] === 'orb' ? 40 : null) : +m[3] } : null;
};
export const hueOf = b => typeof b === 'number' ? b : b === 'metal' ? 215 : MOTIF(b)?.h ?? null;
// Gedämpfte Töne (Metall, Kugeln): Untertitel fast weiß und Text im An-Zustand dunkel in Familie, sonst Neon auf hellem Glas
export const bgTint = b => b === 'metal' ? 'hsl(207 100% 90%)' : MOTIF(b)?.k === 'orb' ? `hsl(${MOTIF(b).h} ${Math.min(40, MOTIF(b).s + 12)}% 93%)` : null;
export const bgInk = b => { const m = MOTIF(b); return m?.k === 'orb' ? [`hsl(${m.h} ${Math.min(80, m.s + 30)}% 22%)`, `hsl(${m.h} ${Math.min(50, m.s + 10)}% 34%)`] : null; };
export function bgSvg(b, blur = 0, light = false) {
  const m = MOTIF(b);
  if (m) return m.k === 'orb' ? wpOrb(m.h, m.s, blur) : m.k === 'flow' ? wpFlow(m.h, blur) : wpPrism(m.h, blur, m.k === 'fan');
  return b === 'metal' ? wpMetal(blur) : (light ? wpL : wp)(b, blur);
}
const cache = {};
export const wall = (b, light = false) => cache[b + (light ? 'L' : '')] ||= [svgUrl(bgSvg(b, 0, light)), svgUrl(bgSvg(b, 1, light))];
