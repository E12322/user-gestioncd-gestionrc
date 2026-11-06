@echo off
rem Demarrage fiable du backend : libere le port 8081 (ancienne instance oubliee,
rem PID Java du projet reste en arriere-plan...) puis lance Spring Boot.
rem Usage : double-clic, ou "demarrer-backend.cmd" depuis le dossier gestionetudiant.
setlocal
chcp 65001 >nul

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0liberer-port.ps1" -Port 8081
if errorlevel 1 (
    echo.
    echo [backend] Impossible de liberer le port 8081. Fermez l'application qui l'utilise puis relancez.
    pause
    exit /b 1
)

echo [backend] Demarrage de Spring Boot sur le port 8081...
call "%~dp0mvnw.cmd" spring-boot:run
