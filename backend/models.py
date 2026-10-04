from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


Subject = Literal["历史类", "物理类"]
Batch = Literal["undergraduate", "vocational", "both"]
Tier = Literal["冲", "稳", "保"]


class CandidateProfile(BaseModel):
    mode: Literal["fuzzy", "precise"] = "fuzzy"
    primary_subject: Optional[Subject] = None
    other_subjects: List[str] = Field(default_factory=list)
    score: Optional[int] = Field(default=None, ge=0, le=750)
    rank: Optional[int] = Field(default=None, ge=1)
    batch: Batch = "undergraduate"
    preferred_regions: List[str] = Field(default_factory=list)
    preferred_schools: List[str] = Field(default_factory=list)
    major_categories: List[str] = Field(default_factory=list)
    specific_majors: List[str] = Field(default_factory=list)
    career_preferences: List[str] = Field(default_factory=list)

    @field_validator(
        "other_subjects",
        "preferred_regions",
        "preferred_schools",
        "major_categories",
        "specific_majors",
        "career_preferences",
    )
    @classmethod
    def clean_list(cls, values: List[str]) -> List[str]:
        cleaned: List[str] = []
        for value in values:
            item = str(value).strip()
            if item and item not in cleaned:
                cleaned.append(item)
        return cleaned


class MajorDetail(BaseModel):
    code: str
    name: str
    admitted: Optional[int] = None
    high_score: Optional[int] = None
    low_score: Optional[int] = None


class Recommendation(BaseModel):
    id: str
    tier: Tier
    school: str
    school_code: str
    province: str
    batch: str
    subject: str
    plan_category: str
    group_code: str
    admitted: Optional[int] = None
    historical_high_score: Optional[int] = None
    historical_low_score: int
    historical_rank: Optional[int] = None
    margin: float
    margin_label: str
    confidence: Literal["较高", "较低"]
    match_reasons: List[str]
    majors: List[MajorDetail]


class KnowledgeSource(BaseModel):
    id: str
    institution: str
    region: str
    category: str
    title: str
    summary: str
    source_url: str
    source_name: str
    published_at: Optional[str] = None
    verified_at: str
    effective_period: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class ToolTrace(BaseModel):
    step: str
    label: str
    status: Literal["done", "skipped", "fallback"] = "done"
    detail: str


class RecommendationRequest(BaseModel):
    profile: CandidateProfile
    per_tier: int = Field(default=5, ge=1, le=10)


class RecommendationResponse(BaseModel):
    profile: CandidateProfile
    recommendations: Dict[str, List[Recommendation]]
    sources: List[KnowledgeSource]
    disclaimer: str
    trace: List[ToolTrace] = Field(default_factory=list)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    session_id: Optional[str] = Field(default=None, max_length=80)
    profile: Optional[CandidateProfile] = None
    per_tier: int = Field(default=5, ge=1, le=10)


class ChatResponse(RecommendationResponse):
    session_id: str
    assistant_message: str
    follow_up_required: bool
    missing_fields: List[str] = Field(default_factory=list)
    parser_mode: Literal["model", "local"] = "local"


class OptionsResponse(BaseModel):
    provinces: List[str]
    schools: List[str]
    major_keywords: List[str]
    subjects: List[str]
    batches: List[Dict[str, str]]
    model_enabled: bool
    rank_data_available: bool


class HealthResponse(BaseModel):
    status: str
    groups: int
    knowledge_entries: int
    model_enabled: bool
    workflow: str


JsonDict = Dict[str, Any]

