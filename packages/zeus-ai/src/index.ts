import { clamp, distance } from "@zeus/core";
import type { Vec2 } from "@zeus/core";

export type ZeusAiSignal = {
  id: string;
  kind: string;
  position: Vec2;
  radius: number;
  intensity: number;
  ttlSeconds?: number;
  ageSeconds?: number;
  tags?: readonly string[];
};

export type ZeusAiSignalScoreOptions = {
  position: Vec2;
  kinds?: readonly string[];
  tags?: readonly string[];
};

export type ZeusAiSignalScore = {
  total: number;
  signals: { signal: ZeusAiSignal; score: number }[];
};

export function ageAiSignals(signals: readonly ZeusAiSignal[], dt: number) {
  return signals
    .map((signal) => ({ ...signal, ageSeconds: Math.max(0, (signal.ageSeconds ?? 0) + Math.max(0, dt)) }))
    .filter((signal) => signal.ttlSeconds === undefined || signal.ageSeconds <= signal.ttlSeconds);
}

export function scoreSignalAtPoint(signal: ZeusAiSignal, position: Vec2) {
  const radius = Math.max(0.001, signal.radius);
  const falloff = clamp(1 - distance(signal.position, position) / radius, 0, 1);
  const ttl = signal.ttlSeconds;
  const age = signal.ageSeconds ?? 0;
  const ageFalloff = ttl === undefined ? 1 : clamp(1 - age / Math.max(0.001, ttl), 0, 1);
  return Math.max(0, signal.intensity) * falloff * ageFalloff;
}

export function scoreSignalsAtPoint(signals: readonly ZeusAiSignal[], options: ZeusAiSignalScoreOptions): ZeusAiSignalScore {
  const scored = signals
    .filter((signal) => matchesSignalFilters(signal, options))
    .map((signal) => ({ signal, score: scoreSignalAtPoint(signal, options.position) }))
    .filter((entry) => entry.score > 0);

  return {
    total: scored.reduce((sum, entry) => sum + entry.score, 0),
    signals: scored,
  };
}

function matchesSignalFilters(signal: ZeusAiSignal, options: ZeusAiSignalScoreOptions) {
  if (options.kinds && !options.kinds.includes(signal.kind)) return false;
  if (!options.tags || options.tags.length === 0) return true;
  const tags = new Set(signal.tags ?? []);
  return options.tags.some((tag) => tags.has(tag));
}
