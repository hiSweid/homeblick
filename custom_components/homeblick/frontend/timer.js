// Timer-Vollbild nach Geräte-Videos (Frontalbild zT8M0BsBO5k 143 s, TGo1gI0QtfU 27,75/29,5 s = vorlagen/TGo…/00278 + 00295, ref/steuerung/medien):
// schwarzer Grund, Strichkranz KREIS ⌀ 79,3 (Striche 60 × 4,8 lang / 1,3 breit, rund, innen 34,9 / außen 39,65; Rest orange ab 12 Uhr im Uhrzeigersinn, Verstrichenes 28 % → Website),
// Restzeit „MM:SS“ 16,5 cqw Medium (Breite 45,8 % der Panelbreite), darüber Name (Vorlage „Step 2“, hier Timer-Name), darunter Gesamtdauer orange („1 MIN“, 3,5 cqw),
// Glas-Buttons: Timer-Glyphe oben links, ✕ unten links, Pause unten rechts (orange gefüllt). Orange #ff9230 = Website-Render (ref/site/overview/cooking/handoff, Kernpixel 255/146/48).
// KONFLIKT der Belege: der Website-Render (handoff) zeigt den Kranz als abgerundetes Quadrat ohne Buttons, alle drei Geräte-Videos einen Kreis mit Buttons → Kreis (Buttons passen nur dazu);
// Quadrat = RING auf [44.5, 16] stellen (onRR kann beides, Buttons müssten dann weichen). Pille „Step n of m“ der Vorlage = hier „Timer n von m“ bei mehreren Timern.
// Zeigt den nächsten laufenden HA-`timer.*` (aktive vor pausierten); Glyphe/Pille wechseln zwischen mehreren.
// Nicht in der Vorlage (nur Annahme): Tippen auf den Grund blendet aus, Timer-Kachel blendet wieder ein, bei Start/Ablauf erscheint er; ✕ = Abbrechen wie beim iOS-Timer.
// Eigene Ergänzung (User-Wunsch, keine Vorlage): Ausgeblendet schrumpft der Timer in eine Pille oben (wie die Dynamic Island),
// Tippen auf die Pille klappt ihn wieder auf; nach BACK ms ohne Berührung springt er von selbst zurück.
// Läuft dabei Musik, zeigt der Vollbild-Timer unten einen Mini-Player.
// Sprach-Timer (Assist, am Display gestartet) sind keine Entities: der Server schickt sie (voiceTimers) und sie laufen wie ein timer.*-Helper; angezeigt wird der nächste fällige.
const DEMO = !new URLSearchParams(location.search).has('live');
const sec = s => String(s || 0).split(':').reduce((a, v) => a * 60 + +v, 0);
const pad = n => String(n).padStart(2, '0');
const hms = t => { t = Math.max(0, Math.ceil(t)); const h = t / 3600 | 0; return (h ? h + ':' + pad(t / 60 % 60 | 0) : pad(t / 60 | 0)) + ':' + pad(t % 60); };   // Vorlage „09:55“ / „00:55“, ab 1 h „1:05:30“
const total = t => { t = Math.round(t); const h = t / 3600 | 0, m = t / 60 % 60 | 0, s = t % 60; return h ? `${h} STD${m ? ' ' + m + ' MIN' : ''}` : m ? `${m} MIN${s ? ' ' + s + ' SEK' : ''}` : t + ' SEK'; };
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n);
const spring = () => ({ duration: +css('--sd').replace('ms', '') || 640, easing: css('--spring') || 'ease-out' });

// Punkt + Außennormale auf abgerundetem Quadrat (halbe Kante h, Eckradius R) bei Anteil t des Umfangs, Start oben Mitte, im Uhrzeigersinn; R = h ergibt einen Kreis
function onRR(t, h, R) {
  const s = h - R, L = 2 * s + Math.PI * R / 2;
  let d = ((t * 4 * L + s) % (4 * L) + 4 * L) % (4 * L), x, y, nx, ny;
  const k = Math.floor(d / L); d -= k * L;
  if (d < 2 * s) [x, y, nx, ny] = [d - s, -h, 0, -1];
  else { const a = -Math.PI / 2 + (d - 2 * s) / R; [x, y, nx, ny] = [s + R * Math.cos(a), -s + R * Math.sin(a), Math.cos(a), Math.sin(a)]; }
  for (let i = 0; i < k; i++) [x, y, nx, ny] = [-y, x, -ny, nx];   // je Seite 90° weiterdrehen
  return [x, y, nx, ny];
}
// 60 Striche (Vorlage: 53 leuchten bei 00:53 von 1 MIN), Außenkante 39 + halbe Strichbreite = 39,65; Länge 3,5 + Rundkappen 1,3 = 4,8. Display = 100 = leuchtende PANELFLÄCHE (zT8 143 s: Panel x 685–1343 = 658 px, Ring 752–1273 = 79,3 %), nicht die Glasfläche
const N = 60, RING = [39, 39], TICKS = Array.from({ length: N }, (_, i) => {
  const [x, y, nx, ny] = onRR(i / N, ...RING), l = 3.5;
  return `<line x1="${(50 + x).toFixed(2)}" y1="${(50 + y).toFixed(2)}" x2="${(50 + x - nx * l).toFixed(2)}" y2="${(50 + y - ny * l).toFixed(2)}"/>`;
}).join('');

let VOICE = [], lastEnts = {};   // Sprach-Timer des Servers als timer.*-ähnliche Einträge
let T, P, M, call, voiceCall, sound, wake, pinned = false, cur = null, key = '', iv = 0, done = null, doneT = 0, hidden = false, sel = '', mp = null, mpKey = '', touch = Date.now(), run = [];
const BACK = 30000;
const canc = {};   // id → Zeitpunkt des ✕-Abbruchs (kurz vor Ablauf nicht als „abgelaufen“ melden)
const prev = {};   // letzter Zustand je Timer → Ablauf erkennen (active → idle, finishes_at erreicht)
// Timer-Symbol der Vorlage (Live Activity): offener Ring (Lücke oben, leicht links) + kurzer Zeiger nach oben links
const GLYPH = '<svg class="gl" viewBox="0 0 24 24"><path d="M12.7 4 A8 8 0 1 1 8.6 4.75"/><path d="M12 12 9.4 8.9"/></svg>';
const ico = (id, c = '') => `<svg class="i ${c}" viewBox="0 0 24 24"><use href="#${id}"/></svg>`;

// Klingelton bei Ablauf (synthetisch, 3 Pieptöne, alle 2,2 s wiederholt bis ✕/Tippen/60 s). Browser geben Ton erst nach einer Berührung frei → AudioContext bei jeder Berührung entsperren
let ac, ring = 0;
const unlock = () => { try { ac ||= new AudioContext(); if (ac.state !== 'running') ac.resume().catch(() => {}); } catch {} };
addEventListener('pointerdown', unlock, { capture: true, passive: true });
function beep(vol) {
  try {
    unlock(); if (ac?.state !== 'running') return;   // gesperrt: nicht einplanen (sonst spielen später alle aufgestauten Pieptöne)
    const t0 = ac.currentTime, out = ac.createGain(); out.gain.value = vol * .35; out.connect(ac.destination);
    for (let i = 0; i < 3; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), t = t0 + i * .28;
      o.type = 'sine'; o.frequency.value = 1046.5;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + .01); g.gain.setValueAtTime(1, t + .14); g.gain.linearRampToValueAtTime(0, t + .17);
      o.connect(g).connect(out); o.start(t); o.stop(t + .2);
    }
  } catch (e) { console.warn('Timer-Ton', e); }
}
// Kurzer aufsteigender Zweiklang als Hörbereit-Signal nach dem Wake Word (leiser als der Timer)
export function ping(vol) {
  try {
    if (!vol) return; unlock(); if (ac?.state !== 'running') return;
    const t0 = ac.currentTime, out = ac.createGain(); out.gain.value = vol * .2; out.connect(ac.destination);
    [784, 1175].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = t0 + i * .09;
      o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + .01); g.gain.linearRampToValueAtTime(0, t + .09);
      o.connect(g).connect(out); o.start(t); o.stop(t + .1);
    });
  } catch {}
}
const ringStop = () => { clearInterval(ring); ring = 0; };

// callFn: HA-Dienst (domain, service, data); voiceFn(id, 'pause'|'resume'|'cancel'): Sprach-Timer am Server (sind keine Entities)
// soundFn() → Lautstärke 0–1 (0 = stumm); wakeFn(): Bildschirmschoner beenden (sonst läge der Timer beim Rücksprung unter dem schwarzen Schoner)
export function timerInit(screen, callFn, voiceFn, soundFn, wakeFn) {
  call = callFn; voiceCall = voiceFn; sound = soundFn; wake = wakeFn;
  screen.insertAdjacentHTML('beforeend', `<div id="tmr"><svg class="ring" viewBox="0 0 100 100">${TICKS}</svg><span class="tn"></span><b class="tt"></b><span class="tl"></span>
    <button class="tb tbg" aria-label="Timer wechseln">${GLYPH}</button><button class="tof" hidden aria-label="Nächster Timer"><b></b><small></small></button>
    <button class="tb tx" aria-label="Abbrechen">${ico('x')}</button><button class="tb tp" aria-label="Pause">${ico('pause')}</button>
    <div class="tmp" hidden><i></i><span><b></b><small></small></span><button aria-label="Abspielen/Pause"><svg class="i" viewBox="0 0 24 24"><path/></svg></button></div></div>
    <button id="tpill" hidden>${GLYPH}<b></b><i hidden></i></button>`);
  T = screen.querySelector('#tmr'); P = screen.querySelector('#tpill'); M = T.querySelector('.tmp');
  const on = (el, fn) => el.addEventListener('click', e => { e.stopPropagation(); fn(); });
  T.addEventListener('click', () => done ? finishOff() : (hidden = true, show(false)));
  on(P, () => timerShow());
  on(T.querySelector('.tx'), () => done ? finishOff() : act(cur, 'cancel'));
  on(T.querySelector('.tp'), () => cur && !done && act(cur, cur.state === 'active' ? 'pause' : 'resume'));
  for (const b of ['.tbg', '.tof']) on(T.querySelector(b), () => done ? finishOff() : run.length > 1 ? next() : (hidden = true, show(false)));   // Glyphe/Pille: nächster Timer, bei nur einem ausblenden
  on(M.querySelector('button'), () => mp && call('media_player', 'media_play_pause', { entity_id: mp.entity_id }));
  new MutationObserver(guard).observe(screen, { attributes: true, attributeFilter: ['hidden'], subtree: true });   // Ansicht öffnet → sofort Pille
  for (const n of ['pointerdown', 'keydown']) addEventListener(n, () => touch = Date.now(), true);
  // Nichts los am Display → zurück zum Timer (nicht beim Anpassen, in offenen Ansichten oder während Assist)
  setInterval(() => {
    if (!hidden || !cur || done || Date.now() - touch < BACK || blocked()) return;
    wake?.(); timerShow();
  }, 1000);
}
// Ansicht offen (Licht, Klima, Kamera/Klingel …), Anpassen oder Assist: der Timer deckt sie nicht zu, er bleibt Pille
const blocked = () => { const s = T.parentElement; return /custom|gallery/.test(s.className) || !!s.querySelector('.view:not([hidden])') || !!s.querySelector('#assist')?.className; };
export function timerShow(id) { hidden = false; pinned = true; if (id && run.some(s => s.entity_id === id)) sel = id; key = ''; timers(lastEnts); }   // pinned: vom Nutzer geholt → auch über offene Ansichten
export const timerOn = () => !!T?._on;   // Vollbild sichtbar → kein Bildschirmschoner (bei schwarzem Schoner wäre der Timer sonst unsichtbar)

// Dienst je Timer: HA-timer.* oder Sprach-Timer (optimistisch lokal, der Server schickt danach den echten Stand)
function act(s, a) {
  if (!s) return;
  if (a === 'cancel') canc[s.entity_id] = Date.now();
  if (!s.entity_id.startsWith('voice.')) return call('timer', { cancel: 'cancel', pause: 'pause', resume: 'start' }[a], { entity_id: s.entity_id });
  const id = s.entity_id.slice(6), now = Date.now();
  VOICE = a === 'cancel' ? VOICE.filter(v => v.entity_id !== s.entity_id) : VOICE.map(v => v.entity_id !== s.entity_id ? v : a === 'pause'
    ? { ...v, state: 'paused', attributes: { ...v.attributes, remaining: hms(left(v)), finishes_at: undefined } }
    : { ...v, state: 'active', attributes: { ...v.attributes, finishes_at: new Date(now + sec(v.attributes.remaining) * 1000).toISOString() } });
  timers(lastEnts); voiceCall?.(id, a);
}
function next() {
  const i = run.findIndex(s => s.entity_id === cur.entity_id), n = run[(i + 1) % run.length];
  sel = n.entity_id; key = ''; timers(lastEnts);
}

// Rechteck der Pille relativ zum Screen als clip-path → Vollbild wächst aus der Pille bzw. schrumpft hinein
const pillClip = () => {
  const s = T.getBoundingClientRect(), r = P.getBoundingClientRect(), k = s.width / T.offsetWidth || 1;
  return `inset(${(r.top - s.top) / k}px ${(s.right - r.right) / k}px ${(s.bottom - r.bottom) / k}px ${(r.left - s.left) / k}px round ${r.height / 2 / k}px)`;
};
function pill(on) {
  if (!P.hidden === on) return;
  P.getAnimations().forEach(x => x.cancel()); P.style.opacity = '';
  if (on) { P.hidden = false; P.animate([{ opacity: 0, scale: '.5' }, { opacity: 1, scale: '1' }], spring()); }
  else P.hidden = true;
}
function show(on) {
  if (!!T._on === on) return;
  T._on = on; if (!on) pinned = false;
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

let skew = 0;   // HA-Uhr minus Display-Uhr (ms): Tablets ohne NTP gehen oft Sekunden falsch → Restzeit aus finishes_at stimmt sonst nicht; gemessen beim Start eines Timers (Zustandswechsel kommt sofort)
const left = s => s.state === 'active' ? (Date.parse(s.attributes.finishes_at) - Date.now() - skew) / 1000 : sec(s.attributes.remaining ?? s.attributes.duration);
// Strich i (ab 12 Uhr im Uhrzeigersinn) leuchtet, solange er im Rest-Anteil liegt
const ticks = f => T.querySelectorAll('line').forEach((l, i) => l.classList.toggle('on', i < Math.ceil(f * N - .001)));
const name = s => s.attributes.friendly_name || 'Timer';
const setIco = (b, id) => { const u = b.querySelector('use'); if (u.getAttribute('href') !== '#' + id) u.setAttribute('href', '#' + id); };

// Ansicht (z. B. Klingel) geöffnet → Vollbild-Timer wird Pille, in Ansichten klein, damit er deren Titel nicht verdeckt
function guard() {
  if (T._on && !done && !pinned && blocked()) { hidden = true; show(false); }
}

// zeichnet und plant sich selbst zur nächsten Sekundengrenze (kein Versatz zwischen Zifferwechsel und Restzeit)
function draw() {
  clearTimeout(iv); iv = 0;
  if (!cur) return;
  guard();
  const r = left(cur);
  if (DEMO && cur.state === 'active' && r <= 0) call('timer', 'finish', { entity_id: cur.entity_id });   // HA macht das selbst
  const f = Math.min(1, Math.max(0, r) / (sec(cur.attributes.duration) || 1));
  rollTxt(T.querySelector('.tt'), hms(r));
  T.classList.toggle('tlong', r > 3599.5);
  ticks(f);
  P.querySelector('b').textContent = hms(r);
  P.classList.toggle('pa', cur.state === 'paused');
  const tp = T.querySelector('.tp'); setIco(tp, cur.state === 'paused' ? 'play' : 'pause'); tp.ariaLabel = cur.state === 'paused' ? 'Fortsetzen' : 'Pause';
  iv = setTimeout(draw, cur.state === 'active' && r > 0 ? ((r % 1) || 1) * 1000 + 15 : 500);
}

// Aus index.html bei jedem render(); true = ein Timer ist gerade abgelaufen oder von außen gestartet worden (Aufrufer weckt das Display, auch bei schwarzem Schoner)
export function timers(ents) {
  if (!T) return false;
  lastEnts = ents;
  const now = Date.now(), list = [...Object.values(ents).filter(s => s.entity_id.startsWith('timer.')), ...VOICE];
  let fin = false;
  for (const s of list) {
    const p = prev[s.entity_id];
    const lt = s.attributes.last_transition;   // HA: 'finished' | 'cancelled' (Uhr des Displays kann gegenüber HA abweichen → nicht allein auf finishes_at verlassen)
    if (p?.state === 'active' && s.state === 'idle' && (lt ? lt === 'finished' : Date.parse(p.attributes.finishes_at) <= now + 2000) && now - (canc[s.entity_id] || 0) > 5000) { finished(s); fin = true; }
    if (p && p.state !== s.state && s.last_changed && !s.entity_id.startsWith('voice.')) { const d = Date.parse(s.last_changed) - now; skew = Math.abs(d) > 1500 ? d : 0; }
    if (p && p.state === 'idle' && s.state === 'active') { hidden = false; sel = s.entity_id; fin = true; }   // neu gestartet → zeigen
    prev[s.entity_id] = s;
  }
  run = list.filter(s => s.state === 'active' || s.state === 'paused').sort((a, b) => a.entity_id < b.entity_id ? -1 : 1);
  cur = run.find(s => s.entity_id === sel) || [...run].sort((a, b) => (b.state === 'active') - (a.state === 'active') || left(a) - left(b))[0] || null;   // gewählter, sonst aktiver mit der kürzesten Restzeit
  sel = cur?.entity_id || '';   // Anzeige bleibt beim Timer (springt nicht bei Pause oder Zeitvergleich); neu gestartete übernehmen sie
  const n = P.querySelector('i'); n.hidden = run.length < 2; n.textContent = '+' + (run.length - 1);   // weitere laufende Timer
  const o = T.querySelector('.tof'), k = cur ? run.indexOf(cur) + 1 : 0;
  o.hidden = run.length < 2 || !!done; o.firstChild.textContent = 'Timer ' + k; o.lastChild.textContent = ' von ' + run.length;
  if (done) return fin;
  if (!cur) { key = ''; clearInterval(iv); iv = 0; pill(false); show(false); return fin; }
  guard(); const vis = !hidden && (pinned || !blocked()); show(vis); if (!vis && !T.getAnimations().length) pill(true);
  const a = cur.attributes, kk = cur.entity_id + cur.state + a.finishes_at + a.remaining + a.duration;
  if (kk === key) return fin;
  key = kk;
  T.querySelector('.tn').textContent = name(cur);
  T.querySelector('.tl').textContent = total(sec(a.duration));
  draw();
  return fin;
}

// list: laufende/pausierte Sprach-Timer {id, name, total, left, active} (left in s ab jetzt); fin: gerade abgelaufener {id, total}; true = neu oder abgelaufen
export function voiceTimers(list, fin) {
  const now = Date.now(), old = VOICE, ids = old.map(s => s.entity_id);
  VOICE = (list || []).map(t => ({ entity_id: 'voice.' + t.id, state: t.active ? 'active' : 'paused',
    attributes: { friendly_name: t.name || undefined, duration: hms(t.total), remaining: hms(t.left), finishes_at: t.active ? new Date(now + t.left * 1000).toISOString() : undefined } }));
  const neu = VOICE.filter(s => !ids.includes(s.entity_id));
  if (neu.length) { hidden = false; sel = neu[0].entity_id; }   // neu gestartet → zeigen
  timers(lastEnts);
  // abgelaufen: Server meldet es (fin) oder ein aktiver verschwindet nach Ablaufzeit ohne Meldung (Verbindung war weg)
  const over = old.filter(o => o.state === 'active' && Date.parse(o.attributes.finishes_at) <= now && !VOICE.some(v => v.entity_id === o.entity_id));
  const d = fin ? old.find(s => s.entity_id === 'voice.' + fin.id)?.attributes : over[0]?.attributes;
  if (T && (fin || over.length)) finished({ entity_id: fin ? 'voice.' + fin.id : over[0].entity_id, attributes: { duration: fin ? hms(fin.total) : d.duration, friendly_name: d?.friendly_name } });
  return neu.length > 0 || !!fin || over.length > 0;   // Aufrufer weckt das Display
}

function finished(s) {
  done = s; clearInterval(iv); iv = 0; key = '';
  T.classList.add('fin');
  T.querySelector('.tn').textContent = 'Zeit abgelaufen';
  T.querySelector('.tl').textContent = total(sec(s.attributes.duration));
  rollTxt(T.querySelector('.tt'), '00:00'); T.classList.remove('tlong'); ticks(0); pill(false); T.querySelector('.tof').hidden = true; show(true);
  clearTimeout(doneT); doneT = setTimeout(finishOff, 60000);
  ringStop(); const v = sound?.(); if (v) { beep(v); ring = setInterval(() => beep(v), 2200); }
}
function finishOff() {
  done = null; clearTimeout(doneT); ringStop(); key = ''; T.classList.remove('fin');
  if (cur) hidden = true;   // weitere Timer laufen: als Pille weiter, nicht gleich wieder Vollbild
  show(false); timers(lastEnts);
}

// Demo: Timer-Services wie HA (start/pause/cancel/finish)
export function timerDemo(service, s) {
  const a = s.attributes, now = Date.now();
  if (service === 'start') { const r = s.state === 'paused' ? sec(a.remaining) : sec(a.duration); return ['active', { finishes_at: new Date(now + r * 1000).toISOString(), remaining: hms(r) }]; }
  if (service === 'pause') return ['paused', { remaining: hms(left(s)), finishes_at: undefined }];
  return ['idle', { remaining: a.duration, finishes_at: undefined }];
}

document.head.insertAdjacentHTML('beforeend', `<style>
#tmr{--to:#ff9230;position:absolute;inset:0;z-index:19;display:none;place-content:center;justify-items:center;gap:2.9cqw;padding-bottom:3.3cqw;background:#000;color:#fff;font-variant-numeric:tabular-nums}
#tmr.on{display:grid}
#tmr>svg.ring{position:absolute;inset:0;width:100%;height:100%}
#tmr line{stroke:var(--to);stroke-width:1.3;stroke-linecap:round;opacity:.28;transition:opacity .4s}
#tmr line.on{opacity:1}
#tmr .tn{font-size:3.7cqw;font-weight:500;line-height:1;padding-bottom:.9cqw;margin-bottom:-.9cqw;color:#ffffffd9;max-width:50cqw;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#tmr .tt{display:flex;font-size:16.5cqw;font-weight:500;letter-spacing:-.01em;line-height:1}
#tmr.tlong .tt{font-size:13cqw}
#tmr .ch{display:inline-grid;overflow:hidden}#tmr .ch>i{grid-area:1/1;font-style:normal}
#tmr .tl{color:var(--to);font-size:3.5cqw;font-weight:600;line-height:1}
#tmr :is(.tn,.tt,.tl){transition:translate var(--sd) var(--spring)}
#tmr.mu :is(.tn,.tt,.tl){translate:0 -9cqw}
#tmr.fin .tt{animation:tpa 1.2s ease-in-out infinite}
#tmr.fin .tp{display:none}
/* Buttons: Glas-Kreise (Vorlage: dunkel, ✕ weiß, Pause orange gefüllt mit dunklem Symbol); Glyphe oben links wie das ✕ der übrigen Vollbilder (⌀ 8,75, Mitte 10,4 / 10,2) */
#tmr .tb{position:absolute;display:grid;place-items:center;border-radius:50%;background:#ffffff1c;color:#fff;transition:scale .25s}
#tmr .tb:active{scale:.9;transition:scale .12s ease-out}
#tmr .tbg{left:6.1cqw;top:5.9cqw;width:9cqw;height:9cqw;color:var(--to)}
#tmr .gl{width:5.6cqw;height:5.6cqw;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
#tmr .tx{left:4.6cqw;bottom:6cqw;width:14.4cqw;height:14.4cqw;font-size:5.9cqw}
#tmr .tp{right:4.7cqw;bottom:6cqw;width:14.4cqw;height:14.4cqw;font-size:5.9cqw;background:var(--to);color:#000c}
#tmr .tp svg{width:1em;height:1em}
/* Pille „Timer n von m“ oben mittig (Vorlage „Step 5 of 12“: Glas-Pille 14,8 × 3,5 cqw, n weiß fett, Rest grau) */
#tmr .tof{position:absolute;top:2.2cqw;left:50%;translate:-50% 0;height:3.7cqw;padding:0 1.4cqw;border-radius:2cqw;background:#ffffff1a;font-size:1.95cqw;font-weight:600;white-space:nowrap;display:flex;align-items:center;transition:scale .25s}
#tmr .tof small{font-size:inherit;font-weight:500;color:#ffffff99;white-space:pre}
#tmr .tof::before{content:"";position:absolute;inset:-3cqw -2cqw}   /* Tippfläche größer als die kleine Pille */
#tmr .tof:active{scale:.94;transition:scale .12s ease-out}
/* Pille oben, Maße wie die .top-Zeile (5.6cqw) mittig */
#tpill{position:absolute;z-index:18;top:2.1cqw;left:50%;translate:-50% 0;display:flex;align-items:center;gap:.8cqw;height:3.8cqw;padding:0 1.6cqw 0 .9cqw;
  border-radius:2cqw;background:#000;color:#ff9230;font-size:2.2cqw;font-weight:600;font-variant-numeric:tabular-nums;
  box-shadow:0 .4cqw 1.6cqw #0007,inset 0 0 0 .12cqw #ff92304d;transition:scale .25s}
#tpill::before{content:"";position:absolute;inset:-3cqw -2cqw}   /* Tippfläche größer als die kleine Pille */
#tpill i{font-style:normal;font-size:1.7cqw;padding:.3cqw .7cqw;margin-right:-.7cqw;border-radius:1.2cqw;background:#ff92302e}
#tpill:active{scale:.94;transition:scale .12s ease-out}
#tpill .gl{width:2.6cqw;height:2.6cqw;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round}
#tpill.pa b{animation:tpa 1.6s ease-in-out infinite}
@keyframes tpa{50%{opacity:.35}}
/* Mini-Player im Timer: Glas-Zeile innerhalb des Strichkranzes (Innenradius 30,7), unter der Gesamtdauer */
#tmr .tmp{position:absolute;left:50%;translate:-50% 0;top:58.5cqw;width:42cqw;display:flex;align-items:center;gap:2cqw;padding:1.4cqw 1.4cqw 1.4cqw 1.4cqw;
  border-radius:3.6cqw;background:#ffffff17;box-shadow:inset 0 .15cqw .1cqw #ffffff22}
#tmr .tmp>i{flex:none;width:8cqw;height:8cqw;border-radius:1.8cqw;background:#ffffff26 center/cover}
#tmr .tmp>span{flex:1;min-width:0;display:grid;gap:.4cqw;font-size:2.9cqw;line-height:1.2;text-align:left}
#tmr .tmp :is(b,small){overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#tmr .tmp small{color:#ebebf599;font-size:2.6cqw}
#tmr .tmp button{flex:none;width:7.4cqw;height:7.4cqw;border-radius:50%;display:grid;place-items:center;font-size:4cqw;color:#fff;transition:scale .25s}
#tmr .tmp button:active{scale:.88;transition:scale .12s ease-out}
#tmr .tmp path{stroke-width:2.6}#tmr .tmp path.pl{fill:currentColor;stroke-width:1.5}
</style>`);
