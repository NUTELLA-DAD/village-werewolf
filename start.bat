@echo off
cd /d "%~dp0"
echo Installing (first run only, needs internet)...
if not exist node_modules call npm install
echo.
echo Starting Village Werewolf. Leave this window open.
start "" http://localhost:3000/tv.html
node server.js
pause
