"""Base de connaissances (RAG) filtree par ROLE.

Le filtre d'audience est applique AVANT la recherche, dans le code : un etudiant ne peut jamais recevoir un extrait
reserve a l'administration, quelle que soit la question ou la manipulation du modele.
Recherche BM25 (lexicale, sans service externe). Interface stable : remplacable par des embeddings + Qdrant plus tard.
"""
import math
import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.schemas import Role

KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"
STOPWORDS = frozenset(
    "le la les un une des de du et en au aux a est que qui pour par sur dans ce ces mon ma mes je tu il elle on "
    "nous vous ils elles ou ne pas se sa son ses leur leurs avec sans sous plus moins tres "
    "comment combien quel quelle quels quelles quand pourquoi faut faire peut peux puis dois doit dit est-ce "
    "y a ai ont etre avoir cest jai quoi donc mais ni car si".split()
)


def _stem(token: str) -> str:
    """Racinisation francaise grossiere (pluriels + prefixe de 6 lettres) : 'emprunter', 'empruntes' -> 'emprun'."""
    if len(token) > 3 and token[-1] in "sx":
        token = token[:-1]
    return token[:6]


def _tokens(text: str) -> list[str]:
    plain = unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode()
    return [_stem(t) for t in re.findall(r"[a-z0-9]+", plain) if t not in STOPWORDS and len(t) > 1]


@dataclass(frozen=True)
class Chunk:
    source: str
    audience: frozenset[str]
    text: str
    tokens: tuple[str, ...]


def _parse(path: Path) -> list[Chunk]:
    raw = path.read_text(encoding="utf-8")
    meta: dict[str, str] = {}
    body = raw
    if raw.startswith("---"):
        _, header, body = raw.split("---", 2)
        meta = dict(line.split(":", 1) for line in header.strip().splitlines() if ":" in line)
    title = meta.get("title", path.stem).strip()
    # Audience absente = la plus restrictive (admin seulement).
    audience = frozenset(a.strip() for a in meta.get("audience", "admin").split(",") if a.strip())
    chunks = []
    for section in re.split(r"^## ", body, flags=re.MULTILINE)[1:]:
        heading, _, content = section.partition("\n")
        text = content.strip()
        if text:
            chunks.append(Chunk(f"{title} > {heading.strip()}", audience, text, tuple(_tokens(f"{heading} {text}"))))
    return chunks


class KnowledgeBase:
    def __init__(self, chunks: list[Chunk]) -> None:
        self._chunks = chunks

    @classmethod
    def from_dir(cls, directory: Path = KNOWLEDGE_DIR) -> "KnowledgeBase":
        if not directory.exists():
            return cls([])
        return cls([c for p in sorted(directory.glob("*.md")) for c in _parse(p)])

    def search(self, query: str, role: Role, k: int = 3) -> list[dict[str, str]]:
        visible = [c for c in self._chunks if role in c.audience]  # FILTRE PAR ROLE, avant tout calcul
        q = _tokens(query)
        if not visible or not q:
            return []
        n = len(visible)
        avg = sum(len(c.tokens) for c in visible) / n
        scored: list[tuple[float, Chunk]] = []
        for c in visible:
            score = 0.0
            for term in set(q):
                tf = c.tokens.count(term)
                if tf:
                    df = sum(term in d.tokens for d in visible)
                    idf = math.log(1 + (n - df + 0.5) / (df + 0.5))
                    score += idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * len(c.tokens) / avg))
            if score > 0:
                scored.append((score, c))
        scored.sort(key=lambda s: -s[0])
        return [{"source": c.source, "text": c.text} for _, c in scored[:k]]


@lru_cache
def get_knowledge() -> KnowledgeBase:
    return KnowledgeBase.from_dir()
