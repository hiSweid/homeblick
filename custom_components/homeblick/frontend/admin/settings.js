// Einstellungen eines Displays als Master/Detail wie die Systemeinstellungen: links die Abschnitte, rechts der gewählte (am Telefon nacheinander).
// Alles wirkt sofort, außer dem Theme: das gehört zum Entwurf des Layouts und braucht „Senden“.
import { $, $$, choose, esc, guard, ic, toast } from './ui.js';
import { S, call, cur, dirty, emit, mutate, on, redo, save, setSetting, undo } from './state.js';
import { BG_SETS, THEME_LIST, MODES, TYPES, WAKE, bgAll, bgCss, bgCur, bgVal, faceName } from './meta.js';
import { hueOf, wall } from '../wallpapers.js';
import { TH } from '../themes.js';
import { ago, ledOf } from './util.js';
import { bind, entityRow, numberRow, selectRow, sliderRow, switchRow, textRow, timeRow, sroww } from './controls.js';
import { copyLayoutFrom, copySettingsFrom, applyToOthers, exportEsp, exportLayout, importLayout, removeDisplay, renameDisplay, screenshot } from './actions.js';
import { backBtn, collapse, pane } from './nav.js';
import { tx, setLang } from '../i18n.js';
import { PILL_LISTS, pillGet, pillsAdd, pillsDel, pillsHTML, pillsSet, pillsUp } from './pills.js';

export const spot = { key: null, section: null };
const SECTIONS = [   // [Schlüssel, Name, Symbol, Farbe]; Gruppen wie in den iOS-Einstellungen
  [['general', tx('Allgemein'), 'monitor', '#8e8e93'], ['control', tx('Steuerung und Ansage'), 'refresh', '#007aff']],
  [['brightness', tx('Helligkeit'), 'sun', '#ff9500'], ['saver', tx('Bildschirmschoner'), 'moon', '#5856d6'], ['night', tx('Nachtmodus'), 'moon', '#3a3a8c']],
  [['voice', tx('Sprache und Mikrofon'), 'mic', '#ff3b30'], ['wake', tx('Aufwecken und Bedienung'), 'bolt', '#ff9f0a'], ['look', tx('Hintergrund und Theme'), 'paint', '#ff2d55'], ['pills', tx('Live-Pillen'), 'pulse', '#30d158']],
  [['status', tx('Status und Bildschirmfoto'), 'info', '#34c759'], ['manage', tx('Vorlagen und Sicherung'), 'copy', '#30b0c7']],
];
// Zeile, die ⌘K beim Öffnen hervorheben soll: [Schlüssel, Name, Abschnitt]
export const INDEX = [['bright', tx('Helligkeit'), 'brightness'], ['lux', tx('Lichtsensor (Lux)'), 'brightness'], ['perf', tx('Leistungsmodus'), 'brightness'], ['perfauto', tx('Leistungsmodus automatisch'), 'brightness'], ['shift', tx('Einbrennschutz'), 'saver'], ['idle', tx('Bildschirmschoner nach Inaktivität'), 'saver'], ['saver', tx('Bildschirmschoner: Ansicht'), 'saver'], ['music', tx('Musik statt Schoner'), 'saver'], ['black', tx('Ganz schwarz statt Ansicht'), 'saver'], ['sched', tx('Schoner-Zeitplan'), 'saver'], ['hold', tx('Schoner halten'), 'saver'],
  ['dim', tx('Nachts abdunkeln'), 'night'], ['dim_level', tx('Nachtmodus Stärke'), 'night'], ['wake', tx('Wake Word'), 'voice'], ['wake_sens', tx('Wake-Word-Empfindlichkeit'), 'voice'], ['mute', tx('Antworten stumm'), 'voice'], ['volume', tx('Lautstärke der Antworten'), 'voice'], ['tts', tx('Stimme für Ansagen'), 'voice'], ['pipeline', tx('Assist-Pipeline'), 'voice'], ['mic', tx('Mikrofon'), 'voice'], ['out', tx('Sprachausgabe über'), 'voice'], ['duck', tx('Musik bei Sprache auf'), 'voice'], ['micmute', tx('Mikrofon stumm'), 'voice'], ['guest', tx('Gastmodus'), 'voice'], ['dnd', tx('Nicht stören'), 'voice'], ['chime', tx('Gong beim Klingeln'), 'voice'],
  ['presence', tx('Bewegungs- und Präsenzmelder'), 'wake'], ['kz', tx('Kontrollzentrum'), 'wake'], ['name', tx('Name des Displays'), 'general'], ['lang', tx('Sprache‖Oberfläche'), 'general'], ['pills', tx('Live-Pillen'), 'pills']];
const langNow = () => { try { return localStorage.getItem('hb_lang') || ''; } catch { return ''; } };   // nur dieser Browser; leer = automatisch
const LANGS = () => [['', tx('Automatisch')], ['de', 'Deutsch'], ['en', 'English']];
const micList = v => [['', tx('Standard des Geräts')], ...[...new Set([...(cur().info?.mics || []), ...(v ? [v] : [])])].map(m => [m, m])];   // gewähltes, gerade fehlendes Mikro bleibt sichtbar
const DEPS = { dim_from: s => s.dim, dim_to: s => s.dim, dim_level: s => s.dim, sched_from: s => s.sched, sched_to: s => s.sched, wake_sens: s => s.wake !== 'off', barge: s => s.wake !== 'off' };
// Look-Kacheln: Liquid/Flat als Verlauf, eigene Themes als Mini-Raster mit echtem Hintergrund und Kachelmaterial (Rand: cqw → px)
const thMini = o => [[14, 14, 0], [52, 14, 0], [14, 52, 1], [52, 52, 0]].map(([x, y, on]) => `<u style="position:absolute;left:${x}%;top:${y}%;width:34%;height:34%;border-radius:22%;background:${esc(on ? o.v.on : o.v.glass)};box-shadow:${esc((on && o.v.onrim || o.v.rim).replace(/([\d.]+)cqw/g, (_, n) => n * 4 + 'px'))}"></u>`).join('');
const thGrid = cur => `<div class="bg-grid">${THEME_LIST.map(([id, n, g]) => { const o = TH(id), bg = o ? (o.bg ? thumb(o.bg, o.mode === 'light') : o.v.blk || o.v.paper || (o.mode === 'light' ? '#fff' : '#000')) : g; return `<button type="button" class="bg-tile" data-th="${id}" aria-pressed="${id === cur}"><i style="background:${esc(bg)};position:relative;overflow:hidden;display:block">${o ? thMini(o) : ''}</i><span>${esc(n)}</span></button>`; }).join('')}</div>`;
const G = (title, body, foot = '') => `<div class="sect">${title ? `<div class="group-h">${title}</div>` : ''}<div class="group">${body}</div>${foot ? `<div class="group-f">${foot}</div>` : ''}</div>`;
const thumb = (v, lit) => hueOf(bgVal(v)) == null ? bgCss(bgVal(v)) : `${wall(bgVal(v), lit)[0]} center/cover`;   // Tageszeit/Schwarz/Weiß haben kein Wallpaper
const stack = (label, control) => `<div class="stack"><span class="s-label">${label}</span>${control}</div>`;
const seg2 = (k, list, v) => `<span class="seg fill">${list.map(([a, n]) => `<button type="button" data-k="${k}" data-v="${a}" aria-pressed="${a === v}">${n}</button>`).join('')}</span>`;
const liveRows = d => {
  const i = d.info || {}, row = (l, v, on_) => `<div class="srow"><span class="s-label">${l}</span><span class="s-val">${on_ != null ? `<i class="led ${on_ ? 'ok' : ''}"></i>` : ''}${v}</span></div>`;
  return G(tx('Status'), d.seen ? [
    row(tx('Verbindung'), d.connected ? tx('Online') : tx('Offline'), d.connected),
    row(tx('Mikrofon'), i.mic ? tx('Verfügbar') : i.secure === false ? tx('Braucht https') : tx('Nicht verfügbar'), !!i.mic),
    row(tx('Wake Word'), i.wake ? esc(tx('Hört zu · {name}', { name: i.wake.replace(/_v.*/, '') })) : tx('Aus'), !!i.wake),
    row(tx('Bildschirm wach'), i.wakelock ? tx('Aktiv') : i.secure === false ? tx('Braucht https') : tx('Aus'), !!i.wakelock),
    row(tx('Fenster'), i.w ? `${esc(i.w)} × ${esc(i.h)}${i.visible === false ? ' · ' + tx('verdeckt') : ''}` : '–'),
    row(tx('Zuletzt gesehen'), ago(d.seen)),
    i.v ? row(tx('Version'), esc(i.v) + (d.outdated ? ' · ' + tx('veraltet') : ''), !d.outdated) : '',
  ].join('') : row(tx('Noch nie verbunden'), '–'))
  + (d.logs?.length ? G(tx('Letzte Fehler'), d.logs.slice().reverse().map(m => `<div class="srow"><span><span class="s-label">${esc(m.message)}</span><small>${m.level === 'error' ? tx('Fehler') : tx('Warnung')} · ${ago(m.t)}</small></span></div>`).join(''), tx('Stehen auch im Home-Assistant-Protokoll. Diagnose: Gerät des Displays → ⋮ → Diagnose herunterladen.')) : '');
};

export function mount(el, route) {
  const s = () => cur().settings, faces = () => S.cfg?.faces, cmd = (action, extra = {}) => guard(call('command', { display: S.sel, action, ...extra })).catch(() => {});
  const wide = matchMedia('(min-width:901px)'), edHash = () => `#/d/${encodeURIComponent(S.sel)}`;
  const avail = k => (k !== 'look' && k !== 'pills') || !!S.cfg;   // beide gehören zum Entwurf
  let dur = '', section = route.section || spot.section || '';
  spot.section = null;
  if (!avail(section) || !SECTIONS.flat().some(x => x[0] === section)) section = '';
  if (!section && wide.matches) section = 'general';
  const saverTypes = () => faces() ? TYPES.filter(([t]) => t === s().saver || faces().some(f => f.type === t)) : TYPES;
  const nameOf = k => SECTIONS.flat().find(x => x[0] === k)?.[1] || '';

  const SEC = {
    general: x => G('', textRow(tx('Name'), 'name', cur().name, { max: 60 }, '', 'name') + sroww(tx('Bereich'), '', `<span class="s-val">${esc(cur().area || tx('kein Bereich in Home Assistant'))}</span>`), tx('Den Bereich ändert man in Home Assistant am Gerät des Displays. Er hilft bei Sprachbefehlen („Licht an“ trifft den richtigen Raum).'))
      + G('', selectRow(tx('Sprache‖Oberfläche'), 'lang', LANGS(), langNow(), '', 'lang'), tx('Gilt für diesen Browser. Displays folgen ihrer Browsersprache oder ?lang=en in der Adresse.')),
    control: x => {
      const dis = cur().connected ? '' : 'disabled';
      return G(tx('Befehle'), `<div class="quick">${[['reload', tx('Neu laden'), 'refresh'], ['assist', 'Assist', 'mic'], ['stop', tx('Abbrechen'), 'x'], ['screensaver', tx('Ruhemodus'), 'moon'], ['wake', tx('Aufwecken'), 'sun'], ['clean', tx('Putzmodus'), 'lock']].map(([c, n, i]) => `<button class="btn quiet" data-cmd="${c}" ${dis}>${ic(i)}${n}</button>`).join('')}</div>`, tx('Steuerung geht, solange das Display geöffnet ist.'))
        + G(tx('Ansicht anzeigen'), sroww(tx('Zurück nach (s, leer = bleibt)'), '', `<input type="number" data-k="dur" min="1" max="3600" value="${esc(dur)}" placeholder="${esc(tx('bleibt'))}" inputmode="numeric">`) + selectRow(tx('Ansicht'), 'show', [['', tx('Wählen …')], ...TYPES], '', '', 'show'))
        + G(tx('Ansage'), textRow(tx('Text'), 'say', '', { ph: tx('Das Essen ist fertig'), max: 300 }, '', 'say') + `<div class="s-actions"><button class="btn quiet" data-cmd="say" ${dis}>${tx('Ansagen‖Aktion')}</button><button class="btn quiet" data-cmd="testnb" ${dis}>${tx('Testbenachrichtigung')}</button></div>`, tx('Die Ansage erscheint als Text und wird gesprochen (außer bei „Antworten stumm“).'));
    },
    brightness: x => G('', sliderRow(tx('Helligkeit'), 'bright', 10, 100, 5, x.bright, '', ' %', 'bright') + entityRow(tx('Lichtsensor (Lux)'), 'lux', x.lux, { domains: ['sensor'], dcs: ['illuminance'], none: tx('Keiner'), title: tx('Lichtsensor') }, tx('Dunkler Raum dimmt bis auf 30 %'), 'lux') + switchRow(tx('Leistungsmodus'), 'perf', x.perf, tx('Keine Animationen, für schwache Tablets'), 'perf') + switchRow(tx('Leistungsmodus automatisch'), 'perfauto', x.perfauto, tx('Schaltet bei zu niedriger Bildrate (unter 25 Bildern/s) selbst ein, standardmäßig aus'), 'perfauto'), tx('Software-Abdunklung, keine Hardware-Helligkeit.')),
    saver: x => G('', numberRow(tx('Nach Inaktivität'), 'idle', x.idle, { min: 0, max: 3600, step: 10, unit: ' s' }, tx('0 schaltet ihn aus'), 'idle') + selectRow(tx('Ansicht'), 'saver', saverTypes(), x.saver, '', 'saver') + switchRow(tx('Musik statt Schoner'), 'music', x.music, '', 'music') + switchRow(tx('Ganz schwarz'), 'black', x.black, tx('Statt der Ansicht'), 'black') + switchRow(tx('Schoner halten'), 'hold', x.hold, tx('Er startet nicht (Kochen, Präsentieren)'), 'hold') + switchRow(tx('Einbrennschutz'), 'shift', x.shift, tx('Der Schoner rückt das Bild minütlich um wenige Pixel (OLED)'), 'shift'))
      + G(tx('Zeitplan'), switchRow(tx('Zeitplan'), 'sched', x.sched, tx('Startet nach 30 s Ruhe'), 'sched') + timeRow(tx('Von'), 'sched_from', x.sched_from, '', 'sched_from') + timeRow(tx('Bis'), 'sched_to', x.sched_to, '', 'sched_to')),
    night: x => G('', switchRow(tx('Nachts abdunkeln'), 'dim', x.dim, tx('Ein Tipp hellt für 30 Sekunden auf'), 'dim') + timeRow(tx('Von'), 'dim_from', x.dim_from, '', 'dim_from') + timeRow(tx('Bis'), 'dim_to', x.dim_to, '', 'dim_to') + sliderRow(tx('Stärke'), 'dim_level', 10, 95, 5, x.dim_level, '', ' %', 'dim_level')),
    voice: x => G(tx('Wake Word'), selectRow(tx('Wake Word'), 'wake', WAKE, x.wake, '', 'wake') + sliderRow(tx('Empfindlichkeit'), 'wake_sens', 10, 95, 5, x.wake_sens, '', ' %', 'wake_sens') + switchRow(tx('Wake Word unterbricht'), 'barge', x.barge, tx('Antwort wird abgebrochen'), 'barge'), tx('Ein Wake Word hält das Mikrofon offen und braucht https.'))
      + G(tx('Antworten'), switchRow(tx('Antworten stumm'), 'mute', x.mute, '', 'mute') + sliderRow(tx('Lautstärke der Antworten'), 'volume', 0, 100, 5, x.volume, '', ' %', 'volume') + numberRow(tx('Aufnahme-Zeitlimit'), 'listen', x.listen, { min: 3, max: 60, unit: ' s' }, '', 'listen') + selectRow(tx('Stimme für Ansagen'), 'tts', [['', tx('Browser-Stimme')], ...S.ttss], x.tts, '', 'tts') + selectRow(tx('Mikrofon'), 'mic', micList(x.mic), x.mic, tx('Mikrofone des Displays; die Liste erscheint nach der ersten Freigabe'), 'mic') + entityRow(tx('Sprachausgabe über'), 'out', x.out, { domains: ['media_player'], none: tx('Dieses Display'), title: tx('Lautsprecher') }, tx('Z. B. Sonos; es braucht eine HA-Stimme'), 'out') + sliderRow(tx('Musik bei Sprache auf'), 'duck', 0, 100, 10, x.duck, tx('0 oder 100 lässt sie unverändert'), ' %', 'duck') + selectRow(tx('Assist-Pipeline'), 'pipeline', [['', tx('Standard von Home Assistant')], ...S.pipelines], x.pipeline, '', 'pipeline'), tx('Damit „Licht an“ den richtigen Raum trifft, dem Gerät des Displays in Home Assistant einen Bereich geben.'))
      + G(tx('Modi'), switchRow(tx('Mikrofon stumm'), 'micmute', x.micmute, tx('Assist per Tippen geht weiter'), 'micmute') + switchRow(tx('Gastmodus'), 'guest', x.guest, tx('Kalender, Info und Kameras zeigen ein Schloss'), 'guest') + switchRow(tx('Nicht stören'), 'dnd', x.dnd, tx('Kein Wake Word, keine Sprache, kein Gong'), 'dnd') + switchRow(tx('Gong beim Klingeln'), 'chime', x.chime, tx('Ton erst nach der ersten Berührung'), 'chime')),
    wake: x => G('', entityRow(tx('Bewegungs-/Präsenzmelder'), 'presence', x.presence, { domains: ['binary_sensor'], dcs: ['motion', 'occupancy', 'presence'], none: tx('Keiner'), title: tx('Melder') }, tx('Solange „an“, bleibt das Display wach'), 'presence') + switchRow(tx('Kontrollzentrum'), 'kz', x.kz, tx('Wisch von oben rechts: Helligkeit, Lautstärke, Schalter'), 'kz')),
    pills: () => pillsHTML(S.cfg, G),
    look: () => `<div class="look-grid"><aside class="look-pv" aria-label="${tx('Vorschau aller Ansichten')}">${S.cfg.faces.map(f => `<figure class="pv-card" data-f="${esc(f.id)}"><div class="pv-dev"><iframe title="${esc(faceName(f))}" src="index.html?preview"></iframe></div><figcaption>${esc(faceName(f))}</figcaption></figure>`).join('')}</aside><div class="look-ctl">`
      + G(tx('Look'), thGrid(S.cfg.theme || 'liquid')) + `<div id="set-mode" ${TH(S.cfg.theme) ? 'hidden' : ''}>${G(tx('Modus'), `<div class="stack">${seg2('mode', MODES, S.cfg.mode || 'dark')}</div>`)}</div>`
      + BG_SETS.map(([n, l]) => G(n, `<div class="bg-grid">${l.map(([v, t]) => `<button type="button" class="bg-tile" data-bg="${esc(v)}" aria-pressed="${String(bgCur(S.cfg)) === String(v)}"><i data-w="${esc(v)}" style="background:${esc(thumb(v, S.cfg.mode === 'light'))}"></i><span>${esc(t)}</span></button>`).join('')}</div>`)).join('')
      + `<div class="sect"><div class="group-f">${tx('Die Vorschau zeigt alle Ansichten live. Der Hintergrund gilt für alle Ansichten außer Wetter, Musik, Kalender, Kameras, Fotos und Ansichten mit eigenem Foto.')}</div></div></div></div>`,
    status: () => `<div id="set-live">${liveRows(cur())}</div>` + G(tx('Bildschirmfoto'), `<div class="s-actions"><button class="btn quiet" data-cmd="shot" ${cur().connected ? '' : 'disabled'}>${ic('image')}${tx('Aufnehmen')}</button></div>${S.shots[S.sel] ? `<img class="shot" id="set-shot" src="${esc(S.shots[S.sel])}" alt="">` : ''}`, tx('Bilder von fremden Servern, Kamera-Video und WebGL fehlen im Foto.')),
    manage: () => {
      const b = (k, i, n, ok = S.cfg) => `<button class="row tap" data-m="${k}" ${ok ? '' : 'disabled'}>${ic(i)}<span class="t"><b>${n}</b></span>${ic('right')}</button>`;
      return G(tx('Kopieren'), b('copyl', 'copy', tx('Layout kopieren von …')) + b('copys', 'sliders', tx('Einstellungen übernehmen von …'), true) + b('apply', 'send', tx('Auf andere Displays anwenden …')), tx('Kopieren und Importieren legen nur den Entwurf an; „Senden“ schickt ihn.'))
        + G(tx('Sichern'), b('xjson', 'download', tx('Layout exportieren (JSON)')) + b('ximport', 'upload', tx('Layout importieren …')) + b('xesp', 'download', tx('Für ESP-Display exportieren')), tx('Die ESP-Datei enthält nur, was ein LVGL-Panel (480×480) darstellen kann; Fehlendes steht unter „skipped“.'))
        + G('', `<button class="row danger" data-m="remove">${tx('Display entfernen')}</button>`, tx('Ansichten und Einstellungen gehen verloren. Das Gerät und seine Entities in Home Assistant werden mit entfernt.'));
    },
  };

  // ---- Zeichnen ----
  const saveBtn = () => `<button class="gpill tinted save-btn" ${dirty() ? '' : 'hidden'} ${S.busy ? 'disabled' : ''} title="${tx('Speichern und ans Display senden · ⌘S')}">${S.busy ? '<span class="spin small"></span>' : ic('send')}<span>${S.busy ? tx('Sendet …') : tx('Senden')}</span></button>`;
  const hero = () => {
    const d = cur(), l = ledOf(d);
    return `<div class="set-hero">${S.shots[d.id] ? `<img src="${esc(S.shots[d.id])}" alt="">` : `<span class="av lg" style="--c:#8e8e93">${ic('monitor')}</span>`}<span class="t"><b>${esc(d.name)}</b><small><i class="led ${l}"></i> ${l === 'ok' ? tx('Online') : l === 'update' ? tx('Alte Version') : tx('Offline')}${d.area ? ' · ' + esc(d.area) : ''}</small></span></div>`;
  };
  const sideBody = () => {
    return hero()
      + SECTIONS.map(g => `<div class="sect"><div class="group side-list">${g.filter(x => avail(x[0])).map(([k, n, i, c]) => `<button class="row tap ${k === section ? 'on' : ''}" data-sec="${k}"><span class="av" style="--c:${c}">${ic(i)}</span><span class="t"><b>${n}</b></span>${ic('right')}</button>`).join('')}</div></div>`).join('');
  };
  const paintSide = () => { const h = $('#ss', el); if (!h) return; const sc = $('.scroller', h)?.scrollTop || 0; h.innerHTML = pane({ title: tx('Einstellungen'), left: backBtn(edHash(), cur().name), right: `<span class="save-slot">${saveBtn()}</span>` }, sideBody()); collapse(h); const n = $('.scroller', h); if (n) { n.style.scrollBehavior = 'auto'; n.scrollTop = sc; n.style.scrollBehavior = ''; } };
  const paintMain = () => {
    const h = $('#sm', el); if (!h) return;
    $('.split', el).dataset.pane = section ? 'main' : 'side';
    if (!section) { h.innerHTML = `<div class="empty"><div class="ico48">${ic('sliders')}</div><h2>${tx('Einstellungen')}</h2><p>${tx('Wähle links einen Abschnitt.')}</p></div>`; return; }
    h.innerHTML = pane({ title: nameOf(section), left: `<button class="back nar" data-sec="">${ic('left')}<span>${tx('Einstellungen')}</span></button>`, right: `<span class="save-slot">${saveBtn()}</span>`, wrap: section === 'look' ? 'look' : '' }, `<div class="set-status" id="set-status" role="status"></div>${SEC[section](s())}`);
    collapse(h); deps();
  };
  const html = () => { el.innerHTML = `<div class="split" data-pane="${section ? 'main' : 'side'}"><div class="split-side" id="ss"></div><div class="split-main" id="sm"></div></div>`; paintSide(); paintMain(); };
  function open(k, push = true) {
    if (k === section) return;
    section = k;
    const h = `${edHash()}/settings${k ? '/' + k : ''}`;
    if (push && location.hash !== h) history.pushState({ hb: 1 }, '', h);   // ohne Neuaufbau der Ansicht; Zurück baut sie mit dem Abschnitt aus der Adresse neu auf
    paintSide(); paintMain(); const sc = $('#sm .scroller', el); if (sc) sc.scrollTop = 0;
  }
  function deps() {
    const x = s();
    for (const [k, fn] of Object.entries(DEPS)) { const r = $(`[data-row=${k}]`, el); if (r) { r.classList.toggle('inactive', !fn(x)); r.inert = !fn(x); } }   // inert: auch per Tab/Tastatur nicht bedienbar
    const st = $('#set-status', el), c = cur();
    if (st) { st.textContent = c.connected ? section === 'look' ? tx('Look, Modus und Hintergrund gehören zum Entwurf. „Senden“ schickt sie ans Display.') : section === 'pills' ? tx('Die Pillen gehören zum Entwurf. „Senden“ schickt sie ans Display.') : tx('Änderungen wirken sofort am Display.') : tx('Das Display ist offline. Einstellungen gelten, sobald es wieder da ist.'); st.classList.toggle('warn', !c.connected); }
  }
  const lists = { show: () => [['', tx('Wählen …')], ...TYPES], saver: saverTypes, wake: () => WAKE, tts: () => [['', tx('Browser-Stimme')], ...S.ttss], pipeline: () => [['', tx('Standard von Home Assistant')], ...S.pipelines], mic: () => micList(s().mic), lang: LANGS };
  const setK = async (k, v, b, en, phase) => {
    if (phase === 'input') return;
    if (k.startsWith('p.')) { const sc = $('#sm .scroller', el)?.scrollTop || 0; if (pillsSet(k, v)) { paintMain(); const n = $('#sm .scroller', el); if (n) n.scrollTop = sc; } return; }
    if (k === 'name') { v = String(v).trim(); if (!v) { b.value = cur().name; return; } b.value = v; await guard(call('update', { display: S.sel, name: v })); cur().name = v; return emit('list'); }
    if (k === 'dur') { dur = v >= 1 ? String(Math.min(v, 3600)) : ''; b.value = dur; return; }
    if (k === 'show') { if (v) cmd('face', { face: v, ...(+dur >= 1 && { duration: +dur }) }); b.querySelector('span').textContent = tx('Wählen …'); return; }
    if (k === 'say') return;
    if (k === 'lang') return setLang(v || null);
    if (k === 'look' || k === 'mode') return mutate(k === 'look' ? tx('Look geändert') : tx('Modus geändert'), c => { c[k === 'look' ? 'theme' : 'mode'] = v; });
    await setSetting(S.sel, { [k]: v });
    deps();
  };
  html();
  bind(el, { on: setK, listOf: k => k.startsWith('p.') ? PILL_LISTS[k.split('.')[2]] || [] : lists[k]?.() || [], valueOf: k => k.startsWith('p.') ? pillGet(k) : k === 'show' ? '' : k === 'lang' ? langNow() : s()[k] ?? '' });
  // Hintergrund-Auswahl: gewählte Kachel markieren, Thumbnails passend zu Hell/Dunkel, Vorschau-Rahmen mit dem Entwurf füttern
  const frames = () => $$('.pv-card iframe', el), light = () => S.cfg?.mode === 'light';
  const push = () => frames().forEach(fr => {   // je Ansicht ein Rahmen wie im Editor: nur senden, was sich geändert hat
    const f = S.cfg?.faces.find(x => x.id === fr.closest('.pv-card').dataset.f); if (!f || !fr.dataset.ready) return;
    const conf = { ...S.cfg, off: [], faces: [f] }, k = JSON.stringify(conf); if (k === fr._k) return; fr._k = k;
    fr.contentWindow.postMessage({ hb: 'preview', conf, face: f.id, edit: false, sel: -1, states: S.states }, location.origin);
  });
  const onFrame = e => { const f = frames().find(x => x.contentWindow === e.source); if (f && e.origin === location.origin && e.data?.hb === 'preview-ready') { f.dataset.ready = 1; push(); } };
  addEventListener('message', onFrame);
  let lit = light();
  const looks = () => {
    if (!S.cfg || !$('.look-grid', el)) return;
    $$('.bg-tile[data-bg]', el).forEach(b => b.setAttribute('aria-pressed', String(bgCur(S.cfg)) === b.dataset.bg));
    $$('.bg-tile[data-th]', el).forEach(b => b.setAttribute('aria-pressed', b.dataset.th === (S.cfg.theme || 'liquid')));
    const sm = $('#set-mode', el); if (sm) sm.hidden = !!TH(S.cfg.theme);
    if (lit !== light()) { lit = light(); $$('.bg-tile[data-bg] i', el).forEach(i => { i.style.background = thumb(i.dataset.w, lit); }); }
    push();
  };
  el.addEventListener('click', async e => {
    const q = c => e.target.closest(c);
    const sc = q('[data-sec]'); if (sc) return open(sc.dataset.sec);
    if (q('.save-btn')) { if (await save() && !dirty()) toast(cur().connected ? tx('Gesendet. Dein Display wird aktualisiert.') : tx('Gespeichert. Das Display übernimmt es beim nächsten Öffnen.')); return; }
    const c = q('[data-cmd]');
    if (c) {
      const k = c.dataset.cmd;
      if (k === 'say') { const i = $('[data-k=say]', el); if (i.value.trim()) cmd('announce', { message: i.value.trim() }).then(() => i.value = ''); return; }
      if (k === 'testnb') { const i = $('[data-k=say]', el); return cmd('notify', { title: tx('Testbenachrichtigung'), message: i.value.trim() || tx('Die Benachrichtigungskarte funktioniert.') }); }
      if (k === 'shot') { const img = await screenshot(c); if (img) { let t = $('#set-shot', el); if (!t) { t = Object.assign(document.createElement('img'), { className: 'shot', id: 'set-shot', alt: '' }); c.closest('.s-actions').after(t); } t.src = img; paintSide(); } return; }
      return cmd(k);
    }
    const pe = q('[data-pill-add],[data-pill-del],[data-pill-up]');
    if (pe && !pe.disabled) { const sc = $('#sm .scroller', el)?.scrollTop || 0, d = pe.dataset; if (d.pillAdd !== undefined) { if (!await pillsAdd()) return; } else if (d.pillDel !== undefined) pillsDel(+d.pillDel); else pillsUp(+d.pillUp); paintMain(); const n = $('#sm .scroller', el); if (n) n.scrollTop = sc; return; }
    const th = q('[data-th]'); if (th) { mutate(tx('Look geändert'), cfg => { cfg.theme = th.dataset.th; if (TH(cfg.theme)) bgAll(cfg, 'auto'); }); return looks(); }   // eigenes Theme: Hintergrund wieder „Tageszeit“ = der des Themes
    const t = q('[data-bg]'); if (t) { mutate(tx('Hintergrund geändert'), cfg => bgAll(cfg, bgVal(t.dataset.bg))); return looks(); }
    const m = q('[data-m]');
    if (m && !m.disabled) {
      const k = m.dataset.m;
      if (k === 'xjson') return exportLayout(); if (k === 'xesp') return exportEsp(); if (k === 'ximport') return importLayout();
      if (k === 'apply') return applyToOthers(); if (k === 'remove') return removeDisplay();
      const others = S.displays.filter(x => x.id !== S.sel && !x.new);
      if (!others.length) return toast(tx('Kein anderes Display vorhanden'), { bad: true });
      const v = await choose(m, others.map(x => [x.id, x.name, x.area]), '', { width: 260 });
      if (v) return k === 'copyl' ? copyLayoutFrom(v) : copySettingsFrom(v).then(ok => ok && paintMain());
    }
  });
  const key = e => {
    if (!(e.metaKey || e.ctrlKey) || document.querySelector('.alert,.palette-bg,.sheet')) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); document.activeElement?.blur?.(); if (dirty() && !S.busy) $('.save-btn:not([hidden])', el)?.click(); }   // blur: ein getipptes Feld schreibt erst bei change
    else if (k === 'z' && !e.altKey && !e.target.closest?.('input,textarea,select,[contenteditable=true]')) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  };
  const before = e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } };
  document.addEventListener('keydown', key); addEventListener('beforeunload', before);
  const mqf = () => { if (wide.matches && !section) open('general', false); else $('.split', el).dataset.pane = section ? 'main' : 'side'; };
  wide.addEventListener('change', mqf);
  const offs = [on('list', why => {
    if (!cur()) return;   // Display gerade von außen entfernt: app.js verlässt die Seite
    if (why === 'ext' && section) { const sc = $('#sm .scroller', el)?.scrollTop || 0; paintMain(); const n = $('#sm .scroller', el); if (n) n.scrollTop = sc; }
    const l = $('#set-live', el); if (l) l.innerHTML = liveRows(cur());
    $$('[data-cmd]', el).forEach(b => { if (b.dataset.cmd) b.disabled = !cur().connected; });
    deps(); const h = $('.set-hero', el); if (h) h.outerHTML = hero();
    const bk = $('#ss .back span', el); if (bk) bk.textContent = cur().name;
  }), on('doc', why => {
    if (why === 'undo' && section === 'pills') paintMain();
    looks(); $$('.save-slot', el).forEach(x => { x.innerHTML = saveBtn(); });
    const row = (k, v) => el.querySelectorAll(`[data-k=${k}]`).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v)); if (S.cfg) { row('look', S.cfg.theme || 'liquid'); row('mode', S.cfg.mode || 'dark'); }
  })];
  if (spot.key) { const r = $(`[data-row=${spot.key}]`, el); spot.key = null; if (r) requestAnimationFrame(() => { r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.classList.add('spotlit'); setTimeout(() => r.classList.remove('spotlit'), 1700); $('button,input', r)?.focus({ preventScroll: true }); }); }
  return () => { offs.forEach(f => f()); removeEventListener('message', onFrame); document.removeEventListener('keydown', key); removeEventListener('beforeunload', before); wide.removeEventListener('change', mqf); };
}
