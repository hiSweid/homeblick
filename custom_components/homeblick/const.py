DOMAIN = "homeblick"
URL = "/homeblick"
STORE_VERSION = 1
PLATFORMS = ["select", "switch", "button", "light", "number", "time", "binary_sensor", "sensor", "notify"]
FACES = ["bigclock", "analog", "weather", "music", "grid", "calendar", "date", "energy", "info", "cams", "people", "todo", "check", "photos"]
WAKE = ["off", "hey_jarvis", "alexa"]
# Einstellungen je Display (Entities der Kategorie „Konfiguration“); music = Musik-Face statt Bildschirmschoner, solange Musik läuft; chime = Gong beim Klingeln
DEFAULTS = {"idle": 300, "saver": "bigclock", "black": False, "perf": False, "perfauto": False, "hold": False, "kz": True, "micmute": False, "guest": False, "dnd": False, "sched": False, "sched_from": "22:30:00", "sched_to": "06:00:00", "music": True, "dim": False, "dim_from": "22:30:00", "dim_to": "06:00:00", "dim_level": 80, "wake": "off", "wake_sens": 50,
            "pipeline": "", "mic": "", "out": "", "duck": 30, "mute": False, "barge": False, "listen": 15, "volume": 100, "bright": 100, "tts": "", "chime": True, "weather": "weather.home", "presence": "", "lux": "", "place": "Home"}
LOGS = 50   # letzte Meldungen je Display (nur im Speicher)
