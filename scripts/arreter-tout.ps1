<#
  Arrete tous les services SmartCampus lances en local (par leur port).

      .\scripts\arreter-tout.ps1            # arrete les applications
      .\scripts\arreter-tout.ps1 -Docker    # arrete aussi PostgreSQL et RabbitMQ (conteneurs)

  MongoDB (service Windows) n'est jamais arrete par ce script.
#>
param([switch]$Docker)

$Root = Split-Path -Parent $PSScriptRoot
$ports = @(
    @{ Name = 'Front';         Port = 5173 }, @{ Name = 'Agent IA';      Port = 4010 },
    @{ Name = 'Residences';    Port = 3001 }, @{ Name = 'Residences (chambres)';  Port = 3011 },
    @{ Name = 'Residences (demandes)'; Port = 3012 }, @{ Name = 'Residences (contrats)'; Port = 3013 },
    @{ Name = 'Bibliotheque';  Port = 8082 }, @{ Name = 'Vie etudiante'; Port = 4005 },
    @{ Name = 'Ressources';    Port = 8080 }, @{ Name = 'Academique';    Port = 8081 },
    @{ Name = 'Utilisateurs';  Port = 4001 }
)

foreach ($p in $ports) {
    $conn = Get-NetTCPConnection -State Listen -LocalPort $p.Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        & taskkill /PID $conn.OwningProcess /T /F *> $null
        Write-Host ("[arrete]    {0,-24} :{1}" -f $p.Name, $p.Port) -ForegroundColor Yellow
    } else {
        Write-Host ("[inactif]   {0,-24} :{1}" -f $p.Name, $p.Port) -ForegroundColor DarkGray
    }
}

if ($Docker) {
    Push-Location (Join-Path $Root 'backend-residences')
    & docker compose stop postgres rabbitmq
    Pop-Location
}
Write-Host 'Termine. Les fenetres de terminal restantes peuvent etre fermees.' -ForegroundColor Cyan
