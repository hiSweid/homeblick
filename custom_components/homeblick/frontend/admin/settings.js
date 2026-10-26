// Reiter „Einstellungen“ eines Displays: Karten mit Zeilen, alles wirkt sofort (außer Theme, das gehört zum Entwurf des Layouts).
import { $, choose, esc, guard, ic, toast } from './ui.js';
import { S, call, cur, emit, mutate, on, setSetting } from './state.js';
import { THEME_SET, THEMES, MODES, TYPES, WAKE, bgCss, themeApply, themeCur } from './meta.js';
import { ago } from './util.js';
import { bind, entityRow, numberRow, selectRow, sliderRow, switchRow, textRow, timeRow, sroww } from './controls.js';
import { copyLayoutFrom, copySettingsFrom, applyToOthers, exportEsp, exportLayout, importLayout, removeDisplay, renameDisplay, screenshot } from './actions.js';

export const spot = { key: null };
export const INDEX = [['bright', 'Helligkeit'], ['lux', 'Lichtsensor (Lux)'], ['perf', 'Leistungsmodus'], ['idle', 'Bildschirmschoner nach Inaktivität'], ['saver', 'Bildschirmschoner: Seite'], ['music', 'Musik statt Schoner'], ['black', 'Ganz schwarz statt Seite'], ['sched', 'Schoner-Zeitplan'], ['hold', 'Schoner halten'],
  ['dim', 'Nachts abdunkeln'], ['dim_level', 'Nachtmodus Stärke'], ['wake', 'Wake Word'], ['wake_sens', 'Wake-Word-Empfindlichkeit'], ['mute', 'Antworten stumm'], ['volume', 'Lautstärke der Antworten'], ['tts', 'Stimme für Ansagen'], ['pipeline', 'Assist-Pipeline'], ['micmute', 'Mikrofon stumm'], ['guest', 'Gastmodus'], ['dnd', 'Nicht stören'], ['chime', 'Gong beim Klingeln'],
  ['presence', 'Bewegungs- und Präsenzmelder'], ['kz', 'Kontrollzentrum'], ['name', 'Name des Displays']];   // Zeile, die ⌘K beim Öffnen hervorheben soll
const DEPS = { dim_from: s => s.dim, dim_to: s => s.dim, dim_level: s => s.dim, sched_from: s => s.sched, sched_to: s => s.sched, wake_sens: s => s.wake !== 'off', barge: s => s.wake !== 'off', mute: s => true };
const card = (id, icon, title, body, hint = '') => `<section class="set-card" id="set-${id}"><h4>${ic(icon)}<span>${title}</span></h4>${body}${hint ? `<p class="hint">${hint}</p>` : ''}</section>`;
const live = d => {
  const i = d.info || {}, row = (l, v, on_) => `<div class="srow"><span class="s-label">${l}</span><span class="s-val">${on_ != null ? `<i class="led ${on_ ? 'ok' : ''}"></i>` : ''}${v}</span></div>`;
  return (d.seen ? [
    row('Verbindung', d.connected ? 'Online' : 'Offline', d.connected),
    row('Mikrofon', i.mic ? 'Verfügbar' : i.secure === false ? 'Braucht https' : 'Nicht verfügbar', !!i.mic),
    row('Wake Word', i.wake ? 'Hört zu · ' + esc(i.wake.replace(/_v.*/, '')) : 'Aus', !!i.wake),
    row('Bildschirm wach', i.wakelock ? 'Aktiv' : i.secure === false ? 'Braucht https' : 'Aus', !!i.wakelock),
    row('Fenster', i.w ? `${esc(i.w)} × ${esc(i.h)}${i.visible === false ? ' · verdeckt' : ''}` : '–'),
    row('Zuletzt gesehen', ago(d.seen)),
    i.v ? row('Version', esc(i.v) + (d.outdated ? ' · veraltet' : ''), !d.outdated) : '',
  ].join('') : row('Noch nie verbunden', '–'))
  + (d.logs?.length ? `<div class="srow-h">Letzte Fehler</div>${d.logs.slice().reverse().map(m => `<div class="srow"><span><span class="s-label">${esc(m.message)}</span><small>${m.level === 'error' ? 'Fehler' : 'Warnung'} · ${ago(m.t)}</small></span></div>`).join('')}<p class="hint">Stehen auch im Home-Assistant-Protokoll. Diagnose: Gerät des Displays → ⋮ → Diagnose herunterladen.</p>` : '');
};

export function mount(el, { here }) {
  const d = cur(), s = () => cur().settings, faces = () => S.cfg?.faces, cmd = (action, extra = {}) => guard(call('command', { display: S.sel, action, ...extra })).catch(() => {});
  let dur = '';
  const saverTypes = () => faces() ? TYPES.filter(([t]) => t === s().saver || faces().some(f => f.type === t)) : TYPES;
  const off = () => (cur().connected ? '' : 'disabled');
  function html() {
    const x = s(), dis = off();
    const quick = [['reload', 'Neu laden', 'refresh'], ['assist', 'Assist', 'mic'], ['stop', 'Abbrechen', 'x'], ['screensaver', 'Ruhemodus', 'moon'], ['wake', 'Aufwecken', 'sun']];
    return `<div class="status-line" id="set-status" role="status"></div><div class="set-grid">
      ${card('general', 'monitor', 'Allgemein', textRow('Name', 'name', cur().name, { max: 60 }, '', 'name') + sroww('Bereich', '', `<span class="s-val">${esc(cur().area || 'kein Bereich in Home Assistant')}</span>`))}
      ${card('control', 'refresh', 'Steuerung & Ansage', `<div class="quick">${quick.map(([c, n, i]) => `<button class="btn quiet" data-cmd="${c}" ${dis}>${ic(i)}${n}</button>`).join('')}</div>
        ${sroww('Zurück nach (s, leer = bleibt)', '', `<input type="number" data-k="dur" min="1" max="3600" value="${esc(dur)}" style="width:90px" inputmode="numeric">`)}
        ${selectRow('Seite anzeigen', 'show', [['', 'Wählen …'], ...TYPES], '', '', 'show')}
        ${textRow('Ansage', 'say', '', { ph: 'Das Essen ist fertig', max: 300 }, '', 'say')}
        <div class="s-actions"><button class="btn quiet" data-cmd="say" ${dis}>Ansagen</button><button class="btn quiet" data-cmd="testnb" ${dis}>Testbenachrichtigung</button></div>`,
        'Steuerung geht, solange das Display geöffnet ist. Die Ansage erscheint als Text und wird gesprochen (außer bei „Antworten stumm“).')}
      ${card('brightness', 'sun', 'Helligkeit', sliderRow('Helligkeit', 'bright', 10, 100, 5, x.bright, '', ' %', 'bright') + entityRow('Lichtsensor (Lux)', 'lux', x.lux, { domains: ['sensor'], dcs: ['illuminance'], none: 'Keiner', title: 'Lichtsensor' }, 'Dunkler Raum dimmt bis auf 30 %', 'lux') + switchRow('Leistungsmodus', 'perf', x.perf, 'Keine Animationen, für schwache Tablets', 'perf'), 'Software-Abdunklung, keine Hardware-Helligkeit.')}
      ${card('saver', 'moon', 'Bildschirmschoner', numberRow('Nach Inaktivität', 'idle', x.idle, { min: 0, max: 3600, step: 10, unit: ' s' }, '0 schaltet ihn aus', 'idle') + selectRow('Seite', 'saver', saverTypes(), x.saver, '', 'saver') + switchRow('Musik statt Schoner', 'music', x.music, '', 'music') + switchRow('Ganz schwarz', 'black', x.black, 'Statt der Seite', 'black') + switchRow('Zeitplan', 'sched', x.sched, 'Startet nach 30 s Ruhe', 'sched') + timeRow('Von', 'sched_from', x.sched_from, '', 'sched_from') + timeRow('Bis', 'sched_to', x.sched_to, '', 'sched_to') + switchRow('Schoner halten', 'hold', x.hold, 'Er startet nicht (Kochen, Präsentieren)', 'hold'))}
      ${card('night', 'moon', 'Nachtmodus', switchRow('Nachts abdunkeln', 'dim', x.dim, 'Ein Tipp hellt für 30 Sekunden auf', 'dim') + timeRow('Von', 'dim_from', x.dim_from, '', 'dim_from') + timeRow('Bis', 'dim_to', x.dim_to, '', 'dim_to') + sliderRow('Stärke', 'dim_level', 10, 95, 5, x.dim_level, '', ' %', 'dim_level'))}
      ${card('voice', 'mic', 'Sprache & Mikrofon', selectRow('Wake Word', 'wake', WAKE, x.wake, '', 'wake') + sliderRow('Empfindlichkeit', 'wake_sens', 10, 95, 5, x.wake_sens, '', ' %', 'wake_sens') + switchRow('Antworten stumm', 'mute', x.mute, '', 'mute') + switchRow('Wake Word unterbricht', 'barge', x.barge, 'Antwort wird abgebrochen', 'barge') + sliderRow('Lautstärke der Antworten', 'volume', 0, 100, 5, x.volume, '', ' %', 'volume') + numberRow('Aufnahme-Zeitlimit', 'listen', x.listen, { min: 3, max: 60, unit: ' s' }, '', 'listen') + selectRow('Stimme für Ansagen', 'tts', [['', 'Browser-Stimme'], ...S.ttss], x.tts, '', 'tts') + selectRow('Assist-Pipeline', 'pipeline', [['', 'Standard von Home Assistant'], ...S.pipelines], x.pipeline, '', 'pipeline') + switchRow('Mikrofon stumm', 'micmute', x.micmute, 'Assist per Tippen geht weiter', 'micmute') + switchRow('Gastmodus', 'guest', x.guest, 'Kalender, Info und Kameras zeigen ein Schloss', 'guest') + switchRow('Nicht stören', 'dnd', x.dnd, 'Kein Wake Word, keine Sprache, kein Gong', 'dnd') + switchRow('Gong beim Klingeln', 'chime', x.chime, 'Ton erst nach der ersten Berührung', 'chime'),
        'Ein Wake Word hält das Mikrofon offen und braucht https. Damit „Licht an“ den richtigen Raum trifft, dem Gerät des Displays in Home Assistant einen Bereich geben.')}
      ${card('wake', 'bolt', 'Aufwecken & Bedienung', entityRow('Bewegungs-/Präsenzmelder', 'presence', x.presence, { domains: ['binary_sensor'], dcs: ['motion', 'occupancy', 'presence'], none: 'Keiner', title: 'Melder' }, 'Solange „an“, bleibt das Display wach', 'presence') + switchRow('Kontrollzentrum', 'kz', x.kz, 'Wisch von oben rechts: Helligkeit, Lautstärke, Schalter', 'kz'))}
      ${S.cfg ? card('look', 'grid', 'Darstellung', `<div class="srow-h">Look</div>${seg2('look', THEMES, S.cfg.theme || 'liquid')}<div class="srow-h">Modus</div>${seg2('mode', MODES, S.cfg.mode || 'dark')}<div class="srow-h">Theme</div><div class="theme-grid">${THEME_SET.map(t => `<button data-theme="${t[0]}" aria-pressed="${themeCur(S.cfg) === t[0]}" title="${esc(t[1])}"><i style="background:${bgCss(t[2])}"></i><span>${esc(t[1])}</span></button>`).join('')}</div>`, 'Gehört zum Entwurf: „Speichern & senden“ schickt es ans Display. Ein Theme setzt Look, Hell/Dunkel und den Hintergrund aller Farb-Seiten.') : ''}
      ${card('status', 'info', 'Status & Bildschirmfoto', `<div id="set-live">${live(cur())}</div><div class="s-actions"><button class="btn quiet" data-cmd="shot" ${dis}>${ic('image')}Bildschirmfoto aufnehmen</button></div>${S.shots[S.sel] ? `<img class="shot" id="set-shot" src="${S.shots[S.sel]}" alt="">` : ''}`, 'Bilder von fremden Servern, Kamera-Video und WebGL fehlen im Foto.')}
      ${card('manage', 'copy', 'Vorlagen & Sicherung', `<div class="s-actions col">${[['copyl', 'copy', 'Layout kopieren von …'], ['copys', 'sliders', 'Einstellungen übernehmen von …'], ['apply', 'send', 'Auf andere Displays anwenden …'], ['xjson', 'download', 'Layout exportieren (JSON)'], ['ximport', 'upload', 'Layout importieren …'], ['xesp', 'download', 'Für ESP-Display exportieren']].map(([k, i, n]) => `<button class="btn quiet" data-m="${k}" ${S.cfg || ['copys'].includes(k) ? '' : 'disabled'}>${ic(i)}${n}</button>`).join('')}</div>`, 'Kopieren und Importieren legen nur den Entwurf an; „Speichern & senden“ schickt ihn. Die ESP-Datei enthält nur, was ein LVGL-Panel (480×480) darstellen kann; Fehlendes steht unter „skipped“.')}
      ${card('danger', 'trash', 'Display entfernen', `<div class="s-actions"><button class="btn danger" data-m="remove">${ic('trash')}Display entfernen</button></div>`, 'Seiten und Einstellungen gehen verloren. Das Gerät in Home Assistant danach unter Geräte löschen.')}
    </div>`;
  }
  const seg2 = (k, list, v) => `<span class="seg fill">${list.map(([a, n]) => `<button type="button" data-k="${k}" data-v="${a}" aria-pressed="${a === v}">${n}</button>`).join('')}</span>`;

  function deps() {
    const x = s();
    for (const [k, fn] of Object.entries(DEPS)) $(`[data-row=${k}]`, el)?.classList.toggle('inactive', !fn(x));
    const st = $('#set-status', el), c = cur();
    st.textContent = c.connected ? 'Änderungen wirken sofort am Display.' : 'Das Display ist offline. Einstellungen gelten, sobald es wieder da ist.';
  }
  const lists = { show: () => [['', 'Wählen …'], ...TYPES], saver: saverTypes, wake: () => WAKE, tts: () => [['', 'Browser-Stimme'], ...S.ttss], pipeline: () => [['', 'Standard von Home Assistant'], ...S.pipelines] };
  const setK = async (k, v, b, en, phase) => {
    if (phase === 'input') return;
    if (k === 'name') { v = String(v).trim(); if (!v) return; await guard(call('update', { display: S.sel, name: v })); cur().name = v; return emit('list'); }
    if (k === 'dur') { dur = v >= 1 ? String(Math.min(v, 3600)) : ''; return; }
    if (k === 'show') { if (v) cmd('face', { face: v, ...(+dur >= 1 && { duration: +dur }) }); b.querySelector('span').textContent = 'Wählen …'; return; }
    if (k === 'say') return;
    if (k === 'look' || k === 'mode') return mutate(k === 'look' ? 'Look geändert' : 'Modus geändert', c => { c[k === 'look' ? 'theme' : 'mode'] = v; });
    await setSetting(S.sel, { [k]: v });
    deps();
  };
  el.innerHTML = html(); deps();
  bind(el, { on: setK, listOf: k => lists[k]?.() || [], valueOf: k => k === 'show' ? '' : s()[k] ?? '' });
  el.addEventListener('click', async e => {
    const q = c => e.target.closest(c);
    const c = q('[data-cmd]');
    if (c) {
      const k = c.dataset.cmd;
      if (k === 'say') { const i = $('[data-k=say]', el); if (i.value.trim()) cmd('announce', { message: i.value.trim() }).then(() => i.value = ''); return; }
      if (k === 'testnb') { const i = $('[data-k=say]', el); return cmd('notify', { title: 'Testbenachrichtigung', message: i.value.trim() || 'Die Benachrichtigungskarte funktioniert.' }); }
      if (k === 'shot') { const img = await screenshot(c); if (img) { let t = $('#set-shot', el); if (!t) { t = Object.assign(document.createElement('img'), { className: 'shot', id: 'set-shot', alt: '' }); c.closest('.s-actions').after(t); } t.src = img; } return; }
      return cmd(k);
    }
    const t = q('[data-theme]'); if (t) { mutate('Theme geändert', cfg => themeApply(cfg, t.dataset.theme)); return $$themes(); }
    const m = q('[data-m]');
    if (m) {
      const k = m.dataset.m;
      if (k === 'xjson') return exportLayout(); if (k === 'xesp') return exportEsp(); if (k === 'ximport') return importLayout();
      if (k === 'apply') return applyToOthers(); if (k === 'remove') return removeDisplay();
      const others = S.displays.filter(x => x.id !== S.sel && !x.new);
      if (!others.length) return toast('Kein anderes Display vorhanden', { bad: true });
      const v = await choose(m, others.map(x => [x.id, x.name, x.area]), '', { width: 260 });
      if (v) return k === 'copyl' ? copyLayoutFrom(v) : copySettingsFrom(v).then(ok => ok && rebuild());
    }
  });
  const $$themes = () => { const g = $('.theme-grid', el); if (!g) return; [...g.children].forEach(b => b.setAttribute('aria-pressed', themeCur(S.cfg) === b.dataset.theme)); };
  const rebuild = () => { const sc = el.scrollTop; el.innerHTML = html(); deps(); el.scrollTop = sc; };
  const offs = [on('list', () => { const l = $('#set-live', el); if (l) l.innerHTML = live(cur()); el.querySelectorAll('[data-cmd],[data-m=remove]').forEach(b => { if (b.dataset.cmd) b.disabled = !cur().connected; }); deps(); }),
    on('doc', () => { $$themes(); const row = (k, v) => el.querySelectorAll(`[data-k=${k}]`).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v)); if (S.cfg) { row('look', S.cfg.theme || 'liquid'); row('mode', S.cfg.mode || 'dark'); } })];
  if (spot.key) { const r = $(`[data-row=${spot.key}]`, el); spot.key = null; if (r) requestAnimationFrame(() => { r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.classList.add('spotlit'); setTimeout(() => r.classList.remove('spotlit'), 1700); $('button,input', r)?.focus({ preventScroll: true }); }); }
  return () => offs.forEach(f => f());
}
