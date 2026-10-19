// Assist im Browser: Mikro (16 kHz, PCM16) → HA-Pipeline (STT → Absicht → TTS) → Antwort abspielen.
// Braucht einen Secure Context (https oder localhost) für getUserMedia; voiceOK() prüft das.
export const voiceOK = () => !!navigator.mediaDevices?.getUserMedia;

const WORKLET = `class P extends AudioWorkletProcessor{process(i){const c=i[0][0];if(c)this.port.postMessage(c.slice());return true}}registerProcessor('p',P)`;
const pcm16 = (id, f) => {
  const b = new Uint8Array(1 + f.length * 2), v = new DataView(b.buffer);
  b[0] = id; f.forEach((x, i) => v.setInt16(1 + i * 2, Math.max(-1, Math.min(1, x)) * 32767, true));
  return b;
};

// Mikro als 16-kHz-Float-Frames (±1 → hier int16-Skala nicht nötig); gemeinsam für Sprachlauf und Wake Word
export async function openMic(onFrame) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const ctx = new AudioContext({ sampleRate: 16000 });
  await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
  const node = new AudioWorkletNode(ctx, 'p');
  ctx.createMediaStreamSource(stream).connect(node);
  node.port.onmessage = e => onFrame(e.data);
  return { stop: () => { stream.getTracks().forEach(t => t.stop()); ctx.close().catch(() => {}); } };
}

// h: { onThink(text?), onAnswer(text), onEnd(), onError(msg), base, pipeline? } → { stop() }
export async function voiceRun(conn, h) {
  let mic, unsub, audio, id, sent = false, dead = false;
  const cleanup = () => { dead = true; mic?.stop(); unsub?.(); audio?.pause(); clearTimeout(cap); };
  const endAudio = () => { if (sent || id == null) return; sent = true; conn.socket.send(new Uint8Array([id])); mic?.stop(); };
  const cap = setTimeout(endAudio, (h.listen || 15) * 1000);   // ponytail: Zeitlimit statt eigener VAD; HA meldet das Sprechende meist früher (stt-vad-end)
  const fail = m => { cleanup(); h.onError(m); };
  try {
    mic = await openMic(f => { if (id != null && !sent && !dead) conn.socket.send(pcm16(id, f)); });
    unsub = await conn.subscribeMessage(ev => {
      const d = ev.data;
      if (ev.type === 'run-start') id = d.runner_data.stt_binary_handler_id;
      else if (ev.type === 'stt-vad-end') { endAudio(); h.onThink(); }
      else if (ev.type === 'stt-end') { endAudio(); h.onThink(d.stt_output?.text); }
      else if (ev.type === 'intent-end') h.onAnswer(d.intent_output?.response?.speech?.plain?.speech || '');
      else if (ev.type === 'tts-end') {
        if (h.mute) { cleanup(); return h.onEnd(); }   // stumm: Text erscheint, kein Ton
        audio = new Audio(h.base + d.tts_output.url);
        audio.volume = (h.volume ?? 100) / 100;
        audio.onended = audio.onerror = () => { cleanup(); h.onEnd(); };
        audio.play().catch(() => { cleanup(); h.onEnd(); });
      } else if (ev.type === 'error') fail(d.message || d.code);
      else if (ev.type === 'run-end' && !audio) { cleanup(); h.onEnd(); }
    }, { type: 'assist_pipeline/run', start_stage: 'stt', end_stage: 'tts', input: { sample_rate: 16000 }, ...(h.pipeline && { pipeline: h.pipeline }) });
  } catch (e) { fail(e.message || String(e)); }
  return { stop: cleanup };
}
