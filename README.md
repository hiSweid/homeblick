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

Each browser/tablet is its own **display** (a device in Home Assistant, created the first time it opens Homeblick; rename it there or open the panel once with `?name=Kitchen` in the URL). Every display has its own faces and layout (new displays start from the existing one) and its own entities:

- Control: **Face** (select), **Screensaver** (switch), **Reload** and **Assist** (buttons) – use them in automations, dashboards or voice like any other entity.
- Configuration: screensaver delay and face, night dimming (on, from, until, level) and wake word (opt-in, keeps the microphone open: `hey_jarvis` or `alexa`).

Also: `#music`, `#bigclock`, … in the URL switches to that face; the screen is kept awake via the Wake Lock API.

## Voice (Assist)

Pull down or say the wake word: the microphone audio goes to your Home Assistant Assist pipeline (speech-to-text, intent, text-to-speech) and the answer is shown and spoken. Browsers only allow the microphone and Wake Lock on **https** (or localhost), so open Home Assistant via https.

## Lyrics

Synced lyrics come from [LRCLIB](https://lrclib.net) (exact match, then title + artist, then title; filtered by artist and duration).

## Third-party

The wake word uses [openWakeWord](https://github.com/dscripka/openWakeWord) models in `frontend/wake/` and onnxruntime-web (from a CDN). The pre-trained models are licensed **CC BY-NC-SA 4.0** (non-commercial); the feature models are Apache-2.0.
