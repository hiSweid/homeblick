// Reine Kurvenhelfer für Energie-Face und Verlaufs-Kachel (ohne DOM, damit per Node testbar)
// Mittelwert je Schritt (Kurve: 15 min) (Zustand hält bis zur nächsten Änderung)
export function bins(s, t0, t1, step) {
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
export const smooth = p => p.map(([x, y], i) => {
  if (!i) return `M${x.toFixed(2)},${y.toFixed(2)}`;
  const a = p[i - 2] || p[i - 1], b = p[i - 1], c = p[i + 1] || [x, y];
  return `C${(b[0] + (x - a[0]) / 6).toFixed(2)},${cl(b[1] + (y - a[1]) / 6).toFixed(2)} ${(x - (c[0] - b[0]) / 6).toFixed(2)},${cl(y - (c[1] - b[1]) / 6).toFixed(2)} ${x.toFixed(2)},${y.toFixed(2)}`;
}).join('');
