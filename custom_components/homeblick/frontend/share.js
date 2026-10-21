// Vorlagen und Export: Entities einer Konfiguration auf einen anderen Bereich umstellen, JSON für ESP-Displays (reduzierter Kachelsatz).
import { pack, rows } from './faces.js';

export const FORMAT = 'homeblick-display/1';   // vollständige Sicherung eines Displays (Export/Import)
export const ESP_FORMAT = 'homeblick-esp/1';   // reduzierte Fassung für LVGL-Panels (480×480)

// Entities der Kacheln auf Entities des Zielbereichs umstellen: gleiche Domain und device_class, jede Entity höchstens einmal.
// Kacheln ohne Gegenstück fallen weg (dropped). en(id) → Entity {id, domain, dc, area, name}; inArea(area) → Entities des Bereichs; title(en) → Standardtitel
export function remapConfig(cfg, area, { en, inArea, title }) {
  const c = structuredClone(cfg), pool = inArea(area), used = new Set();
  let dropped = 0;
  for (const f of [...c.faces, ...(c.off || [])]) {
    if (!f.tiles) continue;
    f.tiles = f.tiles.flatMap(t => {
      const old = t.e && en(t.e);
      if (!old || old.area === area) return [t];
      const x = pool.find(p => p.domain === old.domain && p.dc === old.dc && !used.has(p.id));
      if (!x) { dropped++; return []; }
      used.add(x.id);
      const n = { ...t, e: x.id };
      if (!t.title || t.title === title(old)) n.title = title(x, area);
      if (!t.sub || t.sub === old.area) n.sub = area;
      delete n.night;   // Nachtvariante zeigt auf eine Entity des alten Bereichs
      return [n];
    });
  }
  return { config: c, dropped };
}

const ESP_FACES = ['grid', 'music', 'bigclock', 'weather'];
const ESP_DOM = ['light', 'switch', 'input_boolean', 'lock', 'scene', 'script', 'climate', 'cover', 'fan'];
const ACTION = { light: 'toggle', switch: 'toggle', input_boolean: 'toggle', lock: 'toggle', cover: 'toggle', fan: 'toggle', script: 'run', scene: 'activate', climate: 'setpoint' };

// Reduzierte Fassung: nur Faces, die das Panel kann, nur Kacheln mit einfacher Bedienung (kein Kamerabild, keine Sensoren, keine Aktionen per Dienst),
// Größen 1×1 und 2×2, Position schon im Raster (x, y) – der ESP muss nicht packen. skipped nennt, was fehlt.
export function espExport(d, cfg, { en, icon }) {
  const skipped = [], entities = new Set();
  const faces = cfg.faces.flatMap(f => {
    if (!ESP_FACES.includes(f.type)) { skipped.push({ face: f.id, why: 'Face wird vom Panel nicht dargestellt' }); return []; }
    if (f.type === 'weather') { entities.add(d.settings.weather); return [{ type: 'weather', bg: f.bg, entity: d.settings.weather }]; }
    if (f.type !== 'grid') return [{ type: f.type, bg: f.bg }];
    const tiles = (f.tiles || []).flatMap(t => {
      const e = t.e && en(t.e), name = t.title || t.kind || t.e;
      if (t.kind !== 'clock' && t.kind !== 'wx' && !(e && ESP_DOM.includes(e.domain))) { skipped.push({ face: f.id, tile: name, why: 'Kachelart wird vom Panel nicht dargestellt' }); return []; }
      const sq = (t.w || 1) === (t.h || 1) ? Math.min(t.w || 1, 2) : 1;
      return [{ kind: t.kind === 'wx' ? 'weather' : t.kind || (e.domain === 'climate' ? 'thermo' : 'entity'), ...(t.e && { entity: t.e }), title: t.title || e?.name || '', sub: t.sub || '', icon: icon(t), size: `${sq}x${sq}`, w: sq, h: sq, action: t.tap?.do === 'none' ? 'none' : e ? ACTION[e.domain] : 'none', ...(t.cs && { style: t.cs }) }];
    });
    const at = pack(tiles, rows(f)), out = [];
    tiles.forEach((t, i) => { if (!at[i]) return skipped.push({ face: f.id, tile: t.title || t.kind, why: 'Kein Platz im Raster' }); const [y, x] = at[i]; if (t.entity) entities.add(t.entity); out.push({ ...t, x, y }); });
    return [{ type: 'grid', bg: f.bg, tiles: out }];
  });
  return { format: ESP_FORMAT, display: d.id, name: d.name, screen: { w: 480, h: 480 }, grid: { cols: 3, rows: 3 }, faces, entities: [...entities].filter(Boolean), skipped };
}
