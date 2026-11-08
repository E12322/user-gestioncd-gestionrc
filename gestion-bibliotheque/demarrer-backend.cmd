@echo off
echo ====================================================
echo  Demarrage du Microservice Gestion de la Bibliotheque
echo ====================================================

if not exist venv (
    echo Creation de l'environnement virtuel...
    python -m venv venv
    call venv\Scripts\activate.bat
    echo Installation des dependances...
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

echo Lancement du service sur http://localhost:8082...
uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload
