import fs from "node:fs";
import path from "node:path";

function initialMetrics(now = new Date().toISOString()) {
  return { startedAt: now, updatedAt: now, counters: {}, durations: {} };
}

export function createMetricsStore(filePath) {
  function read() {
    if (!fs.existsSync(filePath)) return initialMetrics();
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (!parsed || typeof parsed !== "object") throw new Error("formato inválido");
      return {
        startedAt: parsed.startedAt || new Date().toISOString(),
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        counters: parsed.counters && typeof parsed.counters === "object" ? parsed.counters : {},
        durations: parsed.durations && typeof parsed.durations === "object" ? parsed.durations : {},
      };
    } catch (error) {
      throw new Error(`No se pudieron leer las métricas: ${error.message}`);
    }
  }

  function write(metrics) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const temporary = `${filePath}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, `${JSON.stringify(metrics, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, filePath);
    fs.chmodSync(filePath, 0o600);
  }

  function increment(name, amount = 1) {
    const metrics = read();
    metrics.counters[name] = Number(metrics.counters[name] || 0) + amount;
    metrics.updatedAt = new Date().toISOString();
    write(metrics);
    return metrics.counters[name];
  }

  function duration(name, durationMs) {
    const value = Math.max(0, Number(durationMs) || 0);
    const metrics = read();
    const current = metrics.durations[name] || { count: 0, totalMs: 0, maxMs: 0 };
    current.count += 1;
    current.totalMs += value;
    current.maxMs = Math.max(current.maxMs, value);
    current.averageMs = Math.round(current.totalMs / current.count);
    metrics.durations[name] = current;
    metrics.updatedAt = new Date().toISOString();
    write(metrics);
    return current;
  }

  return { read, increment, duration };
}
