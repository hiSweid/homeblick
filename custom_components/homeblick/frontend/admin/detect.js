// Energie-Entities automatisch erkennen (Face „Energie“): zuerst das Energie-Dashboard von HA, sonst Einheit, Geräteklasse und Name.
// Ergebnis = { Schlüssel: entity_id } wie f.ents. Was nicht sicher passt, bleibt weg (das Face blendet es aus), lieber nichts als etwas Falsches.
// Vorzeichen (Netz + = Bezug, Akku + = Entladen) gibt der Sensor vor; Integrationen mit anderer Konvention zeigen es verkehrt herum.
const fold = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
// Wörter aus Entity-ID und eigenem Namen; der Gerätename steckt im Anzeigenamen jeder Entity (evcc „… Solar Charging“) und würde sonst überall „solar“ treffen
const words = e => fold(`${e.id.split('.')[1]} ${e.device && e.name.startsWith(e.device) ? e.name.slice(e.device.length) : e.name}`.replace(/[_\-.]/g, ' '));
const W = s => new RegExp(`(^| )(${s})`);          // Wortanfang: „solar“ trifft auch „solarleistung“
const POW = e => e.domain === 'sensor' && (e.dc === 'power' || /^k?w$/i.test(e.unit));
const ENG = e => e.domain === 'sensor' && /^[km]?wh$/i.test(e.unit);
const PCT = e => e.domain === 'sensor' && e.unit === '%';
const STORE = '(batter|akku|speicher|storage|powerwall)', PHASE = 'phase|l[123]( |$)|voltage|spannung|tariff|price|preis', FC = 'forecast|prognose|solcast|estimate|vorhersage';
const CAR = 'vehicle|fahrzeug|golf|tesla|zoe|leaf|enyaq|ioniq|bmw|audi|kia|polestar|(ev|car|auto|e auto)( |$)';   // „ev“ nur als ganzes Wort, sonst trifft es evcc
const B = s => new RegExp(`(^| )(${s}${s && '|'}${PHASE})|${FC}`);   // Ausschluss; Prognosen auch mitten im Wort („solarprognose“)
// Schlüssel: [Art, stark (+2), schwach (+1), Ausschluss, Pflicht, Mindestpunkte]; ohne Bereich zählt +1 für die Mindestpunkte (Haus-Sensoren hängen selten in einem Raum)
const RULES = {
  pv: [POW, W('pv|solar|photovolt|wechselrichter|inverter|erzeugung'), W('generation|produktion|production|piko|fronius|growatt|goodwe|solaredge'), B('peak|spitze|batter|akku|speicher|string|today|heute|daily|total|gesamt|grid|netz')],
  grid: [POW, W('grid|netz|ehz|[a-z]*(zaehler|zahler|meter)'), null, B('batter|akku|speicher|car|wall ?(box|connector)|charg|lade|solar|pv|inverter|wechselrichter|klima')],
  home: [POW, W('home|house|haus'), W('consumption|verbrauch|usage|stromverbrauch'), B('car|wall ?(box|connector)|charg|lade|batter|akku|speicher|solar|pv|grid|netz|klima|air cond|standby|ac( |$)')],
  bat: [POW, W(STORE), null, B(`soc|level|capacity|kapazit|charg|lade|temperatur|temperature|current|ac( |$)|${CAR}`)],
  soc: [PCT, W('soc|ladestand|state of charge|ladezustand'), null, W(CAR), W(STORE)],
  car: [POW, W('wall ?(box|connector)|charger|ladepunkt|ladestation|ladeleistung|evse|autolader|lader|charge power|charging power'), null, B(`${STORE}|total|energy|remaining|session|limit|solar|pv|grid|netz|home|house|haus`)],
  carSoc: [PCT, W(CAR), null, W('limit|ipad|iphone|phone|handy|tablet|watch|maeh|rasen|mower|navimow|oilfox|ble|remote|speicher|storage'), W('soc|batter|akku|ladestand|state of charge|ladezustand|level')],
  range: [e => e.domain === 'sensor' && (e.dc === 'distance' || /^km$/i.test(e.unit)), W('range|reichweite')],
  today: [ENG, W('daily|today|heute|tages|day'), W('solar|pv|erzeugung|yield|ertrag|produc|generation|piko|inverter|wechselrichter'), B('cost|kosten|grid|netz|batter|akku|speicher|charg|lade|consum|verbrauch|import|export|einspeis|bezug|home|house|haus|water|wasser|gas|heiz|heat|peak|max|total|gesamt'), null, 3],
  todayFc: [ENG, new RegExp(FC), null, W('remaining|verbleib|peak|spitze|hour|stunde|power|leistung|tomorrow|morgen|tag ?[2-9]|next'), W('today|heute')],
  tomorrow: [ENG, new RegExp(FC), null, W('remaining|verbleib|peak|spitze|hour|stunde|power|leistung|today|heute|tag ?[2-9]|next'), W('tomorrow|morgen')],
  tomorrowPeak: [e => e.domain === 'sensor' && e.dc === 'timestamp', W('peak|spitze'), null, null, W('tomorrow|morgen')],
};
const pre = e => e.id.split('.')[1].split('_')[0];   // erstes Wort der ID ≈ dieselbe Integration (evcc, marstek …)

/** ents: [{ id, domain, name, device, area, unit, dc, hide }] (entities.js), prefs: Antwort von energy/get_prefs oder null. */
export function detect(ents, prefs) {
  const ids = new Set(ents.map(e => e.id)), have = id => (ids.has(id) ? id : undefined), src = t => (prefs?.energy_sources || []).filter(s => s.type === t);
  const bats = src('battery'), g = src('grid')[0], out = {};
  const dash = { pv: have(src('solar')[0]?.stat_rate), grid: have(g?.power?.[0]?.stat_rate || g?.flow_from?.[0]?.stat_rate), bat: bats.length === 1 ? have(bats[0].stat_rate) : undefined, soc: bats.length === 1 ? have(bats[0].stat_soc) : undefined };
  const text = new Map(ents.map(e => [e, words(e)])), byId = Object.fromEntries(ents.map(e => [e.id, e]));
  const near = { soc: 'bat', car: null, carSoc: 'car', range: 'carSoc' };   // gehört zusammen: Ladestand zur Akku-Leistung, Auto-Ladestand zur Ladeleistung, Reichweite zum Auto-Ladestand
  for (const [key, [type, strong, weak, bad, need, min = 2]] of Object.entries(RULES)) {
    if (dash[key]) { out[key] = dash[key]; continue; }
    const ref = byId[out[near[key]]];
    let best, top = 0;
    for (const e of ents) {
      const t = text.get(e);
      if (e.hide || !type(e) || (bad && bad.test(t)) || (need && !need.test(t))) continue;
      const hit = (strong.test(t) ? 2 : 0) + (weak?.test(t) ? 1 : 0);
      if (!hit || hit + (e.area ? 0 : 1) < min) continue;   // ein Treffer im Namen bleibt Pflicht; „gleiches Gerät“ hilft nur beim Reihen
      const s = hit + (ref ? (ref.device && e.device === ref.device ? 3 : pre(e) === pre(ref) ? 2 : 0) : 0);
      if (s > top || (s === top && e.id.length < best.id.length)) [best, top] = [e, s];
    }
    if (best) out[key] = best.id;
  }
  return out;
}
/** Genug für ein sinnvolles Face: mindestens zwei der Hauptwerte. */
export const ready = m => ['pv', 'grid', 'home', 'bat', 'soc'].filter(k => m[k]).length >= 2;
