import { describe, expect, it } from "vitest";
import { ZeusChunkStreamer } from "../packages/zeus-core/src/chunks/ChunkStreamer";

describe("ZeusChunkStreamer", () => {
  it("does not activate an async chunk after it leaves the active set", async () => {
    const pending = deferred<{ id: string } | undefined>();
    const streamer = new ZeusChunkStreamer({
      provider: () => pending.promise,
    });

    expect(streamer.updateActiveKeys(["0:0"]).loading.has("0:0")).toBe(true);
    expect(streamer.updateActiveKeys([]).active.has("0:0")).toBe(false);

    pending.resolve({ id: "stale" });
    await pending.promise;
    await flushAsyncSettled();

    const snapshot = streamer.snapshot();
    expect(snapshot.active.has("0:0")).toBe(false);
    expect(snapshot.loading.has("0:0")).toBe(false);
  });

  it("does not activate an async chunk after clear", async () => {
    const pending = deferred<{ id: string } | undefined>();
    const streamer = new ZeusChunkStreamer({
      provider: () => pending.promise,
    });

    streamer.updateActiveKeys(["0:0"]);
    streamer.clear();
    pending.resolve({ id: "cleared" });
    await pending.promise;
    await flushAsyncSettled();

    const snapshot = streamer.snapshot();
    expect(snapshot.active.size).toBe(0);
    expect(snapshot.loading.size).toBe(0);
    expect(snapshot.failed.size).toBe(0);
  });

  it("uses a pending async chunk when the key re-enters before resolution", async () => {
    const pending = deferred<{ id: string } | undefined>();
    const streamer = new ZeusChunkStreamer({
      provider: () => pending.promise,
    });

    streamer.updateActiveKeys(["0:0"]);
    streamer.updateActiveKeys([]);
    streamer.updateActiveKeys(["0:0"]);
    pending.resolve({ id: "loaded" });
    await pending.promise;
    await flushAsyncSettled();

    expect(streamer.snapshot().active.get("0:0")).toEqual({ id: "loaded" });
  });

  it("caches and reactivates falsy chunk values", () => {
    const streamer = new ZeusChunkStreamer<number>({
      provider: () => 0,
    });

    expect(streamer.updateActiveKeys(["0:0"]).active.get("0:0")).toBe(0);
    streamer.updateActiveKeys([]);
    expect(streamer.updateActiveKeys(["0:0"]).active.get("0:0")).toBe(0);
  });

  it("records failures only while a failed key is still desired", async () => {
    const retained = deferred<number>();
    const stale = deferred<number>();
    const streamer = new ZeusChunkStreamer<number>({
      provider: (key) => (key === "retained" ? retained.promise : stale.promise),
    });

    streamer.updateActiveKeys(["retained", "stale"]);
    streamer.updateActiveKeys(["retained"]);
    retained.reject(new Error("retained failure"));
    stale.reject(new Error("stale failure"));
    await Promise.allSettled([retained.promise, stale.promise]);
    await flushAsyncSettled();

    const snapshot = streamer.snapshot();
    expect(snapshot.failed.get("retained")?.message).toBe("retained failure");
    expect(snapshot.failed.has("stale")).toBe(false);
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flushAsyncSettled() {
  await Promise.resolve();
  await Promise.resolve();
}
