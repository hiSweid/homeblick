// Hintergründe: jedes Motiv erzeugt gültiges SVG ohne NaN und mit allen referenzierten IDs: node tests/wallpapers.test.mjs
import assert from 'node:assert/strict';
import { bgSvg, MOTIF, hueOf, bgTint } from '../custom_components/homeblick/frontend/wallpapers.js';
const all = [30, 228, 'metal', 'prism', 'teal', 'champagne', 'prism:245', 'fan:172', 'orb:12:30', 'flow:232', 'flow:330'];
for (const b of all) for (const light of [false, true]) for (const blur of [0, 5]) {
  const s = bgSvg(b, blur, light), at = `${b} light=${light} blur=${blur}`;
  assert.match(s, /^<svg [^>]*viewBox="0 0 100 100"/, at);
  assert.ok(!/NaN|undefined|Infinity/.test(s), `${at}: ungültiger Wert`);
  for (const [, id] of s.matchAll(/url\(#([\w-]+)\)/g)) assert.ok(s.includes(`id="${id}"`), `${at}: ID ${id} fehlt`);
  assert.equal((s.match(/<(?!\/|\?)\w+/g) || []).length - (s.match(/<\w+[^>]*\/>/g) || []).length, (s.match(/<\/\w+>/g) || []).length, `${at}: Tags unausgeglichen`);
}
assert.deepEqual(MOTIF('orb:12:30'), { k: 'orb', h: 12, s: 30 });
assert.equal(MOTIF('champagne').k, 'orb'); assert.equal(MOTIF('teal').k, 'fan'); assert.equal(MOTIF(30), null);
assert.equal(hueOf('flow:232'), 232); assert.equal(hueOf('black'), null); assert.ok(bgTint('champagne') && !bgTint('prism'));
console.log(`ok (${all.length} Hintergründe)`);
