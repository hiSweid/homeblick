// Tiefeneffekt-Uhr (Video 15,4 s): Person aus dem eigenen Foto freistellen, damit sie vor den Ziffern steht.
// MediaPipe Selfie-Multiclass (Haare/Haut/Kleidung) läuft einmal beim Hochladen im Browser; Ergebnis = PNG mit Alpha.
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
let seg;

// photo = quadratische Data-URL → freigestellte Person als WebP-Data-URL, null wenn kaum Person im Bild
export async function cutout(photo) {
  seg ||= (async () => {
    const { FilesetResolver, ImageSegmenter } = await import(MP + '/+esm');
    return ImageSegmenter.createFromOptions(await FilesetResolver.forVisionTasks(MP + '/wasm'),
      { baseOptions: { modelAssetPath: MODEL }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false });
  })();
  const img = new Image(); img.src = photo; await img.decode();
  const s = img.width, r = (await seg).segment(img), bg = r.confidenceMasks[0], w = bg.width, h = bg.height, p = bg.getAsFloat32Array();
  // Maske: Alpha = 1 − Hintergrund-Konfidenz, weiche Kante
  const m = new OffscreenCanvas(w, h), mi = new ImageData(w, h);
  let on = 0;
  for (let i = 0; i < p.length; i++) { const a = 1 - p[i]; mi.data[i * 4 + 3] = a * 255; on += a > .5; }
  r.close?.();
  if (on / p.length < .03) return null;
  m.getContext('2d').putImageData(mi, 0, 0);
  const c = document.createElement('canvas'), x = c.getContext('2d');
  c.width = c.height = s;
  x.filter = `blur(${s / 900}px)`; x.drawImage(m, 0, 0, s, s); x.filter = 'none';
  x.globalCompositeOperation = 'source-in'; x.drawImage(img, 0, 0);
  return c.toDataURL('image/webp', .85);
}
