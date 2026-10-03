export const LOW_HR_RATIO = 0.7;
export const HIGH_HR_RATIO = 0.8;

export type ZoneTimes = {
  lowSeconds: number;
  midSeconds: number;
  highSeconds: number;
};

export function zoneForBpm(bpm: number, cap: number): "low" | "mid" | "high" {
  const ratio = bpm / cap;
  if (ratio >= HIGH_HR_RATIO) return "high";
  if (ratio < LOW_HR_RATIO) return "low";
  return "mid";
}

export function timesFromSamples(bpm: number[], intervalSeconds: number, cap: number): ZoneTimes {
  const times: ZoneTimes = { lowSeconds: 0, midSeconds: 0, highSeconds: 0 };
  const step = Math.max(0.5, intervalSeconds);
  for (const value of bpm) {
    if (value < 35 || value > 240) continue;
    const zone = zoneForBpm(value, cap);
    if (zone === "high") times.highSeconds += step;
    else if (zone === "low") times.lowSeconds += step;
    else times.midSeconds += step;
  }
  return {
    lowSeconds: Math.round(times.lowSeconds),
    midSeconds: Math.round(times.midSeconds),
    highSeconds: Math.round(times.highSeconds)
  };
}

export function timesFromAverage(durationSeconds: number, hrAvg: number, cap: number): ZoneTimes {
  const duration = Math.max(0, Math.round(durationSeconds));
  const zone = zoneForBpm(hrAvg, cap);
  return {
    lowSeconds: zone === "low" ? duration : 0,
    midSeconds: zone === "mid" ? duration : 0,
    highSeconds: zone === "high" ? duration : 0
  };
}

export function dominantZone(times: ZoneTimes): "low" | "mid" | "high" {
  if (times.highSeconds >= times.lowSeconds && times.highSeconds >= times.midSeconds) return "high";
  if (times.lowSeconds >= times.midSeconds) return "low";
  return "mid";
}

export function extractHeartRateSeries(node: unknown, depth = 0): number[] {
  if (node == null || depth > 8) return [];

  if (typeof node === "string") {
    const compact = node.replace(/\s/g, "");
    if (!/^\d{2,3}(?:,\d{2,3}){8,}$/.test(compact)) return [];
    return compact
      .split(",")
      .map(Number)
      .filter((value) => value > 35 && value < 240);
  }

  if (Array.isArray(node)) {
    if (
      node.length >= 8 &&
      node.every((item) => typeof item === "number" && item > 35 && item < 240)
    ) {
      return node as number[];
    }
    const fromObjects: number[] = [];
    for (const item of node) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const type = String(record.sampleType || record.type || record.name || "");
      if (/heart/i.test(type) && record.data != null) {
        const nested = extractHeartRateSeries(record.data, depth + 1);
        if (nested.length >= 8) return nested;
      }
      const value = record.value ?? record.heartRate ?? record.hr ?? record.bpm;
      if (typeof value === "number" && value > 35 && value < 240) fromObjects.push(value);
    }
    if (fromObjects.length >= 8) return fromObjects;
    for (const item of node) {
      const nested = extractHeartRateSeries(item, depth + 1);
      if (nested.length >= 8) return nested;
    }
    return [];
  }

  if (typeof node === "object") {
    const record = node as Record<string, unknown>;
    for (const key of ["heartRate", "heartrate", "hr", "hrSamples", "heart-rate"]) {
      if (record[key] == null) continue;
      const nested = extractHeartRateSeries(record[key], depth + 1);
      if (nested.length >= 8) return nested;
    }
    if (record.samples != null) {
      const nested = extractHeartRateSeries(record.samples, depth + 1);
      if (nested.length >= 8) return nested;
    }
    for (const [key, value] of Object.entries(record)) {
      if (!/heart|hr/i.test(key) || /max|min|avg|average|threshold|zone/i.test(key)) continue;
      const nested = extractHeartRateSeries(value, depth + 1);
      if (nested.length >= 8) return nested;
    }
  }

  return [];
}

export function sampleIntervalSeconds(durationSeconds: number, sampleCount: number): number {
  if (!sampleCount) return 1;
  const guessed = durationSeconds / sampleCount;
  if (guessed >= 0.5 && guessed <= 10) return guessed;
  return 1;
}
