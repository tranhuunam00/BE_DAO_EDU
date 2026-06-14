from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, model_validator

_ENV_PATTERN = re.compile(r"\$\{([A-Z0-9_]+)(?::-([^}]*))?\}")


class ModelSpec(BaseModel):
    provider: str
    model: str
    temperature: float = 0
    max_tokens: int | None = None
    options: dict[str, Any] = Field(default_factory=dict)


class RetryConfig(BaseModel):
    attempts_per_model: int = Field(default=2, ge=1, le=5)
    initial_delay_seconds: float = Field(default=0.5, ge=0)
    backoff_multiplier: float = Field(default=2.0, ge=1)


class ModelsConfig(BaseModel):
    models: dict[str, ModelSpec]
    task_routes: dict[str, list[str]]
    retry: RetryConfig = Field(default_factory=RetryConfig)

    @model_validator(mode="after")
    def validate_routes(self) -> "ModelsConfig":
        for task, aliases in self.task_routes.items():
            unknown = set(aliases) - self.models.keys()
            if unknown:
                raise ValueError(f"Task route '{task}' references unknown models: {unknown}")
        if "default" not in self.task_routes:
            raise ValueError("task_routes.default is required")
        return self


class AgentSpec(BaseModel):
    task_type: str
    description: str
    keywords: list[str] = Field(default_factory=list)
    system_prompt: str


class AgentSettings(BaseModel):
    max_parallel_agents: int = Field(default=2, ge=1, le=8)
    repository_context_chars: int = Field(default=12000, ge=1000)
    memory_context_chars: int = Field(default=4000, ge=500)
    single_agent_direct_response: bool = True


class AgentsConfig(BaseModel):
    settings: AgentSettings = Field(default_factory=AgentSettings)
    agents: dict[str, AgentSpec]


class AppConfig(BaseModel):
    models: ModelsConfig
    agents: AgentsConfig


def _expand_env(value: Any) -> Any:
    if isinstance(value, str):
        return _ENV_PATTERN.sub(
            lambda match: os.getenv(match.group(1), match.group(2) or ""),
            value,
        )
    if isinstance(value, list):
        return [_expand_env(item) for item in value]
    if isinstance(value, dict):
        return {key: _expand_env(item) for key, item in value.items()}
    return value


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    return _expand_env(data)


def load_config(config_dir: Path) -> AppConfig:
    models = ModelsConfig.model_validate(_load_yaml(config_dir / "models.yaml"))
    agents = AgentsConfig.model_validate(_load_yaml(config_dir / "agents.yaml"))
    return AppConfig(models=models, agents=agents)

