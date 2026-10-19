DOMAIN = "homeblick"
URL = "/homeblick"
STORE_VERSION = 1
PLATFORMS = ["select", "switch", "button", "number", "time"]
FACES = ["bigclock", "analog", "weather", "music", "grid", "calendar", "energy", "info", "cams"]
WAKE = ["off", "hey_jarvis", "alexa"]
# Einstellungen je Display (Entities der Kategorie „Konfiguration“)
DEFAULTS = {"idle": 300, "saver": "bigclock", "dim": False, "dim_from": "22:30:00", "dim_to": "06:00:00", "dim_level": 80, "wake": "off",
            "pipeline": "", "mute": False, "barge": False, "listen": 15, "volume": 100, "weather": "weather.home", "place": "Home"}
