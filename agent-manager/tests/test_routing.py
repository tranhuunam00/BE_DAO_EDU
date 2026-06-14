from pathlib import Path

from daog_agents.config import load_config
from daog_agents.graph import AgentGraph


class StubRepository:
    pass


class StubMemory:
    pass


class StubRouter:
    pass


def build_graph() -> AgentGraph:
    config = load_config(Path(__file__).parents[1] / "config")
    return AgentGraph(config, StubRouter(), StubRepository(), StubMemory())


def test_supervisor_routes_review_to_specialist_pair() -> None:
    graph = build_graph()

    result = graph.supervisor({"request": "Review backend contract"})

    assert len(result["selected_agents"]) == 2
    assert "backend" in result["selected_agents"]
    assert "reviewer" in result["selected_agents"]


def test_supervisor_defaults_to_architect() -> None:
    graph = build_graph()

    result = graph.supervisor({"request": "Help me think through this change"})

    assert result["selected_agents"] == ["architect"]
