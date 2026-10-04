from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    root: Path = ROOT
    data_dir: Path = ROOT / "data"
    knowledge_path: Path = ROOT / "data" / "knowledge-base.json"
    rank_path: Path = ROOT / "data" / "score-ranks-2025.json"
    database_path: Path = ROOT / os.getenv("AGENT_DATABASE_PATH", ".agent-data/agent.db")
    api_key: str = os.getenv("AGENT_API_KEY", "").strip()
    base_url: str = os.getenv("AGENT_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model: str = os.getenv("AGENT_MODEL", "gpt-4.1-mini")
    request_timeout: float = float(os.getenv("AGENT_REQUEST_TIMEOUT", "20"))
    per_tier_default: int = 5
    rank_challenge_min: float = -0.08
    rank_stable_min: float = 0.03
    rank_safe_min: float = 0.12
    score_challenge_min: int = -5
    score_stable_min: int = 5
    score_safe_min: int = 20


settings = Settings()

