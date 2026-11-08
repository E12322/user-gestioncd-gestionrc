@echo off
echo Recherche et arret du processus ecoutant sur le port 8082...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8082') do (
    taskkill /f /pid %%a 2>nul
)
echo Port 8082 libere.
