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
