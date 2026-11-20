"""The talking part: open a card, answer the young person, welcome him back.

The functions are plain: they receive the context and the history, and return
text.
Saving anything (messages, entries, summaries) is the job of the caller.
"""

import logging
import re
from typing import Any

from . import guards, rules
from .config import get_config
from .context import NOTHING_YET, context_blocks, last_quote
from .llm import LLMError, complete, complete_json
from .models import Card, CollectionItem, Message, SessionContext, TurnReply
from .prompts import level_note, render, system_prompt

log = logging.getLogger(__name__)

# The mirror card is a short exchange of its own
_MIRROR_FORMAT = "mirror"

_SKIP_MESSAGE = "Passer : j'aimerais une autre question sur cette carte."


def open_turn(ctx: SessionContext, card: Card) -> str:
    """The first thing said on a card: its own opener, as written in
    cards.json.

    The young person just chose a new theme, so the card opens that theme. It
    is not rewritten to
    link back to what was said before: in the first real test, the rewritten
    opener pulled the
    conversation back to the previous subject. Links can still come during the
    turn, if he brings
    the subject back himself. `ctx` is kept so the signature does not change if
    this evolves.
    """
    return card.opener


def _situation_notes(
    *,
    exchanges: int,
    must_close: bool,
    dont_know_streak: int,
    skip: bool,
    first_card: bool,
) -> str:
    notes = []
    if first_card:
        notes.append(
            "C'est la toute première carte de la partie : reste très léger."
        )
    if skip:
        notes.append(
            "Il a appuyé sur « Passer » : pose une autre question sur la même "
            "carte, sous un autre angle, sans commenter qu'il a passé."
        )
    if dont_know_streak >= rules.DONT_KNOW_BEFORE_NEW_CARD:
        notes.append(
            f"Il a dit « je sais pas » {dont_know_streak} fois de suite : "
            "fais court, sans insister, et propose-lui une autre carte. Mets "
            "card_exhausted à true."
        )
    if must_close:
        notes.append(
            "C'est le dernier échange possible sur cette carte : ta réponse "
            "est la transition (un petit retour avec ses mots, puis « On "
            "pioche une autre carte ? »). Mets card_exhausted à true."
        )
    elif exchanges >= rules.SOFT_CLOSE_EXCHANGES:
        notes.append(
            f"Ça fait déjà {exchanges} échanges sur cette carte. Sauf si sa "
            "dernière réponse apporte vraiment quelque chose de nouveau, fais "
            "maintenant la transition et mets card_exhausted à true."
        )
    elif exchanges < rules.MIN_EXCHANGES:
        notes.append(
            "Il est trop tôt pour proposer une autre carte : continue sur "
            "celle-ci."
        )
    return "\n".join(notes)


_TRANSITION = "On pioche une autre carte ?"


def _with_transition(text: str) -> str:
    """When a card ends, the last words must be the transition, never a
    question he can no longer answer.
    """
    if "pioche" in text.lower():
        return text
    sentences = re.split(r"(?<=[.!?…])\s+", text.strip())
    while sentences and sentences[-1].rstrip().endswith("?"):
        sentences.pop()
    return " ".join([*sentences, _TRANSITION])


_MIRROR_CLOSING = (
    "Merci pour tout ça. À mon tour de te montrer ce que j'ai repéré."
)


def _with_mirror_closing(text: str) -> str:
    """The mirror ends on a thank-you, never on a question or an invitation he
    could no longer answer.
    """
    sentences = re.split(r"(?<=[.!?…])\s+", text.strip())
    while sentences and guards.hands_over(sentences[-1]):
        sentences.pop()
    if any("repér" in s or "montrer" in s for s in sentences):
        return " ".join(sentences)
    # What is left is kept only if it already thanks him ("Prends ton temps."
    # alone would make no sense)
    if any("merci" in s.lower() for s in sentences):
        return " ".join(
            [*sentences, "À mon tour de te montrer ce que j'ai repéré."]
        )
    return _MIRROR_CLOSING


def _mirror_notes(exchanges: int) -> str:
    # The first message of the mirror is the pick of cards, so the last
    # question comes at MIRROR_QUESTIONS + 1
    if exchanges >= rules.MIRROR_QUESTIONS + 1:
        return (
            "C'est ton dernier échange du miroir : remercie simplement, "
            "reprends un fait qu'il a dit, annonce que tu vas lui montrer ce "
            "que tu as repéré, et mets card_exhausted à true."
        )
    return ""


def _as_chat(messages: list[Message]) -> list[dict[str, str]]:
    return [{"role": m.role, "content": m.text} for m in messages]


_NO_PICK = "Je n'ai pas choisi de carte."


def _same_story_note(picked: list[CollectionItem]) -> str:
    """Picked cards spotted during the same turn tell one single moment: the
    model must not ask what he did "the same both times" about them.
    """
    by_turn: dict[str, list[str]] = {}
    for item in picked:
        by_turn.setdefault(item.card_title, []).append(item.fact)
    groups = [facts for facts in by_turn.values() if len(facts) > 1]
    if not groups:
        return ""
    lines = "\n".join(
        "- " + " ; ".join(f"« {fact} »" for fact in facts) for facts in groups
    )
    if len(by_turn) == 1:
        rule = (
            "Toutes ses cartes viennent donc d'**un seul moment**. Il n'y a pas "
            "« deux fois » : ne les compare jamais entre elles, ne demande "
            "jamais ce qu'il a fait pareil. Pour relier, demande-lui **où il "
            "aimerait refaire ça**, ou ce qu'un pote viendrait lui demander de "
            "faire après l'avoir vu."
        )
    else:
        rule = (
            "Ne compare jamais deux cartes d'un même groupe : c'est le même "
            "moment. Pour demander ce qu'il a fait pareil, prends deux cartes "
            "de **groupes différents**."
        )
    return (
        "\n\nAttention, ces cartes racontent **la même histoire**, vue sous "
        f"plusieurs angles (repérées pendant le même tour) :\n{lines}\n{rule}"
    )


def _mirror_pick_note(
    selected: list[CollectionItem] | None,
    history: list[Message],
    picked: list[CollectionItem] | None = None,
) -> str:
    """What he picked at the start of the mirror, said plainly so the model
    never invents a pick.
    """
    if selected is not None:
        pick = pick_message(selected)
    else:
        # Later messages: the pick is the first thing he "said" in the mirror
        pick = next((m.text for m in history if m.role == "user"), _NO_PICK)
    if pick == _NO_PICK:
        return (
            "Il n'a choisi **aucune** carte. Ne parle jamais de cartes qu'il "
            "aurait choisies ou gardées : pars de ce qu'il a raconté pendant "
            "la partie."
        )
    return (
        "Ce qu'il a choisi : "
        f"{pick.removeprefix('J\'ai choisi ces cartes de ma collection : ')}"
        + _same_story_note(picked or selected or [])
    )


def pick_message(selected: list[CollectionItem]) -> str:
    """The message standing for the pick of cards in the mirror (the first
    message of the mirror).
    """
    if not selected:
        return _NO_PICK
    return (
        "J'ai choisi ces cartes de ma collection : "
        + " ; ".join(item.fact for item in selected)
        + "."
    )


def reply(
    ctx: SessionContext,
    card: Card,
    history: list[Message],
    user_text: str,
    *,
    selected: list[CollectionItem] | None = None,
    picked: list[CollectionItem] | None = None,
    skip: bool = False,
) -> TurnReply:
    """What the AI answers to the young person's last message.

    `history` is the conversation of this card so far, without the new message.
    - mirror: the first call has no text and `selected` (even empty) = the
      cards he picked;
    - mirror: `picked` = the cards picked at the start, on every call (tells
      the model which ones come from the same story);
    - `skip`: he pressed "Passer" (new question on the same card).
    """
    is_mirror = card.format == _MIRROR_FORMAT
    if selected is not None and not user_text:
        user_text = pick_message(selected)
    if skip:
        user_text = _SKIP_MESSAGE

    # Failsafe: obvious distress never goes through the model
    if guards.looks_like_distress(user_text):
        return TurnReply(
            reply=guards.DISTRESS_MESSAGE, safety="distress", turn_ended=True
        )

    messages = [*history, Message(role="user", text=user_text)]
    exchanges = sum(1 for m in messages if m.role == "user")
    must_close = False if is_mirror else rules.turn_must_close(exchanges)
    streak = 0 if is_mirror else guards.trailing_dont_know(messages)

    blocks = context_blocks(ctx)
    if is_mirror:
        system = system_prompt(
            "mirror",
            turn_summaries=blocks["turn_summaries"],
            collection=blocks["collection"],
            constraints=blocks["constraints"],
            mirror_pick=_mirror_pick_note(selected, history, picked),
            exchanges=str(exchanges),
            situation_notes=_mirror_notes(exchanges),
        )
    else:
        system = system_prompt(
            "turn",
            card_title=card.title,
            level_note=level_note(card.level),
            intention=card.intention,
            talents=", ".join(card.talents)
            or "Pas de piste particulière : écoute ce qu'il fait.",
            exchanges=str(exchanges),
            min_exchanges=str(rules.MIN_EXCHANGES),
            max_exchanges=str(rules.MAX_EXCHANGES),
            situation_notes=_situation_notes(
                exchanges=exchanges,
                must_close=must_close,
                dont_know_streak=streak,
                skip=skip,
                first_card=not ctx.turn_summaries,
            ),
            **blocks,
        )

    def ask(extra_note: str = "") -> tuple[dict[str, Any], str]:
        data = complete_json(
            model=get_config().chat_model,
            system=f"{system}\n\n{extra_note}" if extra_note else system,
            messages=_as_chat(messages),
            temperature=0.7,
            max_tokens=350,
        )
        text = guards.clean_for_speech(str(data.get("reply", "")))
        if not text:
            raise LLMError("The model returned an empty reply.")
        return data, text

    data, text = ask()
    # He asked for another card (or said yes to the AI's proposal): always
    # honored, even before the minimum
    wants_new_card = (
        not is_mirror
        and not skip
        and (
            bool(data.get("wants_new_card")) or guards.asks_new_card(user_text)
        )
    )
    # Safety net for closed questions (docs/CARTES.md, RULES_V2.md): one
    # rewrite, then it goes as it is.
    # Not on a transition or a heavy subject, where a yes/no question is the
    # right one
    keeps_going = (
        not data.get("card_exhausted")
        and not wants_new_card
        and not must_close
        and str(data.get("safety", "none")) == "none"
    )
    if not is_mirror and keeps_going and not guards.hands_over(text):
        log.info("Dead-end reply rewritten: %r", text)
        data, text = ask(
            f"Attention : ta réponse précédente (« {text} ») ne lui redonnait "
            "pas la parole. Réécris-la pour qu'il ait envie de continuer : "
            "une question ouverte, une invitation (« Raconte-moi ça. ») ou "
            "ses mots en suspens (« Tout le week-end sur ce moteur… »)."
        )
    elif keeps_going and guards.is_closed_question(text):
        log.info("Closed question rewritten: %r", guards.last_question(text))
        data, text = ask(
            "Attention : ta réponse précédente finissait par « "
            f"{guards.last_question(text)} », une question fermée "
            "(il peut répondre par oui, non ou un mot). Réécris ta réponse "
            "avec une question ouverte qui le fait raconter : comment, "
            "qu'est-ce que, c'est quoi, raconte-moi."
        )

    safety = str(data.get("safety", "none"))
    if safety == "distress":
        # The model saw distress that the failsafe did not: same fixed text,
        # same end of game
        return TurnReply(
            reply=guards.DISTRESS_MESSAGE, safety="distress", turn_ended=True
        )

    exhausted = bool(data.get("card_exhausted"))
    if is_mirror:
        # The first user message of a mirror is the pick of cards: the
        # questions come after it
        ended = exhausted or exchanges >= rules.MIRROR_QUESTIONS + 1
        if ended:
            text = _with_mirror_closing(text)
    else:
        # An exhausted card is honored only once the minimum is reached, unless
        # the limit forces it
        ended = (
            (exhausted and exchanges >= rules.MIN_EXCHANGES)
            or wants_new_card
            or must_close
            or streak >= rules.DONT_KNOW_BEFORE_NEW_CARD
        )
        if ended:
            text = _with_transition(text)
    # Enthusiasm only while the card goes on and the subject is light; a
    # transition is said calmly
    # Never twice in a row: only enthusiastic replies keep their "!", so the
    # previous one tells
    previous = next(
        (m.text for m in reversed(history) if m.role == "assistant"), ""
    )
    enthusiastic = (
        str(data.get("tone")) == "enthusiastic"
        and safety == "none"
        and not ended
        and "!" not in previous
    )
    if not enthusiastic:
        # An exclamation mark would make the voice lively anyway: neutral
        # replies stay calm
        text = text.replace(" !", ".").replace("!", ".")
    return TurnReply(
        reply=text,
        safety="heavy" if safety == "heavy" else "none",
        turn_ended=ended,
        tone="enthusiastic" if enthusiastic else "neutral",
    )


def welcome_back(ctx: SessionContext) -> str:
    """One sentence to recognize a young person who comes back after a while.
    """
    fallback = (
        "Re ! Content de te revoir. On reprend où t'en étais, ou tu préfères "
        "partir sur autre chose ?"
    )
    if not ctx.turn_summaries and not ctx.collection:
        return fallback

    blocks = context_blocks(ctx)
    prompt = render(
        "welcome_back",
        turn_summaries=blocks["turn_summaries"],
        last_quote=last_quote(ctx) if ctx.collection else NOTHING_YET,
        constraints=blocks["constraints"],
    )
    try:
        text = complete(
            model=get_config().chat_model,
            system=prompt,
            messages=[{"role": "user", "content": "Il vient d'arriver."}],
            temperature=0.7,
            max_tokens=120,
        )
    except LLMError:
        log.exception(
            "Could not write the welcome back sentence, using the default one"
        )
        return fallback
    return guards.clean_for_speech(text) or fallback
