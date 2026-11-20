"""The numbers of the game, in one place, to tune after the tests.

The first ones come from docs/RULES.md. The mirror ones are first guesses:
nobody has decided yet.
"""

# On a card, in exchanges: at least 3 before moving on (unless the young person
# asks).
# RULES.md says 10 at most, but the first real test went round in circles: 6 at
# most, and from
# the 4th the AI is pushed to move on unless the young person brings something
# new.
MIN_EXCHANGES = 3
SOFT_CLOSE_EXCHANGES = 4
MAX_EXCHANGES = 6

# The mirror is short: the pick of cards, then two or three questions.
MIRROR_QUESTIONS = 3

# A card keeps one or two things at most, otherwise it turns into flattery.
MAX_ENTRIES_PER_TURN = 2

# When does the backend impose the mirror card? To tune after the tests.
MIRROR_MIN_TURNS = 4
MIRROR_MAX_MINUTES = 25

# After this many "je sais pas" in a row, the AI suggests another card.
DONT_KNOW_BEFORE_NEW_CARD = 2


def should_trigger_mirror(turns_played: int, elapsed_minutes: float) -> bool:
    """True when the backend should send the mirror card alone at the next
    draw.
    """
    return (
        turns_played >= MIRROR_MIN_TURNS
        or elapsed_minutes >= MIRROR_MAX_MINUTES
    )


def turn_must_close(exchanges: int) -> bool:
    """True when the card has gone on long enough that the AI must propose
    another one.
    """
    return exchanges >= MAX_EXCHANGES
