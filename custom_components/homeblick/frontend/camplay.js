// Livebild einer HA-Kamera über die Verbindung des Displays: WebRTC (camera/webrtc/*), sonst HLS (camera/stream).
// Löst mit stop() auf, sobald der Stream angefordert ist; wirft, wenn die Kamera keinen Stream anbietet (Aufrufer fällt auf MJPEG zurück).
// Das Bild erscheint im übergebenen <video> (Ereignis „playing“). fail() meldet einen späteren Abbruch (ICE/HLS).
export async function live(conn, e, video, hass = '', fail = () => {}) {
  const caps = (await conn.sendMessagePromise({ type: 'camera/capabilities', entity_id: e }))?.frontend_stream_types || [];
  if (caps.includes('web_rtc')) {
    try { return await webrtc(conn, e, video, fail); } catch (err) { console.warn('WebRTC', e, err?.message || err); }
  }
  if (caps.includes('hls')) return hls(conn, e, video, hass, fail);
  throw new Error('Kamera bietet keinen Stream');
}

async function webrtc(conn, e, video, fail) {
  const { configuration, dataChannel } = await conn.sendMessagePromise({ type: 'camera/webrtc/get_client_config', entity_id: e });
  const pc = new RTCPeerConnection(configuration), ms = new MediaStream();
  let sid, queue = [], unsub, dead = false;
  const stop = () => { dead = true; try { unsub?.(); } catch {} pc.close(); video.srcObject = null; };
  const die = err => { if (dead) return; stop(); fail(err); };
  const send = candidate => conn.sendMessagePromise({ type: 'camera/webrtc/candidate', entity_id: e, session_id: sid, candidate }).catch(() => {});
  pc.ontrack = ev => { ms.addTrack(ev.track); video.srcObject = ms; };
  pc.onconnectionstatechange = () => pc.connectionState === 'failed' && die(new Error('WebRTC-Verbindung fehlgeschlagen'));
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
  if (!Hls.isSupported()) throw new Error('HLS nicht unterstützt');
  const h = new Hls({ lowLatencyMode: true });
  h.on(Hls.Events.ERROR, (_, d) => d.fatal && fail(new Error('HLS: ' + d.details)));
  h.loadSource(src); h.attachMedia(video);
  return () => h.destroy();
}
