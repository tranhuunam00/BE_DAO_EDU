from __future__ import annotations

import re
import sqlite3
import threading
import time
import uuid
from pathlib import Path

WORD_PATTERN = re.compile(r"[A-Za-zÀ-ỹ0-9_]{2,}")


class LongTermMemory:
    def __init__(self, database_path: Path) -> None:
        database_path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(database_path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self.connection:
            self.connection.execute(
                """
                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    thread_id TEXT NOT NULL,
                    request TEXT NOT NULL,
                    response TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
                """
            )
            self.connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_memories_user_time "
                "ON memories(user_id, created_at DESC)"
            )

    def remember(
        self,
        user_id: str,
        thread_id: str,
        request: str,
        response: str,
    ) -> None:
        with self._lock, self.connection:
            self.connection.execute(
                "INSERT INTO memories VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), user_id, thread_id, request, response[:6000], time.time()),
            )

    def recall(self, user_id: str, query: str, limit: int = 5, max_chars: int = 4000) -> str:
        with self._lock:
            rows = self.connection.execute(
                "SELECT request, response, created_at FROM memories "
                "WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
                (user_id,),
            ).fetchall()
        query_terms = {word.lower() for word in WORD_PATTERN.findall(query)}
        scored = []
        for row in rows:
            text = f"{row['request']} {row['response']}"
            terms = {word.lower() for word in WORD_PATTERN.findall(text)}
            scored.append((len(query_terms & terms), row["created_at"], row))
        scored.sort(reverse=True, key=lambda item: (item[0], item[1]))

        chunks: list[str] = []
        used = 0
        for _, _, row in scored[:limit]:
            chunk = f"Request: {row['request']}\nOutcome: {row['response']}\n"
            if used + len(chunk) > max_chars:
                break
            chunks.append(chunk)
            used += len(chunk)
        return "\n".join(chunks)

    def close(self) -> None:
        self.connection.close()

