import json
import logging
import smtplib
from email.mime.text import MIMEText
from app.config import (
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM,
    RABBITMQ_ENABLED, RABBITMQ_URL, RABBITMQ_EXCHANGE
)

logger = logging.getLogger("smartcampus.library")
logging.basicConfig(level=logging.INFO)

def publish_to_rabbitmq(routing_key: str, payload_dict: dict):
    """Publication asynchrone sécurisée sur RabbitMQ si activé."""
    if not RABBITMQ_ENABLED:
        return
    try:
        import pika
        parameters = pika.URLParameters(RABBITMQ_URL)
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type="topic", durable=True)
        message = json.dumps(payload_dict)
        channel.basic_publish(
            exchange=RABBITMQ_EXCHANGE,
            routing_key=routing_key,
            body=message,
            properties=pika.BasicProperties(
                delivery_mode=2,  # Rendre le message persistant
                content_type="application/json"
            )
        )
        connection.close()
        logger.info(f"[RABBITMQ] Published '{routing_key}': {message}")
    except Exception as e:
        logger.warning(f"[RABBITMQ] Échec de publication non-bloquante: {e}")

def publish_domain_event(event_name: str, payload: str, details: dict = None):
    """
    Publication d'un événement de domaine métier :
    - LivreEmprunté
    - LivreRetourné
    Journalisé pour l'audit et routé vers le bus d'événements RabbitMQ.
    """
    logger.info(f"[DOMAIN_EVENT] service=library-service event={event_name} payload=\"{payload}\"")
    data = {"service": "library-service", "event": event_name, "summary": payload, "details": details or {}}
    publish_to_rabbitmq(f"library.event.{event_name.lower()}", data)

def send_notification_email(recipient_email: str, subject: str, body: str):
    """
    Envoi de notification par e-mail (ex: rappel de retour ou retard).
    """
    try:
        msg = MIMEText(body, "html", "utf-8")
        msg["Subject"] = subject
        msg["From"] = MAIL_FROM
        msg["To"] = recipient_email

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as server:
            if SMTP_USER and SMTP_PASS:
                server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        logger.info(f"[SMTP] Email envoyé à {recipient_email}: {subject}")
    except Exception as e:
        logger.warning(f"[SMTP] Notification non distribuée ({e}) - SMTP non bloquant")
