// Energie-Summen (Heute/Woche/Monat) aus den Zählern des HA-Energie-Dashboards (energy/get_prefs) und recorder/statistics_during_period (types: change).
// Reine Rechnung ohne DOM (Selbsttest: node energy-stats.js); Abruf und Anzeige liegen in energy.js.

// Zähler-IDs aus den Energie-Einstellungen; mehrere Netz-/Solar-/Akku-Einträge werden summiert
export function sources(prefs) {
  const o = { from: [], to: [], pv: [], batOut: [], batIn: [], cost: [] };
  for (const s of prefs?.energy_sources || []) {
    if (s.type === 'grid') {
      for (const f of s.flow_from || []) { o.from.push(f.stat_energy_from); o.cost.push({ from: f.stat_energy_from, stat: f.stat_cost, fixed: f.number_energy_price, ent: f.entity_energy_price }); }
      for (const t of s.flow_to || []) o.to.push(t.stat_energy_to);
    } else if (s.type === 'solar') o.pv.push(s.stat_energy_from);
    else if (s.type === 'battery') { o.batOut.push(s.stat_energy_from); o.batIn.push(s.stat_energy_to); }
  }
  return o;
}
export const ids = o => [...new Set([...o.from, ...o.to, ...o.pv, ...o.batOut, ...o.batIn, ...o.cost.map(c => c.stat)].filter(Boolean))];

// Beginn des Zeitraums (Ortszeit, Sommerzeit-fest über setDate); ponytail: Woche beginnt Montag, nicht nach dem HA-Profil
export function startOf(p, now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (p === 'week') d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  else if (p === 'month') d.setDate(1);
  return d.getTime();
}

// rows: {id: [{change}]} je Tag; price(entityId) → aktueller Preis oder null
export function sums(src, rows, price = () => null) {
  const tot = l => l.reduce((a, id) => a + (rows[id] || []).reduce((b, r) => b + (r.change > 0 ? r.change : 0), 0), 0);   // negative Sprünge (Zählerreset) zählen nicht
  const from = tot(src.from), to = tot(src.to), pv = tot(src.pv), batOut = tot(src.batOut), batIn = tot(src.batIn);
  const use = from + pv + batOut - to - batIn;
  if (!(use > 0)) return null;   // noch nichts aufgezeichnet
  const net = Math.min(use, from), akku = Math.min(use - net, batOut), sol = use - net - akku;
  let cost = null, approx = false;
  for (const c of src.cost) {
    const ch = tot([c.from]);
    let v = null;
    if (c.stat && rows[c.stat]?.length) v = rows[c.stat].reduce((b, r) => b + (r.change || 0), 0);
    else if (c.fixed != null) v = ch * c.fixed;
    else if (c.ent && price(c.ent) != null) { v = ch * price(c.ent); approx = true; }   // aktueller Preis auf den ganzen Zeitraum: nur ungefähr
    if (v != null) cost = (cost ?? 0) + v;
  }
  return { from, to, pv, batOut, batIn, use, aut: Math.round(100 * (1 - net / use)), share: { sol, akku, net }, cost, approx };
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('energy-stats.js')) {
  const t = (c, m) => console.assert(c, m);
  const prefs = { energy_sources: [
    { type: 'grid', flow_from: [{ stat_energy_from: 'g1', stat_cost: null, number_energy_price: 0.3 }, { stat_energy_from: 'g2', stat_cost: 'g2c' }], flow_to: [{ stat_energy_to: 'e1' }] },
    { type: 'solar', stat_energy_from: 'pv1' }, { type: 'solar', stat_energy_from: 'pv2' },
    { type: 'battery', stat_energy_from: 'bo', stat_energy_to: 'bi' }] };
  const s = sources(prefs);
  t(ids(s).join() === 'g1,g2,e1,pv1,pv2,bo,bi,g2c', 'IDs gesammelt');
  const rows = { g1: [{ change: 4 }, { change: 6 }], g2: [{ change: 0 }], g2c: [{ change: 0.5 }], e1: [{ change: 3 }], pv1: [{ change: 8 }], pv2: [{ change: 2 }], bo: [{ change: 2 }], bi: [{ change: 1 }] };
  const r = sums(s, rows);
  t(Math.abs(r.use - (10 + 10 + 2 - 3 - 1)) < 1e-9, 'Verbrauch = Bezug + PV + Entladung − Einspeisung − Ladung');
  t(r.aut === 44 && Math.abs(r.share.net - 10) < 1e-9 && Math.abs(r.share.akku - 2) < 1e-9 && Math.abs(r.share.sol - 6) < 1e-9, 'Anteile und Autarkie');
  t(Math.abs(r.cost - (10 * .3 + .5)) < 1e-9 && !r.approx, 'Kosten: fester Preis + Kostenzähler');
  t(sums(s, {}) === null && sums(sources(null), rows) === null, 'ohne Daten keine Summen');
  const e = sums(sources({ energy_sources: [{ type: 'grid', flow_from: [{ stat_energy_from: 'g', entity_energy_price: 'sensor.p' }] }] }), { g: [{ change: 2 }] }, () => .25);
  t(e.cost === .5 && e.approx && e.aut === 0, 'Preis-Entität: ungefähr');
  t(sums(s, { ...rows, g1: [{ change: -5 }, { change: 6 }] }).from === 6, 'Zählerreset zählt nicht');
  const now = new Date(2026, 9, 28, 15, 30).getTime();   // Mittwoch
  t(new Date(startOf('week', now)).getDate() === 26 && new Date(startOf('month', now)).getDate() === 1 && new Date(startOf('day', now)).getHours() === 0, 'Zeitraumbeginn');
  console.log('ok');
}
