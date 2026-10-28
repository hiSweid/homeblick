// Assist im Browser: Mikro (16 kHz, PCM16) → HA-Pipeline (STT → Absicht → TTS) → Antwort abspielen.
import { playSpeech } from './speak.js';
import { tx } from './i18n.js';
// Braucht einen Secure Context (https oder localhost) für getUserMedia; voiceOK() prüft das.
export const voiceOK = () => !!navigator.mediaDevices?.getUserMedia;

const WORKLET = `class P extends AudioWorkletProcessor{process(i){const c=i[0][0];if(c)this.port.postMessage(c.slice());return true}}registerProcessor('p',P)`;
const pcm16 = (id, f) => {
  const b = new Uint8Array(1 + f.length * 2), v = new DataView(b.buffer);
  b[0] = id; f.forEach((x, i) => v.setInt16(1 + i * 2, Math.max(-1, Math.min(1, x)) * 32767, true));
  return b;
};

// Mikro als 16-kHz-Float-Frames (±1 → hier int16-Skala nicht nötig); gemeinsam für Sprachlauf und Wake Word
let micLabel = '';   // gewähltes Mikrofon (Name); leer oder nicht gefunden = Standard des Geräts
export const setMic = l => { micLabel = l || ''; };
const inputs = async () => (await navigator.mediaDevices?.enumerateDevices?.().catch(() => [])  || []).filter(d => d.kind === 'audioinput' && d.label);   // Namen erst nach der ersten Freigabe
export const listMics = async () => [...new Set((await inputs()).filter(d => !/^(default|communications)$/.test(d.deviceId)).map(d => d.label))];

export async function openMic(onFrame) {
  const dev = micLabel && (await inputs()).find(d => d.label === micLabel);
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, ...(dev && { deviceId: { exact: dev.deviceId } }) } });
  const ctx = new AudioContext({ sampleRate: 16000 });
  await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
  const node = new AudioWorkletNode(ctx, 'p');
  ctx.createMediaStreamSource(stream).connect(node);
  node.port.onmessage = e => onFrame(e.data);
  return { stop: () => { stream.getTracks().forEach(t => t.stop()); ctx.close().catch(() => {}); } };
}

// HA-Fehlercodes → Klartext fürs Display (unbekannte Codes: HA-Meldung durchreichen)
const ERR = {
  'stt-no-text-recognized': tx('Ich habe nichts verstanden.'), 'stt-stream-failed': tx('Die Spracherkennung hat nicht geklappt.'), 'stt-provider-missing': tx('Keine Spracherkennung eingerichtet.'),
  'pipeline-not-found': tx('Die Assist-Pipeline wurde nicht gefunden.'), 'intent-failed': tx('Das habe ich nicht verstanden.'), 'tts-failed': tx('Die Sprachausgabe hat nicht geklappt.'),
  timeout: tx('Keine Antwort von Home Assistant.'), empty: tx('Ich habe keine Antwort bekommen.'), NotAllowedError: tx('Mikrofon-Zugriff verweigert.'), NotFoundError: tx('Kein Mikrofon gefunden.'),
};
// Stoppwörter: sagt man nur eins davon, wird der Lauf abgebrochen (kein Befehl, keine Antwort)
export const isStop = t => /^(?:(?:ok(?:ay)?|na|ja|nein|bitte|jetzt|schon|please|now)\s+)*(?:stopp?|halt(?:\s+stopp?)?|abbrechen?|abbruch|schluss|ruhe|still|leise|vergiss\s+(?:es|das)|lass\s+(?:es|gut)|nicht\s+mehr|(?:ok(?:ay)?\s+)?(?:danke|dankeschön)|cancel|never\s?mind|thank(?:s|\s+you)|enough|quiet|forget\s+(?:it|that))(?:\s+(?:bitte|danke|jetzt|mal|please|thanks|now))*$/i.test((t || '').trim().replace(/[.!?,;:]+/g, ' ').replace(/\s+/g, ' ').trim());
const errText = (code, msg) => ERR[code] || (msg ? tx('Das hat nicht geklappt: {msg}', { msg }) : tx('Das hat nicht geklappt.'));

// h: { wake? (Wake-Word-Modell, für HAs Doppelwecken-Sperre), onThink(text?), onAnswer(text, response_type), onEnd(next?), onError(msg), base, pipeline?, device?, conversation? } → { stop() }
// device = HA-Geräte-ID des Displays (Raum für „Licht an“); next = { conversation } wenn der Agent eine Rückfrage stellt
export async function voiceRun(conn, h) {
  let mic, unsub, audio, id, next, sent = false, dead = false, answered = false, wd;
  const cleanup = () => { dead = true; mic?.stop(); unsub?.(); audio?.stop(); clearTimeout(cap); clearTimeout(wd); };
  // Wachhund: kommt in der jeweiligen Phase nichts mehr von HA, nicht ewig „zuhören“ (Pipeline hängt, Verbindung weg, kein Lauf gestartet)
  const arm = ms => { clearTimeout(wd); wd = setTimeout(() => fail('timeout'), ms); };
  const endAudio = () => { if (sent || id == null) return; sent = true; conn.socket.send(new Uint8Array([id])); mic?.stop(); arm(15000); };
  const cap = setTimeout(endAudio, (h.listen || 15) * 1000);   // ponytail: Zeitlimit statt eigener VAD; HA meldet das Sprechende meist früher (stt-vad-end)
  // schon beantwortet (z. B. nur TTS kaputt): Antworttext stehen lassen, nur beenden
  const fail = (code, msg) => { cleanup(); answered ? h.onEnd(next) : h.onError(errText(code, msg)); };
  try {
    mic = await openMic(f => { if (id != null && !sent && !dead) conn.socket.send(pcm16(id, f)); });
    arm(8000);   // bis run-start
    unsub = await conn.subscribeMessage(ev => {
      if (dead) return;
      const d = ev.data;
      if (ev.type === 'run-start') { id = d.runner_data.stt_binary_handler_id; arm((h.listen || 15) * 1000 + 8000); }
      else if (ev.type === 'stt-vad-end') { endAudio(); h.onThink(); }
      else if (ev.type === 'stt-end') {
        if (isStop(d.stt_output?.text)) { endAudio(); cleanup(); return h.onEnd(); }   // Stoppwort: still beenden
        endAudio(); h.onThink(d.stt_output?.text); }
      else if (ev.type === 'intent-end') {
        const o = d.intent_output;
        if (o?.continue_conversation) next = { conversation: o.conversation_id };
        answered = true; arm(20000);   // bis tts-end/run-end
        h.onAnswer(o?.response?.speech?.plain?.speech || '', o?.response?.response_type);
      }
      else if (ev.type === 'tts-end') {
        clearTimeout(wd);
        if (h.mute) { cleanup(); return h.onEnd(next); }   // stumm: Text erscheint, kein Ton
        audio = playSpeech(conn, h.ents, { path: h.base + d.tts_output.url, media: d.tts_output.media_id, out: h.out, duck: h.duck, volume: h.volume ?? 100 });
        audio.done.then(() => { cleanup(); h.onEnd(next); });
      } else if (ev.type === 'error') {
        if (d.code === 'duplicate_wake_up_detected' || (h.conversation && d.code === 'stt-no-text-recognized')) { cleanup(); h.onEnd(); }   // anderes Display war schneller / Rückfrage ohne Antwort: still schließen
        else fail(d.code, d.message);
      }
      else if (ev.type === 'run-end' && !audio) { if (answered) { cleanup(); h.onEnd(next); } else fail('empty'); }   // Lauf zu Ende ohne Antwort: nicht stumm schließen
    }, { type: 'assist_pipeline/run', start_stage: 'stt', end_stage: 'tts', input: { sample_rate: 16000, ...(h.wake && { wake_word_phrase: h.wake }) },
      ...(h.pipeline && { pipeline: h.pipeline }), ...(h.device && { device_id: h.device }), ...(h.conversation && { conversation_id: h.conversation }) });
  } catch (e) { fail(e.name === 'NotAllowedError' || e.name === 'NotFoundError' ? e.name : e.code, e.message || String(e)); }
  return { stop: cleanup };
}
