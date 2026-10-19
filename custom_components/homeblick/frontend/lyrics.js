// Liedtext über LRCLIB: gestufte Suche (exakt → Titel+Interpret → Titel), Treffer nach Interpret/Dauer gefiltert,
// Uploads mit gestauchten Zeitstempeln verworfen. parseLRC kennt mehrere Stempel pro Zeile, [offset:] und 2-/3-stellige Bruchteile.
const API = 'https://lrclib.net/api/';

export function parseLRC(txt) {
  const off = +(txt.match(/^\[offset:\s*(-?\d+)\]/m)?.[1] || 0) / 1000;   // ponytail: positiver Offset = Text früher (LRC-Konvention, ungeprüft)
  return txt.split('\n').flatMap(l => {
    const stamps = [...l.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const s = l.replace(/\[[^\]]*\]/g, '').trim();
    return stamps.map(m => ({ t: Math.max(0, m[1] * 60 + +m[2] - off), s }));
  }).sort((a, b) => a.t - b.t);
}

const norm = s => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const primary = a => (a || '').split('/')[0].trim();
// gestauchte Zeitstempel: ab 6 Stempeln und >30 s Songlänge darf die Textspanne nicht unter 30 % liegen
const squashed = (h, dur) => { const L = parseLRC(h.syncedLyrics); return L.length >= 6 && dur > 30 && L.at(-1).t - L[0].t < dur * 0.3; };

export function pick(hits, artist, dur) {
  const ok = hits.filter(h => h.syncedLyrics && !squashed(h, h.duration || dur));
  const byArtist = h => norm(h.artistName) === norm(primary(artist)), byDur = h => !dur || Math.abs(h.duration - dur) <= 7;
  const best = (f) => ok.filter(f).sort((x, y) => Math.abs(x.duration - dur) - Math.abs(y.duration - dur))[0];
  return best(h => byArtist(h) && byDur(h)) || best(byArtist) || best(byDur)
    || hits.find(h => h.plainLyrics || h.instrumental);   // ohne Zeitstempel: Klartext bzw. „Instrumental“
}

// a: media_player-Attribute; get: url → JSON | null (404 = null)
export async function findLyrics(a, get) {
  const artist = primary(a.media_artist), dur = a.media_duration || 0, title = a.media_title;
  const q = o => new URLSearchParams(o).toString();
  const exact = await get(API + 'get?' + q({ track_name: title, artist_name: artist, ...(dur && { duration: Math.round(dur) }) })).catch(() => null);
  if (exact?.syncedLyrics && !squashed(exact, dur)) return exact;
  for (const url of [API + 'search?' + q({ track_name: title, artist_name: artist }), API + 'search?' + q({ q: title.replace(/[^\p{L}\p{N}\s]+/gu, ' ') })]) {
    const h = pick(await get(url).catch(() => []) || [], artist, dur);
    if (h?.syncedLyrics || h?.plainLyrics || h?.instrumental) return h;
  }
  return exact?.plainLyrics || exact?.instrumental ? exact : null;
}

// Selbsttest: node lyrics.js
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('lyrics.js')) {
  const eq = (a, b, m) => console.assert(JSON.stringify(a) === JSON.stringify(b), m, JSON.stringify(a));
  eq(parseLRC('[00:01.50] a\n[01:02]\nx'), [{ t: 1.5, s: 'a' }, { t: 62, s: '' }], 'basis');
  eq(parseLRC('[00:10.250][00:20]chorus'), [{ t: 10.25, s: 'chorus' }, { t: 20, s: 'chorus' }], 'mehrfach/3-stellig');
  eq(parseLRC('[offset:500]\n[00:10]x').map(l => l.t), [9.5], 'offset');
  const lrc = (n, step) => Array.from({ length: n }, (_, i) => `[${String(Math.floor(i * step / 60)).padStart(2, '0')}:${String(i * step % 60).padStart(2, '0')}]z`).join('\n');
  const hits = [
    { artistName: 'Andere', duration: 200, syncedLyrics: lrc(10, 18) },
    { artistName: 'Band', duration: 300, syncedLyrics: lrc(10, 28) },
    { artistName: 'Band', duration: 201, syncedLyrics: '[00:01]a\n[00:02]b\n[00:03]c\n[00:04]d\n[00:05]e\n[00:06]f' },   // gestaucht
    { artistName: 'Band', duration: 202, syncedLyrics: '[00:01]a\n[00:50]b\n[01:20]c\n[01:50]d\n[02:20]e\n[02:50]f' },
  ];
  eq(pick(hits, 'Band / Gast', 200).duration, 202, 'Interpret+Dauer, gestauchte verworfen');
  eq(pick(hits.slice(0, 2), 'Band', 200).duration, 300, 'nur Interpret');
  console.log('ok');
}
