# Démarrage du backend (gestionetudiant)

Port : **8081** (aligné sur le front : `VITE_API_BASE_URL=http://localhost:8081/api`).

## Démarrage / redémarrage

Double-cliquer sur **`demarrer-backend.cmd`** (ou l'exécuter depuis un terminal).

Le script :

1. arrête toute instance Java du projet et tout processus qui écoute sur le port `8081`
   (ancienne instance oubliée, console fermée sans `Ctrl+C`, lancement par l'IDE…) ;
2. attend que le port soit réellement libéré ;
3. lance Spring Boot (`mvnw spring-boot:run`).

Il peut donc être relancé **sans jamais** provoquer l'erreur
`Web server failed to start. Port 8081 was already in use.`

## Arrêt

- `Ctrl+C` dans le terminal, **ou**
- double-cliquer sur **`arreter-backend.cmd`** (libère le port 8081).

## Lancement depuis IntelliJ IDEA

Le port 8081 ne peut être utilisé que par **une seule instance**. Si vous lancez la
configuration d'exécution alors qu'un backend tourne déjà (terminal, script ou ancien
run IntelliJ), IntelliJ affiche `Port 8081 was already in use`.

Avant de cliquer sur **Run** :

- arrêtez l'ancien run avec le bouton **Stop** d'IntelliJ, **ou**
- lancez **`arreter-backend.cmd`** (il libère le port et tue l'ancienne instance Java).

Puis **Run** fonctionne normalement (le port par défaut du projet est 8081).

## Vérification

- API : <http://localhost:8081/api/academic/v1/sessions?size=1>
- Swagger : <http://localhost:8081/swagger-ui.html>

## Dépannage

Si le port reste occupé malgré tout, identifier le processus :

```powershell
Get-NetTCPConnection -LocalPort 8081 -State Listen | Select-Object OwningProcess
```

puis l'arrêter (`Stop-Process -Id <PID> -Force`) ou simplement relancer
`demarrer-backend.cmd`.
