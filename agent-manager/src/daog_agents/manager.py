from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from daog_agents.config import AppConfig, load_config
from daog_agents.graph import AgentGraph
from daog_agents.logging import configure_logging, get_logger
from daog_agents.memory import LongTermMemory
from daog_agents.model_router import ModelRouter
from daog_agents.repository import RepositoryIndex


class AgentManager:
    def __init__(
        self,
        project_root: Path | None = None,
        config_dir: Path | None = None,
        data_dir: Path | None = None,
        model_router: ModelRouter | None = None,
    ) -> None:
        package_root = Path(__file__).resolve().parents[2]
        workspace_root = package_root.parent.parent
        self.project_root = (project_root or workspace_root).resolve()
        self.config_dir = (config_dir or package_root / "config").resolve()
        self.data_dir = (data_dir or package_root / "data").resolve()
        load_dotenv(package_root / ".env")
        configure_logging(package_root / "logs")

        self.config: AppConfig = load_config(self.config_dir)
        self.repository = RepositoryIndex(self.project_root)
        self.repository.refresh()
        self.memory = LongTermMemory(self.data_dir / "memory.sqlite")
        self.model_router = model_router or ModelRouter(self.config.models)
        self.graph_builder = AgentGraph(
            self.config, self.model_router, self.repository, self.memory
        )
        self.graph: Any | None = None
        self.checkpointer: AsyncSqliteSaver | None = None
        self._checkpointer_context: Any | None = None
        self._init_lock = asyncio.Lock()
        self.log = get_logger()

    async def _ensure_graph(self) -> None:
        if self.graph is not None:
            return
        async with self._init_lock:
            if self.graph is not None:
                return
            os.environ.setdefault("LANGGRAPH_STRICT_MSGPACK", "true")
            checkpoint_path = str(self.data_dir / "checkpoints.sqlite")
            self._checkpointer_context = AsyncSqliteSaver.from_conn_string(checkpoint_path)
            self.checkpointer = await self._checkpointer_context.__aenter__()
            self.graph = self.graph_builder.build(self.checkpointer)

    async def run(
        self,
        request: str,
        thread_id: str = "default",
        user_id: str = "default",
    ) -> dict[str, Any]:
        await self._ensure_graph()
        self.log.info("run_started", thread_id=thread_id, user_id=user_id)
        result = await self.graph.ainvoke(
            {
                "request": request,
                "thread_id": thread_id,
                "user_id": user_id,
            },
            {"configurable": {"thread_id": thread_id}},
        )
        self.log.info(
            "run_completed",
            thread_id=thread_id,
            agents=result.get("selected_agents", []),
            models=result.get("model_usage", {}),
        )
        return {
            "response": result["final_response"],
            "agents": result.get("selected_agents", []),
            "models": result.get("model_usage", {}),
            "route_reason": result.get("route_reason", ""),
        }

    async def aclose(self) -> None:
        if self._checkpointer_context is not None:
            await self._checkpointer_context.__aexit__(None, None, None)
            self._checkpointer_context = None
            self.checkpointer = None
            self.graph = None
        self.memory.close()
