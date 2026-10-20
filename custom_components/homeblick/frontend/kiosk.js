// Wanddisplay-Verhalten im Browser: Idle-Screensaver, Nacht-Dimmen, Display wach halten, Face per #<typ>.
// Einstellungen: CONF.kiosk = { idle: Sekunden (0 = aus), saver: Face-Typ, dim: { from: 'HH:MM', to: 'HH:MM', level: 0–1 } | null, wake: Modellname | null }
export const KIOSK_DEF = { idle: 300, saver: 'bigclock', dim: null, wake: null, bright: 1 };   // wake: 'hey_jarvis_v0.1' | 'alexa_v0.1' | null (Mikrofon dauerhaft offen → nur auf Wunsch)

const mins = s => { const [h, m] = s.split(':'); return h * 60 + +m; };
export const inWindow = (now, from, to) => from <= to ? now >= from && now < to : now >= from || now < to;   // über Mitternacht erlaubt

// faces: Scroll-Container, conf: () => CONF, busy: () => Bearbeiten/Vollbild/Assist aktiv, touched: () => letzte Berührung (ms),
// onState({ face, saver }) bei Änderung (Meldung an HA), music: () => läuft Musik (dann Musik-Face statt Schoner, Einstellung „music“)
export function kioskInit({ faces, conf, busy, touched, onState, music }) {
  const cfg = () => ({ ...KIOSK_DEF, ...conf().kiosk });
  const idx = () => Math.round(faces.scrollLeft / (faces.clientWidth * 1.025));
  const goto = (i, behavior = 'smooth') => faces.go(i, behavior !== 'smooth');
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
  const wake = () => { last = Date.now(); if (back < 0) return false; goto(back); back = -1; return true; };
  document.addEventListener('pointerdown', e => { lock(); if (wake()) { e.stopPropagation(); e.preventDefault(); } }, true);

  const find = t => [...faces.children].findIndex(f => f.classList.contains('f-' + t));
  const saver = () => { const m = cfg().music !== false && music?.() ? find('music') : -1; return m >= 0 ? m : find(cfg().saver); };

  const sleep = () => { const s = saver(); if (back < 0 && s >= 0 && s !== idx()) { back = idx(); goto(s); } };

  setInterval(() => {
    const { idle, dim, bright } = cfg(), now = new Date();
    if (idle && back < 0 && !busy() && Date.now() - Math.max(last, touched()) > idle * 1000) {
      sleep();
    } else if (back >= 0 && !busy()) {   // im Schoner: Musik startet/endet → passendes Face
      const s = saver(); if (s >= 0 && s !== idx()) goto(s);
    }
    const face = faces.children[idx()]?.className.match(/f-(\w+)/)?.[1] ?? null;
    if (onState && (face !== st.face || (back >= 0) !== st.saver)) onState(st = { face, saver: back >= 0 });
    const d = dim && inWindow(now.getHours() * 60 + now.getMinutes(), mins(dim.from), mins(dim.to)) && Date.now() - last > 30000;
    veil.style.opacity = 1 - (1 - (d ? dim.level ?? .8 : 0)) * (bright ?? 1);   // Helligkeit = Software-Folie (Browser kann die Hardware nicht steuern)
  }, 1000);

  // Face per URL-Fragment (z. B. HA-Automation / Dashboard-Link): #music, #bigclock …
  // Gewähltes Face beendet den Screensaver (sonst holt ihn der Schoner-Tick zurück)
  const show = t => { const i = find(t); if (i < 0) return; back = -1; last = Date.now(); goto(i); };
  const byHash = () => show(location.hash.slice(1));
  addEventListener('hashchange', byHash); if (location.hash) byHash();
  return { wake, sleep, show, report: () => onState?.(st), wakeLock: () => !!wl && !wl.released };   // wake: Screensaver beenden (Wake Word, HA-Befehl), sleep: sofort starten, show: Face zeigen (HA-Befehl), report: Zustand erneut melden
}

// Selbsttest: node kiosk.js
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('kiosk.js')) {
  const a = (n, f, t) => console.assert(inWindow(n, mins(f), mins(t)), `${n} in ${f}-${t}`);
  a(23 * 60, '22:00', '06:00'); a(5 * 60, '22:00', '06:00'); a(12 * 60, '08:00', '18:00');
  console.assert(!inWindow(12 * 60, mins('22:00'), mins('06:00'))); console.assert(!inWindow(7 * 60, mins('22:00'), mins('06:00')));
  console.log('ok');
}
