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

export type ZeusThreatStage = "quiet" | "interested" | "stalking" | "raid";

export type ZeusThreatStageThresholds = {
  interested: number;
  stalking: number;
  raid: number;
};

export type ZeusThreatMeterOptions = {
  current: number;
  signalScore: number;
  dt: number;
  decayPerSecond?: number;
  gainPerSecond?: number;
  min?: number;
  max?: number;
};

export type ZeusAiSteeringTarget = {
  position: Vec2;
  weight?: number;
};

export type ZeusRandom = () => number;

export type ZeusRoamRegion = {
  id: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  weight?: number;
};

export type ZeusRoamProfile = {
  regions: readonly ZeusRoamRegion[];
  speed: number;
  idleSeconds: { min: number; max: number };
  arriveDistance?: number;
};

export type ZeusRoamAgentState = {
  mode: "idle" | "roam";
  target?: Vec2;
  regionId?: string;
  idleRemainingSeconds: number;
};

export type ZeusRoamAdvanceOptions = {
  position: Vec2;
  state: ZeusRoamAgentState;
  profile: ZeusRoamProfile;
  dt: number;
  random: ZeusRandom;
};

export const defaultThreatStageThresholds: ZeusThreatStageThresholds = {
  interested: 20,
  stalking: 55,
  raid: 85,
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

export function advanceThreatMeter(options: ZeusThreatMeterOptions) {
  const dt = Math.max(0, options.dt);
  const min = options.min ?? 0;
  const max = options.max ?? 100;
  const gain = Math.max(0, options.signalScore) * (options.gainPerSecond ?? 1) * dt;
  const decay = Math.max(0, options.decayPerSecond ?? 0) * dt;
  return clamp(options.current + gain - decay, min, max);
}

export function classifyThreatStage(value: number, thresholds: ZeusThreatStageThresholds = defaultThreatStageThresholds): ZeusThreatStage {
  if (value >= thresholds.raid) return "raid";
  if (value >= thresholds.stalking) return "stalking";
  if (value >= thresholds.interested) return "interested";
  return "quiet";
}

export function steerToward(current: Vec2, target: Vec2, maxDistance: number): Vec2 {
  return steer(current, target, Math.max(0, maxDistance));
}

export function steerAway(current: Vec2, threat: Vec2, maxDistance: number): Vec2 {
  return steer(current, { x: current.x + (current.x - threat.x), y: current.y + (current.y - threat.y) }, Math.max(0, maxDistance));
}

export function weightedTarget(targets: readonly ZeusAiSteeringTarget[]): Vec2 | undefined {
  if (targets.length === 0) return undefined;
  let weightTotal = 0;
  let x = 0;
  let y = 0;
  for (const target of targets) {
    const weight = Math.max(0, target.weight ?? 1);
    weightTotal += weight;
    x += target.position.x * weight;
    y += target.position.y * weight;
  }
  if (weightTotal <= 0) return undefined;
  return { x: x / weightTotal, y: y / weightTotal };
}

export function createSeededRng(seed: number): ZeusRandom {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function pickWeighted<T>(items: readonly T[], weightForItem: (item: T) => number, random: ZeusRandom): T | undefined {
  let total = 0;
  for (const item of items) total += Math.max(0, weightForItem(item));
  if (total <= 0) return undefined;

  let cursor = clamp(random(), 0, 0.999999999) * total;
  for (const item of items) {
    cursor -= Math.max(0, weightForItem(item));
    if (cursor <= 0) return item;
  }
  return items[items.length - 1];
}

export function randomPointInRect(bounds: ZeusRoamRegion["bounds"], random: ZeusRandom): Vec2 {
  return {
    x: bounds.x + clamp(random(), 0, 1) * bounds.width,
    y: bounds.y + clamp(random(), 0, 1) * bounds.height,
  };
}

export function advanceRoamingAgent(options: ZeusRoamAdvanceOptions) {
  const dt = Math.max(0, options.dt);
  const arriveDistance = Math.max(0, options.profile.arriveDistance ?? 8);
  let state: ZeusRoamAgentState = { ...options.state, target: options.state.target ? { ...options.state.target } : undefined };
  let position = { ...options.position };

  if (state.mode === "idle") {
    state.idleRemainingSeconds = Math.max(0, state.idleRemainingSeconds - dt);
    if (state.idleRemainingSeconds > 0) return { position, state };
    state = chooseRoamTarget(state, options.profile, options.random);
  }

  if (state.mode === "roam" && state.target) {
    position = steerToward(position, state.target, Math.max(0, options.profile.speed) * dt);
    if (distance(position, state.target) <= arriveDistance) {
      state = {
        mode: "idle",
        regionId: state.regionId,
        idleRemainingSeconds: randomRange(options.profile.idleSeconds.min, options.profile.idleSeconds.max, options.random),
      };
    }
  }

  return { position, state };
}

export function formatThreatOverlay(stage: ZeusThreatStage, value: number, messages: readonly string[] = []) {
  return [`Threat ${stage} ${Math.round(value)}`, ...messages].join("\n");
}

function chooseRoamTarget(state: ZeusRoamAgentState, profile: ZeusRoamProfile, random: ZeusRandom): ZeusRoamAgentState {
  const region = pickWeighted(profile.regions, (item) => item.weight ?? 1, random);
  if (!region) {
    return {
      mode: "idle",
      idleRemainingSeconds: randomRange(profile.idleSeconds.min, profile.idleSeconds.max, random),
    };
  }
  return {
    ...state,
    mode: "roam",
    regionId: region.id,
    target: randomPointInRect(region.bounds, random),
    idleRemainingSeconds: 0,
  };
}

function randomRange(min: number, max: number, random: ZeusRandom) {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return low + clamp(random(), 0, 1) * (high - low);
}

function steer(current: Vec2, target: Vec2, maxDistance: number): Vec2 {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const length = Math.hypot(dx, dy);
  if (length === 0 || maxDistance === 0) return { ...current };
  const distanceToMove = Math.min(length, maxDistance);
  return {
    x: current.x + (dx / length) * distanceToMove,
    y: current.y + (dy / length) * distanceToMove,
  };
}
