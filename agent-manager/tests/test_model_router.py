from langchain_core.messages import AIMessage, HumanMessage

from daog_agents.config import ModelSpec, ModelsConfig, RetryConfig
from daog_agents.model_router import ModelRouter


class FakeModel:
    def __init__(self, outcomes):
        self.outcomes = iter(outcomes)

    async def ainvoke(self, _messages):
        outcome = next(self.outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return AIMessage(content=outcome)


async def test_retries_then_uses_fallback() -> None:
    config = ModelsConfig(
        models={
            "primary": ModelSpec(provider="fake", model="primary"),
            "fallback": ModelSpec(provider="fake", model="fallback"),
        },
        task_routes={"default": ["primary", "fallback"]},
        retry=RetryConfig(attempts_per_model=2, initial_delay_seconds=0),
    )
    clients = {
        "primary": FakeModel([RuntimeError("down"), RuntimeError("still down")]),
        "fallback": FakeModel(["ok"]),
    }
    router = ModelRouter(
        config,
        model_factory=lambda spec: clients[spec.model],
        sleep=lambda _: _noop(),
    )

    result = await router.ainvoke("unknown", [HumanMessage(content="hello")])

    assert result.message.content == "ok"
    assert result.model_alias == "fallback"
    assert result.attempts == 3


async def _noop() -> None:
    return None

