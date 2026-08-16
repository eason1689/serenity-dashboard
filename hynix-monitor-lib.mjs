export const THRESHOLD = 1.0;
export const REARM_ABS = 0.5;
export const EXPAND_STEP = 0.5;

export function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second"))
  };
}

export function hkDateString(date = new Date()) {
  const parts = zonedParts(date, "Asia/Hong_Kong");
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function inHkTradingSession(now = new Date()) {
  const parts = zonedParts(now, "Asia/Hong_Kong");
  const minutes = parts.hour * 60 + parts.minute;
  const weekday = !["Sat", "Sun"].includes(parts.weekday);
  const morning = minutes >= 9 * 60 + 30 && minutes <= 12 * 60;
  const afternoon = minutes >= 13 * 60 && minutes <= 16 * 60;

  return {
    active: weekday && (morning || afternoon),
    reason: weekday ? "非港股连续交易时段或午休" : "香港周末非交易日",
    hkNow: `${parts.year}-${parts.month}-${parts.day} ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
  };
}

export function determineSignal(deviation) {
  if (deviation >= THRESHOLD) {
    return {
      direction: "strong",
      type: "偏强卖出观察",
      headline: "07709 偏强/跌幅不足/涨幅过高",
      explanation: "07709 相对 000660.KS 的 2x 理论值偏贵；若日内持有 07709，可关注做 T 减仓或卖出机会。"
    };
  }

  if (deviation <= -THRESHOLD) {
    return {
      direction: "weak",
      type: "偏弱买入观察",
      headline: "07709 偏弱/跌过头/涨幅不足",
      explanation: "07709 相对 000660.KS 的 2x 理论值偏便宜；可关注买入、买回或加回机会。"
    };
  }

  return null;
}

export function shouldNotify(state, signal, deviation) {
  const entry = state.signals[signal.direction] ?? { armed: true, lastDeviation: null };

  if (entry.armed) {
    entry.armed = false;
    entry.lastDeviation = deviation;
    state.signals[signal.direction] = entry;
    return true;
  }

  const expanded = signal.direction === "strong"
    ? deviation >= entry.lastDeviation + EXPAND_STEP
    : deviation <= entry.lastDeviation - EXPAND_STEP;

  if (expanded) {
    entry.lastDeviation = deviation;
    state.signals[signal.direction] = entry;
    return true;
  }

  return false;
}

export function rearmSignalsIfNeeded(state, deviation) {
  if (Math.abs(deviation) >= REARM_ABS) {
    return false;
  }

  state.signals.strong = { armed: true, lastDeviation: null };
  state.signals.weak = { armed: true, lastDeviation: null };
  return true;
}

export function watchdogTransition(state, healthy, nowIso) {
  const previousStatus = state.status === "unhealthy" ? "unhealthy" : "healthy";
  const nextStatus = healthy ? "healthy" : "unhealthy";

  if (previousStatus === nextStatus) {
    return { event: null, state };
  }

  return {
    event: nextStatus === "unhealthy" ? "alert" : "recovery",
    state: {
      status: nextStatus,
      changedAt: nowIso
    }
  };
}
