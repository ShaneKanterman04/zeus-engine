export type FixedStepLoopOptions = {
  stepSeconds?: number;
  maxFrameSeconds?: number;
  maxStepsPerFrame?: number;
};

export class FixedStepLoop {
  private accumulator = 0;
  readonly stepSeconds: number;
  readonly maxFrameSeconds: number;
  readonly maxStepsPerFrame: number;

  constructor(options: FixedStepLoopOptions = {}) {
    this.stepSeconds = options.stepSeconds ?? 1 / 20;
    this.maxFrameSeconds = options.maxFrameSeconds ?? 0.1;
    this.maxStepsPerFrame = options.maxStepsPerFrame ?? 5;
  }

  advance(frameSeconds: number, step: (dt: number) => void) {
    this.accumulator += Math.min(frameSeconds, this.maxFrameSeconds);
    let steps = 0;
    while (this.accumulator >= this.stepSeconds && steps < this.maxStepsPerFrame) {
      step(this.stepSeconds);
      this.accumulator -= this.stepSeconds;
      steps += 1;
    }
    if (steps === this.maxStepsPerFrame && this.accumulator >= this.stepSeconds) {
      this.accumulator = this.accumulator % this.stepSeconds;
    }
    return steps;
  }

  reset() {
    this.accumulator = 0;
  }

  get pendingSeconds() {
    return this.accumulator;
  }
}
