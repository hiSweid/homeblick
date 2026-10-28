"""Entities je Display: Steuerung (Face, Screensaver, Neu laden, Assist, Durchsage) und Konfiguration (Screensaver, Dimmen, Wake Word)."""
from datetime import time

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.components.button import ButtonEntity
from homeassistant.components.light import ATTR_BRIGHTNESS, ColorMode, LightEntity
from homeassistant.components.notify import NotifyEntity, NotifyEntityFeature
from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.components.select import SelectEntity
from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.components.switch import SwitchEntity
from homeassistant.components.time import TimeEntity
from homeassistant.const import EntityCategory
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity
from homeassistant.util import dt as dt_util

from .const import DOMAIN, FACES, PLATFORMS, WAKE
from .hub import signal


class Base(Entity):
    _attr_has_entity_name = True
    _attr_should_poll = False
    live = False   # Steuerung geht nur, solange ein Panel offen ist; Konfiguration immer

    def __init__(self, hub, d, key):
        self.hub, self.d, self.key = hub, d, key
        self._attr_unique_id = f"{d.id}_{key}"
        self._attr_translation_key = key
        self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, d.id)}, name=d.name, manufacturer="Homeblick", model="Display", sw_version=hub.version)
        if not self.live:
            self._attr_entity_category = EntityCategory.CONFIG

    @property
    def available(self) -> bool:
        return self.d.connected or not self.live

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(self.hass, signal(self.d.id), self.async_write_ha_state))


class Live(Base):
    live = True


# ---- Steuerung ----
class FaceSelect(Live, SelectEntity):
    _attr_options = FACES

    def __init__(self, hub, d):
        super().__init__(hub, d, "face")

    @property
    def current_option(self):
        return self.d.face if self.d.face in FACES else None

    async def async_select_option(self, option: str) -> None:
        self.hub.push(self.d, {"action": "face", "face": option})


class ScreensaverSwitch(Live, SwitchEntity):
    def __init__(self, hub, d):
        super().__init__(hub, d, "screensaver")

    @property
    def is_on(self) -> bool:
        return self.d.saver

    async def async_turn_on(self, **kw) -> None:
        self.hub.push(self.d, {"action": "screensaver"})

    async def async_turn_off(self, **kw) -> None:
        self.hub.push(self.d, {"action": "wake"})


class ScreenLight(Live, LightEntity):
    """Bildschirm als Licht: an = wach, aus = Bildschirmschoner, Helligkeit = Einstellung „bright“ (10–100 %)."""
    _attr_color_mode = ColorMode.BRIGHTNESS
    _attr_supported_color_modes = {ColorMode.BRIGHTNESS}

    def __init__(self, hub, d):
        super().__init__(hub, d, "screen")

    @property
    def is_on(self) -> bool:
        return not self.d.saver

    @property
    def brightness(self) -> int:
        return round(self.d.settings["bright"] * 255 / 100)

    async def async_turn_on(self, **kw) -> None:
        if ATTR_BRIGHTNESS in kw:
            await self.hub.set_setting(self.d, "bright", max(10, min(100, round(kw[ATTR_BRIGHTNESS] * 100 / 255))))
        if self.d.saver:
            self.hub.push(self.d, {"action": "wake"})

    async def async_turn_off(self, **kw) -> None:
        self.hub.push(self.d, {"action": "screensaver"})


class ActionButton(Live, ButtonEntity):
    async def async_press(self) -> None:
        self.hub.push(self.d, {"action": self.key})


class Announce(Live, NotifyEntity):
    """notify.send_message → Durchsage auf dem Display (Text in der Kugel, gesprochen mit der Stimme des Displays)."""
    _attr_supported_features = NotifyEntityFeature.TITLE

    def __init__(self, hub, d):
        super().__init__(hub, d, "announce")

    async def async_send_message(self, message: str, title: str | None = None) -> None:
        self.hub.push(self.d, {"action": "announce", "message": message[:300], **({"title": title[:80]} if title else {})})


class Online(Live, BinarySensorEntity):
    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, hub, d):
        super().__init__(hub, d, "online")

    available = True   # gerade offline ist ein gültiger Zustand

    @property
    def is_on(self) -> bool:
        return self.d.connected


class Seen(Live, SensorEntity):
    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, hub, d):
        super().__init__(hub, d, "seen")

    available = True

    @property
    def native_value(self):
        return dt_util.parse_datetime(self.d.seen) if self.d.seen else None


class ShownFace(Live, SensorEntity):
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, hub, d):
        super().__init__(hub, d, "shown_face")

    @property
    def native_value(self):
        return self.d.face


class Resolution(Live, SensorEntity):
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, hub, d):
        super().__init__(hub, d, "resolution")

    @property
    def native_value(self):
        i = self.d.info
        return f"{i['w']}x{i['h']}" if i.get("w") and i.get("h") else None


# ---- Konfiguration ----
class SettingSelect(Base, SelectEntity):
    def __init__(self, hub, d, key, options):
        super().__init__(hub, d, key)
        self._attr_options = options

    @property
    def current_option(self):
        return self.d.settings[self.key]

    async def async_select_option(self, option: str) -> None:
        await self.hub.set_setting(self.d, self.key, option)


class SettingSwitch(Base, SwitchEntity):
    @property
    def is_on(self) -> bool:
        return self.d.settings[self.key]

    async def async_turn_on(self, **kw) -> None:
        await self.hub.set_setting(self.d, self.key, True)

    async def async_turn_off(self, **kw) -> None:
        await self.hub.set_setting(self.d, self.key, False)


class SettingNumber(Base, NumberEntity):
    _attr_mode = NumberMode.BOX

    def __init__(self, hub, d, key, lo, hi, step, unit):
        super().__init__(hub, d, key)
        self._attr_native_min_value, self._attr_native_max_value, self._attr_native_step = lo, hi, step
        self._attr_native_unit_of_measurement = unit

    @property
    def native_value(self):
        return self.d.settings[self.key]

    async def async_set_native_value(self, value: float) -> None:
        await self.hub.set_setting(self.d, self.key, int(value))


class SettingTime(Base, TimeEntity):
    @property
    def native_value(self) -> time:
        return time.fromisoformat(self.d.settings[self.key])

    async def async_set_value(self, value: time) -> None:
        await self.hub.set_setting(self.d, self.key, value.strftime("%H:%M:%S"))


# Plattform → Entities eines Displays
FACTORY = {
    "select": lambda h, d: [FaceSelect(h, d), SettingSelect(h, d, "saver", FACES), SettingSelect(h, d, "wake", WAKE)],
    "switch": lambda h, d: [ScreensaverSwitch(h, d), SettingSwitch(h, d, "dim"), SettingSwitch(h, d, "black"), SettingSwitch(h, d, "perf"), SettingSwitch(h, d, "perfauto"), SettingSwitch(h, d, "hold"), SettingSwitch(h, d, "micmute"), SettingSwitch(h, d, "guest"), SettingSwitch(h, d, "dnd"), SettingSwitch(h, d, "sched"), SettingSwitch(h, d, "mute"), SettingSwitch(h, d, "barge"),
                         SettingSwitch(h, d, "music"), SettingSwitch(h, d, "chime")],
    "light": lambda h, d: [ScreenLight(h, d)],
    "button": lambda h, d: [ActionButton(h, d, "reload"), ActionButton(h, d, "assist")],
    "number": lambda h, d: [SettingNumber(h, d, "idle", 0, 3600, 10, "s"), SettingNumber(h, d, "dim_level", 10, 95, 5, "%"), SettingNumber(h, d, "wake_sens", 10, 95, 5, "%"),
                         SettingNumber(h, d, "listen", 3, 60, 1, "s"), SettingNumber(h, d, "volume", 0, 100, 5, "%"), SettingNumber(h, d, "bright", 10, 100, 5, "%")],
    "binary_sensor": lambda h, d: [Online(h, d)],
    "sensor": lambda h, d: [Seen(h, d), ShownFace(h, d), Resolution(h, d)],
    "time": lambda h, d: [SettingTime(h, d, "dim_from"), SettingTime(h, d, "dim_to"), SettingTime(h, d, "sched_from"), SettingTime(h, d, "sched_to")],
    "notify": lambda h, d: [Announce(h, d)],
}
assert set(FACTORY) == set(PLATFORMS)


def setup(platform: str):
    async def async_setup_entry(hass, entry, async_add_entities):
        hass.data[DOMAIN].attach(platform, async_add_entities, FACTORY[platform])
    return async_setup_entry
