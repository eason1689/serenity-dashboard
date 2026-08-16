# 海力士 07709 做 T 监控可靠性修复设计

日期：2026-08-16

## 背景

现有 `Hynix 07709 deviation monitor` 计划在港股交易日每 5 分钟检查一次，但近期主要依赖 GitHub Actions `schedule`。2026-08-10 至 2026-08-14 的运行记录显示，交易时段内只启动了 17 次，其中 16 次成功，明显少于按配置应有的约 330 次。此前由 cron-job.org 产生的 `workflow_dispatch` 在 2026-06-26 后停止，与旧 fine-grained token 的到期时间吻合。

GitHub Actions 原生定时任务可能延迟或丢弃，不能单独承担 5 分钟级监控。修复需要恢复外部触发，并保留 GitHub 原生定时作为降级通道。

## 目标

- 港股连续交易时段内，每 5 分钟触发一次检查。
- 电脑关机或 Codex 未运行时，监控仍在云端工作。
- 外部触发失效时，GitHub 原生定时仍提供有限兜底。
- 交易时段超过 15 分钟没有成功检查时，由 watchdog 在下一次运行时发送故障提醒；恢复后发送一次恢复提醒。
- 保留现有信号阈值、防重复通知和每日重置行为。
- 不在代码、提交、日志或通知中暴露任何 token。

## 非目标

- 不改动 07709 的交易策略或阈值含义。
- 不扩展到 24 小时监控；休市、午休和非交易日保持安静。
- 不迁移到新的云平台或数据库。
- 不把提醒解释为投资建议。

## 方案

### 1. 主调度：cron-job.org

继续使用现有 cron-job.org 任务，在工作日港股交易窗口内每 5 分钟调用 GitHub Actions `workflow_dispatch`。

新建 GitHub fine-grained personal access token，权限限制为：

- 仅允许访问 `eason1689/serenity-dashboard`。
- Repository permissions 中仅开启 Actions `Read and write`；Metadata 保持自动只读。
- 使用 GitHub 当前允许的最长合理有效期。

将新 token 写入 cron-job.org 请求的 `Authorization: Bearer ...` 请求头。token 不进入仓库或本地文档。

### 2. 备用调度：GitHub Actions schedule

保留 `.github/workflows/hynix-monitor.yml` 中的原生 `schedule`。它不是 5 分钟可靠性的主来源，只负责在 cron-job.org 短时失效时提供有限兜底。

工作流继续使用现有 concurrency group，避免外部触发和原生定时同时到达时并行修改状态文件。

### 3. 行情获取和信号通知

`hynix-monitor.mjs` 保留以下行为：

- 只在香港时间工作日 `09:30-12:00` 和 `13:00-16:00` 执行。
- `deviation_pct >= +1%` 产生偏强卖出观察。
- `deviation_pct <= -1%` 产生偏弱买入观察。
- 同方向已经提醒后，只有偏差继续扩大至少 0.5 个百分点才再次提醒。
- 偏差恢复到绝对值 0.5% 以内后重新武装。
- 每个香港交易日重置信号状态。

Yahoo Finance 行情请求增加有限次数、短退避重试。只有行情请求允许重试；Pushplus 发送不做盲目重试，避免响应丢失时重复发送交易提醒。

### 4. 失联 watchdog

新增独立 watchdog 工作流和脚本：

- 在交易时段定期读取 `Hynix 07709 deviation monitor` 最后一次成功运行时间。
- 若距离最后一次成功运行超过 15 分钟，在 watchdog 本次运行中发送一次 Pushplus 故障提醒。
- 故障持续期间不重复轰炸。
- 监控恢复后发送一次恢复通知，并重新武装故障提醒。
- 非交易时段、午休、周末保持安静。

watchdog 使用独立的小型状态文件，只在告警状态发生变化时提交，避免每次检查都产生提交。

watchdog 由 GitHub 原生定时执行，因此不是硬实时保证；它用于让用户发现外部触发失效。主监控的 5 分钟可靠性仍由 cron-job.org 提供。

## 数据流

1. cron-job.org 每 5 分钟调用 GitHub `workflow_dispatch`。
2. GitHub Actions 启动 `hynix-monitor.yml`。
3. `hynix-monitor.mjs` 判断是否处于港股连续交易时段。
4. 脚本获取 `000660.KS` 和 `7709.HK` 行情，检查行情新鲜度并计算偏差。
5. 脚本根据阈值和去重状态决定是否调用 Pushplus。
6. 若状态发生变化，工作流提交 `hynix-monitor-state.json`。
7. watchdog 独立检查最后一次成功运行时间，并只在故障或恢复状态切换时通知。

## 错误处理

- Yahoo 行情临时失败：短退避重试；耗尽后任务失败并保留错误日志。
- 行情陈旧：不计算信号、不推送交易提醒，日志明确记录数据时间和跳过原因。
- Pushplus 返回非 200：任务失败，日志只记录状态和错误原因，不记录 token。
- GitHub checkout 或 runner 故障：由后续 5 分钟外部触发自然恢复；watchdog 在超时后告警。
- cron-job.org token 失效：GitHub 返回 401/403；watchdog 在检测到成功运行中断后告警。
- 并发运行：由 workflow concurrency 串行化，防止状态提交冲突。

## 验证

- 使用 Node 语法检查验证修改后的脚本。
- 使用 Node 内置测试覆盖交易时段边界、±1% 阈值、0.5% 重新武装和 0.5 个百分点扩展规则。
- 手动触发监控工作流，确认云端运行成功且日志不泄露 secret。
- 发送一次标题明确的“07709监控恢复测试”Pushplus，确认端到端通知链路。
- 更新 cron-job.org 后，观察至少连续 20 分钟，确认约每 5 分钟产生一次 `workflow_dispatch`。
- 人为使用过期时间样例运行 watchdog，验证只告警一次；随后使用恢复样例验证只发送一次恢复通知。

## 验收标准

- 连续观察 20 分钟至少出现 4 次成功的外部触发运行，允许云端队列造成的小幅延迟。
- token 权限限定到单一仓库和 Actions 写权限。
- 监控信号规则与修复前一致。
- Pushplus 测试消息成功送达。
- watchdog 能区分健康、首次故障、持续故障和恢复四种状态。
- 仓库和 Actions 日志中不存在明文 token。
