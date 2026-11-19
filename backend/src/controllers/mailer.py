import logging
import os
import smtplib

from email.message import EmailMessage

logger = logging.getLogger(__name__)


def send_auth_code(to: str, code: str, ttl_minutes: int) -> None:
    host = os.environ.get("SMTP_HOST")
    if not host:
        logger.warning("SMTP_HOST not set, code for %s: %s", to, code)
        return

    msg = EmailMessage()
    msg["Subject"] = "Votre code de connexion"
    msg["From"] = os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", ""))
    msg["To"] = to
    msg.set_content(
        f"Votre code de connexion est : {code}\n\n"
        f"Il expire dans {ttl_minutes} minutes. "
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message."
    )

    with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587"))) as smtp:
        smtp.starttls()
        user = os.environ.get("SMTP_USER")
        if user:
            smtp.login(user, os.environ.get("SMTP_PASSWORD", ""))
        smtp.send_message(msg)
