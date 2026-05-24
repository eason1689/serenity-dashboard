const stanceClass = {
  "强看多": "strongBull",
  "看多": "bull",
  "中性": "neutral",
  "谨慎": "caution",
  "看空": "bear"
};

const profileStats = [
  ["粉丝", "followers"],
  ["内容", "contentCount"],
  ["加入追踪", "trackingSince"],
  ["位置", "location"]
];

async function loadDashboard() {
  const response = await fetch("./signals.json");
  const data = await response.json();

  renderProfile(data.profile);
  renderFilters(data.filters, data.summary);
  renderSignals(data.signals);
  renderMetrics(data.summary);
  renderContentTypes(data.contentTypes);
  renderTopics(data.topics);

  document.querySelector("#riskText").textContent = data.summary.risk;
}

function renderProfile(profile) {
  document.querySelector("#profileName").textContent = profile.name;
  document.querySelector("#profileLabel").textContent = profile.label;
  document.querySelector("#contentCount").textContent = profile.contentCount;
  document.querySelector("#followers").textContent = profile.followers;

  document.querySelector("#profileStats").innerHTML = profileStats
    .map(([label, key]) => `
      <div class="stat">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${profile[key]}</div>
      </div>
    `)
    .join("");
}

function renderFilters(filters, summary) {
  document.querySelector("#stanceChips").innerHTML = filters.stance
    .map((item, index) => `
      <span class="chip ${item.tone} ${index === 0 ? "selected" : ""}">
        ${item.name}（${item.count}）
      </span>
    `)
    .join("");

  document.querySelector("#dimensionChips").innerHTML = filters.dimensions
    .map((item) => `<span class="chip">${item.name}（${item.count}）</span>`)
    .join("");

  document.querySelector("#filterCount").textContent =
    `筛选后：${summary.filteredItems} / ${summary.totalItems}`;
}

function renderSignals(signals) {
  document.querySelector("#signalCount").textContent = signals.length;
  document.querySelector("#signalGrid").innerHTML = signals
    .map((signal) => `
      <article class="signal-card">
        <div class="signal-title">
          <h3>${signal.ticker}</h3>
          <span class="signal-stance ${stanceClass[signal.stance] || "neutral"}">${signal.stance}</span>
          <span class="signal-confidence">· ${signal.confidence}</span>
        </div>
        <p>${signal.summary}</p>
        <div class="signal-meta">
          ${signal.observations} 次观察 / ${signal.sourceCount} 条原推 · 更新于 ${signal.updatedAt}
        </div>
      </article>
    `)
    .join("");
}

function renderMetrics(summary) {
  const metrics = [
    ["发布内容", summary.published, "+15%"],
    ["股票相关", summary.stockRelated, "+12%"],
    ["高频主题", summary.topTheme, "+0%"],
    ["完整交易计划", summary.completePlans, "-"]
  ];

  document.querySelector("#metrics").innerHTML = metrics
    .map(([label, value, change]) => `
      <div class="metric">
        <span>${label}</span>
        <div><strong>${value}</strong><small>${change}</small></div>
      </div>
    `)
    .join("");
}

function renderContentTypes(items) {
  document.querySelector("#contentTypes").innerHTML = items
    .map((item) => `
      <div class="legend-row">
        <span class="legend-label">
          <span class="legend-dot" style="background:${item.color}"></span>
          ${item.name}
        </span>
        <strong>${item.percent}% <span class="stat-label">(${item.count})</span></strong>
      </div>
    `)
    .join("");
}

function renderTopics(topics) {
  document.querySelector("#topics").innerHTML = topics
    .map((topic) => `<span class="topic ${topic.tone}">${topic.name} ${topic.count}</span>`)
    .join("");
}

loadDashboard();
