// Sprachausgabe: am Display (Audio) oder auf einem media_player (announce, Sonos senkt die laufende Musik selbst).
// Musik anderer Player geht währenddessen auf duck % der Lautstärke (0 oder 100 = aus) und danach zurück.
// o: { path (am Display abspielbar), media (für den Player), out (media_player oder ''), duck, volume (0–100) } → { done: Promise (natürliches Ende), stop }
export function playSpeech(conn, ents, o) {
  const call = (service, data) => { try { return conn.sendMessagePromise({ type: 'call_service', domain: 'media_player', service, service_data: data }).catch(e => console.warn('HA', service, e)); } catch { } };
  let back = [], timer, resolve;
  if (o.duck > 0 && o.duck < 100) {
    for (const e of Object.values(ents())) {
      const v = e.attributes?.volume_level;
      if (e.entity_id.startsWith('media_player.') && e.state === 'playing' && e.attributes.device_class !== 'tv' && e.entity_id !== o.out && v != null) {
        back.push([e.entity_id, v]); call('volume_set', { entity_id: e.entity_id, volume_level: v * o.duck / 100 });
      }
    }
  }
  const end = () => { clearTimeout(timer); back.forEach(([entity_id, volume_level]) => call('volume_set', { entity_id, volume_level })); back = []; };   // Musik zurück; stop() ruft nur das auf, done meldet nur das natürliche Ende
  const finish = () => { end(); resolve(); }, done = new Promise(r => { resolve = r; });
  if (o.out) {
    // ponytail: Ende = Dauer der Datei + Puffer (kein Abgleich mit dem Player-Zustand); stop() beendet nur unsere Seite, die Ansage läuft am Player aus
    call('play_media', { entity_id: o.out, media_content_id: o.media, media_content_type: 'music', announce: true, extra: { volume: o.volume } });
    const a = new Audio(o.path); a.preload = 'metadata';
    const wait = s => { timer = setTimeout(finish, s * 1000 + 1500); };
    a.onloadedmetadata = () => wait(Math.min(isFinite(a.duration) ? a.duration : 6, 60)); a.onerror = () => wait(6);
    return { done, stop: end };
  }
  const a = new Audio(o.path); a.volume = o.volume / 100;
  a.onended = a.onerror = finish; a.play().catch(finish);
  return { done, stop: () => { a.pause(); end(); } };
}
