from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from .config import Settings
from .models import CandidateProfile, MajorDetail, Recommendation


DISCLAIMER = "基于 2025 年单年历史录取数据生成候选建议，不等同于当年录取概率；请以考试院和院校最新公告为准。"


def _text(value: object) -> str:
    return str(value or "").strip()


def _number(value: object) -> Optional[int]:
    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return None


def _group_key(row: dict) -> str:
    return "|".join(
        _text(row.get(key)) for key in ("PCDM", "KLDM", "YXDH", "ZYZDH")
    )


class AdmissionRepository:
    batch_files = {
        "undergraduate": ("lq2.json", "lq.json", "本科"),
        "vocational": ("gzzk-lq2.json", "gzzk-lq.json", "高职（专科）"),
    }

    major_aliases = {
        "计算机": ["计算机", "软件", "网络空间", "人工智能", "数据科学"],
        "电子信息": ["电子", "通信", "集成电路", "微电子", "信息工程"],
        "机械": ["机械", "车辆", "智能制造", "工业设计"],
        "兵器": ["兵器", "武器", "弹药", "探测制导", "装甲车辆"],
        "材料": ["材料", "冶金", "稀土", "新能源材料"],
        "能源": ["能源", "电气", "储能", "新能源", "动力"],
        "医学": ["临床医学", "口腔", "护理", "药学", "医学"],
        "师范": ["师范", "教育学", "学前教育", "小学教育"],
        "财经": ["经济", "金融", "会计", "财务", "工商管理"],
        "法学": ["法学", "知识产权", "公安学"],
        "农林": ["农学", "林学", "草业", "动物", "植物", "园艺"],
        "土木交通": ["土木", "交通", "道路", "桥梁", "建筑"],
    }

    def __init__(self, settings: Settings):
        self.settings = settings
        self.groups: List[dict] = []
        self.majors_by_group: Dict[str, List[dict]] = defaultdict(list)
        self.provinces: Dict[str, str] = {}
        self.rank_tables: Dict[str, List[Tuple[int, int]]] = {}
        self._load()

    @staticmethod
    def _read_json(path: Path):
        return json.loads(path.read_text(encoding="utf-8"))

    def _load(self) -> None:
        self.provinces = self._read_json(self.settings.data_dir / "school-provinces.json")
        for batch, (group_file, major_file, label) in self.batch_files.items():
            groups = self._read_json(self.settings.data_dir / group_file)
            majors = self._read_json(self.settings.data_dir / major_file)
            for row in majors:
                self.majors_by_group[_group_key(row)].append(row)
            for row in groups:
                school = _text(row.get("YXMC"))
                self.groups.append(
                    {
                        **row,
                        "_key": _group_key(row),
                        "_batch": batch,
                        "_batch_label": label,
                        "_school": school,
                        "_province": self.provinces.get(school, "未匹配"),
                    }
                )

        if self.settings.rank_path.exists():
            payload = self._read_json(self.settings.rank_path)
            for subject, rows in payload.get("subjects", {}).items():
                pairs = [(int(row["score"]), int(row["rank"])) for row in rows]
                self.rank_tables[subject] = sorted(pairs, reverse=True)

    @property
    def has_rank_data(self) -> bool:
        return bool(self.rank_tables)

    def options(self) -> dict:
        return {
            "provinces": sorted(set(self.provinces.values()) - {"未匹配"}),
            "schools": sorted(set(row["_school"] for row in self.groups)),
            "major_keywords": sorted(self.major_aliases),
        }

    def score_to_rank(self, score: int, subject: str) -> Optional[int]:
        rows = self.rank_tables.get(subject, [])
        if not rows:
            return None
        for table_score, rank in rows:
            if score >= table_score:
                return rank
        return rows[-1][1]

    def _major_terms(self, profile: CandidateProfile) -> List[str]:
        terms: List[str] = []
        for term in profile.major_categories + profile.specific_majors:
            terms.extend(self.major_aliases.get(term, [term]))
        return list(dict.fromkeys(item for item in terms if item))

    def _matched_majors(self, row: dict, terms: Sequence[str]) -> List[dict]:
        majors = self.majors_by_group.get(row["_key"], [])
        if not terms:
            return majors
        return [
            major
            for major in majors
            if any(term.lower() in _text(major.get("ZYMC")).lower() for term in terms)
        ]

    def _tier(self, profile: CandidateProfile, low_score: int) -> Optional[Tuple[str, float, str, str]]:
        historical_rank = self.score_to_rank(low_score, profile.primary_subject or "")
        if profile.rank and historical_rank:
            margin = (historical_rank - profile.rank) / max(historical_rank, 1)
            if margin < self.settings.rank_challenge_min:
                return None
            if margin < self.settings.rank_stable_min:
                tier = "冲"
            elif margin < self.settings.rank_safe_min:
                tier = "稳"
            else:
                tier = "保"
            return tier, margin, f"位次余量 {margin:+.1%}", "较高"

        if profile.score is None:
            return None
        margin = profile.score - low_score
        if margin < self.settings.score_challenge_min:
            return None
        if margin < self.settings.score_stable_min:
            tier = "冲"
        elif margin < self.settings.score_safe_min:
            tier = "稳"
        else:
            tier = "保"
        return tier, float(margin), f"分差 {margin:+d}", "较低"

    def _preference_score(self, row: dict, majors: Sequence[dict], profile: CandidateProfile) -> Tuple[int, List[str]]:
        score = 0
        reasons: List[str] = []
        school = row["_school"]
        province = row["_province"]
        if profile.preferred_schools and any(name in school for name in profile.preferred_schools):
            score += 60
            reasons.append("匹配意向院校")
        if profile.preferred_regions and province in profile.preferred_regions:
            score += 30
            reasons.append("匹配意向地区")
        if profile.major_categories or profile.specific_majors:
            score += 40
            names = "、".join(_text(item.get("ZYMC")) for item in majors[:2])
            reasons.append(f"专业组含意向方向：{names}")
        if not reasons:
            reasons.append("成绩位置与该专业组历史最低分接近")
        return score, reasons

    def recommend(self, profile: CandidateProfile, per_tier: int = 5) -> Dict[str, List[Recommendation]]:
        if not profile.primary_subject or (profile.score is None and profile.rank is None):
            return {"冲": [], "稳": [], "保": []}

        terms = self._major_terms(profile)
        batches = set(self.batch_files) if profile.batch == "both" else {profile.batch}
        candidates: List[Tuple[int, float, Recommendation]] = []
        for row in self.groups:
            if row["_batch"] not in batches:
                continue
            if profile.primary_subject not in _text(row.get("KLMC")):
                continue
            low_score = _number(row.get("ZYZZDF"))
            if low_score is None:
                continue
            matched_majors = self._matched_majors(row, terms)
            if terms and not matched_majors:
                continue
            tier_result = self._tier(profile, low_score)
            if not tier_result:
                continue
            tier, margin, margin_label, confidence = tier_result
            preference_score, reasons = self._preference_score(row, matched_majors, profile)
            historical_rank = self.score_to_rank(low_score, profile.primary_subject)
            majors = [
                MajorDetail(
                    code=_text(item.get("ZYDH")),
                    name=_text(item.get("ZYMC")),
                    admitted=_number(item.get("LQRS")),
                    high_score=_number(item.get("ZGF")),
                    low_score=_number(item.get("ZDF")),
                )
                for item in matched_majors[:8]
            ]
            recommendation = Recommendation(
                id=row["_key"],
                tier=tier,
                school=row["_school"],
                school_code=_text(row.get("YXDH")),
                province=row["_province"],
                batch=row["_batch_label"],
                subject=_text(row.get("KLMC")),
                plan_category=_text(row.get("JHLBMC")),
                group_code=_text(row.get("ZYZDH")),
                admitted=_number(row.get("ZYZLQRS")),
                historical_high_score=_number(row.get("ZYZZGF")),
                historical_low_score=low_score,
                historical_rank=historical_rank,
                margin=round(margin, 4),
                margin_label=margin_label,
                confidence=confidence,
                match_reasons=reasons,
                majors=majors,
            )
            proximity = abs(margin)
            candidates.append((preference_score, proximity, recommendation))

        tiered: Dict[str, List[Recommendation]] = {"冲": [], "稳": [], "保": []}
        seen_schools: Dict[str, set] = {"冲": set(), "稳": set(), "保": set()}
        candidates.sort(key=lambda item: (-item[0], item[1], item[2].school))
        for _, _, item in candidates:
            bucket = tiered[item.tier]
            if len(bucket) >= per_tier or item.school in seen_schools[item.tier]:
                continue
            bucket.append(item)
            seen_schools[item.tier].add(item.school)
        return tiered

