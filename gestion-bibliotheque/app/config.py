import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", "8082"))
HOST = os.getenv("HOST", "0.0.0.0")
ENV = os.getenv("ENV", "development")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./library.db")

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-en-production-32-caracteres-minimum")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ISSUER = os.getenv("JWT_ISSUER", "smartcampus-user-service")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "smartcampus")

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://localhost:4001")
FINANCIAL_SERVICE_URL = os.getenv("FINANCIAL_SERVICE_URL", "http://localhost:8083")

SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "1025"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
MAIL_FROM = os.getenv("MAIL_FROM", "SmartCampus Bibliothèque <bibliotheque@smartcampus.tn>")
