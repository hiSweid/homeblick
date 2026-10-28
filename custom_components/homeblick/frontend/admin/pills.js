// Editor der Live-Pillen (Einstellungen → Live-Pillen): Regeln in S.cfg.pills (Entwurf, „Senden“ schickt sie), Anzeige und Auswertung in ../pills.js.
import { tx } from '../i18n.js';
import { esc, ic } from './ui.js';
import { S, mutate } from './state.js';
import { entOf, pickEntity } from './entities.js';
import { entityRow, selectRow, textRow } from './controls.js';
import { PILL_ICONS, defOn } from '../pills.js';

const DOMAINS = ['binary_sensor', 'sensor', 'switch', 'input_boolean', 'light', 'fan', 'vacuum', 'lawn_mower', 'media_player', 'climate', 'humidifier', 'valve', 'water_heater'];
export const PILL_LISTS = { icon: [['', tx('Automatisch‖Automatic')], ...Object.entries(PILL_ICONS)], done: [['card', tx('Karte bis zum Wegwischen')], ['pill', tx('Nur die Pille (10 Min)')], ['none', tx('Nichts')]] };
const MAX = 8;   // so viele wertet das Display aus
const rule = k => S.cfg?.pills?.[+k.split('.')[1]];
export const pillGet = k => { const f = k.split('.')[2], v = rule(k)?.[f]; return v ?? (f === 'done' ? 'card' : ''); };

export function pillsHTML(cfg, G) {
  const list = cfg.pills || [];
  return G('', `<div class="srow"><span><span class="s-label">${tx('Was gerade läuft, als kleine Pille oben')}</span><small>${tx('Waschmaschine, Auto lädt, Mäher … Ohne laufende Quelle ist nichts zu sehen. Die oberste Regel hat Vorrang, drei Pillen gleichzeitig.')}</small></span></div>`)
    + list.map((r, i) => { const en = entOf(r.e), k = f => `p.${i}.${f}`;
      return G(esc(r.text || en?.name || r.e),
        entityRow(tx('Quelle'), k('e'), r.e, { domains: DOMAINS, title: tx('Quelle der Pille') })
        + textRow(tx('Name'), k('text'), r.text || '', { ph: en?.name || '', max: 30 })
        + textRow(tx('Läuft bei'), k('on'), r.on || '', { ph: defOn(r.e) || tx('z. B. running oder >5'), max: 60 }, tx('Zustände mit Komma, oder ein Vergleich wie >5'))
        + entityRow(tx('Anzeige rechts'), k('left'), r.left || '', { domains: ['sensor', 'input_number', 'number'], none: tx('Wert der Quelle'), title: tx('Sensor für die Anzeige') }, tx('Restzeit, Minuten oder Prozent'))
        + selectRow(tx('Symbol'), k('icon'), PILL_LISTS.icon, r.icon || '')
        + selectRow(tx('Bei Ende'), k('done'), PILL_LISTS.done, r.done || 'card', tx('Nachts im Dimm-Fenster ohne Karte'))
        + `<div class="s-actions">${i ? `<button class="btn quiet" data-pill-up="${i}">${ic('up')}${tx('Nach oben')}</button>` : ''}<button class="btn quiet danger" data-pill-del="${i}">${ic('trash')}${tx('Entfernen‖Remove')}</button></div>`);
    }).join('')
    + G('', `<button class="row accent" data-pill-add ${list.length >= MAX ? 'disabled' : ''}>${ic('plus')}${tx('Pille hinzufügen')}</button>`, list.length >= MAX ? tx('Mehr als {max} Regeln wertet das Display nicht aus.', { max: MAX }) : '');
}
// true = Zeilen neu zeichnen (andere Quelle ändert Vorschläge und Titel)
export function pillsSet(k, v) {
  const [, i, f] = k.split('.'); v = typeof v === 'string' ? v.trim() : v;
  if (f === 'e' && !v) return false;
  mutate(tx('Pille geändert'), c => { const r = c.pills?.[+i]; if (!r) return; if (v && !(f === 'done' && v === 'card')) r[f] = v; else delete r[f]; }, `pill:${k}`);
  return f === 'e' || f === 'text';
}
export async function pillsAdd() {
  const en = await pickEntity({ title: tx('Was soll die Pille zeigen?'), domains: DOMAINS }); if (!en?.id) return false;
  mutate(tx('Pille hinzugefügt'), c => { (c.pills ||= []).push({ e: en.id, text: en.name }); }); return true;
}
export function pillsDel(i) { mutate(tx('Pille entfernt'), c => { c.pills.splice(i, 1); if (!c.pills.length) delete c.pills; }); }
export function pillsUp(i) { mutate(tx('Pille verschoben'), c => { const p = c.pills; [p[i - 1], p[i]] = [p[i], p[i - 1]]; }); }
