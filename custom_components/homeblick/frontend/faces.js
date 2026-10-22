// conf.faces = angezeigte Faces in der Reihenfolge des Displays (frei, in der Live-Bearbeitung der Einstellungsseite änderbar), conf.off = ausgeblendete mit ihrer Konfiguration (bleibt erhalten).
// Jedes Face hat eine eindeutige id (Typ, bei weiteren desselben Typs mit Zähler: grid, grid2, …).
const ids = list => { const n = {}; for (const f of list) f.id ||= (n[f.type] = (n[f.type] || 0) + 1) > 1 ? f.type + n[f.type] : f.type; };
// Neue eindeutige id für ein Face dieses Typs (über angezeigte und ausgeblendete)
export function faceId(conf, type) {
  const used = new Set([...conf.faces, ...(conf.off || [])].map(f => f.id));
  let n = 1; while (used.has(n > 1 ? type + n : type)) n++;
  return n > 1 ? type + n : type;
}

// Uhr (Watchface) und Kalender gibt es je Display nur einmal; das Design (Typ + Stil) und die Farbe wählt man am Face.
// Uhr: bigclock = digital, analog = analog, info = Info. Kalender: calendar = Monat, date = Datum.
export const GROUP = { bigclock: 'clock', analog: 'clock', info: 'clock', calendar: 'cal', date: 'cal' };
export const siblings = t => Object.keys(GROUP).filter(k => GROUP[k] === GROUP[t] && k !== t);
const dedupe = (list, seen) => { for (let i = 0; i < list.length; i++) { const g = GROUP[list[i].type]; if (!g) continue; if (seen.has(g)) list.splice(i--, 1); else seen.add(g); } };

// Alte Konfiguration (ohne id/off) übernehmen, fehlende Standard-Faces als ausgeschaltet ergänzen, Uhr/Kalender nur einmal; true = geändert
export function normFaces(conf, defs = []) {
  const before = JSON.stringify([conf.faces, conf.off]);
  ids(conf.faces);
  conf.off = (conf.off || []).filter(f => !conf.faces.some(a => a.id === f.id)); ids(conf.off);
  const seen = new Set(); dedupe(conf.faces, seen); dedupe(conf.off, seen);
  const d = structuredClone(defs); ids(d);
  for (const f of d) if (![...conf.faces, ...conf.off].some(x => x.id === f.id) && !seen.has(GROUP[f.type])) { conf.off.push(f); if (GROUP[f.type]) seen.add(GROUP[f.type]); }
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

// Kachel j so einsortieren, dass sie auf Rasterzelle (r, c) landet; sonst die nächstliegende mögliche Stelle
export function moveTo(tiles, j, [r, c], n) {
  const t = tiles[j], rest = tiles.filter((_, k) => k !== j);
  let best = j, bd = Infinity;
  for (let k = 0; k <= rest.length; k++) {
    const p = pack([...rest.slice(0, k), t, ...rest.slice(k)], n)[k];
    if (!p) continue;
    const d = (p[0] - r) ** 2 + (p[1] - c) ** 2;
    if (d < bd || (d === bd && Math.abs(k - j) < Math.abs(best - j))) { bd = d; best = k; }
  }
  return [...rest.slice(0, best), t, ...rest.slice(best)];
}

// Standard-Symbol je Domain (Kachel)
export const ICON = { light: 'bulb', lock: 'lock', cover: 'garage', camera: 'video', climate: 'thermo', scene: 'sun', script: 'sun', media_player: 'play', fan: 'fan', timer: 'timer', switch: 'power', input_boolean: 'power', button: 'power', input_button: 'power' };
