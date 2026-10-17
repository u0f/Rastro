@echo off
rem Crea dist\Rastro.exe (un solo archivo). Requiere: py -m pip install pyinstaller pywebview
rem Antes, sube VERSION en actualizar.py. Despues, haz una Release en GitHub con la etiqueta vX.Y.Z
rem y adjunta dist\Rastro.exe: las copias instaladas se actualizaran solas al abrirse.
cd /d "%~dp0"
py -m PyInstaller --noconfirm --onefile --windowed --name Rastro --icon assets\logo.ico ^
  --add-data "ui;ui" --add-data "extension;extension" app.py
