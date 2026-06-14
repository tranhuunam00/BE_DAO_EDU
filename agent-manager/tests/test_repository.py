from pathlib import Path

from daog_agents.repository import RepositoryIndex


def test_repository_context_prefers_matching_file(tmp_path: Path) -> None:
    (tmp_path / "backend.ts").write_text("TypeORM payment controller", encoding="utf-8")
    (tmp_path / "frontend.tsx").write_text("React student profile", encoding="utf-8")
    index = RepositoryIndex(tmp_path)
    index.refresh()

    context = index.context_for("fix TypeORM payment", max_chars=1000)

    assert "backend.ts" in context
    assert "payment controller" in context


def test_repository_context_returns_manifest_without_match(tmp_path: Path) -> None:
    (tmp_path / "backend.ts").write_text("controller", encoding="utf-8")
    (tmp_path / "frontend.tsx").write_text("component", encoding="utf-8")
    index = RepositoryIndex(tmp_path)
    index.refresh()

    context = index.context_for("zzzz-unmatched", max_chars=1000)

    assert "Repository files:" in context
    assert "backend.ts" in context
