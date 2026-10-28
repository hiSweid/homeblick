// Jedes statisch importierte Modul von index.html muss als <link rel="modulepreload"> in index.html stehen: node tests/preload.test.mjs
import fs from 'node:fs';
import path from 'node:path';
const dir = new URL('../custom_components/homeblick/frontend/', import.meta.url).pathname, html = fs.readFileSync(dir + 'index.html', 'utf8');
const seen = new Set(), walk = f => {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/(?:^|\n)\s*import\s+(?:[^'"\n]*?from\s+)?['"](\.[^'"]+)['"]/g)) {
    const g = path.resolve(path.dirname(f), m[1]); if (fs.existsSync(g) && !seen.has(g)) { seen.add(g); walk(g); }
  }
};
walk(dir + 'index.html');
const pre = new Set([...html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map(m => path.resolve(dir, m[1])));
const missing = [...seen].filter(f => !pre.has(f)), extra = [...pre].filter(f => !seen.has(f));
for (const f of missing) console.error('fehlt: ' + path.relative(dir, f));
for (const f of extra) console.error('überflüssig: ' + path.relative(dir, f));
console.log(missing.length || extra.length ? 'modulepreload unvollständig' : `ok (${seen.size} Module)`); process.exit(missing.length || extra.length ? 1 : 0);
