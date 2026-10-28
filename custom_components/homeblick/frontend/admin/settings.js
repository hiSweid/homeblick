// Einstellungen eines Displays als Master/Detail wie die Systemeinstellungen: links die Abschnitte, rechts der gewählte (am Telefon nacheinander).
// Alles wirkt sofort, außer dem Theme: das gehört zum Entwurf des Layouts und braucht „Senden“.
import { $, $$, choose, esc, guard, ic, toast } from './ui.js';
import { S, call, cur, dirty, emit, mutate, on, save, setSetting } from './state.js';
import { BG_SETS, THEMES, MODES, TYPES, WAKE, bgAll, bgCss, bgCur, bgVal, themeGrid } from './meta.js';
import { hueOf, wall } from '../wallpapers.js';
import { ago, ledOf } from './util.js';
import { bind, entityRow, numberRow, selectRow, sliderRow, switchRow, textRow, timeRow, sroww } from './controls.js';
import { copyLayoutFrom, copySettingsFrom, applyToOthers, exportEsp, exportLayout, importLayout, removeDisplay, renameDisplay, screenshot } from './actions.js';
import { backBtn, collapse, pane } from './nav.js';
import { PILL_LISTS, pillGet, pillsAdd, pillsDel, pillsHTML, pillsSet, pillsUp } from './pills.js';

export const spot = { key: null, section: null };
const SECTIONS = [   // [Schlüssel, Name, Symbol, Farbe]; Gruppen wie in den iOS-Einstellungen
  [['general', 'Allgemein', 'monitor', '#8e8e93'], ['control', 'Steuerung und Ansage', 'refresh', '#007aff']],
  [['brightness', 'Helligkeit', 'sun', '#ff9500'], ['saver', 'Bildschirmschoner', 'moon', '#5856d6'], ['night', 'Nachtmodus', 'moon', '#3a3a8c']],
  [['voice', 'Sprache und Mikrofon', 'mic', '#ff3b30'], ['wake', 'Aufwecken und Bedienung', 'bolt', '#ff9f0a'], ['look', 'Hintergrund und Theme', 'paint', '#ff2d55'], ['pills', 'Live-Pillen', 'pulse', '#30d158']],
  [['status', 'Status und Bildschirmfoto', 'info', '#34c759'], ['manage', 'Vorlagen und Sicherung', 'copy', '#30b0c7']],
];
// Zeile, die ⌘K beim Öffnen hervorheben soll: [Schlüssel, Name, Abschnitt]
export const INDEX = [['bright', 'Helligkeit', 'brightness'], ['lux', 'Lichtsensor (Lux)', 'brightness'], ['perf', 'Leistungsmodus', 'brightness'], ['perfauto', 'Leistungsmodus automatisch', 'brightness'], ['idle', 'Bildschirmschoner nach Inaktivität', 'saver'], ['saver', 'Bildschirmschoner: Ansicht', 'saver'], ['music', 'Musik statt Schoner', 'saver'], ['black', 'Ganz schwarz statt Ansicht', 'saver'], ['sched', 'Schoner-Zeitplan', 'saver'], ['hold', 'Schoner halten', 'saver'],
  ['dim', 'Nachts abdunkeln', 'night'], ['dim_level', 'Nachtmodus Stärke', 'night'], ['wake', 'Wake Word', 'voice'], ['wake_sens', 'Wake-Word-Empfindlichkeit', 'voice'], ['mute', 'Antworten stumm', 'voice'], ['volume', 'Lautstärke der Antworten', 'voice'], ['tts', 'Stimme für Ansagen', 'voice'], ['pipeline', 'Assist-Pipeline', 'voice'], ['mic', 'Mikrofon', 'voice'], ['out', 'Sprachausgabe über', 'voice'], ['duck', 'Musik bei Sprache auf', 'voice'], ['micmute', 'Mikrofon stumm', 'voice'], ['guest', 'Gastmodus', 'voice'], ['dnd', 'Nicht stören', 'voice'], ['chime', 'Gong beim Klingeln', 'voice'],
  ['presence', 'Bewegungs- und Präsenzmelder', 'wake'], ['kz', 'Kontrollzentrum', 'wake'], ['name', 'Name des Displays', 'general'], ['pills', 'Live-Pillen', 'pills']];
const micList = v => [['', 'Standard des Geräts'], ...[...new Set([...(cur().info?.mics || []), ...(v ? [v] : [])])].map(m => [m, m])];   // gewähltes, gerade fehlendes Mikro bleibt sichtbar
const DEPS = { dim_from: s => s.dim, dim_to: s => s.dim, dim_level: s => s.dim, sched_from: s => s.sched, sched_to: s => s.sched, wake_sens: s => s.wake !== 'off', barge: s => s.wake !== 'off' };
const G = (title, body, foot = '') => `<div class="sect">${title ? `<div class="group-h">${title}</div>` : ''}<div class="group">${body}</div>${foot ? `<div class="group-f">${foot}</div>` : ''}</div>`;
const thumb = (v, lit) => hueOf(bgVal(v)) == null ? bgCss(bgVal(v)) : `${wall(bgVal(v), lit)[0]} center/cover`;   // Tageszeit/Schwarz/Weiß haben kein Wallpaper
const stack = (label, control) => `<div class="stack"><span class="s-label">${label}</span>${control}</div>`;
const seg2 = (k, list, v) => `<span class="seg fill">${list.map(([a, n]) => `<button type="button" data-k="${k}" data-v="${a}" aria-pressed="${a === v}">${n}</button>`).join('')}</span>`;
const liveRows = d => {
  const i = d.info || {}, row = (l, v, on_) => `<div class="srow"><span class="s-label">${l}</span><span class="s-val">${on_ != null ? `<i class="led ${on_ ? 'ok' : ''}"></i>` : ''}${v}</span></div>`;
  return G('Status', d.seen ? [
    row('Verbindung', d.connected ? 'Online' : 'Offline', d.connected),
    row('Mikrofon', i.mic ? 'Verfügbar' : i.secure === false ? 'Braucht https' : 'Nicht verfügbar', !!i.mic),
    row('Wake Word', i.wake ? 'Hört zu · ' + esc(i.wake.replace(/_v.*/, '')) : 'Aus', !!i.wake),
    row('Bildschirm wach', i.wakelock ? 'Aktiv' : i.secure === false ? 'Braucht https' : 'Aus', !!i.wakelock),
    row('Fenster', i.w ? `${esc(i.w)} × ${esc(i.h)}${i.visible === false ? ' · verdeckt' : ''}` : '–'),
    row('Zuletzt gesehen', ago(d.seen)),
    i.v ? row('Version', esc(i.v) + (d.outdated ? ' · veraltet' : ''), !d.outdated) : '',
  ].join('') : row('Noch nie verbunden', '–'))
  + (d.logs?.length ? G('Letzte Fehler', d.logs.slice().reverse().map(m => `<div class="srow"><span><span class="s-label">${esc(m.message)}</span><small>${m.level === 'error' ? 'Fehler' : 'Warnung'} · ${ago(m.t)}</small></span></div>`).join(''), 'Stehen auch im Home-Assistant-Protokoll. Diagnose: Gerät des Displays → ⋮ → Diagnose herunterladen.') : '');
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
    general: x => G('', textRow('Name', 'name', cur().name, { max: 60 }, '', 'name') + sroww('Bereich', '', `<span class="s-val">${esc(cur().area || 'kein Bereich in Home Assistant')}</span>`), 'Den Bereich ändert man in Home Assistant am Gerät des Displays. Er hilft bei Sprachbefehlen („Licht an“ trifft den richtigen Raum).'),
    control: x => {
      const dis = cur().connected ? '' : 'disabled';
      return G('Befehle', `<div class="quick">${[['reload', 'Neu laden', 'refresh'], ['assist', 'Assist', 'mic'], ['stop', 'Abbrechen', 'x'], ['screensaver', 'Ruhemodus', 'moon'], ['wake', 'Aufwecken', 'sun']].map(([c, n, i]) => `<button class="btn quiet" data-cmd="${c}" ${dis}>${ic(i)}${n}</button>`).join('')}</div>`, 'Steuerung geht, solange das Display geöffnet ist.')
        + G('Ansicht anzeigen', sroww('Zurück nach (s, leer = bleibt)', '', `<input type="number" data-k="dur" min="1" max="3600" value="${esc(dur)}" placeholder="bleibt" inputmode="numeric">`) + selectRow('Ansicht', 'show', [['', 'Wählen …'], ...TYPES], '', '', 'show'))
        + G('Ansage', textRow('Text', 'say', '', { ph: 'Das Essen ist fertig', max: 300 }, '', 'say') + `<div class="s-actions"><button class="btn quiet" data-cmd="say" ${dis}>Ansagen</button><button class="btn quiet" data-cmd="testnb" ${dis}>Testbenachrichtigung</button></div>`, 'Die Ansage erscheint als Text und wird gesprochen (außer bei „Antworten stumm“).');
    },
    brightness: x => G('', sliderRow('Helligkeit', 'bright', 10, 100, 5, x.bright, '', ' %', 'bright') + entityRow('Lichtsensor (Lux)', 'lux', x.lux, { domains: ['sensor'], dcs: ['illuminance'], none: 'Keiner', title: 'Lichtsensor' }, 'Dunkler Raum dimmt bis auf 30 %', 'lux') + switchRow('Leistungsmodus', 'perf', x.perf, 'Keine Animationen, für schwache Tablets', 'perf') + switchRow('Leistungsmodus automatisch', 'perfauto', x.perfauto, 'Schaltet bei zu niedriger Bildrate (unter 25 Bildern/s) selbst ein, standardmäßig aus', 'perfauto'), 'Software-Abdunklung, keine Hardware-Helligkeit.'),
    saver: x => G('', numberRow('Nach Inaktivität', 'idle', x.idle, { min: 0, max: 3600, step: 10, unit: ' s' }, '0 schaltet ihn aus', 'idle') + selectRow('Ansicht', 'saver', saverTypes(), x.saver, '', 'saver') + switchRow('Musik statt Schoner', 'music', x.music, '', 'music') + switchRow('Ganz schwarz', 'black', x.black, 'Statt der Ansicht', 'black') + switchRow('Schoner halten', 'hold', x.hold, 'Er startet nicht (Kochen, Präsentieren)', 'hold'))
      + G('Zeitplan', switchRow('Zeitplan', 'sched', x.sched, 'Startet nach 30 s Ruhe', 'sched') + timeRow('Von', 'sched_from', x.sched_from, '', 'sched_from') + timeRow('Bis', 'sched_to', x.sched_to, '', 'sched_to')),
    night: x => G('', switchRow('Nachts abdunkeln', 'dim', x.dim, 'Ein Tipp hellt für 30 Sekunden auf', 'dim') + timeRow('Von', 'dim_from', x.dim_from, '', 'dim_from') + timeRow('Bis', 'dim_to', x.dim_to, '', 'dim_to') + sliderRow('Stärke', 'dim_level', 10, 95, 5, x.dim_level, '', ' %', 'dim_level')),
    voice: x => G('Wake Word', selectRow('Wake Word', 'wake', WAKE, x.wake, '', 'wake') + sliderRow('Empfindlichkeit', 'wake_sens', 10, 95, 5, x.wake_sens, '', ' %', 'wake_sens') + switchRow('Wake Word unterbricht', 'barge', x.barge, 'Antwort wird abgebrochen', 'barge'), 'Ein Wake Word hält das Mikrofon offen und braucht https.')
      + G('Antworten', switchRow('Antworten stumm', 'mute', x.mute, '', 'mute') + sliderRow('Lautstärke der Antworten', 'volume', 0, 100, 5, x.volume, '', ' %', 'volume') + numberRow('Aufnahme-Zeitlimit', 'listen', x.listen, { min: 3, max: 60, unit: ' s' }, '', 'listen') + selectRow('Stimme für Ansagen', 'tts', [['', 'Browser-Stimme'], ...S.ttss], x.tts, '', 'tts') + selectRow('Mikrofon', 'mic', micList(x.mic), x.mic, 'Mikrofone des Displays; die Liste erscheint nach der ersten Freigabe', 'mic') + entityRow('Sprachausgabe über', 'out', x.out, { domains: ['media_player'], none: 'Dieses Display', title: 'Lautsprecher' }, 'Z. B. Sonos; es braucht eine HA-Stimme', 'out') + sliderRow('Musik bei Sprache auf', 'duck', 0, 100, 10, x.duck, '0 oder 100 lässt sie unverändert', ' %', 'duck') + selectRow('Assist-Pipeline', 'pipeline', [['', 'Standard von Home Assistant'], ...S.pipelines], x.pipeline, '', 'pipeline'), 'Damit „Licht an“ den richtigen Raum trifft, dem Gerät des Displays in Home Assistant einen Bereich geben.')
      + G('Modi', switchRow('Mikrofon stumm', 'micmute', x.micmute, 'Assist per Tippen geht weiter', 'micmute') + switchRow('Gastmodus', 'guest', x.guest, 'Kalender, Info und Kameras zeigen ein Schloss', 'guest') + switchRow('Nicht stören', 'dnd', x.dnd, 'Kein Wake Word, keine Sprache, kein Gong', 'dnd') + switchRow('Gong beim Klingeln', 'chime', x.chime, 'Ton erst nach der ersten Berührung', 'chime')),
    wake: x => G('', entityRow('Bewegungs-/Präsenzmelder', 'presence', x.presence, { domains: ['binary_sensor'], dcs: ['motion', 'occupancy', 'presence'], none: 'Keiner', title: 'Melder' }, 'Solange „an“, bleibt das Display wach', 'presence') + switchRow('Kontrollzentrum', 'kz', x.kz, 'Wisch von oben rechts: Helligkeit, Lautstärke, Schalter', 'kz')),
    pills: () => pillsHTML(S.cfg, G),
    look: () => `<div class="sect"><div class="pv-device bg-pv"><iframe title="Vorschau" src="index.html?preview"></iframe></div><div class="group-f">Vorschau der ersten Seite. Gilt für das ganze Display und gehört zum Entwurf: „Senden“ schickt es ans Display.</div></div>`
      + G('Look', `<div class="stack">${seg2('look', THEMES, S.cfg.theme || 'liquid')}</div>`) + G('Modus', `<div class="stack">${seg2('mode', MODES, S.cfg.mode || 'dark')}</div>`)
      + BG_SETS.map(([n, l]) => G(n, `<div class="bg-grid">${l.map(([v, t]) => `<button type="button" class="bg-tile" data-bg="${esc(v)}" aria-pressed="${String(bgCur(S.cfg)) === String(v)}"><i data-w="${esc(v)}" style="background:${esc(thumb(v, S.cfg.mode === 'light'))}"></i><span>${esc(t)}</span></button>`).join('')}</div>`)).join('')
      + `<div class="sect"><div class="group-f">Der Hintergrund gilt für alle Ansichten außer Wetter, Musik, Kalender, Kameras, Fotos und Ansichten mit eigenem Foto.</div></div>`,
    status: () => `<div id="set-live">${liveRows(cur())}</div>` + G('Bildschirmfoto', `<div class="s-actions"><button class="btn quiet" data-cmd="shot" ${cur().connected ? '' : 'disabled'}>${ic('image')}Aufnehmen</button></div>${S.shots[S.sel] ? `<img class="shot" id="set-shot" src="${S.shots[S.sel]}" alt="">` : ''}`, 'Bilder von fremden Servern, Kamera-Video und WebGL fehlen im Foto.'),
    manage: () => {
      const b = (k, i, n, ok = S.cfg) => `<button class="row tap" data-m="${k}" ${ok ? '' : 'disabled'}>${ic(i)}<span class="t"><b>${n}</b></span>${ic('right')}</button>`;
      return G('Kopieren', b('copyl', 'copy', 'Layout kopieren von …') + b('copys', 'sliders', 'Einstellungen übernehmen von …', true) + b('apply', 'send', 'Auf andere Displays anwenden …'), 'Kopieren und Importieren legen nur den Entwurf an; „Senden“ schickt ihn.')
        + G('Sichern', b('xjson', 'download', 'Layout exportieren (JSON)') + b('ximport', 'upload', 'Layout importieren …') + b('xesp', 'download', 'Für ESP-Display exportieren'), 'Die ESP-Datei enthält nur, was ein LVGL-Panel (480×480) darstellen kann; Fehlendes steht unter „skipped“.')
        + G('', `<button class="row danger" data-m="remove">Display entfernen</button>`, 'Ansichten und Einstellungen gehen verloren. Das Gerät in Home Assistant danach unter Geräte löschen.');
    },
  };

  // ---- Zeichnen ----
  const saveBtn = () => `<button class="gpill tinted save-btn" ${dirty() ? '' : 'hidden'} ${S.busy ? 'disabled' : ''} title="Speichern und ans Display senden · ⌘S">${S.busy ? '<span class="spin small"></span>' : ic('send')}<span>${S.busy ? 'Sendet …' : 'Senden'}</span></button>`;
  const hero = () => {
    const d = cur(), l = ledOf(d);
    return `<div class="set-hero">${S.shots[d.id] ? `<img src="${S.shots[d.id]}" alt="">` : `<span class="av lg" style="--c:#8e8e93">${ic('monitor')}</span>`}<span class="t"><b>${esc(d.name)}</b><small><i class="led ${l}"></i> ${l === 'ok' ? 'Online' : l === 'update' ? 'Alte Version' : 'Offline'}${d.area ? ' · ' + esc(d.area) : ''}</small></span></div>`;
  };
  const sideBody = () => {
    return hero()
      + SECTIONS.map(g => `<div class="sect"><div class="group side-list">${g.filter(x => avail(x[0])).map(([k, n, i, c]) => `<button class="row tap ${k === section ? 'on' : ''}" data-sec="${k}"><span class="av" style="--c:${c}">${ic(i)}</span><span class="t"><b>${n}</b></span>${ic('right')}</button>`).join('')}</div></div>`).join('');
  };
  const paintSide = () => { const h = $('#ss', el); if (!h) return; const sc = $('.scroller', h)?.scrollTop || 0; h.innerHTML = pane({ title: 'Einstellungen', left: backBtn(edHash(), cur().name), right: `<span class="save-slot">${saveBtn()}</span>` }, sideBody()); collapse(h); const n = $('.scroller', h); if (n) { n.style.scrollBehavior = 'auto'; n.scrollTop = sc; n.style.scrollBehavior = ''; } };
  const paintMain = () => {
    const h = $('#sm', el); if (!h) return;
    $('.split', el).dataset.pane = section ? 'main' : 'side';
    if (!section) { h.innerHTML = `<div class="empty"><div class="ico48">${ic('sliders')}</div><h2>Einstellungen</h2><p>Wähle links einen Abschnitt.</p></div>`; return; }
    h.innerHTML = pane({ title: nameOf(section), left: `<button class="back nar" data-sec="">${ic('left')}<span>Einstellungen</span></button>`, right: `<span class="save-slot">${saveBtn()}</span>` }, `<div class="set-status" id="set-status" role="status"></div>${SEC[section](s())}`);
    collapse(h); deps();
  };
  const html = () => { el.innerHTML = `<div class="split" data-pane="${section ? 'main' : 'side'}"><div class="split-side" id="ss"></div><div class="split-main" id="sm"></div></div>`; paintSide(); paintMain(); };
  function open(k, push = true) {
    if (k === section) return;
    section = k;
    const h = `${edHash()}/settings${k ? '/' + k : ''}`;
    if (push && location.hash !== h) history.pushState(null, '', h);   // ohne Neuaufbau der Ansicht; Zurück baut sie mit dem Abschnitt aus der Adresse neu auf
    paintSide(); paintMain(); const sc = $('#sm .scroller', el); if (sc) sc.scrollTop = 0;
  }
  function deps() {
    const x = s();
    for (const [k, fn] of Object.entries(DEPS)) $(`[data-row=${k}]`, el)?.classList.toggle('inactive', !fn(x));
    const st = $('#set-status', el), c = cur();
    if (st) { st.textContent = c.connected ? section === 'look' ? 'Look, Modus und Hintergrund gehören zum Entwurf. „Senden“ schickt sie ans Display.' : section === 'pills' ? 'Die Pillen gehören zum Entwurf. „Senden“ schickt sie ans Display.' : 'Änderungen wirken sofort am Display.' : 'Das Display ist offline. Einstellungen gelten, sobald es wieder da ist.'; st.classList.toggle('warn', !c.connected); }
  }
  const lists = { show: () => [['', 'Wählen …'], ...TYPES], saver: saverTypes, wake: () => WAKE, tts: () => [['', 'Browser-Stimme'], ...S.ttss], pipeline: () => [['', 'Standard von Home Assistant'], ...S.pipelines], mic: () => micList(s().mic) };
  const setK = async (k, v, b, en, phase) => {
    if (phase === 'input') return;
    if (k.startsWith('p.')) { const sc = $('#sm .scroller', el)?.scrollTop || 0; if (pillsSet(k, v)) { paintMain(); const n = $('#sm .scroller', el); if (n) n.scrollTop = sc; } return; }
    if (k === 'name') { v = String(v).trim(); if (!v) return; await guard(call('update', { display: S.sel, name: v })); cur().name = v; return emit('list'); }
    if (k === 'dur') { dur = v >= 1 ? String(Math.min(v, 3600)) : ''; return; }
    if (k === 'show') { if (v) cmd('face', { face: v, ...(+dur >= 1 && { duration: +dur }) }); b.querySelector('span').textContent = 'Wählen …'; return; }
    if (k === 'say') return;
    if (k === 'look' || k === 'mode') return mutate(k === 'look' ? 'Look geändert' : 'Modus geändert', c => { c[k === 'look' ? 'theme' : 'mode'] = v; });
    await setSetting(S.sel, { [k]: v });
    deps();
  };
  html();
  bind(el, { on: setK, listOf: k => k.startsWith('p.') ? PILL_LISTS[k.split('.')[2]] || [] : lists[k]?.() || [], valueOf: k => k.startsWith('p.') ? pillGet(k) : k === 'show' ? '' : s()[k] ?? '' });
  // Hintergrund-Auswahl: gewählte Kachel markieren, Thumbnails passend zu Hell/Dunkel, Vorschau-Rahmen mit dem Entwurf füttern
  const frame = () => $('.bg-pv iframe', el), light = () => S.cfg?.mode === 'light';
  const push = () => { const f = frame(); if (f?.dataset.ready && S.cfg) f.contentWindow.postMessage({ hb: 'preview', conf: { ...S.cfg, off: [] }, face: themeGrid(S.cfg).id, edit: false, sel: -1, states: S.states }, location.origin); };
  const onFrame = e => { const f = frame(); if (f && e.source === f.contentWindow && e.origin === location.origin && e.data?.hb === 'preview-ready') { f.dataset.ready = 1; push(); } };
  addEventListener('message', onFrame);
  let lit = light();
  const looks = () => {
    if (!S.cfg || !frame()) return;
    $$('.bg-tile', el).forEach(b => b.setAttribute('aria-pressed', String(bgCur(S.cfg)) === b.dataset.bg));
    if (lit !== light()) { lit = light(); $$('.bg-tile i', el).forEach(i => { i.style.background = thumb(i.dataset.w, lit); }); }
    push();
  };
  el.addEventListener('click', async e => {
    const q = c => e.target.closest(c);
    const sc = q('[data-sec]'); if (sc) return open(sc.dataset.sec);
    if (q('.save-btn')) { await save(); if (!dirty()) toast(cur().connected ? 'Gesendet. Dein Display wird aktualisiert.' : 'Gespeichert. Das Display übernimmt es beim nächsten Öffnen.'); return; }
    const c = q('[data-cmd]');
    if (c) {
      const k = c.dataset.cmd;
      if (k === 'say') { const i = $('[data-k=say]', el); if (i.value.trim()) cmd('announce', { message: i.value.trim() }).then(() => i.value = ''); return; }
      if (k === 'testnb') { const i = $('[data-k=say]', el); return cmd('notify', { title: 'Testbenachrichtigung', message: i.value.trim() || 'Die Benachrichtigungskarte funktioniert.' }); }
      if (k === 'shot') { const img = await screenshot(c); if (img) { let t = $('#set-shot', el); if (!t) { t = Object.assign(document.createElement('img'), { className: 'shot', id: 'set-shot', alt: '' }); c.closest('.s-actions').after(t); } t.src = img; paintSide(); } return; }
      return cmd(k);
    }
    const pe = q('[data-pill-add],[data-pill-del],[data-pill-up]');
    if (pe && !pe.disabled) { const sc = $('#sm .scroller', el)?.scrollTop || 0, d = pe.dataset; if (d.pillAdd !== undefined) { if (!await pillsAdd()) return; } else if (d.pillDel !== undefined) pillsDel(+d.pillDel); else pillsUp(+d.pillUp); paintMain(); const n = $('#sm .scroller', el); if (n) n.scrollTop = sc; return; }
    const t = q('[data-bg]'); if (t) { mutate('Hintergrund geändert', cfg => bgAll(cfg, bgVal(t.dataset.bg))); return looks(); }
    const m = q('[data-m]');
    if (m && !m.disabled) {
      const k = m.dataset.m;
      if (k === 'xjson') return exportLayout(); if (k === 'xesp') return exportEsp(); if (k === 'ximport') return importLayout();
      if (k === 'apply') return applyToOthers(); if (k === 'remove') return removeDisplay();
      const others = S.displays.filter(x => x.id !== S.sel && !x.new);
      if (!others.length) return toast('Kein anderes Display vorhanden', { bad: true });
      const v = await choose(m, others.map(x => [x.id, x.name, x.area]), '', { width: 260 });
      if (v) return k === 'copyl' ? copyLayoutFrom(v) : copySettingsFrom(v).then(ok => ok && paintMain());
    }
  });
  const key = e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (dirty() && !S.busy) $('.save-btn:not([hidden])', el)?.click(); } };
  document.addEventListener('keydown', key);
  const mqf = () => { if (wide.matches && !section) open('general', false); else $('.split', el).dataset.pane = section ? 'main' : 'side'; };
  wide.addEventListener('change', mqf);
  const offs = [on('list', () => {
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
  return () => { offs.forEach(f => f()); removeEventListener('message', onFrame); document.removeEventListener('keydown', key); wide.removeEventListener('change', mqf); };
}
