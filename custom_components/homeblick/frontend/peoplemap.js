// Personen-Karte („Wo ist?“): die neue HA-Karte (OSM-Vektorkacheln, HA ≥ 2026.10) statt der Liste.
// Stil, Kacheln, Schriften und Sprites liefert HA selbst (/static/map/light.json, /api/map_tiles/…, Integration map_tiles); hier kommt nur das Kachel-Token per WebSocket dazu.
// ponytail: nicht interaktiv (Wisch gehört dem Pager), Stil fix hell, Fit auf alle Personen; wirft bei Fehler → die Liste bleibt stehen
const VENDOR = new URL('./vendor/', import.meta.url).href;
const TOKEN_MS = 10 * 60 * 1000;   // Core wechselt das Token alle 30 min und hält zwei gültig
let lib, token, tokenAt = 0;
const loadLib = () => lib ??= (async () => {
  document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: VENDOR + 'maplibre-gl.css' }));
  const m = await import(VENDOR + 'maplibre-gl.js');
  m.setWorkerUrl(VENDOR + 'maplibre-gl-worker.js');
  return m;
})();
const fresh = async conn => {
  if (token && Date.now() - tokenAt < TOKEN_MS) return;
  token = (await conn.sendMessagePromise({ type: 'map_tiles/access_token' })).token; tokenAt = Date.now();
};
// Stil aus HA; die Pfade darin sind relativ, der Worker braucht absolute
async function loadStyle(base) {
  const r = await fetch(base + '/static/map/light.json'); if (!r.ok) throw new Error('Kartenstil ' + r.status + ' (HA < 2026.10?)');
  const s = await r.json(), abs = u => u.startsWith('/') ? base + u : u;
  s.glyphs = abs(s.glyphs);
  s.sprite = Array.isArray(s.sprite) ? s.sprite.map(p => ({ ...p, url: abs(p.url) })) : s.sprite && abs(s.sprite);
  for (const k in s.sources) if (s.sources[k].url) s.sources[k].url = abs(s.sources[k].url);
  s.projection = { type: 'mercator' };   // Globus nur beim Herauszoomen, hier unnötig
  return s;
}

/** pts: [{ id, lat, lon, html }] – html = Inhalt des Markers (Avatar + .lb); liefert { set(pts), destroy() } */
export async function mount(box, conn, base) {
  const [ml, style] = await Promise.all([loadLib(), loadStyle(base), fresh(conn)]);
  conn.addEventListener('ready', () => { tokenAt = 0; });   // HA-Neustart: neues Token
  const same = base === location.origin;
  const map = new ml.Map({
    container: box, style, interactive: false, fadeDuration: 0, attributionControl: { compact: true }, center: [0, 0], zoom: 1,
    transformRequest: u => {   // Kachel-URLs aus dem TileJSON sind relativ → gegen HA auflösen, dann Token anhängen
      const url = new URL(u, base).href;
      return !url.startsWith(base + '/api/map_tiles/') ? undefined : same ? { url, headers: { 'X-Map-Tiles-Token': token } } : { url: url + (url.includes('?') ? '&' : '?') + 'token=' + token };
    },
  });
  await new Promise((ok, no) => { map.once('load', ok); setTimeout(() => no(new Error('Karte lädt nicht')), 10000); }).catch(e => { map.remove(); throw e; });
  const marks = new Map(); let key = '';
  return {
    async set(pts) {
      await fresh(conn).catch(() => {});
      const w = box.clientWidth, cell = p => p.lat.toFixed(4) + p.lon.toFixed(4), n = {}, slot = {};
      for (const p of pts) n[cell(p)] = (n[cell(p)] || 0) + 1;
      for (const [id, m] of marks) if (!pts.some(p => p.id === id)) { m.remove(); marks.delete(id); }
      for (const p of pts) {   // mehrere Personen am selben Ort (~10 m): nebeneinander statt übereinander
        const g = cell(p), i = slot[g] = (slot[g] ?? -1) + 1, off = (i - (n[g] - 1) / 2) * w * .2;
        let m = marks.get(p.id);
        if (!m) { const el = document.createElement('div'); el.className = 'pm'; m = new ml.Marker({ element: el, offset: [off, 0] }).setLngLat([p.lon, p.lat]).addTo(map); marks.set(p.id, m); }
        m.setLngLat([p.lon, p.lat]).setOffset([off, 0]);
        if (m._h !== p.html) m.getElement().innerHTML = m._h = p.html;
      }
      const k = pts.map(p => p.id + p.lat.toFixed(3) + p.lon.toFixed(3)).join(); if (k === key || !pts.length) return;   // nur bei neuen Orten neu einpassen (~100 m)
      const b = new ml.LngLatBounds([pts[0].lon, pts[0].lat], [pts[0].lon, pts[0].lat]); for (const p of pts) b.extend([p.lon, p.lat]);
      const slow = key && !matchMedia('(prefers-reduced-motion: reduce)').matches && !document.documentElement.classList.contains('perf');
      map.fitBounds(b, { padding: { top: w * .26, bottom: w * .2, left: w * .16, right: w * .16 }, maxZoom: 15, duration: slow ? 700 : 0 }); key = k;
    },
    destroy() { map.remove(); },
  };
}
