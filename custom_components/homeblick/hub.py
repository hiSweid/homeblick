"""Displays: je Display eigene Konfiguration, Einstellungen und Entities; Verbindung zu den offenen Panels."""
from collections import deque

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, issue_registry as ir
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store

from .const import DEFAULTS, DOMAIN, LOGS, STORE_VERSION

OFFLINE = 600   # s ohne offenes Panel bis zur Reparaturmeldung (kurze Neuladen/WLAN-Aussetzer lösen keine aus)


def signal(display_id: str) -> str:
    return f"{DOMAIN}_{display_id}"


class Display:
    def __init__(self, id: str, name: str, settings: dict | None = None):
        self.id, self.name = id, name
        self.settings = {**DEFAULTS, **(settings or {})}
        self.face: str | None = None   # vom Panel gemeldet
        self.saver = False
        self.info: dict = {}   # vom Panel gemeldet: Mikro, Wake Word, Wake Lock, Auflösung …
        self.seen: str | None = None   # letzte Meldung (ISO)
        self.shot: str | None = None   # letztes Bildschirmfoto (data-URL), nur im Speicher
        self.logs: deque = deque(maxlen=LOGS)   # letzte Fehler/Warnungen des Panels, nur im Speicher
        self.links: list = []   # offene Panels (Callbacks)
        self.alarm = None   # laufender Offline-Timer (cancel-Funktion)

    @property
    def connected(self) -> bool:
        return bool(self.links)

    def kiosk(self) -> dict:
        """Einstellungen im Format des Frontends (kiosk.js)."""
        s = self.settings
        return {
            "idle": s["idle"], "saver": s["saver"], "music": s["music"], "chime": s["chime"],
            "wake": None if s["wake"] == "off" else f"{s['wake']}_v0.1",
            "pipeline": s["pipeline"], "mute": s["mute"], "barge": s["barge"], "listen": s["listen"], "volume": s["volume"], "bright": s["bright"] / 100, "tts": s["tts"], "weather": s["weather"], "place": s["place"],
            "dim": {"from": s["dim_from"], "to": s["dim_to"], "level": s["dim_level"] / 100} if s["dim"] else None,
        }


class Hub:
    def __init__(self, hass: HomeAssistant, entry_id: str):
        self.hass, self.entry_id = hass, entry_id
        self.store = Store(hass, STORE_VERSION, DOMAIN)
        self.version: str | None = None   # Integrationsversion (manifest), gesetzt in async_setup_entry
        self.default: dict | None = None   # Vorlage für neue Displays (Stand vor Mehrfach-Display: die eine gemeinsame Konfiguration)
        self.configs: dict[str, dict] = {}
        self.displays: dict[str, Display] = {}
        self.adders: dict = {}   # Plattform → (async_add_entities, Fabrik)

    async def load(self) -> None:
        d = await self.store.async_load() or {}
        if "faces" in d:   # altes Format
            d = {"default": d}
        self.default, self.configs = d.get("default"), d.get("configs", {})
        for id, m in d.get("displays", {}).items():
            self.displays[id] = Display(id, m["name"], m.get("settings"))
            self._arm(self.displays[id])   # nach HA-Neustart: Panels melden sich gleich wieder, sonst Meldung

    async def _save(self) -> None:
        await self.store.async_save({
            "default": self.default, "configs": self.configs,
            "displays": {i: {"name": d.name, "settings": d.settings} for i, d in self.displays.items()},
        })

    def attach(self, platform: str, add, factory) -> None:
        self.adders[platform] = (add, factory)
        add([e for d in self.displays.values() for e in factory(self, d)])

    async def ensure(self, id: str, name: str | None) -> Display:
        if id not in self.displays:
            d = self.displays[id] = Display(id, name or f"Display {len(self.displays) + 1}")
            for add, factory in self.adders.values():
                add(factory(self, d))
            await self._save()
        return self.displays[id]

    async def remove(self, id: str) -> None:
        if d := self.displays.pop(id, None):
            self._disarm(d)
        self.configs.pop(id, None)
        if not self.displays:   # Vorlage nur für die Umstellung vom alten Einzel-Display; ohne Displays nicht weiterreichen
            self.default = None
        await self._save()

    def device_id(self, d: Display) -> str:
        """HA-Gerät des Displays (legt es an, falls die Entities noch nicht da sind) – für den Raumbezug von Assist."""
        return dr.async_get(self.hass).async_get_or_create(
            config_entry_id=self.entry_id, identifiers={(DOMAIN, d.id)}, name=d.name, manufacturer="Homeblick", model="Display").id

    def by_device(self, device_id: str) -> Display | None:
        dev = dr.async_get(self.hass).async_get(device_id)
        return next((self.displays.get(i) for dom, i in dev.identifiers if dom == DOMAIN), None) if dev else None

    def config(self, id: str) -> dict | None:
        return self.configs.get(id) or self.default

    async def set_config(self, id: str, config: dict, push: bool = False) -> None:
        """push=True: Änderung kommt von der Einstellungsseite → das offene Panel baut sich neu auf."""
        self.configs[id] = config
        self.default = self.default or config   # erstes Display liefert die Vorlage für weitere
        await self._save()
        if push:
            self.push(self.displays[id], {"config": config})

    async def update(self, d: Display, name: str | None, settings: dict) -> None:
        """Einstellungen (mehrere auf einmal) und Name ändern; offene Panels bekommen sie sofort."""
        d.settings.update(settings)
        if name and name != d.name:
            d.name = name
            if dev := dr.async_get(self.hass).async_get_device(identifiers={(DOMAIN, d.id)}):
                dr.async_get(self.hass).async_update_device(dev.id, name=name)
        await self._save()
        self.push(d, {"kiosk": d.kiosk()})
        self.notify(d)

    async def set_setting(self, d: Display, key: str, value) -> None:
        await self.update(d, None, {key: value})

    @callback
    def push(self, d: Display, msg: dict) -> None:
        for cb in list(d.links):
            cb(msg)

    @callback
    def notify(self, d: Display) -> None:
        async_dispatcher_send(self.hass, signal(d.id))

    @callback
    def _arm(self, d: Display) -> None:
        """Offline-Alarm: bleibt das Display OFFLINE s ohne Panel, erscheint eine Meldung unter Einstellungen → Reparaturen."""
        @callback
        def fire(_now) -> None:
            d.alarm = None
            if d.links:   # nach Neuladen der Integration kann ein alter Timer laufen, Panel ist längst wieder da
                return
            ir.async_create_issue(self.hass, DOMAIN, f"offline_{d.id}", is_fixable=False, severity=ir.IssueSeverity.WARNING,
                                  translation_key="offline", translation_placeholders={"name": d.name})
        if not d.links and not d.alarm:
            d.alarm = async_call_later(self.hass, OFFLINE, fire)

    @callback
    def _disarm(self, d: Display) -> None:
        if d.alarm:
            d.alarm()
            d.alarm = None
        ir.async_delete_issue(self.hass, DOMAIN, f"offline_{d.id}")

    @callback
    def link(self, d: Display, cb):
        d.links.append(cb)
        self._disarm(d)
        self.notify(d)

        @callback
        def unlink() -> None:
            d.links.remove(cb)
            self._arm(d)
            self.notify(d)
        return unlink
