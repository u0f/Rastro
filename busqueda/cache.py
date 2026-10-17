"""Caché local con caducidad (SQLite). Guarda lo ya extraído de cada URL, no el HTML."""
import json
import sqlite3
import time

TTL = 6 * 3600  # segundos


class Cache:
    def __init__(self, ruta, ttl=TTL):
        self.ttl = ttl
        self.db = sqlite3.connect(ruta)
        self.db.execute("CREATE TABLE IF NOT EXISTS paginas (url TEXT PRIMARY KEY, ts REAL, datos TEXT)")
        self.db.execute("DELETE FROM paginas WHERE ts < ?", (time.time() - ttl,))
        self.db.commit()

    def get(self, url):
        fila = self.db.execute("SELECT datos FROM paginas WHERE url = ? AND ts >= ?", (url, time.time() - self.ttl)).fetchone()
        return json.loads(fila[0]) if fila else None

    def set(self, url, datos):
        self.db.execute("REPLACE INTO paginas VALUES (?, ?, ?)", (url, time.time(), json.dumps(datos, ensure_ascii=False)))
        self.db.commit()

    def cerrar(self):
        self.db.close()
