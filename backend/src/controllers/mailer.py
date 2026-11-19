import json
import logging
import os
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
TIMEOUT_SECONDS = 10


class MailError(Exception):
    pass


def send_auth_code(to: str, code: str, ttl_minutes: int) -> None:
    """Send the login code by email through the Brevo HTTPS API.

    Env vars:
    - BREVO_API_KEY: API key (Brevo > SMTP & API > API Keys)
    - MAIL_FROM: sender address, verified in Brevo (Senders & IP)
    - MAIL_FROM_NAME: optional display name

    If BREVO_API_KEY is not set (local dev), the code is only logged.
    Raises MailError if the email could not be sent.
    """
    api_key = os.environ.get("BREVO_API_KEY")
    if not api_key:
        logger.warning("BREVO_API_KEY not set, code for %s: %s", to, code)
        return

    sender_email = os.environ.get("MAIL_FROM")
    if not sender_email:
        raise MailError("MAIL_FROM is not set.")

    body = json.dumps({
        "sender": {"name": os.environ.get("MAIL_FROM_NAME", "Connexion"), "email": sender_email},
        "to": [{"email": to}],
        "subject": "Votre code de connexion",
        "textContent": (
            f"Votre code de connexion est : {code}\n\n"
            f"Il expire dans {ttl_minutes} minutes. "
            "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message."
        ),
    }).encode()

    req = urllib.request.Request(
        BREVO_URL,
        data=body,
        method="POST",
        headers={
            "api-key": api_key,
            "content-type": "application/json",
            "accept": "application/json",
            "user-agent": "auth-backend/1.0",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS):
            pass
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        logger.error("Brevo error %s: %s", e.code, detail)
        raise MailError(f"Brevo returned {e.code}") from e
    except (urllib.error.URLError, TimeoutError) as e:
        logger.error("Brevo unreachable: %s", e)
        raise MailError("Could not reach the email provider.") from e
