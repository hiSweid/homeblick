import { tx } from './i18n.js';
// Livebild einer HA-Kamera über die Verbindung des Displays: WebRTC (camera/webrtc/*), sonst HLS (camera/stream).
// Löst mit stop() auf, sobald der Stream angefordert ist; wirft, wenn die Kamera keinen Stream anbietet (Aufrufer fällt auf MJPEG zurück).
// Das Bild erscheint im übergebenen <video> (Ereignis „playing“). fail() meldet einen späteren Abbruch (ICE/HLS).
// Eine WebRTC-Sitzung pro Kamera, geteilt zwischen Kachel/Face, Vollbild und „Vorhalten“ (Klingel): Öffnet man die Kamera, während schon eine Sitzung läuft, ist das Bild sofort da
// o.go2rtc = { url, stream }: Livebild direkt von go2rtc (WHEP, ohne HA-Verbindung nutzbar); o.talk: Audio-Zeile sendrecv, damit talk() später das Mikrofon einhängen kann
const shared = new Map(), CAPS = new Map();
export async function live(conn, e, video, hass = '', fail = () => {}, o = {}) {
  const release = n => () => { n.fails.delete(fail); video.srcObject = null; if (--n.n === 0) { n.stop(); shared.delete(e); } };
  const open = async start => {
    const n = { n: 1, fails: new Set([fail]), dead: false, ms: new MediaStream() };
    const die = err => { if (n.dead) return; n.dead = true; shared.delete(e); n.fails.forEach(f => f(err)); };
    n.stop = await start(n, die); shared.set(e, n);
    return release(n);
  };
  const s = shared.get(e);
  if (s && !s.dead) { s.n++; s.fails.add(fail); video.srcObject = s.ms; return release(s); }
  if (o.go2rtc?.url) {
    try { return await open((n, die) => whep(o.go2rtc, video, die, n, o.talk)); } catch (err) { console.warn('go2rtc', e, err?.message || err); if (!conn) throw err; }
  }
  if (!CAPS.has(e)) CAPS.set(e, (await conn.sendMessagePromise({ type: 'camera/capabilities', entity_id: e }))?.frontend_stream_types || []);
  const caps = CAPS.get(e);
  if (caps.includes('web_rtc')) {
    try { return await open((n, die) => webrtc(conn, e, video, die, n.ms)); } catch (err) { console.warn('WebRTC', e, err?.message || err); }
  }
  if (caps.includes('hls')) return hls(conn, e, video, hass, fail);
  throw new Error(tx('Kamera bietet keinen Stream'));
}

// go2rtc-WHEP: Angebot (ohne Trickle, LAN) per POST, Antwort kommt als SDP; n.tr = Audio-Transceiver (Sprechen)
async function whep(g, video, die, n, talk) {
  const pc = new RTCPeerConnection({ iceServers: [] });
  let dead = false;
  const stop = () => { dead = true; pc.close(); video.srcObject = null; };
  pc.ontrack = ev => { n.ms.addTrack(ev.track); video.srcObject = n.ms; };
  pc.onconnectionstatechange = () => { if (!dead && pc.connectionState === 'failed') { stop(); die(new Error(tx('WebRTC-Verbindung fehlgeschlagen'))); } };
  try {
    pc.addTransceiver('video', { direction: 'recvonly' });
    n.g = g; n.tr = pc.addTransceiver('audio', { direction: talk ? 'sendrecv' : 'recvonly' });
    await pc.setLocalDescription(await pc.createOffer());
    if (pc.iceGatheringState !== 'complete') await new Promise(r => { const t = setTimeout(r, 1500); pc.addEventListener('icegatheringstatechange', () => pc.iceGatheringState === 'complete' && (clearTimeout(t), r())); });
    const r = await fetch(`${g.url.replace(/\/$/, '')}/api/webrtc?src=${encodeURIComponent(g.stream)}`, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: pc.localDescription.sdp });
    if (!r.ok) throw new Error('go2rtc: HTTP ' + r.status);
    await pc.setRemoteDescription({ type: 'answer', sdp: await r.text() });
  } catch (err) { stop(); throw err; }
  return stop;
}

// Sprechen (Gegensprechen) über die laufende Sitzung der Kamera: Mikrofon ein/aus; wirft verständliche Fehler
export async function talk(e, on) {
  const n = shared.get(e);
  if (!on) { n?.tr?.sender.replaceTrack(null); n?.mic?.getTracks().forEach(t => t.stop()); if (n) n.mic = null; return; }
  if (!n?.tr) throw new Error(tx('Kamera nicht verbunden'));
  if (!navigator.mediaDevices?.getUserMedia) throw new Error(tx('Mikrofon braucht https'));
  // go2rtc nimmt „sendrecv“ immer an; ein Rückkanal besteht nur, wenn die Quelle selbst Audio empfängt (Producer-Medien „audio, sendonly“)
  const back = n.g ? await fetch(`${n.g.url.replace(/\/$/, '')}/api/streams?src=${encodeURIComponent(n.g.stream)}`).then(r => r.json()).then(j => j.producers?.some(p => p.medias?.some(m => /^audio, sendonly/.test(m)))).catch(() => false) : /send/.test(n.tr.currentDirection || '');
  if (!back) throw new Error(tx('Kamera hat keinen Rückkanal'));
  n.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  await n.tr.sender.replaceTrack(n.mic.getAudioTracks()[0]);
}

async function webrtc(conn, e, video, fail, ms) {
  const { configuration, dataChannel } = await conn.sendMessagePromise({ type: 'camera/webrtc/get_client_config', entity_id: e });
  const pc = new RTCPeerConnection(configuration);
  let sid, queue = [], unsub, dead = false;
  const stop = () => { dead = true; try { unsub?.(); } catch {} pc.close(); video.srcObject = null; };
  const die = err => { if (dead) return; stop(); fail(err); };
  const send = candidate => conn.sendMessagePromise({ type: 'camera/webrtc/candidate', entity_id: e, session_id: sid, candidate }).catch(() => {});
  pc.ontrack = ev => { ms.addTrack(ev.track); video.srcObject = ms; };
  pc.onconnectionstatechange = () => pc.connectionState === 'failed' && die(new Error(tx('WebRTC-Verbindung fehlgeschlagen')));
  pc.onicecandidate = ev => ev.candidate && (sid ? send(ev.candidate.toJSON()) : queue.push(ev.candidate.toJSON()));
  try {
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });   // Kamera ohne Ton lehnt die Zeile ab; HA-Frontend macht es genauso
    if (dataChannel) pc.createDataChannel(dataChannel);
    await pc.setLocalDescription(await pc.createOffer());
    unsub = await conn.subscribeMessage(ev => {
      if (dead) return;
      if (ev.type === 'session') { sid = ev.session_id; queue.splice(0).forEach(send); }
      else if (ev.type === 'answer') pc.setRemoteDescription({ type: 'answer', sdp: ev.answer }).catch(die);
      else if (ev.type === 'candidate') pc.addIceCandidate(ev.candidate).catch(() => {});
      else if (ev.type === 'error') die(new Error(ev.message || ev.code));
    }, { type: 'camera/webrtc/offer', entity_id: e, offer: pc.localDescription.sdp });
  } catch (err) { stop(); throw err; }
  return stop;
}

async function hls(conn, e, video, hass, fail) {
  const { url } = await conn.sendMessagePromise({ type: 'camera/stream', entity_id: e });
  const src = hass + url;
  if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = src; return () => (video.removeAttribute('src'), video.load()); }
  // ponytail: hls.js vom CDN (wie js-websocket); lokal bündeln, wenn Displays ohne Internet laufen sollen (F124)
  const { default: Hls } = await import('https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.mjs');
  if (!Hls.isSupported()) throw new Error(tx('HLS nicht unterstützt'));
  const h = new Hls({ lowLatencyMode: true });
  h.on(Hls.Events.ERROR, (_, d) => d.fatal && fail(new Error('HLS: ' + d.details)));
  h.loadSource(src); h.attachMedia(video);
  return () => h.destroy();
}
