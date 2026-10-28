// Kleine Hilfen: Zeitangaben, Hinweise zu einem Display, Download.
import { tx } from '../i18n.js';
export const ago = (iso, off) => {   // off = für „Offline seit …“ (eigene Sätze statt Textschnipsel)
  if (!iso) return '–';
  const s = (Date.now() - new Date(iso)) / 1000;
  return off
    ? s < 90 ? tx('Offline seit gerade eben') : s < 3600 ? tx('Offline seit {n} Min', { n: Math.round(s / 60) }) : s < 86400 ? tx('Offline seit {n} Std', { n: Math.round(s / 3600) }) : tx('Offline seit {n} Tagen', { n: Math.round(s / 86400) })
    : s < 90 ? tx('gerade eben') : s < 3600 ? tx('vor {n} Min', { n: Math.round(s / 60) }) : s < 86400 ? tx('vor {n} Std', { n: Math.round(s / 3600) }) : tx('vor {n} Tagen', { n: Math.round(s / 86400) });
};
// Was an einem Display gerade nicht stimmt: [Text, Art] (down = rot, warn = gelb)
export const issues = d => {
  const i = d.info || {}, day = Date.now() - 864e5, err = (d.logs || []).filter(m => m.level === 'error' && new Date(m.t) > day).length;
  return [!d.connected && d.seen && [ago(d.seen, true), 'down'],
    d.connected && i.secure === false && [tx('Ohne https: kein Mikrofon, Bildschirm geht aus'), 'warn'],
    d.connected && i.visible === false && [tx('Fenster verdeckt'), 'warn'],
    d.connected && i.perf && [i.perfAuto ? tx('Leistungsmodus aktiv (automatisch, Bildrate zu niedrig)') : tx('Leistungsmodus aktiv, Animationen aus'), 'warn'],
    d.windows > 1 && [tx('{n} Fenster mit derselben Display-ID offen (jedes Gerät braucht eine eigene, ?display=)', { n: d.windows }), 'warn'],
    d.connected && d.outdated && [tx('Alte Version geladen, Seite neu laden'), 'warn'],
    err && [tx('{n} Fehler in den letzten 24 Std', { n: err }), 'warn']].filter(Boolean);
};
export const ledOf = d => !d.connected ? 'down' : d.outdated ? 'update' : 'ok';
export const dl = (name, obj) => { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })), download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1e4); };
export const pick = (o, ...k) => Object.fromEntries(k.filter(x => x in o).map(x => [x, o[x]]));
export const swap = (a, i, j) => j >= 0 && j < a.length && ([a[i], a[j]] = [a[j], a[i]]);
export const setPath = (o, path, v) => { const k = path.split('.'); const last = k.pop(); for (const x of k) o = o[x] ||= {}; if (v === undefined) delete o[last]; else o[last] = v; };
