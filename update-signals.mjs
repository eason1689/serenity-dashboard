import { readFile, writeFile } from "node:fs/promises";

const SIGNALS_PATH = new URL("./signals.json", import.meta.url);
const DASHBOARD_URL = "https://eason1689.github.io/serenity-dashboard/";
const ACCOUNT = "@aleabitoreddit";
const HISTORICAL_BASELINE_DATE = "2026-03-01";

const SOURCE_URLS = [
  "https://mobile.twstalker.com/aleabitoreddit",
  "https://investcopilot.cloud/?days=30&twitter_author=aleabitoreddit"
];

const WATCHLIST = [
  "SIVE", "AAOI", "LITE", "AXTI", "IQE", "TSEM", "NBIS", "LPK", "GLW",
  "ASGLY", "NIDGY", "RDDT", "FLNC", "INTC", "MRVL", "TSM", "COHR",
  "RKLB", "AVGO", "QCOM", "NVDA", "COIN", "2454.TW", "SOI", "AMZN", "GOOGL", "META", "AMKR", "JBL", "FN", "SMTC",
  "MU", "SNDK", "ARM", "MP", "LPTH", "HIMS", "HOOD", "CRCL", "FUTU",
  "TIGR", "IREN", "MSFT", "CVX", "XLU", "POWL", "VPG"
];

const TOPIC_HINTS = [
  { name: "CPO/光子学", tickers: ["SIVE", "AAOI", "LITE", "AXTI", "IQE", "COHR"] },
  { name: "AI 半导体", tickers: ["MRVL", "TSM", "AVGO", "ARM", "INTC", "TSEM"] },
  { name: "先进封装", tickers: ["AMKR", "JBL", "FN", "SMTC", "GLW", "LPK"] },
  { name: "Neocloud", tickers: ["NBIS", "IREN"] },
  { name: "国防/太空", tickers: ["RKLB"] }
];

const QUOTE_SYMBOLS = {
  SIVE: { sourceSymbol: "sive.se", displaySymbol: "SIVE.ST", currency: "SEK" },
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
  QCOM: { sourceSymbol: "qcom.us", displaySymbol: "QCOM", currency: "USD" },
  NVDA: { sourceSymbol: "nvda.us", displaySymbol: "NVDA", currency: "USD" },
  COIN: { sourceSymbol: "coin.us", displaySymbol: "COIN", currency: "USD" },
  "2454.TW": { sourceSymbol: "2454.tw", displaySymbol: "2454.TW", currency: "TWD" },
  SOI: { sourceSymbol: "soi.fr", displaySymbol: "SOI.PA", currency: "EUR" },
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

function todayInShanghai() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dateNDaysAgoShanghai(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function partsInTimeZone(timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const get = (type) => parts.find((part) => part.type === type)?.value;
  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

function isSerenityCheckWindow() {
  if (process.env.GITHUB_EVENT_NAME !== "schedule") return true;

  const now = partsInTimeZone("America/New_York");
  if (["Sat", "Sun"].includes(now.weekday)) return false;

  const minutes = now.hour * 60 + now.minute;
  const start = 8 * 60 + 30;
  const end = 13 * 60;
  return minutes >= start && minutes <= end;
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

function primaryTicker(signal) {
  const candidates = signal.ticker
    .split("/")
    .flatMap((part) => part.split(","))
    .map((part) => part.trim().replace(/^\$/, "").replace(/\s.+$/, "").replace(/\(.+\)/, ""))
    .filter(Boolean);

  return candidates.find((ticker) => QUOTE_SYMBOLS[ticker.replace(/\.DE|\.PA/g, "")])
    ?.replace(/\.DE|\.PA/g, "");
}

async function fetchQuote(ticker) {
  const config = QUOTE_SYMBOLS[ticker];
  if (!config) return null;

  const yahooQuote = await fetchYahooQuote(ticker);
  if (yahooQuote) return yahooQuote;

  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(config.sourceSymbol)}&f=sd2t2ohlcv&h&e=csv`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 serenity-dashboard-updater/1.0" }
    });

    if (!response.ok) return null;
    const lines = (await response.text()).trim().split(/\r?\n/);
    if (lines.length < 2) return null;

    const [symbol, date, time, open, high, low, close, volume] = parseCsvLine(lines[1]);
    const price = Number(close);
    if (!Number.isFinite(price) || price <= 0) return null;

    return {
      ticker,
      displaySymbol: config.displaySymbol,
      currency: config.currency,
      price,
      priceSource: "Stooq",
      priceUpdatedAt: `${date} ${time}`,
      sourceSymbol: symbol,
      volume
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchYahooQuote(ticker) {
  const config = QUOTE_SYMBOLS[ticker];
  if (!config) return null;

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.displaySymbol)}?range=5d&interval=1d&includePrePost=false`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 serenity-dashboard-updater/1.0",
        "accept": "application/json,text/plain,*/*"
      }
    });

    if (!response.ok) return null;
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta || {};
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const validCloses = closes
      .map((close, index) => ({ price: Number(close), timestamp: timestamps[index] }))
      .filter((item) => Number.isFinite(item.price) && item.price > 0);

    const price = Number(meta.regularMarketPrice ?? validCloses.at(-1)?.price);
    if (!Number.isFinite(price) || price <= 0) return null;

    const previousClose = Number(meta.chartPreviousClose ?? validCloses.at(-2)?.price);
    const dailyChange = Number.isFinite(previousClose) && previousClose > 0
      ? price - previousClose
      : null;
    const dailyChangePct = dailyChange === null ? null : (dailyChange / previousClose) * 100;
    const updatedAt = Number(meta.regularMarketTime)
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : (validCloses.at(-1)?.timestamp ? new Date(validCloses.at(-1).timestamp * 1000).toISOString() : null);

    return {
      ticker,
      displaySymbol: config.displaySymbol,
      currency: meta.currency || config.currency,
      price,
      previousClose: Number.isFinite(previousClose) && previousClose > 0 ? previousClose : null,
      dailyChange,
      dailyChangePct,
      priceSource: "Yahoo Finance",
      priceUpdatedAt: updatedAt,
      sourceSymbol: meta.symbol || config.displaySymbol,
      volume: meta.regularMarketVolume ?? null
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchYahooHistoricalBaseline(ticker) {
  const config = QUOTE_SYMBOLS[ticker];
  if (!config) return null;

  const period1 = toUnixSeconds(HISTORICAL_BASELINE_DATE);
  const period2 = toUnixSeconds(addDays(HISTORICAL_BASELINE_DATE, 14));
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.displaySymbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 serenity-dashboard-updater/1.0",
        "accept": "application/json,text/plain,*/*"
      }
    });

    if (!response.ok) return null;
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];

    for (let index = 0; index < timestamps.length; index += 1) {
      const date = fromUnixSeconds(timestamps[index]);
      const price = Number(closes[index]);
      if (date >= HISTORICAL_BASELINE_DATE && Number.isFinite(price) && price > 0) {
        return {
          date,
          price,
          currency: config.currency,
          source: "Yahoo Finance chart daily close"
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

async function fetchStooqHistoricalBaseline(ticker) {
  const config = QUOTE_SYMBOLS[ticker];
  if (!config) return null;

  const d1 = toCompactDate(HISTORICAL_BASELINE_DATE);
  const d2 = toCompactDate(addDays(HISTORICAL_BASELINE_DATE, 14));
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(config.sourceSymbol)}&d1=${d1}&d2=${d2}&i=d`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 serenity-dashboard-updater/1.0" }
    });

    if (!response.ok) return null;
    const lines = (await response.text()).trim().split(/\r?\n/).slice(1);
    for (const line of lines) {
      const [date, open, high, low, close, volume] = parseCsvLine(line);
      const price = Number(close);
      if (date >= HISTORICAL_BASELINE_DATE && Number.isFinite(price) && price > 0) {
        return {
          date,
          price,
          currency: config.currency,
          source: "Stooq historical daily close"
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

async function fetchHistoricalBaseline(ticker) {
  return (await fetchYahooHistoricalBaseline(ticker)) || (await fetchStooqHistoricalBaseline(ticker));
}

function updateHistoricalChange(performance, currentPrice, baseline) {
  if (baseline) {
    performance.baselineRequestedDate = HISTORICAL_BASELINE_DATE;
    performance.baselineStartDate = baseline.date;
    performance.baselineStartPrice = baseline.price;
    performance.baselinePriceSource = baseline.source;
  }

  const basePrice = Number(performance.baselineStartPrice);
  if (Number.isFinite(currentPrice) && currentPrice > 0 && Number.isFinite(basePrice) && basePrice > 0) {
    performance.changePct = ((currentPrice - basePrice) / basePrice) * 100;
  }
}

async function mapLimit(items, limit, mapper) {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const promise = Promise.resolve().then(() => mapper(item));
    results.push(promise);
    executing.add(promise);
    promise.finally(() => executing.delete(promise));

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

async function updatePerformance(data, today) {
  const tickers = [...new Set([...WATCHLIST, ...data.signals.map(primaryTicker).filter(Boolean)])];
  const quotes = new Map();
  const baselines = new Map();

  await mapLimit(tickers, 6, async (ticker) => {
    const [quote, baseline] = await Promise.all([
      fetchQuote(ticker),
      fetchHistoricalBaseline(ticker)
    ]);
    if (quote) quotes.set(ticker, quote);
    if (baseline) baselines.set(ticker, baseline);
  });

  data.marketQuotes ||= {};
  for (const ticker of tickers) {
    const quote = quotes.get(ticker);
    const baseline = baselines.get(ticker);
    const previous = data.marketQuotes[ticker] || {};
    const currentPrice = Number(quote?.price ?? previous.currentPrice);
    const marketQuote = {
      ...previous,
      primaryTicker: quote?.displaySymbol || previous.primaryTicker || QUOTE_SYMBOLS[ticker]?.displaySymbol || ticker,
      currency: quote?.currency || previous.currency || QUOTE_SYMBOLS[ticker]?.currency || "USD",
      currentPrice: Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null,
      previousClose: quote?.previousClose ?? previous.previousClose ?? null,
      dailyChange: quote?.dailyChange ?? previous.dailyChange ?? null,
      dailyChangePct: quote?.dailyChangePct ?? previous.dailyChangePct ?? null,
      priceSource: quote?.priceSource || previous.priceSource || null,
      priceUpdatedAt: quote?.priceUpdatedAt || previous.priceUpdatedAt || null
    };

    updateHistoricalChange(marketQuote, marketQuote.currentPrice, baseline);
    if (marketQuote.currentPrice) {
      marketQuote.cumulativeStartDate ||= today;
      marketQuote.cumulativeStartPrice ??= marketQuote.currentPrice;
      const cumulativeBasePrice = Number(marketQuote.cumulativeStartPrice);
      if (Number.isFinite(cumulativeBasePrice) && cumulativeBasePrice > 0) {
        marketQuote.cumulativeChangePct = ((marketQuote.currentPrice - cumulativeBasePrice) / cumulativeBasePrice) * 100;
      }
    }

    data.marketQuotes[ticker] = marketQuote;
  }

  for (const signal of data.signals) {
    const ticker = primaryTicker(signal);
    const quote = quotes.get(ticker);

    if (!signal.performance) {
      signal.performance = {
        primaryTicker: ticker || null,
        firstMentionDate: signal.firstMentionDate || null,
        firstMentionPrice: signal.firstMentionPrice ?? null,
        currentPrice: null,
        changePct: null,
        currency: quote?.currency || "USD",
        priceSource: quote?.priceSource || null,
        priceUpdatedAt: null,
        note: "历史首次提及日期和价格需要按原推回填；自动化会从新增标的开始记录首次追踪价。"
      };
    }

    if (!ticker || !quote) {
      const existingPrice = Number(signal.performance.currentPrice);
      if (Number.isFinite(existingPrice) && existingPrice > 0) {
        updateHistoricalChange(signal.performance, existingPrice, ticker ? baselines.get(ticker) : null);
        signal.performance.cumulativeStartDate ||= today;
        signal.performance.cumulativeStartPrice ??= existingPrice;
        const cumulativeBasePrice = Number(signal.performance.cumulativeStartPrice);
        if (Number.isFinite(cumulativeBasePrice) && cumulativeBasePrice > 0) {
          signal.performance.cumulativeChangePct = ((existingPrice - cumulativeBasePrice) / cumulativeBasePrice) * 100;
        }
      }
      continue;
    }

    signal.performance.primaryTicker = quote.displaySymbol;
    signal.performance.currency = quote.currency;
    signal.performance.currentPrice = quote.price;
    signal.performance.previousClose = quote.previousClose ?? signal.performance.previousClose ?? null;
    signal.performance.dailyChange = quote.dailyChange ?? signal.performance.dailyChange ?? null;
    signal.performance.dailyChangePct = quote.dailyChangePct ?? signal.performance.dailyChangePct ?? null;
    signal.performance.priceSource = quote.priceSource;
    signal.performance.priceUpdatedAt = quote.priceUpdatedAt;

    if (!signal.performance.firstMentionDate && !signal.performance.firstMentionPrice) {
      signal.performance.firstTrackedDate ||= today;
      signal.performance.firstTrackedPrice ??= quote.price;
    }

    updateHistoricalChange(signal.performance, quote.price, baselines.get(ticker));

    signal.performance.cumulativeStartDate ||= today;
    signal.performance.cumulativeStartPrice ??= quote.price;
    const cumulativeBasePrice = Number(signal.performance.cumulativeStartPrice);
    if (Number.isFinite(cumulativeBasePrice) && cumulativeBasePrice > 0) {
      signal.performance.cumulativeChangePct = ((quote.price - cumulativeBasePrice) / cumulativeBasePrice) * 100;
    }
  }
}

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

async function fetchSource(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 serenity-dashboard-updater/1.0",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      return { url, ok: false, status: response.status, text: "" };
    }

    return { url, ok: true, status: response.status, text: htmlToText(await response.text()) };
  } catch (error) {
    return { url, ok: false, status: 0, text: "", error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

function countTickerMentions(text) {
  const counts = new Map();
  const upperText = text.toUpperCase();

  for (const ticker of WATCHLIST) {
    const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?:\\$|\\b)${escaped}\\b`, "g");
    const matches = upperText.match(pattern);
    if (matches?.length) {
      counts.set(ticker, matches.length);
    }
  }

  return counts;
}

function signalMentionsTicker(signal, ticker) {
  return signal.ticker
    .split("/")
    .map((part) => part.trim().replace(/\.DE|\.PA/g, ""))
    .some((part) => part === ticker || part.includes(` ${ticker}`) || part.includes(ticker));
}

function mergeSignals(data, counts, today) {
  let changed = false;
  const touchedTickers = [];

  for (const [ticker, count] of counts) {
    const signal = data.signals.find((item) => signalMentionsTicker(item, ticker));

    if (signal) {
      const nextObservations = Math.max(signal.observations ?? 0, count);
      const nextSourceCount = Math.max(signal.sourceCount ?? 0, count);
      const hasTickerUpdate = nextObservations !== signal.observations || nextSourceCount !== signal.sourceCount;
      if (hasTickerUpdate) {
        signal.observations = nextObservations;
        signal.sourceCount = nextSourceCount;
        changed = true;
        touchedTickers.push(ticker);
      }
      if (hasTickerUpdate && signal.updatedAt !== today) {
        signal.updatedAt = today;
        changed = true;
      }
    } else {
      data.signals.push({
        ticker,
        stance: "中性",
        confidence: "自动发现",
        dimension: "个股",
        summary: `自动更新在近30天公开源中发现 ${ACCOUNT} 提及 ${ticker}。该条目尚未人工归纳立场，先标记为观察项，等待后续确认。`,
        observations: count,
        sourceCount: count,
        updatedAt: today,
        performance: {
          primaryTicker: ticker,
          firstMentionDate: today,
          firstMentionPrice: null,
          currentPrice: null,
          changePct: null,
          currency: QUOTE_SYMBOLS[ticker]?.currency || "USD",
          priceSource: null,
          priceUpdatedAt: null,
          note: "自动发现的新标的；首次提及价将在行情源可用时补齐。"
        }
      });
      touchedTickers.push(ticker);
      changed = true;
    }
  }

  return { changed, touchedTickers };
}

function updateSummary(data, today, touchedTickers, sourceResults) {
  const start = dateNDaysAgoShanghai(30);
  data.summary.date = `${start} 至 ${today}`;
  data.summary.filteredItems = data.signals.length;
  data.summary.stockRelated = data.signals.length;
  data.summary.published = data.signals.length;
  data.summary.totalItems = Math.max(data.summary.totalItems ?? 0, data.signals.length);

  const topicScores = TOPIC_HINTS.map((topic) => ({
    name: topic.name,
    count: topic.tickers.reduce((sum, ticker) => sum + (touchedTickers.includes(ticker) ? 1 : 0), 0)
  })).sort((a, b) => b.count - a.count);

  if (topicScores[0]?.count > 0) {
    data.summary.topTheme = topicScores[0].name;
  }

  data.filters.stance = [
    { name: "强看多", count: data.signals.filter((item) => item.stance === "强看多").length, tone: "strongBull" },
    { name: "看多", count: data.signals.filter((item) => item.stance === "看多").length, tone: "bull" },
    { name: "中性", count: data.signals.filter((item) => item.stance === "中性").length, tone: "neutral" },
    { name: "谨慎", count: data.signals.filter((item) => item.stance === "谨慎").length, tone: "caution" },
    { name: "看空", count: data.signals.filter((item) => item.stance === "看空").length, tone: "bear" }
  ];

  data.filters.dimensions = [
    { name: "宏观", count: data.signals.filter((item) => item.dimension === "宏观").length },
    { name: "行业", count: data.signals.filter((item) => item.dimension === "行业").length },
    { name: "个股", count: data.signals.filter((item) => item.dimension === "个股").length },
    { name: "概念", count: data.signals.filter((item) => item.dimension === "概念").length }
  ];

  data.automation = {
    lastRunAt: new Date().toISOString(),
    account: ACCOUNT,
    sourceStatus: sourceResults.map((source) => ({
      url: source.url,
      ok: source.ok,
      status: source.status
    })),
    touchedTickers
  };
}

async function sendPushPlus(data, touchedTickers) {
  const token = process.env.PUSHPLUS_TOKEN;
  if (!token || touchedTickers.length === 0) return;

  const title = `Serenity Dashboard 已更新｜${data.summary.date}`;
  const tickers = touchedTickers.length ? touchedTickers.slice(0, 12).join(", ") : "无新增高频标的";
  const content = `
    <h2>Serenity 股票情报看板已更新</h2>
    <p><strong>日期：</strong>${data.summary.date}</p>
    <p><strong>信号卡：</strong>${data.signals.length}</p>
    <p><strong>本次触达标的：</strong>${tickers}</p>
    <p><strong>高频主题：</strong>${data.summary.topTheme}</p>
    <p><a href="${DASHBOARD_URL}">打开 Dashboard</a></p>
    <p style="color:#8a6d00">仅做公开信息整理，不构成投资建议。</p>
  `;

  await fetch("https://www.pushplus.plus/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, title, content, template: "html" })
  });
}

async function main() {
  if (!isSerenityCheckWindow()) {
    console.log(JSON.stringify({
      skipped: true,
      reason: "Outside Serenity US-market check window: 08:30-13:00 America/New_York."
    }, null, 2));
    return;
  }

  const today = todayInShanghai();
  const data = JSON.parse(await readFile(SIGNALS_PATH, "utf8"));
  const sourceResults = await Promise.all(SOURCE_URLS.map(fetchSource));

  const counts = new Map();
  for (const source of sourceResults) {
    for (const [ticker, count] of countTickerMentions(source.text)) {
      counts.set(ticker, (counts.get(ticker) ?? 0) + count);
    }
  }

  const { changed, touchedTickers } = mergeSignals(data, counts, today);
  await updatePerformance(data, today);
  updateSummary(data, today, touchedTickers, sourceResults);

  await writeFile(SIGNALS_PATH, `${JSON.stringify(data, null, 2)}\n`);
  await sendPushPlus(data, touchedTickers);

  console.log(JSON.stringify({
    changed,
    touchedTickers,
    sources: sourceResults.map((source) => ({ url: source.url, ok: source.ok, status: source.status }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
