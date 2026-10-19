"""Homeblick: wall-display panel for Home Assistant. Every display has its own layout, settings and entities."""
from pathlib import Path

import voluptuous as vol
from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceEntry
from homeassistant.util import dt as dt_util

from .const import DEFAULTS, DOMAIN, FACES, PLATFORMS, URL, WAKE
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


@websocket_api.websocket_command({vol.Required("type"): "homeblick/report", **DISPLAY, vol.Required("face"): vol.Any(str, None), vol.Required("saver"): bool, vol.Optional("info"): dict})
@callback
def report(hass, connection, msg):
    if d := _display(hass, connection, msg):
        d.face, d.saver, d.seen = msg["face"], msg["saver"], dt_util.utcnow().isoformat()
        d.info = msg.get("info", d.info)
        hass.data[DOMAIN].notify(d)
        connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "homeblick/shot", **DISPLAY, vol.Required("image"): vol.All(str, vol.Length(max=400_000), vol.Match(r"^data:image/jpeg;base64,"))})
@callback
def shot(hass, connection, msg):
    """Display liefert sein Bildschirmfoto (Antwort auf den Befehl „screenshot“)."""
    if d := _display(hass, connection, msg):
        d.shot = msg["image"]
        connection.send_result(msg["id"])


# ---- Einstellungsseite (admin.html, nur Administratoren) ----
_time = vol.Match(r"^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$")
SETTINGS = vol.Schema({
    vol.Optional("idle"): vol.All(int, vol.Range(min=0, max=3600)),
    vol.Optional("saver"): vol.In(FACES),
    vol.Optional("dim"): bool,
    vol.Optional("dim_from"): _time,
    vol.Optional("dim_to"): _time,
    vol.Optional("dim_level"): vol.All(int, vol.Range(min=10, max=95)),
    vol.Optional("wake"): vol.In(WAKE),
    vol.Optional("pipeline"): str,
    vol.Optional("mute"): bool,
    vol.Optional("barge"): bool,
    vol.Optional("listen"): vol.All(int, vol.Range(min=3, max=60)),
    vol.Optional("volume"): vol.All(int, vol.Range(min=0, max=100)),
    vol.Optional("bright"): vol.All(int, vol.Range(min=10, max=100)),
    vol.Optional("weather"): vol.Match(r"^weather\.\w+$"),
    vol.Optional("place"): vol.All(str, vol.Length(max=40)),
})
assert set(DEFAULTS) == {k.schema for k in SETTINGS.schema}


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "homeblick/displays"})
@callback
def displays(hass, connection, msg):
    hub = hass.data[DOMAIN]
    connection.send_result(msg["id"], [
        {"id": d.id, "name": d.name, "connected": d.connected, "face": d.face, "saver": d.saver, "settings": d.settings, "info": d.info, "seen": d.seen,
         "faces": [{"type": f.get("type"), "bg": f.get("bg")} for f in (hub.config(d.id) or {}).get("faces", [])]}
        for d in hub.displays.values()])


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "homeblick/get_shot", **DISPLAY})
@callback
def get_shot(hass, connection, msg):
    if d := _display(hass, connection, msg):
        connection.send_result(msg["id"], {"image": d.shot})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "homeblick/get_config", **DISPLAY})
@callback
def get_config(hass, connection, msg):
    if _display(hass, connection, msg):
        connection.send_result(msg["id"], {"config": hass.data[DOMAIN].config(msg["display"])})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "homeblick/update", **DISPLAY, vol.Optional("name"): vol.All(str, vol.Length(min=1, max=60)), vol.Optional("settings", default={}): SETTINGS})
@websocket_api.async_response
async def update(hass, connection, msg):
    if d := _display(hass, connection, msg):
        await hass.data[DOMAIN].update(d, msg.get("name"), msg["settings"])
        connection.send_result(msg["id"])


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "homeblick/admin_config", **DISPLAY, vol.Required("config"): dict})
@websocket_api.async_response
async def admin_config(hass, connection, msg):
    if _display(hass, connection, msg):
        await hass.data[DOMAIN].set_config(msg["display"], {k: v for k, v in msg["config"].items() if k != "kiosk"}, push=True)
        connection.send_result(msg["id"])


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "homeblick/command", **DISPLAY, vol.Required("action"): vol.In(["face", "reload", "screensaver", "wake", "assist", "screenshot", "announce"]), vol.Optional("face"): vol.In(FACES), vol.Optional("message"): vol.All(str, vol.Length(min=1, max=300))})
@callback
def command(hass, connection, msg):
    if d := _display(hass, connection, msg):
        hass.data[DOMAIN].push(d, {k: msg[k] for k in ("action", "face", "message") if k in msg})
        connection.send_result(msg["id"])


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "homeblick/remove", **DISPLAY})
@websocket_api.async_response
async def remove(hass, connection, msg):
    """Display samt Konfiguration löschen (Entities des Geräts räumt der Nutzer über das Gerät in HA auf)."""
    if _display(hass, connection, msg):
        await hass.data[DOMAIN].remove(msg["display"])
        connection.send_result(msg["id"])


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hub = hass.data[DOMAIN] = Hub(hass)
    await hub.load()
    for cmd in (register, set_config, subscribe, report, shot, displays, get_shot, get_config, update, admin_config, command, remove):
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
    frontend.async_register_built_in_panel(
        hass,
        component_name="iframe",
        sidebar_title="Homeblick Einstellungen",
        sidebar_icon="mdi:tune-variant",
        frontend_url_path=f"{DOMAIN}-settings",
        config={"url": f"{URL}/admin.html"},
        require_admin=True,
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    frontend.async_remove_panel(hass, DOMAIN)
    frontend.async_remove_panel(hass, f"{DOMAIN}-settings")
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_config_entry_device(hass: HomeAssistant, entry: ConfigEntry, device: DeviceEntry) -> bool:
    """Gerät in HA löschen = Display entfernen (kommt es wieder, legt es sich neu an)."""
    for domain, id in device.identifiers:
        if domain == DOMAIN:
            await hass.data[DOMAIN].remove(id)
    return True
