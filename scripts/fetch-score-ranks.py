"""Fetch the official 2025 Inner Mongolia score-to-rank tables."""

from __future__ import annotations

import json
import re
import ssl
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "score-ranks-2025.json"
SOURCES = {
    "历史类": "https://www.nm.zsks.cn/fzlm/25gktj/202506/t20250624_45796.html",
    "物理类": "https://www.nm.zsks.cn/fzlm/25gktj/202506/t20250624_45794.html",
}


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_cell = False
        self.in_row = False
        self.cell_parts = []
        self.row = []
        self.rows = []

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.in_row = True
            self.row = []
        elif tag in {"td", "th"} and self.in_row:
            self.in_cell = True
            self.cell_parts = []

    def handle_data(self, data):
        if self.in_cell:
            self.cell_parts.append(data)

    def handle_endtag(self, tag):
        if tag in {"td", "th"} and self.in_cell:
            self.row.append("".join(self.cell_parts).strip())
            self.in_cell = False
        elif tag == "tr" and self.in_row:
            self.rows.append(self.row)
            self.in_row = False


def fetch_rows(url: str):
    request = Request(url, headers={"User-Agent": "QixueGaokaoAgent/1.0"})
    context = ssl.create_default_context()
    # The education authority endpoint still negotiates a legacy DH suite.
    context.set_ciphers("DEFAULT:@SECLEVEL=1")
    with urlopen(request, timeout=30, context=context) as response:
        html = response.read().decode("utf-8")
    parser = TableParser()
    parser.feed(html)
    rows = []
    for cells in parser.rows:
        if len(cells) != 2:
            continue
        left = re.sub(r"\s+", "", cells[0])
        right = re.sub(r"\s+", "", cells[1])
        if left.isdigit() and right.isdigit():
            score, rank = int(left), int(right)
            if 0 <= score <= 750 and rank > 0:
                rows.append({"score": score, "rank": rank})
    if len(rows) < 100:
        raise RuntimeError(f"Official table parsing returned only {len(rows)} rows: {url}")
    return rows


def main() -> None:
    payload = {
        "year": 2025,
        "region": "内蒙古",
        "note": "分数含照顾分；累计人数作为历史位次参考。",
        "sources": SOURCES,
        "subjects": {subject: fetch_rows(url) for subject, url in SOURCES.items()},
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT} ({sum(len(rows) for rows in payload['subjects'].values())} rows)")


if __name__ == "__main__":
    main()
