from __future__ import annotations

from functools import partial
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.types import Overwrite, Send

from daog_agents.config import AppConfig
from daog_agents.logging import get_logger
from daog_agents.memory import LongTermMemory
from daog_agents.model_router import ModelRouter
from daog_agents.repository import RepositoryIndex
from daog_agents.state import AgentDispatch, AgentState


class AgentGraph:
    def __init__(
        self,
        config: AppConfig,
        model_router: ModelRouter,
        repository: RepositoryIndex,
        memory: LongTermMemory,
    ) -> None:
        self.config = config
        self.model_router = model_router
        self.repository = repository
        self.memory = memory
        self.log = get_logger()

    def build(self, checkpointer: Any) -> Any:
        builder = StateGraph(AgentState)
        builder.add_node("load_context", self.load_context)
        builder.add_node("supervisor", self.supervisor)
        builder.add_node("synthesize", self.synthesize)
        builder.add_node("remember", self.remember)

        for agent_name in self.config.agents.agents:
            builder.add_node(agent_name, partial(self.run_agent, agent_name))
            builder.add_edge(agent_name, "synthesize")

        builder.add_edge(START, "load_context")
        builder.add_edge("load_context", "supervisor")
        builder.add_conditional_edges("supervisor", self.dispatch)
        builder.add_edge("synthesize", "remember")
        builder.add_edge("remember", END)
        return builder.compile(checkpointer=checkpointer)

    async def load_context(self, state: AgentState) -> dict[str, str]:
        request = state["request"]
        settings = self.config.agents.settings
        memory_context = self.memory.recall(
            state.get("user_id", "default"),
            request,
            max_chars=settings.memory_context_chars,
        )
        project_context = self.repository.context_for(
            request,
            max_chars=settings.repository_context_chars,
        )
        return {"memory_context": memory_context, "project_context": project_context}

    def supervisor(self, state: AgentState) -> dict[str, Any]:
        request = state["request"].lower()
        scores: list[tuple[int, str]] = []
        for name, spec in self.config.agents.agents.items():
            score = sum(1 for keyword in spec.keywords if keyword.lower() in request)
            scores.append((score, name))
        scores.sort(key=lambda item: (-item[0], item[1]))

        positive = [(score, name) for score, name in scores if score > 0]
        if not positive:
            selected = ["architect"]
            reason = "No specialist keyword matched; routed to architect."
        else:
            max_agents = self.config.agents.settings.max_parallel_agents
            selected = [name for _, name in positive[:max_agents]]
            reason = "Matched: " + ", ".join(
                f"{name}({score})" for score, name in positive[:max_agents]
            )
        primary_task = self.config.agents.agents[selected[0]].task_type
        self.log.info("agents_selected", agents=selected, reason=reason)
        return {
            "selected_agents": selected,
            "task_type": primary_task,
            "route_reason": reason,
            "agent_results": Overwrite({}),
            "model_usage": Overwrite({}),
        }

    def dispatch(self, state: AgentState) -> list[Send]:
        return [
            Send(
                agent_name,
                AgentDispatch(
                    request=state["request"],
                    user_id=state.get("user_id", "default"),
                    thread_id=state.get("thread_id", "default"),
                    task_type=self.config.agents.agents[agent_name].task_type,
                    memory_context=state.get("memory_context", ""),
                    project_context=state.get("project_context", ""),
                    active_agent=agent_name,
                ),
            )
            for agent_name in state["selected_agents"]
        ]

    async def run_agent(self, agent_name: str, state: AgentDispatch) -> dict[str, dict[str, str]]:
        spec = self.config.agents.agents[agent_name]
        context = state.get("project_context") or "(No repository context matched.)"
        memory = state.get("memory_context") or "(No relevant long-term memory.)"
        prompt = (
            f"User request:\n{state['request']}\n\n"
            f"Relevant prior memory:\n{memory}\n\n"
            f"Relevant repository context:\n{context}\n\n"
            "Return a concise, implementation-ready response. Distinguish facts from assumptions."
        )
        response = await self.model_router.ainvoke(
            spec.task_type,
            [SystemMessage(content=spec.system_prompt), HumanMessage(content=prompt)],
        )
        return {
            "agent_results": {agent_name: response.text},
            "model_usage": {agent_name: response.model_alias},
        }

    async def synthesize(self, state: AgentState) -> dict[str, Any]:
        results = state.get("agent_results", {})
        if not results:
            return {"final_response": "No agent produced a response."}
        if len(results) == 1 and self.config.agents.settings.single_agent_direct_response:
            return {"final_response": next(iter(results.values()))}

        joined = "\n\n".join(f"## {name}\n{text}" for name, text in results.items())
        response = await self.model_router.ainvoke(
            "synthesis",
            [
                SystemMessage(
                    content=(
                        "You are the lead agent. Merge specialist outputs into one concise, "
                        "consistent answer. Resolve conflicts and remove repetition."
                    )
                ),
                HumanMessage(content=f"Request:\n{state['request']}\n\nOutputs:\n{joined}"),
            ],
        )
        usage = dict(state.get("model_usage", {}))
        usage["synthesis"] = response.model_alias
        return {"final_response": response.text, "model_usage": usage}

    def remember(self, state: AgentState) -> dict[str, str]:
        self.memory.remember(
            user_id=state.get("user_id", "default"),
            thread_id=state.get("thread_id", "default"),
            request=state["request"],
            response=state["final_response"],
        )
        return {}
