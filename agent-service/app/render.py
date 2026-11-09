"""Rendus de la reponse : JSON (source de verite), Markdown, PDF. Tous derives du MEME objet AgentResponse."""
from fpdf import FPDF

from app.schemas import AgentResponse

_LABEL = {"student": "Etudiant", "teacher": "Enseignant", "admin": "Administrateur"}
_STATUS = {
    "done": "effectuee",
    "denied": "refusee",
    "error": "en erreur",
    "needs_confirmation": "en attente de confirmation",
}


def to_markdown(r: AgentResponse) -> str:
    lines = [
        "# Reponse SmartCampus",
        "",
        f"**Profil** : {_LABEL[r.role]} - **Confiance** : {r.confidence}",
        "",
        r.answer,
        "",
    ]
    if r.actions:
        lines += ["## Actions"]
        lines += [f"- `{a.tool}` : {_STATUS[a.status]}" + (f" ({a.summary})" if a.summary else "") for a in r.actions]
        lines.append("")
    if r.sources:
        lines += ["## Sources", *(f"- {s}" for s in r.sources), ""]
    return "\n".join(lines)


def _latin1(text: str) -> str:
    # Les polices PDF standard sont en latin-1 (les accents francais passent) ; le reste est remplace, jamais d'erreur.
    return text.replace("’", "'").replace("—", "-").encode("latin-1", "replace").decode("latin-1")


def to_pdf(r: AgentResponse) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Reponse SmartCampus", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 8, _latin1(f"Profil : {_LABEL[r.role]} - Confiance : {r.confidence}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 11)
    pdf.multi_cell(0, 6, _latin1(r.answer), new_x="LMARGIN", new_y="NEXT")
    sections = (
        ("Actions", [f"{a.tool} : {_STATUS[a.status]}" for a in r.actions]),
        ("Sources", list(r.sources)),
    )
    for title, rows in sections:
        if rows:
            pdf.ln(4)
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 10)
            for row in rows:
                pdf.multi_cell(0, 5, _latin1(f"- {row}"), new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())
