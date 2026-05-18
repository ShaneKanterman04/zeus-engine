import type { AuthoritativeRoom } from "./inMemoryTransport.js";

export type ZeusAuthoritativeRoomTickBudgetEvent = {
  tickMs: number;
  budgetMs: number;
  steps: number;
};

export type ZeusAuthoritativeRoomTickRunnerOptions<TIntent, TSnapshot> = {
  room: AuthoritativeRoom<TIntent, TSnapshot>;
  stepSeconds: number;
  maxFrameSeconds?: number;
  maxStepsPerFrame?: number;
  snapshotIntervalSeconds?: number;
  tickBudgetMs?: number;
  now?: () => number;
  onTickOverBudget?: (event: ZeusAuthoritativeRoomTickBudgetEvent) => void;
};

export type ZeusAuthoritativeRoomTickResult<TSnapshot> = {
  steps: number;
  snapshot?: TSnapshot;
};

export class ZeusAuthoritativeRoomTickRunner<TIntent, TSnapshot> {
  private pendingSeconds = 0;
  private secondsSinceSnapshot = 0;
  private lastSnapshot?: TSnapshot;
  private readonly maxFrameSeconds: number;
  private readonly maxStepsPerFrame: number;
  private readonly snapshotIntervalSeconds: number;
  private readonly now: () => number;

  constructor(private readonly options: ZeusAuthoritativeRoomTickRunnerOptions<TIntent, TSnapshot>) {
    if (options.stepSeconds <= 0) throw new Error("stepSeconds must be greater than zero");
    this.maxFrameSeconds = options.maxFrameSeconds ?? 0.25;
    this.maxStepsPerFrame = options.maxStepsPerFrame ?? 5;
    this.snapshotIntervalSeconds = options.snapshotIntervalSeconds ?? options.stepSeconds;
    this.now = options.now ?? defaultNow;
  }

  advance(frameSeconds: number): ZeusAuthoritativeRoomTickResult<TSnapshot> {
    this.pendingSeconds += Math.min(Math.max(0, frameSeconds), this.maxFrameSeconds);
    let steps = 0;
    let snapshot: TSnapshot | undefined;
    const started = this.now();

    while (this.pendingSeconds + Number.EPSILON >= this.options.stepSeconds && steps < this.maxStepsPerFrame) {
      this.pendingSeconds -= this.options.stepSeconds;
      this.secondsSinceSnapshot += this.options.stepSeconds;
      steps += 1;
      this.lastSnapshot = this.options.room.tick(this.options.stepSeconds);
      if (this.secondsSinceSnapshot + Number.EPSILON >= this.snapshotIntervalSeconds) {
        snapshot = this.lastSnapshot;
        this.secondsSinceSnapshot = 0;
      }
    }

    if (steps >= this.maxStepsPerFrame && this.pendingSeconds >= this.options.stepSeconds) {
      this.pendingSeconds = 0;
    }

    const tickMs = this.now() - started;
    if (steps > 0 && this.options.tickBudgetMs !== undefined && tickMs > this.options.tickBudgetMs) {
      this.options.onTickOverBudget?.({ tickMs, budgetMs: this.options.tickBudgetMs, steps });
    }

    return { steps, snapshot };
  }

  snapshot() {
    this.lastSnapshot = this.options.room.snapshot();
    return this.lastSnapshot;
  }

  reset() {
    this.pendingSeconds = 0;
    this.secondsSinceSnapshot = 0;
  }
}

function defaultNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}
