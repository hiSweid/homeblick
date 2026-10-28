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
  // Beschriftung begrenzen (lange Namen laufen sonst aus dem Bild); Personen am selben Ort (.sh) nur so breit wie der Markerabstand (20 % Breite), sonst überlappen sie sich
  document.head.insertAdjacentHTML('beforeend', '<style>.pm .lb{max-width:60cqw}.pm.sh .lb{max-width:19cqw}.pm .lb b,.pm .lb span{overflow:hidden;text-overflow:ellipsis}</style>');
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
  let onErr;   // TileJSON-Fehler (z. B. Tile-Proxy ohne Internet) zählt für MapLibre trotzdem als „geladen“ → hier abbrechen, damit die Liste stehen bleibt
  await new Promise((ok, no) => { map.once('load', ok); map.on('error', onErr = e => e.sourceId && !e.tile && no(e.error || new Error('Kartenquelle'))); setTimeout(() => no(new Error('Karte lädt nicht')), 10000); })
    .finally(() => map.off('error', onErr)).catch(e => { map.remove(); throw e; });
  const marks = new Map(); let key = '';
  let first = true, foc = null, last = [], fk = '';   // foc: Person, auf die gezoomt ist (dann kein automatisches Einpassen), fk: ihr letzter Ort (~10 m)
  const valid = p => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;   // setLngLat wirft sonst und bricht set() ab
  const at = p => p.lat.toFixed(4) + p.lon.toFixed(4);
  const move = () => !matchMedia('(prefers-reduced-motion: reduce)').matches && !document.documentElement.classList.contains('perf');
  const keyOf = pts => pts.map(p => p.id + p.lat.toFixed(3) + p.lon.toFixed(3)).join();   // ~100 m
  const fit = pts => {
    const w = box.clientWidth, b = new ml.LngLatBounds([pts[0].lon, pts[0].lat], [pts[0].lon, pts[0].lat]); for (const p of pts) b.extend([p.lon, p.lat]);
    map.fitBounds(b, { padding: { top: w * .18, bottom: w * .24, left: w * .16, right: w * .16 }, maxZoom: 15, duration: !first && move() ? 700 : 0 }); first = false; key = keyOf(pts);
  };
  return {
    focus(id) {
      foc = id || null; const p = last.find(p => p.id === foc);
      if (p) fk = at(p), map.easeTo({ center: [p.lon, p.lat], zoom: 15, duration: move() ? 800 : 0 }); else if (last.length) fit(last);
    },
    async set(pts) {
      last = pts = pts.filter(valid); await fresh(conn).catch(() => {});
      const w = box.clientWidth, cell = at, n = {}, slot = {};
      for (const p of pts) n[cell(p)] = (n[cell(p)] || 0) + 1;
      for (const [id, m] of marks) if (!pts.some(p => p.id === id)) { m.remove(); marks.delete(id); }
      for (const p of pts) {   // mehrere Personen am selben Ort (~10 m): nebeneinander statt übereinander
        const g = cell(p), i = slot[g] = (slot[g] ?? -1) + 1, off = (i - (n[g] - 1) / 2) * w * .2;
        let m = marks.get(p.id);
        if (!m) { const el = document.createElement('div'); el.className = 'pm'; m = new ml.Marker({ element: el, offset: [off, 0] }).setLngLat([p.lon, p.lat]).addTo(map); marks.set(p.id, m); }
        m.setLngLat([p.lon, p.lat]).setOffset([off, 0]);
        m.getElement().classList.toggle('sh', n[g] > 1);
        if (m._h !== p.html) m.getElement().innerHTML = m._h = p.html;
      }
      if (foc && !pts.some(p => p.id === foc)) foc = null;
      const f = foc && pts.find(p => p.id === foc);
      if (f) { if (at(f) !== fk) { fk = at(f); map.easeTo({ center: [f.lon, f.lat], duration: move() ? 800 : 0 }); } }   // fokussierte Person bewegt sich → Karte folgt
      else if (pts.length && keyOf(pts) !== key) fit(pts);   // nur bei neuen Orten neu einpassen
    },
    destroy() { map.remove(); },
  };
}
