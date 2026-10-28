// Verbindungswächter: Offline-Pille oben, abgedunkelte Kacheln, Ping gegen halboffene Sockets, Selbstheilung per Reload.
// Die Bibliothek meldet „disconnected“ nur bei sauberem Abbruch; ein WLAN-Wechsel oder Router-Neustart hinterlässt oft einen toten Socket ohne Meldung
// → alle PING_MS ein Ping (Timeout PING_TO); scheitert er, gilt das Display als offline und der Socket wird neu aufgebaut (die Bibliothek verbindet dann selbst).
// Dienstaufrufe während des Ausfalls werden vom Aufrufer verworfen (call() in index.html), sonst feuerte ein alter Tipp (Schloss, Rollladen) Minuten später.
import { tx, LOC } from './i18n.js';
export const PING_MS = 20000, PING_TO = 10000;
export const SHOW_AFTER = 4000;          // Pille erst nach 4 s: kurze Aussetzer (Reconnect) sollen nicht aufblitzen
export const RELOAD_AFTER = 180000;      // so lange offline, obwohl der Server per HTTP antwortet → Seite neu laden
export const RELOAD_GAP = 600000;        // höchstens ein Neuladen pro 10 min (keine Schleife)
export const NIGHT_GAP = 20 * 3600000;   // Nachtneustart höchstens einmal je Nacht
export const NIGHT_IDLE = 300000;        // … und nur nach 5 min ohne Berührung

// Reine Entscheidungen (Selbsttest unten); since = Beginn des Ausfalls (ms) oder null
export const bannerDue = (since, now) => since != null && now - since >= SHOW_AFTER;
export const reloadDue = (since, now, last) => since != null && now - since >= RELOAD_AFTER && now - last >= RELOAD_GAP;
export const nightDue = (now, last, inSched, idleMs) => inSched && idleMs >= NIGHT_IDLE && now - last >= NIGHT_GAP;

const hm = t => new Date(t).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' });
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n);
const spring = () => ({ duration: +css('--sd').replace('ms', '') || 640, easing: css('--spring') || 'ease-out' });
const KEY = 'hbReloadAt';   // sessionStorage: überlebt das Neuladen, so greifen die Bremsen auch danach
const lastReload = () => { try { return +sessionStorage.getItem(KEY) || 0; } catch { return 0; } };
const reload = () => { try { sessionStorage.setItem(KEY, Date.now()); } catch {} location.reload(); };

// screen: #screen mit #hud; conn: HA-Verbindung; opts.down(bool): Zustand an die Seite (Musik-Face „Keine Verbindung“),
// opts.canReload: false im HA-Panel und in Kiosk Satellite (dort gehört die Seite dem Wirt), opts.night(): im Ruhefenster, opts.idle(): ms seit letzter Berührung
export function netwatchInit(screen, conn, { down: onDown, canReload = true, night = () => false, idle = () => 0 } = {}) {
  const hud = screen.querySelector('#hud');
  hud.insertAdjacentHTML('beforeend', `<div id="net" hidden><svg class="i" viewBox="0 0 24 24"><path d="M2.5 9.2a14 14 0 0 1 19 0M5.6 12.7a9.5 9.5 0 0 1 12.8 0M8.8 16.2a5 5 0 0 1 6.4 0"/><circle cx="12" cy="19.4" r=".9" fill="currentColor"/><path d="M3.5 3.5l17 17"/></svg><span></span></div>`);
  const el = hud.querySelector('#net'), txt = el.querySelector('span');
  let since = null, shown = false, probing = false, tick = 0, lib = false;   // lib: Bibliothek weiß vom Abbruch und baut selbst wieder auf

  const paint = () => {
    const on = bannerDue(since, Date.now());
    if (on) txt.innerHTML = `${tx('Keine Verbindung')} <small>${tx('seit {t}', { t: hm(since) })}</small>`;
    if (on === shown) return;
    shown = on; screen.classList.toggle('offline', on);
    el.getAnimations().forEach(a => a.cancel());
    if (on) { el.hidden = false; el.animate([{ opacity: 0, scale: '.6', translate: '0 -1.5cqw' }, { opacity: 1, scale: '1', translate: '0 0' }], spring()); }
    else el.animate([{ opacity: 1, scale: '1' }, { opacity: 0, scale: '.8' }], { duration: 220, easing: 'ease-in' }).onfinish = () => { if (!shown) el.hidden = true; };
  };
  const set = d => {
    if (d === (since != null)) return;
    since = d ? Date.now() : null; onDown?.(d); paint();
  };

  conn.addEventListener('disconnected', () => { lib = true; set(true); });
  conn.addEventListener('ready', () => { lib = false; set(false); });

  // Ping nur im Vordergrund und nur, solange die Bibliothek nichts vom Abbruch weiß (sonst verbindet sie ohnehin selbst)
  const probe = async () => {
    if (probing || lib || document.hidden) return;
    probing = true;
    try { await Promise.race([conn.ping(), new Promise((_, no) => setTimeout(no, PING_TO))]); set(false); }
    catch { set(true); try { conn.socket.close(); } catch {} }   // toter Socket: schließen löst den Wiederaufbau aus
    finally { probing = false; }
  };
  const heal = async () => {
    if (!canReload) return;
    const now = Date.now(), last = lastReload();
    // Ausfall dauert, der Server antwortet aber → die Seite selbst hängt (alte Sitzung, abgelaufene Auth): neu laden; ohne Netz nicht (Seite bliebe leer)
    if (reloadDue(since, now, last) || (since == null && nightDue(now, last, night(), idle()))) {
      try { if ((await fetch(location.href, { cache: 'no-store' })).ok) reload(); } catch {}
    }
  };
  setInterval(() => { paint(); heal(); if (++tick % (PING_MS / 1000) === 0) probe(); }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) probe(); });   // nach Schlaf/Weckruf ist der Socket oft tot
  addEventListener('online', probe);
  addEventListener('offline', () => set(true));
  return { down: () => since != null };
}

if (typeof document !== 'undefined') document.head.insertAdjacentHTML('beforeend', `<style>
#net{display:flex;align-items:center;gap:1.1cqw;height:5cqw;padding:0 2.3cqw 0 1.6cqw;border-radius:2.5cqw;background:#1c1c1eeb;color:#fff;font-size:2.4cqw;font-weight:600;line-height:1;white-space:nowrap;
  box-shadow:0 .4cqw 1.6cqw #0007,inset 0 0 0 .12cqw #ffffff2e;pointer-events:none}
#net svg{width:3.3cqw;height:3.3cqw;color:#ff9f0a;animation:netp 2.4s ease-in-out infinite}
#net small{font-size:inherit;font-weight:500;color:#ffffff99}
@keyframes netp{50%{opacity:.4}}
@keyframes netdim{from{opacity:1}}
#screen.offline .tile{opacity:.5;animation:netdim .6s ease-out}   /* abgedunkelt: sieht nach „geht gerade nicht“ aus, Tippen schüttelt statt zu senden */
</style>`);

// Selbsttest: node netwatch.js
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('netwatch.js')) {
  const t = (c, m) => console.assert(c, m);
  t(!bannerDue(null, 9e9) && !bannerDue(1000, 1000 + SHOW_AFTER - 1) && bannerDue(1000, 1000 + SHOW_AFTER), 'Pille erst nach SHOW_AFTER');
  const T = 1e9;   // Ausfallbeginn; letztes Neuladen lange her
  t(!reloadDue(null, T * 2, 0) && !reloadDue(T, T + RELOAD_AFTER - 1, 0) && reloadDue(T, T + RELOAD_AFTER, 0), 'Neuladen erst nach RELOAD_AFTER');
  t(!reloadDue(T, T + RELOAD_AFTER, T + RELOAD_AFTER - RELOAD_GAP + 1) && reloadDue(T, T + RELOAD_AFTER, T + RELOAD_AFTER - RELOAD_GAP), 'höchstens ein Neuladen je RELOAD_GAP');
  t(!nightDue(NIGHT_GAP, 0, false, NIGHT_IDLE) && !nightDue(NIGHT_GAP, 0, true, NIGHT_IDLE - 1) && !nightDue(NIGHT_GAP - 1, 0, true, NIGHT_IDLE) && nightDue(NIGHT_GAP, 0, true, NIGHT_IDLE), 'Nachtneustart: Ruhefenster, Leerlauf, einmal je Nacht');
  console.log('ok');
}
