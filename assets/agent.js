const agentState = {
  sessionId: localStorage.getItem("qixue-agent-session") || crypto.randomUUID().replaceAll("-", ""),
  busy: false,
};

const els = {
  status: document.querySelector("#agentStatus"),
  profileForm: document.querySelector("#profileForm"),
  newSession: document.querySelector("#newSession"),
  score: document.querySelector("#score"),
  rank: document.querySelector("#rank"),
  batch: document.querySelector("#batch"),
  regions: document.querySelector("#regions"),
  schools: document.querySelector("#schools"),
  majors: document.querySelector("#majors"),
  careers: document.querySelector("#careers"),
  perTier: document.querySelector("#perTier"),
  provinceOptions: document.querySelector("#provinceOptions"),
  schoolOptions: document.querySelector("#schoolOptions"),
  majorOptions: document.querySelector("#majorOptions"),
  parserMode: document.querySelector("#parserMode"),
  messages: document.querySelector("#messages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  sendMessage: document.querySelector("#sendMessage"),
  recommendationSection: document.querySelector("#recommendationSection"),
  recommendationResults: document.querySelector("#recommendationResults"),
  resultDisclaimer: document.querySelector("#resultDisclaimer"),
  sourceSection: document.querySelector("#sourceSection"),
  sourceResults: document.querySelector("#sourceResults"),
  tracePanel: document.querySelector("#tracePanel"),
  traceList: document.querySelector("#traceList"),
};

localStorage.setItem("qixue-agent-session", agentState.sessionId);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function splitValues(value) {
  return [...new Set(String(value || "").split(/[，,、;；]/).map((item) => item.trim()).filter(Boolean))];
}

function asNumber(value) {
  if (value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getProfile() {
  const primarySubject = document.querySelector('input[name="primarySubject"]:checked')?.value || null;
  const otherSubjects = [...document.querySelectorAll('input[name="otherSubjects"]:checked')].map((input) => input.value);
  const preferredRegions = splitValues(els.regions.value);
  const preferredSchools = splitValues(els.schools.value);
  const specificMajors = splitValues(els.majors.value);
  const careerPreferences = splitValues(els.careers.value);
  const precise = preferredRegions.length || preferredSchools.length || specificMajors.length || careerPreferences.length;
  return {
    mode: precise ? "precise" : "fuzzy",
    primary_subject: primarySubject,
    other_subjects: otherSubjects,
    score: asNumber(els.score.value),
    rank: asNumber(els.rank.value),
    batch: els.batch.value,
    preferred_regions: preferredRegions,
    preferred_schools: preferredSchools,
    major_categories: specificMajors,
    specific_majors: specificMajors,
    career_preferences: careerPreferences,
  };
}

function syncProfile(profile) {
  document.querySelectorAll('input[name="primarySubject"]').forEach((input) => {
    input.checked = input.value === profile.primary_subject;
  });
  document.querySelectorAll('input[name="otherSubjects"]').forEach((input) => {
    input.checked = (profile.other_subjects || []).includes(input.value);
  });
  els.score.value = profile.score ?? "";
  els.rank.value = profile.rank ?? "";
  els.batch.value = profile.batch || "undergraduate";
  els.regions.value = (profile.preferred_regions || []).join("、");
  els.schools.value = (profile.preferred_schools || []).join("、");
  els.majors.value = [...new Set([...(profile.major_categories || []), ...(profile.specific_majors || [])])].join("、");
  els.careers.value = (profile.career_preferences || []).join("、");
}

function setBusy(busy) {
  agentState.busy = busy;
  els.sendMessage.disabled = busy;
  els.profileForm.querySelector('button[type="submit"]').disabled = busy;
}

function appendMessage(role, text, loading = false) {
  const element = document.createElement("div");
  element.className = `message ${role === "user" ? "user-message" : "assistant-message"}${loading ? " loading-message" : ""}`;
  element.innerHTML = `<span class="message-label">${role === "user" ? "你" : "择校助手"}</span><p>${escapeHtml(text)}</p>`;
  els.messages.append(element);
  els.messages.scrollTop = els.messages.scrollHeight;
  return element;
}

function renderRecommendations(data) {
  const tiers = [
    ["冲", "tier-challenge", "接近历史门槛，需保留替代方案"],
    ["稳", "tier-stable", "有一定历史余量，仍需关注当年变化"],
    ["保", "tier-safe", "历史余量较大，用于分散风险"],
  ];
  els.recommendationResults.innerHTML = tiers.map(([tier, className, caption]) => {
    const items = data.recommendations[tier] || [];
    const cards = items.length ? items.map((item) => renderRecommendationCard(item)).join("") : '<p class="empty-tier">当前条件下暂无候选。</p>';
    return `<section class="tier-column ${className}"><div class="tier-heading"><div><h3>${tier}</h3><span>${caption}</span></div><span>${items.length} 所</span></div>${cards}</section>`;
  }).join("");
  els.resultDisclaimer.textContent = data.disclaimer;
  const hasResults = Object.values(data.recommendations).some((items) => items.length);
  els.recommendationSection.hidden = !hasResults;
}

function renderRecommendationCard(item) {
  const historicalRank = item.historical_rank ? `约 ${item.historical_rank.toLocaleString("zh-CN")}` : "暂无";
  const majors = item.majors.length
    ? `<details class="major-details"><summary>查看专业明细（${item.majors.length}）</summary><ul>${item.majors.map((major) => `<li>${escapeHtml(major.name)}${major.low_score ? ` · 最低 ${major.low_score}` : ""}</li>`).join("")}</ul></details>`
    : "";
  return `
    <article class="recommendation-card">
      <header><h4>${escapeHtml(item.school)}</h4><span>${escapeHtml(item.margin_label)}</span></header>
      <div class="recommendation-meta"><span>${escapeHtml(item.province)}</span><span>${escapeHtml(item.batch)}</span><span>${escapeHtml(item.subject)}</span><span>专业组 ${escapeHtml(item.group_code)}</span></div>
      <div class="recommendation-score">
        <div><span>历史最低分</span><strong>${item.historical_low_score}</strong></div>
        <div><span>历史位次</span><strong>${historicalRank}</strong></div>
        <div><span>置信度</span><strong>${escapeHtml(item.confidence)}</strong></div>
      </div>
      <ul class="reason-list">${item.match_reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
      ${majors}
    </article>`;
}

function renderSources(sources) {
  els.sourceSection.hidden = !sources.length;
  els.sourceResults.innerHTML = sources.map((source) => `
    <article class="source-item">
      <span>${escapeHtml(source.category)} · ${escapeHtml(source.institution)}</span>
      <div><h3>${escapeHtml(source.title)}</h3><p>${escapeHtml(source.summary)}</p><small>${escapeHtml(source.source_name)} · 核验于 ${escapeHtml(source.verified_at)}${source.effective_period ? ` · ${escapeHtml(source.effective_period)}` : ""}</small></div>
      <a href="${escapeHtml(source.source_url)}" target="_blank" rel="noopener noreferrer">查看官方来源 ↗</a>
    </article>`).join("");
}

function renderTrace(trace) {
  els.tracePanel.hidden = !trace.length;
  els.traceList.innerHTML = trace.map((item) => `<li><strong>${escapeHtml(item.label)}</strong>${escapeHtml(item.detail)}</li>`).join("");
}

async function send(message, profile = getProfile()) {
  if (agentState.busy) return;
  const cleanMessage = message.trim();
  if (!cleanMessage) return;
  appendMessage("user", cleanMessage);
  const loading = appendMessage("assistant", "正在核对条件、录取数据和可用来源…", true);
  setBusy(true);
  try {
    const response = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: agentState.sessionId, message: cleanMessage, profile, per_tier: Number(els.perTier.value) }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `HTTP ${response.status}`);
    }
    const data = await response.json();
    loading.remove();
    appendMessage("assistant", data.assistant_message);
    agentState.sessionId = data.session_id;
    localStorage.setItem("qixue-agent-session", agentState.sessionId);
    syncProfile(data.profile);
    els.parserMode.textContent = data.parser_mode === "model" ? "模型增强" : "本地解析";
    renderRecommendations(data);
    renderSources(data.sources || []);
    renderTrace(data.trace || []);
    if (!els.recommendationSection.hidden) els.recommendationSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    loading.remove();
    appendMessage("assistant", "推荐服务暂时不可用。请确认已通过 FastAPI 启动项目，而不是仅使用静态服务器。错误信息：" + error.message);
  } finally {
    setBusy(false);
  }
}

async function loadOptions() {
  try {
    const response = await fetch("/api/options");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    els.provinceOptions.innerHTML = data.provinces.map((item) => `<option value="${escapeHtml(item)}"></option>`).join("");
    els.schoolOptions.innerHTML = data.schools.map((item) => `<option value="${escapeHtml(item)}"></option>`).join("");
    els.majorOptions.innerHTML = data.major_keywords.map((item) => `<option value="${escapeHtml(item)}"></option>`).join("");
    els.status.className = "agent-status ready";
    els.status.innerHTML = `<span class="status-dot"></span>${data.model_enabled ? "模型增强已启用" : "离线演示模式"} · ${data.rank_data_available ? "位次数据就绪" : "仅分数模式"}`;
    els.parserMode.textContent = data.model_enabled ? "模型增强" : "本地解析";
  } catch (error) {
    els.status.className = "agent-status error";
    els.status.innerHTML = '<span class="status-dot"></span>推荐服务未连接';
  }
}

els.profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  send("请根据当前档案生成冲稳保推荐。", getProfile());
});

els.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = els.chatInput.value;
  els.chatInput.value = "";
  send(message);
});

els.chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.chatForm.requestSubmit();
  }
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => send(button.dataset.prompt));
});

els.newSession.addEventListener("click", () => {
  agentState.sessionId = crypto.randomUUID().replaceAll("-", "");
  localStorage.setItem("qixue-agent-session", agentState.sessionId);
  els.profileForm.reset();
  els.batch.value = "undergraduate";
  els.messages.innerHTML = '<div class="message assistant-message"><span class="message-label">择校助手</span><p>新会话已开始。请告诉我首选科目，以及分数或位次。</p></div>';
  els.recommendationSection.hidden = true;
  els.sourceSection.hidden = true;
  els.tracePanel.hidden = true;
});

loadOptions();
