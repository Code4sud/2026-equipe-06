"""Safeguards written in code: they hold even when the model gets it wrong.

- a quote must really be said by the young person (traceability is the strength
  of the project);
- no sensitive information (health, origin, family, religion) ends up in what
  is kept;
- a failsafe for distress that does not depend on the model;
- cleaning of what the model says, because it will be read aloud.
"""

import re
import unicodedata

from .models import Message

# ---- Quotes -----------------------------------------------------------------


def normalize(text: str) -> str:
    """Lowercase, apostrophes and spaces unified, so a quote can be compared to
    the original.
    """
    text = (
        text.replace("’", "'")
        .replace("‘", "'")
        .replace("`", "'")
        .replace("«", '"')
        .replace("»", '"')
    )
    text = unicodedata.normalize("NFC", text).lower()
    return re.sub(r"\s+", " ", text).strip(" \"'.,;:!?…")


def is_exact_quote(quote: str, user_texts: list[str]) -> bool:
    """True if the quote appears word for word in one of the young person's
    messages.
    """
    needle = normalize(quote)
    if len(needle) < 8:
        return False
    return any(needle in normalize(text) for text in user_texts)


# Written where an erased quote was, so the conversation still reads as a
# conversation
ERASED = "[effacé]"


def erase_quote(text: str, quote: str) -> str:
    """The text without the quote, matched like is_exact_quote (case,
    apostrophes, spaces).
    """
    needle = normalize(quote)
    if len(needle) < 8:
        return text
    parts = []
    for char in needle:
        if char == " ":
            parts.append(r"\s+")
        elif char == "'":
            parts.append("['’‘`]")
        elif char == '"':
            parts.append('["«»]')
        else:
            parts.append(re.escape(char))
    pattern = re.compile("".join(parts), re.IGNORECASE)
    erased = pattern.sub(ERASED, unicodedata.normalize("NFC", text))
    return erased if erased != unicodedata.normalize("NFC", text) else text


def user_texts(messages: list[Message]) -> list[str]:
    return [m.text for m in messages if m.role == "user"]


# ---- Sensitive information --------------------------------------------------

# Words that must not appear in what is kept about the person. Not meant to be
# complete:
# the prompts do the main work, this catches what slips through.
_SENSITIVE_WORDS = (
    # family
    r"famille",
    r"familial\w*",
    r"m[eè]re",
    r"p[eè]re",
    r"parents?",
    r"fr[eè]res?",
    r"s[oœ]urs?",
    r"grand-m[eè]re",
    r"grand-p[eè]re",
    r"grands-parents",
    r"oncle",
    r"tante",
    r"cousin\w*",
    r"fils",
    r"mari",
    r"[ée]pouse",
    r"belle-m[eè]re",
    r"beau-p[eè]re",
    r"orphelin\w*",
    r"divorc\w*",
    # health
    r"sant[ée]",
    r"malad\w*",
    r"handicap\w*",
    r"d[ée]pression",
    r"d[ée]prim\w*",
    r"anxi[ée]t[ée]",
    r"autis\w*",
    r"dys\w+",
    r"tdah",
    r"cancer",
    r"th[ée]rapie",
    r"psy",
    r"suicid\w*",
    # origin
    r"origines?",
    r"[ée]tranger\w*",
    r"immigr\w*",
    r"r[ée]fugi[ée]\w*",
    r"nationalit[ée]",
    r"quartier sensible",
    r"banlieue",
    r"couleur de peau",
    r"racis\w*",
    # religion
    r"religi\w+",
    r"musulman\w*",
    r"chr[ée]tien\w*",
    r"juif\w*",
    r"juive",
    r"catholique\w*",
    r"islam\w*",
    r"mosqu[ée]e",
    r"[ée]glise",
    r"synagogue",
    r"pri[èe]re",
    r"ramadan",
    r"hijab",
)
_SENSITIVE_RE = re.compile(
    r"\b(?:" + "|".join(_SENSITIVE_WORDS) + r")\b", re.IGNORECASE
)


def is_sensitive(text: str) -> bool:
    return _SENSITIVE_RE.search(text) is not None


# Wider net, only to spot what to ask about at the summary (the model then
# sorts it out):
# words that are often innocent ("faire de la voile") but can be about religion
# or health
_MAYBE_SENSITIVE_RE = re.compile(
    r"\b(?:voile|voil[ée]e?|foulard|pri[eé]\w*|croyant\w*|pratiquant\w*|halal"
    r"|casher|kasher|kippa|je[uû]ne\w*|fauteuil|sourde?s?|aveugle\w*"
    r"|malvoyant\w*|malentendant\w*|diab[eè]t\w*|asthm\w*|allergi\w*"
    r"|[ée]pilep\w*|traitement|m[ée]dicament\w*|h[oô]pital\w*|bless[ée]\w*"
    r"|douleur\w*)\b",
    re.IGNORECASE,
)


def might_be_sensitive(text: str) -> bool:
    return is_sensitive(text) or _MAYBE_SENSITIVE_RE.search(text) is not None


def strip_sensitive(text: str) -> str:
    """The text without the sentences that contain sensitive words. Keeps the
    rest instead of dropping all.
    """
    sentences = re.split(r"(?<=[.!?…])\s+", text.strip())
    return " ".join(s for s in sentences if s and not is_sensitive(s))


# ---- Closed questions -------------------------------------------------------

# A question with one of these words invites a story. Without any, it is
# answered with "ouais" or one word
_OPEN_WORDS_RE = re.compile(
    r"\b(?:comment|quoi|qu'est-ce|qu'est ce|pourquoi|raconte|racontes|quels?"
    r"|quelles?|lesquel\w*|laquelle|où|combien|dis-moi|parle-moi|explique"
    r"|d[ée]cris)\b"
    # "qui" asks a question only at the start or after a preposition, not in
    # "autre chose qui a changé"
    r"|(?:^(?:et\s+)?|\b(?:c'est|avec|pour|à|de|par|chez)\s+)qui\b",
    re.IGNORECASE,
)
# Suggesting the answer ("t'as dû…", "…, non ?") is closed even with an open
# word
_SUGGESTING_RE = re.compile(
    r"(?:^|\s)(?:t'as dû|tu as dû|t'as d[uû]|j'imagine que)|,\s*(?:non|hein"
    r"|pas vrai)\s*\?$",
    re.IGNORECASE,
)


def last_question(text: str) -> str:
    questions = re.findall(r"[^.!?…]*\?", text.replace("’", "'"))
    return questions[-1].strip() if questions else ""


def is_closed_question(text: str) -> bool:
    """True when the question that ends the text can be answered by yes, no or
    one word.
    """
    question = last_question(text)
    if not question:
        return False
    return (
        _SUGGESTING_RE.search(question) is not None
        or _OPEN_WORDS_RE.search(question) is None
    )


# Without a question, the message must still hand him the floor: an invitation,
# or his words left hanging
_INVITATION_RE = re.compile(
    r"\b(?:raconte|explique|dis-moi|parle-moi|d[ée]cris|vas-y|continue"
    r"|je t'[ée]coute|montre-moi)\b",
    re.IGNORECASE,
)


def hands_over(text: str) -> bool:
    """True when the message gives the floor back: a question, an invitation,
    or a sentence left hanging (…).
    """
    text = text.replace("’", "'").strip()
    return (
        "?" in text
        or text.endswith(("…", "..."))
        or _INVITATION_RE.search(text) is not None
    )


# ---- Distress ---------------------------------------------------------------

_DISTRESS_RE = re.compile(
    r"(me suicid|suicid|envie de mourir|veux mourir|vouloir mourir"
    r"|en finir avec la vie|en finir avec tout|me tuer|me faire du mal"
    r"|me foutre en l'air|plus envie de vivre|plus envie d'exister"
    r"|j'en peux plus de vivre|me scarifi|me mutil|mettre fin [àa] mes jours)",
    re.IGNORECASE,
)

# Fixed text: the model never improvises here. 3114 is the French
# suicide-prevention number,
# free and open every day, all day; 112 is the European emergency number.
# The exact wording must be reviewed by the team in charge of the limits.
DISTRESS_MESSAGE = (
    "Ce que tu me dis est important, et je préfère arrêter le jeu là. Je suis "
    "une IA, et là tu as besoin de parler à quelqu'un de vrai. Tu peux "
    "appeler le 3114. C'est gratuit, et il y a quelqu'un pour t'écouter à "
    "toute heure, tous les jours. Si c'est urgent, appelle le 112. Tu n'es "
    "pas seul."
)


def looks_like_distress(text: str) -> bool:
    """Failsafe on obvious phrases. The model also detects distress, this does
    not replace it.
    """
    return _DISTRESS_RE.search(text.replace("’", "'")) is not None


# ---- "I don't know" ---------------------------------------------------------

_DONT_KNOW_RE = re.compile(
    r"^\W*(je sais pas|j'sais pas|jsp|chais pas|ch'sais pas|aucune id[ée]e"
    r"|je ne sais pas|sais pas|rien)\W*$",
    re.IGNORECASE,
)


def is_dont_know(text: str) -> bool:
    return _DONT_KNOW_RE.match(text.replace("’", "'").strip()) is not None


def trailing_dont_know(messages: list[Message]) -> int:
    """How many of the last user messages in a row were a "je sais pas" (two
    means: change card).
    """
    count = 0
    for text in reversed(user_texts(messages)):
        if not is_dont_know(text):
            break
        count += 1
    return count


# A short message asking for another card. The model's flag (wants_new_card) is
# the main signal:
# this only catches the obvious cases it misses. Short messages only, so a
# story about "une autre
# carte graphique" does not end the card
# Real-life cards a story can be about: "une autre carte graphique" is not a
# request
_OTHER_CARDS = (
    r"graphique|bancaire|bleue|vitale|sim|m[èe]re|cadeau|pok[ée]mon|r[ée]seau"
    r"|son|m[ée]moire|de |d'"
)
_NEW_CARD_RE = re.compile(
    r"\b(?:(?:une|l'|la|d'|des)\s*(?:autre|nouvelle"
    r"|prochaine)s?\s+cartes?(?!\s+(?:"
    + _OTHER_CARDS
    + r"))"
    r"|cartes?\s+suivantes?"
    r"|chang(?:e|er|é|ez|eons)\s+(?:de\s+)?cartes?"
    r"|(?:on|je|tu)\s+(?:re)?pioche"
    r"|(?:re)?piocher)\b",
    re.IGNORECASE,
)
_NEW_CARD_MAX_WORDS = 12


def asks_new_card(text: str) -> bool:
    """True when a short message of the young person asks to go to another
    card.
    """
    text = text.replace("’", "'")
    return (
        len(text.split()) <= _NEW_CARD_MAX_WORDS
        and _NEW_CARD_RE.search(text) is not None
    )


# ---- What the model says (read aloud) ---------------------------------------

_EMOJI_RE = re.compile(
    "[\U0001f300-\U0001faff\U00002600-\U000027bf"
    "\U0001f000-\U0001f2ff\U0000fe0f\U0000200d]",
    flags=re.UNICODE,
)


def clean_for_speech(text: str) -> str:
    """Removes what is not said aloud: markdown, bullets, emojis, quotes around
    the whole text.
    """
    text = _EMOJI_RE.sub("", text)
    text = re.sub(r"[*_`#>]+", "", text)
    text = re.sub(r"^\s*[-•]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) >= 2 and text[0] in "\"«" and text[-1] in "\"»":
        text = text[1:-1].strip()
    return text
