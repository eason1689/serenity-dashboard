import test from "node:test";
import assert from "node:assert/strict";
import {
  determineSignal,
  inHkTradingSession,
  rearmSignalsIfNeeded,
  shouldNotify,
  watchdogTransition
} from "../hynix-monitor-lib.mjs";

function state() {
  return {
    signals: {
      strong: { armed: true, lastDeviation: null },
      weak: { armed: true, lastDeviation: null }
    }
  };
}

test("港股连续交易时段边界", () => {
  assert.equal(inHkTradingSession(new Date("2026-08-17T01:29:00Z")).active, false);
  assert.equal(inHkTradingSession(new Date("2026-08-17T01:30:00Z")).active, true);
  assert.equal(inHkTradingSession(new Date("2026-08-17T04:30:00Z")).active, false);
  assert.equal(inHkTradingSession(new Date("2026-08-17T05:00:00Z")).active, true);
  assert.equal(inHkTradingSession(new Date("2026-08-17T08:01:00Z")).active, false);
  assert.equal(inHkTradingSession(new Date("2026-08-16T02:00:00Z")).active, false);
});

test("信号阈值保持为正负 1%", () => {
  assert.equal(determineSignal(0.99), null);
  assert.equal(determineSignal(1)?.direction, "strong");
  assert.equal(determineSignal(-0.99), null);
  assert.equal(determineSignal(-1)?.direction, "weak");
});

test("同方向只在扩大 0.5 个百分点后重复通知", () => {
  const current = state();
  const signal = determineSignal(1.2);
  assert.equal(shouldNotify(current, signal, 1.2), true);
  assert.equal(shouldNotify(current, signal, 1.69), false);
  assert.equal(shouldNotify(current, signal, 1.7), true);
});

test("回到绝对值 0.5% 内重新武装", () => {
  const current = state();
  const signal = determineSignal(-1.2);
  assert.equal(shouldNotify(current, signal, -1.2), true);
  assert.equal(rearmSignalsIfNeeded(current, -0.4), true);
  assert.equal(current.signals.weak.armed, true);
  assert.equal(shouldNotify(current, signal, -1.1), true);
});

test("watchdog 只在失联和恢复边沿通知", () => {
  const healthy = { status: "healthy", changedAt: null };
  const alert = watchdogTransition(healthy, false, "2026-08-17T02:00:00.000Z");
  assert.equal(alert.event, "alert");
  assert.equal(watchdogTransition(alert.state, false, "2026-08-17T02:05:00.000Z").event, null);

  const recovery = watchdogTransition(alert.state, true, "2026-08-17T02:10:00.000Z");
  assert.equal(recovery.event, "recovery");
  assert.equal(watchdogTransition(recovery.state, true, "2026-08-17T02:15:00.000Z").event, null);
});
