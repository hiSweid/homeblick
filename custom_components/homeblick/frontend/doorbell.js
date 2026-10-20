// Türklingel + Video-Überwachung. Vollbild =  t = 43,4 s („Front Door / Live“, unten rot ✕ / gelb Mic / Glas-Raster).
// Video kommt aus dem go2rtc von Frigate (WebRTC, sonst MSE) — nie direkt von der Hikvision (verträgt nur wenige Sitzungen).
// Funktion haben nur ✕ (schließt die Ansicht) und Licht (data-act="toggle" → TAP.light in index.html); Mic, Raster, Öffner, Antworten noch nicht (Wunsch 2026-10-19).
// Klingeln weckt das Display und spielt einen Gong (Einstellung „Gong beim Klingeln“, Lautstärke = Antworten).

const GO2RTC = '', FRIGATE = '';
// Entity → Name, go2rtc-/Frigate-Kamera (ohne src: HA-Bild, nur mit ?live), Licht davor, bell = Türklingel (Mic, Öffner, Antworten)
const CAMS = {
  'camera.turklingel': { name: 'Haustür', src: 'tuerstation', light: 'light.eingang', bell: true },
  'camera.cx410w_color_x_standardauflosung': { name: 'Garten' },
};
const RING = 'event.turklingel_doorbell', DOOR = 'camera.turklingel';
const REPLIES = ['Komme gleich', 'Paket ablegen', 'Nicht da'];
const Z = 16 / 9;   // 16:9-Bild füllt das Quadrat bei Vergrößerung Z

const $ = (s, r = document) => r.querySelector(s);
const ico = (id, cls = '') => `<svg class="i ${cls}"><use href="#${id}"/></svg>`;
const when = t => {
  const d = new Date(t), hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return isNaN(d) ? null : d.toDateString() === new Date().toDateString() ? hm : `${d.toLocaleDateString('de-DE', { weekday: 'short' })} ${hm}`;
};

// Player = VideoRTC aus dem go2rtc selbst (passt immer zur Server-Version); erst nach define Elemente anlegen
const ready = import(GO2RTC + '/video-rtc.js').then(({ VideoRTC }) => {
  customElements.define('cam-rtc', class extends VideoRTC {
    oninit() {
      super.oninit();
      this.video.controls = false; this.video.muted = true;
      this.video.addEventListener('playing', () => this.dispatchEvent(new Event('live')));
    }
  });
  return true;
}).catch(e => (console.warn('go2rtc nicht erreichbar', e), false));

// Bild in box: sofort Frigate-Standbild, darüber der Live-Stream; cb(Status)
async function feed(box, e, s, cb, vis = 0) {
  const cam = CAMS[e] || {}, { access_token: tok, entity_picture: pic } = s.attributes;
  if (!cam.src) {   // ohne go2rtc: HA-MJPEG (live) bzw. Standbild
    const u = tok ? `${HASS}/api/camera_proxy_stream/${e}?token=${tok}` : pic?.startsWith('/') ? HASS + pic : pic;
    if (!u) { box.replaceChildren(); return cb('Kein Bild'); }
    // neues Bild über das alte legen (bis zum ersten Frame durchsichtig), altes erst danach weg → kein Aufblitzen beim Token-Wechsel
    const img = new Image(), old = [...box.children], drop = () => old.forEach(o => o.remove());
    img.alt = ''; img.onload = drop; setTimeout(drop, 10000); img.src = u;
    box.append(img);
    return cb('Live');
  }
  const tag = box._tag = {};   // camHide/Neuaufbau während des Ladens → nichts mehr anhängen
  box.innerHTML = `<img alt="" src="${FRIGATE}/api/${cam.src}/latest.webp?h=720">`;
  box.firstChild.onerror = function () { this.remove(); };
  cb('Verbinde …');
  if (!await ready) return cb('Offline');
  if (box._tag !== tag) return;
  const v = document.createElement('cam-rtc');
  // Vollbild: WebRTC (geringste Latenz, später Gegensprechen); Face: MSE reicht und vermeidet den WebRTC/MSE-Wettlauf im Player
  v.mode = vis ? 'mse' : 'webrtc,mse'; v.media = 'video'; v.visibilityThreshold = vis;
  v.src = `${GO2RTC}/api/ws?src=${cam.src}`;
  // kein Bild nach 10 s → Player neu aufbauen (nur bei sichtbarer Seite; nach 5 s Pause, bis es klappt)
  const t = setTimeout(() => { if (box._tag !== tag) return; cb('Offline'); v.remove(); setTimeout(() => box._tag === tag && !document.hidden && feed(box, e, s, cb, vis), 5000); }, 10000);
  v.addEventListener('live', () => { clearTimeout(t); cb('Live'); });
  box.append(v);
}

// ---------- Vollbild ----------
let V, api, notch, spot, HASS = '', stat = '', ringT, px = 0, z = Z;
const showStat = s => { if (s) stat = s; $('.cst', V).textContent = V.classList.contains('ring') ? 'Es klingelt' : stat; };
// 16:9-Bild im Quadrat: nur transform → Compositor
function pan(p, zz = z) {
  const max = V.offsetWidth * (zz - 1) / 2;
  z = zz; px = Math.max(-max, Math.min(max, p));
  $('.feed', V).style.transform = `translateX(${px}px) scale(${z})`;
}

export function camInit(view, fns) {
  V = view; api = fns; HASS = fns.hass;
  V.innerHTML = `<div class="feed"></div>
<div class="ctop"><b class="cname"></b><span class="cst"></span></div>
<button class="cb lt" data-act="toggle" aria-label="Licht">${ico('bulb')}</button>
<button class="cb key" aria-label="Tür öffnen">${ico('key')}</button>
<div class="replies">${REPLIES.map((r, i) => `<button style="--i:${i}">${r}</button>`).join('')}</div>
<button class="rb end" data-act="close" aria-label="Beenden">${ico('xthin')}</button>
<button class="rb mic" aria-label="Sprechen">${ico('mic')}</button>
<button class="rb all" aria-label="Alle Kameras">${ico('cams')}</button>`;
  // Klingeln: Ansicht fliegt aus der Kamera-Notch oben mittig
  notch = document.createElement('i');
  notch.id = 'notch'; notch.className = 'notch'; notch.dataset.e = DOOR;
  spot = Object.assign(document.createElement('i'), { className: 'notch' });   // gleiche Stelle für Kameras per HA-Dienst (ohne Klingel-Zustand)
  V.after(notch, spot);

  // Ziehen = schwenken, Doppeltipp = ganzes 16:9-Bild ↔ Quadrat füllen
  let g = null, lastUp = 0;
  const end = () => { $('.feed', V).classList.remove('drag'); g = null; };
  V.addEventListener('pointerdown', e => {
    clearTimeout(ringT);   // Berührung: Klingel-Ansicht bleibt offen
    if (e.target.closest('button')) return;
    g = { x: e.clientX, p: px, on: false };
    V.setPointerCapture(e.pointerId);
  });
  V.addEventListener('pointermove', e => {
    if (!g || !g.on && Math.abs(e.clientX - g.x) < 6) return;
    g.on = true; $('.feed', V).classList.add('drag');
    pan(g.p + e.clientX - g.x);
  });
  V.addEventListener('pointerup', e => {
    const tap = g && !g.on;
    end();
    if (!tap) return;
    if (e.timeStamp - lastUp < 300) { pan(0, z > 1 ? 1 : Z); lastUp = 0; }
    else lastUp = e.timeStamp;
  });
  V.addEventListener('pointercancel', end);

}

export function camShow(tile, e, s) {
  const cam = CAMS[e] || {}, lt = $('.cb.lt', V);
  clearTimeout(ringT); V._e = e;
  V.classList.toggle('ring', tile === notch);
  V.classList.toggle('bell', !!cam.bell);
  if (tile === notch) ringT = setTimeout(api.close, 60000);   // unbeantwortet → nach 1 min zu
  $('.cname', V).textContent = cam.name || s.attributes.friendly_name || '';
  lt.hidden = !cam.light;
  if (cam.light) lt.dataset.e = cam.light; else delete lt.dataset.e;
  $('.feed', V).classList.add('drag'); pan(0, Z);   // ohne Animation zurück auf „füllen“
  requestAnimationFrame(() => $('.feed', V).classList.remove('drag'));
  feed($('.feed', V), e, s, showStat);
}
export function camHide() { clearTimeout(ringT); const f = $('.feed', V); f._tag = null; f.replaceChildren(); }

export const camRinging = () => api.view() === V && V.classList.contains('ring');

// HA-Dienst homeblick.show_camera: beliebige Kamera aus der Notch; schließt nach secs (0 = offen, bis jemand schließt; Berührung hält offen)
export function camOpen(e, secs) {
  const open = api.view();
  if (open && open !== V || $('#screen').matches('.gallery,.custom')) return;   // wie beim Klingeln: Bearbeiten und andere Vollansichten nicht überdecken
  if (camRinging()) return;   // Klingel geht vor
  if (open !== V) { spot.dataset.e = e; api.open(spot, 'cam'); }
  else if (V._e !== e) { spot.dataset.e = e; camShow(spot, e, ents[e] || { attributes: {} }); }   // gleiche Kamera (Bewegung retriggert): Stream läuft weiter, nur die Zeit beginnt neu
  clearTimeout(ringT);
  if (secs) ringT = setTimeout(api.close, secs * 1000);
}

// Gong (Ding-Dong, synthetisch: Grundton + Glocken-Obertöne). ponytail: kein Audio-Asset; eigener Klingelton als Datei, falls gewünscht
// Browser starten Ton erst nach einer Berührung → AudioContext bei jeder Berührung entsperren (iOS: nur innerhalb der Geste)
let ac;
const unlock = () => { try { ac ||= new AudioContext(); if (ac.state !== 'running') ac.resume().catch(() => {}); } catch {} };
addEventListener('pointerdown', unlock, { capture: true, passive: true });
async function gong(vol) {
  try {
    unlock();
    if (ac?.state !== 'running') await Promise.race([ac?.resume(), new Promise(r => setTimeout(r, 300))]).catch(() => {});
    // gesperrt: nicht einplanen, sonst spielen später alle aufgestauten Gongs gleichzeitig
    if (ac?.state !== 'running') return console.warn('Gong blockiert: Ton erst nach einer Berührung (Kiosk-Browser: Autoplay erlauben)');
    const t0 = ac.currentTime, out = ac.createGain();
    out.gain.value = vol * .4; out.connect(ac.destination);
    for (const [f, d] of [[659.3, 0], [523.3, .65]])
      for (const [m, a] of [[1, 1], [2.76, .25], [5.4, .08]]) {
        const o = ac.createOscillator(), g = ac.createGain(), t = t0 + d;
        o.frequency.value = f * m;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + 1.8);
        o.connect(g).connect(out); o.start(t); o.stop(t + 1.9);
      }
  } catch (e) { console.warn('Gong', e); }
}

export function ring() {
  api.wake?.();   // Bildschirmschoner und Nacht-Dimmung weg, erster Tipp geht an die Klingel-Ansicht
  const v = api.sound?.(); if (v) gong(v);
  const open = api.view();
  if (open === V) {   // läuft schon eine andere Kamera → auf die Haustür wechseln
    if (V._e === DOOR) { V.classList.add('ring'); showStat(); } else camShow(notch, DOOR, ents[DOOR] || { attributes: {} });
    return;
  }
  if (open || $('#screen').matches('.gallery,.custom')) return;
  api.open(notch, 'cam');
}

// ---------- Kamera-Face: Haustür live (3×2), darunter Licht, Klingel, weitere Kamera ----------
export function camFace(el) {
  const [other] = Object.keys(CAMS).filter(e => e !== DOOR), lt = CAMS[DOOR].light;
  el.innerHTML = `<button class="ctile" data-act="cam" data-e="${DOOR}"><div class="feed"></div>
  <div class="lbl"><b>${CAMS[DOOR].name}</b><span><i class="dot"></i><span class="cst"></span></span></div></button>
<button class="tile" data-act="toggle" data-e="${lt}" style="grid-area:3/1;--r:2;--c:0">${ico('bulb', 'ico')}<div><div class="ttl">Licht</div><div class="sub">Eingang</div></div></button>
<div class="tile" data-k="ring" style="grid-area:3/2;--r:2;--c:1">${ico('bell', 'ico')}<div><div class="ttl">Klingel</div><div class="sub"></div></div></div>
<button class="tile" data-act="cam" data-e="${other}" style="grid-area:3/3;--r:2;--c:2">${ico('video', 'ico')}<div><div class="ttl">${CAMS[other].name}</div><div class="sub">Kamera</div></div></button>`;
  const lbl = $('.lbl', el);
  feed($('.feed', el), DOOR, ents[DOOR] || { attributes: {} }, s => { $('.cst', lbl).textContent = s; lbl.classList.toggle('live', s === 'Live'); }, .3);
}

// Raster-Kachel: Livebild randlos ohne Beschriftung; ohne Bild bleiben Icon + Text sichtbar.
// Aus render(): neu laden nur bei neuer Quelle (HA wechselt access_token alle paar Minuten)
export function camTile(tile, e, s) {
  const box = tile.querySelector('.feed'), k = CAMS[e]?.src || s.attributes.access_token || s.attributes.entity_picture;
  if (!box || !k || box._k === k) return;
  box._k = k;
  feed(box, e, s, st => tile.classList.toggle('live', st === 'Live'), .3);
}

// Aus render(): Klingeln erkennen (Event-Zeitstempel neu und frisch) + Face-Kacheln
let ents = {}, lastRing;
const put = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };
export function doorbell(all) {
  ents = all;
  const r = ents[RING]?.state, o = Object.keys(CAMS).find(e => e !== DOOR);
  const neu = r !== lastRing && Date.now() - Date.parse(r) < 30000;
  lastRing = r;   // vor ring(): open() rendert synchron und landet wieder hier
  if (neu) ring();
  for (const f of document.querySelectorAll('.f-cams')) {
    put($('[data-k=ring] .sub', f), when(r) ? 'Zuletzt ' + when(r) : 'Keine');
    put($(`[data-e="${o}"] .sub`, f), ents[o]?.state === 'unavailable' || !ents[o] ? 'Offline' : 'Kamera');
  }
}

document.querySelector('body > svg').insertAdjacentHTML('beforeend', `
<symbol id="xthin" viewBox="5 5 14 14"><path d="M6 6l12 12M18 6 6 18" stroke-width="1.3"/></symbol>
<symbol id="mic" viewBox="0 0 24 24"><rect x="8.7" y="2.5" width="6.6" height="12.2" rx="3.3" fill="currentColor" stroke="none"/><path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 17.9v3.6M8.6 21.5h6.8" stroke-width="1.7"/></symbol>
<symbol id="cams" viewBox="0 0 24 24"><g fill="currentColor" stroke="none"><rect x="3" y="3" width="8" height="8" rx="1.8"/><rect x="13" y="3" width="8" height="8" rx="1.8"/><rect x="3" y="13" width="8" height="8" rx="1.8"/><rect x="13" y="13" width="8" height="8" rx="1.8"/></g></symbol>
<symbol id="key" viewBox="0 0 24 24"><circle cx="7.5" cy="12" r="4.3"/><path d="M11.8 12h9M17.5 12v3.4M20.8 12v2.6"/></symbol>
<symbol id="bell" viewBox="0 0 24 24"><path d="M5.5 17.5v-6.3a6.5 6.5 0 0 1 13 0v6.3l1.6 1.4H3.9z" fill="currentColor" stroke="none"/><path d="M9.8 21.2a2.3 2.3 0 0 0 4.4 0" stroke-width="1.8"/></symbol>`);

document.head.insertAdjacentHTML('beforeend', `<style>
/* ---------- Kamera-Vollbild (Maße aus Video t = 43,4 s, relativ zur Breite) ---------- */
#cam{background:#000;touch-action:none}
/* 16:9-Bild mittig, „füllen“ = scale(16/9); Schwenken per translateX → nur Compositor */
#cam .feed{position:absolute;left:0;top:50%;width:100%;aspect-ratio:16/9;margin-top:-28.125cqw;transition:transform var(--sd) var(--spring)}
#cam .feed.drag{transition:none}
.feed>*{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
cam-rtc video{object-fit:cover}
.ctop{position:absolute;top:6.7cqw;inset-inline:0;text-align:center;font-size:3.4cqw;line-height:4.55cqw;text-shadow:0 0 1.2cqw #0009;pointer-events:none}
.ctop b{display:block;font-weight:600}
.ctop span{color:#ffffffa6}
.ring .ctop span{color:#fff;animation:cblink 1.6s ease-in-out infinite}
@keyframes cblink{50%{opacity:.4}}
/* Rund ⌀ 14,7 %, Mitten bei x 11,9 / 50 / 88,3 %, y 88,5 % */
.rb{position:absolute;top:88.5cqw;width:14.7cqw;height:14.7cqw;translate:-50% -50%;border-radius:50%;display:grid;place-items:center;color:#fff}
.rb.end{left:11.9cqw;background:#ec0d0a;font-size:5.7cqw}
.rb.mic{left:50cqw;background:#facf14;color:#000;font-size:8.2cqw}
.rb.all{left:88.3cqw;font-size:7.2cqw}
/* ponytail: Live-backdrop-filter über dem Video (kleine Flächen); ruckelt das auf dem Tablet → nur #ffffff38 */
:is(.rb.all,.cb,.replies button){-webkit-backdrop-filter:blur(2.4cqw);backdrop-filter:blur(2.4cqw)}
:is(.rb.all,.replies button){background:#ffffff38}
/* oben meist Himmel → dunkles Glas, sonst verschwindet das weiße Icon; Licht an = weiß mit gelber Birne wie die Kacheln */
.cb{position:absolute;top:4cqw;width:10cqw;height:10cqw;border-radius:50%;display:grid;place-items:center;font-size:4.8cqw;background:#1c1c1e4d}
.cb.lt{left:4cqw;transition:scale var(--sd) var(--spring),background-color .3s,color .3s}.cb.key{right:4cqw}
.cb.lt.on{background:#fffffff2;color:#ffb300}
.cb.na{opacity:.45}
.replies{position:absolute;left:0;right:0;top:66cqw;display:flex;justify-content:center;gap:2cqw;pointer-events:none}
.replies button{height:8cqw;padding:0 4cqw;border-radius:9cqw;font-weight:600;font-size:3.4cqw;white-space:nowrap;opacity:0;transform:translateY(5cqw);
  transition:opacity .25s,transform var(--sd) var(--spring),scale var(--sd) var(--spring)}
.ring .replies button{opacity:1;transform:none;pointer-events:auto;transition-delay:calc(180ms + var(--i)*50ms),calc(180ms + var(--i)*50ms),0s}
#cam:not(.bell) :is(.mic,.key,.replies){display:none}
.rb,.cb.key{transition:scale var(--sd) var(--spring)}
:is(.rb,.cb,.replies button):active{scale:.88;transition:scale .12s ease-out}
.notch{position:absolute;left:44cqw;top:-7cqw;width:12cqw;height:12cqw;border-radius:50%;opacity:0;pointer-events:none}

/* ---------- Kamera-Face ---------- */
.f-cams{display:grid;grid-template:repeat(3,var(--t))/repeat(3,var(--t));gap:var(--gap);padding:var(--pad)}
.ctile{position:relative;grid-area:1/1/3/4;border-radius:4.3cqw;overflow:hidden;background:#1c1c1e;text-align:left;
  box-shadow:inset 0 0 0 .12cqw #fff2;transition:transform var(--sd) var(--spring)}
.ctile:active{transform:scale(.97);transition:transform .12s ease-out}
.ctile .feed{position:absolute;inset:0}
.ctile .lbl{position:absolute;inset:auto 0 0;z-index:1;padding:9cqw 4.5cqw 3.8cqw;background:linear-gradient(#0000,#0009);line-height:1.3}
.ctile b{display:block;font-size:4.4cqw;font-weight:600}
.ctile .lbl>span{font-size:3.4cqw;color:#ffffffb3;display:flex;align-items:center;gap:1.2cqw}
.ctile .dot{width:1.8cqw;height:1.8cqw;border-radius:50%;background:#8e8e93}
.ctile .live .dot{background:#ff3b30;animation:cblink 2s ease-in-out infinite}
.f-cams .tile .ico{font-size:9.5cqw}
.tile>.feed{position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none}
</style>`);
