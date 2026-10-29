// Drift-Test: dieselben Listen stehen an mehreren Stellen und müssen übereinstimmen: node tests/drift.test.mjs
// Neuer Ansichtstyp = FACE_TYPES (faces.js), FACES (const.py), FACE (index.html), services.yaml, strings.json + translations/*, admin/meta.js. Fehlt eine Stelle, wird er still verworfen oder von HA abgelehnt.
import fs from 'node:fs';
const root = new URL('../custom_components/homeblick/', import.meta.url).pathname, rd = p => fs.readFileSync(root + p, 'utf8');
let bad = 0;
const same = (what, a, b, an, bn) => {
  const A = new Set(a), B = new Set(b), miss = [...A].filter(x => !B.has(x)), extra = [...B].filter(x => !A.has(x));
  if (miss.length || extra.length) { bad++; console.error(`${what}: ${bn} ≠ ${an}${miss.length ? `; fehlt in ${bn}: ${miss}` : ''}${extra.length ? `; zu viel in ${bn}: ${extra}` : ''}`); }
};
const list = s => [...s.matchAll(/['"]([a-z_]+)['"]/g)].map(m => m[1]);

// ---- Ansichtstypen ----
const types = list(rd('frontend/faces.js').match(/FACE_TYPES = \[([^\]]*)\]/)[1]);
same('Ansichtstypen', types, list(rd('const.py').match(/^FACES = \[([^\]]*)\]/m)[1]), 'faces.js', 'const.py FACES');
const yaml = [...rd('services.yaml').matchAll(/options: \[([^\]]*)\]/g)].map(m => m[1].split(',').map(x => x.trim()).filter(Boolean));
yaml.forEach((o, i) => same('Ansichtstypen', types, o, 'faces.js', `services.yaml options #${i + 1}`));
const idx = rd('frontend/index.html'), a = idx.indexOf('\nconst FACE = {'), b = idx.indexOf('\n};', a);
same('Ansichtstypen', types, [...idx.slice(a, b).matchAll(/^  ([a-z]+): /gm)].map(m => m[1]), 'faces.js', 'index.html FACE');
const meta = rd('frontend/admin/meta.js');
for (const t of types) if (!new RegExp(`\\b${t}: \\[tx\\(|\\b${t}: \\['`).test(meta)) { bad++; console.error(`admin/meta.js: kein Eintrag für Ansicht „${t}“ (Name/Farbe/Symbol)`); }
for (const f of ['strings.json', 'translations/en.json', 'translations/de.json']) {
  const j = JSON.parse(rd(f)), sel = j.entity.select;
  for (const k of ['saver']) same('Ansichtstypen', types, Object.keys(sel[k].state), 'faces.js', `${f} select.${k}.state`);
}

// ---- Übersetzungen: gleiche Schlüssel in strings.json, en.json, de.json ----
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v, p + k + '.') : [p + k]);
const S = flat(JSON.parse(rd('strings.json')));
for (const f of ['translations/en.json', 'translations/de.json']) same('Übersetzungen', S, flat(JSON.parse(rd(f))), 'strings.json', f);

// ---- Einstellungen: DEFAULTS (const.py) ↔ SETTINGS (__init__.py) ↔ kiosk() (hub.py) ----
const defaults = [...rd('const.py').match(/DEFAULTS = \{([\s\S]*?)\n\}|DEFAULTS = \{([\s\S]*?)\}\nLOGS/)[0].matchAll(/"([a-z_]+)":/g)].map(m => m[1]);
const settings = [...rd('__init__.py').match(/SETTINGS = vol\.Schema\(\{([\s\S]*?)\n\}/)[1].matchAll(/vol\.Optional\("([a-z_]+)"\)/g)].map(m => m[1]);
same('Einstellungen', defaults, settings, 'const.py DEFAULTS', '__init__.py SETTINGS');

// ---- Befehle: jeder Befehl, den Python annimmt, hat im Display einen Zweig ----
const acts = list(rd('__init__.py').match(/"homeblick\/command".*?vol\.In\(\[([^\]]*)\]/)[1]);
for (const x of acts) if (!idx.includes(`c.action === '${x}'`)) { bad++; console.error(`index.html: Befehl „${x}“ wird von Python angenommen, aber im Display nicht behandelt`); }

if (bad) process.exit(1);
console.log('ok');
