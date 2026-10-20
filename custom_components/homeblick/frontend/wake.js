// Wake Word im Browser: openWakeWord-Modelle (ONNX) über onnxruntime-web. Mikro → Mel → Embedding → Wake-Modell.
// Läuft nur, solange die Seite offen ist und das Mikrofon freigegeben wurde (https/localhost).
import { openMic } from './voice.js';

const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';   // ponytail: CDN; für Offline-Betrieb lokal ablegen
const CHUNK = 1280, WIN = CHUNK + 480;   // 80 ms neu, 3 Mel-Frames Vorlauf

// threshold: Funktion (live änderbar); onWake(score) → Promise optional; solange es läuft, ist die Erkennung pausiert (Antwort/TTS soll nicht erneut auslösen)
export async function wakeInit({ onWake, model = 'hey_jarvis_v0.1', threshold = () => 0.5 }) {
  const ort = await import(ORT + 'ort.min.mjs');
  ort.env.wasm.numThreads = 1;   // Mehrfach-Threads brauchen COOP/COEP-Header
  ort.env.wasm.wasmPaths = ORT;
  const load = n => ort.InferenceSession.create(new URL(`./wake/${n}.onnx`, import.meta.url).href);
  const [mel, emb, ww] = await Promise.all(['melspectrogram', 'embedding_model', model].map(load));
  const T = (d, shape) => new ort.Tensor('float32', d, shape);
  const out = async (m, x) => (await m.run({ [m.inputNames[0]]: x }))[m.outputNames[0]].data;

  let raw = new Float32Array(0), pend = new Float32Array(0), mels = [], feats = [], busy = false, hold = false, last = 0;
  const cat = (a, b) => { const c = new Float32Array(a.length + b.length); c.set(a); c.set(b, a.length); return c; };

  async function step(chunk) {
    raw = cat(raw, chunk).slice(-WIN);
    if (raw.length < WIN) return;
    const m = await out(mel, T(raw, [1, WIN]));
    for (let i = 0; i < m.length; i += 32) mels.push(Float32Array.from(m.subarray(i, i + 32), x => x / 10 + 2));
    mels = mels.slice(-120);
    if (mels.length < 76) return;
    const e = await out(emb, T(Float32Array.from(mels.slice(-76).flatMap(f => [...f])), [1, 76, 32, 1]));
    feats = [...feats.slice(-15), Float32Array.from(e)];
    if (feats.length < 16) return;
    const score = (await out(ww, T(Float32Array.from(feats.flatMap(f => [...f])), [1, 16, 96])))[0];
    if (score > threshold() && Date.now() - last > 2000 && !hold) {
      last = Date.now(); hold = true;
      Promise.resolve(onWake(score)).finally(() => { hold = false; mels = []; feats = []; });
    }
  }

  // Mikro liefert ±1; die Modelle erwarten int16-Skala als Float
  const mic = await openMic(async f => {
    pend = cat(pend, f.map(x => x * 32767));
    if (busy || pend.length < CHUNK) return;
    busy = true;
    try {
      while (pend.length >= CHUNK) { const c = pend.slice(0, CHUNK); pend = pend.slice(CHUNK); await step(c); }
    } finally { busy = false; }
  });
  return { stop: mic.stop };
}
