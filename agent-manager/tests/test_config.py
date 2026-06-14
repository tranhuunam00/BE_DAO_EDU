from pathlib import Path

from daog_agents.config import load_config


def test_loads_model_and_agent_routes(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_FAST_MODEL", "test-fast")
    config = load_config(Path(__file__).parents[1] / "config")

    assert config.models.models["fast"].model == "test-fast"
    assert config.models.task_routes["backend"][0] == "balanced"
    assert config.agents.agents["backend"].task_type == "backend"

