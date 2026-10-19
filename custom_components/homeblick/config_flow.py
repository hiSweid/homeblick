import voluptuous as vol
from homeassistant.config_entries import ConfigEntry, ConfigFlow, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import DOMAIN


class HomeblickFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(entry: ConfigEntry) -> OptionsFlow:
        return HomeblickOptions()

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="Homeblick", data={})
        return self.async_show_form(step_id="user")


FACES = ["bigclock", "analog", "weather", "music", "grid", "calendar", "energy", "info", "cams"]
WAKE = ["off", "hey_jarvis_v0.1", "alexa_v0.1"]


class HomeblickOptions(OptionsFlow):
    """Kiosk-Verhalten der Displays (Screensaver, Nacht-Dimmen, Wake Word)."""

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        o = self.config_entry.options
        sel = lambda opts: selector.SelectSelector(selector.SelectSelectorConfig(options=opts))
        schema = vol.Schema({
            vol.Required("idle", default=o.get("idle", 300)): selector.NumberSelector(
                selector.NumberSelectorConfig(min=0, max=3600, step=10, unit_of_measurement="s", mode="box")),
            vol.Required("saver", default=o.get("saver", "bigclock")): sel(FACES),
            vol.Required("dim", default=o.get("dim", False)): bool,
            vol.Required("dim_from", default=o.get("dim_from", "22:30:00")): selector.TimeSelector(),
            vol.Required("dim_to", default=o.get("dim_to", "06:00:00")): selector.TimeSelector(),
            vol.Required("dim_level", default=o.get("dim_level", 80)): selector.NumberSelector(
                selector.NumberSelectorConfig(min=10, max=95, step=5, unit_of_measurement="%")),
            vol.Required("wake", default=o.get("wake", "off")): sel(WAKE),
        })
        return self.async_show_form(step_id="init", data_schema=schema)
