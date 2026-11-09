<#
  Lance toute l'application SmartCampus en local (un terminal par service) puis ouvre le navigateur.

  Utilisation (PowerShell) :
      .\scripts\lancer-tout.ps1            # lance tout ce qui ne tourne pas deja
      .\scripts\lancer-tout.ps1 -NoBrowser # sans ouvrir le navigateur

  Sans danger a relancer : un service dont le port est deja occupe est simplement ignore.

  Prerequis (une seule fois, voir docs\GUIDE-LANCEMENT-ET-TESTS.md) :
    - npm install dans SMART-COMPUS-BACK-END-ESPRIT-5SE3, backend-residences et SMART-COMPUS-ESPRIT-5SE3-FRONT-END
    - environnements Python : gestion-bibliotheque\venv et agent-service\.venv
    - fichiers .env : user-service, agent-service et front
    - MongoDB (service Windows) et Docker Desktop
#>
param([switch]$NoBrowser)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Secret = 'change-me-en-production-32-caracteres-minimum'   # secret JWT de DEVELOPPEMENT, identique pour tous les services

function Test-Port([int]$Port) {
    [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Wait-Port([int]$Port, [int]$Seconds) {
    $end = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $end) {
        if (Test-Port $Port) { return $true }
        Start-Sleep -Seconds 3
    }
    return $false
}

# Java 23 et plus : Lombok ne s'execute plus sans cette option du compilateur (inutile, et refusee, avant Java 21).
$javaMajor = 0
try {
    $v = (& java -version 2>&1 | Select-Object -First 1).ToString()
    if ($v -match '"(\d+)') { $javaMajor = [int]$Matches[1] }
} catch { }
$mvnFlags = ''
if ($javaMajor -ge 23) { $mvnFlags = '-Dmaven.compiler.proc=full' }

Write-Host ''
Write-Host '=== SmartCampus : lancement ===' -ForegroundColor Cyan
Write-Host "Dossier : $Root   |   Java detecte : $javaMajor"

# --- Infrastructure -------------------------------------------------------------------------------
if (-not (Test-Port 27017)) {
    Write-Host 'MongoDB (27017) est arrete : tentative de demarrage du service...' -ForegroundColor Yellow
    try { Start-Service MongoDB -ErrorAction Stop } catch { }
    if (-not (Wait-Port 27017 20)) {
        Write-Host 'ECHEC : MongoDB ne demarre pas. Ouvrir PowerShell EN ADMINISTRATEUR et lancer : net start MongoDB' -ForegroundColor Red
        Write-Host '(utilisateurs et vie etudiante ne marcheront pas sans lui)' -ForegroundColor Red
    }
}
if (-not ((Test-Port 5432) -and (Test-Port 5672))) {
    & docker info *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host 'Docker : demarrage de PostgreSQL et RabbitMQ...' -ForegroundColor Yellow
        Push-Location (Join-Path $Root 'backend-residences')
        & docker compose up -d postgres rabbitmq
        Pop-Location
        Wait-Port 5432 60 | Out-Null
        Wait-Port 5672 60 | Out-Null
    } else {
        Write-Host 'Docker Desktop ne repond pas : le module Residences ne pourra pas demarrer (lancer Docker Desktop).' -ForegroundColor Red
    }
}

# --- Services ---------------------------------------------------------------------------------------
$services = @(
    @{ Name = 'Utilisateurs';    Port = 4001; Dir = 'SMART-COMPUS-BACK-END-ESPRIT-5SE3'; Cmd = 'npm run dev'; Wait = 60 },
    @{ Name = 'Academique';      Port = 8081; Dir = 'gestionetudiant';        Cmd = ".\mvnw.cmd $mvnFlags spring-boot:run"; Wait = 150 },
    @{ Name = 'Ressources';      Port = 8080; Dir = 'SMART-COMPUS-BACKEND';   Cmd = ".\mvnw.cmd $mvnFlags spring-boot:run"; Wait = 150 },
    @{ Name = 'Vie etudiante';   Port = 4005; Dir = 'vie-etudiante';          Cmd = ".\mvnw.cmd $mvnFlags -Dlombok.version=1.18.42 spring-boot:run"; Wait = 150 },
    @{ Name = 'Bibliotheque';    Port = 8082; Dir = 'gestion-bibliotheque';   Cmd = '.\venv\Scripts\python.exe -m uvicorn app.main:app --port 8082'; Wait = 60 },
    @{ Name = 'Residences';      Port = 3001; Dir = 'backend-residences';     Cmd = "`$env:JWT_SECRET='$Secret'; `$env:JWT_ISSUER='smartcampus-user-service'; npm run start:dev"; Wait = 150 },
    @{ Name = 'Agent IA';        Port = 4010; Dir = 'agent-service';          Cmd = '.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 4010'; Wait = 90 },
    @{ Name = 'Front';           Port = 5173; Dir = 'SMART-COMPUS-ESPRIT-5SE3-FRONT-END'; Cmd = 'npm run dev'; Wait = 60 }
)

foreach ($s in $services) {
    $dir = Join-Path $Root $s.Dir
    if (Test-Port $s.Port) {
        Write-Host ("[deja actif] {0,-14} :{1}" -f $s.Name, $s.Port) -ForegroundColor DarkGray
        continue
    }
    if (-not (Test-Path $dir)) {
        Write-Host ("[ABSENT]     {0,-14} dossier introuvable : {1}" -f $s.Name, $dir) -ForegroundColor Red
        continue
    }
    $title = "SmartCampus - $($s.Name) (:$($s.Port))"
    $command = "`$Host.UI.RawUI.WindowTitle = '$title'; " + $s.Cmd
    Start-Process powershell -WorkingDirectory $dir -ArgumentList @('-NoExit', '-NoProfile', '-Command', $command)
    Write-Host ("[lance]      {0,-14} :{1}" -f $s.Name, $s.Port) -ForegroundColor Green
}

# --- Attente et bilan -------------------------------------------------------------------------------
Write-Host ''
Write-Host 'Attente du demarrage (les services Java prennent 1 a 2 minutes)...' -ForegroundColor Cyan
$bilan = @()
foreach ($s in $services) {
    $ok = Wait-Port $s.Port $s.Wait
    $bilan += [pscustomobject]@{ Service = $s.Name; Port = $s.Port; Etat = $(if ($ok) { 'OK' } else { 'NE REPOND PAS' }) }
}
$bilan | Format-Table -AutoSize

$ko = @($bilan | Where-Object { $_.Etat -ne 'OK' })
if ($ko.Count -eq 0) {
    Write-Host 'Tout tourne : http://localhost:5173   (admin@gmail.com / Admin2026!)' -ForegroundColor Green
    if (-not $NoBrowser) { Start-Process 'http://localhost:5173' }
} else {
    Write-Host 'Certains services ne repondent pas : regarder leur fenetre (erreur affichee) et docs\GUIDE-LANCEMENT-ET-TESTS.md, section 4.' -ForegroundColor Yellow
}
