const state = {
  datasets: {},
  provinces: {},
  batch: "undergraduate",
  category: "历史类",
  artSubject: "",
  sortKey: "ZYZZDF",
  sortDir: "desc",
  expandedKey: "",
};

const batchConfig = {
  undergraduate: {
    label: "本科",
    groupUrl: "data/lq2.json",
    majorUrl: "data/lq.json",
    summary: "本科批第一次录取数据",
    source: "https://www.nm.zsks.cn/25gktdlq/zdxlqzgdf-bk-wl-qcsj-1/tj/lqzgzdf.html",
  },
  vocational: {
    label: "高职（专科）",
    groupUrl: "data/gzzk-lq2.json",
    majorUrl: "data/gzzk-lq.json",
    summary: "高职（专科）普通类第一次录取数据",
    source: "https://www.nm.zsks.cn/25gktdlq/zdxlqzgdf-gzzk-1/tj/lqzgzdf.html",
  },
  undergraduateEarlyArtSport: {
    label: "本科提前B艺体",
    groupUrl: "data/bktqb-art-sport-lq2.json",
    majorUrl: "data/bktqb-art-sport-lq.json",
    summary: "本科提前批B段（艺术类体育类）第一次填报志愿投档录取数据",
    source: "https://www.nm.zsks.cn/25gktdlq/zdxlqzgdf-bktqb-dyc-ysty/tj/lqzgzdf.html",
  },
  vocationalEarlyArtSport: {
    label: "专科提前艺体",
    groupUrl: "data/gzzk-early-art-sport-lq2.json",
    majorUrl: "data/gzzk-early-art-sport-lq.json",
    summary: "高职（专科）提前批（艺术类、体育类）第一次录取数据",
    source: "https://www.nm.zsks.cn/25gktdlq/zdxlqzgdf-gz-1-0810/tj/lqzgzdf.html",
  },
};

const els = {
  batchButtons: [...document.querySelectorAll(".batch-button")],
  subjectSwitch: document.querySelector("#subjectSwitch"),
  provinceFilter: document.querySelector("#provinceFilter"),
  artSubjectField: document.querySelector("#artSubjectField"),
  artSubjectFilter: document.querySelector("#artSubjectFilter"),
  minScore: document.querySelector("#minScore"),
  maxScore: document.querySelector("#maxScore"),
  majorQuery: document.querySelector("#majorQuery"),
  schoolQuery: document.querySelector("#schoolQuery"),
  resetFilters: document.querySelector("#resetFilters"),
  resultCount: document.querySelector("#resultCount"),
  filterSummary: document.querySelector("#filterSummary"),
  unmatchedNotice: document.querySelector("#unmatchedNotice"),
  resultsBody: document.querySelector("#resultsBody"),
  sortButtons: [...document.querySelectorAll("[data-sort]")],
};

const numberFields = new Set(["ZYZLQRS", "ZYZZGF", "ZYZZDF"]);
const categoryOrder = ["历史类", "物理类", "艺术类", "体育类"];

function groupKey(row) {
  return [row.PCDM, row.KLDM, row.YXDH.trim(), row.ZYZDH.trim()].join("|");
}

function normalize(text) {
  return String(text || "").trim().toLowerCase();
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : -1;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function highlight(value, query) {
  const text = escapeHtml(value);
  const q = String(query || "").trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), (match) => `<mark>${match}</mark>`);
}

function deriveCategory(row) {
  if (row.KLMC.includes("历史")) return "历史类";
  if (row.KLMC.includes("物理")) return "物理类";
  if (row.KLMC.includes("艺术")) return "艺术类";
  if (row.KLMC.includes("体育")) return "体育类";
  return row.KLMC || "其他";
}

function deriveArtSubject(row) {
  const artSubject = String(row.YSZKLMC || "").trim();
  if (artSubject) return artSubject;
  return row.KLMC.includes("体育") ? "体育" : "";
}

function currentDataset() {
  return state.datasets[state.batch] || { groups: [], majorsByGroup: new Map(), categories: [], artSubjects: [] };
}

async function loadData() {
  const batchEntries = Object.entries(batchConfig);
  const [batchPayloads, provinces] = await Promise.all([
    Promise.all(batchEntries.map(async ([key, config]) => {
      const [groups, majors] = await Promise.all([
        fetch(config.groupUrl).then((res) => res.json()),
        fetch(config.majorUrl).then((res) => res.json()),
      ]);
      return [key, groups, majors];
    })),
    fetch("data/school-provinces.json").then((res) => res.json()),
  ]);

  state.provinces = provinces;
  state.datasets = Object.fromEntries(batchPayloads.map(([key, groups, majors]) => [key, buildDataset(groups, majors)]));

  syncCategoryControls();
  fillProvinceOptions();
  fillArtSubjectOptions();
  updateUnmatchedNotice();
  render();
}

function buildDataset(groups, majors) {
  const majorsByGroup = new Map();
  const normalizedGroups = groups.map((row) => {
    const school = row.YXMC.trim();
    return {
      ...row,
      YXDH: row.YXDH.trim(),
      ZYZDH: row.ZYZDH.trim(),
      YXMC: school,
      YSZKLMC: deriveArtSubject(row),
      province: state.provinces[school] || "未匹配",
      category: deriveCategory(row),
      _key: groupKey(row),
    };
  });

  for (const major of majors) {
    const key = groupKey(major);
    const entry = {
      ...major,
      YXDH: major.YXDH.trim(),
      ZYZDH: major.ZYZDH.trim(),
      ZYDH: major.ZYDH.trim(),
      _key: key,
    };
    if (!majorsByGroup.has(key)) majorsByGroup.set(key, []);
    majorsByGroup.get(key).push(entry);
  }

  const categories = [...new Set(normalizedGroups.map((row) => row.category))]
    .sort((a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b));
  const artSubjects = [...new Set(normalizedGroups.map((row) => row.YSZKLMC).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  return { groups: normalizedGroups, majorsByGroup, categories, artSubjects };
}

function syncCategoryControls() {
  const { categories } = currentDataset();
  if (!categories.includes(state.category)) state.category = categories[0] || "";

  els.subjectSwitch.innerHTML = categories.map((category) => `
    <button class="subject-button${category === state.category ? " active" : ""}" type="button" data-category="${escapeHtml(category)}" role="tab" aria-selected="${category === state.category}">${escapeHtml(category)}</button>
  `).join("");
}

function fillProvinceOptions() {
  const { groups } = currentDataset();
  const provinceOrder = [...new Set(groups.map((row) => row.province))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  els.provinceFilter.innerHTML = [
    '<option value="">全部省份</option>',
    ...provinceOrder.map((province) => `<option value="${escapeHtml(province)}">${escapeHtml(province)}</option>`),
  ].join("");
}

function fillArtSubjectOptions() {
  const { groups } = currentDataset();
  const artSubjects = [...new Set(groups
    .filter((row) => row.category === state.category)
    .map((row) => row.YSZKLMC)
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const showFilter = artSubjects.length > 0;
  els.artSubjectField.hidden = !showFilter;
  if (!showFilter) {
    state.artSubject = "";
    els.artSubjectFilter.value = "";
    return;
  }

  els.artSubjectFilter.innerHTML = [
    '<option value="">全部子科类</option>',
    ...artSubjects.map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`),
  ].join("");
  if (!artSubjects.includes(state.artSubject)) state.artSubject = "";
  els.artSubjectFilter.value = state.artSubject;
}

function updateUnmatchedNotice() {
  const { groups } = currentDataset();
  const unmatchedCount = groups.filter((row) => row.province === "未匹配").length;
  const batchLabel = batchConfig[state.batch].label;
  els.unmatchedNotice.textContent = unmatchedCount
    ? `${batchLabel}有 ${unmatchedCount} 条记录暂未匹配省份，可在 data/school-provinces.json 中补充。`
    : `院校省份映射已覆盖当前${batchLabel}数据。`;
}

function getFilters() {
  return {
    province: els.provinceFilter.value,
    artSubject: els.artSubjectFilter.value,
    minScore: els.minScore.value === "" ? null : Number(els.minScore.value),
    maxScore: els.maxScore.value === "" ? null : Number(els.maxScore.value),
    majorQuery: normalize(els.majorQuery.value),
    schoolQuery: normalize(els.schoolQuery.value),
  };
}

function groupMatchesMajor(row, majorQuery) {
  if (!majorQuery) return true;
  const majors = currentDataset().majorsByGroup.get(row._key) || [];
  return majors.some((major) => normalize(major.ZYMC).includes(majorQuery));
}

function getFilteredGroups() {
  const filters = getFilters();
  return currentDataset().groups.filter((row) => {
    const score = toNumber(row.ZYZZDF);
    return row.category === state.category
      && (!filters.artSubject || row.YSZKLMC === filters.artSubject)
      && (!filters.province || row.province === filters.province)
      && (filters.minScore === null || score >= filters.minScore)
      && (filters.maxScore === null || score <= filters.maxScore)
      && (!filters.schoolQuery || normalize(row.YXMC).includes(filters.schoolQuery))
      && groupMatchesMajor(row, filters.majorQuery);
  });
}

function sortGroups(rows) {
  const direction = state.sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = numberFields.has(state.sortKey) ? toNumber(a[state.sortKey]) : String(a[state.sortKey] || "");
    const bv = numberFields.has(state.sortKey) ? toNumber(b[state.sortKey]) : String(b[state.sortKey] || "");
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * direction;
    return av.localeCompare(bv, "zh-Hans-CN", { numeric: true }) * direction;
  });
}

function render() {
  const rows = sortGroups(getFilteredGroups());
  const filters = getFilters();
  const subjectText = filters.artSubject ? `${state.category} · ${filters.artSubject}` : state.category;
  els.resultCount.textContent = `${rows.length} 条结果`;
  els.filterSummary.innerHTML = `${escapeHtml(batchConfig[state.batch].summary)}，${escapeHtml(subjectText)}，<a href="${escapeHtml(batchConfig[state.batch].source)}">查看原始来源</a>`;

  if (!rows.length) {
    els.resultsBody.innerHTML = '<tr><td colspan="10" class="empty">没有匹配结果，试试放宽分数或关键词。</td></tr>';
    return;
  }

  els.resultsBody.innerHTML = rows.map((row) => renderGroupRow(row, filters.majorQuery)).join("");
}

function renderGroupRow(row, majorQuery) {
  const majors = currentDataset().majorsByGroup.get(row._key) || [];
  const isExpanded = state.expandedKey === row._key;
  const artSubject = row.YSZKLMC
    ? `<span class="tag tag-subject">${escapeHtml(row.YSZKLMC)}</span>`
    : '<span class="muted">-</span>';
  const summary = `
    <tr>
      <td><div class="school">${highlight(row.YXMC, els.schoolQuery.value)}</div><div class="muted">${escapeHtml(row.YXDH)}</div></td>
      <td>${escapeHtml(row.province)}</td>
      <td>${escapeHtml(row.JHLBMC)}</td>
      <td><span class="tag">${escapeHtml(row.KLMC)}</span></td>
      <td>${artSubject}</td>
      <td>${escapeHtml(row.ZYZDH)}</td>
      <td class="score">${escapeHtml(row.ZYZLQRS)}</td>
      <td class="score">${escapeHtml(row.ZYZZGF)}</td>
      <td class="score">${escapeHtml(row.ZYZZDF)}</td>
      <td><button class="detail-button" type="button" data-key="${escapeHtml(row._key)}">${isExpanded ? "收起" : `查看 ${majors.length}`}</button></td>
    </tr>`;

  if (!isExpanded) return summary;
  return `${summary}${renderDetailsRow(row, majors, majorQuery)}`;
}

function renderDetailsRow(row, majors, majorQuery) {
  const visibleMajors = majorQuery
    ? majors.filter((major) => normalize(major.ZYMC).includes(majorQuery))
    : majors;
  const body = visibleMajors.length
    ? visibleMajors.map((major) => `
      <article class="major-item">
        <div class="major-name">${highlight(major.ZYMC, els.majorQuery.value)}</div>
        <div class="major-meta">
          <span>代码 ${escapeHtml(major.ZYDH)}</span>
          <span>录取 ${escapeHtml(major.LQRS)} 人</span>
          <span>最高 ${escapeHtml(major.ZGF)}</span>
          <span>最低 ${escapeHtml(major.ZDF)}</span>
        </div>
      </article>`).join("")
    : '<div class="empty">该专业组没有匹配当前专业关键词的明细。</div>';

  return `
    <tr class="details-row">
      <td colspan="10">
        <div class="details">
          <div class="details-title">
            <span>${escapeHtml(row.YXMC)} · ${escapeHtml(row.ZYZDH)} 专业组</span>
            <span>${visibleMajors.length}/${majors.length} 个专业</span>
          </div>
          <div class="major-grid">${body}</div>
        </div>
      </td>
    </tr>`;
}

function bindEvents() {
  els.batchButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.batch = button.dataset.batch;
      state.artSubject = "";
      state.expandedKey = "";
      els.batchButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });
      syncCategoryControls();
      fillProvinceOptions();
      fillArtSubjectOptions();
      updateUnmatchedNotice();
      render();
    });
  });

  els.subjectSwitch.addEventListener("click", (event) => {
    const button = event.target.closest(".subject-button");
    if (!button) return;
    state.category = button.dataset.category;
    state.artSubject = "";
    state.expandedKey = "";
    syncCategoryControls();
    fillArtSubjectOptions();
    render();
  });

  [els.provinceFilter, els.artSubjectFilter, els.minScore, els.maxScore, els.majorQuery, els.schoolQuery].forEach((control) => {
    control.addEventListener("input", () => {
      if (control === els.artSubjectFilter) state.artSubject = control.value;
      state.expandedKey = "";
      render();
    });
  });

  els.resetFilters.addEventListener("click", () => {
    els.provinceFilter.value = "";
    els.artSubjectFilter.value = "";
    els.minScore.value = "";
    els.maxScore.value = "";
    els.majorQuery.value = "";
    els.schoolQuery.value = "";
    state.artSubject = "";
    state.expandedKey = "";
    render();
  });

  els.sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = numberFields.has(key) ? "desc" : "asc";
      }
      render();
    });
  });

  els.resultsBody.addEventListener("click", (event) => {
    const button = event.target.closest(".detail-button");
    if (!button) return;
    state.expandedKey = state.expandedKey === button.dataset.key ? "" : button.dataset.key;
    render();
  });
}

bindEvents();
loadData().catch((error) => {
  console.error(error);
  els.resultCount.textContent = "加载失败";
  els.filterSummary.textContent = "请通过本地服务器打开页面，例如 npm-free 的 python -m http.server。";
  els.resultsBody.innerHTML = '<tr><td colspan="10" class="empty">无法读取 data 目录中的 JSON 文件。</td></tr>';
});
