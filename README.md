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
