"""Safeguards written in code: they hold even when the model gets it wrong.

- a quote must really be said by the young person (traceability is the strength of the project);
- no sensitive information (health, origin, family, religion) ends up in what is kept;
- a failsafe for distress that does not depend on the model;
- cleaning of what the model says, because it will be read aloud.
"""

import re
import unicodedata

from .models import Message

# ---- Quotes -------------------------------------------------------------------------------------


def normalize(text: str) -> str:
    """Lowercase, apostrophes and spaces unified, so a quote can be compared to the original."""
    text = text.replace("’", "'").replace("‘", "'").replace("`", "'").replace("«", '"').replace("»", '"')
    text = unicodedata.normalize("NFC", text).lower()
    return re.sub(r"\s+", " ", text).strip(" \"'.,;:!?…")


def is_exact_quote(quote: str, user_texts: list[str]) -> bool:
    """True if the quote appears word for word in one of the young person's messages."""
    needle = normalize(quote)
    if len(needle) < 8:
        return False
    return any(needle in normalize(text) for text in user_texts)


def user_texts(messages: list[Message]) -> list[str]:
    return [m.text for m in messages if m.role == "user"]


# ---- Sensitive information ----------------------------------------------------------------------

# Words that must not appear in what is kept about the person. Not meant to be complete:
# the prompts do the main work, this catches what slips through.
_SENSITIVE_WORDS = (
    # family
    r"famille", r"familial\w*", r"m[eè]re", r"p[eè]re", r"parents?", r"fr[eè]res?", r"s[oœ]urs?",
    r"grand-m[eè]re", r"grand-p[eè]re", r"grands-parents", r"oncle", r"tante", r"cousin\w*", r"fils",
    r"mari", r"[ée]pouse", r"belle-m[eè]re", r"beau-p[eè]re", r"orphelin\w*", r"divorc\w*",
    # health
    r"sant[ée]", r"malad\w*", r"handicap\w*", r"d[ée]pression", r"d[ée]prim\w*", r"anxi[ée]t[ée]", r"autis\w*",
    r"dys\w+", r"tdah", r"cancer", r"th[ée]rapie", r"psy", r"suicid\w*",
    # origin
    r"origines?", r"[ée]tranger\w*", r"immigr\w*", r"r[ée]fugi[ée]\w*", r"nationalit[ée]", r"quartier sensible",
    r"banlieue", r"couleur de peau", r"racis\w*",
    # religion
    r"religi\w+", r"musulman\w*", r"chr[ée]tien\w*", r"juif\w*", r"juive", r"catholique\w*", r"islam\w*", r"mosqu[ée]e",
    r"[ée]glise", r"synagogue", r"pri[èe]re", r"ramadan", r"hijab",
)
_SENSITIVE_RE = re.compile(r"\b(?:" + "|".join(_SENSITIVE_WORDS) + r")\b", re.IGNORECASE)


def is_sensitive(text: str) -> bool:
    return _SENSITIVE_RE.search(text) is not None


def strip_sensitive(text: str) -> str:
    """The text without the sentences that contain sensitive words. Keeps the rest instead of dropping all."""
    sentences = re.split(r"(?<=[.!?…])\s+", text.strip())
    return " ".join(s for s in sentences if s and not is_sensitive(s))


# ---- Distress -----------------------------------------------------------------------------------

_DISTRESS_RE = re.compile(
    r"(me suicid|suicid|envie de mourir|veux mourir|vouloir mourir|en finir avec la vie|en finir avec tout|"
    r"me tuer|me faire du mal|me foutre en l'air|plus envie de vivre|plus envie d'exister|"
    r"j'en peux plus de vivre|me scarifi|me mutil|mettre fin [àa] mes jours)",
    re.IGNORECASE,
)

# Fixed text: the model never improvises here. 3114 is the French suicide-prevention number,
# free and open every day, all day; 112 is the European emergency number.
# The exact wording must be reviewed by the team in charge of the limits.
DISTRESS_MESSAGE = (
    "Ce que tu me dis est important, et je préfère arrêter le jeu là. "
    "Je suis une IA, et là tu as besoin de parler à quelqu'un de vrai. "
    "Tu peux appeler le 3114. C'est gratuit, et il y a quelqu'un pour t'écouter à toute heure, tous les jours. "
    "Si c'est urgent, appelle le 112. "
    "Tu n'es pas seul."
)


def looks_like_distress(text: str) -> bool:
    """Failsafe on obvious phrases. The model also detects distress, this does not replace it."""
    return _DISTRESS_RE.search(text.replace("’", "'")) is not None


# ---- "I don't know" -----------------------------------------------------------------------------

_DONT_KNOW_RE = re.compile(
    r"^\W*(je sais pas|j'sais pas|jsp|chais pas|ch'sais pas|aucune id[ée]e|je ne sais pas|sais pas|rien)\W*$",
    re.IGNORECASE,
)


def is_dont_know(text: str) -> bool:
    return _DONT_KNOW_RE.match(text.replace("’", "'").strip()) is not None


def trailing_dont_know(messages: list[Message]) -> int:
    """How many of the last user messages in a row were a "je sais pas" (two means: change card)."""
    count = 0
    for text in reversed(user_texts(messages)):
        if not is_dont_know(text):
            break
        count += 1
    return count


# ---- What the model says (read aloud) -----------------------------------------------------------

_EMOJI_RE = re.compile(
    "[\U0001f300-\U0001faff\U00002600-\U000027bf\U0001f000-\U0001f2ff\U0000fe0f\U0000200d]", flags=re.UNICODE
)


def clean_for_speech(text: str) -> str:
    """Removes what is not said aloud: markdown, bullets, emojis, quotes around the whole text."""
    text = _EMOJI_RE.sub("", text)
    text = re.sub(r"[*_`#>]+", "", text)
    text = re.sub(r"^\s*[-•]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) >= 2 and text[0] in "\"«" and text[-1] in "\"»":
        text = text[1:-1].strip()
    return text
