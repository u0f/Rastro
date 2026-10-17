#!/bin/bash
# Abre Rastro en Mac con doble clic. La primera vez prepara Python y pywebview (tarda un par de minutos).
# Deja esta ventana abierta mientras usas Rastro: al cerrarla se cierra la app.
cd "$(dirname "$0")" || exit 1
ENTORNO="$HOME/Library/Application Support/Rastro/python"

if [ ! -x "$ENTORNO/bin/python3" ]; then
  echo "Preparando Rastro por primera vez..."
  if ! python3 -m venv "$ENTORNO"; then
    echo "Falta Python 3. Instálalo desde https://www.python.org/downloads/ y vuelve a abrir Rastro."
    read -r -p "Pulsa Intro para cerrar."
    exit 1
  fi
fi
if ! "$ENTORNO/bin/python3" -c "import webview" 2>/dev/null; then
  "$ENTORNO/bin/python3" -m pip install -q --upgrade pip
  "$ENTORNO/bin/python3" -m pip install -q pywebview || { read -r -p "No se pudo instalar pywebview. Pulsa Intro."; exit 1; }
fi

exec "$ENTORNO/bin/python3" app.py
