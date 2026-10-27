// Energie-Erkennung (admin/detect.js) gegen erfundene Häuser: node tests/detect.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../custom_components/homeblick/frontend/admin/detect.js', import.meta.url));
const { detect, ready } = await import('data:text/javascript;base64,' + src.toString('base64'));
// e(id, Anzeigename, Einheit, Geräteklasse, { area, device })
const e = (id, name, unit, dc, o = {}) => ({ id, domain: id.split('.')[0], name, unit, dc, area: '', device: '', hide: false, ...o });
const noise = [   // Haushaltsgeräte und Handys dürfen nie als Energie-Werte erkannt werden
  e('sensor.waschmaschine_leistung', 'Waschmaschine Leistung', 'W', 'power', { area: 'Keller' }), e('sensor.buero_pc_power', 'Büro PC Power', 'W', 'power', { area: 'Büro' }),
  e('sensor.wohnzimmer_ac_power_consumption', 'Wohnzimmer AC Power consumption', 'W', 'power', { area: 'Wohnzimmer' }), e('sensor.iphone_battery_level', 'iPhone Battery level', '%', 'battery'),
  e('sensor.maehroboter_akku', 'Mähroboter Akku', '%', 'battery'), e('sensor.keller_trockner_energie', 'Trockner Energie heute', 'kWh', 'energy', { area: 'Keller' }),
];

// Englisch: SolarEdge, Shelly-Zähler, Tesla Wall Connector
const en = detect([...noise,
  e('sensor.solaredge_current_power', 'SolarEdge Current power', 'W', 'power', { device: 'SolarEdge' }), e('sensor.shelly_em_grid_power', 'Grid power', 'W', 'power'),
  e('sensor.home_consumption_power', 'Home consumption power', 'W', 'power'), e('sensor.tesla_wall_connector_power', 'Tesla Wall Connector Power', 'W', 'power'),
  e('sensor.tesla_battery_level', 'Tesla Battery level', '%', 'battery'), e('sensor.tesla_range', 'Tesla Range', 'km', 'distance'), e('sensor.tesla_odometer', 'Tesla Odometer', 'km', 'distance'),
], null);
assert.deepEqual(en, { pv: 'sensor.solaredge_current_power', grid: 'sensor.shelly_em_grid_power', home: 'sensor.home_consumption_power', car: 'sensor.tesla_wall_connector_power', carSoc: 'sensor.tesla_battery_level', range: 'sensor.tesla_range' });

// Deutsch: Zähler, Batterie mit Ladestand, PV-Ertrag und Prognose; das Auto-Handy und ein Gerät im Raum bleiben draußen
const de = detect([...noise,
  e('sensor.sma_pv_leistung', 'SMA PV Leistung', 'W', 'power'), e('sensor.stromzaehler_leistung', 'Stromzähler Leistung', 'W', 'power'), e('sensor.hausverbrauch_leistung', 'Hausverbrauch Leistung', 'W', 'power'),
  e('sensor.batterie_leistung', 'Batterie Leistung', 'W', 'power'), e('sensor.batterie_ladestand', 'Batterie Ladestand', '%', 'battery'), e('sensor.wallbox_ladeleistung', 'Wallbox Ladeleistung', 'kW', 'power'),
  e('sensor.pv_ertrag_heute', 'PV Ertrag heute', 'kWh', 'energy'), e('sensor.pv_prognose_heute', 'PV Prognose heute', 'kWh', 'energy'), e('sensor.pv_prognose_morgen', 'PV Prognose morgen', 'kWh', 'energy'),
], null);
assert.deepEqual(de, { pv: 'sensor.sma_pv_leistung', grid: 'sensor.stromzaehler_leistung', home: 'sensor.hausverbrauch_leistung', bat: 'sensor.batterie_leistung', soc: 'sensor.batterie_ladestand', car: 'sensor.wallbox_ladeleistung', today: 'sensor.pv_ertrag_heute', todayFc: 'sensor.pv_prognose_heute', tomorrow: 'sensor.pv_prognose_morgen' });
assert.ok(ready(de) && !ready({ pv: 1 }));

// Nur Haushaltsgeräte: nichts erkennen, Face bleibt versteckt
assert.deepEqual(detect(noise, null), {}); assert.ok(!ready({}));

// Energie-Dashboard hat Vorrang (Ladestand des einzigen Akkus), versteckte Entities zählen nicht
const dash = detect([e('sensor.mein_akku_x', 'Mein Akku', '%', 'battery'), e('sensor.batterie_ladestand', 'Batterie Ladestand', '%', 'battery', { hide: true }), e('sensor.sma_pv_leistung', 'SMA PV Leistung', 'W', 'power')],
  { energy_sources: [{ type: 'battery', stat_soc: 'sensor.mein_akku_x' }] });
assert.deepEqual(dash, { pv: 'sensor.sma_pv_leistung', soc: 'sensor.mein_akku_x' });
console.log('detect: ok');
