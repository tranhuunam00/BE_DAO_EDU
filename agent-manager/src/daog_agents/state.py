from __future__ import annotations

from operator import or_
from typing import Annotated, TypedDict


class AgentState(TypedDict, total=False):
    request: str
    user_id: str
    thread_id: str
    task_type: str
    selected_agents: list[str]
    route_reason: str
    memory_context: str
    project_context: str
    active_agent: str
    agent_results: Annotated[dict[str, str], or_]
    model_usage: Annotated[dict[str, str], or_]
    final_response: str


class AgentDispatch(TypedDict):
    request: str
    user_id: str
    thread_id: str
    task_type: str
    memory_context: str
    project_context: str
    active_agent: str

