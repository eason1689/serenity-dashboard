import { readFile, writeFile } from "node:fs/promises";

const SIGNALS_PATH = new URL("./signals.json", import.meta.url);
const START_DATE = "2026-03-01";
const ACCOUNT = "aleabitoreddit";

const SOURCE_URLS = [
  `https://investcopilot.cloud/?days=120&twitter_author=${ACCOUNT}`,
  `https://mobile.twstalker.com/${ACCOUNT}`
];

const QUOTE_SYMBOLS = {
  SIVE: { sourceSymbol: "sive.us", displaySymbol: "SIVE", currency: "USD" },
  AAOI: { sourceSymbol: "aaoi.us", displaySymbol: "AAOI", currency: "USD" },
  LITE: { sourceSymbol: "lite.us", displaySymbol: "LITE", currency: "USD" },
  AXTI: { sourceSymbol: "axti.us", displaySymbol: "AXTI", currency: "USD" },
  IQE: { sourceSymbol: "iqe.uk", displaySymbol: "IQE", currency: "GBP" },
  TSEM: { sourceSymbol: "tsem.us", displaySymbol: "TSEM", currency: "USD" },
  NBIS: { sourceSymbol: "nbis.us", displaySymbol: "NBIS", currency: "USD" },
  LPK: { sourceSymbol: "lpk.de", displaySymbol: "LPK.DE", currency: "EUR" },
  GLW: { sourceSymbol: "glw.us", displaySymbol: "GLW", currency: "USD" },
  ASGLY: { sourceSymbol: "asgly.us", displaySymbol: "ASGLY", currency: "USD" },
  NIDGY: { sourceSymbol: "nidgy.us", displaySymbol: "NIDGY", currency: "USD" },
  RDDT: { sourceSymbol: "rddt.us", displaySymbol: "RDDT", currency: "USD" },
  FLNC: { sourceSymbol: "flnc.us", displaySymbol: "FLNC", currency: "USD" },
  INTC: { sourceSymbol: "intc.us", displaySymbol: "INTC", currency: "USD" },
  MRVL: { sourceSymbol: "mrvl.us", displaySymbol: "MRVL", currency: "USD" },
  TSM: { sourceSymbol: "tsm.us", displaySymbol: "TSM", currency: "USD" },
  COHR: { sourceSymbol: "cohr.us", displaySymbol: "COHR", currency: "USD" },
  RKLB: { sourceSymbol: "rklb.us", displaySymbol: "RKLB", currency: "USD" },
  AVGO: { sourceSymbol: "avgo.us", displaySymbol: "AVGO", currency: "USD" },
  AMZN: { sourceSymbol: "amzn.us", displaySymbol: "AMZN", currency: "USD" },
  GOOGL: { sourceSymbol: "googl.us", displaySymbol: "GOOGL", currency: "USD" },
  META: { sourceSymbol: "meta.us", displaySymbol: "META", currency: "USD" },
  AMKR: { sourceSymbol: "amkr.us", displaySymbol: "AMKR", currency: "USD" },
  JBL: { sourceSymbol: "jbl.us", displaySymbol: "JBL", currency: "USD" },
  FN: { sourceSymbol: "fn.us", displaySymbol: "FN", currency: "USD" },
  SMTC: { sourceSymbol: "smtc.us", displaySymbol: "SMTC", currency: "USD" },
  MU: { sourceSymbol: "mu.us", displaySymbol: "MU", currency: "USD" },
  SNDK: { sourceSymbol: "sndk.us", displaySymbol: "SNDK", currency: "USD" },
  ARM: { sourceSymbol: "arm.us", displaySymbol: "ARM", currency: "USD" },
  MP: { sourceSymbol: "mp.us", displaySymbol: "MP", currency: "USD" },
  LPTH: { sourceSymbol: "lpth.us", displaySymbol: "LPTH", currency: "USD" },
  HIMS: { sourceSymbol: "hims.us", displaySymbol: "HIMS", currency: "USD" },
  HOOD: { sourceSymbol: "hood.us", displaySymbol: "HOOD", currency: "USD" },
  CRCL: { sourceSymbol: "crcl.us", displaySymbol: "CRCL", currency: "USD" },
  FUTU: { sourceSymbol: "futu.us", displaySymbol: "FUTU", currency: "USD" },
  TIGR: { sourceSymbol: "tigr.us", displaySymbol: "TIGR", currency: "USD" },
  IREN: { sourceSymbol: "iren.us", displaySymbol: "IREN", currency: "USD" },
  MSFT: { sourceSymbol: "msft.us", displaySymbol: "MSFT", currency: "USD" },
  CVX: { sourceSymbol: "cvx.us", displaySymbol: "CVX", currency: "USD" },
  XLU: { sourceSymbol: "xlu.us", displaySymbol: "XLU", currency: "USD" },
  POWL: { sourceSymbol: "powl.us", displaySymbol: "POWL", currency: "USD" },
  VPG: { sourceSymbol: "vpg.us", displaySymbol: "VPG", currency: "USD" }
};

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

function htmlToText(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  );
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function toCompactDate(date) {
  return date.replaceAll("-", "");
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toUnixSeconds(dateString) {
  return Math.floor(new Date(`${dateString}T00:00:00Z`).getTime() / 1000);
}

function fromUnixSeconds(seconds) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function candidateTickers(signal) {
  return unique(
    signal.ticker
      .split("/")
      .flatMap((part) => part.split(","))
      .map((part) => part.trim().replace(/^\$/, "").replace(/\(.+\)/g, ""))
      .flatMap((part) => part.split(/\s+/))
      .map((part) => part.replace(/[^\w.]/g, "").replace(/\.DE|\.PA/g, ""))
      .filter((part) => QUOTE_SYMBOLS[part])
  );
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 serenity-dashboard-backfill/1.0",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!response.ok) return { url, ok: false, status: response.status, text: "" };
    return { url, ok: true, status: response.status, text: htmlToText(await response.text()) };
  } catch (error) {
    return { url, ok: false, status: 0, text: "", error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 serenity-dashboard-backfill/1.0",
        "accept": "application/json,text/plain,*/*",
        ...headers
      }
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function findTickerDates(text, ticker) {
  const dates = [];
  const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tickerPattern = new RegExp(`(?:\\$|\\b)${escaped}\\b`, "gi");
  const datePattern = /\b(2026-[01]\d-[0-3]\d)\b/g;
  const normalized = text.replace(/\s+/g, " ");
  let match;

  while ((match = tickerPattern.exec(normalized)) !== null) {
    const start = Math.max(0, match.index - 700);
    const end = Math.min(normalized.length, match.index + 700);
    const window = normalized.slice(start, end);
    const windowDates = [...window.matchAll(datePattern)]
      .map((dateMatch) => dateMatch[1])
      .filter((date) => date >= START_DATE);
    dates.push(...windowDates);
  }

  return unique(dates).sort();
}

async function fetchYahooHistoricalClose(ticker, mentionDate) {
  const config = QUOTE_SYMBOLS[ticker];
  if (!config) return null;

  const symbol = config.displaySymbol;
  const period1 = toUnixSeconds(addDays(mentionDate, -2));
  const period2 = toUnixSeconds(addDays(mentionDate, 12));
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
  const data = await fetchJson(url);
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];

  for (let index = 0; index < timestamps.length; index += 1) {
    const date = fromUnixSeconds(timestamps[index]);
    const price = Number(closes[index]);
    if (date >= mentionDate && Number.isFinite(price) && price > 0) {
      return {
        date,
        price,
        currency: config.currency,
        source: "Yahoo Finance chart daily close",
        displaySymbol: config.displaySymbol
      };
    }
  }

  return null;
}

function parseNasdaqDate(value) {
  const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parsePrice(value) {
  const price = Number(String(value || "").replace(/[$,\s]/g, ""));
  return Number.isFinite(price) && price > 0 ? price : null;
}

async function fetchNasdaqHistoricalClose(ticker, mentionDate) {
  const config = QUOTE_SYMBOLS[ticker];
  if (!config || !config.sourceSymbol.endsWith(".us")) return null;

  const symbol = config.displaySymbol.replace(/\..+$/, "");
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical?assetclass=stocks&fromdate=${mentionDate}&todate=${addDays(mentionDate, 12)}&limit=9999`;
  const data = await fetchJson(url, {
    "referer": `https://www.nasdaq.com/market-activity/stocks/${symbol.toLowerCase()}/historical`
  });
  const rows = data?.data?.tradesTable?.rows || [];

  for (const row of rows) {
    const date = parseNasdaqDate(row.date);
    const price = parsePrice(row.close);
    if (date && date >= mentionDate && price) {
      return {
        date,
        price,
        currency: config.currency,
        source: "Nasdaq historical daily close",
        displaySymbol: config.displaySymbol
      };
    }
  }

  return null;
}

async function fetchStooqHistoricalClose(ticker, mentionDate) {
  const config = QUOTE_SYMBOLS[ticker];
  if (!config) return null;

  const d1 = toCompactDate(mentionDate);
  const d2 = toCompactDate(addDays(mentionDate, 10));
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(config.sourceSymbol)}&d1=${d1}&d2=${d2}&i=d`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 serenity-dashboard-backfill/1.0" }
    });

    if (!response.ok) return null;
    const text = await response.text();
    if (/get your apikey/i.test(text)) return null;
    const rows = text.trim().split(/\r?\n/).slice(1);

    for (const row of rows) {
      const [date, open, high, low, close] = parseCsvLine(row);
      const price = Number(close);
      if (date >= mentionDate && Number.isFinite(price) && price > 0) {
        return {
          date,
          price,
          currency: config.currency,
          source: "Stooq historical daily close",
          displaySymbol: config.displaySymbol
        };
      }
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }

  return null;
}

async function fetchHistoricalClose(ticker, mentionDate) {
  return (
    (await fetchYahooHistoricalClose(ticker, mentionDate)) ||
    (await fetchNasdaqHistoricalClose(ticker, mentionDate)) ||
    (await fetchStooqHistoricalClose(ticker, mentionDate))
  );
}

function upsertPerformance(signal, ticker) {
  if (!signal.performance) {
    signal.performance = {
      primaryTicker: ticker || null,
      firstMentionDate: null,
      firstMentionPrice: null,
      currentPrice: null,
      changePct: null,
      currency: QUOTE_SYMBOLS[ticker]?.currency || "USD",
      priceSource: null,
      priceUpdatedAt: null
    };
  }
}

function recalcChange(performance) {
  const basePrice = Number(performance.firstMentionPrice ?? performance.firstTrackedPrice);
  const currentPrice = Number(performance.currentPrice);
  if (Number.isFinite(basePrice) && basePrice > 0 && Number.isFinite(currentPrice) && currentPrice > 0) {
    performance.changePct = ((currentPrice - basePrice) / basePrice) * 100;
  }
}

async function main() {
  const data = JSON.parse(await readFile(SIGNALS_PATH, "utf8"));
  const sources = await Promise.all(SOURCE_URLS.map(fetchText));
  const sourceText = sources.map((source) => source.text).join(" ");
  const report = [];

  for (const signal of data.signals) {
    const tickers = candidateTickers(signal);
    const primary = tickers[0];
    upsertPerformance(signal, primary);

    if (!primary) {
      signal.performance.backfillStatus = "skipped";
      signal.performance.backfillNote = "没有可映射到行情源的主 ticker。";
      report.push({ ticker: signal.ticker, status: "skipped:no-primary" });
      continue;
    }

    if (signal.performance.firstMentionDate && signal.performance.firstMentionPrice) {
      recalcChange(signal.performance);
      report.push({ ticker: signal.ticker, primary, status: "kept" });
      continue;
    }

    const mentionDates = tickers
      .flatMap((ticker) => findTickerDates(sourceText, ticker))
      .filter((date) => date >= START_DATE)
      .sort();
    const firstMentionDate = mentionDates[0] || signal.updatedAt || START_DATE;
    await sleep(700);
    const price = await fetchHistoricalClose(primary, firstMentionDate);

    signal.performance.primaryTicker = QUOTE_SYMBOLS[primary].displaySymbol;
    signal.performance.backfillStartDate = START_DATE;
    signal.performance.currency = price?.currency || signal.performance.currency || QUOTE_SYMBOLS[primary].currency;

    if (price?.price) {
      signal.performance.backfillStatus = mentionDates[0] ? "auto-inferred" : "fallback-updatedAt";
      signal.performance.firstMentionDate = price.date;
      signal.performance.firstMentionPrice = price.price;
      signal.performance.firstMentionPriceSource = price.source;
      signal.performance.backfillNote = mentionDates[0]
        ? "首次提及日期由公开源上下文自动推断，建议人工复核关键标的。"
        : "未能在公开源中定位 2026-03-01 以来的明确首次提及日期，暂用现有 updatedAt 或起始日回填。";
      recalcChange(signal.performance);
    } else {
      signal.performance.backfillStatus = "price-unavailable";
      signal.performance.backfillCandidateDate = firstMentionDate;
      signal.performance.backfillNote = "已找到候选日期，但行情源未返回可用历史收盘价；未覆盖首次提及日期和价格。";
    }

    report.push({
      ticker: signal.ticker,
      primary,
      status: signal.performance.backfillStatus,
      firstMentionDate: signal.performance.firstMentionDate,
      firstMentionPrice: signal.performance.firstMentionPrice
    });
  }

  data.backfill = {
    startDate: START_DATE,
    lastRunAt: new Date().toISOString(),
    sourceStatus: sources.map((source) => ({
      url: source.url,
      ok: source.ok,
      status: source.status,
      error: source.error
    })),
    note: "首次提及日期由公开源自动推断；对高价值标的建议人工复核原推。"
  };

  await writeFile(SIGNALS_PATH, `${JSON.stringify(data, null, 2)}\n`);
  console.log(JSON.stringify({ sources: data.backfill.sourceStatus, report }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
