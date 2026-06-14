from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from daog_agents.logging import get_logger

SOURCE_SUFFIXES = {
    ".cjs",
    ".css",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".ts",
    ".tsx",
    ".yaml",
    ".yml",
}
IGNORED_PARTS = {
    ".git",
    ".venv",
    "coverage",
    "data",
    "dist",
    "logs",
    "node_modules",
}
WORD_PATTERN = re.compile(r"[A-Za-zÀ-ỹ0-9_/-]{2,}")


@dataclass(frozen=True)
class SourceDocument:
    path: str
    content: str
    terms: frozenset[str]


class RepositoryIndex:
    """Small local lexical index; it avoids an embedding call for every request."""

    def __init__(self, root: Path, max_file_bytes: int = 500_000) -> None:
        self.root = root.resolve()
        self.max_file_bytes = max_file_bytes
        self.documents: list[SourceDocument] = []
        self.log = get_logger()

    def refresh(self) -> int:
        documents: list[SourceDocument] = []
        for path in sorted(self.root.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in SOURCE_SUFFIXES:
                continue
            if any(part in IGNORED_PARTS for part in path.parts):
                continue
            try:
                if path.stat().st_size > self.max_file_bytes:
                    continue
                content = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            relative = path.relative_to(self.root).as_posix()
            terms = frozenset(word.lower() for word in WORD_PATTERN.findall(relative + content))
            documents.append(SourceDocument(relative, content, terms))
        self.documents = documents
        self.log.info("repository_index_refreshed", files=len(documents), root=str(self.root))
        return len(documents)

    def context_for(self, query: str, max_chars: int) -> str:
        if not self.documents:
            self.refresh()
        query_terms = {word.lower() for word in WORD_PATTERN.findall(query)}

        def score(document: SourceDocument) -> int:
            return len(query_terms & document.terms) * 10 + sum(
                4 for term in query_terms if term in document.path.lower()
            )

        ranked = sorted(
            self.documents,
            key=score,
            reverse=True,
        )
        if not ranked or score(ranked[0]) == 0:
            manifest = "Repository files:\n" + "\n".join(
                document.path for document in self.documents
            )
            return manifest[:max_chars]

        chunks: list[str] = []
        used = 0
        for document in ranked:
            if chunks and score(document) == 0:
                break
            excerpt = self._excerpt(document.content, query_terms, min(3000, max_chars - used))
            chunk = f"\n### {document.path}\n{excerpt}"
            if used + len(chunk) > max_chars:
                break
            chunks.append(chunk)
            used += len(chunk)
            if used >= max_chars:
                break
        return "".join(chunks).strip()

    @staticmethod
    def _excerpt(content: str, query_terms: set[str], limit: int) -> str:
        if len(content) <= limit:
            return content
        lowered = content.lower()
        positions = [lowered.find(term) for term in query_terms if lowered.find(term) >= 0]
        center = min(positions) if positions else 0
        start = max(0, center - limit // 4)
        end = min(len(content), start + limit)
        return content[start:end]
