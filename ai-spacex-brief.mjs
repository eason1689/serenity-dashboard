const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN;
const TITLE = "AI股票与SpaceX每日简报";
const AI_TICKERS = [
  "NVDA", "AMD", "AVGO", "TSM", "ASML", "MU", "MSFT", "GOOGL", "AMZN",
  "META", "ORCL", "PLTR", "SNOW", "CRM", "NOW", "VRT", "ETN", "PWR",
  "CEG", "VST"
];

const AI_QUERIES = [
  "AI stocks Nvidia AMD Broadcom TSMC ASML Micron Microsoft Google Amazon Meta Oracle Palantir Snowflake Salesforce ServiceNow Vertiv Eaton Quanta CEG VST",
  "artificial intelligence chips data center power stocks earnings regulation supply chain",
  "Nvidia AMD Broadcom AI accelerator earnings product launch regulation"
];

const SPACEX_QUERIES = [
  "SpaceX Starship Starlink Falcon launch NASA defense contract valuation funding",
  "SpaceX NASA contract national security launch Starlink latest",
  "Starship launch Starlink satellite SpaceX funding valuation"
];

function dateInShanghai() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(new Date());
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

function stripGoogleRedirect(url) {
  try {
    const parsed = new URL(url);
    const direct = parsed.searchParams.get("url");
    return direct || url;
  } catch {
    return url;
  }
}

function parseRss(xml, limit = 8) {
  const items = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  for (const block of blocks) {
    const title = decodeHtml(block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/)?.[1] ?? block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const link = stripGoogleRedirect(decodeHtml(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? ""));
    const pubDate = decodeHtml(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "");
    const source = decodeHtml(block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "");

    if (title && link && !items.some((item) => item.title === title)) {
      items.push({ title, link, pubDate, source });
    }
    if (items.length >= limit) break;
  }

  return items;
}

async function fetchRss(query, limit = 8) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:1d`)}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 ai-spacex-brief/1.0",
      "accept": "application/rss+xml,application/xml,text/xml"
    }
  });

  if (!response.ok) {
    throw new Error(`Google News RSS 请求失败：HTTP ${response.status}`);
  }

  return parseRss(await response.text(), limit);
}

async function gatherNews(queries, limit) {
  const settled = await Promise.allSettled(queries.map((query) => fetchRss(query, limit)));
  const merged = [];
  const errors = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      for (const item of result.value) {
        if (!merged.some((existing) => existing.title === item.title)) {
          merged.push(item);
        }
      }
    } else {
      errors.push(result.reason.message);
    }
  }

  return { items: merged.slice(0, limit), errors };
}

async function fetchQuotes() {
  const rows = await Promise.all(AI_TICKERS.map(fetchStooqQuote));
  return rows.filter(Boolean);
}

async function fetchStooqQuote(symbol) {
  const stooqSymbol = `${symbol.toLowerCase()}.us`;
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&f=sd2t2ohlcvcp&h&e=csv`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 ai-spacex-brief/1.0",
      "accept": "text/csv,*/*"
    }
  });

  if (!response.ok) {
    throw new Error(`Stooq quote 请求失败：${symbol} HTTP ${response.status}`);
  }

  const lines = (await response.text()).trim().split(/\r?\n/);
  const values = parseCsvLine(lines[1] ?? "");
  const date = values[1];
  const time = values[2];
  const volume = Number(values[6]);
  const price = Number(values[7]);
  const previousClose = Number(values[8]);

  if (!Number.isFinite(price) || !Number.isFinite(previousClose)) {
    return null;
  }

  return {
    symbol,
    price,
    previousClose,
    changePct: ((price - previousClose) / previousClose) * 100,
    marketTime: `${date} ${time}`,
    volume,
    name: symbol
  };
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

function fmtPct(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatMarketTime(seconds) {
  if (typeof seconds === "string") return seconds;
  if (!Number.isFinite(seconds)) return "N/A";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(seconds * 1000));
}

function bulletNews(items) {
  if (!items.length) return "- 暂未抓到过去 24 小时内的可靠聚合新闻。";
  return items.map((item) => {
    const source = item.source ? `｜${item.source}` : "";
    return `- [${item.title}](${item.link})${source}`;
  }).join("\n");
}

function moversSection(quotes) {
  const movers = quotes
    .filter((quote) => Number.isFinite(quote.changePct))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 8);

  if (!movers.length) return "- 未获取到可用的明显股价异动数据。";

  return movers.map((quote) => {
    const tag = Math.abs(quote.changePct) >= 2 ? "明显异动" : "温和波动";
    return `- **${quote.symbol}** ${fmtPct(quote.changePct)}，最新价 ${quote.price ?? "N/A"}，美东时间 ${formatMarketTime(quote.marketTime)}（${tag}）`;
  }).join("\n");
}

function inferInterpretation(aiNews, spaceNews, quotes) {
  const allText = `${aiNews.map((item) => item.title).join(" ")} ${spaceNews.map((item) => item.title).join(" ")}`.toLowerCase();
  const interpretations = [];

  if (/earnings|revenue|guidance|forecast/.test(allText)) {
    interpretations.push("财报、指引与订单可见度仍是 AI 股票短线波动的主线。");
  }
  if (/regulation|export|china|antitrust|probe/.test(allText)) {
    interpretations.push("监管、出口限制或反垄断消息可能影响半导体与大型云厂商估值情绪。");
  }
  if (/data center|power|electricity|nuclear|grid/.test(allText)) {
    interpretations.push("数据中心电力、散热与基础设施仍会影响 VRT、ETN、PWR、CEG、VST 等链条定价。");
  }
  if (/starship|starlink|falcon|nasa|defense|contract/.test(allText)) {
    interpretations.push("SpaceX 进展主要通过发射节奏、卫星互联网、NASA/国防合同和供应链映射影响相关上市公司。");
  }

  const bigMovers = quotes.filter((quote) => Math.abs(quote.changePct ?? 0) >= 2);
  if (bigMovers.length) {
    interpretations.push(`今日明显异动集中在 ${bigMovers.map((quote) => quote.symbol).join("、")}，需结合对应新闻与大盘风险偏好确认原因。`);
  }

  return interpretations.length
    ? interpretations.map((item) => `- ${item}`).join("\n")
    : "- 暂无足够信息形成明确市场解读；优先观察新闻是否被股价和成交量确认。";
}

function buildBrief({ aiNews, spaceNews, quotes, errors }) {
  const riskItems = [
    "AI 股票估值对利率、资本开支、监管和出口限制非常敏感。",
    "半导体供应链可能受订单节奏、库存周期、先进封装产能和地缘因素影响。",
    "SpaceX 相关影响多为间接映射，未上市主体消息不等同于相关上市公司基本面变化。",
    "简报区分事实、市场解读和推测，不构成投资建议，也不提供保证收益或直接买卖指令。"
  ];

  return [
    `# ${TITLE}`,
    ``,
    `**日期：** ${dateInShanghai()}`,
    ``,
    `## 1. AI 股票重要新闻（事实）`,
    bulletNews(aiNews),
    ``,
    `## 2. SpaceX 最新动向（事实）`,
    bulletNews(spaceNews),
    ``,
    `## 3. 相关上市公司股价异动（事实）`,
    moversSection(quotes),
    ``,
    `## 4. 市场解读`,
    inferInterpretation(aiNews, spaceNews, quotes),
    ``,
    `## 5. 推测与下一步催化剂`,
    `- 继续关注 NVDA、AMD、AVGO、TSM、ASML、MU 的财报、订单、出口限制与先进封装产能变化。`,
    `- 继续关注 MSFT、GOOGL、AMZN、META、ORCL 的 AI capex、云收入、模型产品和监管进展。`,
    `- SpaceX 侧重点关注 Starship 测试、Starlink 用户/卫星部署、Falcon 发射节奏、NASA/国防合同和融资估值。`,
    `- 电力链条关注 VRT、ETN、PWR、CEG、VST 的订单、项目审批、数据中心电力瓶颈和核电/燃气电力政策。`,
    ``,
    `## 6. 风险提示`,
    riskItems.map((item) => `- ${item}`).join("\n"),
    errors.length ? `\n## 数据源异常\n${errors.map((error) => `- ${error}`).join("\n")}` : "",
    ``,
    `## 主要来源`,
    `- [Google News: AI stocks](https://news.google.com/search?q=AI%20stocks)`,
    `- [Google News: SpaceX](https://news.google.com/search?q=SpaceX)`,
    `- [Stooq quotes](https://stooq.com/)`
  ].filter(Boolean).join("\n");
}

async function sendPushPlus(content) {
  if (!PUSHPLUS_TOKEN) {
    if (process.env.GITHUB_ACTIONS) {
      throw new Error("缺少 PUSHPLUS_TOKEN，无法推送 PushPlus。");
    }
    console.log("未配置 PUSHPLUS_TOKEN，本地仅生成预览，不推送。");
    console.log(content.slice(0, 2000));
    return;
  }

  const response = await fetch("https://www.pushplus.plus/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: PUSHPLUS_TOKEN,
      title: TITLE,
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

  console.log("PushPlus 推送成功。");
}

async function main() {
  const [aiResult, spaceResult, quotesResult] = await Promise.allSettled([
    gatherNews(AI_QUERIES, 10),
    gatherNews(SPACEX_QUERIES, 8),
    fetchQuotes()
  ]);

  const aiNews = aiResult.status === "fulfilled" ? aiResult.value.items : [];
  const spaceNews = spaceResult.status === "fulfilled" ? spaceResult.value.items : [];
  const quotes = quotesResult.status === "fulfilled" ? quotesResult.value : [];
  const errors = [
    ...(aiResult.status === "fulfilled" ? aiResult.value.errors : [aiResult.reason.message]),
    ...(spaceResult.status === "fulfilled" ? spaceResult.value.errors : [spaceResult.reason.message]),
    ...(quotesResult.status === "fulfilled" ? [] : [quotesResult.reason.message])
  ];

  const brief = buildBrief({ aiNews, spaceNews, quotes, errors });
  await sendPushPlus(brief);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
