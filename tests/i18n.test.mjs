// Jeder tx('…')-Schlüssel im Frontend braucht einen englischen Eintrag mit denselben {Platzhaltern}: node tests/i18n.test.mjs
import fs from 'node:fs';
import path from 'node:path';
const dir = new URL('../custom_components/homeblick/frontend/', import.meta.url).pathname;
const EN = {};
for (const f of fs.readdirSync(dir + 'lang')) Object.assign(EN, (await import(dir + 'lang/' + f)).default);
const files = ['', 'admin/'].flatMap(d => fs.readdirSync(dir + d).filter(f => /\.(js|html)$/.test(f) && f !== 'i18n.js').map(f => dir + d + f));
const ph = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join();
const used = new Set(); let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?<![.\w$])tx\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    const k = m[2].replace(/\\(['"`\\])/g, '$1'), line = src.slice(0, m.index).split('\n').length;
    if (m[1] === '`' && k.includes('${')) { bad++; console.error(`${path.relative(dir, f)}:${line} Template mit \${…} – Platzhalter {name} nutzen: ${k.slice(0, 60)}`); continue; }
    used.add(k);
    if (!(k in EN)) { bad++; console.error(`${path.relative(dir, f)}:${line} fehlt: ${k.slice(0, 70)}`); }
    else if (ph(k) !== ph(EN[k])) { bad++; console.error(`${path.relative(dir, f)}:${line} Platzhalter verschieden: ${k.slice(0, 70)}`); }
  }
}
const unused = Object.keys(EN).filter(k => !used.has(k)).length;
console.log(bad ? `${bad} Fehler` : `ok (${used.size} Schlüssel, ${unused} nur aus statischem HTML/Daten)`); process.exit(bad ? 1 : 0);
