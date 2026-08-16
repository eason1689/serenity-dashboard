# 07709 监控运维手册

状态基准日期：2026-08-16

## 当前架构

| 组件 | 职责 | 运行位置 |
|---|---|---|
| cron-job.org job `7689728` | 每 5 分钟触发 monitor，是主调度器 | 云端 |
| `.github/workflows/hynix-monitor.yml` | 获取行情、计算偏差、去重并发送信号 | GitHub Actions |
| `.github/workflows/hynix-monitor-watchdog.yml` | 检查 monitor 是否超过 15 分钟没有成功运行 | GitHub Actions |
| `hynix-monitor-state.json` | 保存每日信号去重状态 | 仓库，由 Actions 更新 |
| `hynix-watchdog-state.json` | 保存 healthy/unhealthy 状态 | 仓库，由 Actions 更新 |
| Codex heartbeat `serenity-07709` | 每日检查外部触发和看板新鲜度 | 本机 Codex，非主监控 |

电脑关机不影响 cron-job.org、GitHub Actions 和 Pushplus。只有 Codex heartbeat 依赖本机运行。

## 调度与有效时段

- cron-job.org 时区：`Asia/Shanghai`。
- cron-job.org 表达式：`*/5 9-16 * * 1-5`。
- 脚本实际判断时段：香港时间工作日 `09:30-12:00`、`13:00-16:00`。
- 午休、周末和时段外的触发会成功退出，但不获取行情、不发送交易提醒。
- GitHub 原生 `schedule` 只是备用，可能延迟或漏跑，不能单独视为 5 分钟保证。

## 信号规则

- `deviation_pct = 07709.HK 当日涨跌幅 - 2 × 000660.KS 当日涨跌幅`。
- `deviation_pct >= +1%`：偏强卖出观察。
- `deviation_pct <= -1%`：偏弱买入观察。
- 同方向偏差扩大至少 `0.5` 个百分点才重复提醒。
- 偏差回到绝对值 `0.5%` 内后重新武装。
- 规则每天按香港日期重置；提醒不构成投资建议。

## 密钥与轮换

- GitHub 仓库 secret：`PUSHPLUS_TOKEN`。
- cron-job.org Authorization 使用 fine-grained GitHub PAT，不保存在仓库或本地文档。
- PAT 只能访问 `eason1689/serenity-dashboard`，只授予 Actions `Read and write`；Metadata 为 GitHub 自动只读。
- 当前 PAT 到期日：`2027-08-16`；从 `2027-08-01` 起安排轮换。
- 任何曾出现在日志、聊天或终端输出中的 token 都必须立即撤销并重建。

## 日常检查

查看 monitor 运行记录：

```bash
gh run list --repo eason1689/serenity-dashboard \
  --workflow hynix-monitor.yml --limit 10
```

查看 watchdog 运行记录：

```bash
gh run list --repo eason1689/serenity-dashboard \
  --workflow hynix-monitor-watchdog.yml --limit 10
```

交易时段内，正常状态应约每 5 分钟出现一次 `workflow_dispatch`。超过 15 分钟没有成功 monitor 运行时，watchdog 应在自身下一次成功调度时发送一次失联提醒。

## 验证命令

本地纯规则测试，不发送通知：

```bash
npm run test:hynix
node --check hynix-monitor.mjs
node --check hynix-watchdog.mjs
git diff --check
```

云端 Pushplus 冒烟测试会真实发送一条明确标注的系统测试消息：

```bash
gh workflow run hynix-monitor.yml --ref main -f mode=test_push
```

手动触发 monitor，不伪造交易信号：

```bash
gh workflow run hynix-monitor.yml --ref main -f mode=monitor
```

2026-08-16 已验证：Pushplus 冒烟测试成功、cron-job.org 测试触发成功、monitor 云端运行成功、watchdog 云端运行成功。当天为周日，所以 monitor 和 watchdog 正确执行了非交易日跳过逻辑。首次完整的交易时段频率验收应检查连续 20 分钟内是否至少出现 4 次成功外部触发。

## 故障排查

| 现象 | 优先检查 |
|---|---|
| cron-job.org 显示 HTTP 401/403 | PAT 是否过期、是否仅有 Actions 读写、Authorization 是否为 `Bearer ...` |
| GitHub 没有 `workflow_dispatch` | cron-job.org 是否启用、下一次执行时间和请求 URL 是否正确 |
| monitor 失败 | Actions 日志中的 checkout、Yahoo 行情请求或 Pushplus 返回状态 |
| monitor 成功但没有交易提醒 | 是否在交易时段、行情是否新鲜、偏差是否达到阈值、去重状态是否抑制重复提醒 |
| watchdog 未及时告警 | GitHub 原生 schedule 可能延迟；检查 watchdog 最后运行时间 |
| 状态提交失败 | monitor/watchdog 是否仍共用 `hynix-07709-state` concurrency group |

日志可以记录 HTTP 状态码和错误原因，但不得打印 token 或完整 Authorization header。

## 已知限制

- Yahoo 免费行情可能约延迟 15 分钟，系统不是实时成交价源。
- cron-job.org 与 GitHub Actions 都是第三方云服务，无法提供硬实时保证。
- watchdog 自身依赖 GitHub 原生 schedule，因此告警也可能延迟。
- 脚本按工作日和行情新鲜度判断休市，没有独立港交所节假日日历。
