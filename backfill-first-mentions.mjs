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
