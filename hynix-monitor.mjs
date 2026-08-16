import { readFile, writeFile } from "node:fs/promises";
import {
  EXPAND_STEP,
  determineSignal,
  hkDateString,
  inHkTradingSession,
  rearmSignalsIfNeeded,
  shouldNotify
} from "./hynix-monitor-lib.mjs";
import { sendPushPlus } from "./pushplus.mjs";

const TOKEN = process.env.PUSHPLUS_TOKEN;
const STATE_PATH = new URL("./hynix-monitor-state.json", import.meta.url);
const HK_MAX_QUOTE_AGE_MINUTES = 20;
const FETCH_RETRY_DELAYS_MS = [0, 750, 1500];
const HK_SYMBOL = "7709.HK";
const KR_SYMBOL = "000660.KS";
const SOURCE_NAME = "Yahoo Finance chart API";
const SOURCE_LINKS = [
  "https://finance.yahoo.com/quote/7709.HK",
  "https://finance.yahoo.com/quote/000660.KS"
];

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

async function fetchChartOnce(symbol) {
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

async function fetchChart(symbol) {
  let lastError;

  for (const delayMs of FETCH_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      return await fetchChartOnce(symbol);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function minutesAgo(timestampSeconds) {
  return (Date.now() - timestampSeconds * 1000) / 60000;
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
    `**行情延迟提示：** 港股免费行情通常约延迟 15 分钟，本提醒不是实时成交价。`,
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

  if (hkQuoteDate !== hkToday || hkAge > HK_MAX_QUOTE_AGE_MINUTES) {
    console.log(`跳过：07709.HK 行情超过 ${HK_MAX_QUOTE_AGE_MINUTES} 分钟有效窗口，可能休市、半日市、暂停交易或行情延迟。07709 时间 ${formatTime(hk.time)}，距今 ${hkAge.toFixed(1)} 分钟。`);
    await writeState(state);
    return;
  }

  const theoreticalPct = 2 * kr.pct;
  const deviationPct = hk.pct - theoreticalPct;
  const signal = determineSignal(deviationPct);

  const krClosed = kr.marketState === "CLOSED" || minutesAgo(kr.time) > 45;
  const krClosedNote = krClosed ? "000660 已收盘，理论值基于 000660 收盘涨跌幅。" : "";

  if (!signal) {
    rearmSignalsIfNeeded(state, deviationPct);
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
  await sendPushPlus({
    token: TOKEN,
    title: "海力士07709做T提醒",
    content
  });
  console.log(`已推送：${signal.type} deviation_pct=${pct(deviationPct)}，000660=${pct(kr.pct)}，07709=${pct(hk.pct)}。`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
