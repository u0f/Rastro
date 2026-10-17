@echo off
rem Crea dist\Rastro.exe (un solo archivo). Requiere: py -m pip install pyinstaller pywebview
rem Antes, sube VERSION en src\actualizar.py. Despues, haz una Release en GitHub con la etiqueta vX.Y.Z
rem y adjunta dist\Rastro.exe: las copias instaladas se actualizaran solas al abrirse.
cd /d "%~dp0"
py -m PyInstaller --noconfirm --onefile --windowed --name Rastro --icon src\assets\logo.ico ^
  --add-data "src\ui;ui" --add-data "src\extension;extension" src\app.py
