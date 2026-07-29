@echo off
REM plate-write — feed JSON to the Hisho writer CLI without launching the app.
REM Runs the built CLI under Electron's Node (reuses the electron-ABI better-sqlite3).
REM Usage (preferred):  plate-write ingest <file.json>    |    plate-write dismiss <file.json>
REM         (or stdin):  echo <json> | plate-write ingest  |    echo <json> | plate-write dismiss
set "ELECTRON_RUN_AS_NODE=1"
if "%PLATE_DB%"=="" set "PLATE_DB=%APPDATA%\Hisho\hisho.db"
"%~dp0..\node_modules\.bin\electron.cmd" "%~dp0..\out\main\cli.js" %*
