from backend.config import settings
from backend.models import CandidateProfile
from backend.repository import AdmissionRepository


def test_repository_loads_all_normal_groups():
    repository = AdmissionRepository(settings)
    assert len(repository.groups) == 3973 + 1488
    assert repository.has_rank_data


def test_score_to_rank_is_monotonic():
    repository = AdmissionRepository(settings)
    high_rank = repository.score_to_rank(600, "物理类")
    low_rank = repository.score_to_rank(500, "物理类")
    assert high_rank is not None and low_rank is not None
    assert high_rank < low_rank


def test_recommendations_respect_primary_subject_and_tier_limit():
    repository = AdmissionRepository(settings)
    profile = CandidateProfile(primary_subject="物理类", score=560)
    results = repository.recommend(profile, per_tier=3)
    assert set(results) == {"冲", "稳", "保"}
    assert all(len(items) <= 3 for items in results.values())
    assert all("物理" in item.subject for items in results.values() for item in items)


def test_major_preference_is_a_hard_major_match():
    repository = AdmissionRepository(settings)
    profile = CandidateProfile(
        primary_subject="物理类",
        score=560,
        major_categories=["计算机"],
        specific_majors=["计算机"],
    )
    results = repository.recommend(profile, per_tier=5)
    recommendations = [item for items in results.values() for item in items]
    assert recommendations
    assert all(item.majors for item in recommendations)
    assert all(
        any(term in major.name for term in ("计算机", "软件", "网络空间", "人工智能", "数据科学"))
        for item in recommendations
        for major in item.majors
    )


def test_rank_mode_reports_higher_confidence():
    repository = AdmissionRepository(settings)
    profile = CandidateProfile(primary_subject="历史类", rank=9000)
    results = repository.recommend(profile, per_tier=2)
    recommendations = [item for items in results.values() for item in items]
    assert recommendations
    assert all(item.confidence == "较高" for item in recommendations)


def test_incomplete_profile_returns_empty_buckets():
    repository = AdmissionRepository(settings)
    assert repository.recommend(CandidateProfile(), 5) == {"冲": [], "稳": [], "保": []}

