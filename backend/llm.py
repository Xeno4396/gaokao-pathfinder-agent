from __future__ import annotations

import json
import re
from typing import Iterable, List, Optional, Tuple

import httpx

from .config import Settings
from .models import CandidateProfile, KnowledgeSource, Recommendation


PROVINCES = [
    "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏", "浙江",
    "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川",
    "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆", "香港", "澳门",
]
OTHER_SUBJECTS = ["化学", "生物", "政治", "地理"]
MAJOR_TERMS = [
    "计算机", "软件", "人工智能", "电子信息", "通信", "机械", "兵器", "材料", "稀土", "能源",
    "电气", "医学", "临床医学", "口腔", "师范", "教育", "财经", "金融", "会计", "法学",
    "农林", "农学", "草业", "土木", "交通", "建筑", "化工", "航空航天",
]
CAREER_TERMS = ["考公", "考研", "科研", "军工", "国企", "电网", "教师", "医生", "互联网", "就业"]


def _merge_profile(base: CandidateProfile, updates: dict) -> CandidateProfile:
    data = base.model_dump()
    for key, value in updates.items():
        if value is None or value == "" or value == []:
            continue
        if isinstance(data.get(key), list):
            data[key] = list(dict.fromkeys([*data[key], *value]))
        else:
            data[key] = value
    has_preferences = any(data[key] for key in ("preferred_regions", "preferred_schools", "major_categories", "specific_majors", "career_preferences"))
    data["mode"] = "precise" if has_preferences else "fuzzy"
    return CandidateProfile.model_validate(data)


class ModelClient:
    def __init__(self, settings: Settings, schools: Iterable[str]):
        self.settings = settings
        self.schools = sorted(schools, key=len, reverse=True)

    @property
    def enabled(self) -> bool:
        return bool(self.settings.api_key)

    def _chat(self, messages: list, json_mode: bool = False) -> str:
        payload = {"model": self.settings.model, "messages": messages, "temperature": 0.1}
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        with httpx.Client(timeout=self.settings.request_timeout) as client:
            response = client.post(
                f"{self.settings.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.settings.api_key}"},
                json=payload,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

    def extract_profile(self, message: str, base: CandidateProfile) -> Tuple[CandidateProfile, str]:
        if self.enabled:
            system = (
                "你是高考志愿条件解析器，只提取用户明确表达的信息，不推测。输出 JSON，字段必须来自："
                "primary_subject(历史类/物理类/null), other_subjects, score, rank, batch(undergraduate/vocational/both/null), "
                "preferred_regions, preferred_schools, major_categories, specific_majors, career_preferences。"
            )
            prompt = f"当前档案：{base.model_dump_json()}\n用户消息：{message}"
            for _ in range(2):
                try:
                    content = self._chat([{"role": "system", "content": system}, {"role": "user", "content": prompt}], json_mode=True)
                    payload = json.loads(content.strip().removeprefix("```json").removesuffix("```").strip())
                    return _merge_profile(base, payload), "model"
                except (httpx.HTTPError, KeyError, TypeError, ValueError):
                    continue
        return self._extract_local(message, base), "local"

    def _extract_local(self, message: str, base: CandidateProfile) -> CandidateProfile:
        compact = re.sub(r"\s+", "", message)
        updates = {}
        if "物理" in compact or any(combo in compact for combo in ("物化生", "物化地", "物生地", "物政")):
            updates["primary_subject"] = "物理类"
        elif "历史" in compact or any(combo in compact for combo in ("史政地", "史政生", "史化生", "历政地")):
            updates["primary_subject"] = "历史类"
        other_subjects = [subject for subject in OTHER_SUBJECTS if subject in compact]
        abbreviation_map = {"化": "化学", "生": "生物", "政": "政治", "地": "地理"}
        for combination in re.findall(r"(?:物|史|历)[化生政地]{1,3}", compact):
            for short, full in abbreviation_map.items():
                if short in combination and full not in other_subjects:
                    other_subjects.append(full)
        updates["other_subjects"] = other_subjects

        rank_match = re.search(r"(?:位次|排名|全区第?)\D{0,4}(\d{1,6})", compact)
        score_text = re.sub(r"(?:位次|排名|全区第?)\D{0,4}\d{1,6}", "", compact)
        score_match = re.search(r"(?<!\d)(\d{3})(?:分|左右)(?!\d)", score_text)
        if not score_match:
            score_match = re.search(r"(?<!\d)([1-7]\d{2})(?!\d)", score_text)
        if rank_match:
            updates["rank"] = int(rank_match.group(1))
        if score_match and 100 <= int(score_match.group(1)) <= 750:
            updates["score"] = int(score_match.group(1))
        if "本科和专科" in compact or "都看看" in compact:
            updates["batch"] = "both"
        elif "专科" in compact or "高职" in compact:
            updates["batch"] = "vocational"
        elif "本科" in compact:
            updates["batch"] = "undergraduate"

        updates["preferred_regions"] = [province for province in PROVINCES if province in compact]
        updates["preferred_schools"] = [school for school in self.schools if school in compact][:5]
        found_majors = [term for term in MAJOR_TERMS if term in compact]
        updates["specific_majors"] = found_majors
        updates["major_categories"] = [term for term in found_majors if term in {"计算机", "电子信息", "机械", "兵器", "材料", "能源", "医学", "师范", "财经", "法学", "农林", "土木", "交通"}]
        updates["career_preferences"] = [term for term in CAREER_TERMS if term in compact]
        return _merge_profile(base, updates)

    def compose(
        self,
        profile: CandidateProfile,
        recommendations: dict,
        sources: List[KnowledgeSource],
        fallback: str,
    ) -> str:
        if not self.enabled:
            return fallback
        compact_recommendations = {
            tier: [
                {"school": item.school, "group": item.group_code, "low_score": item.historical_low_score, "margin": item.margin_label}
                for item in items[:3]
            ]
            for tier, items in recommendations.items()
        }
        evidence = [{"id": source.id, "title": source.title, "summary": source.summary} for source in sources]
        system = (
            "你是内蒙古高考志愿助手。只能使用提供的推荐数据和证据，不能声称录取概率，不能添加未提供的政策。"
            "用简洁中文概括冲稳保结果和偏好匹配；引用特色信息时在句末写 [来源ID]。"
        )
        prompt = json.dumps({"profile": profile.model_dump(), "recommendations": compact_recommendations, "evidence": evidence}, ensure_ascii=False)
        try:
            return self._chat([{"role": "system", "content": system}, {"role": "user", "content": prompt}])
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            return fallback

