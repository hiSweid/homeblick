// Timer wie auf .com/: schwarzer Vollbild-Timer,
// Strichkranz entlang eines abgerundeten Quadrats (Rest orange ab 12 Uhr im Uhrzeigersinn, Verstrichenes gedimmt),
// große weiße Restzeit, darunter Gesamtdauer orange („15 MIN“). Zeigt den nächsten laufenden HA-`timer.*`.
// Nicht in der (nur Annahme): Tippen blendet aus, Timer-Kachel blendet wieder ein, bei Start/Ablauf erscheint er.
// Assist-Sprach-Timer sind in HA (soweit bekannt) keine Entities → nur Timer-Helper.
// Eigene Ergänzung (User-Wunsch, keine Vorlage): Ausgeblendet schrumpft der Timer in eine Pille oben (wie die Dynamic Island),
// Tippen auf die Pille klappt ihn wieder auf; nach BACK ms ohne Berührung springt er von selbst zurück.
// Läuft dabei Musik, zeigt der Vollbild-Timer unten einen Mini-Player.
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
// ponytail: 60 Striche (Vorlage), Lage/Größe aus dem schrägen Produktfoto geschätzt → bei besserer
const N = 60, TICKS = Array.from({ length: N }, (_, i) => {
  const [x, y, nx, ny] = onRR(i / N, 44.5, 16), l = 4;
  return `<line x1="${(50 + x).toFixed(2)}" y1="${(50 + y).toFixed(2)}" x2="${(50 + x - nx * l).toFixed(2)}" y2="${(50 + y - ny * l).toFixed(2)}"/>`;
}).join('');

let T, P, M, call, cur = null, key = '', iv = 0, done = null, doneT = 0, hidden = false, mp = null, mpKey = '', touch = Date.now();
const BACK = 30000;
const prev = {};   // letzter Zustand je Timer → Ablauf erkennen (active → idle, finishes_at erreicht)

export function timerInit(screen, callFn) {
  call = callFn;
  screen.insertAdjacentHTML('beforeend', `<div id="tmr"><svg viewBox="0 0 100 100">${TICKS}</svg><b class="tt"></b><span class="tl"></span>
    <div class="tmp" hidden><i></i><span><b></b><small></small></span><button aria-label="Abspielen/Pause"><svg class="i" viewBox="0 0 24 24"><path/></svg></button></div></div>
    <button id="tpill" hidden><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" pathLength="1"/><circle cx="10" cy="10" r="7.5" pathLength="1"/></svg><b></b><i hidden></i></button>`);
  T = screen.querySelector('#tmr'); P = screen.querySelector('#tpill'); M = T.querySelector('.tmp');
  T.addEventListener('click', e => { e.stopPropagation(); done ? finishOff() : (hidden = true, show(false)); });
  P.addEventListener('click', e => { e.stopPropagation(); timerShow(); });
  M.querySelector('button').addEventListener('click', e => { e.stopPropagation(); mp && call('media_player', 'media_play_pause', { entity_id: mp.entity_id }); });
  for (const n of ['pointerdown', 'keydown']) addEventListener(n, () => touch = Date.now(), true);
  // Nichts los am Display → zurück zum Timer (nicht beim Anpassen, in offenen Ansichten oder während Assist)
  setInterval(() => {
    if (!hidden || !cur || done || Date.now() - touch < BACK) return;
    if (/custom|gallery/.test(screen.className) || screen.querySelector('.view:not([hidden])') || screen.querySelector('#assist')?.className) return;
    timerShow();
  }, 1000);
}
export function timerShow() { hidden = false; if (cur) show(true); }

// Rechteck der Pille relativ zum Screen als clip-path → Vollbild wächst aus der Pille bzw. schrumpft hinein
const pillClip = () => {
  const s = T.getBoundingClientRect(), r = P.getBoundingClientRect(), k = s.width / T.offsetWidth || 1;
  return `inset(${(r.top - s.top) / k}px ${(s.right - r.right) / k}px ${(s.bottom - r.bottom) / k}px ${(r.left - s.left) / k}px round ${r.height / 2 / k}px)`;
};
function pill(on) {
  if (!P.hidden === on) return;
  P.getAnimations().forEach(x => x.cancel()); P.style.opacity = '';
  if (on) { P.hidden = false; P.animate([{ opacity: 0, scale: .5 }, { opacity: 1, scale: 1 }], spring()); }
  else P.hidden = true;
}
function show(on) {
  if (!!T._on === on) return;
  T._on = on;
  T.getAnimations().forEach(x => x.cancel());
  const morph = !P.hidden || (!on && cur && !done);   // Pille sichtbar bzw. Timer läuft weiter → über die Pille
  if (on) {
    T.classList.add('on');
    if (morph) { const c = pillClip(); pill(false); T.animate([{ clipPath: c }, { clipPath: 'inset(0 0 0 0 round 0)' }], spring()); T.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }); }
    else T.animate([{ opacity: 0, transform: 'scale(1.06)' }, { opacity: 1, transform: 'none' }], spring());
  } else if (morph) {
    P.hidden = false; const c = pillClip(); P.style.opacity = 0;
    T.animate([{ clipPath: 'inset(0 0 0 0 round 0)' }, { clipPath: c }], spring());
    T.animate([{ opacity: 1 }, { opacity: 1, offset: .55 }, { opacity: 0 }], spring()).onfinish = () => { P.style.opacity = ''; T._on || T.classList.remove('on'); };
  } else T.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 250, easing: 'ease-in' }).onfinish = () => T._on || T.classList.remove('on');
}

// Aus index.html nach der Player-Wahl: Mini-Player im Vollbild-Timer, solange Musik spielt oder pausiert ist
export function timerMusic(s, base) {
  if (!M) return;
  const a = s?.attributes || {}, on = !!a.media_title && (s.state === 'playing' || s.state === 'paused');
  mp = on ? s : null;
  const k = on ? [a.media_title, a.media_artist, a.entity_picture, s.state].join('|') : '';
  if (k === mpKey) return;
  const was = !!mpKey; mpKey = k;
  T.classList.toggle('mu', on);
  if (!on) return void (M.hidden = true);
  const pic = a.entity_picture;
  M.querySelector('i').style.backgroundImage = pic ? `url("${pic.startsWith('/') ? base + pic : pic}")` : '';
  M.querySelector('b').textContent = a.media_title; M.querySelector('small').textContent = a.media_artist || a.friendly_name || '';
  M.querySelector('path').setAttribute('d', s.state === 'playing' ? 'M8 5v14M16 5v14' : 'M7 4.5v15l12-7.5z');
  M.querySelector('path').classList.toggle('pl', s.state !== 'playing');
  if (!was) { M.hidden = false; if (T._on) M.animate([{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'none' }], spring()); }
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
  const f = Math.max(0, r) / (sec(cur.attributes.duration) || 1);
  rollTxt(T.querySelector('.tt'), hms(r));
  ticks(f);
  P.querySelector('b').textContent = hms(r); P.querySelector('circle+circle').style.strokeDashoffset = 1 - f;
  P.classList.toggle('pa', cur.state === 'paused');
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
  const run = list.filter(s => s.state === 'active' || s.state === 'paused').sort((a, b) => left(a) - left(b));
  cur = run[0] || null;
  const n = P.querySelector('i'); n.hidden = run.length < 2; n.textContent = '+' + (run.length - 1);   // weitere laufende Timer
  if (done) return;
  if (!cur) { key = ''; clearInterval(iv); iv = 0; pill(false); return show(false); }
  show(!hidden); if (hidden && !T.getAnimations().length) pill(true);
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
  rollTxt(T.querySelector('.tt'), '0:00'); ticks(0); pill(false); show(true);
  clearTimeout(doneT); doneT = setTimeout(finishOff, 60000);
}
function finishOff() { done = null; clearTimeout(doneT); key = ''; show(false); }

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
#tmr>svg{position:absolute;inset:0;width:100%;height:100%}
#tmr line{stroke:#ff9f0a;stroke-width:1.1;stroke-linecap:round;opacity:.22;transition:opacity .4s}
#tmr line.on{opacity:1}
#tmr .tt{display:flex;font-size:19.5cqw;font-weight:500;letter-spacing:-.01em;line-height:1}
#tmr .ch{display:inline-grid;overflow:hidden}#tmr .ch>i{grid-area:1/1;font-style:normal}
#tmr .tl{color:#ff9f0a;font-size:4.3cqw;font-weight:600}
#tmr :is(.tt,.tl){transition:translate var(--sd) var(--spring)}
#tmr.mu :is(.tt,.tl){translate:0 -7cqw}
/* Pille oben, Maße wie die .top-Zeile (5.6cqw) mittig */
#tpill{position:absolute;z-index:18;top:3.4cqw;left:50%;translate:-50% 0;display:flex;align-items:center;gap:1.5cqw;height:7.4cqw;padding:0 2.8cqw 0 1.5cqw;
  border-radius:4cqw;background:#000;color:#ff9f0a;font-size:3.7cqw;font-weight:600;font-variant-numeric:tabular-nums;
  box-shadow:0 .8cqw 3cqw #0007,inset 0 0 0 .12cqw #ffffff1f;transition:scale .25s}
#tpill i{font-style:normal;font-size:2.9cqw;padding:.5cqw 1.2cqw;margin-right:-1.2cqw;border-radius:2cqw;background:#ff9f0a2e}
#tpill:active{scale:.94;transition:scale .12s ease-out}
#tpill svg{width:4.8cqw;height:4.8cqw;rotate:-90deg}
#tpill circle{fill:none;stroke:#ff9f0a;stroke-width:2.6;opacity:.28}
#tpill circle+circle{opacity:1;stroke-linecap:round;stroke-dasharray:1;transition:stroke-dashoffset .3s linear}
#tpill.pa b{animation:tpa 1.6s ease-in-out infinite}
@keyframes tpa{50%{opacity:.35}}
/* Mini-Player im Timer: Glas-Zeile innerhalb des Strichkranzes */
#tmr .tmp{position:absolute;left:17cqw;right:17cqw;bottom:16cqw;display:flex;align-items:center;gap:2.6cqw;padding:1.8cqw 1.8cqw 1.8cqw 1.8cqw;
  border-radius:4.4cqw;background:#ffffff17;box-shadow:inset 0 .15cqw .1cqw #ffffff22}
#tmr .tmp>i{flex:none;width:10cqw;height:10cqw;border-radius:2.2cqw;background:#ffffff26 center/cover}
#tmr .tmp>span{flex:1;min-width:0;display:grid;gap:.5cqw;font-size:3.4cqw;line-height:1.2}
#tmr .tmp :is(b,small){overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#tmr .tmp small{color:#ebebf599;font-size:3.1cqw}
#tmr .tmp button{flex:none;width:9cqw;height:9cqw;border-radius:50%;display:grid;place-items:center;font-size:4.6cqw;color:#fff;transition:scale .25s}
#tmr .tmp button:active{scale:.88;transition:scale .12s ease-out}
#tmr .tmp path{stroke-width:2.6}#tmr .tmp path.pl{fill:currentColor;stroke-width:1.5}
</style>`);
