# Serenity Dashboard 项目规则

## 项目边界

- 这是纯静态 GitHub Pages 看板；页面数据来自仓库内 JSON 文件。
- 07709 监控运行在 GitHub Actions，cron-job.org 是每 5 分钟主触发器，GitHub `schedule` 是备用触发器。

## 07709 监控不可静默改变的规则

- 只在香港时间工作日 `09:30-12:00`、`13:00-16:00` 判断行情。
- 偏差达到 `+1%` 或 `-1%` 才触发观察提醒；同方向扩大 `0.5` 个百分点才重复提醒；回到绝对值 `0.5%` 内重新武装。
- 修改阈值、交易时段或提醒含义前，必须得到用户明确确认。
- monitor 与 watchdog 必须共用 `hynix-07709-state` concurrency group，避免状态文件提交冲突。
- Pushplus 不做盲目重试；行情获取可以有限重试。

## 安全与验证

- 不得把 GitHub PAT、`PUSHPLUS_TOKEN` 或完整 Authorization header 写入仓库、文档、命令输出或日志。
- cron-job.org PAT 只允许访问 `eason1689/serenity-dashboard`，Repository permissions 只开 Actions `Read and write`。
- 修改监控后至少运行 `npm run test:hynix`、`node --check` 和 `git diff --check`。
- Pushplus 冒烟测试会真实发消息，只在用户明确需要时运行 `npm run test-push:hynix` 或 workflow 的 `test_push` 模式。

## 文档入口

- 设计与取舍：`docs/superpowers/specs/2026-08-16-hynix-07709-monitor-reliability-design.md`
- 运维、验证与故障排查：`docs/07709-monitor-runbook.md`
