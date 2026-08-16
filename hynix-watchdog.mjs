import { readFile, writeFile } from "node:fs/promises";
import { inHkTradingSession, watchdogTransition } from "./hynix-monitor-lib.mjs";
import { sendPushPlus } from "./pushplus.mjs";

const STATE_PATH = new URL("./hynix-watchdog-state.json", import.meta.url);
const MAX_GAP_MINUTES = 15;
const REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_TOKEN = process.env.GH_TOKEN;
const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN;

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8"));
  } catch {
    return { status: "healthy", changedAt: null };
  }
}

async function writeState(state) {
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

async function latestSuccessfulMonitorRun() {
  if (!REPOSITORY || !GITHUB_TOKEN) {
    throw new Error("watchdog 缺少 GITHUB_REPOSITORY 或 GH_TOKEN");
  }

  const url = `https://api.github.com/repos/${REPOSITORY}/actions/workflows/hynix-monitor.yml/runs?status=completed&per_page=20`;
  const response = await fetch(url, {
    headers: {
      "accept": "application/vnd.github+json",
      "authorization": `Bearer ${GITHUB_TOKEN}`,
      "x-github-api-version": "2022-11-28"
    }
  });

  if (!response.ok) {
    throw new Error(`读取 Hynix monitor 运行记录失败：HTTP ${response.status}`);
  }

  const body = await response.json();
  return body.workflow_runs?.find((run) => run.conclusion === "success") ?? null;
}

function formatHongKongTime(date) {
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

async function main() {
  const now = new Date();
  const session = inHkTradingSession(now);
  if (!session.active) {
    console.log(`跳过 watchdog：${session.reason}。香港时间 ${session.hkNow}`);
    return;
  }

  const run = await latestSuccessfulMonitorRun();
  const runAt = run == null ? null : new Date(run.run_started_at ?? run.created_at);
  const gapMinutes = runAt == null ? Number.POSITIVE_INFINITY : (now.getTime() - runAt.getTime()) / 60000;
  const healthy = gapMinutes <= MAX_GAP_MINUTES;
  const currentState = await readState();
  const transition = watchdogTransition(currentState, healthy, now.toISOString());

  if (transition.event === "alert") {
    const lastRun = runAt == null ? "没有找到成功记录" : `${formatHongKongTime(runAt)}（香港时间）`;
    await sendPushPlus({
      token: PUSHPLUS_TOKEN,
      title: "07709监控失联提醒",
      content: `# 07709监控失联提醒\n\n交易时段已超过 ${MAX_GAP_MINUTES} 分钟没有成功检查。\n\n最近成功运行：${lastRun}\n\n请检查 cron-job.org、GitHub token 和 GitHub Actions。`
    });
    await writeState(transition.state);
    console.log(`已推送失联提醒：gap_minutes=${Number.isFinite(gapMinutes) ? gapMinutes.toFixed(1) : "unknown"}`);
    return;
  }

  if (transition.event === "recovery") {
    await sendPushPlus({
      token: PUSHPLUS_TOKEN,
      title: "07709监控恢复通知",
      content: `# 07709监控恢复通知\n\n监控已经恢复。\n\n最近成功运行：${formatHongKongTime(runAt)}（香港时间）`
    });
    await writeState(transition.state);
    console.log(`已推送恢复通知：gap_minutes=${gapMinutes.toFixed(1)}`);
    return;
  }

  console.log(`watchdog 正常：gap_minutes=${Number.isFinite(gapMinutes) ? gapMinutes.toFixed(1) : "unknown"}，status=${currentState.status}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
