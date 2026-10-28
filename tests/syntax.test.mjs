// Syntax aller Frontend-Module und des Skripts in index.html: node tests/syntax.test.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const dir = new URL('../custom_components/homeblick/frontend/', import.meta.url).pathname, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-'));
const files = ['', 'admin/'].flatMap(d => fs.readdirSync(dir + d).filter(f => f.endsWith('.js')).map(f => dir + d + f));
for (const h of ['index.html', 'admin.html']) {
  const m = [...fs.readFileSync(dir + h, 'utf8').matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
  m.forEach((x, i) => { const f = path.join(tmp, `${h}-${i}.mjs`); fs.writeFileSync(f, x[1]); files.push(f); });
}
let bad = 0;
for (const f of files) {
  const c = path.join(tmp, path.basename(f).replace(/\.js$/, '') + '-' + bad + '.mjs'); fs.copyFileSync(f, c);   // ES-Module: als .mjs prüfen
  try { execFileSync(process.execPath, ['--check', c], { stdio: 'pipe' }); } catch (e) { bad++; console.error(f + '\n' + e.stderr.toString().split('\n').slice(0, 4).join('\n')); }
}
fs.rmSync(tmp, { recursive: true });
console.log(bad ? `${bad} Datei(en) mit Syntaxfehler` : `ok (${files.length} Dateien)`); process.exit(bad ? 1 : 0);
