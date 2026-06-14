from pathlib import Path

from daog_agents.memory import LongTermMemory


def test_memory_recalls_relevant_history(tmp_path: Path) -> None:
    memory = LongTermMemory(tmp_path / "memory.sqlite")
    memory.remember("u1", "t1", "Fix tuition payment", "Updated payment period logic")
    memory.remember("u1", "t2", "Change login color", "Updated CSS")

    result = memory.recall("u1", "payment tuition")

    assert "tuition payment" in result
    memory.close()

