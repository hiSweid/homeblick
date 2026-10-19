// Wanddisplay-Verhalten im Browser: Idle-Screensaver, Nacht-Dimmen, Display wach halten, Face per #<typ>.
// Einstellungen: CONF.kiosk = { idle: Sekunden (0 = aus), saver: Face-Typ, dim: { from: 'HH:MM', to: 'HH:MM', level: 0–1 } | null, wake: Modellname | null }
export const KIOSK_DEF = { idle: 300, saver: 'bigclock', dim: null, wake: null, bright: 1 };   // wake: 'hey_jarvis_v0.1' | 'alexa_v0.1' | null (Mikrofon dauerhaft offen → nur auf Wunsch)

const mins = s => { const [h, m] = s.split(':'); return h * 60 + +m; };
export const inWindow = (now, from, to) => from <= to ? now >= from && now < to : now >= from || now < to;   // über Mitternacht erlaubt

// faces: Scroll-Container, conf: () => CONF, busy: () => Bearbeiten/Vollbild/Assist aktiv, touched: () => letzte Berührung (ms),
// onState({ face, saver }) bei Änderung (Meldung an HA)
export function kioskInit({ faces, conf, busy, touched, onState }) {
  const cfg = () => ({ ...KIOSK_DEF, ...conf().kiosk });
  const idx = () => Math.round(faces.scrollLeft / faces.clientWidth);
  const goto = (i, behavior = 'smooth') => faces.scrollTo({ left: i * faces.clientWidth, behavior });
  let last = Date.now(), back = -1, st = {};   // back = Face vor dem Screensaver

  // Display wach halten (braucht https/localhost; unter http gibt es kein wakeLock → still ignorieren)
  const lock = () => navigator.wakeLock?.request('screen').catch(() => {});
  lock(); document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && lock());

  // Dimmen/Helligkeit: schwarze Folie; Tippen hellt für 30 s auf
  const veil = Object.assign(document.createElement('div'), { style: 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:99;opacity:0;transition:opacity 1.5s' });
  document.body.append(veil);

  // Erster Tipp aus dem Screensaver weckt nur (Capture, damit er die Kacheln nicht erreicht)
  const wake = () => { last = Date.now(); if (back < 0) return false; goto(back); back = -1; return true; };
  document.addEventListener('pointerdown', e => { if (wake()) { e.stopPropagation(); e.preventDefault(); } }, true);

  const saver = () => faces.children.length && [...faces.children].findIndex(f => f.classList.contains('f-' + cfg().saver));

  const sleep = () => { const s = saver(); if (back < 0 && s >= 0 && s !== idx()) { back = idx(); goto(s); } };

  setInterval(() => {
    const { idle, dim, bright } = cfg(), now = new Date();
    if (idle && back < 0 && !busy() && Date.now() - Math.max(last, touched()) > idle * 1000) {
      sleep();
    }
    const face = faces.children[idx()]?.className.match(/f-(\w+)/)?.[1] ?? null;
    if (onState && (face !== st.face || (back >= 0) !== st.saver)) onState(st = { face, saver: back >= 0 });
    const d = dim && inWindow(now.getHours() * 60 + now.getMinutes(), mins(dim.from), mins(dim.to)) && Date.now() - last > 30000;
    veil.style.opacity = 1 - (1 - (d ? dim.level ?? .8 : 0)) * (bright ?? 1);   // Helligkeit = Software-Folie (Browser kann die Hardware nicht steuern)
  }, 1000);

  // Face per URL-Fragment (z. B. HA-Automation / Dashboard-Link): #music, #bigclock …
  const byHash = () => { const i = [...faces.children].findIndex(f => f.classList.contains('f-' + location.hash.slice(1))); if (i >= 0) goto(i); };
  addEventListener('hashchange', byHash); if (location.hash) byHash();
  return { wake, sleep, report: () => onState?.(st) };   // wake: Screensaver beenden (Wake Word, HA-Befehl), sleep: sofort starten, report: Zustand erneut melden
}

// Selbsttest: node kiosk.js
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('kiosk.js')) {
  const a = (n, f, t) => console.assert(inWindow(n, mins(f), mins(t)), `${n} in ${f}-${t}`);
  a(23 * 60, '22:00', '06:00'); a(5 * 60, '22:00', '06:00'); a(12 * 60, '08:00', '18:00');
  console.assert(!inWindow(12 * 60, mins('22:00'), mins('06:00'))); console.assert(!inWindow(7 * 60, mins('22:00'), mins('06:00')));
  console.log('ok');
}
