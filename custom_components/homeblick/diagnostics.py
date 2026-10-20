"""Diagnose-Download (Integration bzw. Gerät): Einstellungen, Zustand und letzte Fehler je Display. Fotos und Kachel-Inhalte bleiben draußen."""
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntry

from .const import DOMAIN


def _display(hub, d) -> dict:
    faces = (hub.config(d.id) or {}).get("faces", [])
    return {"id": d.id, "name": d.name, "connected": d.connected, "seen": d.seen, "face": d.face, "saver": d.saver,
            "settings": d.settings, "info": d.info, "faces": [f.get("type") for f in faces], "logs": list(d.logs)}


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: ConfigEntry) -> dict:
    hub = hass.data[DOMAIN]
    return {"displays": [_display(hub, d) for d in hub.displays.values()]}


async def async_get_device_diagnostics(hass: HomeAssistant, entry: ConfigEntry, device: DeviceEntry) -> dict:
    hub = hass.data[DOMAIN]
    return next((_display(hub, hub.displays[i]) for dom, i in device.identifiers if dom == DOMAIN and i in hub.displays), {})
