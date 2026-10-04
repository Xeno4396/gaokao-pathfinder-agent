from __future__ import annotations

from typing import Dict, List, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from .knowledge import KnowledgeStore
from .llm import ModelClient
from .models import CandidateProfile, KnowledgeSource, Recommendation, ToolTrace
from .repository import AdmissionRepository, DISCLAIMER


class AgentState(TypedDict, total=False):
    message: str
    profile: CandidateProfile
    per_tier: int
    parser_mode: str
    missing_fields: List[str]
    recommendations: Dict[str, List[Recommendation]]
    sources: List[KnowledgeSource]
    assistant_message: str
    trace: List[ToolTrace]


class RecommendationWorkflow:
    def __init__(self, repository: AdmissionRepository, knowledge: KnowledgeStore, model: ModelClient):
        self.repository = repository
        self.knowledge = knowledge
        self.model = model
        builder = StateGraph(AgentState)
        builder.add_node("extract_profile", self.extract_profile)
        builder.add_node("validate_profile", self.validate_profile)
        builder.add_node("search_admissions", self.search_admissions)
        builder.add_node("rank_candidates", self.rank_candidates)
        builder.add_node("retrieve_knowledge", self.retrieve_knowledge)
        builder.add_node("verify_evidence", self.verify_evidence)
        builder.add_node("compose_answer", self.compose_answer)
        builder.add_edge(START, "extract_profile")
        builder.add_edge("extract_profile", "validate_profile")
        builder.add_conditional_edges("validate_profile", self.route_after_validation, {"ask": "retrieve_knowledge", "search": "search_admissions"})
        builder.add_edge("search_admissions", "rank_candidates")
        builder.add_edge("rank_candidates", "retrieve_knowledge")
        builder.add_edge("retrieve_knowledge", "verify_evidence")
        builder.add_edge("verify_evidence", "compose_answer")
        builder.add_edge("compose_answer", END)
        self.graph = builder.compile()

    @staticmethod
    def _append_trace(state: AgentState, item: ToolTrace) -> List[ToolTrace]:
        return [*state.get("trace", []), item]

    def extract_profile(self, state: AgentState):
        profile, mode = self.model.extract_profile(state.get("message", ""), state["profile"])
        return {
            "profile": profile,
            "parser_mode": mode,
            "trace": self._append_trace(state, ToolTrace(step="extract_profile", label="识别考生条件", status="fallback" if mode == "local" else "done", detail=f"使用{'本地解析器' if mode == 'local' else '兼容模型'}更新档案")),
        }

    def validate_profile(self, state: AgentState):
        profile = state["profile"]
        missing = []
        if not profile.primary_subject:
            missing.append("primary_subject")
        if profile.score is None and profile.rank is None:
            missing.append("score_or_rank")
        return {
            "missing_fields": missing,
            "trace": self._append_trace(state, ToolTrace(step="validate_profile", label="检查推荐条件", status="done", detail="条件完整" if not missing else f"仍需补充 {len(missing)} 项")),
        }

    @staticmethod
    def route_after_validation(state: AgentState) -> str:
        return "ask" if state.get("missing_fields") else "search"

    def search_admissions(self, state: AgentState):
        recommendations = self.repository.recommend(state["profile"], state.get("per_tier", 5))
        count = sum(len(items) for items in recommendations.values())
        return {
            "recommendations": recommendations,
            "trace": self._append_trace(state, ToolTrace(step="search_admissions", label="检索 2025 录取数据", detail=f"命中并去重后保留 {count} 个院校专业组")),
        }

    def rank_candidates(self, state: AgentState):
        profile = state["profile"]
        mode = "位次" if profile.rank and self.repository.has_rank_data else "分差"
        return {"trace": self._append_trace(state, ToolTrace(step="rank_candidates", label="生成冲稳保分档", detail=f"采用{mode}规则，偏好仅参与重排"))}

    def retrieve_knowledge(self, state: AgentState):
        schools = [item.school for items in state.get("recommendations", {}).values() for item in items]
        schools.extend(state["profile"].preferred_schools)
        sources = self.knowledge.search(state["profile"], schools)
        return {
            "sources": sources,
            "trace": self._append_trace(state, ToolTrace(step="retrieve_knowledge", label="检索特色知识", detail=f"找到 {len(sources)} 条可追溯资料" if sources else "推荐院校暂未命中特色知识")),
        }

    def verify_evidence(self, state: AgentState):
        verified = [source for source in state.get("sources", []) if self.knowledge.get(source.id)]
        return {
            "sources": verified,
            "trace": self._append_trace(state, ToolTrace(step="verify_evidence", label="核验证据来源", detail=f"保留 {len(verified)} 条已入库官方来源")),
        }

    def compose_answer(self, state: AgentState):
        missing = state.get("missing_fields", [])
        if missing:
            questions = []
            if "primary_subject" in missing:
                questions.append("首选科目是物理还是历史")
            if "score_or_rank" in missing:
                questions.append("高考分数或全区位次是多少")
            sources = state.get("sources", [])
            message = "为了开始推荐，请告诉我：" + "；".join(questions) + "。"
            if sources:
                message = f"先回答你提到的院校：{sources[0].summary}\n\n{message}"
            recommendations = {"冲": [], "稳": [], "保": []}
        else:
            recommendations = state.get("recommendations", {"冲": [], "稳": [], "保": []})
            sources = state.get("sources", [])
            counts = "，".join(f"{tier}{len(recommendations[tier])}所" for tier in ("冲", "稳", "保"))
            if sum(len(items) for items in recommendations.values()) == 0:
                fallback = "暂时没有找到满足当前硬条件的院校专业组。可以放宽专业方向、批次或成绩范围后再试。"
            else:
                fallback = f"已按 2025 年历史数据整理出{counts}。位次优先用于分档，地区、院校和专业偏好只参与排序，不会覆盖科类硬条件。"
                if sources:
                    fallback += f" 同时匹配到 {len(sources)} 条院校或地区特色资料，可在结果下方核对官方来源。"
            message = self.model.compose(state["profile"], recommendations, sources, fallback)
        return {
            "assistant_message": message,
            "recommendations": recommendations,
            "sources": sources,
            "trace": self._append_trace(state, ToolTrace(step="compose_answer", label="生成可解释答复", detail="仅使用推荐结果和已核验证据")),
        }

    def run(self, message: str, profile: CandidateProfile, per_tier: int = 5) -> AgentState:
        return self.graph.invoke({"message": message, "profile": profile, "per_tier": per_tier, "trace": []})

