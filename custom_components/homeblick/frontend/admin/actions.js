// Aktionen auf einem Display, die mehrere Ansichten brauchen: Layout kopieren/importieren/exportieren, Vorlage auf andere, Umbenennen, Entfernen, Bildschirmfoto.
import { tx } from '../i18n.js';
import { FACE_TYPES, normFaces } from '../faces.js';
import { ESP_FORMAT, FORMAT, espExport, remapConfig } from '../share.js';
import { ask, esc, guard, ic, modal, prompt, toast } from './ui.js';
import { S, byId, call, cur, emit, mutate, reload, snap, closeDoc } from './state.js';
import { entOf, entsIn } from './entities.js';
import { autoTitle, stripArea, tileIcon } from './meta.js';
import { dl } from './util.js';

const SKIP = ['place', 'weather', 'pipeline', 'mic', 'out', 'presence', 'lux'];   // gehören zum Raum/Gerät, nicht zur Vorlage
const sameCfg = c => JSON.stringify(c);
const remap = (config, area) => remapConfig(config, area, { en: entOf, inArea: entsIn, title: (e, a = e.area) => stripArea(e, a) || autoTitle(e) });
/** Entwurf als Ganzes ersetzen (ein Rückgängig-Schritt); der Nutzer sendet danach selbst. */
export const replaceDraft = (label, config) => mutate(label, c => { for (const k of Object.keys(c)) delete c[k]; Object.assign(c, structuredClone(config)); normFaces(c); });

export async function copyLayoutFrom(id) {
  const src = byId(id), d = cur();
  if (S.saved !== sameCfg(S.cfg) && !await ask(tx('Der nicht gesendete Entwurf von „{dst}“ wird durch das Layout von „{src}“ ersetzt.', { dst: d.name, src: src.name }), { ok: tx('Layout ersetzen'), danger: true })) return;
  const { config } = await call('get_config', { display: id }).catch(() => ({}));
  if (!config?.faces) return toast(tx('Quelle hat noch keine Konfiguration'), { bad: true });
  replaceDraft(tx('Layout von {name} kopiert', { name: src.name }), config);
  toast(tx('Layout von „{name}“ kopiert. Mit „Senden“ geht es ans Display.', { name: src.name }));
}
export const exportLayout = () => dl(`homeblick-${S.sel}.json`, { format: FORMAT, name: cur().name, area: cur().area, config: S.cfg });
export const exportEsp = () => dl(`homeblick-esp-${S.sel}.json`, espExport(cur(), S.cfg, { en: entOf, icon: tileIcon }));
export function importLayout() {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
  inp.onchange = async () => {
    let j;
    try { j = JSON.parse(await inp.files[0].text()); } catch { return toast(tx('Keine gültige JSON-Datei'), { bad: true }); }
    if (j?.format !== FORMAT || !Array.isArray(j.config?.faces) || !j.config.faces.some(f => FACE_TYPES.includes(f?.type))) return toast(tx('Das ist keine Homeblick-Sicherung'), { bad: true });
    if (S.saved !== sameCfg(S.cfg) && !await ask(tx('Der nicht gesendete Entwurf wird durch das importierte Layout ersetzt.'), { ok: tx('Layout ersetzen'), danger: true })) return;
    replaceDraft(tx('Layout importiert'), j.config);
    toast(tx('Layout importiert. Mit „Senden“ geht es ans Display.'));
  };
  inp.click();
}
/** Einstellungen (Bildschirmschoner, Nachtmodus …) eines anderen Displays übernehmen; wirkt sofort. */
export async function copySettingsFrom(id) {
  const src = byId(id), d = cur();
  if (!await ask(tx('Die Einstellungen von „{src}“ ersetzen die von „{dst}“. Wetter-Ort, Assist-Pipeline, Lichtsensor und Präsenzmelder bleiben.', { src: src.name, dst: d.name }), { ok: tx('Übernehmen') })) return false;
  const s = Object.fromEntries(Object.entries(src.settings).filter(([k]) => !SKIP.includes(k)));
  await guard(call('update', { display: d.id, settings: s }), tx('Einstellungen übernommen')).catch(() => 0);
  Object.assign(d.settings, s); emit('list'); return true;
}
/** Das gezeigte Layout (und die Einstellungen) auf andere Displays anwenden; wirkt sofort auf diesen. */
export async function applyToOthers() {
  const src = cur(), others = S.displays.filter(x => x.id !== src.id && !x.new);
  if (!others.length) return toast(tx('Kein anderes Display vorhanden'), { bad: true });
  const areas = [...new Set(others.map(x => x.area).filter(Boolean))].sort();
  let box;
  const r = await modal(`<div class="dh"><h2>${tx('Auf andere Displays anwenden')}</h2><button class="icon-btn" data-r="" aria-label="${tx('Schließen')}">${ic('x')}</button></div>
    ${areas.length ? `<div class="chips">${areas.map(a => `<button class="btn quiet mini" data-area="${esc(a)}">${esc(tx('Alle in {area}', { area: a }))}</button>`).join('')}</div>` : ''}
    <div class="rows">${others.map(x => `<label class="srow"><span><span class="s-label">${esc(x.name)}</span><small>${esc(x.area || tx('ohne Bereich'))}</small></span><input type="checkbox" data-id="${esc(x.id)}" style="width:auto"></label>`).join('')}</div>
    <label class="srow"><span><span class="s-label">${tx('Entities an den Bereich anpassen')}</span><small>${tx('Jede Kachel wird gegen die Entity gleicher Art im Bereich des Ziels getauscht; ohne Gegenstück fällt sie weg.')}</small></span><input type="checkbox" id="fit" checked style="width:auto"></label>
    <p class="hint">${tx('Ersetzt Ansichten, Kacheln und Einstellungen der gewählten Displays sofort. Wetter-Ort, Assist-Pipeline, Lichtsensor und Präsenzmelder bleiben. Es gilt der Stand, den du gerade siehst, auch ungesendete Änderungen.')}</p>
    <div class="acts"><button class="btn quiet" data-r="">${tx('Abbrechen')}</button><button class="btn primary" data-r="go">${tx('Anwenden')}</button></div>`, { cls: 'wide', label: tx('Auf andere Displays anwenden'), init: dlg => { box = dlg; dlg.addEventListener('click', e => { const a = e.target.closest('[data-area]'); if (!a) return; const on = a.classList.toggle('on'); dlg.querySelectorAll('[data-id]').forEach(c => { if (others.find(x => x.id === c.dataset.id).area === a.dataset.area) c.checked = on; }); }); } });
  if (r !== 'go') return;
  const ids = [...box.querySelectorAll('[data-id]:checked')].map(c => c.dataset.id), fit = box.querySelector('#fit').checked;   // das entfernte Fenster behält seine Eingaben
  if (!ids.length) return;
  const { place, weather, pipeline, mic, out, presence, lux, ...s } = src.settings;
  let dropped = 0;
  await guard(Promise.all(ids.map(id => {
    const t = byId(id); let c = S.cfg;
    if (fit && t.area && entsIn(t.area).length) { const r = remap(S.cfg, t.area); c = r.config; dropped += r.dropped; }
    return call('admin_config', { display: id, config: c }).then(() => call('update', { display: id, settings: s }));
  })), ids.length > 1 ? tx('{n} Displays aktualisiert', { n: ids.length }) : tx('{n} Display aktualisiert', { n: ids.length })).catch(() => 0);
  if (dropped) toast(dropped > 1 ? tx('{n} Kacheln ohne Gegenstück im Bereich weggelassen', { n: dropped }) : tx('{n} Kachel ohne Gegenstück im Bereich weggelassen', { n: dropped }), { bad: true });
}

const target = id => (typeof id === 'string' ? byId(id) : cur());   // aus der Übersicht mit Kennung, sonst das geöffnete Display
export async function renameDisplay(id) {
  const d = target(id), v = await prompt(tx('Name des Displays'), d.name, { ok: tx('Umbenennen') });
  if (!v?.trim() || v.trim() === d.name) return;
  await guard(call('update', { display: d.id, name: v.trim() })).catch(() => 0);
  d.name = v.trim(); emit('list');
}
export async function removeDisplay(id) {
  const d = target(id);
  if (!await ask(tx('„{name}“ entfernen? Ansichten und Einstellungen gehen verloren. Das Gerät und seine Entities in Home Assistant werden mit entfernt.', { name: d.name }), { ok: tx('Entfernen‖Remove'), danger: true })) return false;
  try { await guard(call('remove', { display: d.id })); } catch { return false; }   // guard zeigt den Fehler
  S.sel === d.id && (S.sel = null, S.cfg = null, S.saved = '');
  location.hash = '#/'; await reload(); toast(tx('Display entfernt')); return true;
}
/** Kopie mit gleichem Layout und gleichen Einstellungen (ohne gerätegebundene: Mikrofon, Ausgabe, Präsenz, Licht). Sie meldet sich als eigenes Display; das Gerät öffnet dazu ?display=<Kennung>. */
export async function duplicateDisplay(id) {
  const src = target(id), { config } = await call('get_config', { display: src.id }).catch(() => ({}));
  if (!config?.faces) return toast(tx('Quelle hat noch keine Konfiguration'), { bad: true });
  const name = tx('{name} Kopie', { name: src.name }).slice(0, 60), base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'display';
  let nid = base; for (let i = 2; byId(nid); i++) nid = `${base}-${i}`;
  const { mic, out, presence, lux, ...settings } = src.settings;
  try {
    await guard(call('register', { display: nid, name }));
    await guard(call('setup', { display: nid, name, ...(src.area && { area: src.area }), config, settings }));
  } catch { return; }
  await reload(); toast(tx('„{name}“ angelegt. Auf dem Gerät ?display={id} an die Adresse hängen.', { name, id: nid }));
}
/** Bildschirmfoto aufnehmen und als Bild der Karte merken. */
export async function screenshot(btn) {
  btn && (btn.disabled = true);
  const img = await snap(S.sel);
  btn && (btn.disabled = false);
  if (!img) toast(tx('Keine Antwort vom Display'), { bad: true });
  return img;
}
