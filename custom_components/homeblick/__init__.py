"""Homeblick: wall-display panel for Home Assistant. Every display has its own layout, settings and entities."""
import logging
from pathlib import Path

import voluptuous as vol
from homeassistant.components import frontend, websocket_api
from aiohttp import web
from homeassistant.components.http import HomeAssistantView, StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import area_registry as ar, config_validation as cv, device_registry as dr
from homeassistant.helpers.device_registry import DeviceEntry
from homeassistant.loader import async_get_integration
from homeassistant.util import dt as dt_util

from .const import DEFAULTS, DOMAIN, FACES, PLATFORMS, URL, WAKE
from .hub import Hub

_LOGGER = logging.getLogger(__name__)
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
    connection.send_result(msg["id"], {"config": hub.config(d.id), "kiosk": d.kiosk(), "device_id": hub.device_id(d), "version": hub.version, "cameras": hub.cameras(), "timers": hub.timers(d), "new": d.new, "name": d.name})


@websocket_api.websocket_command({vol.Required("type"): "homeblick/set_config", **DISPLAY, vol.Required("config"): dict})
@websocket_api.async_response
async def set_config(hass, connection, msg):
    if d := _display(hass, connection, msg):
        if not d.new:   # wartende Displays laden ihre Vorlage nicht hoch
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


# Laufzustand des Panels (landet im HTML der Einstellungsseite und in der Diagnose) → feste Felder statt beliebigem dict
INFO = vol.Schema({vol.Optional("secure"): bool, vol.Optional("mic"): bool, vol.Optional("wake"): vol.Any(None, vol.All(str, vol.Length(max=40))),
                   vol.Optional("wakelock"): bool, vol.Optional("visible"): bool, vol.Optional("w"): vol.All(int, vol.Range(min=0, max=20000)),
                   vol.Optional("h"): vol.All(int, vol.Range(min=0, max=20000)),
                   vol.Optional("v"): vol.All(str, vol.Length(max=40))}, extra=vol.REMOVE_EXTRA)


@websocket_api.websocket_command({vol.Required("type"): "homeblick/report", **DISPLAY, vol.Required("face"): vol.Any(vol.All(str, vol.Length(max=40)), None), vol.Required("saver"): bool, vol.Optional("info"): INFO})
@callback
def report(hass, connection, msg):
    if d := _display(hass, connection, msg):
        d.face, d.saver, d.seen = msg["face"], msg["saver"], dt_util.utcnow().isoformat()
        d.info = msg.get("info", d.info)
        hass.data[DOMAIN].notify(d)
        connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "homeblick/timer", **DISPLAY, vol.Required("timer"): str, vol.Required("action"): vol.In(["pause", "resume", "cancel"])})
@callback
def timer(hass, connection, msg):
    """Sprach-Timer (Assist) am Display pausieren, fortsetzen oder abbrechen (Knöpfe im Timer-Vollbild); sind keine timer.*-Entities."""
    if d := _display(hass, connection, msg):
        connection.send_result(msg["id"], hass.data[DOMAIN].timer_act(d, msg["timer"], msg["action"]))   # False: schon abgelaufen/abgebrochen, kein Fehler


@websocket_api.websocket_command({vol.Required("type"): "homeblick/shot", **DISPLAY, vol.Required("image"): vol.All(str, vol.Length(max=400_000), vol.Match(r"^data:image/jpeg;base64,"))})
@callback
def shot(hass, connection, msg):
    """Display liefert sein Bildschirmfoto (Antwort auf den Befehl „screenshot“)."""
    if d := _display(hass, connection, msg):
        d.shot = msg["image"]
        connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "homeblick/log", **DISPLAY, vol.Required("level"): vol.In(["error", "warning"]), vol.Required("message"): vol.All(str, vol.Length(max=1000))})
@callback
def log(hass, connection, msg):
    """Fehler/Warnungen aus dem Browser des Displays → HA-Protokoll und Einstellungsseite."""
    if d := _display(hass, connection, msg):
        now = dt_util.utcnow()
        recent = [x for x in d.logs if (now - dt_util.parse_datetime(x["t"])).total_seconds() < 60]
        if len(recent) < 20:   # Schutz vor Fehlerschleifen im Panel
            d.logs.append({"t": now.isoformat(), "level": msg["level"], "message": msg["message"]})
            _LOGGER.log(logging.ERROR if msg["level"] == "error" else logging.WARNING, "Display %s: %s", d.name, msg["message"])
        connection.send_result(msg["id"])


# ---- Einstellungsseite (admin.html, nur Administratoren) ----
_time = vol.Match(r"^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$")
SETTINGS = vol.Schema({
    vol.Optional("idle"): vol.All(int, vol.Range(min=0, max=3600)),
    vol.Optional("saver"): vol.In(FACES),
    vol.Optional("music"): bool,
    vol.Optional("black"): bool,
    vol.Optional("perf"): bool,
    vol.Optional("hold"): bool,
    vol.Optional("kz"): bool,
    vol.Optional("micmute"): bool,
    vol.Optional("dnd"): bool,
    vol.Optional("sched"): bool,
    vol.Optional("sched_from"): _time,
    vol.Optional("sched_to"): _time,
    vol.Optional("dim"): bool,
    vol.Optional("dim_from"): _time,
    vol.Optional("dim_to"): _time,
    vol.Optional("wake_sens"): vol.All(int, vol.Range(min=10, max=95)),
    vol.Optional("dim_level"): vol.All(int, vol.Range(min=10, max=95)),
    vol.Optional("wake"): vol.In(WAKE),
    vol.Optional("pipeline"): str,
    vol.Optional("mute"): bool,
    vol.Optional("barge"): bool,
    vol.Optional("listen"): vol.All(int, vol.Range(min=3, max=60)),
    vol.Optional("volume"): vol.All(int, vol.Range(min=0, max=100)),
    vol.Optional("bright"): vol.All(int, vol.Range(min=10, max=100)),
    vol.Optional("tts"): vol.Any("", vol.Match(r"^tts\.\w+$")),
    vol.Optional("chime"): bool,
    vol.Optional("weather"): vol.Match(r"^weather\.\w+$"),
    vol.Optional("lux"): vol.Any("", vol.Match(r"^sensor\.\w+$")),
    vol.Optional("presence"): vol.Any("", vol.Match(r"^(binary_sensor|input_boolean)\.\w+$")),
    vol.Optional("place"): vol.All(str, vol.Length(max=40)),
})
assert set(DEFAULTS) == {k.schema for k in SETTINGS.schema}


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "homeblick/displays"})
@callback
def displays(hass, connection, msg):
    hub, devs, areas = hass.data[DOMAIN], dr.async_get(hass), ar.async_get(hass)
    area = lambda d: (a := (dev := devs.async_get_device(identifiers={(DOMAIN, d.id)})) and dev.area_id and areas.async_get_area(dev.area_id)) and a.name   # noqa: E731
    connection.send_result(msg["id"], [
        {"id": d.id, "area": area(d) or None, "name": d.name, "new": d.new, "connected": d.connected, "windows": len(d.links), "face": d.face, "saver": d.saver, "settings": d.settings, "info": d.info, "seen": d.seen, "logs": list(d.logs)[-10:],
         "outdated": bool(d.info.get("v")) and d.info.get("v") != hub.version,   # Panel läuft noch mit JS einer anderen Integrationsversion
         "faces": [{"type": f.get("type"), "bg": f.get("bg")} for f in (hub.config(d.id) or {}).get("faces", [])]}
        for d in hub.displays.values()])


_ent = lambda domain: vol.Match(rf"^{domain}\.[\w]+$")   # noqa: E731
CAMERAS = vol.Schema({
    vol.Required("list"): vol.All([vol.Schema({vol.Required("entity"): _ent("camera"), vol.Optional("name", default=""): vol.All(str, vol.Length(max=40)),
                                               vol.Optional("light", default=""): vol.Any("", _ent("light")),
                                               # go2rtc (z. B. Frigate): Livebild per WebRTC direkt von dort, wenn die HA-Kamera keinen Stream anbietet
                                               vol.Optional("go2rtc", default=""): vol.Any("", vol.All(str, vol.Match(r"^https?://[^\s/]+/?$"), vol.Length(max=200))),
                                               vol.Optional("stream", default=""): vol.All(str, vol.Match(r"^[A-Za-z0-9_.-]*$"), vol.Length(max=80))})], vol.Length(max=8)),
    vol.Required("bell"): vol.Any(None, vol.Schema({vol.Required("event"): _ent("event"), vol.Optional("camera", default=""): vol.Any("", _ent("camera")),
                                                    vol.Optional("lock", default=""): vol.Any("", _ent("lock")),   # Schloss, das die Klingel-Ansicht öffnet
                                                    vol.Optional("warm", default=False): bool})),   # Klingelbild vorhalten (Verbindung bleibt offen); über go2rtc ist das Bild auch kalt nach ~0,3 s da
})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "homeblick/cameras"})
@callback
def cameras(hass, connection, msg):
    hub = hass.data[DOMAIN]
    connection.send_result(msg["id"], {"cameras": hub.cameras(), "auto": hub.cams is None})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "homeblick/set_cameras", vol.Required("cameras"): vol.Any(None, CAMERAS)})
@websocket_api.async_response
async def set_cameras(hass, connection, msg):
    """Kameras und Klingel für alle Displays; null = wieder automatisch erkennen."""
    await hass.data[DOMAIN].set_cameras(msg["cameras"])
    connection.send_result(msg["id"])


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


# Kontrollzentrum auf dem Display (Regler/Schalter): nur diese Einstellungen, ohne Administratorrechte, Prüfung wie die Einstellungsseite
KZ_KEYS = ("bright", "volume", "mute", "dnd", "micmute", "hold")


@websocket_api.websocket_command({vol.Required("type"): "homeblick/setting", **DISPLAY, vol.Required("key"): vol.In(KZ_KEYS), vol.Required("value"): vol.Any(bool, int)})
@websocket_api.async_response
async def setting(hass, connection, msg):
    if d := _display(hass, connection, msg):
        try:
            value = SETTINGS({msg["key"]: msg["value"]})
        except vol.Invalid as err:
            return connection.send_error(msg["id"], "invalid_format", str(err))
        await hass.data[DOMAIN].update(d, None, value)
        connection.send_result(msg["id"])


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
@websocket_api.websocket_command({vol.Required("type"): "homeblick/setup", **DISPLAY, vol.Required("name"): vol.All(str, vol.Length(min=1, max=60)), vol.Optional("area"): str, vol.Required("config"): dict, vol.Optional("settings", default={}): SETTINGS})
@websocket_api.async_response
async def setup_display(hass, connection, msg):
    """Neues Display einrichten: Name, Bereich, Konfiguration (aus einer Vorlage) und Einstellungen in einem Schritt."""
    if d := _display(hass, connection, msg):
        await hass.data[DOMAIN].setup(d, msg["name"], msg.get("area"), {k: v for k, v in msg["config"].items() if k != "kiosk"}, msg["settings"])
        connection.send_result(msg["id"])


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "homeblick/command", **DISPLAY, vol.Required("action"): vol.In(["face", "reload", "screensaver", "wake", "assist", "screenshot", "announce", "notify", "stop", "navigate"]), vol.Optional("face"): vol.In(FACES), vol.Optional("duration"): vol.All(int, vol.Range(min=1, max=3600)), vol.Optional("path"): vol.All(str, vol.Match(r"^/(?![/\\])[^\x00-\x20\\]*\Z"), vol.Length(max=300)), vol.Optional("message"): vol.All(str, vol.Length(min=1, max=300)), vol.Optional("title"): vol.All(str, vol.Length(max=80))})
@callback
def command(hass, connection, msg):
    if d := _display(hass, connection, msg):
        hass.data[DOMAIN].push(d, {k: msg[k] for k in ("action", "face", "message", "title", "path", "duration") if k in msg})
        connection.send_result(msg["id"])


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "homeblick/remove", **DISPLAY})
@websocket_api.async_response
async def remove(hass, connection, msg):
    """Display samt Konfiguration löschen (Entities des Geräts räumt der Nutzer über das Gerät in HA auf)."""
    if _display(hass, connection, msg):
        await hass.data[DOMAIN].remove(msg["display"])
        connection.send_result(msg["id"])


# ---- Dienste für Automationen ----
CAMERA = vol.Schema({vol.Required("display"): vol.All(cv.ensure_list, [str]), vol.Required("camera"): cv.entity_domain("camera"),
                     vol.Optional("duration", default=60): vol.All(vol.Coerce(int), vol.Range(min=0, max=3600))})
# Benachrichtigungskarte (Vorlage TGo1gI0QtfU 45,75 s); Aktionen des Buttons nur harmlose Domains (keine Schlösser/Garagentore), Bild: URL der eigenen HA-Instanz/Web oder Kamera-/Bild-Entity
NOTIFY = vol.All(vol.Schema({
    vol.Required("display"): vol.All(cv.ensure_list, [str]),
    vol.Required("message"): vol.All(cv.string, vol.Length(min=1, max=300)),
    vol.Optional("title"): vol.All(cv.string, vol.Length(max=80)),
    vol.Optional("image"): vol.Any(cv.entity_domain(["camera", "image"]), vol.All(str, vol.Match(r"^(https?://\S+|/(?![/\\])\S*)\Z"), vol.Length(max=500))),
    vol.Optional("button"): vol.All(cv.string, vol.Length(min=1, max=30)),
    vol.Optional("face"): vol.In(FACES),
    vol.Optional("entity"): cv.entity_domain(["scene", "script", "button", "automation", "light", "switch", "input_boolean", "fan"]),
    vol.Optional("duration", default=10): vol.All(vol.Coerce(int), vol.Range(min=0, max=3600)),
}), cv.has_at_most_one_key("face", "entity"))
HIDE = vol.Schema({vol.Required("display"): vol.All(cv.ensure_list, [str])})


def _targets(hass, call: ServiceCall):
    hub = hass.data[DOMAIN]
    ds = [hub.by_device(i) for i in call.data["display"]]
    if None in ds:
        raise ServiceValidationError(translation_domain=DOMAIN, translation_key="no_display")
    return hub, ds


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    old = hass.data.get(DOMAIN)
    hub = hass.data[DOMAIN] = Hub(hass, entry.entry_id)
    hub.version = str((await async_get_integration(hass, DOMAIN)).version)   # Panels laden neu, wenn sie nach dem Wiederverbinden eine andere sehen
    await hub.load()
    for d in hub.displays.values():
        hub.watch_timers(d)
    if old:   # Integration neu geladen: offene Panels (WebSocket-Abos) und Laufzustand übernehmen, sonst hängen sie am alten Hub
        for i, d in hub.displays.items():
            if o := old.displays.get(i):
                d.links, d.logs, d.face, d.saver, d.info, d.seen, d.shot = o.links, o.logs, o.face, o.saver, o.info, o.seen, o.shot
                if o.alarm:   # Timer des alten Hubs beenden, der neue entscheidet selbst
                    o.alarm()
                if d.links:
                    hub._disarm(d)
    for cmd in (register, set_config, subscribe, report, timer, shot, log, displays, cameras, set_cameras, get_shot, get_config, update, setting, admin_config, setup_display, command, remove):
        websocket_api.async_register_command(hass, cmd)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    async def show_camera(call: ServiceCall) -> None:
        """Kamera im Vollbild öffnen (z. B. bei Bewegung); duration 0 = bis jemand schließt. Geschlossene Displays überspringt der Dienst."""
        hub, ds = _targets(hass, call)
        for d in ds:
            hub.push(d, {"action": "camera", "camera": call.data["camera"], "duration": call.data["duration"]})

    async def hide_camera(call: ServiceCall) -> None:
        hub, ds = _targets(hass, call)
        for d in ds:
            hub.push(d, {"action": "camera_close"})

    async def notify(call: ServiceCall) -> None:
        """Weiße Benachrichtigungskarte (Titel, Text, Bild, Button) auf den Displays; mehrere laufen nacheinander. Die Durchsage (notify.send_message) bleibt davon getrennt."""
        hub, ds = _targets(hass, call)
        data = {k: v for k, v in call.data.items() if k != "display"}
        for d in ds:
            hub.push(d, {"action": "notify", **data})

    hass.services.async_register(DOMAIN, "show_camera", show_camera, CAMERA)
    hass.services.async_register(DOMAIN, "notify", notify, NOTIFY)
    hass.services.async_register(DOMAIN, "hide_camera", hide_camera, HIDE)

    if not hass.data.get(f"{DOMAIN}_static"):   # Pfad lässt sich nach Reload nicht erneut registrieren
        hass.http.register_view(HomeView())   # vor dem Static-Pfad: /homeblick (ohne Datei) liefert sonst 403
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


class HomeView(HomeAssistantView):
    """Direktaufruf von /homeblick (Lesezeichen, Seite neu laden im Panel): das Display öffnen. Das Panel selbst hat denselben Pfad wie das Static-Verzeichnis."""

    url = URL
    name = "homeblick:home"
    requires_auth = False

    async def get(self, request: web.Request) -> web.Response:
        raise web.HTTPFound(f"{URL}/index.html?live")


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data[DOMAIN].unwatch_timers()
    frontend.async_remove_panel(hass, DOMAIN)
    frontend.async_remove_panel(hass, f"{DOMAIN}-settings")
    for service in ("show_camera", "hide_camera", "notify"):
        hass.services.async_remove(DOMAIN, service)
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_config_entry_device(hass: HomeAssistant, entry: ConfigEntry, device: DeviceEntry) -> bool:
    """Gerät in HA löschen = Display entfernen (kommt es wieder, legt es sich neu an)."""
    for domain, id in device.identifiers:
        if domain == DOMAIN:
            await hass.data[DOMAIN].remove(id)
    return True
