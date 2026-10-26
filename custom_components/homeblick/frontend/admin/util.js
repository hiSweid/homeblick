// Kleine Hilfen: Zeitangaben, Hinweise zu einem Display, Download.
export const ago = iso => {
  if (!iso) return '–';
  const s = (Date.now() - new Date(iso)) / 1000;
  return s < 90 ? 'gerade eben' : s < 3600 ? `vor ${Math.round(s / 60)} Min` : s < 86400 ? `vor ${Math.round(s / 3600)} Std` : `vor ${Math.round(s / 86400)} Tagen`;
};
// Was an einem Display gerade nicht stimmt: [Text, Art] (down = rot, warn = gelb)
export const issues = d => {
  const i = d.info || {}, day = Date.now() - 864e5, err = (d.logs || []).filter(m => m.level === 'error' && new Date(m.t) > day).length;
  return [!d.connected && d.seen && [`Offline seit ${ago(d.seen).replace(/^vor /, '')}`, 'down'],
    d.connected && i.secure === false && ['Ohne https: kein Mikrofon, Bildschirm geht aus', 'warn'],
    d.connected && i.visible === false && ['Fenster verdeckt', 'warn'],
    d.windows > 1 && [`${d.windows} Fenster mit derselben Display-ID offen (jedes Gerät braucht eine eigene, ?display=)`, 'warn'],
    d.connected && d.outdated && ['Alte Version geladen, Seite neu laden', 'warn'],
    err && [`${err} Fehler in den letzten 24 Std`, 'warn']].filter(Boolean);
};
export const ledOf = d => !d.connected ? 'down' : d.outdated ? 'update' : 'ok';
export const dl = (name, obj) => { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })), download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1e4); };
export const pick = (o, ...k) => Object.fromEntries(k.filter(x => x in o).map(x => [x, o[x]]));
export const swap = (a, i, j) => j >= 0 && j < a.length && ([a[i], a[j]] = [a[j], a[i]]);
export const setPath = (o, path, v) => { const k = path.split('.'); const last = k.pop(); for (const x of k) o = o[x] ||= {}; if (v === undefined) delete o[last]; else o[last] = v; };
