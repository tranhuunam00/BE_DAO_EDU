from __future__ import annotations

import asyncio
import json
from pathlib import Path

import typer

from daog_agents.manager import AgentManager

app = typer.Typer(help="DAO EDU LangGraph multi-agent manager")


@app.command()
def run(
    message: str = typer.Argument(..., help="Task for the agent team"),
    thread_id: str = typer.Option("default", help="Conversation/checkpoint id"),
    user_id: str = typer.Option("default", help="Long-term memory namespace"),
    project_root: Path | None = typer.Option(None, exists=True, file_okay=False),
) -> None:
    async def execute() -> None:
        manager = AgentManager(project_root=project_root)
        try:
            result = await manager.run(message, thread_id=thread_id, user_id=user_id)
            typer.echo(json.dumps(result, ensure_ascii=False, indent=2))
        finally:
            await manager.aclose()

    asyncio.run(execute())


@app.command()
def index(
    project_root: Path | None = typer.Option(None, exists=True, file_okay=False),
) -> None:
    async def execute() -> None:
        manager = AgentManager(project_root=project_root)
        try:
            count = manager.repository.refresh()
            typer.echo(f"Indexed {count} source files from {manager.project_root}")
        finally:
            await manager.aclose()

    asyncio.run(execute())


@app.command("models")
def list_models() -> None:
    async def execute() -> None:
        manager = AgentManager()
        try:
            for task, aliases in manager.config.models.task_routes.items():
                typer.echo(f"{task}: {' -> '.join(aliases)}")
        finally:
            await manager.aclose()

    asyncio.run(execute())


if __name__ == "__main__":
    app()
