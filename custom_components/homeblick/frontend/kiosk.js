// Wanddisplay-Verhalten im Browser: Idle-Screensaver, Nacht-Dimmen, Display wach halten, Face per #<typ>.
// Einstellungen: CONF.kiosk = { idle: Sekunden (0 = aus), saver: Face-Typ, dim: { from: 'HH:MM', to: 'HH:MM', level: 0–1 } | null, black: Schoner = 100 % schwarz statt Face, hold: true = Schoner startet nicht, sched: { from, to } | null (im Fenster startet der Schoner nach 30 s, auch bei idle 0), wake: Modellname | null }
import { siblings } from './faces.js';
export const KIOSK_DEF = { idle: 300, saver: 'bigclock', black: false, sched: null, dim: null, wake: null, bright: 1, hold: false, kz: true };   // wake: 'hey_jarvis_v0.1' | 'alexa_v0.1' | null (Mikrofon dauerhaft offen → nur auf Wunsch)

export const mins = s => { const [h, m] = s.split(':'); return h * 60 + +m; };
export const inWindow = (now, from, to) => from <= to ? now >= from && now < to : now >= from || now < to;   // über Mitternacht erlaubt

// faces: Scroll-Container, conf: () => CONF, busy: () => Bearbeiten/Vollbild/Assist aktiv, touched: () => letzte Berührung (ms),
// onState({ face, saver }) bei Änderung (Meldung an HA), music: () => läuft Musik (dann Musik-Face statt Schoner, Einstellung „music“)
export const luxLevel = lx => Math.min(1, .3 + .7 * Math.log10(1 + Math.max(0, lx)) / Math.log10(301));   // Lux → Helligkeitsfaktor: ≤0 lx 30 %, ab 300 lx 100 % (logarithmisch wie das Auge)

export function kioskInit({ faces, conf, busy, touched, onState, music, lux }) {
  const cfg = () => ({ ...KIOSK_DEF, ...conf().kiosk });
  const idx = () => Math.round(faces.scrollLeft / (faces.clientWidth * 1.025));
  const goto = (i, behavior = 'smooth') => faces.go(i, behavior !== 'smooth');
  // Inhaltswechsel durch den Schoner/Musikstart: ≈ 0,5 s Blur-Überblendung statt Federwisch (NOTIZEN §6); ohne View-Transition-API wie bisher
  const fade = i => {
    if (!document.startViewTransition) return goto(i);
    const r = document.documentElement; r.classList.add('vt-blur');
    document.startViewTransition(() => goto(i, 'instant')).finished.catch(() => {}).finally(() => r.classList.remove('vt-blur'));
  };
  let last = Date.now(), back = -1, st = {};   // back = Face vor dem Screensaver

  // Display wach halten (braucht https/localhost; unter http gibt es kein wakeLock → still ignorieren)
  // System gibt die Sperre frei (Energiesparen, Tab-Wechsel) → bei Sichtbarkeit neu anfordern; Tippen versucht es erneut
  let wl, req;
  const lock = () => {
    if (req || (wl && !wl.released) || document.visibilityState !== 'visible' || !navigator.wakeLock) return;
    req = navigator.wakeLock.request('screen').then(l => { wl = l; l.addEventListener('release', () => setTimeout(lock, 1000)); })
      .catch(() => {}).finally(() => req = null);
  };
  lock(); document.addEventListener('visibilitychange', lock);

  // Dimmen/Helligkeit: schwarze Folie; Tippen hellt für 30 s auf
  const veil = Object.assign(document.createElement('div'), { style: 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:99;opacity:0;transition:opacity 1.5s' });
  document.body.append(veil);

  // Erster Tipp aus dem Screensaver weckt nur (Capture, damit er die Kacheln nicht erreicht)
  const wake = () => { last = Date.now(); if (back < 0) return false; goto(back); back = -1; veil.style.opacity = 0; return true; };
  document.addEventListener('pointerdown', e => { lock(); if (wake()) { e.stopPropagation(); e.preventDefault(); } }, true);

  const at = t => [...faces.children].findIndex(f => f.classList.contains('f-' + t));
  const find = t => { const i = at(t); return i >= 0 ? i : Math.max(-1, ...(siblings(t)).map(at)); };   // Uhr/Kalender gibt es nur einmal, egal in welchem Design
  const saver = () => {
    const m = cfg().music !== false && music?.() ? find('music') : -1; if (m >= 0) return m;
    const i = find(cfg().saver);
    return i >= 0 ? i : Math.max(find('bigclock'), find('analog'));   // Schoner-Face ausgeschaltet (Face-Liste) → Uhr, sonst läuft kein Schoner
  };

  const sleep = () => {
    if (back >= 0) return;
    if (cfg().black) { back = idx(); return; }
    const s = saver(); if (s >= 0 && s !== idx()) { back = idx(); fade(s); }
  };

  setInterval(() => {
    const { idle: idle0, black, sched, hold } = cfg(), now = new Date(), min = now.getHours() * 60 + now.getMinutes();
    const idle = sched && inWindow(min, mins(sched.from), mins(sched.to)) ? 30 : idle0;
    if (idle && !hold && back < 0 && !busy() && Date.now() - Math.max(last, touched()) > idle * 1000) {
      sleep();
    } else if (back >= 0 && !busy() && !black) {   // im Schoner: Musik startet/endet → passendes Face
      const s = saver(); if (s >= 0 && s !== idx()) fade(s);
    }
    const face = faces.children[idx()]?.className.match(/f-(\w+)/)?.[1] ?? null;
    if (onState && (face !== st.face || (back >= 0) !== st.saver)) onState(st = { face, saver: back >= 0 });
    paint();
  }, 1000);
  // Helligkeit = Software-Folie (Browser kann die Hardware nicht steuern); ms = Überblendzeit (Kontrollzentrum-Regler: kurz, damit der Finger Wirkung sieht)
  function paint(ms = 1500) {
    const { dim, bright, black } = cfg(), now = new Date(), min = now.getHours() * 60 + now.getMinutes();
    const d = dim && inWindow(min, mins(dim.from), mins(dim.to)) && Date.now() - last > 30000;
    veil.style.transitionDuration = ms + 'ms';
    veil.style.opacity = back >= 0 && black ? 1 : 1 - (1 - (d ? dim.level ?? .8 : 0)) * (bright ?? 1) * (lux?.() ?? 1);
  }

  // Face per URL-Fragment (z. B. HA-Automation / Dashboard-Link): #music, #bigclock …
  // Gewähltes Face beendet den Screensaver (sonst holt ihn der Schoner-Tick zurück)
  const show = t => { const i = find(t); if (i < 0) return; back = -1; last = Date.now(); goto(i); };
  const byHash = () => show(location.hash.slice(1));
  addEventListener('hashchange', byHash); if (location.hash) byHash();
  return { wake, sleep, show, paint, report: () => onState?.(st), wakeLock: () => !!wl && !wl.released };   // wake: Screensaver beenden (Wake Word, HA-Befehl), sleep: sofort starten, show: Face zeigen (HA-Befehl), report: Zustand erneut melden
}

// Selbsttest: node kiosk.js
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('kiosk.js')) {
  const a = (n, f, t) => console.assert(inWindow(n, mins(f), mins(t)), `${n} in ${f}-${t}`);
  a(23 * 60, '22:00', '06:00'); a(5 * 60, '22:00', '06:00'); a(12 * 60, '08:00', '18:00');
  console.assert(!inWindow(12 * 60, mins('22:00'), mins('06:00'))); console.assert(!inWindow(7 * 60, mins('22:00'), mins('06:00')));
  console.log('ok');
}
