"""Homeblick: wall-display panel for Home Assistant. Settings are stored in HA and shared by all displays."""
from pathlib import Path

import voluptuous as vol
from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN, STORE_VERSION, URL


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = Store(hass, STORE_VERSION, DOMAIN)
    hass.data[DOMAIN] = store

    @websocket_api.websocket_command({vol.Required("type"): "homeblick/get_config"})
    @websocket_api.async_response
    async def get_config(hass, connection, msg):
        connection.send_result(msg["id"], await store.async_load())

    # ponytail: one config for all displays; per-display profiles (display id) when a second display needs different faces
    @websocket_api.websocket_command({vol.Required("type"): "homeblick/set_config", vol.Required("config"): dict})
    @websocket_api.async_response
    async def set_config(hass, connection, msg):
        await store.async_save(msg["config"])
        connection.send_result(msg["id"])

    websocket_api.async_register_command(hass, get_config)
    websocket_api.async_register_command(hass, set_config)

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
    return True
