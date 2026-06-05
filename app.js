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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPrice(value, currency = "USD") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "待回填";
  const amount = Number(value);
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: amount >= 100 ? 2 : 3,
    maximumFractionDigits: amount >= 100 ? 2 : 3
  })}`;
}

function formatPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "待计算";
  const amount = Number(value);
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount.toFixed(2)}%`;
}

function pctClass(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "pending";
  return Number(value) >= 0 ? "positive" : "negative";
}

function formatDate(value) {
  if (!value) return "待更新";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date).replaceAll("/", "-");
}

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function primaryPerformance(signal) {
  return signal.performance || {};
}

function stockMomentum(signal) {
  const performance = primaryPerformance(signal);
  return Number(performance.changePct);
}

function splitSummary(text) {
  return String(text || "")
    .split(/[；。]\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

async function loadDashboard() {
  const [response, dailyDigests] = await Promise.all([
    fetch("./signals.json"),
    loadDailyDigests()
  ]);
  const data = await response.json();

  renderProfile(data.profile);
  renderFilters(data.filters, data.summary);
  renderDailyCards(data, dailyDigests);
  renderMetrics(data);
  renderContentTypes(data.contentTypes);
  renderTopics(data.topics);
  renderStockLeaders(data.signals);

  document.querySelector("#riskText").textContent = data.summary.risk;
}

async function loadDailyDigests() {
  try {
    const response = await fetch("./daily-digests.json");
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function renderProfile(profile) {
  document.querySelector("#profileName").textContent = profile.name;
  document.querySelector("#profileLabel").textContent = profile.label;
  document.querySelector("#contentCount").textContent = profile.contentCount;
  document.querySelector("#followers").textContent = profile.followers;

  document.querySelector("#profileStats").innerHTML = profileStats
    .map(([label, key]) => `
      <div class="stat">
        <span>${label}</span>
        <strong>${escapeHtml(profile[key])}</strong>
      </div>
    `)
    .join("");
}

function renderFilters(filters, summary) {
  document.querySelector("#stanceChips").innerHTML = filters.stance
    .map((item, index) => `
      <span class="chip ${item.tone} ${index === 0 ? "selected" : ""}">
        ${escapeHtml(item.name)} ${item.count}
      </span>
    `)
    .join("");

  document.querySelector("#dimensionChips").innerHTML = filters.dimensions
    .map((item) => `<span class="chip">${escapeHtml(item.name)} ${item.count}</span>`)
    .join("");

  document.querySelector("#filterCount").textContent =
    `筛选后：${summary.filteredItems} / ${summary.totalItems}`;
}

function buildFeedCards(data) {
  const sorted = [...data.signals].sort((left, right) => {
    const rightScore = (right.observations || 0) * 3 + (right.sourceCount || 0);
    const leftScore = (left.observations || 0) * 3 + (left.sourceCount || 0);
    return rightScore - leftScore;
  });

  const today = todayInShanghai();
  const cards = [{
    date: `行情刷新：${today}`,
    status: "行情刷新",
    meta: `${sorted.length} 个股票实体 · ${data.summary.stockRelated} 条股票相关内容`,
    summary: [
      `追踪区间：${data.summary.date}`,
      `最高频主题：${data.summary.topTheme}`,
      `已刷新可用行情，股票行保留当前价、原有累计表现，以及从今天开始的累计表现。`
    ],
    signals: sorted
  }];

  const groups = new Map();
  for (const signal of sorted) {
    const date = signal.updatedAt || "未标日期";
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(signal);
  }

  for (const [date, signals] of [...groups.entries()].slice(0, 8)) {
    cards.push({
      date: `信号归档：${date}`,
      status: "历史信号",
      meta: `${signals.reduce((sum, signal) => sum + (signal.sourceCount || 0), 0)} 条原推 · ${signals.length} 个 entity 观察`,
      summary: [
        "这是股票信号的归档日期，不等同于 Serenity 的真实逐日推文日期。",
        ...signals.slice(0, 3).flatMap((signal) => splitSummary(signal.summary)).slice(0, 4)
      ],
      signals
    });
  }

  return cards;
}

function normalizeTicker(value) {
  return String(value || "")
    .trim()
    .replace(/^\$/, "")
    .replace(/\(.+\)/g, "")
    .replace(/\s.+$/, "")
    .replace(/\.DE|\.PA/g, "")
    .toUpperCase();
}

function signalMatchesEntity(signal, entity) {
  const entityTicker = normalizeTicker(entity.ticker);
  const entityLabel = normalizeTicker(entity.label);
  const signalParts = signal.ticker
    .split(/[\/,]/)
    .map(normalizeTicker)
    .filter(Boolean);

  return signalParts.some((part) =>
    part === entityTicker ||
    part === entityLabel ||
    entityTicker.includes(part) ||
    part.includes(entityTicker)
  );
}

function entityToSignal(entity, signals, marketQuotes = {}) {
  const matchedSignal = signals.find((signal) => signalMatchesEntity(signal, entity));
  const entityTicker = normalizeTicker(entity.ticker);
  const marketQuote = marketQuotes[entityTicker];
  return {
    ticker: entity.label || entity.ticker,
    stance: entity.stance || matchedSignal?.stance || "中性",
    confidence: entity.confidence || matchedSignal?.confidence || entity.dimension || "逐日观察",
    dimension: entity.dimension || matchedSignal?.dimension || "个股",
    performance: marketQuote || matchedSignal?.performance || {
      primaryTicker: entity.label || entity.ticker,
      currentPrice: null,
      changePct: null,
      cumulativeChangePct: null,
      currency: "USD"
    }
  };
}

function buildDigestCards(data, dailyDigests) {
  if (!dailyDigests?.digests?.length) return buildFeedCards(data);

  return dailyDigests.digests.map((digest) => ({
    date: digest.date,
    status: digest.status || "已聚合",
    meta: `${digest.tweetCount ?? "-"} 条推文 · ${digest.entityCount ?? digest.entities?.length ?? 0} 个 entity 观察`,
    summary: digest.summary || [],
    signals: (digest.entities || []).map((entity) => entityToSignal(entity, data.signals, data.marketQuotes)),
    sources: digest.sources || digest.tweetCount || 0
  }));
}

function renderDailyCards(data, dailyDigests) {
  document.querySelector("#dailyCards").innerHTML = buildDigestCards(data, dailyDigests)
    .map((card, index) => `
      <article class="daily-card">
        <header class="daily-header">
          <div>
            <div class="date-line">${escapeHtml(card.date)}</div>
            <div class="daily-meta">${escapeHtml(card.meta)}</div>
          </div>
          <span class="status-pill ${index === 0 ? "fresh" : ""}">${escapeHtml(card.status)}</span>
        </header>

        <div class="summary-list">
          ${card.summary.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
        </div>

        <div class="entity-section">
          <div class="entity-title">涉及股票</div>
          <div class="stock-rows">
            ${card.signals.map(renderStockRow).join("")}
          </div>
        </div>

        <footer class="source-row">
          ${Array.from({ length: Math.min(Number(card.sources || card.signals.length), 8) }, (_, sourceIndex) => `<button type="button">Twitter ${sourceIndex + 1}</button>`).join("")}
        </footer>
      </article>
    `)
    .join("");
}

function renderStockRow(signal) {
  const performance = primaryPerformance(signal);
  const displayName = signal.ticker;
  const quoteTicker = performance.primaryTicker && performance.primaryTicker !== displayName
    ? performance.primaryTicker
    : "";
  const subLabel = [quoteTicker, signal.confidence || signal.dimension || ""].filter(Boolean).join(" · ");
  const dailyChange = performance.dailyChangePct;
  const mentionChange = performance.changePct;
  const cumulativeChange = performance.cumulativeChangePct;
  const baselineDate = performance.baselineStartDate || performance.baselineRequestedDate || "2026-03-01";
  const cumulativeStartDate = performance.cumulativeStartDate || todayInShanghai();

  return `
    <div class="stock-row">
      <div class="stock-identity">
        <span class="signal-stance ${stanceClass[signal.stance] || "neutral"}">${escapeHtml(signal.stance)}</span>
        <strong>${escapeHtml(displayName)}</strong>
        <small>${escapeHtml(subLabel)}</small>
      </div>
      <div class="stock-price">${formatPrice(performance.currentPrice, performance.currency)}</div>
      <div class="stock-change ${pctClass(dailyChange)}">
        <span>日涨跌幅</span>
        <strong>${formatPct(dailyChange)}</strong>
      </div>
      <div class="stock-change ${pctClass(mentionChange)}">
        <span>自 ${escapeHtml(baselineDate)}</span>
        <strong>${formatPct(mentionChange)}</strong>
      </div>
      <div class="stock-change ${pctClass(cumulativeChange)}">
        <span>${escapeHtml(cumulativeStartDate)} 起</span>
        <strong>${formatPct(cumulativeChange)}</strong>
      </div>
    </div>
  `;
}

function renderMetrics(data) {
  const summary = data.summary;
  const lastRun = formatDate(data.automation?.lastRunAt);
  const metrics = [
    ["发布内容", summary.published, "+15%"],
    ["股票实体", summary.stockRelated, "+12%"],
    ["高频主题", summary.topTheme, "+0%"],
    ["最近刷新", lastRun, ""]
  ];

  document.querySelector("#metrics").innerHTML = metrics
    .map(([label, value, change]) => `
      <div class="metric">
        <span>${escapeHtml(label)}</span>
        <div><strong>${escapeHtml(value)}</strong>${change ? `<small>${escapeHtml(change)}</small>` : ""}</div>
      </div>
    `)
    .join("");
}

function renderContentTypes(items) {
  const total = items.reduce((sum, item) => sum + Number(item.count || 0), 0);
  document.querySelector("#donutTotal").innerHTML = `${total}<small>全部内容</small>`;
  document.querySelector("#contentTypes").innerHTML = items
    .map((item) => `
      <div class="legend-row">
        <span class="legend-label">
          <span class="legend-dot" style="background:${escapeHtml(item.color)}"></span>
          ${escapeHtml(item.name)}
        </span>
        <strong>${item.percent}% <span>(${item.count})</span></strong>
      </div>
    `)
    .join("");
}

function renderTopics(topics) {
  document.querySelector("#topics").innerHTML = topics
    .map((topic) => `<span class="topic ${topic.tone}">${escapeHtml(topic.name)} ${topic.count}</span>`)
    .join("");
}

function renderStockLeaders(signals) {
  const leaders = [...signals]
    .filter((signal) => Number.isFinite(stockMomentum(signal)))
    .sort((left, right) => stockMomentum(right) - stockMomentum(left))
    .slice(0, 6);

  document.querySelector("#stockLeaders").innerHTML = leaders
    .map((signal) => {
      const performance = primaryPerformance(signal);
      const ticker = performance.primaryTicker || signal.ticker;
      const value = performance.cumulativeChangePct ?? performance.changePct;
      return `
        <div class="leader-row">
          <div>
            <strong>${escapeHtml(ticker)}</strong>
            <span>${escapeHtml(signal.stance)}</span>
          </div>
          <b class="${pctClass(value)}">${formatPct(value)}</b>
        </div>
      `;
    })
    .join("");
}

loadDashboard();
