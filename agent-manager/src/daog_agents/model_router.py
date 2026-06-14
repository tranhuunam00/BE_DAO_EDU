from __future__ import annotations

import asyncio
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage

from daog_agents.config import ModelsConfig, ModelSpec
from daog_agents.logging import get_logger

ModelFactory = Callable[[ModelSpec], BaseChatModel]


@dataclass(frozen=True)
class ModelResponse:
    message: BaseMessage
    model_alias: str
    attempts: int

    @property
    def text(self) -> str:
        content = self.message.content
        if isinstance(content, str):
            return content
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                parts.append(str(block.get("text") or block.get("content") or ""))
            else:
                parts.append(str(block))
        return "\n".join(part for part in parts if part)


class AllModelsFailedError(RuntimeError):
    pass


class ModelRouter:
    def __init__(
        self,
        config: ModelsConfig,
        model_factory: ModelFactory | None = None,
        sleep: Callable[[float], Any] = asyncio.sleep,
    ) -> None:
        self.config = config
        self._factory = model_factory or self._default_factory
        self._sleep = sleep
        self._clients: dict[str, BaseChatModel] = {}
        self.log = get_logger()

    @staticmethod
    def _default_factory(spec: ModelSpec) -> BaseChatModel:
        kwargs = {
            "model": spec.model,
            "model_provider": spec.provider,
            "temperature": spec.temperature,
            **spec.options,
        }
        if spec.max_tokens is not None:
            kwargs["max_tokens"] = spec.max_tokens
        return init_chat_model(**kwargs)

    def aliases_for(self, task_type: str) -> list[str]:
        return self.config.task_routes.get(
            task_type,
            self.config.task_routes["default"],
        )

    def _client(self, alias: str) -> BaseChatModel:
        if alias not in self._clients:
            self._clients[alias] = self._factory(self.config.models[alias])
        return self._clients[alias]

    async def ainvoke(
        self,
        task_type: str,
        messages: Sequence[BaseMessage],
    ) -> ModelResponse:
        errors: list[str] = []
        total_attempts = 0

        for alias in self.aliases_for(task_type):
            delay = self.config.retry.initial_delay_seconds
            for attempt in range(1, self.config.retry.attempts_per_model + 1):
                total_attempts += 1
                try:
                    self.log.info(
                        "model_call_started",
                        task_type=task_type,
                        model_alias=alias,
                        attempt=attempt,
                    )
                    response = await self._client(alias).ainvoke(list(messages))
                    self.log.info(
                        "model_call_succeeded",
                        task_type=task_type,
                        model_alias=alias,
                        attempt=attempt,
                        usage=getattr(response, "usage_metadata", None),
                    )
                    return ModelResponse(response, alias, total_attempts)
                except Exception as exc:
                    errors.append(f"{alias} attempt {attempt}: {exc}")
                    self.log.warning(
                        "model_call_failed",
                        task_type=task_type,
                        model_alias=alias,
                        attempt=attempt,
                        error=str(exc),
                    )
                    if attempt < self.config.retry.attempts_per_model:
                        await self._sleep(delay)
                        delay *= self.config.retry.backoff_multiplier

            self.log.warning("model_fallback", task_type=task_type, failed_alias=alias)

        raise AllModelsFailedError("; ".join(errors))
