from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .knowledge import KnowledgeStore
from .llm import ModelClient
from .models import (
    CandidateProfile,
    ChatRequest,
    ChatResponse,
    HealthResponse,
    OptionsResponse,
    RecommendationRequest,
    RecommendationResponse,
    ToolTrace,
)
from .repository import AdmissionRepository, DISCLAIMER
from .workflow import RecommendationWorkflow


repository = AdmissionRepository(settings)
knowledge = KnowledgeStore(settings)
model = ModelClient(settings, repository.options()["schools"])
workflow = RecommendationWorkflow(repository, knowledge, model)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(
    title="启学高考志愿 Agent API",
    version="1.0.0",
    description="基于内蒙古 2025 年录取数据的可解释候选推荐 Agent。",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "https://qxgaokao.netlify.app",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        groups=len(repository.groups),
        knowledge_entries=knowledge.count(),
        model_enabled=model.enabled,
        workflow="langgraph",
    )


@app.get("/api/options", response_model=OptionsResponse)
def options():
    values = repository.options()
    return OptionsResponse(
        **values,
        subjects=["历史类", "物理类"],
        batches=[
            {"value": "undergraduate", "label": "本科"},
            {"value": "vocational", "label": "高职（专科）"},
            {"value": "both", "label": "本科和专科"},
        ],
        model_enabled=model.enabled,
        rank_data_available=repository.has_rank_data,
    )


@app.get("/api/sources/{source_id}")
def source(source_id: str):
    item = knowledge.get(source_id)
    if not item:
        raise HTTPException(status_code=404, detail="Source not found")
    return item


@app.post("/api/recommendations", response_model=RecommendationResponse)
def recommendations(request: RecommendationRequest):
    results = repository.recommend(request.profile, request.per_tier)
    schools = [item.school for items in results.values() for item in items]
    sources = knowledge.search(request.profile, schools)
    return RecommendationResponse(
        profile=request.profile,
        recommendations=results,
        sources=sources,
        disclaimer=DISCLAIMER,
        trace=[
            ToolTrace(step="search_admissions", label="检索录取数据", detail="确定性筛选完成"),
            ToolTrace(step="rank_candidates", label="生成冲稳保分档", detail="确定性排序完成"),
            ToolTrace(step="retrieve_knowledge", label="检索特色知识", detail=f"找到 {len(sources)} 条来源"),
        ],
    )


@app.post("/api/agent/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    session_id = request.session_id or uuid.uuid4().hex
    profile = request.profile or knowledge.load_profile(session_id) or CandidateProfile()
    state = workflow.run(request.message, profile, request.per_tier)
    updated_profile = state["profile"]
    knowledge.save_profile(session_id, updated_profile)
    return ChatResponse(
        session_id=session_id,
        assistant_message=state["assistant_message"],
        follow_up_required=bool(state.get("missing_fields")),
        missing_fields=state.get("missing_fields", []),
        parser_mode=state.get("parser_mode", "local"),
        profile=updated_profile,
        recommendations=state.get("recommendations", {"冲": [], "稳": [], "保": []}),
        sources=state.get("sources", []),
        disclaimer=DISCLAIMER,
        trace=state.get("trace", []),
    )


app.mount("/assets", StaticFiles(directory=settings.root / "assets"), name="assets")
app.mount("/data", StaticFiles(directory=settings.root / "data"), name="data")


@app.get("/")
def index():
    return FileResponse(settings.root / "index.html")


@app.get("/{page_name}.html")
def html_page(page_name: str):
    if not page_name.replace("-", "").isalnum():
        raise HTTPException(status_code=404)
    path = settings.root / f"{page_name}.html"
    if not path.exists():
        raise HTTPException(status_code=404)
    return FileResponse(path)
