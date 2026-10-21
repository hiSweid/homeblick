// Faces haben eine feste Reihenfolge, auf allen Displays gleich (wie bei Apple): pro Display nur ein-/ausschalten.
// conf.faces = eingeschaltete Faces in dieser Reihenfolge, conf.off = ausgeschaltete mit ihrer Konfiguration (bleibt erhalten).
// Neue Faces: id hier ergänzen und in DEF (index.html) aufnehmen.
export const ORDER = ['grid', 'music', 'bigclock', 'grid2', 'weather', 'energy', 'calendar', 'date', 'analog', 'info', 'cams'];

const ids = list => { const n = {}; for (const f of list) f.id ||= (n[f.type] = (n[f.type] || 0) + 1) > 1 ? f.type + n[f.type] : f.type; };
const rank = f => { const i = ORDER.indexOf(f.id); return i < 0 ? ORDER.length : i; };

// Alte Konfiguration (ohne id/off) übernehmen, fehlende Standard-Faces als ausgeschaltet ergänzen; true = geändert
export function normFaces(conf, defs = []) {
  const before = JSON.stringify([conf.faces, conf.off]);
  ids(conf.faces);
  conf.off = (conf.off || []).filter(f => !conf.faces.some(a => a.id === f.id)); ids(conf.off);
  const d = structuredClone(defs); ids(d);
  for (const f of d) if (![...conf.faces, ...conf.off].some(x => x.id === f.id)) conf.off.push(f);
  conf.faces.sort((a, b) => rank(a) - rank(b)); conf.off.sort((a, b) => rank(a) - rank(b));
  return JSON.stringify([conf.faces, conf.off]) !== before;
}

// 3er-Raster packen: jede Kachel an die erste freie Stelle von oben links (wie iOS-Widgets); null = passt nicht mehr
export const rows = f => f.greet ? 2 : 3;
export function pack(tiles, n) {
  const used = new Set();
  return tiles.map(t => {
    const w = t.w || 1, h = t.h || 1;
    for (let r = 0; r + h <= n; r++) for (let c = 0; c + w <= 3; c++) {
      const cells = [];
      for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) cells.push(y * 3 + x);
      if (cells.every(k => !used.has(k))) { cells.forEach(k => used.add(k)); return [r, c]; }
    }
    return null;
  });
}

// Standard-Symbol je Domain (Kachel)
export const ICON = { light: 'bulb', lock: 'lock', cover: 'garage', camera: 'video', climate: 'thermo', scene: 'sun', script: 'sun', media_player: 'play', fan: 'fan', timer: 'timer', switch: 'power', input_boolean: 'power', button: 'power', input_button: 'power' };
