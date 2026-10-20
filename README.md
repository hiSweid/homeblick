# Homeblick

A fluid, glassy wall-display panel for Home Assistant. Configurable faces (grid, music, clock, weather, calendar, energy, timer, camera), spring animations, settings stored in Home Assistant and shared by every display.

**Status:** early prototype, not production ready.

## Install (HACS)

1. HACS → Custom repositories → add `https://github.com/hiSweid/homeblick` (type: Integration).
2. Install **Homeblick**, restart Home Assistant.
3. Settings → Devices & services → Add integration → **Homeblick**.
4. A **Homeblick** entry appears in the sidebar. Open it on the display; long-press to edit faces.

No add-on, no extra token: the panel uses your existing Home Assistant login.

## evcc

The energy face reads the entities of the [ha-evcc](https://github.com/marq24/ha-evcc) integration.

## Several displays

Each browser/tablet is its own **display** (a device in Home Assistant, created the first time it opens Homeblick; rename it there, or give it a fixed id once per device by opening `https://<your-ha>/homeblick/index.html?display=kitchen&name=Kitchen` in that device's browser). Every display has its own faces and layout (new displays start from the existing one) and its own entities:

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

A ring of the doorbell event wakes the display, plays a chime and opens the door camera.

**Settings page** (sidebar → *Homeblick Einstellungen*, admins only): one tab per display with online status and remote actions (show face, reload, Assist, screensaver), the faces it shows (order, background, style, grid tiles and their entities), screensaver, night dimming, wake word, Assist pipeline, weather entity/place; copy the setup of one display to another. Changes reach the open display immediately.

Also: `#music`, `#bigclock`, … in the URL switches to that face; the screen is kept awake via the Wake Lock API.

## Voice (Assist)

Pull down or say the wake word: the microphone audio goes to your Home Assistant Assist pipeline (speech-to-text, intent, text-to-speech) and the answer is shown and spoken. Give the display's device an **area** in Home Assistant so "turn on the light" means the lights of that room. When the agent asks a follow-up question, the display listens again without the wake word. Browsers only allow the microphone and Wake Lock on **https** (or localhost), so open Home Assistant via https; without it the display says so instead of listening.

## Lyrics

Synced lyrics come from [LRCLIB](https://lrclib.net) (exact match, then title + artist, then title; filtered by artist and duration).

## Third-party

The wake word uses [openWakeWord](https://github.com/dscripka/openWakeWord) models in `frontend/wake/` and onnxruntime-web (from a CDN). The pre-trained models are licensed **CC BY-NC-SA 4.0** (non-commercial); the feature models are Apache-2.0.
