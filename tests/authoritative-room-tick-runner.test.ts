import { describe, expect, it } from "vitest";
import type { AuthoritativeRoom } from "../packages/zeus-net/src/inMemoryTransport";
import { ZeusAuthoritativeRoomTickRunner } from "../packages/zeus-net/src/authoritativeRoomTickRunner";

type Intent = { move: number };
type Snapshot = { ticks: number; x: number };

describe("ZeusAuthoritativeRoomTickRunner", () => {
  it("advances an authoritative room at a fixed step and returns cadence snapshots", () => {
    const room = createRoom();
    const runner = new ZeusAuthoritativeRoomTickRunner({ room, stepSeconds: 0.1, snapshotIntervalSeconds: 0.2 });

    expect(runner.advance(0.05)).toEqual({ steps: 0, snapshot: undefined });
    expect(runner.advance(0.15)).toEqual({ steps: 2, snapshot: { ticks: 2, x: 0 } });
    expect(runner.advance(0.1)).toEqual({ steps: 1, snapshot: undefined });
  });

  it("drops excess backlog at the configured step cap", () => {
    const room = createRoom();
    const runner = new ZeusAuthoritativeRoomTickRunner({ room, stepSeconds: 0.1, maxFrameSeconds: 1, maxStepsPerFrame: 2 });

    expect(runner.advance(1).steps).toBe(2);
    expect(runner.advance(0).steps).toBe(0);
  });

  it("reports tick budget overruns", () => {
    const events: unknown[] = [];
    let now = 0;
    const runner = new ZeusAuthoritativeRoomTickRunner({
      room: createRoom(),
      stepSeconds: 0.1,
      tickBudgetMs: 5,
      now: () => {
        now += 10;
        return now;
      },
      onTickOverBudget: (event) => events.push(event),
    });

    runner.advance(0.1);

    expect(events).toEqual([{ tickMs: 10, budgetMs: 5, steps: 1 }]);
  });
});

function createRoom(): AuthoritativeRoom<Intent, Snapshot> {
  let ticks = 0;
  let x = 0;
  return {
    join() {
      return { ticks, x };
    },
    receiveIntent(_clientId, intent) {
      x += intent.move;
    },
    tick() {
      ticks += 1;
      return { ticks, x };
    },
    snapshot() {
      return { ticks, x };
    },
  };
}
