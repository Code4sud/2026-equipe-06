"""Turns the context of a session into the French text that goes into the prompts."""

from .models import CollectionItem, Report, SessionContext, TurnSummary

NOTHING_YET = "Rien pour l'instant."

# From 6 up, an aptitude is a strong point; from 4 down, a weak one. The scale goes from 0 to 8.
_STRONG, _WEAK = 6, 4


def format_report(report: Report | None) -> str:
    """The report as hypotheses: what seems to suit the person, never scores to quote."""
    if report is None:
        return "Pas de rapport pour ce jeune."

    lines = []
    if report.interests:
        lines.append("Ce qui l'attire le plus, du plus au moins marqué : " + ", ".join(report.interests) + ".")
    strong = [name for name, score in report.aptitudes.items() if score >= _STRONG]
    if strong:
        lines.append("Points d'appui probables : " + ", ".join(strong) + ".")
    weak = [name for name, score in report.aptitudes.items() if score <= _WEAK]
    if weak:
        lines.append(
            "Moins à l'aise le jour du test : " + ", ".join(weak) + ". "
            "C'est une photo d'un jour (fatigue, stress), jamais à utiliser contre lui ni à lui dire."
        )
    if report.personality:
        lines.append("Traits de personnalité, du plus au moins marqué : " + ", ".join(report.personality) + ".")
    jobs = [job for zone in sorted(report.jobs_by_zone) for job in report.jobs_by_zone[zone]]
    if jobs:
        lines.append("Métiers suggérés par le rapport (des pistes, pas des conseils) : " + ", ".join(jobs) + ".")
    return "\n".join(lines) if lines else "Rapport vide."


def format_turn_summaries(summaries: list[TurnSummary]) -> str:
    if not summaries:
        return NOTHING_YET
    return "\n".join(f"- Carte « {s.card_title} » : {s.summary}" for s in summaries)


def format_items(items: list[CollectionItem]) -> str:
    """The kept entries: the fact, and the sentence it comes from."""
    if not items:
        return NOTHING_YET
    return "\n".join(f"- {i.fact} (il a dit : « {i.quote} »)" for i in items)


def format_constraints(constraints: list[str]) -> str:
    if not constraints:
        return "Rien."
    return "\n".join(f"- « {c} »" for c in constraints)


def last_quote(ctx: SessionContext) -> str:
    return ctx.collection[-1].quote if ctx.collection else NOTHING_YET


def context_blocks(ctx: SessionContext) -> dict[str, str]:
    """The pieces of context shared by most prompts, ready to fill their placeholders."""
    return {
        "turn_summaries": format_turn_summaries(ctx.turn_summaries),
        "collection": format_items(ctx.collection),
        "constraints": format_constraints(ctx.declared_constraints),
        "report": format_report(ctx.report),
    }
