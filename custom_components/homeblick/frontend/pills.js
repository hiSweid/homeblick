// Live-Pillen: kleine Glas-Pillen oben (neben den Timer-Pillen) für das, was gerade läuft — „Waschmaschine 42 Min“, „Golf lädt 63 %“, „Mäher“.
// Ohne laufende Quelle ist nichts zu sehen. Regeln in CONF.pills = [{ e, on, text, icon, left, done }]:
//   e = Entität; on = Zustände, bei denen es „läuft“ (Komma: running, cleaning; oder Vergleich: >5, <=100), ohne Angabe nach Domain (an, cleaning, mowing, playing …)
//   left = Sensor für die Anzeige rechts (Zeitstempel → Restzeit, Dauer/Min → „42 Min“, % → „63 %“), ohne Angabe der Wert von e, falls numerisch
//   done = 'card' (Standard: bei Ende „fertig“-Karte, bleibt bis Wegwischen), 'pill' (nur die Pille zeigt 10 min „fertig“) oder 'none'
// Ende = läuft → aus für OFF_MS am Stück (Waschmaschinen pausieren zwischen den Phasen kurz); nach dem Start gibt es kein falsches Ende (erste Auswertung stumm, unavailable zählt nicht).
const OFF_MS = 60000, DONE_MS = 600000, MAX = 3;   // MAX: so viele Live-Pillen gleichzeitig (Priorität = Reihenfolge der Regeln), mehr verdrängen sonst die Timer
const ON = { binary_sensor: 'on', switch: 'on', input_boolean: 'on', light: 'on', fan: 'on', humidifier: 'on', siren: 'on', vacuum: 'cleaning', lawn_mower: 'mowing', media_player: 'playing', timer: 'active', climate: 'heating', water_heater: 'on', valve: 'open' };
export const defOn = e => ON[e.split('.')[0]] || '';   // Standard-Zustände je Domain (für den Editor)
const GONE = new Set(['unavailable', 'unknown', '']);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const pad = n => String(n).padStart(2, '0');

// Läuft die Quelle? null = unbekannt (nicht verfügbar) → Zustand bleibt, wie er war
export function running(rule, s) {
  if (!s || GONE.has(s.state)) return null;
  const spec = (rule.on || ON[rule.e.split('.')[0]] || '').split(',').map(x => x.trim()).filter(Boolean);
  const n = parseFloat(s.state);
  return spec.some(x => { const m = /^(>=|<=|>|<)\s*(-?\d+(?:[.,]\d+)?)$/.exec(x); if (!m) return x === s.state; const v = +m[2].replace(',', '.'); return isFinite(n) && (m[1] === '>' ? n > v : m[1] === '<' ? n < v : m[1] === '>=' ? n >= v : n <= v); });
}
const dur = t => t >= 3600 ? `${t / 3600 | 0}:${pad(Math.ceil(t % 3600 / 60) % 60)} h` : t >= 60 ? `${Math.ceil(t / 60)} Min` : `${Math.max(1, Math.ceil(t))} s`;
// Anzeige rechts aus einem Sensor
export function detail(s, now = Date.now()) {
  if (!s || GONE.has(s.state)) return '';
  const v = String(s.state), u = s.attributes?.unit_of_measurement || '';
  if (/^\d{4}-\d\d-\d\d[T ]/.test(v)) { const t = (Date.parse(v) - now) / 1000; return t > 0 ? dur(t) : ''; }
  const n = parseFloat(v); if (!isFinite(n)) return v.length <= 10 ? v : '';
  if (u === 's') return n > 0 ? dur(n) : '';
  if (u === 'min') return n > 0 ? dur(n * 60) : '';
  if (u === 'h') return n > 0 ? dur(n * 3600) : '';
  return `${Math.round(n * 10) / 10}`.replace('.', ',') + (u ? (u === '%' ? ' %' : ' ' + u) : '');
}

// Fortschritt 0–100 für den Ring: Prozent-Sensor direkt, Restzeit relativ zur größten gesehenen Restzeit (m.tot); null = unbekannt → Ring dreht sich
export function progress(s, m, now) {
  if (!s || GONE.has(s.state)) return null;
  const v = String(s.state), u = s.attributes?.unit_of_measurement || '';
  let rem;
  if (/^\d{4}-\d\d-\d\d[T ]/.test(v)) rem = (Date.parse(v) - now) / 1000;
  else { const n = parseFloat(v); if (!isFinite(n)) return null; if (u === '%') return Math.min(100, Math.max(0, n)); rem = { s: n, min: n * 60, h: n * 3600 }[u]; }
  if (!(rem > 0)) return null;
  m.tot = Math.max(m.tot || 0, rem);
  return m.tot - rem < 1 ? 0 : 100 * (1 - rem / m.tot);
}

const ICONS = { wash: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><circle cx="12" cy="13.5" r="3.6"/><path d="M8.5 7h.01M11.5 7h.01"/>', bolt: '<path d="M13 3 6 13.5h5L10 21l8-11h-5z"/>',
  mow: '<path d="M4 15h13l2-6h-5"/><circle cx="7" cy="17.8" r="2"/><circle cx="16" cy="17.8" r="2"/>', vac: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.4"/>', dot: '<circle cx="12" cy="12" r="4" fill="currentColor"/>', ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>' };
export const PILL_ICONS = { wash: 'Waschmaschine', bolt: 'Laden', mow: 'Mäher', vac: 'Sauger', dot: 'Punkt' };
const COLOR = { wash: '#64d2ff', bolt: '#30d158', mow: '#a8e063', vac: '#bf5af2', dot: '#ffd60a', ok: '#30d158' };
const iconOf = r => ICONS[r.icon] ? r.icon : r.e.startsWith('lawn_mower.') ? 'mow' : r.e.startsWith('vacuum.') ? 'vac' : 'dot';

// Zustandsautomat je Regel; m = { on, off, done } wird verändert, r = running() → 'live' | 'end' (gerade fertig) | 'fin' („fertig“ steht noch) | null
export function step(m, r, mode, now) {
  if (r === true) { m.on = true; m.off = 0; m.done = 0; return 'live'; }
  if (r === false) {
    if (!m.on) m.on = false;   // erste Auswertung stumm: ein Gerät, das schon vor dem Laden aus war, ist nicht „gerade fertig geworden“
    else {
      m.off ||= now; if (now - m.off < OFF_MS) return 'live';   // Entprellung
      m.on = false; m.off = 0;
      if (mode === 'none') m.done = 0; else { m.done = now; return 'end'; }
    }
  }
  if (m.on) return 'live';   // unavailable während des Laufs: Pille bleibt, kein falsches Ende
  return m.done && now - m.done < DONE_MS ? 'fin' : null;
}

// opts: { ents(), conf() → Regelliste, hidden() → Gastmodus o. Ä., go(rule) Tippen, done(rule, text) bei Ende (Karte), quiet() nachts keine Karte }
export function pillsInit(screen, o) {
  const host = screen.querySelector('#lps'), mem = new Map(), els = new Map();   // mem: Regel-Schlüssel → { on, off (seit), done (Zeit) }
  const keyOf = (r, i) => i + ':' + r.e;
  const tint = ic => `--c:${COLOR[ic]}`;
  const calm = () => document.documentElement.classList.contains('perf') || matchMedia('(prefers-reduced-motion: reduce)').matches;   // Leistungsmodus: nur Zustände, keine Bewegung

  const spring = () => { const c = n => getComputedStyle(document.documentElement).getPropertyValue(n); return { duration: +c('--sd').replace('ms', '') || 640, easing: c('--spring') || 'ease-out' }; };
  function eval1(rule, i, now) {
    const key = keyOf(rule, i), s = o.ents()[rule.e], m = mem.get(key) || (mem.set(key, { on: null, off: 0, done: 0 }), mem.get(key)), mode = rule.done || 'card', k = step(m, running(rule, s), mode, now), x = { rule, key, s, m };
    if (k === 'end') { if (mode === 'card' && !o.quiet?.()) o.done?.(rule, `${rule.text || s.attributes.friendly_name || rule.e} ist fertig`); return { ...x, fin: true, pulse: true }; }
    if (k !== 'live') m.tot = 0;   // nächster Lauf zählt neu
    return k && { ...x, fin: k === 'fin' };
  }

  function tick() {
    const now = Date.now(), rules = o.hidden?.() ? [] : (o.conf() || []).filter(r => r && typeof r.e === 'string' && r.e.includes('.')).slice(0, 8);
    let list = rules.map((r, i) => eval1(r, i, now)).filter(Boolean);
    list = [...list.filter(x => !x.fin), ...list.filter(x => x.fin)].slice(0, MAX);   // Laufendes vor „fertig“
    const keep = new Set(list.map(x => x.key));
    for (const [k, el] of els) if (!keep.has(k)) { els.delete(k); el.getAnimations().forEach(a => a.cancel()); calm() ? el.remove() : (el.animate([{ opacity: 1, scale: '1', translate: '0 0', filter: 'blur(0)' }, { opacity: 0, scale: '.55', translate: '0 -1.4cqw', filter: 'blur(.8cqw)' }], { duration: 260, easing: 'cubic-bezier(.5,0,.8,.4)' }).onfinish = () => el.remove()); }
    list.forEach((x, i) => {
      let el = els.get(x.key);
      if (!el) {
        el = Object.assign(document.createElement('button'), { className: 'lp', innerHTML: '<span class="rg"><svg class="i" viewBox="0 0 24 24"></svg></span><b></b><i></i>' });
        el.addEventListener('click', e => { e.stopPropagation(); const m = mem.get(el.dataset.k); if (el.classList.contains('fin') && m) { m.done = 0; tick(); } else o.go?.(el._r); });   // „fertig“ wegtippen, sonst zur Kachel
        el.dataset.k = x.key; els.set(x.key, el); host.append(el);
        if (!calm()) {
          el.animate([{ opacity: 0, scale: '.45', translate: '0 -2.2cqw', filter: 'blur(.9cqw)' }, { opacity: 1, scale: '1', translate: '0 0', filter: 'blur(0)' }], spring());
          for (const c of el.children) c.animate([{ opacity: 0, translate: '-.8cqw 0' }, { opacity: 1, translate: '0 0' }], { duration: 420, delay: 140, easing: 'ease-out', fill: 'backwards' });
        }
      }
      if (host.children[i] !== el) host.insertBefore(el, host.children[i] || null);
      const ic = x.fin ? 'ok' : iconOf(x.rule), name = x.rule.text || x.s?.attributes?.friendly_name || x.rule.e, d = x.fin ? 'fertig' : detail(o.ents()[x.rule.left] || (isFinite(parseFloat(x.s?.state)) ? x.s : null), now);
      el._r = x.rule; el.classList.toggle('fin', !!x.fin); el.style.cssText = tint(x.fin ? 'ok' : iconOf(x.rule));
      const pr = x.fin ? 100 : progress(o.ents()[x.rule.left] || (isFinite(parseFloat(x.s?.state)) ? x.s : null), x.m, now);
      el.classList.toggle('ind', pr == null); if (pr != null) el.style.setProperty('--v', pr.toFixed(1));   // Ring: Fortschritt oder, wenn unbekannt, ein kreisender Bogen
      const svg = el.querySelector('svg'); if (svg._i !== ic) { svg._i = ic; svg.innerHTML = ICONS[ic]; }
      el.querySelector('b').textContent = name; const di = el.querySelector('i');
      if (di.textContent !== d) {   // Wert rollt: alter gleitet hoch hinaus, neuer von unten herein (nicht beim ersten Setzen)
        const had = di.textContent !== '' && !di.hidden;
        di.textContent = d; di.hidden = !d;
        if (had && d && !calm()) di.animate([{ opacity: 0, translate: '0 .9cqw', filter: 'blur(.3cqw)' }, { opacity: 1, translate: '0 0', filter: 'blur(0)' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
      if (x.pulse) {   // fertig: Pille hüpft, ein grüner Ring läuft nach außen
        x.pulse = false;
        if (!calm()) {
          el.animate([{ scale: '1' }, { scale: '1.22' }, { scale: '.97' }, { scale: '1' }], { duration: 760, easing: 'cubic-bezier(.3,1.4,.5,1)' });
          const B = '0 .4cqw 1.6cqw #0008';
          el.animate([{ boxShadow: `${B}, 0 0 0 0 #30d158aa` }, { boxShadow: `${B}, 0 0 0 3.2cqw #30d15800` }], { duration: 900, easing: 'ease-out' });
        }
      }
    });
  }
  setInterval(tick, 1000);
  return { tick };
}

if (typeof document !== 'undefined') document.head.insertAdjacentHTML('beforeend', `<style>
.lp,.tpill{--c:#ff9230}
@property --v{syntax:'<number>';inherits:true;initial-value:0}
@property --a{syntax:'<angle>';inherits:false;initial-value:0deg}
.lp,#prow .tpill{position:relative;flex:none;display:flex;align-items:center;gap:1.17cqw;height:4.94cqw;padding:0 2.34cqw 0 0.59cqw;border-radius:2.6cqw;background:#161618;color:#fff;font-size:2.86cqw;font-weight:600;line-height:1;
  font-variant-numeric:tabular-nums;box-shadow:0 0.52cqw 2.08cqw #0008;transition:scale .25s}
.lp::before{content:"";position:absolute;inset:-3.9cqw -0.65cqw}
.lp:active{scale:.94;transition:scale .12s ease-out}
/* Ring statt Icon-Fläche: der Fortschritt füllt sich weich nach (--v animiert), unbekannter Fortschritt = kreisender Bogen, fertig = voller grüner Ring */
.rg{position:relative;flex:none;width:3.77cqw;height:3.77cqw;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--c) calc(var(--v) * 1%),#ffffff22 0);transition:--v .9s cubic-bezier(.3,.7,.2,1)}
.rg::before{content:"";position:absolute;inset:0.39cqw;border-radius:50%;background:#161618}
.lp.ind .rg{background:conic-gradient(from var(--a),#0000 0 62%,var(--c));animation:lpr 1.5s linear infinite}
.rg svg{position:relative;width:2.08cqw;height:2.08cqw;fill:none;stroke:var(--c);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.lp b{max-width:31.2cqw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp i{flex:none;font-style:normal;font-weight:600;color:var(--c)}
.lp.fin i{font-weight:500}
#prow .tpill b{color:var(--c)}#prow .tpill em{color:#fff}
#prow .tpill .gl{width:2.08cqw;height:2.08cqw;stroke:var(--c);stroke-width:2.4}
#prow .tpill.pa .rg{opacity:.6}
@keyframes lpr{to{--a:360deg}}
</style>`);

// Selbsttest: node pills.js
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('pills.js')) {
  const t = (c, m) => console.assert(c, m), S = (state, attributes = {}) => ({ state, attributes });
  t(running({ e: 'binary_sensor.x' }, S('on')) === true && running({ e: 'binary_sensor.x' }, S('off')) === false, 'Standard je Domain');
  t(running({ e: 'sensor.w', on: 'running, drying' }, S('drying')) === true && running({ e: 'sensor.w', on: 'running' }, S('idle')) === false, 'mehrere Zustände');
  t(running({ e: 'sensor.p', on: '>5' }, S('7.5')) === true && running({ e: 'sensor.p', on: '>5' }, S('5')) === false && running({ e: 'sensor.p', on: '<=5,off' }, S('5')) === true, 'Vergleiche');
  t(running({ e: 'sensor.p', on: '>5' }, S('unavailable')) === null && running({ e: 'sensor.p', on: '>5' }, S('abc')) === false, 'unavailable = unbekannt, Text ist nie größer');
  const now = Date.parse('2030-01-01T10:00:00Z');
  t(detail(S('2030-01-01T10:42:00Z'), now) === '42 Min' && detail(S('2030-01-01T09:00:00Z'), now) === '', 'Zeitstempel → Restzeit');
  t(detail(S('90', { unit_of_measurement: 'min' }), now) === '1:30 h' && detail(S('63', { unit_of_measurement: '%' }), now) === '63 %' && detail(S('0.5', { unit_of_measurement: 'h' }), now) === '30 Min', 'Dauer, Prozent');
  t(detail(S('12.34', { unit_of_measurement: 'kW' })) === '12,3 kW' && detail(S('unavailable', {})) === '', 'Zahl mit Einheit, unavailable leer');
  // Automat: Start, Pause kürzer als OFF_MS ist kein Ende, Ende, „fertig“ läuft ab; unavailable und erste Auswertung erzeugen kein Ende
  const m = { on: null, off: 0, done: 0 }, T = 1e6;
  t(step(m, false, 'card', T) === null && step(m, null, 'card', T) === null, 'schon aus beim Laden: nichts');
  t(step(m, true, 'card', T) === 'live' && step(m, false, 'card', T + 1000) === 'live' && step(m, null, 'card', T + OFF_MS * 5) === 'live', 'läuft; unavailable hält');
  t(step(m, true, 'card', T + 2000) === 'live' && step(m, false, 'card', T + 3000) === 'live' && step(m, false, 'card', T + 3000 + OFF_MS - 1) === 'live', 'kurze Pause ist kein Ende');
  t(step(m, false, 'card', T + 3000 + OFF_MS) === 'end' && step(m, false, 'card', T + 4000 + OFF_MS) === 'fin' && step(m, false, 'card', T + 3000 + OFF_MS + DONE_MS) === null, 'Ende einmal, dann „fertig“, dann weg');
  const n = { on: null, off: 0, done: 0 };
  t(step(n, true, 'none', T) === 'live' && step(n, false, 'none', T + 1) === 'live' && step(n, false, 'none', T + 1 + OFF_MS) === null, 'done none: ohne „fertig“');
  const pm = {}, nowp = Date.parse('2030-01-01T10:00:00Z');
  t(progress(S('63', { unit_of_measurement: '%' }), {}, nowp) === 63 && progress(S('abc'), {}, nowp) === null && progress(S('unavailable'), {}, nowp) === null && progress(S('12', { unit_of_measurement: 'kW' }), {}, nowp) === null, 'Prozent direkt, sonst unbekannt');
  t(progress(S('2030-01-01T11:00:00Z'), pm, nowp) === 0 && Math.round(progress(S('2030-01-01T10:15:00Z'), pm, nowp)) === 75 && progress(S('2030-01-01T09:00:00Z'), pm, nowp) === null, 'Restzeit relativ zur größten gesehenen');
  console.log('ok');
}
