export type ZeusFrameMetricsSample = {
  frameMs: number;
  simMs?: number;
  renderMs?: number;
  simSteps?: number;
};

export type ZeusFrameMetricsSnapshot = {
  fps: number;
  frameMs: number;
  averageFrameMs: number;
  simMs: number;
  averageSimMs: number;
  renderMs: number;
  averageRenderMs: number;
  simSteps: number;
  averageSimSteps: number;
  spikeCount: number;
  lastSpikeMs: number;
  sampleCount: number;
};

export type ZeusFrameMetricsSamplerOptions = {
  maxSamples?: number;
  spikeMs?: number;
};

export class ZeusFrameMetricsSampler {
  private readonly samples: Required<ZeusFrameMetricsSample>[] = [];
  private readonly maxSamples: number;
  private readonly spikeMs: number;
  private spikes = 0;
  private lastSpike = 0;
  private current: ZeusFrameMetricsSnapshot = createEmptyFrameMetricsSnapshot();

  constructor(options: ZeusFrameMetricsSamplerOptions = {}) {
    this.maxSamples = Math.max(1, Math.floor(options.maxSamples ?? 120));
    this.spikeMs = Math.max(0, options.spikeMs ?? 33.4);
  }

  record(sample: ZeusFrameMetricsSample) {
    const normalized = {
      frameMs: Math.max(0, sample.frameMs),
      simMs: Math.max(0, sample.simMs ?? 0),
      renderMs: Math.max(0, sample.renderMs ?? 0),
      simSteps: Math.max(0, sample.simSteps ?? 0),
    };
    if (normalized.frameMs > this.spikeMs) {
      this.spikes += 1;
      this.lastSpike = normalized.frameMs;
    }
    this.samples.push(normalized);
    if (this.samples.length > this.maxSamples) this.samples.shift();
    this.current = {
      fps: normalized.frameMs > 0 ? Math.round(1000 / normalized.frameMs) : 0,
      frameMs: normalized.frameMs,
      averageFrameMs: average(this.samples.map((item) => item.frameMs)),
      simMs: normalized.simMs,
      averageSimMs: average(this.samples.map((item) => item.simMs)),
      renderMs: normalized.renderMs,
      averageRenderMs: average(this.samples.map((item) => item.renderMs)),
      simSteps: normalized.simSteps,
      averageSimSteps: average(this.samples.map((item) => item.simSteps)),
      spikeCount: this.spikes,
      lastSpikeMs: this.lastSpike,
      sampleCount: this.samples.length,
    };
    return this.snapshot();
  }

  snapshot() {
    return { ...this.current };
  }

  reset() {
    this.samples.length = 0;
    this.spikes = 0;
    this.lastSpike = 0;
    this.current = createEmptyFrameMetricsSnapshot();
  }
}

export function createEmptyFrameMetricsSnapshot(): ZeusFrameMetricsSnapshot {
  return {
    fps: 0,
    frameMs: 0,
    averageFrameMs: 0,
    simMs: 0,
    averageSimMs: 0,
    renderMs: 0,
    averageRenderMs: 0,
    simSteps: 0,
    averageSimSteps: 0,
    spikeCount: 0,
    lastSpikeMs: 0,
    sampleCount: 0,
  };
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
