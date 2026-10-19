// Bildschirmfoto der eigenen Seite (für die Vorschau im Admin-Panel): DOM → SVG-foreignObject → Canvas → JPEG.
// Grenzen: Bilder von fremden Servern, Video (Kamera) und WebGL fehlen; Canvas-Inhalte werden übernommen.
export async function shot(width = 480) {
  const w = innerWidth, h = innerHeight, root = document.documentElement.cloneNode(true);
  const live = document.querySelectorAll('canvas'), copy = root.querySelectorAll('canvas');
  live.forEach((c, i) => { try { const im = new Image(); im.src = c.toDataURL(); im.style.cssText = c.style.cssText; im.className = c.className; copy[i].replaceWith(im); } catch {} });
  root.querySelectorAll('script,video,iframe').forEach(e => e.remove());
  const cm = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT); for (let n, l = []; (n = cm.nextNode()) ? l.push(n) : (l.forEach(c => c.remove()), 0););   // '--' in Kommentaren ist kein gültiges XML
  const f = document.querySelector('#faces'), x = f?.scrollLeft || 0;   // Scrollstand des Face-Streifens nachbilden
  if (x) root.querySelectorAll('#faces > *').forEach(e => e.style.translate = `${-x}px 0`);
  root.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(root)}</foreignObject></svg>`;
  const img = new Image();
  await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('shot')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  const c = Object.assign(document.createElement('canvas'), { width, height: Math.round(width * h / w) });
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .7);
}
