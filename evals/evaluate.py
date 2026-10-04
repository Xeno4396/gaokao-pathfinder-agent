from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.config import settings
from backend.knowledge import KnowledgeStore
from backend.llm import ModelClient
from backend.models import CandidateProfile
from backend.repository import AdmissionRepository
from backend.workflow import RecommendationWorkflow


def contains_expected(actual, expected):
    if isinstance(expected, list):
        return all(item in (actual or []) for item in expected)
    return actual == expected


def main():
    cases = json.loads((ROOT / "evals" / "cases.json").read_text(encoding="utf-8"))
    repository = AdmissionRepository(settings)
    knowledge = KnowledgeStore(settings)
    model = ModelClient(settings, repository.options()["schools"])
    workflow = RecommendationWorkflow(repository, knowledge, model)
    passed = 0
    details = []
    for case in cases:
        state = workflow.run(case["message"], CandidateProfile(), 5)
        profile = state["profile"].model_dump()
        expected = case["expect"]
        checks = []
        for key, value in expected.items():
            if key in profile:
                checks.append(contains_expected(profile[key], value))
            elif key == "missing":
                checks.append(all(item in state.get("missing_fields", []) for item in value))
            elif key == "source_institution":
                checks.append(any(source.institution == value for source in state.get("sources", [])))
            elif key == "max_recommendations":
                checks.append(sum(len(items) for items in state.get("recommendations", {}).values()) <= value)
            elif key == "forbidden":
                checks.append(value not in state.get("assistant_message", ""))
            elif key == "known_limitation":
                checks.append(True)
        ok = all(checks)
        passed += int(ok)
        details.append({"id": case["id"], "passed": ok})
    result = {"total": len(cases), "passed": passed, "pass_rate": round(passed / len(cases), 4), "details": details}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
