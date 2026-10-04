from pathlib import Path

from fastapi.testclient import TestClient

from backend.config import Settings, settings
from backend.knowledge import KnowledgeStore
from backend.llm import ModelClient
from backend.main import app
from backend.models import CandidateProfile
from backend.repository import AdmissionRepository
from backend.workflow import RecommendationWorkflow


def make_components(tmp_path: Path):
    test_settings = Settings(
        root=settings.root,
        data_dir=settings.data_dir,
        knowledge_path=settings.knowledge_path,
        rank_path=settings.rank_path,
        database_path=tmp_path / "agent.db",
        api_key="",
    )
    repository = AdmissionRepository(test_settings)
    knowledge = KnowledgeStore(test_settings)
    model = ModelClient(test_settings, repository.options()["schools"])
    return repository, knowledge, model


def test_local_parser_extracts_core_profile(tmp_path):
    repository, _, model = make_components(tmp_path)
    profile, mode = model.extract_profile("物理类560分，位次12000，想去北京学计算机", CandidateProfile())
    assert mode == "local"
    assert profile.primary_subject == "物理类"
    assert profile.score == 560
    assert profile.rank == 12000
    assert "北京" in profile.preferred_regions
    assert "计算机" in profile.specific_majors


def test_local_parser_handles_subject_abbreviations_and_ignores_id_number(tmp_path):
    repository, _, model = make_components(tmp_path)
    profile, _ = model.extract_profile("身份证150123，物化生，550分", CandidateProfile())
    assert profile.primary_subject == "物理类"
    assert profile.score == 550
    assert profile.other_subjects == ["化学", "生物"]


def test_workflow_asks_only_for_missing_core_fields(tmp_path):
    repository, knowledge, model = make_components(tmp_path)
    workflow = RecommendationWorkflow(repository, knowledge, model)
    state = workflow.run("我想学计算机", CandidateProfile(), 3)
    assert state["missing_fields"] == ["primary_subject", "score_or_rank"]
    assert "首选科目" in state["assistant_message"]
    assert len(state["trace"]) >= 4


def test_policy_question_can_return_source_before_scores(tmp_path):
    repository, knowledge, model = make_components(tmp_path)
    workflow = RecommendationWorkflow(repository, knowledge, model)
    state = workflow.run("中北大学兵器类有什么特色", CandidateProfile(), 3)
    assert state["sources"]
    assert state["sources"][0].institution == "中北大学"
    assert "兵器" in state["assistant_message"]


def test_knowledge_search_returns_official_rare_earth_sources(tmp_path):
    _, knowledge, _ = make_components(tmp_path)
    profile = CandidateProfile(preferred_regions=["内蒙古"], specific_majors=["稀土"])
    sources = knowledge.search(profile, ["内蒙古科技大学"])
    assert any("稀土" in source.title for source in sources)
    assert all(source.source_url.startswith("https://") for source in sources)


def test_session_profile_round_trip(tmp_path):
    _, knowledge, _ = make_components(tmp_path)
    profile = CandidateProfile(primary_subject="历史类", score=520)
    knowledge.save_profile("session-a", profile)
    loaded = knowledge.load_profile("session-a")
    assert loaded == profile


def test_api_health_options_and_recommendations():
    client = TestClient(app)
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["workflow"] == "langgraph"
    options = client.get("/api/options")
    assert options.status_code == 200
    assert options.json()["rank_data_available"] is True
    response = client.post(
        "/api/recommendations",
        json={"profile": {"primary_subject": "物理类", "score": 560}, "per_tier": 2},
    )
    assert response.status_code == 200
    assert set(response.json()["recommendations"]) == {"冲", "稳", "保"}


def test_chat_rejects_oversized_message():
    client = TestClient(app)
    response = client.post("/api/agent/chat", json={"message": "a" * 1001})
    assert response.status_code == 422

