// Verlaufs-Kachel (Stil „spark“ für Sensor-Kacheln): Wert groß, darunter weiche 24-h-Kurve mit Fläche und Endpunkt.
// Eine gebündelte History-Abfrage für alle Spark-Kacheln (Cache 10 min), Kurve aus bins()/smooth() von energy.js, der aktuelle Wert hängt live am Ende.
import { bins, smooth } from './curve.js';
import { tx } from './i18n.js';

const SPAN = 864e5, STEP = 18e5, TTL = 6e5, REPAINT = 6e4;   // 24 h in 30-min-Schritten = 48 Punkte
const C = new Map();   // Entität → { at, pts: [[ms, Wert]] }
let api = null, busy = false;
// o.ents(): States, o.hist(ids, start) → Promise<{id: [{s, lu}]}> | null (ohne Verbindung), o.live: false = Demo-Verläufe
export const sparkInit = o => { api = o; setInterval(() => !document.hidden && sparkSync(document.querySelectorAll('[data-sv=spark]')), 6e4); };

// Reine Form: Punkte + aktueller Wert → Pfade; null, wenn nichts zu zeichnen ist (weniger als zwei Werte)
export function shape(pts, cur, now) {
  const s = pts.filter(p => p[0] > now - SPAN - STEP);
  if (isFinite(cur)) s.push([now, cur]);
  if (s.length < 2) return null;
  const t0 = now - SPAN;
  if (s[0][0] > t0) s.unshift([t0, s[0][1]]);   // junge Entität: erster Wert gilt nach links (bins() startete sonst bei 0)
  const b = bins(s, t0, now, STEP), v = b.map(p => p[1]);
  const lo = Math.min(...v), hi = Math.max(...v), rg = Math.max(hi - lo, .5, .04 * Math.max(Math.abs(lo), Math.abs(hi)));   // Mindestspanne: Rauschen wird keine Zacke
  const mid = (hi + lo) / 2, P = ([t, y]) => [100 * (t - t0) / SPAN, 15 - 12 * (y - mid) / rg];
  const q = b.map(P), ln = smooth(q);
  return { ln, ar: `${ln}V30H${q[0][0].toFixed(2)}Z`, y: q.at(-1)[1] };
}
// Demo (ohne ?live): ruhige Kurve um den aktuellen Wert, je Entität anders
const demo = (id, cur, now) => {
  const h = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7), k = (isFinite(cur) ? Math.max(Math.abs(cur), 1) : 10) * .12;
  return Array.from({ length: 49 }, (_, i) => [now - SPAN + i * STEP, (isFinite(cur) ? cur : 10) + k * (Math.sin(i / 6 + h % 7) + .5 * Math.sin(i / 2.3 + h % 5))]);
};

function paint(t, now = Date.now()) {
  const id = t.dataset.e, s = api.ents()[id], w = t.querySelector('.spw');
  if (!w || !s) return;
  const c = C.get(id), g = c && shape(c.pts, parseFloat(s.state), now), key = g ? g.ln : c ? 'x' : '';
  t._sp = now;
  if (w._k === key) return;
  w._k = key;
  if (!g) { w.innerHTML = c ? `<em>${tx('Kein Verlauf')}</em>` : ''; return; }
  w.innerHTML = `<svg class="sa" viewBox="0 0 100 30" preserveAspectRatio="none"><path d="${g.ar}"/></svg><svg class="sl" viewBox="0 0 100 30" preserveAspectRatio="none"><path d="${g.ln}" vector-effect="non-scaling-stroke"/></svg><i style="top:${(g.y / 30 * 100).toFixed(1)}%"></i>`;
}
// Vom Zustandslauf je Kachel gerufen: höchstens jede Minute neu zeichnen, Daten fehlen/veraltet → bündelig nachladen
export function sparkSync(els) {
  if (!api) return;
  const now = Date.now(), list = [...els].filter(t => t.dataset.e);
  for (const t of list) if (!t._sp || now - t._sp >= REPAINT || (C.has(t.dataset.e) && !t.querySelector('.spw')?._k)) paint(t, now);
  const need = [...new Set(list.map(t => t.dataset.e))].filter(id => !C.has(id) || now - C.get(id).at > TTL);
  if (!need.length || busy) return;
  if (!api.live) { for (const id of need) C.set(id, { at: now, pts: demo(id, parseFloat(api.ents()[id]?.state), now) }); list.forEach(t => paint(t, now)); return; }
  busy = true;
  Promise.resolve(api.hist(need, new Date(now - SPAN))).then(r => {
    if (!r) return;   // noch keine Verbindung: beim nächsten Lauf erneut
    for (const id of need) C.set(id, { at: now, pts: (r[id] || []).map(x => [(x.lu ?? x.lc) * 1000, parseFloat(x.s)]).filter(p => isFinite(p[0]) && isFinite(p[1])) });
    list.forEach(t => paint(t));
  }).catch(e => console.warn('Verlauf (spark)', e)).finally(() => { busy = false; });
}

if (typeof document !== 'undefined') document.head.insertAdjacentHTML('beforeend', `<style>
.tile[data-sv=spark] .spw{position:relative;flex:none;align-self:stretch;height:7cqw;margin:0 4.5cqw 1.5cqw;color:var(--accent,currentColor)}
.tile[data-sv=spark][data-size="2x1"]:not(.thermo){gap:3cqw}.tile[data-sv=spark][data-size="2x1"] .big{flex:0 1 auto;max-width:45%;font-size:9cqw}
.tile[data-sv=spark][data-size="2x1"] .spw{flex:1 1 0;order:1;align-self:center;height:11cqw;margin:0}.tile[data-sv=spark][data-size="2x1"] .lbl{order:2;min-width:0}
.tile[data-sv=spark][data-size="2x2"] .spw{height:22cqw;margin-bottom:4cqw}
.spw svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.spw .sa{fill:currentColor;opacity:.28;-webkit-mask-image:linear-gradient(#000,#0000);mask-image:linear-gradient(#000,#0000)}
.spw .sl path{fill:none;stroke:currentColor;stroke-width:1.6px;stroke-linecap:round;stroke-linejoin:round}
.spw svg{animation:spk .9s cubic-bezier(.3,.7,.3,1) both}
.spw i{position:absolute;right:0;width:1.7cqw;height:1.7cqw;margin:-.85cqw -.85cqw 0 0;border-radius:50%;background:currentColor;box-shadow:0 0 0 .5cqw #ffffff59;animation:spd .4s .7s both}
.spw em{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:2.2cqw;font-weight:500;opacity:.55}
@keyframes spk{from{clip-path:inset(-20% 100% -20% 0)}}
@keyframes spd{from{opacity:0;scale:.3}}
</style>`);

// Selbsttest: node spark.js (Pfadform und Leerzustand)
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('spark.js')) {
  const t = (c, m) => console.assert(c, m), now = 1e12;
  t(shape([], NaN, now) === null && shape([[now - 1e6, 5]], NaN, now) === null, 'ohne Daten kein Verlauf');
  t(shape([[now - SPAN, 5]], 5, now)?.y === 15, 'konstanter Wert: flache Linie in der Mitte');
  const pts = Array.from({ length: 60 }, (_, i) => [now - SPAN + i * 14e5, 20 + Math.sin(i / 5) * 3]), g = shape(pts, 21, now);
  t(g && /^M/.test(g.ln) && g.ar.endsWith('Z') && g.y > 0 && g.y < 30, 'Kurve mit Fläche und Endpunkt im Bild');
  const f = shape([[now - SPAN, 20], [now - 1e6, 20.2]], 20.1, now);   // Rauschen < Mindestspanne bleibt flach
  t(f && Math.abs(f.y - 15) < 3, 'Rauschen bleibt nahe der Mitte');
  const j = shape([[now - SPAN / 2, 30], [now - SPAN / 4, 10]], 10, now);   // junge Entität: der erste Wert gilt nach links (30 = oben), nicht 0 (= unten)
  t(j && +/^M[\d.]+,([\d.]+)/.exec(j.ln)?.[1] < 15, 'kurze History startet nicht bei 0');
  console.log('ok');
}
