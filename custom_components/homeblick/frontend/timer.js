// Timer wie auf .com/: schwarzer Vollbild-Timer,
// Strichkranz entlang eines abgerundeten Quadrats (Rest orange ab 12 Uhr im Uhrzeigersinn, Verstrichenes gedimmt),
// große weiße Restzeit, darunter Gesamtdauer orange („15 MIN“). Zeigt den nächsten laufenden HA-`timer.*`.
// Nicht in der (nur Annahme): Tippen blendet aus, Timer-Kachel blendet wieder ein, bei Start/Ablauf erscheint er.
// Assist-Sprach-Timer sind in HA (soweit bekannt) keine Entities → nur Timer-Helper.
const DEMO = !new URLSearchParams(location.search).has('live');
const sec = s => String(s || 0).split(':').reduce((a, v) => a * 60 + +v, 0);
const hms = t => { t = Math.max(0, Math.ceil(t)); const h = t / 3600 | 0, m = t / 60 % 60 | 0, s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
const total = t => { const h = t / 3600 | 0, m = Math.round(t / 60 % 60); return t < 60 ? t + ' SEK' : (h ? h + ' STD ' : '') + (m || !h ? m + ' MIN' : ''); };
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n);
const spring = () => ({ duration: +css('--sd').replace('ms', '') || 640, easing: css('--spring') || 'ease-out' });

// Punkt + Außennormale auf abgerundetem Quadrat (halbe Kante h, Eckradius R) bei Anteil t des Umfangs, Start oben Mitte, im Uhrzeigersinn
function onRR(t, h, R) {
  const s = h - R, L = 2 * s + Math.PI * R / 2;
  let d = ((t * 4 * L + s) % (4 * L) + 4 * L) % (4 * L), x, y, nx, ny;
  const k = Math.floor(d / L); d -= k * L;
  if (d < 2 * s) [x, y, nx, ny] = [d - s, -h, 0, -1];
  else { const a = -Math.PI / 2 + (d - 2 * s) / R; [x, y, nx, ny] = [s + R * Math.cos(a), -s + R * Math.sin(a), Math.cos(a), Math.sin(a)]; }
  for (let i = 0; i < k; i++) [x, y, nx, ny] = [-y, x, -ny, nx];   // je Seite 90° weiterdrehen
  return [x, y, nx, ny];
}
// ponytail: 72 Striche, Lage/Größe aus dem schrägen Produktfoto geschätzt → bei besserer
const N = 72, TICKS = Array.from({ length: N }, (_, i) => {
  const [x, y, nx, ny] = onRR(i / N, 44.5, 16), l = 4;
  return `<line x1="${(50 + x).toFixed(2)}" y1="${(50 + y).toFixed(2)}" x2="${(50 + x - nx * l).toFixed(2)}" y2="${(50 + y - ny * l).toFixed(2)}"/>`;
}).join('');

let T, call, cur = null, key = '', iv = 0, done = null, doneT = 0, hidden = false;
const prev = {};   // letzter Zustand je Timer → Ablauf erkennen (active → idle, finishes_at erreicht)

export function timerInit(screen, callFn) {
  call = callFn;
  screen.insertAdjacentHTML('beforeend', `<div id="tmr"><svg viewBox="0 0 100 100">${TICKS}</svg><b class="tt"></b><span class="tl"></span></div>`);
  T = screen.lastElementChild;
  T.addEventListener('click', e => { e.stopPropagation(); done ? finishOff() : (hidden = true, show(false)); });
}
export function timerShow() { hidden = false; if (cur) show(true); }

function show(on) {
  if (!!T._on === on) return;
  T._on = on;
  T.getAnimations().forEach(x => x.cancel());
  if (on) { T.classList.add('on'); T.animate([{ opacity: 0, transform: 'scale(1.06)' }, { opacity: 1, transform: 'none' }], spring()); }
  else T.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 250, easing: 'ease-in' }).onfinish = () => T._on || T.classList.remove('on');
}

// Ziffern rollen einzeln, rückwärts zählend: neue Ziffer kommt von oben
function rollTxt(el, t) {
  while (el.children.length > t.length) el.firstElementChild.remove();
  while (el.children.length < t.length) el.prepend(Object.assign(document.createElement('span'), { className: 'ch' }));
  [...el.children].forEach((c, i) => {
    const old = c.lastElementChild;
    if (old?.textContent === t[i]) return;
    const n = document.createElement('i'); n.textContent = t[i]; c.append(n);
    if (!old || !T.classList.contains('on')) return old?.remove();
    old.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(45%)', opacity: 0 }], { duration: 220, easing: 'ease-in' }).onfinish = () => old.remove();
    n.animate([{ transform: 'translateY(-45%)', opacity: 0 }, { transform: 'none', opacity: 1 }], spring());
  });
}

const left = s => s.state === 'active' ? (Date.parse(s.attributes.finishes_at) - Date.now()) / 1000 : sec(s.attributes.remaining ?? s.attributes.duration);
// Strich i (ab 12 Uhr im Uhrzeigersinn) leuchtet, solange er im Rest-Anteil liegt
const ticks = f => T.querySelectorAll('line').forEach((l, i) => l.classList.toggle('on', i < Math.ceil(f * N - .001)));

function draw() {
  if (!cur) return;
  const r = left(cur);
  if (DEMO && cur.state === 'active' && r <= 0) call('timer', 'finish', { entity_id: cur.entity_id });   // HA macht das selbst
  rollTxt(T.querySelector('.tt'), hms(r));
  ticks(Math.max(0, r) / (sec(cur.attributes.duration) || 1));
}

// Aus index.html bei jedem render()
export function timers(ents) {
  if (!T) return;
  const now = Date.now(), list = Object.values(ents).filter(s => s.entity_id.startsWith('timer.'));
  for (const s of list) {
    const p = prev[s.entity_id];
    if (p?.state === 'active' && s.state === 'idle' && Date.parse(p.attributes.finishes_at) <= now + 2000) finished(s);
    if (p && p.state === 'idle' && s.state === 'active') hidden = false;   // neu gestartet → zeigen
    prev[s.entity_id] = s;
  }
  cur = list.filter(s => s.state === 'active' || s.state === 'paused').sort((a, b) => left(a) - left(b))[0] || null;
  if (done) return;
  if (!cur) { key = ''; clearInterval(iv); iv = 0; return show(false); }
  show(!hidden);
  const a = cur.attributes, k = cur.entity_id + cur.state + a.finishes_at + a.remaining;
  if (k === key) return;
  key = k;
  T.querySelector('.tl').textContent = total(sec(a.duration));
  draw();
  iv ||= setInterval(draw, 250);
}

function finished(s) {
  done = s; clearInterval(iv); iv = 0; key = '';
  T.querySelector('.tl').textContent = total(sec(s.attributes.duration));
  rollTxt(T.querySelector('.tt'), '0:00'); ticks(0); show(true);
  clearTimeout(doneT); doneT = setTimeout(finishOff, 60000);
}
function finishOff() { done = null; clearTimeout(doneT); show(false); key = ''; }

// Demo: Timer-Services wie HA (start/pause/cancel/finish)
export function timerDemo(service, s) {
  const a = s.attributes, now = Date.now();
  if (service === 'start') { const r = s.state === 'paused' ? sec(a.remaining) : sec(a.duration); return ['active', { finishes_at: new Date(now + r * 1000).toISOString(), remaining: hms(r) }]; }
  if (service === 'pause') return ['paused', { remaining: hms(left(s)), finishes_at: undefined }];
  return ['idle', { remaining: a.duration, finishes_at: undefined }];
}

document.head.insertAdjacentHTML('beforeend', `<style>
#tmr{position:absolute;inset:0;z-index:19;display:none;place-content:center;justify-items:center;gap:2.2cqw;background:#000;color:#fff;font-variant-numeric:tabular-nums}
#tmr.on{display:grid}
#tmr svg{position:absolute;inset:0;width:100%;height:100%}
#tmr line{stroke:#ff9f0a;stroke-width:1.1;stroke-linecap:round;opacity:.22;transition:opacity .4s}
#tmr line.on{opacity:1}
#tmr .tt{display:flex;font-size:19.5cqw;font-weight:500;letter-spacing:-.01em;line-height:1}
#tmr .ch{display:inline-grid;overflow:hidden}#tmr .ch>i{grid-area:1/1;font-style:normal}
#tmr .tl{color:#ff9f0a;font-size:4.3cqw;font-weight:600}
</style>`);
