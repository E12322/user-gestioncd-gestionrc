import logging
import smtplib
from email.mime.text import MIMEText
from app.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM

logger = logging.getLogger("smartcampus.library")
logging.basicConfig(level=logging.INFO)

def publish_domain_event(event_name: str, payload: str):
    """
    Publication d'un événement de domaine métier :
    - LivreEmprunté
    - LivreRetourné
    Journalisé pour la traçabilité et prêt pour le bus RabbitMQ / Outbox.
    """
    logger.info(f"[DOMAIN_EVENT] service=library-service event={event_name} payload=\"{payload}\"")

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
