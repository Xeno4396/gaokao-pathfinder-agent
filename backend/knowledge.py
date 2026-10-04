from __future__ import annotations

import json
import re
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

from .config import Settings
from .models import CandidateProfile, KnowledgeSource


class KnowledgeStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.path = settings.database_path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        entries = json.loads(self.settings.knowledge_path.read_text(encoding="utf-8"))
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    profile_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS knowledge (
                    id TEXT PRIMARY KEY,
                    institution TEXT NOT NULL,
                    region TEXT NOT NULL,
                    category TEXT NOT NULL,
                    title TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    source_url TEXT NOT NULL,
                    source_name TEXT NOT NULL,
                    published_at TEXT,
                    verified_at TEXT NOT NULL,
                    effective_period TEXT,
                    tags_json TEXT NOT NULL,
                    search_text TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(id UNINDEXED, search_text, tokenize='unicode61')"
            )
            connection.execute("DELETE FROM knowledge_fts")
            for entry in entries:
                tags = entry.get("tags", [])
                search_text = " ".join(
                    [entry["institution"], entry["region"], entry["category"], entry["title"], entry["summary"], *tags]
                )
                values = (
                    entry["id"], entry["institution"], entry["region"], entry["category"], entry["title"],
                    entry["summary"], entry["source_url"], entry["source_name"], entry.get("published_at"),
                    entry["verified_at"], entry.get("effective_period"), json.dumps(tags, ensure_ascii=False), search_text,
                )
                connection.execute(
                    """
                    INSERT INTO knowledge VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      institution=excluded.institution, region=excluded.region, category=excluded.category,
                      title=excluded.title, summary=excluded.summary, source_url=excluded.source_url,
                      source_name=excluded.source_name, published_at=excluded.published_at,
                      verified_at=excluded.verified_at, effective_period=excluded.effective_period,
                      tags_json=excluded.tags_json, search_text=excluded.search_text
                    """,
                    values,
                )
                connection.execute("INSERT INTO knowledge_fts(id, search_text) VALUES (?, ?)", (entry["id"], search_text))

    def count(self) -> int:
        with self._connect() as connection:
            return int(connection.execute("SELECT COUNT(*) FROM knowledge").fetchone()[0])

    def load_profile(self, session_id: str) -> Optional[CandidateProfile]:
        with self._connect() as connection:
            row = connection.execute("SELECT profile_json FROM sessions WHERE id = ?", (session_id,)).fetchone()
        return CandidateProfile.model_validate_json(row[0]) if row else None

    def save_profile(self, session_id: str, profile: CandidateProfile) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                INSERT INTO sessions(id, profile_json, updated_at) VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET profile_json=excluded.profile_json, updated_at=excluded.updated_at
                """,
                (session_id, profile.model_dump_json(), now),
            )

    @staticmethod
    def _to_source(row: sqlite3.Row) -> KnowledgeSource:
        data = dict(row)
        data["tags"] = json.loads(data.pop("tags_json"))
        data.pop("search_text", None)
        return KnowledgeSource.model_validate(data)

    def get(self, source_id: str) -> Optional[KnowledgeSource]:
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM knowledge WHERE id = ?", (source_id,)).fetchone()
        return self._to_source(row) if row else None

    def search(
        self,
        profile: CandidateProfile,
        schools: Sequence[str] = (),
        limit: int = 8,
    ) -> List[KnowledgeSource]:
        terms = list(schools[:10]) + profile.preferred_regions + profile.major_categories + profile.specific_majors + profile.career_preferences
        terms = list(dict.fromkeys(term.strip() for term in terms if term.strip()))
        if not terms:
            return []

        scores: Dict[str, int] = {}
        fts_ids = set()
        with self._connect() as connection:
            query_terms = [term.replace('"', '""') for term in terms if len(term) >= 2]
            if query_terms:
                query = " OR ".join(f'"{term}"' for term in query_terms)
                try:
                    fts_ids = {
                        row["id"]
                        for row in connection.execute(
                            "SELECT id FROM knowledge_fts WHERE knowledge_fts MATCH ? LIMIT 40",
                            (query,),
                        ).fetchall()
                    }
                except sqlite3.OperationalError:
                    fts_ids = set()
            rows = connection.execute("SELECT * FROM knowledge").fetchall()
        for row in rows:
            haystack = row["search_text"].lower()
            score = 2 if row["id"] in fts_ids else 0
            for term in terms:
                if term.lower() in haystack:
                    score += 8 if term == row["institution"] else 3
            if row["institution"] in schools:
                score += 12
            if row["region"] in profile.preferred_regions:
                score += 5
            if score:
                scores[row["id"]] = score

        ranked = sorted((row for row in rows if row["id"] in scores), key=lambda row: (-scores[row["id"]], row["institution"]))
        return [self._to_source(row) for row in ranked[:limit]]

