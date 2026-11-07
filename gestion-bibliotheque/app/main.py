from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.seed import seed_database
from app.routes import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialisation de la base de données
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield

app = FastAPI(
    title="SmartCampus - Microservice Gestion de la Bibliothèque",
    description="API REST du module Gestion de la Bibliothèque (Catalogue, Emprunts, Réservations, Retards, Notifications)",
    version="1.0.0",
    lifespan=lifespan
)

# Configuration CORS pour intégration fluide avec le Frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusion des routes
app.include_router(router)

@app.get("/health")
def health_check():
    return {"status": "UP", "service": "library-service"}
