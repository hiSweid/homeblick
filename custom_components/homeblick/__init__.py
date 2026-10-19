"""Homeblick: wall-display panel for Home Assistant. Settings are stored in HA and shared by all displays."""
from pathlib import Path

import voluptuous as vol
from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.storage import Store

from .const import ACTIONS, DOMAIN, SIGNAL, STORE_VERSION, URL


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = Store(hass, STORE_VERSION, DOMAIN)
    hass.data[DOMAIN] = store

    @websocket_api.websocket_command({vol.Required("type"): "homeblick/get_config"})
    @websocket_api.async_response
    async def get_config(hass, connection, msg):
        o = entry.options
        kiosk = {"idle": o.get("idle", 300), "saver": o.get("saver", "bigclock"), "wake": None if o.get("wake", "off") == "off" else o["wake"],
                 "dim": {"from": o["dim_from"], "to": o["dim_to"], "level": o.get("dim_level", 80) / 100} if o.get("dim") else None}
        connection.send_result(msg["id"], {**(await store.async_load() or {}), "kiosk": kiosk})   # Kiosk-Werte kommen aus den Optionen

    # ponytail: one config for all displays; per-display profiles (display id) when a second display needs different faces
    @websocket_api.websocket_command({vol.Required("type"): "homeblick/set_config", vol.Required("config"): dict})
    @websocket_api.async_response
    async def set_config(hass, connection, msg):
        await store.async_save({k: v for k, v in msg["config"].items() if k != "kiosk"})
        connection.send_result(msg["id"])

    # Befehle an alle offenen Displays: der Service sendet, jedes Panel hört über diese Subscription mit
    @websocket_api.websocket_command({vol.Required("type"): "homeblick/subscribe_commands"})
    @websocket_api.async_response
    async def subscribe_commands(hass, connection, msg):
        @callback
        def forward(data):
            connection.send_message(websocket_api.event_message(msg["id"], data))

        connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL, forward)
        connection.send_result(msg["id"])

    async def command(call: ServiceCall) -> None:
        async_dispatcher_send(hass, SIGNAL, dict(call.data))

    hass.services.async_register(
        DOMAIN, "command", command,
        schema=vol.Schema({vol.Required("action"): vol.In(ACTIONS), vol.Optional("face"): str}),
    )
    websocket_api.async_register_command(hass, subscribe_commands)
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
    entry.async_on_unload(entry.add_update_listener(lambda hass, e: hass.config_entries.async_schedule_reload(e.entry_id)))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    frontend.async_remove_panel(hass, DOMAIN)
    hass.services.async_remove(DOMAIN, "command")
    return True
