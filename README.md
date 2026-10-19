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

## Kiosk behaviour

Set under **Settings → Devices & services → Homeblick → Configure**:

- Screensaver after N seconds without touch (shows the chosen face; the first tap only wakes).
- Night dimming between two times, with a level; a tap brightens for 30 s.
- Wake word (opt-in, keeps the microphone open): `hey_jarvis` or `alexa`, recognised in the browser.

Also: `#music`, `#bigclock`, … in the URL switches to that face; the screen is kept awake via the Wake Lock API.

## Voice (Assist)

Pull down or say the wake word: the microphone audio goes to your Home Assistant Assist pipeline (speech-to-text, intent, text-to-speech) and the answer is shown and spoken. Browsers only allow the microphone and Wake Lock on **https** (or localhost), so open Home Assistant via https.

## Service `homeblick.command`

Control every open display from automations: `action` is one of `face` (with `face: music`), `reload`, `screensaver`, `wake`, `assist`.

## Lyrics

Synced lyrics come from [LRCLIB](https://lrclib.net) (exact match, then title + artist, then title; filtered by artist and duration).

## Third-party

The wake word uses [openWakeWord](https://github.com/dscripka/openWakeWord) models in `frontend/wake/` and onnxruntime-web (from a CDN). The pre-trained models are licensed **CC BY-NC-SA 4.0** (non-commercial); the feature models are Apache-2.0.
