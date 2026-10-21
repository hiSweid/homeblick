# Homeblick

A fluid, glassy wall-display panel for Home Assistant. Configurable faces (grid, music, clock, weather, calendar, energy, timer, camera), spring animations, settings stored in Home Assistant and shared by every display.

**Status:** early prototype, not production ready.

## Install (HACS)

1. HACS → Custom repositories → add `https://github.com/hiSweid/homeblick` (type: Integration).
2. Install **Homeblick**, restart Home Assistant.
3. Settings → Devices & services → Add integration → **Homeblick**.
4. A **Homeblick** entry appears in the sidebar. Open it on the display; faces, tiles and backgrounds are edited in the Homeblick admin page.

No add-on, no extra token: the panel uses your existing Home Assistant login.

## evcc

The energy face reads the entities of the [ha-evcc](https://github.com/marq24/ha-evcc) integration.

## Several displays

Each browser/tablet is its own **display** (a device in Home Assistant, created the first time it opens Homeblick; rename it there, or give it a fixed id once per device by opening `https://<your-ha>/homeblick/index.html?live&display=kitchen&name=Kitchen` in that device's browser). Every display has its own faces and layout (new displays start from the existing one) and its own entities:

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

**Settings page** (sidebar → *Homeblick Einstellungen*, admins only): one tab per display with online status and remote actions (show face, reload, Assist, screensaver), the faces it shows (order, background, style, grid tiles; entities are chosen with a searchable picker like Home Assistant's, filtered to what a tile can control), screensaver, night dimming, wake word, Assist pipeline, weather entity/place; copy the setup of one display to another. Changes reach the open display immediately.

**Tiles** (grid faces): every tile opens its own page on the settings page: entity (picker), title, subtitle, an optional live value behind the subtitle (state or any attribute), symbol, size (1×1, 2×1, 2×2), symbol colour when on, and an own action for tap and for hold (default, toggle, call a service with JSON data, open a face, nothing). Also addable: analogue/digital clock and weather tiles. Entities of switch, input_boolean, button and sensor/binary_sensor domains work as tiles too.

**Live preview and editor** (settings page, window ≥ 1180 px wide): a column on the right shows the face exactly as the display renders it (real entity states, nothing is saved from it) with the editor docked below it. Tap a tile to edit it (outlined in the preview), tap an empty cell to add a tile there, drag a tile to move it; the buttons above the editor switch the face and open its background, style and tile list. Narrower windows use the pages in the middle instead.

Also: `#music`, `#bigclock`, … in the URL switches to that face; the screen is kept awake via the Wake Lock API.

## Kiosk / wall tablet

Open `https://<your-ha>/homeblick/index.html?live` directly in the tablet's browser (full screen, without the Home Assistant sidebar; sign in once). Without `?live` the page shows demo data. Add `&display=<id>&name=<Name>` once to give the tablet a fixed display id. Use a browser in kiosk/full-screen mode (or "Add to home screen") and keep the tablet on power; Homeblick keeps the screen awake via the Wake Lock API.

**https is required** for the microphone (Assist, wake word) and the Wake Lock: browsers only allow them on https or localhost. Reach Home Assistant via https, e.g. Home Assistant Cloud, a reverse proxy with a certificate, or a tunnel. On plain http the display works, but cannot listen and may turn its screen off.

## Voice (Assist)

Pull down or say the wake word: the microphone audio goes to your Home Assistant Assist pipeline (speech-to-text, intent, text-to-speech) and the answer is shown and spoken. Give the display's device an **area** in Home Assistant so "turn on the light" means the lights of that room. When the agent asks a follow-up question, the display listens again without the wake word. **Timers**: "set a timer for ten minutes" said at a display runs on that display (Home Assistant's intent timers, registered per display device) in the full-screen timer, wakes the display when it starts and when it ends, and shows the next one due (several timers: the glass button top left switches between them); cancel it with ✕, pause or resume it with the orange button, or by voice (extend by voice). Browsers only allow the microphone and Wake Lock on **https** (or localhost), so open Home Assistant via https; without it the display says so instead of listening.

## Lyrics

Synced lyrics come from [LRCLIB](https://lrclib.net) (exact match, then title + artist, then title; filtered by artist and duration).

## Third-party

The wake word uses [openWakeWord](https://github.com/dscripka/openWakeWord) models in `frontend/wake/` and onnxruntime-web (from a CDN). The pre-trained models are licensed **CC BY-NC-SA 4.0** (non-commercial); the feature models are Apache-2.0.
