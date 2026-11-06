param([int]$Port = 8081)

$ErrorActionPreference = 'SilentlyContinue'

function Test-PortOccupe {
    try {
        return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)
    } catch {
        return $false
    }
}

Write-Host "[backend] Liberation du port $Port..."

# 1) Tout processus qui ecoute reellement sur le port (ancienne instance Spring Boot oubliee).
$cibles = @()
try {
    $cibles = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
        Select-Object -ExpandProperty OwningProcess -Unique)
} catch {
    $cibles = @()
}
foreach ($procId in $cibles) {
    $p = Get-Process -Id $procId
    if ($p) {
        Write-Host "[backend] Arret de $($p.ProcessName) (PID $procId) qui occupe le port $Port"
        Stop-Process -Id $procId -Force
    }
}

# 2) Toute instance Java du projet (mvnw / IntelliJ) meme si elle n'ecoute pas encore.
Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq 'java.exe' -and $_.CommandLine -match 'gestionetudiant' } |
    ForEach-Object {
        Write-Host "[backend] Arret d'une instance Java du projet (PID $($_.ProcessId))"
        Stop-Process -Id $_.ProcessId -Force
    }

# 3) Attendre que le port soit reellement libere (max 10 s).
for ($i = 0; $i -lt 20; $i++) {
    if (-not (Test-PortOccupe)) { break }
    Start-Sleep -Milliseconds 500
}

if (Test-PortOccupe) {
    Write-Host "[backend] ERREUR : le port $Port est toujours occupe (processus non identifie)."
    exit 1
}

Write-Host "[backend] Port $Port libre."
exit 0
