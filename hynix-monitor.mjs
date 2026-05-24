import { readFile, writeFile } from "node:fs/promises";

const TOKEN = process.env.PUSHPLUS_TOKEN;
const STATE_PATH = new URL("./hynix-monitor-state.json", import.meta.url);
const THRESHOLD = 1.0;
const REARM_ABS = 0.5;
const EXPAND_STEP = 0.5;
const HK_SYMBOL = "07709.HK";
const KR_SYMBOL = "000660.KS";
const SOURCE_NAME = "Yahoo Finance chart API";
const SOURCE_LINKS = [
  "https://finance.yahoo.com/quote/07709.HK",
  "https://finance.yahoo.com/quote/000660.KS"
];

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second"))
  };
}

function hkDateString(date = new Date()) {
  const parts = zonedParts(date, "Asia/Hong_Kong");
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatTime(timestampSeconds, timeZone = "Asia/Hong_Kong") {
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(timestampSeconds * 1000));
}

function isWeekday(parts) {
  return !["Sat", "Sun"].includes(parts.weekday);
}

function inHkTradingSession(now = new Date()) {
  const parts = zonedParts(now, "Asia/Hong_Kong");
  const minutes = parts.hour * 60 + parts.minute;
  const morning = minutes >= 9 * 60 + 30 && minutes <= 12 * 60;
  const afternoon = minutes >= 13 * 60 && minutes <= 16 * 60;

  return {
    active: isWeekday(parts) && (morning || afternoon),
    reason: isWeekday(parts)
      ? "非港股连续交易时段或午休"
      : "香港周末非交易日",
    hkNow: `${parts.year}-${parts.month}-${parts.day} ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
  };
}

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8"));
  } catch {
    return {
      date: "",
      signals: {
        strong: { armed: true, lastDeviation: null },
        weak: { armed: true, lastDeviation: null }
      }
    };
  }
}

async function writeState(state) {
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m&includePrePost=false`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 hynix-monitor/1.0",
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`${symbol} 行情请求失败：HTTP ${response.status}`);
  }

  const body = await response.json();
  const result = body.chart?.result?.[0];
  if (!result) {
    throw new Error(`${symbol} 无行情结果`);
  }

  const meta = result.meta ?? {};
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  let lastIndex = -1;

  for (let i = closes.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(closes[i])) {
      lastIndex = i;
      break;
    }
  }

  const price = Number.isFinite(meta.regularMarketPrice)
    ? meta.regularMarketPrice
    : closes[lastIndex];
  const time = Number.isFinite(meta.regularMarketTime)
    ? meta.regularMarketTime
    : timestamps[lastIndex];
  const previousClose = Number.isFinite(meta.chartPreviousClose)
    ? meta.chartPreviousClose
    : meta.previousClose;

  if (!Number.isFinite(price) || !Number.isFinite(previousClose) || !Number.isFinite(time)) {
    throw new Error(`${symbol} 行情字段不足`);
  }

  return {
    symbol,
    price,
    previousClose,
    pct: ((price - previousClose) / previousClose) * 100,
    time,
    marketState: meta.marketState ?? "UNKNOWN",
    exchangeTimezoneName: meta.exchangeTimezoneName ?? "Asia/Hong_Kong"
  };
}

function minutesAgo(timestampSeconds) {
  return (Date.now() - timestampSeconds * 1000) / 60000;
}

function determineSignal(deviation) {
  if (deviation >= THRESHOLD) {
    return {
      direction: "strong",
      type: "偏强卖出观察",
      headline: "07709 偏强/跌幅不足/涨幅过高",
      explanation: "07709 相对 000660.KS 的 2x 理论值偏贵；若日内持有 07709，可关注做 T 减仓或卖出机会。"
    };
  }

  if (deviation <= -THRESHOLD) {
    return {
      direction: "weak",
      type: "偏弱买入观察",
      headline: "07709 偏弱/跌过头/涨幅不足",
      explanation: "07709 相对 000660.KS 的 2x 理论值偏便宜；可关注买入、买回或加回机会。"
    };
  }

  return null;
}

function shouldNotify(state, signal, deviation) {
  const entry = state.signals[signal.direction] ?? { armed: true, lastDeviation: null };
  const absDeviation = Math.abs(deviation);

  if (absDeviation < REARM_ABS) {
    entry.armed = true;
    entry.lastDeviation = null;
    state.signals[signal.direction] = entry;
    return false;
  }

  if (entry.armed) {
    entry.armed = false;
    entry.lastDeviation = deviation;
    state.signals[signal.direction] = entry;
    return true;
  }

  const expanded = signal.direction === "strong"
    ? deviation >= entry.lastDeviation + EXPAND_STEP
    : deviation <= entry.lastDeviation - EXPAND_STEP;

  if (expanded) {
    entry.lastDeviation = deviation;
    state.signals[signal.direction] = entry;
    return true;
  }

  return false;
}

function pct(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function markdownBody({ signal, kr, hk, theoreticalPct, deviationPct, krClosedNote }) {
  return [
    `# 海力士07709做T提醒`,
    ``,
    `**信号类型：** ${signal.type}`,
    ``,
    `| 项目 | 数值 |`,
    `|---|---:|`,
    `| 000660.KS 当日涨跌幅 | ${pct(kr.pct)} |`,
    `| 07709.HK 当日涨跌幅 | ${pct(hk.pct)} |`,
    `| 07709 理论 2x 涨跌幅 | ${pct(theoreticalPct)} |`,
    `| 偏差 deviation_pct | ${pct(deviationPct)} |`,
    ``,
    `**000660.KS 最新价：** ${kr.price.toLocaleString("en-US")} KRW`,
    ``,
    `**000660.KS 数据时间：** ${formatTime(kr.time, "Asia/Seoul")}（韩国时间）`,
    ``,
    `**07709.HK 最新价：** ${hk.price.toLocaleString("en-US")} HKD`,
    ``,
    `**07709.HK 数据时间：** ${formatTime(hk.time, "Asia/Hong_Kong")}（香港时间）`,
    ``,
    krClosedNote ? `**状态标注：** ${krClosedNote}` : "",
    ``,
    `**行情源：** ${SOURCE_NAME}`,
    ``,
    SOURCE_LINKS.map((link) => `- ${link}`).join("\n"),
    ``,
    `**简短解释：** ${signal.headline}。${signal.explanation}`,
    ``,
    `**风险提示：** 07709 是 2x 日内杠杆产品，存在复利、跟踪误差、汇率、流动性和买卖价差风险；本提醒只做偏差监控，不构成投资建议。`
  ].filter(Boolean).join("\n");
}

async function pushPlus(content) {
  if (!TOKEN) {
    throw new Error("触发信号但未配置 PUSHPLUS_TOKEN");
  }

  const response = await fetch("https://www.pushplus.plus/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: TOKEN,
      title: "海力士07709做T提醒",
      content,
      template: "markdown"
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`PushPlus 推送失败：HTTP ${response.status} ${text}`);
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { code: response.status, msg: text };
  }

  if (body.code !== 200) {
    throw new Error(`PushPlus 推送失败：${body.msg ?? text}`);
  }

  return body;
}

async function main() {
  const session = inHkTradingSession();
  if (!session.active) {
    console.log(`跳过：${session.reason}。香港时间 ${session.hkNow}`);
    return;
  }

  const hkToday = hkDateString();
  const state = await readState();
  if (state.date !== hkToday) {
    state.date = hkToday;
    state.signals = {
      strong: { armed: true, lastDeviation: null },
      weak: { armed: true, lastDeviation: null }
    };
  }

  const [kr, hk] = await Promise.all([fetchChart(KR_SYMBOL), fetchChart(HK_SYMBOL)]);
  const hkAge = minutesAgo(hk.time);
  const hkQuoteDate = hkDateString(new Date(hk.time * 1000));

  if (hkQuoteDate !== hkToday || hkAge > 35) {
    console.log(`跳过：07709.HK 行情非当前港股交易时段实时数据，可能休市、半日市、暂停交易或行情延迟。07709 时间 ${formatTime(hk.time)}，距今 ${hkAge.toFixed(1)} 分钟。`);
    await writeState(state);
    return;
  }

  const theoreticalPct = 2 * kr.pct;
  const deviationPct = hk.pct - theoreticalPct;
  const signal = determineSignal(deviationPct);

  const krClosed = kr.marketState === "CLOSED" || minutesAgo(kr.time) > 45;
  const krClosedNote = krClosed ? "000660 已收盘，理论值基于 000660 收盘涨跌幅。" : "";

  if (!signal) {
    if (Math.abs(deviationPct) < REARM_ABS) {
      state.signals.strong = { armed: true, lastDeviation: null };
      state.signals.weak = { armed: true, lastDeviation: null };
    }
    await writeState(state);
    console.log(`未触发：deviation_pct=${pct(deviationPct)}，000660=${pct(kr.pct)} @ ${formatTime(kr.time, "Asia/Seoul")}，07709=${pct(hk.pct)} @ ${formatTime(hk.time)}。`);
    return;
  }

  const notify = shouldNotify(state, signal, deviationPct);
  await writeState(state);

  if (!notify) {
    console.log(`未重复推送：${signal.type} deviation_pct=${pct(deviationPct)}，未较上次扩大 ${EXPAND_STEP.toFixed(1)} 个百分点，且未重新武装。数据时间 000660=${formatTime(kr.time, "Asia/Seoul")}，07709=${formatTime(hk.time)}。`);
    return;
  }

  const content = markdownBody({ signal, kr, hk, theoreticalPct, deviationPct, krClosedNote });
  await pushPlus(content);
  console.log(`已推送：${signal.type} deviation_pct=${pct(deviationPct)}，000660=${pct(kr.pct)}，07709=${pct(hk.pct)}。`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
