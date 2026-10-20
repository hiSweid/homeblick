// Türklingel + Video-Überwachung. Vollbild =  t = 43,4 s („Front Door / Live“, unten rot ✕ / gelb Mic / Glas-Raster).
// Video über die HA-Verbindung des Displays (camplay.js: WebRTC, sonst HLS, sonst MJPEG) — HA/go2rtc teilt sich die Quelle, die Kamera selbst sieht nur eine Sitzung.
// Funktion haben nur ✕ (schließt die Ansicht), Licht (data-act="toggle" → TAP.light in index.html) und das Raster (Blur-Steuerebene, siehe unten); Mic, Lautsprecher, Öffner, Antworten noch nicht (Wunsch 2026-10-19).
// Kamera-Detail (nicht Klingel) = Layout QFRp7dbxciE 318,7 s (steuerung/kamera/NOTIZEN.md): dunkle Karte, ✕ oben links, 16:9-Fenster, Raster links, Mic rechts.
// Wisch links/rechts = nächstes/voriges Face (zT8M0BsBO5k 56,35–56,95 s, STEUERUNG.md Zeile 18): Pager in index.html.
// Klingeln weckt das Display und spielt einen Gong (Einstellung „Gong beim Klingeln“, Lautstärke = Antworten).

import { live } from './camplay.js';

// Kameras kommen aus der Konfiguration (Einstellungsseite → Face „Kameras“, sonst automatisch erkannt): camConfig({ list: [{ entity, name, light }], bell: { event, camera } })
let LIST = [], RING = '', DOOR = '';
const Z = 16 / 9;   // 16:9-Bild füllt das Quadrat bei Vergrößerung Z
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const camOf = e => LIST.find(c => c.entity === e) || {};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ico = (id, cls = '') => `<svg class="i ${cls}"><use href="#${id}"/></svg>`;

// Rückfall ohne Stream (Kamera ohne Stream-Quelle, kein WebRTC/HLS): HA-MJPEG-Proxy bzw. Standbild
function mjpeg(box, e, s, cb) {
  const { access_token: tok, entity_picture: pic } = s.attributes;
  const u = tok ? `${HASS}/api/camera_proxy_stream/${e}?token=${tok}` : pic?.startsWith('/') ? HASS + pic : pic;
  if (!u) { box.replaceChildren(); return cb('Kein Bild'); }
  // neues Bild über das alte legen (bis zum ersten Frame durchsichtig), altes erst danach weg → kein Aufblitzen
  const img = new Image(), old = [...box.children], drop = () => old.forEach(o => o.remove());
  img.alt = ''; img.onload = () => { drop(); cb('Live'); }; setTimeout(drop, 10000);
  img.onerror = () => { const t = box._tag; setTimeout(() => box._tag === t && box.isConnected && !document.hidden && feed(box, e, ents[e] || s, cb), 5000); };   // Verbindung weg → später neu
  img.src = u;
  box.append(img);
}

const STILL = {};   // Kamera → { u: Data-URL des letzten Frames, t }
function grab(e, v) {
  try { const c = Object.assign(document.createElement('canvas'), { width: 640, height: Math.round(640 * v.videoHeight / v.videoWidth) }); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); STILL[e] = { u: c.toDataURL('image/jpeg', .7), t: Date.now() }; } catch {}
}

// Bild in box: sofort das Standbild, darüber der Live-Stream (WebRTC, sonst HLS, sonst MJPEG); cb(Status)
async function feed(box, e, s, cb) {
  box._stop?.(); box._stop = null;
  const tag = box._tag = {}, alive = () => box._tag === tag && box.isConnected, conn = api.conn?.();
  if (!conn) return mjpeg(box, e, s, cb);
  const pic = s.attributes.entity_picture, v = Object.assign(document.createElement('video'), { muted: true, autoplay: true, playsInline: true });
  box.replaceChildren();
  // Vorschau sofort: letztes Bild dieser Kamera (zuletzt gesehener Frame, höchstens 10 min alt), sonst das HA-Standbild (kann bei manchen Kameras Sekunden dauern)
  const still = STILL[e] && Date.now() - STILL[e].t < 6e5 ? STILL[e].u : pic?.startsWith('/') ? HASS + pic : '';
  if (still) { const i = Object.assign(new Image(), { alt: '', src: still }); i.onerror = () => i.remove(); i.onload = () => cb('Verbinde …', true); box.append(i); }
  v.style.opacity = 0; box.append(v);
  cb('Verbinde …');
  let real;
  const end = () => { clearInterval(w); clearTimeout(t); try { real?.(); } catch {} real = null; };
  const fallback = why => { if (!alive()) return; console.warn('Kamera', e, why?.message || why); end(); v.remove(); mjpeg(box, e, ents[e] || s, cb); };
  box._stop = end;
  const w = setInterval(() => { if (box._tag !== tag || !box.isConnected) end(); }, 3000);   // Box verschwunden (Face neu gebaut, Ansicht zu) → Stream beenden
  const t = setTimeout(() => fallback('kein Bild nach 15 s'), 15000);
  v.addEventListener('playing', () => { clearTimeout(t); v.style.opacity = ''; box.querySelectorAll('img').forEach(i => i.remove()); cb('Live'); setTimeout(() => alive() && grab(e, v), 800); });
  try { real = await live(conn, e, v, HASS, fallback); } catch (err) { return fallback(err); }
  if (box._tag !== tag) end();
}

// ---------- Vollbild ----------
let V, api, notch, spot, HASS = '', stat = '', ringT, px = 0, z = Z;
const showStat = s => { if (s) stat = s; $('.cst', V).textContent = stat; };   // Klingel-Ansicht zeigt wie die Vorlage (zT8M0BsBO5k 25,5 s) „Live“
// 16:9-Bild im Quadrat: nur transform → Compositor
function pan(p, zz = z) {
  const max = V.offsetWidth * (zz - 1) / 2;
  z = zz; px = Math.max(-max, Math.min(max, p));
  $('.feed', V).style.transform = `translateX(${px}px) scale(${z})`;
}

export function camInit(view, fns) {
  V = view; api = fns; HASS = fns.hass;
  V.innerHTML = `<div class="feed"></div><i class="veil"></i><i class="live-pill"><i></i>LIVE</i>
<div class="ctop"><b class="cname"></b><span class="cst"></span></div>
<button class="rb end" data-act="close" aria-label="Beenden">${ico('xthin')}</button>
<button class="rb mic" aria-label="Sprechen">${ico('mic')}</button>
<button class="rb all" aria-label="Steuerebene">${ico('cams')}</button>
<button class="cb spk" aria-label="Lautsprecher">${ico('vol')}</button>
<button class="acc" data-act="toggle" aria-label="Licht"><span class="ai">${ico('bulb')}</span><span class="at"><b></b><span></span></span></button>`;
  // Klingeln: Ansicht fliegt aus der Kamera-Notch oben mittig
  notch = document.createElement('i');
  notch.id = 'notch'; notch.className = 'notch';
  spot = Object.assign(document.createElement('i'), { className: 'notch' });   // gleiche Stelle für Kameras per HA-Dienst (ohne Klingel-Zustand)
  V.after(notch, spot);

  // Doppeltipp = ganzes 16:9-Bild ↔ Quadrat füllen (nur Klingel-Ansicht); Raster-Button = Blur-Steuerebene; Wischen übernimmt der Pager (index.html)
  let g = null, lastUp = 0;
  V.addEventListener('pointerdown', e => {
    clearTimeout(ringT);   // Berührung: Klingel-Ansicht bleibt offen
    g = e.target.closest('button') ? null : { x: e.clientX, y: e.clientY };
  });
  V.addEventListener('pointerup', e => {
    if (!g || Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8 || V.classList.contains('ctl') || !V.classList.contains('bell')) return;
    if (e.timeStamp - lastUp < 300) { pan(0, z > 1 ? 1 : Z); lastUp = 0; }
    else lastUp = e.timeStamp;
  });
  V.addEventListener('pointercancel', () => g = null);
  // Blur-Steuerebene (QFRp7dbxciE 307,0–309,0 / 317,45–318,75 s, v3wcg4Vi4u0 256,6–263 s): Overlays blenden aus, Bild blurt, Zubehör-Pille (Licht) erscheint; Raster wird weiß; kein Auto-Zurück
  $('.rb.all', V).addEventListener('click', () => { V.classList.toggle('ctl'); });
}

export function camShow(tile, e, s) {
  const cam = camOf(e);
  clearTimeout(ringT); V._e = e;
  V.classList.remove('ctl');
  V.classList.toggle('ring', tile === notch);
  V.classList.toggle('bell', tile === notch && !!DOOR && e === DOOR);   // randloses Klingel-Layout nur beim Klingeln; Tipp auf Kachel (Home/Kameras-Face) = Kamera-Detail
  if (tile === notch) ringT = setTimeout(api.close, 60000);   // unbeantwortet → nach 1 min zu
  $('.cname', V).textContent = cam.name || s.attributes.friendly_name || e;
  const acc = $('.acc', V); acc.hidden = !cam.light; $('.at b', acc).textContent = ents[cam.light]?.attributes.friendly_name || 'Licht'; accSub();
  if (cam.light) acc.dataset.e = cam.light; else delete acc.dataset.e;
  $('.feed', V).classList.add('drag'); pan(0, V.classList.contains('bell') ? Z : 1);   // ohne Animation zurück auf „füllen“ (Klingel) bzw. 16:9-Fenster (Kamera-Detail)
  requestAnimationFrame(() => $('.feed', V).classList.remove('drag'));
  feed($('.feed', V), e, s, showStat);
}
export function camHide() { clearTimeout(ringT); V.classList.remove('ctl'); const f = $('.feed', V); f._stop?.(); f._stop = null; f._tag = null; f.replaceChildren(); }

const accSub = () => { const l = V?._e && camOf(V._e).light; if (l) put($('.acc .at span', V), ents[l]?.state === 'on' ? 'Ein' : ents[l]?.state === 'unavailable' ? 'Offline' : 'Aus'); };
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
  if (!DOOR) return;   // Klingel ohne zugeordnete Kamera: nur wecken und läuten
  const open = api.view();
  if (open === V) {   // läuft schon eine andere Kamera → auf die Haustür wechseln
    if (V._e === DOOR) { V.classList.add('ring', 'bell'); pan(0, Z); showStat(); } else camShow(notch, DOOR, ents[DOOR] || { attributes: {} });
    return;
  }
  if (open || $('#screen').matches('.gallery,.custom')) return;
  notch.dataset.e = DOOR; api.open(notch, 'cam');
}

// ---------- Kamera-Face: randloses 2×2-Raster ohne UI (Vorlage y-MODo3Hye4 04200 s, _TbqCPIIe8g 94,9 s): bis zu vier Kameras live, hauchdünne Trennlinie (≈ 0,4 % Breite), Tippen = Kamera-Detail ----------
// ponytail: weniger als vier Kameras → leere Zellen bleiben schwarz (Vorlage zeigt immer vier); mehr als vier: die ersten vier
export function camFace(el) {
  if (!LIST.length) { el.innerHTML = `<div class="ctile"><div><b>Keine Kamera</b><span>In den Einstellungen wählen</span></div></div>`; return; }
  const main = LIST.find(c => c.entity === DOOR) || LIST[0], cams = [main, ...LIST.filter(c => c !== main)].slice(0, 4);   // Klingelkamera zuerst
  el.innerHTML = cams.map(c => `<button class="cc" data-act="cam" data-e="${esc(c.entity)}" aria-label="${esc(c.name || ents[c.entity]?.attributes.friendly_name || c.entity)}"><div class="feed"></div></button>`).join('');
}

// Raster-Kachel: Livebild randlos ohne Beschriftung; ohne Bild bleiben Icon + Text sichtbar.
// Aus render(): neu laden nur bei neuer Quelle (HA wechselt access_token alle paar Minuten)
// Stream nur, solange die Kachel sichtbar ist (Face im Pager, nicht seitlich verdeckt): sonst pausiert Chrome das Video, die Verbindungen (6 je Host) sind belegt und Kameras laufen unnötig
const vis = new IntersectionObserver(es => es.forEach(en => {
  const box = en.target, c = box._cam;
  clearTimeout(box._off);
  if (en.isIntersecting) { if (!box._on) { box._on = true; feed(box, c.e, ents[c.e] || c.s, (st, still) => c.tile.classList.toggle('live', st === 'Live' || !!still)); } }
  else box._off = setTimeout(() => { if (!box._on) return; box._on = false; box._stop?.(); box._stop = null; box._tag = null; box.replaceChildren(); c.tile.classList.remove('live'); }, 1500);
}), { threshold: .01 });
export function camTile(tile, e, s) {
  const box = tile.querySelector('.feed');
  if (!box) return;
  if (box._cam?.e === e) return void (box._cam.s = s);   // Stream läuft weiter, wenn HA das Zugriffs-Token wechselt
  if (box._cam) { vis.unobserve(box); box._on = false; box._stop?.(); box._tag = null; box.replaceChildren(); }
  box._cam = { tile, e, s }; vis.observe(box);
}

// Konfiguration (register / Push vom Server); der Aufrufer baut die Faces danach neu auf
let configured = false;
export function camConfig(c) {
  LIST = c?.list || []; RING = c?.bell?.event || ''; DOOR = c?.bell?.camera || '';
  if (configured) lastRing = ents[RING]?.state;   // spätere Änderung der Klingel zählt nicht als Klingeln (nur Beim Laden: frisches Ereignis darf läuten)
  configured = true;
}

// Aus render(): Klingeln erkennen (Event-Zeitstempel neu und frisch) + Face-Kacheln
let ents = {}, lastRing;
const put = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };
export function doorbell(all) {
  ents = all;
  const r = ents[RING]?.state;
  const neu = RING && r !== lastRing && Date.now() - Date.parse(r) < 30000;
  lastRing = r;   // vor ring(): open() rendert synchron und landet wieder hier
  if (neu) ring();
  for (const b of $$('.f-cams .cc')) camTile(b, b.dataset.e, ents[b.dataset.e] || { attributes: {} });   // Stream startet, sobald der Zustand da ist; läuft weiter, wenn HA das Token wechselt
  accSub();
}

document.querySelector('body > svg').insertAdjacentHTML('beforeend', `
<symbol id="xthin" viewBox="5 5 14 14"><path d="M6 6l12 12M18 6 6 18" stroke-width="1.3"/></symbol>
<symbol id="mic" viewBox="0 0 24 24"><rect x="8.7" y="2.5" width="6.6" height="12.2" rx="3.3" fill="currentColor" stroke="none"/><path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 17.9v3.6M8.6 21.5h6.8" stroke-width="1.7"/></symbol>
<symbol id="cams" viewBox="0 0 24 24"><g fill="currentColor" stroke="none"><rect x="3" y="3" width="8" height="8" rx="1.8"/><rect x="13" y="3" width="8" height="8" rx="1.8"/><rect x="3" y="13" width="8" height="8" rx="1.8"/><rect x="13" y="13" width="8" height="8" rx="1.8"/></g></symbol>
<symbol id="bell" viewBox="0 0 24 24"><path d="M5.5 17.5v-6.3a6.5 6.5 0 0 1 13 0v6.3l1.6 1.4H3.9z" fill="currentColor" stroke="none"/><path d="M9.8 21.2a2.3 2.3 0 0 0 4.4 0" stroke-width="1.8"/></symbol>`);

document.head.insertAdjacentHTML('beforeend', `<style>
/* ---------- Kamera-Vollbild (Maße aus Video t = 43,4 s, relativ zur Breite) ---------- */
#cam{background:#000;touch-action:none}
/* 16:9-Bild mittig, „füllen“ = scale(16/9); Schwenken per translateX → nur Compositor */
#cam .feed{position:absolute;left:0;top:50%;width:100%;aspect-ratio:16/9;margin-top:-28.125cqw;transition:transform var(--sd) var(--spring)}
#cam .feed.drag{transition:none}
.feed>*{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.feed img{-webkit-user-drag:none;user-select:none}   /* Maus-Ziehen startet sonst den nativen Bild-Drag und bricht den Wisch ab (pointercancel) */
cam-rtc video{object-fit:cover}
.ctop{position:absolute;top:6.7cqw;inset-inline:0;text-align:center;font-size:3.4cqw;line-height:4.55cqw;text-shadow:0 0 1.2cqw #0009;pointer-events:none;transition:opacity .4s}
.ctop b{display:block;font-weight:600}
.ctop span{color:#ffffffa6}
/* Rund ⌀ 14,7 %, Mitten bei x 11,9 / 50 / 88,3 %, y 88,5 % */
.rb{position:absolute;top:88.5cqw;width:14.7cqw;height:14.7cqw;translate:-50% -50%;border-radius:50%;display:grid;place-items:center;color:#fff}
.rb.end{left:11.9cqw;background:#ec0d0a;font-size:5.7cqw}
.rb.mic{left:50cqw;background:#facf14;color:#000;font-size:8.2cqw}
.rb.all{left:88.3cqw;font-size:7.2cqw}
/* ponytail: Live-backdrop-filter über dem Video (kleine Flächen); ruckelt das auf dem Tablet → nur #ffffff38 */
:is(.rb.all,.cb){-webkit-backdrop-filter:blur(2.4cqw);backdrop-filter:blur(2.4cqw)}
.rb.all{background:#ffffff38}
/* oben meist Himmel → dunkles Glas, sonst verschwindet das weiße Icon; Licht an = weiß mit gelber Birne wie die Kacheln */
.cb{position:absolute;top:4cqw;width:10cqw;height:10cqw;border-radius:50%;display:grid;place-items:center;font-size:4.8cqw;background:#1c1c1e4d}
#cam:not(.bell) .mic{display:none}
.rb{transition:scale var(--sd) var(--spring),opacity .4s}
:is(.rb,.cb):active{scale:.88;transition:scale .12s ease-out}
/* Blur-Steuerebene (QFRp7dbxciE 307,0–309,0 s ein / 317,45–318,75 s aus): ein = Overlays Opacity 150 ms, Bild blurt ≈ 400 ms (ab +80 ms), Pille gleichzeitig;
   aus = Bild zuerst scharf (≈ 80 ms), Overlays 150 ms zurück → gesamt ≈ 230 ms. Schleier ≈ 24 % Weiß (Navy 10,24,47 → ≈ 67,77,100), Blur σ ≈ 3 % W (Kantenweichheit ≈ 6 %) */
#cam .feed{filter:blur(0);transition:transform var(--sd) var(--spring),filter .08s linear,scale .1s}
#cam.ctl .feed{filter:blur(3cqw);transition:transform var(--sd) var(--spring),filter .32s linear .08s,scale .4s ease-out}
#cam.bell.ctl .feed{scale:1.1}   /* randloses Bild: Überstand, damit der Blur am Rand nicht ins Schwarze ausläuft */
.veil{position:absolute;inset:0;background:#ffffff3d;opacity:0;pointer-events:none;transition:opacity .08s linear}
#cam.ctl .veil{opacity:1;transition:opacity .32s linear .08s}
:is(.ctop,.cb,.rb:not(.all),.live-pill){transition:opacity .15s linear .08s,scale var(--sd) var(--spring),background-color .3s,color .3s}
#cam.ctl :is(.ctop,.cb,.rb:not(.all),.live-pill){opacity:0;pointer-events:none;transition-delay:0s,0s,0s,0s}
.rb.all{transition:scale var(--sd) var(--spring),opacity .4s,background-color .12s,color .12s}
#cam.ctl .rb.all{background:#fff;color:#1c1c1e}   /* aktiv: weiß gefüllt, dunkles Symbol (QFRp 312,0 s) */
/* Zubehör-Pille (QFRp 312,0 s): Glas, x 5–50 %, y 64–77 % (Höhe ≈ 13–14 % W), links dunkler Kreis ⌀ ≈ 9 % mit Symbol, Name Semibold + Zustand Regular weiß; hier das Licht der Kamera (Vorlage: Türschloss) */
.acc{position:absolute;left:5cqw;top:64cqw;width:45cqw;height:13.5cqw;border-radius:7cqw;display:flex;align-items:center;gap:3.5cqw;padding:0 2.7cqw;text-align:left;
  background:#ffffff38;-webkit-backdrop-filter:blur(2.4cqw);backdrop-filter:blur(2.4cqw);opacity:0;pointer-events:none;transition:opacity .15s linear,scale var(--sd) var(--spring)}
#cam.ctl .acc{opacity:1;pointer-events:auto;transition-delay:.0s}
.acc:active{scale:.96;transition:scale .12s ease-out}
.acc .ai{flex:none;width:9cqw;height:9cqw;border-radius:50%;background:#0000004d;display:grid;place-items:center;font-size:4.6cqw;color:#ffffffb3}
.acc.on .ai{color:#ffd60a}
.acc .at{display:flex;flex-direction:column;font-size:3.8cqw;line-height:1.3;min-width:0}
.acc .at b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Kamera-Detail (QFRp7dbxciE 318,7 s, Maße % Screen): Hintergrund Navy ≈ #0a182f, ✕ Glas Mitte 10/10 ⌀ 9, Lautsprecher Mitte 89/10 ⌀ 8, Titel y ≈ 10 + „Live“ y ≈ 14,
   16:9-Fenster 88 % breit, Radius ≈ 4 %, „● LIVE“-Pille links oben, Raster unten links Mitte 12/88 ⌀ 15, Mic unten rechts Mitte 88/88 ⌀ 15 gelb */
#cam:not(.bell){background:#0a182f}
#cam:not(.bell) .feed{left:6cqw;width:88cqw;margin-top:-24.75cqw;border-radius:4cqw;overflow:hidden;transform:none!important}
#cam:not(.bell) .ctop{top:7.7cqw}
#cam:not(.bell) .rb.end{left:10cqw;top:10cqw;width:9cqw;height:9cqw;background:#ffffff3d;font-size:4.2cqw;-webkit-backdrop-filter:blur(2.4cqw);backdrop-filter:blur(2.4cqw)}
#cam:not(.bell) .rb.all{left:12cqw}
#cam:not(.bell) .rb.mic{left:88cqw;display:grid}
.cb.spk{display:none;left:89cqw;right:auto;top:10cqw;translate:-50% -50%;width:8cqw;height:8cqw;background:#ffffff3d;font-size:4.2cqw}
#cam:not(.bell) .cb.spk{display:grid}
.live-pill{display:none;position:absolute;left:8.2cqw;top:26.5cqw;height:5.5cqw;padding:0 1.8cqw;border-radius:3cqw;align-items:center;gap:.9cqw;font-style:normal;font-weight:700;font-size:2.9cqw;letter-spacing:.02em;background:#78808c99;-webkit-backdrop-filter:blur(2.4cqw);backdrop-filter:blur(2.4cqw);pointer-events:none}
.live-pill>i{width:1.4cqw;height:1.4cqw;border-radius:50%;background:#ff3b30}
#cam:not(.bell) .live-pill{display:flex}
.notch{position:absolute;left:44cqw;top:-7cqw;width:12cqw;height:12cqw;border-radius:50%;opacity:0;pointer-events:none}

/* ---------- Kamera-Face: randloses 2×2 (Vorlage y-MODo3Hye4 04200 s, _TbqCPIIe8g 94,9 s; Trennlinie ≈ 0,4 % W) ---------- */
.f-cams{display:grid;grid-template:1fr 1fr/1fr 1fr;gap:.4cqw;background:#000}
.cc{position:relative;overflow:hidden;background:#000;transition:scale var(--sd) var(--spring)}
.cc:active{scale:.97;transition:scale .12s ease-out}
.cc .feed{position:absolute;inset:0}
.ctile{grid-area:1/1/3/3;display:grid;place-items:center;text-align:center;color:#fff9}
.ctile b{display:block;font-size:4.4cqw;font-weight:600}
.ctile span{font-size:3.4cqw}
/* Livebild-Kachel im Home-Face (Website dashboard/smart_home_hw): Bild randlos in der Kachel, kein Glasrand, kein Icon/Text; ohne Bild bleiben beide sichtbar */
.tile>:not(.feed){transition:opacity .3s}
.tile.live{box-shadow:none;background:#000}
.tile.live>:not(.feed){opacity:0}
.tile>.feed{position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none}
</style>`);
