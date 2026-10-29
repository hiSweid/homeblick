// Vollseiten: App-Einstellungen (alle Displays, Kameras & Türklingel), Benachrichtigungen (Spickzettel + Ausprobieren), Neues Display.
import { tx } from '../i18n.js';
import { $, $$, choose, esc, guard, ic, toast } from './ui.js';
import { S, call, on, reload } from './state.js';
import { areasOf, entsOf } from './entities.js';
import { FACE, SETUP, TYPES, setupConfig } from './meta.js';
import { openHelp } from './layout.js';
import { swap } from './util.js';
import { bind, entityBtn, selectBtn, sroww, sw } from './controls.js';
import { backBtn, collapse, page } from './nav.js';

const G = (title, body, foot = '', id = '') => `<div class="sect" ${id ? `id="${id}"` : ''}>${title ? `<div class="group-h">${title}</div>` : ''}<div class="group">${body}</div>${foot ? `<div class="group-f">${foot}</div>` : ''}</div>`;
const frame = (el, title, sub, body, wrap = 'narrow') => { el.innerHTML = page({ title, left: backBtn('#/', tx('Displays')), sub, wrap }, body); collapse(el); };
const tool = (go, icon, color, title, sub) => `<button class="row tap" data-goto="${go}"><span class="av" style="--c:${color}">${ic(icon)}</span><span class="t"><b>${title}</b><small>${sub}</small></span>${ic('right')}</button>`;
export const copy = async (text, what = tx('Text')) => { try { await navigator.clipboard.writeText(text); toast(tx('{what} kopiert', { what })); } catch { const t = Object.assign(document.createElement('textarea'), { value: text }); document.body.append(t); t.select(); const ok = document.execCommand?.('copy'); t.remove(); toast(ok ? tx('{what} kopiert', { what }) : tx('Bitte von Hand kopieren'), { bad: !ok }); } };

// ================= App-Einstellungen =================
export function settings(el) {
  let area = '', dur = '';
  const inArea = () => S.displays.filter(x => !x.new && (!area || x.area === area));
  const camName = x => x.name || S.camEnts.find(c => c[0] === x.entity)?.[1] || x.entity;
  const all = (action, extra = {}) => guard(Promise.all(inArea().filter(x => x.connected).map(x => call('command', { display: x.id, action, ...extra }))), tx('Gesendet')).catch(() => {});
  const durX = () => (+dur >= 1 ? { duration: Math.min(+dur, 3600) } : {});
  const inp = (k, v, ph = '', max = 40, extra = '') => `<input data-k="${k}" value="${esc(v)}" maxlength="${max}" placeholder="${esc(ph)}" ${extra}>`;

  const camsHTML = () => {
    const { cameras: c, auto } = S.cams;
    const row = (x, i) => `<div class="group" data-ci="${i}"><div class="cam-h"><b>${esc(camName(x))}</b><span class="cam-acts"><button class="icon-btn" data-cam="up" aria-label="${tx('Nach oben')}">${ic('arrow-up')}</button><button class="icon-btn" data-cam="down" aria-label="${tx('Nach unten')}">${ic('arrow-down')}</button><button class="icon-btn" data-cam="del" aria-label="${tx('Entfernen‖Remove')}">${ic('trash')}</button></span></div>
      ${sroww(tx('Name'), '', inp('cam:name', x.name || '', S.camEnts.find(k => k[0] === x.entity)?.[1] || ''))}
      ${sroww(tx('Kamera'), '', entityBtn('cam:entity', x.entity, { domains: ['camera'], title: tx('Kamera') }))}
      ${sroww(tx('Licht davor'), '', entityBtn('cam:light', x.light || '', { domains: ['light'], none: tx('Keins'), title: tx('Licht') }, tx('Keins')))}
      ${sroww(tx('go2rtc-Adresse'), tx('optional'), inp('cam:go2rtc', x.go2rtc || '', 'http://192.168.1.10:1984', 200, 'inputmode="url"'))}
      ${x.go2rtc ? sroww(tx('go2rtc-Stream'), '', inp('cam:stream', x.stream || '', x.entity.split('.')[1] || '', 80)) : ''}</div>`;
    const bellCams = [['', tx('Keine')], ...c.list.map(x => [x.entity, camName(x)])];
    return `<div class="sect"><div class="group-h">${tx('Kameras')}</div><div class="gaps">${c.list.map(row).join('')}<div class="group"><button class="row accent" data-cam="add">${ic('plus')}${tx('Kamera hinzufügen')}</button>${auto ? '' : `<button class="row accent" data-cam="reset">${ic('refresh')}${tx('Automatisch erkennen')}</button>`}</div></div>
      <div class="group-f">${auto ? tx('Automatisch erkannt: alle Kameras von Home Assistant. Jede Änderung hier legt die Liste fest.') : tx('Die Ansicht „Kameras“ zeigt bis zu vier Kameras als 2×2-Raster, die Klingelkamera (sonst die erste) zuerst.')} ${tx('Das Bild läuft über Home Assistant (WebRTC, sonst HLS oder Standbilder).')}</div></div>`
      + G(tx('Türklingel'), sroww(tx('Klingel-Ereignis'), '', entityBtn('bell:event', c.bell?.event || '', { domains: ['event'], none: tx('Keine'), title: tx('Klingel-Ereignis') }, tx('Keine')))
        + sroww(tx('Kamera der Klingel'), '', selectBtn('bell:camera', bellCams, c.bell?.camera || '')) + sroww(tx('Schloss zum Öffnen'), '', entityBtn('bell:lock', c.bell?.lock || '', { domains: ['lock'], none: tx('Keins'), title: tx('Schloss') }, tx('Keins')))
        + sroww(tx('Bild vorhalten'), tx('Hält eine Videoverbindung offen'), sw(!!c.bell?.warm, 'bell:warm', `aria-label="${tx('Bild vorhalten')}"`)),
        tx('Klingeln weckt alle geöffneten Displays, spielt den Gong und zeigt diese Kamera. „Tür öffnen“ braucht einen zweiten Tipp. Sprechen geht nur, wenn die Kamera (go2rtc) einen Rückkanal hat und die Seite über https läuft. Über go2rtc ist das Bild nach ca. 0,3 s da. Gilt für alle Displays.'), 'bell');
  };
  const html = () => {
    const areas = [...new Set(S.displays.map(x => x.area).filter(Boolean))].sort(), on_ = inArea().filter(x => x.connected).length, ready = S.displays.filter(x => !x.new);
    return G(tx('Displays'), tool('#/new', 'plus', '#007aff', tx('Neues Display'), tx('Name, Bereich und Vorlage wählen')) + tool('#/alerts', 'bell', '#ff3b30', tx('Mitteilungen'), tx('Karten, Kamerabilder und Ansagen aus Automationen')))
      + (ready.length > 1 || areas.length ? G(`${area ? esc(area) : tx('Alle Displays')} · ${tx('{n} online', { n: on_ })}`,
        (areas.length ? sroww(tx('Bereich'), '', `<button class="choice" data-area><span>${esc(area || tx('Alle'))}</span>${ic('chev-ud')}</button>`) : '')
        + `<div class="quick">${[['reload', tx('Neu laden'), 'refresh'], ['assist', tx('Assist'), 'mic'], ['stop', tx('Abbrechen'), 'x'], ['screensaver', tx('Ruhemodus'), 'moon'], ['wake', tx('Aufwecken'), 'sun'], ['clean', tx('Putzmodus'), 'lock']].map(([c, n, i]) => `<button class="btn quiet" data-all="${c}" ${on_ ? '' : 'disabled'}>${ic(i)}${n}</button>`).join('')}</div>`
        + sroww(tx('Zurück nach (s, leer = bleibt)'), '', `<input type="number" data-k="dur" min="1" max="3600" value="${esc(dur)}" placeholder="${tx('bleibt')}">`)
        + sroww(tx('Ansicht anzeigen'), '', selectBtn('allface', [['', tx('Wählen …')], ...TYPES], ''))
        + sroww(tx('Nachtmodus'), '', `<span class="seg"><button data-night="1">${tx('An')}</button><button data-night="0">${tx('Aus')}</button></span>`),
        `${area ? tx('Befehle gehen an alle Displays im Bereich „{area}“, die gerade geöffnet sind.', { area: esc(area) }) : tx('Befehle gehen an alle Displays, die gerade geöffnet sind.')}${areas.length ? '' : ' ' + tx('Bekommen die Display-Geräte in Home Assistant einen Bereich, lassen sie sich auf einen Bereich beschränken.')}`, 'group') : '')
      + `<div id="camhost">${camsHTML()}</div>`;
  };
  const render = () => frame(el, tx('Einstellungen'), tx('Alles rund um deine Displays.'), html());
  render();
  let cst, was;
  const saveCams = quiet => { clearTimeout(cst); S.cams.auto = false; const { list, bell } = S.cams.cameras; cst = setTimeout(() => guard(call('set_cameras', { cameras: { list, bell: bell?.event ? bell : null } }), !quiet && tx('Gespeichert')).catch(() => {}), 500); };
  const redrawCams = () => { const h = $('#camhost', el); if (h) h.innerHTML = camsHTML(); };
  bind(el, {
    on: async (k, v, b, en, phase) => {
      if (k === 'dur') { dur = v >= 1 ? String(Math.min(v, 3600)) : ''; b.value = dur; return; }
      if (k === 'allface') { if (v) all('face', { face: v, ...durX() }); b.querySelector('span').textContent = tx('Wählen …'); return; }
      if (phase === 'input') return;
      const c = S.cams.cameras;
      if (k.startsWith('bell:')) { const f = k.slice(5); c.bell = { event: '', camera: '', lock: '', warm: false, ...c.bell, [f]: f === 'warm' ? !!v : v }; return saveCams(); }
      if (k.startsWith('cam:')) {
        const f = k.slice(4), x = c.list[+b.closest('[data-ci]').dataset.ci], old = x.entity, had = !!x.go2rtc;
        x[f] = typeof v === 'string' ? v.trim() : v;
        saveCams();
        if (f === 'go2rtc' && had !== !!x.go2rtc) return redrawCams();
        if (f === 'entity') { if (c.bell?.camera === old) c.bell.camera = x.entity; redrawCams(); }
      }
    },
    listOf: k => k === 'allface' ? [['', tx('Wählen …')], ...TYPES] : k === 'bell:camera' ? [['', tx('Keine')], ...S.cams.cameras.list.map(x => [x.entity, camName(x)])] : [],
    valueOf: (k, b) => { const c = S.cams.cameras; if (k.startsWith('cam:')) return c.list[+b.closest('[data-ci]').dataset.ci]?.[k.slice(4)] || ''; if (k === 'bell:camera') return c.bell?.camera || ''; if (k.startsWith('bell:')) return c.bell?.[k.slice(5)] || ''; return ''; },
  });
  el.addEventListener('click', async e => {
    const q = c => e.target.closest(c);
    const a = q('[data-area]'); if (a) { const areas = [...new Set(S.displays.map(x => x.area).filter(Boolean))].sort(), v = await choose(a, [['', tx('Alle')], ...areas.map(x => [x, x])], area); if (v !== undefined) { area = v; const sc = $('.scroller', el).scrollTop; render(); $('.scroller', el).scrollTop = sc; } return; }
    const al = q('[data-all]'); if (al) return all(al.dataset.all);
    const n = q('[data-night]'); if (n) { const v = !!+n.dataset.night; return guard(Promise.all(inArea().map(x => (x.settings.dim = v, call('update', { display: x.id, settings: { dim: v } })))), v ? tx('Nachtmodus an') : tx('Nachtmodus aus')).catch(() => {}); }
    const cb = q('[data-cam]');
    if (cb) {
      const c = S.cams.cameras, act = cb.dataset.cam, i = +cb.closest('[data-ci]')?.dataset.ci;
      if (act === 'del' && !$('.toast:not(.out) button')) was = { list: structuredClone(c.list), bell: c.bell?.camera };   // bei Doppeltipp (die nächste rückt an dieselbe Stelle) gilt weiter der Stand vor dem ersten Löschen
      if (act === 'reset') { clearTimeout(cst); await guard(call('set_cameras', { cameras: null }), tx('Automatisch erkannt')); S.cams = await call('cameras'); return redrawCams(); }
      if (act === 'add') {
        const en = (S.camEnts.find(k => !c.list.some(x => x.entity === k[0])) || [])[0];
        if (!en) return toast(S.camEnts.length ? tx('Alle Kameras sind schon in der Liste') : tx('Keine Kamera in Home Assistant'), { bad: true });
        if (c.list.length >= 8) return toast(tx('Höchstens 8 Kameras'), { bad: true });
        c.list.push({ entity: en, name: '', light: '' });
      } else if (act === 'up' || act === 'down') swap(c.list, i, i + (act === 'up' ? -1 : 1));
      else if (act === 'del') { const [x] = c.list.splice(i, 1); if (c.bell?.camera === x.entity) c.bell.camera = ''; }
      saveCams(act === 'del'); redrawCams();   // beim Löschen bleibt der Rückgängig-Hinweis stehen (kein „Gespeichert“ darüber)
      if (act === 'del') toast(tx('Kamera entfernt'), { action: tx('Rückgängig'), run: () => { c.list = was.list; if (was.bell) c.bell.camera = was.bell; saveCams(); redrawCams(); } });
    }
  });
  return () => clearTimeout(cst);
}

// ================= Benachrichtigungen =================
export function alerts(el) {
  const yaml = (action, data) => `action: ${action}\ndata:\n${Object.entries(data).map(([k, v]) => `  ${k}: ${typeof v === 'number' ? v : /^[a-z0-9_.]+$/.test(v) && !/^\d/.test(v) ? v : JSON.stringify(v)}`).join('\n')}\n`;
  const FIELDS = [['display', tx('Gerät'), tx('Gerät(e)'), tx('Die Displays, die die Karte zeigen. Mehrere sind möglich.'), tx('Küche')], ['message', tx('Text'), tx('Text'), tx('Pflicht. Bis 300 Zeichen.'), tx('Zeit für das Training.')], ['title', tx('Titel'), tx('Text'), tx('Optionale Überschrift, bis 80 Zeichen.'), tx('Erinnerung')], ['image', tx('Bild'), tx('Entität oder Adresse'), tx('Eine Kamera, ein Bild oder eine Adresse (https://… oder /local/…). Die Karte zeigt es groß.'), 'camera.haustuer'], ['button', tx('Button'), tx('Text'), tx('Beschriftung des Buttons, bis 30 Zeichen. Ohne Angabe gibt es keinen.'), tx('Okay')], ['entity', tx('Entität'), tx('Entität'), tx('Der Button schaltet diese Szene, dieses Skript oder diesen Schalter. Nicht zusammen mit „face“.'), 'scene.film'], ['face', tx('Ansicht'), tx('Auswahl'), tx('Der Button öffnet diese Ansicht des Displays. Nicht zusammen mit „entity“.'), 'weather'], ['duration', tx('Dauer'), tx('Zahl (s)'), tx('Wie lange die Karte bleibt; 0 wartet auf den Button oder ein Tippen daneben. Standard 10.'), '30']];
  const ex1 = yaml('homeblick.notify', { display: tx('Küche'), title: tx('Erinnerung'), message: tx('Zeit für das Training.'), duration: 30 });
  const ex2 = yaml('homeblick.notify', { display: tx('Küche'), title: tx('Jemand an der Tür'), message: tx('Haustür'), image: 'camera.haustuer', button: tx('Öffnen'), entity: 'lock.haustuer', duration: 0 }).replace('entity: lock.haustuer', 'entity: scene.tuer_auf');
  const ex3 = yaml('homeblick.show_camera', { display: tx('Küche'), camera: 'camera.haustuer', duration: 60 }), ex4 = yaml('homeblick.hide_camera', { display: tx('Küche') });
  const ex5 = `action: notify.send_message\ntarget:\n  entity_id: notify.kueche_durchsage\ndata:\n  message: ${tx('Das Essen ist fertig')}\n`;
  const sec = (id, title, body) => G(title, body, '', `alerts-${id}`);
  const pre = (id, t) => `<div class="copy-line"><pre id="${id}">${esc(t)}</pre><button class="btn quiet mini" data-copy-pre="${id}">${ic('copy')}${tx('Kopieren')}</button></div>`;
  const ready = S.displays.filter(x => !x.new && x.connected);
  const nav = [['try', tx('Ausprobieren')], ['howto', tx('In einer Automation')], ['fields', tx('Felder')], ['camera', tx('Kamerabild')], ['say', tx('Ansagen')], ['behave', tx('Verhalten')], ['tips', tx('Tipps')]];
  frame(el, tx('Mitteilungen'), tx('Mit <code>homeblick.notify</code> erscheint eine Karte über dem ganzen Display, optional mit Bild und Button, auf einem oder mehreren Displays. Hier steht, wie es geht, und du kannst eine Karte gleich ausprobieren.'), `
    <div class="alert-hero"><div class="alert-mock"><div class="alert-mock-card">${ic('bell', 'big')}<strong>${tx('Jemand an der Tür')}</strong><span>${tx('Haustür')}</span><i class="fake">${tx('Öffnen')}</i></div></div><nav class="alerts-nav">${nav.map(([k, n]) => `<button data-jump="${k}">${n}</button>`).join('')}</nav></div>
    ${sec('try', tx('Ausprobieren'), `<p class="panel-p">${tx('Schickt jetzt eine Karte mit den Feldern, die auch eine Automation nutzt (ohne Bild und Button).')}</p>
      <form class="try-grid" id="try"><label class="field"><span class="f-label">${tx('Display')}</span><button type="button" class="choice" id="try-d" data-v=""><span>${tx('Alle offenen ({n})', { n: ready.length })}</span>${ic('chev-ud')}</button></label>
      <label class="field"><span class="f-label">${tx('Titel')}</span><input id="try-title" maxlength="80" value="${esc(tx('Jemand an der Tür'))}"></label><label class="field"><span class="f-label">${tx('Text')}</span><input id="try-msg" maxlength="300" value="${esc(tx('Haustür'))}"></label>
      <label class="field"><span class="f-label">${tx('Dauer (Sekunden, 0 wartet auf Tippen)')}</span><input id="try-dur" type="number" min="0" max="3600" value="10"></label>
      <div class="actions field wide"><button class="btn" id="try-send" ${ready.length ? '' : 'disabled'}>${ic('send')}${tx('Karte senden')}</button><small id="try-res">${ready.length ? '' : tx('Kein Display ist gerade geöffnet.')}</small></div></form>`)}
    ${sec('howto', tx('In einer Automation'), `<ol class="steps"><li>${tx('Aktion hinzufügen und nach <b>Homeblick: Benachrichtigung zeigen</b> suchen.')}</li><li>${tx('Display wählen, Text eintragen, optional Titel, Bild und Button.')}</li><li>${tx('Lieber YAML? „In YAML bearbeiten“ wählen und das Beispiel einfügen.')}</li></ol><p class="panel-sub">${tx('Einfache Karte')}</p>${pre('ex1', ex1)}<p class="panel-sub">${tx('Mit Bild und Button, bleibt bis zum Tippen')}</p>${pre('ex2', ex2)}`)}
    ${sec('fields', tx('Die Felder'), `<div class="table-scroll"><table class="tbl"><thead><tr><th>${tx('Feld')}</th><th>${tx('Art')}</th><th>${tx('Was es tut')}</th><th>${tx('Beispiel')}</th></tr></thead><tbody>${FIELDS.map(([k, n, t, d, x]) => `<tr><td><code>${k}</code><small>${n}</small></td><td>${t}</td><td>${d}</td><td><code>${esc(x)}</code></td></tr>`).join('')}</tbody></table></div><p class="panel-p"><small>${tx('Mehrere Karten laufen nacheinander. Auf geschlossenen Displays passiert nichts.')}</small></p>`)}
    ${sec('camera', tx('Kamerabild im Vollbild'), `<p class="panel-p">${tx('Zeigt eine Kamera auf dem ganzen Display, zum Beispiel bei Bewegung. <code>duration: 0</code> bleibt, bis jemand schließt.')}</p>${pre('ex3', ex3)}<p class="panel-sub">${tx('Wieder schließen')}</p>${pre('ex4', ex4)}`)}
    ${sec('say', tx('Durchsagen'), `<p class="panel-p">${tx('Gesprochener Text läuft getrennt: Aktion „Benachrichtigung senden“ an die Durchsage-Entität des Displays. Er erscheint auch als Text, außer bei „Antworten stumm“.')}</p>${pre('ex5', ex5)}`)}
    ${sec('behave', tx('Verhalten'), `<ul class="list"><li><b>${tx('Weckt das Display.')}</b> ${tx('Ein schlafendes Display geht an.')}</li><li><b>${tx('Bleibt bis zum Button.')}</b> ${tx('Mit <code>duration: 0</code> bis zum Tippen auf Button oder daneben.')}</li><li><b>${tx('Wartet nicht.')}</b> ${tx('Eine Karte nach der anderen, die nächste kommt, wenn die erste weg ist.')}</li><li><b>${tx('Button schaltet.')}</b> ${tx('Mit <code>entity</code> wird die Szene oder das Skript gestartet, mit <code>face</code> die Ansicht geöffnet.')}</li></ul>`)}
    ${sec('tips', tx('Tipps'), `<ul class="list"><li>${tx('Kurzer Titel, höchstens etwa 20 Zeichen, bleibt lesbar.')}</li><li>${tx('Ein eigener Button-Text („Kommt“, „Okay“) ist klarer als der Standard.')}</li><li>${tx('Für alle Displays einer Etage: Bereich in Home Assistant setzen und die Geräte des Bereichs wählen.')}</li><li>${tx('Wiederkehrende Texte lassen sich am besten als Skript mit Feldern bauen.')}</li></ul>`)}`, 'mid');
  el.addEventListener('click', async e => {
    const j = e.target.closest('[data-jump]'); if (j) return $('#alerts-' + j.dataset.jump, el)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const c = e.target.closest('[data-copy-pre]'); if (c) return copy($('#' + c.dataset.copyPre, el).textContent, tx('YAML'));
    const d = e.target.closest('#try-d');
    if (d) { const v = await choose(d, [['', tx('Alle offenen ({n})', { n: ready.length })], ...S.displays.filter(x => !x.new).map(x => [x.id, x.name, x.connected ? '' : tx('offline')])], d.dataset.v); if (v !== undefined) { d.dataset.v = v; d.querySelector('span').textContent = v ? S.displays.find(x => x.id === v).name : tx('Alle offenen ({n})', { n: ready.length }); } return; }
    if (e.target.closest('#try-send')) {
      e.preventDefault();
      const to = d_ => (d_ ? [S.displays.find(x => x.id === d_)] : ready).filter(x => x?.connected), list = to($('#try-d', el).dataset.v), res = $('#try-res', el);
      if (!list.length) { res.textContent = tx('Dieses Display ist nicht geöffnet.'); return; }
      const title = $('#try-title', el).value.trim(), message = $('#try-msg', el).value.trim() || tx('Die Mitteilung funktioniert.'), durV = $('#try-dur', el).value.trim(), dur = durV !== '' && +durV >= 0 ? Math.min(+durV, 3600) : null;
      res.textContent = tx('Sende …');
      try { await Promise.all(list.map(x => call('command', { display: x.id, action: 'notify', ...(title && { title }), message, ...(dur !== null && { duration: dur }) }))); res.textContent = list.length > 1 ? tx('Gesendet an {n} Displays.', { n: list.length }) : tx('Gesendet an {n} Display.', { n: list.length }); }
      catch (er) { res.textContent = er?.message || tx('Fehler'); }
    }
  });
  $('#try', el).addEventListener('submit', e => e.preventDefault());
}

// ================= Neues Display =================
export function newDisplay(el, route) {
  const pending = () => S.displays.filter(x => x.new);
  let id = route.id || '', area = '', tpl = 'std'; const names = {};   // getippte Namen je Display: bleiben beim Wechsel der Chips erhalten
  const note = () => { const c = setupConfig(tpl, area); return `${tx('Du bekommst: {list}.', { list: c.faces.map(f => FACE[f.type][0] + (f.type === 'grid' ? (f.tiles.length ? ' ' + tx('({n} Kacheln)', { n: f.tiles.length }) : ' ' + tx('(leer, Kacheln fügst du gleich hinzu)')) : f.type === 'energy' ? (f.ents ? ' ' + tx('({n} Werte erkannt)', { n: Object.keys(f.ents).length - 1 }) : ' ' + tx('(nichts erkannt, Werte wählst du im Editor)')) : '')).join(' · ') })}${c.off.length ? ' ' + tx('Bereit, aber versteckt, weil dein Haus dafür nichts hat: {list}.', { list: c.off.map(f => FACE[f.type][0]).join(', ') }) : ''}`; };
  const chip = (attr, on_, text) => `<button class="chip pick ${on_ ? 'on' : ''}" ${attr}>${esc(text)}</button>`;
  let shown = 0;   // 0 Anleitung, 1 Formular, 2 Auswahl
  const draw = () => {
    const d = S.displays.find(x => x.id === id && x.new), list = pending();
    if (!list.length) return shown = 0, frame(el, tx('Neues Display'), tx('Zeig deinem Haus ein Display.'), G(tx('Noch kein neues Display angemeldet'), `<ol class="steps"><li>${tx('Öffne Homeblick auf dem Gerät. In der Home-Assistant-App: Seitenleiste → Homeblick.')}</li><li>${tx('Das Display erscheint hier als neues Display, dann geht es in drei Schritten weiter.')}</li></ol>`, tx('Für mehrere Geräte im selben Browser hilft <code>?display=kueche&amp;name=Küche</code> hinter der Adresse.')));
    if (!id) id = list[0].id;   // keine Adress-ID: das erste wartende Display
    shown = d ? 1 : 2;
    // Adress-ID wartet nicht (mehr): nie still ein anderes Display einrichten, der Nutzer wählt selbst
    if (!d) return frame(el, tx('Neues Display'), tx('Name, Bereich und Vorlage wählen, fertig.'), G(tx('Dieses Display wartet nicht mehr'), `<p class="panel-p">${tx('Es ist schon eingerichtet oder gerade nicht angemeldet. Wähle eines der wartenden Displays:')}</p><div class="quick">${list.map(x => chip(`data-d="${esc(x.id)}"`, false, x.name + (x.connected ? '' : ' · ' + tx('nicht verbunden')))).join('')}</div>`) + `<div class="actions"><button class="btn quiet big" data-goto="#/">${tx('Später')}</button></div>`);
    const cur_ = d;
    frame(el, tx('Neues Display'), tx('Name, Bereich und Vorlage wählen, fertig.'), `${list.length > 1 ? G(tx('Display'), `<div class="quick">${list.map(x => chip(`data-d="${esc(x.id)}"`, x.id === id, x.name + (x.connected ? '' : ' · ' + tx('nicht verbunden')))).join('')}</div>`) : ''}
      ${G(tx('1 · Name'), `<div class="srow"><input id="wn" class="wide" value="${esc(names[id] ?? cur_.name)}" maxlength="60" autocomplete="off"></div>`)}
      ${G(tx('2 · Bereich'), `<div class="quick">${[['', tx('Keiner')], ...areasOf().map(a => [a, a])].map(([a, t]) => chip(`data-a="${esc(a)}"`, a === area, t)).join('')}</div>`)}
      ${G(tx('3 · Vorlage'), `<div class="tpls">${SETUP.map(([k, n, t]) => `<button class="tpl ${k === tpl ? 'on' : ''}" data-t="${k}"><span class="t"><b>${n}</b><small>${t}</small></span>${ic('check', 'ck')}</button>`).join('')}</div>`, '<span id="tpl-note"></span>')}
      <div class="actions"><button class="btn big" id="go">${ic('check')}${tx('Einrichten')}</button><button class="btn quiet big" data-goto="#/">${tx('Später')}</button></div>`);
  };
  const paintNote = () => { const n = $('#tpl-note', el); if (n) n.textContent = note(); };
  draw(); paintNote();
  // 5-s-Aktualisierung: neu angemeldetes Display erscheint von selbst; das angezeigte Formular bleibt unangetastet, solange sein Display noch wartet
  let busy = false;
  // zweites wartendes Display: neuer Chip, der getippte Name bleibt erhalten (names)
  const off = on('list', () => { if (busy) return; const n = pending().length, s = !n ? 0 : pending().some(x => x.id === id) || !id ? 1 : 2; if (s !== shown || $$('[data-d]', el).length !== (s === 2 || n > 1 ? n : 0)) { if (shown === 1) names[id] = $('#wn', el).value; draw(); paintNote(); } });
  el.addEventListener('click', async e => {
    const x = e.target.closest('[data-d]'), a = e.target.closest('[data-a]'), t = e.target.closest('[data-t]');
    if (x) { if (shown === 1) names[id] = $('#wn', el).value; id = x.dataset.d; draw(); return paintNote(); }
    if (a) { area = a.dataset.a; $$('[data-a]', el).forEach(b => b.classList.toggle('on', b === a)); return paintNote(); }
    if (t) { tpl = t.dataset.t; $$('[data-t]', el).forEach(b => b.classList.toggle('on', b === t)); return paintNote(); }
    if (!e.target.closest('#go')) return;
    const d = S.displays.find(v => v.id === id), name = $('#wn', el).value.trim() || d.name;
    const config = setupConfig(tpl, area), wx = entsOf('weather'), w = wx.find(v => v.id === 'weather.home') || wx[0];
    busy = true;   // nach dem Einrichten ist das Display nicht mehr „neu“: kein Zurückspringen auf die Anleitung vor dem Seitenwechsel
    try { await guard(call('setup', { display: id, name, ...(area && { area }), config, settings: config.faces.some(f => f.type === 'weather') && w ? { weather: w.id } : {} })); } catch { busy = false; return; }
    await reload(); location.hash = `#/d/${encodeURIComponent(id)}`;
    try { if (!localStorage.getItem('hb-admin.tour')) { localStorage.setItem('hb-admin.tour', '1'); setTimeout(openHelp, 700); } else toast(tx('Display eingerichtet'), { action: tx('So funktioniert es'), run: openHelp }); } catch { /* Speicher gesperrt */ }
  });
  return off;
}
