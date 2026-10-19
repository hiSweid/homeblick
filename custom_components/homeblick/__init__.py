"""Homeblick: wall-display panel for Home Assistant. Every display has its own layout, settings and entities."""
from pathlib import Path

import voluptuous as vol
from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceEntry

from .const import DOMAIN, PLATFORMS, URL
from .hub import Hub

DISPLAY = {vol.Required("display"): str}


def _display(hass, connection, msg):
    d = hass.data[DOMAIN].displays.get(msg["display"])
    if not d:
        connection.send_error(msg["id"], "unknown_display", "Display not registered")
    return d


@websocket_api.websocket_command({vol.Required("type"): "homeblick/register", **DISPLAY, vol.Optional("name"): str})
@websocket_api.async_response
async def register(hass, connection, msg):
    """Display meldet sich an (legt sich beim ersten Mal an) und bekommt seine Konfiguration."""
    hub = hass.data[DOMAIN]
    d = await hub.ensure(msg["display"], msg.get("name"))
    connection.send_result(msg["id"], {"config": hub.config(d.id), "kiosk": d.kiosk()})


@websocket_api.websocket_command({vol.Required("type"): "homeblick/set_config", **DISPLAY, vol.Required("config"): dict})
@websocket_api.async_response
async def set_config(hass, connection, msg):
    if _display(hass, connection, msg):
        await hass.data[DOMAIN].set_config(msg["display"], {k: v for k, v in msg["config"].items() if k != "kiosk"})
        connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "homeblick/subscribe", **DISPLAY})
@callback
def subscribe(hass, connection, msg):
    """Befehle (Face, Neu laden, …) und geänderte Einstellungen für dieses Display."""
    if d := _display(hass, connection, msg):
        connection.subscriptions[msg["id"]] = hass.data[DOMAIN].link(
            d, lambda data: connection.send_message(websocket_api.event_message(msg["id"], data)))
        connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "homeblick/report", **DISPLAY, vol.Required("face"): vol.Any(str, None), vol.Required("saver"): bool})
@callback
def report(hass, connection, msg):
    if d := _display(hass, connection, msg):
        d.face, d.saver = msg["face"], msg["saver"]
        hass.data[DOMAIN].notify(d)
        connection.send_result(msg["id"])


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hub = hass.data[DOMAIN] = Hub(hass)
    await hub.load()
    for cmd in (register, set_config, subscribe, report):
        websocket_api.async_register_command(hass, cmd)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    if not hass.data.get(f"{DOMAIN}_static"):   # Pfad lässt sich nach Reload nicht erneut registrieren
        await hass.http.async_register_static_paths(
            [StaticPathConfig(URL, str(Path(__file__).parent / "frontend"), cache_headers=False)]
        )
        hass.data[f"{DOMAIN}_static"] = True
    frontend.async_register_built_in_panel(
        hass,
        component_name="iframe",
        sidebar_title="Homeblick",
        sidebar_icon="mdi:monitor-dashboard",
        frontend_url_path=DOMAIN,
        config={"url": f"{URL}/index.html?live"},
        require_admin=False,
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    frontend.async_remove_panel(hass, DOMAIN)
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_config_entry_device(hass: HomeAssistant, entry: ConfigEntry, device: DeviceEntry) -> bool:
    """Gerät in HA löschen = Display entfernen (kommt es wieder, legt es sich neu an)."""
    for domain, id in device.identifiers:
        if domain == DOMAIN:
            await hass.data[DOMAIN].remove(id)
    return True
