// Kalendertermine 
// Tagesüberschrift fett, je Termin eine getönte Pille — ganztägig: Kalenderkreis links, „ganztägig“ rechts;
// mit Uhrzeit: Farbbalken links, Titel, darunter Uhr + Zeitspanne. Farbe je Kalender (sortierte calendar.*-Entities).
// Nicht in der (Annahme): Tipp aufs Kalender-Face öffnet die Liste als Vollbild (#events).

import { tx, LOC } from './i18n.js';

const COLORS = ['#007aff', '#ff9500', '#34c759', '#af52de', '#ff2d55', '#5ac8fa'];
const DAYS = 30;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const local = d => d.toLocaleString('sv-SE');   // „2026-10-19 00:00:00“ = HA-Ortszeit
const ymd = d => local(d).slice(0, 10);
const parse = s => new Date(s.length === 10 ? s + 'T00:00' : s);   // ganztägig = Datum ohne Zeit
const hm = d => d.toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' });

// HA: calendar.get_events (Antwort { 'calendar.x': { events: [{ start, end, summary }] } }); ohne ask → Demo.
// Je Kalender einzeln: ein Fehler in einem Aufruf mit mehreren Entities bricht in HA den ganzen Aufruf ab
export async function loadEvents(ids, ask) {
  if (!ids.length) return [];
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const span = { start_date_time: local(t0), end_date_time: local(new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + DAYS)) };
  let r = demo(t0);
  if (ask) {
    const rs = await Promise.allSettled(ids.map(id => ask('calendar', 'get_events', { entity_id: id, ...span })));
    if (rs.every(x => x.status === 'rejected')) throw rs[0].reason;
    r = Object.assign({}, ...rs.map(x => x.value));
  }
  return Object.entries(r).flatMap(([cal, v]) => (v.events || []).map(e => ({
    color: COLORS[ids.indexOf(cal) % COLORS.length], title: e.summary, allDay: e.start.length === 10, start: parse(e.start), end: parse(e.end),
  }))).sort((a, b) => a.start - b.start || b.allDay - a.allDay);
}

function demo(t0) {
  const at = (d, h, m = 0) => new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + d, h, m).toISOString();
  const day = d => ymd(new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + d));
  const ev = (summary, start, end) => ({ summary, start, end });
  return {
    'calendar.familie': { events: [ev(tx('Elternabend'), at(0, 19), at(0, 20, 30)), ev(tx('Telefonat mit Oma'), at(0, 20, 45), at(0, 21)), ev(tx('Yoga'), at(0, 21, 15), at(0, 22)), ev(tx('Lesen'), at(0, 22, 15), at(0, 22, 45)), ev(tx('Zahnarzt'), at(3, 10, 30), at(3, 11, 15)), ev(tx('Kinoabend'), at(9, 20), at(9, 22, 30))] },
    'calendar.geburtstage': { events: [ev(tx('Weltkindertag'), day(0), day(1)), ev(tx('Omas Geburtstag'), day(1), day(2)), ev(tx('Leons Geburtstag'), day(12), day(13))] },
    'calendar.mullabfuhr': { events: [ev(tx('Gelber Sack'), day(0), day(1)), ev(tx('Papiertonne'), day(2), day(3)), ev(tx('Restmüll'), day(6), day(7))] },
  };
}

// Zeitspanne; über Mitternacht (Ende 00:00 exakt zählt noch zum Starttag) beide Enden mit Datum
function when(e, d) {
  const dm = x => x.toLocaleDateString(LOC, { day: 'numeric', month: 'short' });
  return ymd(e.start) === ymd(new Date(e.end - (e.end > e.start))) ? `${dm(d)}, ${hm(e.start)}–${hm(e.end)}` : `${dm(e.start)}, ${hm(e.start)} – ${dm(e.end)}, ${hm(e.end)}`;
}

const st = n => n < 10 ? n : 0;   // Stagger nur für die ersten 10 Zeilen (35 ms je Zeile); lange Listen sollen nicht Sekunden brauchen

// Liste als HTML; Termine, die vor heute begonnen haben, stehen unter heute
export function eventsHTML(list, max = Infinity) {
  if (!list.length) return `<p class="evnone">${tx('Keine Termine in den nächsten {n} Tagen', { n: DAYS })}</p>`;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  let last = '', i = 0, html = '';
  for (const e of list.slice(0, max)) {
    const d = e.start < t0 ? t0 : e.start, day = d.toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long' });
    if (day !== last) html += `<h4 style="--i:${st(i++)}">${day}</h4>`;
    last = day;
    html += e.allDay
      ? `<div class="ev ad" style="--c:${e.color};--i:${st(i++)}"><svg class="i"><use href="#evcal"/></svg><b>${esc(e.title)}</b><span>${tx('ganztägig')}</span></div>`
      : `<div class="ev" style="--c:${e.color};--i:${st(i++)}"><b>${esc(e.title)}</b><span><svg class="i"><use href="#evclock"/></svg> ${when(e, d)}</span></div>`;
  }
  return html;
}

// Müllabfuhr: Tonne aus dem Titel eines Ganztagstermins (Heuristik nach Titeln der Anbieter, Wortanfang beachten); Farben wie die Tonnen in Deutschland
const BINS = [
  { rx: /(^|[^a-zäöüß])(rest|haus)(m[uü]ll|tonne|abfall)|schwarze tonne|graue tonne|general waste/i, name: tx('Restmüll'), short: tx('Rest‖Tonne'), color: '#636366' },
  { rx: /(^|[^a-zäöüß])bio(tonne|m[uü]ll|abfall|\b)|braune tonne|organic waste/i, name: tx('Biotonne'), short: tx('Bio‖Tonne'), color: '#a2672f' },
  { rx: /(^|[^a-zäöüß])(alt)?papier|pappe|blaue tonne|paper bin/i, name: tx('Papiertonne'), short: tx('Papier‖Tonne'), color: '#0a84ff' },
  { rx: /gelbe?r? (sack|s[aä]cke|tonne)|wertstoff|leichtverpackung|yellow bag/i, name: tx('Gelber Sack'), short: tx('Gelb‖Tonne'), color: '#ffd60a' },
  { rx: /gr[uü]n(schnitt|gut|tonne)|laubsack/i, name: tx('Grünschnitt'), short: tx('Grün‖Tonne'), color: '#30b94d' },
];
const binOf = title => BINS.find(b => b.rx.test(title));
const dayNo = d => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);   // Kalendertage, nicht ms/86400000 (Sommerzeit)
// Nächster Abholtag mit erkannten Tonnen in den nächsten 7 Tagen; heute nur bis 12 Uhr (danach ist abgeholt). null = nichts
export function wasteChip(list, now = new Date()) {
  const n = dayNo(now), found = new Map();   // Tag → Tonnen
  for (const e of list) {
    const b = e.allDay && binOf(e.title), d = dayNo(e.start) - n;
    if (b && d >= 0 && d <= 7 && !(d === 0 && now.getHours() >= 12)) (found.get(d) || found.set(d, new Set()).get(d)).add(b);
  }
  if (!found.size) return null;
  const d = Math.min(...found.keys()), bins = [...found.get(d)];
  const names = bins.map(b => d > 1 || bins.length > 1 ? b.short : b.name).join(' + ');   // kurz, sonst bricht die 42-cqw-Spalte (Ellipse)
  return { bins, text: d === 0 ? tx('Heute: {names}', { names }) : d === 1 ? tx('Morgen: {names}', { names }) : tx('{names} in {d} Tagen', { names, d }) };
}
const chipHTML = c => c ? `<div class="ew"><i>${c.bins.map(b => `<svg class="i bin" style="color:${b.color}"><use href="#evbin"/></svg>`).join('')}</i><span>${esc(c.text)}</span></div>` : '';

// Info-Face (Vorlage Video y-MO 08500 / _Tbq 01230): nur heute — „N ganztägig“, die nächsten zwei Termine mit Zeit, „N weitere Termine“
export function infoHTML(list, now = new Date()) {
  const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
  const t1 = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + 1);
  const day = list.filter(e => e.start < t1 && e.end > t0), ad = day.filter(e => e.allDay), tm = day.filter(e => !e.allDay && e.end > now), more = tm.length - 2;
  const chip = chipHTML(wasteChip(list, now));   // ersetzt die Restzeile („N weitere“ / „Keine Termine heute“), damit das Raster nicht überläuft; Tippen öffnet wie der ganze Block die Terminliste
  return (ad.length ? `<div class="ea"><i><svg class="i"><use href="#evcal"/></svg></i>${tx('{n} ganztägig', { n: ad.length })}</div>` : '')
    + tm.slice(0, 2).map(e => `<div class="ee"><b>${hm(e.start < t0 ? t0 : e.start)}–${hm(e.end)}</b><span>${esc(e.title)}</span></div>`).join('')
    + (chip ? chip : more > 0 ? `<div class="em">${more > 1 ? tx('{n} weitere Termine', { n: more }) : tx('{n} weiterer Termin', { n: more })}</div>` : ad.length || tm.length ? '' : `<div class="em">${tx('Keine Termine heute')}</div>`);
}

// Selbstcheck: Sortierung (ganztägig vor Uhrzeit am selben Tag), Gruppierung, Escaping
{
  const d = new Date(2030, 0, 5, 9), list = [{ color: '#f00', title: 'A<b>', allDay: false, start: d, end: new Date(+d + 36e5) }, { color: '#0f0', title: 'B', allDay: true, start: new Date(2030, 0, 5), end: new Date(2030, 0, 6) }]
    .sort((a, b) => a.start - b.start || b.allDay - a.allDay);
  const h = eventsHTML(list);
  console.assert(list[0].title === 'B' && (h.match(/<h4/g) || []).length === 1 && h.includes('A&#60;b&#62;') && h.includes('09:00–10:00'), 'eventsHTML');
}

{
  const at = (d, title, allDay = true) => ({ title, allDay, start: new Date(2030, 0, 5 + d), end: new Date(2030, 0, 6 + d) }), morning = new Date(2030, 0, 5, 8), evening = new Date(2030, 0, 5, 18);
  const w = (l, now) => wasteChip(l, now)?.text;
  console.assert(w([at(0, 'Restmüll')], morning) === tx('Heute: {names}', { names: tx('Restmüll') }) && w([at(0, 'Restmüll')], evening) === undefined, 'Müll: heute nur bis 12 Uhr');
  console.assert(w([at(1, 'Biotonne'), at(1, 'Papiertonne'), at(4, 'Gelber Sack')], evening) === tx('Morgen: {names}', { names: tx('Bio‖Tonne') + ' + ' + tx('Papier‖Tonne') }), 'Müll: mehrere Tonnen am selben Tag');
  console.assert(w([at(3, 'Gelber Sack')], evening) === tx('{names} in {d} Tagen', { names: tx('Gelb‖Tonne'), d: 3 }) && w([at(9, 'Biotonne')], evening) === undefined, 'Müll: höchstens 7 Tage');
  console.assert(w([at(1, 'Biologie Prüfung'), at(1, 'Papier', false)], evening) === undefined, 'Müll: nur Tonnen, nur ganztägig');
}

document.querySelector('body > svg').insertAdjacentHTML('beforeend', `
<symbol id="evcal" viewBox="0 0 24 24"><rect x="5.5" y="6.5" width="13" height="12" rx="2.4" stroke-width="1.7"/><path d="M5.5 10h13" stroke-width="1.7"/><g fill="currentColor" stroke="none"><circle cx="9" cy="13" r=".95"/><circle cx="12" cy="13" r=".95"/><circle cx="15" cy="13" r=".95"/><circle cx="9" cy="15.8" r=".95"/><circle cx="12" cy="15.8" r=".95"/></g></symbol>
<symbol id="evbin" viewBox="0 0 24 24"><path d="M9 3.6h6l.6 1.6H19a1 1 0 010 2H5a1 1 0 010-2h3.4z"/><path d="M6.3 9h11.4l-.9 10.2a1.9 1.9 0 01-1.9 1.7H9.1a1.9 1.9 0 01-1.9-1.7z"/></symbol>
<symbol id="evclock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" stroke-width="2"/><path d="M12 7.5V12l3 2" stroke-width="2"/></symbol>`);

// Maße aus der Vorlage Website siri-ai/gallery_context (Frontalbild, Kalender-Antwort; % Displaybreite, Schrift Inter breitenabgeglichen): Pille 91,2 % breit (x 4,4–95,6), ganztägig 10,9 % hoch mit Kreis ⌀ 4,95 (x 7,5),
// Titel 2,95 % Semibold ab x 14,75, „all-day“ 2,6 % rechts mit 3,1 % Rand; Termin 13,0 % hoch, Balken 1,3 × 7,1 (x 7,4), Titel ab x 11,2 (Grundlinie 6,0 unter Pillenkante), Zeile Uhr + Datum/Zeit 2,75 % (Grundlinie 9,5);
// Tagesüberschrift 3,1 % Semibold (x 10,4), Grundlinie 2,45 über der Pille, 7,6 unter der vorigen. Farben: Pille 15 % Kalenderfarbe auf Weiß, Titel 40 %, Zeitzeile 66 % Kalenderfarbe auf Schwarz.
document.head.insertAdjacentHTML('beforeend', `<style>
#events{background:#fff;color:#1c1c1e}
.evb .ew{display:flex;align-items:center;gap:2cqw;width:45cqw;margin-top:2.85cqw;height:7cqw;font-size:3.6cqw;color:var(--t1)}
.ew i{display:flex;align-items:center;gap:.2cqw;flex:none;height:7cqw;padding:0 1.6cqw;border-radius:9cqw;background:var(--btn)}
.ew svg.bin{width:4.4cqw;height:4.4cqw;fill:currentColor;stroke:none;filter:drop-shadow(0 0 .25cqw #0007)}
.ew span{min-width:0;overflow:hidden;text-overflow:ellipsis}
#events .x{background:#0000000f}
#events .top{font-size:3.8cqw}
.evl{position:absolute;inset:15cqw 0 0;overflow-y:auto;scrollbar-width:none;touch-action:pan-y;overscroll-behavior:contain;padding:0 4.4cqw 8cqw}
.evl::-webkit-scrollbar{display:none}
.evl h4,.acal h4{font-size:3.1cqw;line-height:1;font-weight:600;padding:4.91cqw 0 2.03cqw 5.9cqw}
.evl h4:first-child,.acal h4:first-child{padding-top:0}
.ev{position:relative;display:flex;align-items:center;gap:2.35cqw;height:10.88cqw;padding:0 3.1cqw 0 3.07cqw;border-radius:6cqw;
  background:color-mix(in srgb,var(--c) 15%,#fff);color:color-mix(in srgb,var(--c) 40%,#000);font-size:2.95cqw;line-height:1}
.ev b{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ev.ad>svg{flex:none;width:4.95cqw;height:4.95cqw;padding:.8cqw;border-radius:50%;background:var(--c);color:#fff}
.ev.ad span{font-size:2.6cqw}
.ev:not(.ad){display:block;height:12.98cqw;padding:3.41cqw 3cqw 0 6.83cqw}
.ev:not(.ad)::before{content:"";position:absolute;left:3cqw;top:3cqw;width:1.29cqw;height:7.13cqw;border-radius:1cqw;background:var(--c)}
.ev:not(.ad) b{display:block}
.ev:not(.ad) span{display:flex;align-items:center;gap:.3cqw;margin-top:.77cqw;font-size:2.75cqw;color:color-mix(in srgb,var(--c) 66%,#000)}
.ev:not(.ad) span svg{width:2.4cqw;height:2.4cqw}
.ev+.ev{margin-top:2cqw}
.evnone{text-align:center;color:#8e8e93;padding-top:20cqw;font-size:3.8cqw}
/* Einblenden wie Assist-Antwort: von unten mit der Feder, gestaffelt */
.evl>*{animation:evin var(--sd) var(--spring) calc(var(--i,0)*35ms) both}
@keyframes evin{from{opacity:0;transform:translateY(4cqw)}}
</style>`);
