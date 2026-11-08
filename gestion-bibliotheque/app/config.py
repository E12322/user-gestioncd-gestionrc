import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", "8082"))
HOST = os.getenv("HOST", "0.0.0.0")
ENV = os.getenv("ENV", "development")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./library.db")

# Authentification JWT
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-en-production-32-caracteres-minimum")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ISSUER = os.getenv("JWT_ISSUER", "smartcampus-user-service")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "smartcampus")

# Intégrations Microservices
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://localhost:4001")
FINANCIAL_SERVICE_URL = os.getenv("FINANCIAL_SERVICE_URL", "http://localhost:8083")

# Eureka Service Discovery
EUREKA_SERVER = os.getenv("EUREKA_SERVER", "http://localhost:8761/eureka")
EUREKA_ENABLED = os.getenv("EUREKA_ENABLED", "false").lower() in ("true", "1", "yes")
APP_NAME = os.getenv("APP_NAME", "LIBRARY-SERVICE")

# RabbitMQ Event Bus
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
RABBITMQ_ENABLED = os.getenv("RABBITMQ_ENABLED", "false").lower() in ("true", "1", "yes")
RABBITMQ_EXCHANGE = os.getenv("RABBITMQ_EXCHANGE", "smartcampus.events")

# SMTP Notifications
SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "1025"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
MAIL_FROM = os.getenv("MAIL_FROM", "SmartCampus Bibliothèque <bibliotheque@smartcampus.tn>")
