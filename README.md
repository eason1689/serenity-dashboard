# Serenity KOL 股票情报看板

一个纯静态 Dashboard，用于展示 Serenity / @aleabitoreddit 的公开推文股票信息流、逐日摘要、标的立场、行情表现、主题分布和风险标记。

线上地址：

```text
https://eason1689.github.io/serenity-dashboard/
```

## 本地预览

```bash
python3 -m http.server 8080 --bind localhost
```

打开：

```text
http://localhost:8080/
```

## GitHub Pages 部署

当前仓库使用 GitHub Pages legacy branch 部署：

```text
repo: eason1689/serenity-dashboard
branch: main
path: /
```

推送到 `main` 后，GitHub Pages 会自动重新构建。

## 数据文件

当前页面读取：

```text
signals.json
daily-digests.json
```

`daily-digests.json` 提供逐日 KOL 摘要卡片；`signals.json` 提供全局信号、主题、行情和自动化状态。若 `daily-digests.json` 缺失，前端会退回到 `signals.json` 的信号归档视图。

股票行展示四个行情口径：

- 当前价
- 日涨跌幅
- 自 `2026-03-01` 开始的累计涨跌幅；若当天休市，使用下一个可用交易日，例如 `2026-03-02`
- 自 `2026-06-05` 开始的累计涨跌幅

行情源优先使用 Yahoo Finance chart API，失败时回退 Stooq。关键非美股映射包括 `SIVE -> SIVE.ST`、`2454.TW -> MediaTek`、`SOI -> SOI.PA`。

## 自动更新

```bash
npm run update:signals
```

该脚本会：

- 抓取 Serenity 公开来源并更新 `signals.json`
- 刷新 watchlist 的当前价、日涨跌幅和累计涨跌幅
- 写入 `marketQuotes`，让逐日摘要中的 entity 也能显示行情
- 在 GitHub Actions 中通过 `PUSHPLUS_TOKEN` 发送 Pushplus 通知

GitHub Actions 定时任务位于 `.github/workflows/update-signals.yml`。schedule 以 UTC 表达，脚本内部只允许美国纽约时间工作日 `08:30-13:00` 的窗口真正执行更新。

## Pushplus

GitHub Actions 使用仓库 secret `PUSHPLUS_TOKEN`。本地 Codex 自动化使用：

```text
/Users/eason/.codex/secrets/pushplus.env
```

不要把 token 写进仓库或输出到日志。当前 Codex heartbeat `serenity-07709` 每天北京时间 `09:20` 检查 Serenity Dashboard 和 Hynix 07709 monitor，并通过 Pushplus 推送中文摘要。

## 其他脚本

```bash
npm run monitor:hynix
npm run backfill:first-mentions
npm run brief:ai-spacex
npm run check:signals
```

`monitor:hynix` 负责 Hynix 07709 deviation monitor；`backfill:first-mentions` 用于回填首次提及价；`brief:ai-spacex` 生成 AI 股票与 SpaceX 每日简报。
