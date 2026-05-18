import { describe, expect, it } from "vitest";
import { ZeusFrameMetricsSampler, ZeusSpatialHashGrid } from "@zeus/core";

type BenchOutput = {
  name: string;
  elapsedMs: number;
  operations: number;
  operationsPerMs: number;
  result: number;
};

describe("Zeus performance benchmarks", () => {
  it("tracks frame metrics sampler throughput", () => {
    const sampler = new ZeusFrameMetricsSampler({ maxSamples: 120, spikeMs: 33.4 });
    const output = measure("frame-metrics-record", 200_000, (iterations) => {
      let result = 0;
      for (let index = 0; index < iterations; index += 1) {
        const snapshot = sampler.record({
          frameMs: 12 + (index % 9),
          simMs: 2 + (index % 3),
          renderMs: 5 + (index % 5),
          simSteps: index % 4,
        });
        result += snapshot.sampleCount + snapshot.spikeCount;
      }
      return result;
    });

    expect(output.result).toBeGreaterThan(0);
    expect(output.elapsedMs).toBeLessThan(5_000);
  });

  it("tracks spatial hash query throughput", () => {
    const grid = new ZeusSpatialHashGrid(96);
    for (let index = 0; index < 12_000; index += 1) {
      grid.set({
        id: `entity-${index}`,
        position: {
          x: (index % 160) * 18,
          y: Math.floor(index / 160) * 18,
        },
        radius: 10 + (index % 5),
      });
    }

    const output = measure("spatial-rect-circle-nearest", 5_000, (iterations) => {
      let result = 0;
      for (let index = 0; index < iterations; index += 1) {
        const x = (index % 120) * 19;
        const y = (index % 80) * 23;
        result += grid.queryRect({ x, y, width: 180, height: 140 }).length;
        result += grid.queryCircle({ x: x + 90, y: y + 70 }, 96).length;
        if (grid.nearest({ x: x + 48, y: y + 32 }, 128)) result += 1;
      }
      return result;
    });

    expect(output.result).toBeGreaterThan(0);
    expect(output.elapsedMs).toBeLessThan(5_000);
  });
});

function measure(name: string, operations: number, run: (operations: number) => number): BenchOutput {
  const started = performance.now();
  const result = run(operations);
  const elapsedMs = performance.now() - started;
  const output = {
    name,
    elapsedMs: round(elapsedMs),
    operations,
    operationsPerMs: round(operations / Math.max(0.001, elapsedMs)),
    result,
  };
  console.info(`[perf] ${JSON.stringify(output)}`);
  return output;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
