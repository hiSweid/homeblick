// Texturen für weather.js (Wolken, Regen, Schnee/Hagel/Sterne). Läuft als Worker mit OffscreenCanvas,
// damit ein Wetterwechsel den Hauptthread (Wischen, Animationen) nicht blockiert; weather.js importiert DRAW nur als Rückfall.
const rng = a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function noise(seed) {   // Value-Noise, in x periodisch mit Periode P (ganzzahlig, ≤ 256)
  const r = rng(seed), p = new Uint8Array(512), v = new Float32Array(256);
  for (let i = 0; i < 256; i++) { p[i] = i; v[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = r() * (i + 1) | 0, t = p[i]; p[i] = p[j]; p[j] = t; }
  p.copyWithin(256, 0, 256);
  return (x, y, P) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, w = y - yi, x0 = (xi % P + P) % P, x1 = (x0 + 1) % P, y0 = yi & 255, y1 = (yi + 1) & 255;
    const a = v[p[p[x0] + y0]], b = v[p[p[x1] + y0]], c = v[p[p[x0] + y1]], d = v[p[p[x1] + y1]], su = u * u * (3 - 2 * u), sw = w * w * (3 - 2 * w);
    return a + (b - a) * su + (c - a) * sw + (a - b - c + d) * su * sw;
  };
}
// Wolkenband: Dichte = fBm × Höhenprofil, Licht von links oben (Dämmerung: von links unten, ly = Lichtneigung)
export const DRAW = {
  cloud(ctx, W, H, o, pal) {
    const K = Math.max(2, o.k), n = noise(o.s), D = new Float32Array(W * H), f = K / W;   // Periode 1 wäre in x konstant → Streifen
    let m = 0, q = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, a = .5, fx = x * f, fy = y * f * (o.ay || 1), P = K;
      for (let i = 0; i < 6; i++, fx *= 2, fy *= 2, P *= 2, a *= .58) s += a * n(fx, fy, P);
      D[y * W + x] = s; m += s; q += s * s;
    }
    // auf z-Werte normieren → Bedeckung c entspricht ungefähr dem Flächenanteil
    m /= W * H; q = Math.sqrt(q / (W * H) - m * m);
    const t0 = (.5 - o.c) * 2.4;
    for (let y = 0; y < H; y++) {
      const v = y / H, env = sm(o.y0 - .1, o.y0 + .2, v) * (1 - sm(o.y1 - .55, o.y1, v));
      for (let x = 0; x < W; x++) D[y * W + x] = (D[y * W + x] - m) / q - (1 - env) * 2.6;   // zum Bandrand hin kleinere Wolken statt Schleier
    }
    // Licht von links oben/unten: zum Licht gewandte Kanten hell, Unterseiten und dicke Stellen dunkel, Ränder silbrig
    const img = ctx.createImageData(W, H), d = img.data, [l, sh, ly = -1.4] = pal, e = t0 - 1, mod = x => (x % W + W) % W;
    const at = (x, y) => y >= H ? e : D[Math.max(0, y) * W + mod(x)],   // oben die erste Zeile fortsetzen, sonst helle Kante
      L1 = Math.round(W * .035), L2 = Math.round(W * .012);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, v = D[i], al = sm(t0, t0 + o.soft, v) * sm(0, .08, y / H) * sm(1, .92, y / H);   // nie harte Kante am Kachelrand
      if (!al) continue;
      let tau = 0;
      for (let j = 1; j <= 8; j++) tau += Math.max(0, at(x - j * L2, y + Math.round(j * L2 * ly)) - t0);
      const g = (v - at(x - L1, y + Math.round(L1 * ly))) * .22 + (v - at(x - L2, y + Math.round(L2 * ly))) * .3;
      const b = Math.min(1, Math.max(0, .55 + g) * Math.exp(-tau * o.ab * .1) + (1 - al) * .3);
      for (let c = 0; c < 3; c++) d[i * 4 + c] = sh[c] + (l[c] - sh[c]) * b;
      d[i * 4 + 3] = al * 255;
    }
    ctx.putImageData(img, 0, 0);
  },
  // Regen/Hagel: Striche mit Verlauf (oben durchsichtig = Bewegungsunschärfe), Kachel nahtlos in x und y
  rain(ctx, TW, TH, o) {
    const r = rng(o.n * 7 + o.h * 13 + o.len * 100), px = TW / o.tw, n = Math.round(o.n * o.tw * o.h / 1e4);
    ctx.lineCap = 'round'; ctx.lineWidth = o.w * px;
    for (let i = 0; i < n; i++) {
      const x = r() * TW, y = r() * TH, L = o.len * px * (.55 + .45 * r()), a = o.a * (.45 + .55 * r());
      for (const x0 of [x - TW, x, x + TW]) for (const y0 of [y - TH, y]) {
        if (x0 + ctx.lineWidth < 0 || x0 - ctx.lineWidth > TW) continue;
        const g = ctx.createLinearGradient(0, y0, 0, y0 + L);
        g.addColorStop(0, '#fff0'); g.addColorStop(.4, `rgba(255,255,255,${a * .75})`); g.addColorStop(1, `rgba(255,255,255,${a})`);
        ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + L); ctx.stroke();
      }
    }
  },
  dot(ctx, TW, TH, o, seed) {   // Schnee/Sterne: weiche Punkte, in x und y nahtlos
    const r = rng(seed + o.n), px = TW / o.tw, n = Math.round(o.n * o.tw * o.h / 1e4);
    for (let i = 0; i < n; i++) {
      const x = r() * TW, y = r() * TH, R = (o.r0 + (o.r1 - o.r0) * r() ** 2) * px, a = o.a * (.5 + .5 * r());
      for (const dx of [-TW, 0, TW]) for (const dy of [-TH, 0, TH]) {
        if (x + dx + R < 0 || x + dx - R > TW || y + dy + R < 0 || y + dy - R > TH) continue;
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, R);
        g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1 - o.soft, `rgba(255,255,255,${a * .85})`); g.addColorStop(1, '#fff0');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + dx, y + dy, R, 0, 7); ctx.fill();
      }
    }
  },
};

if (typeof WorkerGlobalScope !== 'undefined') onmessage = async ({ data: { id, kind, w, h, args } }) => {
  const c = new OffscreenCanvas(w, h);
  DRAW[kind](c.getContext('2d'), w, h, ...args);
  postMessage({ id, blob: await c.convertToBlob() });
};
