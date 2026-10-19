// Kalendertermine 
// Tagesüberschrift fett, je Termin eine getönte Pille — ganztägig: Kalenderkreis links, „ganztägig“ rechts;
// mit Uhrzeit: Farbbalken links, Titel, darunter Uhr + Zeitspanne. Farbe je Kalender (sortierte calendar.*-Entities).
// Nicht in der (Annahme): Tipp aufs Kalender-Face öffnet die Liste als Vollbild (#events).

const COLORS = ['#007aff', '#ff9500', '#34c759', '#af52de', '#ff2d55', '#5ac8fa'];
const DAYS = 30;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const local = d => d.toLocaleString('sv-SE');   // „2026-10-19 00:00:00“ = HA-Ortszeit
const ymd = d => local(d).slice(0, 10);
const parse = s => new Date(s.length === 10 ? s + 'T00:00' : s);   // ganztägig = Datum ohne Zeit
const hm = d => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

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
    'calendar.familie': { events: [ev('Elternabend', at(0, 19), at(0, 20, 30)), ev('Zahnarzt', at(3, 10, 30), at(3, 11, 15)), ev('Kinoabend', at(9, 20), at(9, 22, 30))] },
    'calendar.geburtstage': { events: [ev('Omas Geburtstag', day(1), day(2)), ev('Leons Geburtstag', day(12), day(13))] },
    'calendar.mullabfuhr': { events: [ev('Papiertonne', day(2), day(3)), ev('Restmüll', day(6), day(7))] },
  };
}

// Liste als HTML; Termine, die vor heute begonnen haben, stehen unter heute
export function eventsHTML(list, max = Infinity) {
  if (!list.length) return `<p class="evnone">Keine Termine in den nächsten ${DAYS} Tagen</p>`;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  let last = '', i = 0, html = '';
  for (const e of list.slice(0, max)) {
    const d = e.start < t0 ? t0 : e.start, day = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    if (day !== last) html += `<h4 style="--i:${i++}">${day}</h4>`;
    last = day;
    html += e.allDay
      ? `<div class="ev ad" style="--c:${e.color};--i:${i++}"><svg class="i"><use href="#evcal"/></svg><b>${esc(e.title)}</b><span>ganztägig</span></div>`
      : `<div class="ev" style="--c:${e.color};--i:${i++}"><b>${esc(e.title)}</b><span><svg class="i"><use href="#evclock"/></svg> ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}, ${hm(e.start)}–${hm(e.end)}</span></div>`;
  }
  return html;
}

// Selbstcheck: Sortierung (ganztägig vor Uhrzeit am selben Tag), Gruppierung, Escaping
{
  const d = new Date(2030, 0, 5, 9), list = [{ color: '#f00', title: 'A<b>', allDay: false, start: d, end: new Date(+d + 36e5) }, { color: '#0f0', title: 'B', allDay: true, start: new Date(2030, 0, 5), end: new Date(2030, 0, 6) }]
    .sort((a, b) => a.start - b.start || b.allDay - a.allDay);
  const h = eventsHTML(list);
  console.assert(list[0].title === 'B' && (h.match(/<h4/g) || []).length === 1 && h.includes('A&#60;b>') && h.includes('09:00–10:00'), 'eventsHTML');
}

document.querySelector('body > svg').insertAdjacentHTML('beforeend', `
<symbol id="evcal" viewBox="0 0 24 24"><rect x="5.5" y="6.5" width="13" height="12" rx="2.4" stroke-width="1.7"/><path d="M5.5 10h13" stroke-width="1.7"/><g fill="currentColor" stroke="none"><circle cx="9" cy="13" r=".95"/><circle cx="12" cy="13" r=".95"/><circle cx="15" cy="13" r=".95"/><circle cx="9" cy="15.8" r=".95"/><circle cx="12" cy="15.8" r=".95"/></g></symbol>
<symbol id="evclock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" stroke-width="2"/><path d="M12 7.5V12l3 2" stroke-width="2"/></symbol>`);

// Maße aus der zur Screenbreite: Pille 91 % breit, 10,7 % hoch (mit Zeit 13 %), Überschrift 10 % eingerückt
document.head.insertAdjacentHTML('beforeend', `<style>
#events{background:#fff;color:#1c1c1e}
#events .x{background:#0000000f}
#events .top{font-size:3.8cqw}
.evl{position:absolute;inset:15cqw 0 0;overflow-y:auto;scrollbar-width:none;padding:0 4.4cqw 8cqw}
.evl::-webkit-scrollbar{display:none}
.evl h4,.acal h4{font-size:3.6cqw;font-weight:600;padding:4.5cqw 0 1.5cqw 5.8cqw}
.evl h4:first-child,.acal h4:first-child{padding-top:0}
.ev{position:relative;display:flex;align-items:center;gap:2.6cqw;min-height:10.7cqw;padding:2.2cqw 4cqw 2.2cqw 2.7cqw;border-radius:6cqw;
  background:color-mix(in srgb,var(--c) 15%,#fff);color:color-mix(in srgb,var(--c) 55%,#000);font-size:3.4cqw;line-height:1.3}
.ev b{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ev.ad>svg{flex:none;width:5.1cqw;height:5.1cqw;padding:.7cqw;border-radius:50%;background:var(--c);color:#fff}
.ev.ad span{color:color-mix(in srgb,var(--c) 30%,#3c3c43);font-size:3cqw}
.ev:not(.ad){flex-direction:column;align-items:flex-start;gap:.3cqw;min-height:13cqw;padding-left:6.8cqw}
.ev:not(.ad)::before{content:"";position:absolute;left:2.9cqw;top:50%;width:1.3cqw;height:7cqw;margin-top:-3.5cqw;border-radius:1cqw;background:var(--c)}
.ev:not(.ad) b{width:100%}
.ev:not(.ad) span{display:flex;align-items:center;gap:1cqw;font-size:3cqw;color:color-mix(in srgb,var(--c) 80%,#000)}
.ev+.ev{margin-top:2cqw}
.evnone{text-align:center;color:#8e8e93;padding-top:20cqw;font-size:3.8cqw}
/* Einblenden wie Assist-Antwort: von unten mit der Feder, gestaffelt */
.evl>*{animation:evin var(--sd) var(--spring) calc(var(--i,0)*35ms) both}
@keyframes evin{from{opacity:0;transform:translateY(4cqw)}}
</style>`);
