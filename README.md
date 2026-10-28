# Homeblick

A fluid, glassy wall-display panel for Home Assistant. Configurable faces (grid, music, clock, weather, calendar, energy, timer, camera), spring animations, settings stored in Home Assistant and shared by every display.

**Status:** early prototype, not production ready.

## Install

Homeblick is not in the default catalog, so it is added as a custom repository (this needs a GitHub connection).

**Home Assistant 2026.11 and newer (Marketplace):**

1. *Settings → Marketplace* → **Add from link** → `hiSweid/homeblick` → **Add**.
2. Install **Homeblick**. If Home Assistant asks for a restart (repair under *Settings → System → Repairs*), restart.
3. Settings → Devices & services → Add integration → **Homeblick**.

**Home Assistant 2026.10 and older (HACS):**

1. HACS → Custom repositories → add `https://github.com/hiSweid/homeblick` (type: Integration).
2. Install **Homeblick**, restart Home Assistant.
3. Settings → Devices & services → Add integration → **Homeblick**.

Afterwards a **Homeblick** entry appears in the sidebar. Open it on the display: it reports itself and offers *Jetzt einrichten*. The settings page (*Homeblick Einstellungen*, admins) opens with a welcome and takes you through name, room and template; it jumps into that wizard as soon as the first display shows up. Faces, tiles and backgrounds are edited afterwards in the live editor.

No add-on, no extra token: the panel uses your existing Home Assistant login.

## evcc

The energy face finds its entities itself when a display is set up (and via *Fehlende automatisch erkennen* in the face's *Entitäten* list): first from Home Assistant's Energy dashboard (battery state of charge, power sensors if set), then by unit, device class and name (solar, grid, home, battery, charging power, car state of charge and range, daily yield, Solcast-style forecasts); appliances and phones are ignored. Without a clear match a value stays empty and its tile is dimmed. Without a choice it falls back to the defaults of the [ha-evcc](https://github.com/marq24/ha-evcc) integration. Grid power counts positive when drawing from the grid, battery power positive when discharging; sensors with the opposite sign show the arrow the wrong way round. The car tile's name is editable (*Bezeichnung Auto*, default *e-Golf*, *Auto* after detection). The face's tiles (solar, autarky, consumption, battery, car, today, tomorrow and the clock) are ordinary tiles: move, resize, rename, remove or add them again in the live editor (the widget gallery lists the energy tiles while the energy face is selected; solar is 2×1 or 2×2, the autarky ring 1×1 or 2×2, the others 1×1, 2×1 or 2×2). Regular entity tiles can share the face; energy tiles only exist on it.

## Several displays

Each browser/tablet is its own **display** (a device in Home Assistant, created the first time it opens Homeblick; rename it there, or give it a fixed id once per device by opening `https://<your-ha>/homeblick/index.html?live&display=kitchen&name=Kitchen` in that device's browser). Every display has its own faces and layout (new displays start from the existing one) and its own entities:

**Setting up a new display:** open Homeblick on the device (in the Home Assistant app: sidebar → Homeblick). The display shows a waiting screen (administrators get a *Jetzt einrichten* button there) and appears on the settings page under *Neue Displays*. Tap *Einrichten*, give it a name, pick an area and a template (*Standard*, preselected: every important face, namely Smart Home with the key devices of the area or of the whole house, Music, Clock, Weather, Calendar, Energy (needs two detected values), Cameras and People; faces your house has no data for stay hidden and can be switched on in *Seiten verwalten*; *Raum-Panel* fills the grid with the lights, covers, locks, scenes and thermostat of that area; *Uhr & Wetter*; *Alle Faces*) and tap *Einrichten* again: the device gets its area in Home Assistant, the faces and the weather entity, and the live editor opens to fine-tune.

- Control: **Face** (select), **Screensaver** (switch), **Reload** and **Assist** (buttons), **Announcement** (notify entity: `notify.send_message` with message and optional title is shown and spoken on the display) – use them in automations, dashboards or voice like any other entity.
- Configuration: screensaver delay and face, music face instead of the screensaver while music plays, night dimming (on, from, until, level), wake word (opt-in, keeps the microphone open: `hey_jarvis` or `alexa`) and doorbell chime.
- Diagnostics: online, last seen, face shown, resolution; browser errors of the display go to the Home Assistant log and the settings page, and *Download diagnostics* on the device collects them.

Actions for automations:

```yaml
action: homeblick.show_camera   # e.g. on motion; homeblick.hide_camera closes it
data:
  display: <device id of the display>
  camera: camera.front_door
  duration: 60   # seconds, 0 = until closed
```

```yaml
action: homeblick.notify   # white notification card; several are shown one after another
data:
  display: <device id of the display>
  title: Parcel        # optional, bold first line
  message: A parcel was delivered.
  image: camera.front_door   # optional: camera/image entity or a URL (https://… or /local/…)
  button: Open cameras       # optional blue button; with face: cams, or entity: scene.good_night / light.hallway …
  face: cams
  duration: 10   # seconds (default), 0 = until swiped or tapped away
```

The card fills the display; swipe it left (or tap it) to dismiss it, the next one follows. It wakes a sleeping display like the doorbell (no chime in do-not-disturb) and waits while Assist, the timer, the doorbell or editing is on screen. `notify.send_message` stays the spoken announcement. The settings page has a *Testbenachrichtigung* button next to *Ansage*.

A ring of the doorbell event wakes the display, plays a chime and opens the door camera.

**Cameras** (Settings page → a display → face *Kameras*, shared by all displays): the list of cameras, a light in front of each, and the doorbell (its `event` entity and the camera it belongs to). Without a choice Homeblick uses every camera of Home Assistant and the `event` entity with device class *doorbell* (paired by device, else by name). The live picture comes through Home Assistant itself, so no extra server or address is needed: WebRTC (`camera/webrtc`, e.g. via the go2rtc integration), otherwise HLS, otherwise the MJPEG/still-image proxy. Pressing *Automatisch erkennen* returns to the automatic choice.

**Control centre** (per display, on by default): swipe down from the top-right corner (at least 40 % of the height) for brightness and volume sliders, switches (do not disturb, answers muted, microphone muted, keep screen on, sleep), the now-playing card and tiles for doors, scenes and lights from the Home faces. Close it with a swipe up from the bottom-right edge, a tap beside the controls or Escape. Can be turned off on the settings page.

**Settings page** (sidebar → *Homeblick Einstellungen*, admins only): only the displays, as pictures (the last screenshot of each display, kept by the server so it survives a reload; a green dot means online, offline displays are greyed out with an *Offline* badge). Tapping a display opens it full-screen in the live editor (see below). Displays that are not set up yet appear above the pictures under *Neue Displays*. The **sliders** button there opens the display's settings as a sheet: remote actions (show face, reload, Assist, announcements), screensaver, night dimming and brightness, wake word and Assist pipeline, wake-up sensors, status (online/offline, warnings) and screenshot, templates (copy to other displays, JSON backup/import, ESP export). Entities are chosen with a searchable picker like Home Assistant's, filtered to what a tile can control. Changes reach the open display immediately. *Darstellung* sets the **theme** of all tiles at once: *Liquid* (translucent glass) or *Flat* (Apple's dashboard look: on = lavender, off = light grey), each in *Dunkel* or *Hell*.

**Tiles** (grid faces): tapping a tile in the live editor opens its sheet: entity (picker), title, subtitle, an optional live value behind the subtitle (state or any attribute), symbol, size and style (both picked by swiping through real previews of the tile; the *Größe*/*Stil* switch above chooses which): sensors can show the value large (*Wert*), scenes/switches/fans/scripts put the symbol in a circle (*Kreis*), lights become a dimmer (*Füllstand*: a white fill rises with the brightness, drag vertically to dim, tap to switch), blinds show their closing as a slatted shutter coming down from the top (*Rollo*: drag to set the position, tap to open/close; blinds without a position value only react to taps), media players fill the tile with the cover art while playing (*Cover*: room pill, title and artist on a gradient, dimmed when paused), locks keep the HomeView tile and unlock by *holding* it (a ring fills around the padlock; a short tap only shows the hint), cameras show the live picture with a *Live* pill and a *Bewegung* chip while the camera's motion sensor is on (*Livebild*; the sensor is found automatically or picked in the sheet under *Bewegungssensor*), look (follows the display's theme, or *Liquid* / *Flat* for this tile only), symbol colour when on, and an own action for tap and for hold (default, toggle, call a service with JSON data, open a face, nothing). By default, holding a light opens the full-screen dimmer and holding a blind opens a full-screen shutter view (drag the slats up or down, plus open / stop / close buttons). Also addable: analogue/digital clock and weather tiles. Entities of switch, input_boolean, button and sensor/binary_sensor domains work as tiles too.

**PIN pad:** locks that report a `code_format` ask for the code on a diamond-layout number pad (like the HomeView lock) when unlocked by hold; a wrong code clears the dots and shakes. **Squircle corners** on cards and tiles where the browser supports `corner-shape` (Chromium ≥ 139).

**Waste collection:** the info face shows a bin chip ("Morgen: Biotonne") when an all-day calendar event in the next 7 days is titled like a bin (Restmüll, Biotonne, Papier, Gelber Sack, Grünschnitt); today's pickup is shown until noon.

**Connection watchdog:** a glass pill at the top ("Keine Verbindung seit 14:02") appears 4 s after the connection drops and the tiles dim; taps shake instead of being queued, so an old tap cannot fire minutes later. A ping every 20 s catches half-open sockets and reconnects; if the server answers over HTTP but the connection stays down for 3 min, the page reloads itself (at most once per 10 min; not in the Home Assistant panel or Kiosk Satellite). Inside the kiosk quiet window (setting *Zeitplan*) the page also reloads once a night after 5 min without touch.

**Tasks face:** a glass list of a `todo.*` entity (shopping list, local tasks, Google Tasks …), live via `todo/item/subscribe`. Tap to tick, **+** to add an item with the keyboard, *Entfernen* clears the finished ones. With several lists, chips switch between them (the list named *Einkaufsliste* comes first); the editor can pin one list. Hidden by default until you enable it under the views.

**House check face:** one glance whether the house is secure: open doors/windows/garage, unlocked locks (tap *Schließen* to lock or close), water leaks, low batteries (<20 %) and unreachable sensors. The headline says "Alles zu" or "N offen"; entities can be excluded in the editor (*Ausnahmen*). Hidden in guest mode.

**Live pills:** small glass pills at the top for whatever is running ("Waschmaschine 42 Min", "Golf lädt 63 %"); invisible when nothing runs. Rules live in the display config (`pills`: entity, running states or comparison like `>5`, label, optional sensor for the right-hand value, icon, `done`). When the source stops for a minute a pulse and a "ist fertig" card follow (no card inside the dim window, so the display stays dark). Timer pills sit in the same row, one per running timer, and tapping one opens that timer; if the row gets full it wraps. Pills are hidden in guest mode. They are edited under *Einstellungen → Live-Pillen* (part of the draft, sent with *Senden*).

**Guest mode:** setting *Gastmodus* (also a switch entity per display, e.g. for an automation): calendar, info and camera faces show only a padlock until it is off.

**People face** (*Personen*, „Wo ist?“): every `person` entity as a glass row with avatar, zone or distance from home, and the battery of its device tracker; people at home are highlighted.

**Flow clock** (digital clock style *Flow*): a slowly drifting gradient of pink, blue and violet with the time as glass shapes; inside the digits the same colour blobs are repeated slightly enlarged and shifted, which gives the lens look without any live blur.

**Several places:** with two or more `weather.*` entities in Home Assistant, the weather face *Bedingungen* shows a round glass list button (top left, near view only); it lists all weather entities, a tap switches the place (name, sky, forecast) on that device and is remembered there.

**Live editor** (tap a display) works like the iOS home screen in edit mode: the tiles wiggle, **−** removes a tile, the dot at the bottom right resizes it (1×1, 2×1, 2×2), dragging moves it (the other tiles make room immediately), tapping opens its settings as a sheet. Resizing, removing and adding animate with a spring; a new tile is highlighted briefly. On wide windows the sheet docks to the right so the display stays visible and tappable; **Esc** closes it. **+** (top left) opens the widget gallery: at the top *Vorschläge für <room>* lists the devices of the display's room that are not on the face yet (one tap adds one as a 1×1 tile); below, pick a category (lights, thermostats, covers, locks, scenes, media, sensors, clock, weather …) or search, swipe through the sizes (the carousel shows the real tile; it also works with mouse drag, wheel and arrow buttons), change the entity if needed and tap *Widget hinzufügen*. Swipe left/right to change the face; the dots below the display show the faces, the last **+** adds a new one, and the face name under the dots opens that face's settings (background, style, energy entities, calendars, weather entity, delete the face). Long-pressing the dots opens *Seiten verwalten*: reorder faces by dragging the handle, hide or show them with the switch. **✓** returns to the list of displays.

Also: `#music`, `#bigclock`, … in the URL switches to that face; the screen is kept awake via the Wake Lock API.

## Kiosk / wall tablet

Open `https://<your-ha>/homeblick/index.html?live` directly in the tablet's browser (full screen, without the Home Assistant sidebar; sign in once). Without `?live` the page shows demo data. Add `&display=<id>&name=<Name>` once to give the tablet a fixed display id. Use a browser in kiosk/full-screen mode (or "Add to home screen") and keep the tablet on power; Homeblick keeps the screen awake via the Wake Lock API.

**https is required** for the microphone (Assist, wake word) and the Wake Lock: browsers only allow them on https or localhost. Reach Home Assistant via https, e.g. Home Assistant Cloud, a reverse proxy with a certificate, or a tunnel. On plain http the display works, but cannot listen and may turn its screen off.

## Voice (Assist)

Pull down or say the wake word: the microphone audio goes to your Home Assistant Assist pipeline (speech-to-text, intent, text-to-speech) and the answer is shown and spoken. Give the display's device an **area** in Home Assistant so "turn on the light" means the lights of that room. When the agent asks a follow-up question, the display listens again without the wake word. **Timers**: "set a timer for ten minutes" said at a display runs on that display (Home Assistant's intent timers, registered per display device) in the full-screen timer, wakes the display when it starts and when it ends, and shows the next one due (several timers: the glass button top left switches between them); cancel it with ✕, pause or resume it with the orange button, or by voice (extend by voice). Browsers only allow the microphone and Wake Lock on **https** (or localhost), so open Home Assistant via https; without it the display says so instead of listening.

## Lyrics

Synced lyrics come from [LRCLIB](https://lrclib.net) (exact match, then title + artist, then title; filtered by artist and duration).

## Third-party

The Home Assistant WebSocket client ([home-assistant-js-websocket](https://github.com/home-assistant/home-assistant-js-websocket) 9.7.1, Apache-2.0) is bundled unchanged in `frontend/vendor/`, so the panel starts without internet.

The wake word uses [openWakeWord](https://github.com/dscripka/openWakeWord) models in `frontend/wake/` and onnxruntime-web (from a CDN). The pre-trained models are licensed **CC BY-NC-SA 4.0** (non-commercial); the feature models are Apache-2.0.
