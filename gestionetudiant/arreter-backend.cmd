@echo off
rem Arret du backend : libere le port 8081 et tue les instances Java du projet.
setlocal
chcp 65001 >nul

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0liberer-port.ps1" -Port 8081
if errorlevel 1 (
    echo.
    echo [backend] Le port 8081 reste occupe : verifiez avec "netstat -ano | findstr :8081".
) else (
    echo [backend] Backend arrete, port 8081 libre.
)
pause
