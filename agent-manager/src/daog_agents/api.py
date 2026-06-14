from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel, Field

from daog_agents.manager import AgentManager


class RunRequest(BaseModel):
    message: str = Field(min_length=1)
    thread_id: str = "default"
    user_id: str = "default"


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.manager = AgentManager()
    yield
    await app.state.manager.aclose()


app = FastAPI(title="DAO EDU Agent Manager", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/agents/run")
async def run_agent(payload: RunRequest) -> dict:
    return await app.state.manager.run(
        payload.message,
        thread_id=payload.thread_id,
        user_id=payload.user_id,
    )
