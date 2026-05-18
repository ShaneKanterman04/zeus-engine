import { describe, expect, it } from "vitest";
import type { AuthoritativeRoom } from "../packages/zeus-net/src/inMemoryTransport";
import { ZeusWebSocketRoomClient } from "../packages/zeus-net/src/webSocketRoomClient";
import { ZeusWebSocketRoomServer } from "../packages/zeus-net/src/webSocketRoomServer";

type Intent = { move: number };
type Snapshot = { joined: string[]; x: number };

describe("ZeusWebSocketRoomServer", () => {
  it("issues reconnect tokens and restores snapshots without rejoining", async () => {
    const server = new ZeusWebSocketRoomServer<Intent, Snapshot>();
    let joinCalls = 0;
    let x = 0;
    const joined: string[] = [];
    server.hostRoom("socket-room", {
      join(clientId) {
        joinCalls += 1;
        if (!joined.includes(clientId)) joined.push(clientId);
        return { joined: [...joined], x };
      },
      receiveIntent(_clientId, intent) {
        x += intent.move;
      },
      tick() {
        return { joined: [...joined], x };
      },
      snapshot() {
        return { joined: [...joined], x };
      },
    });
    const port = await server.listen();
    const host = new ZeusWebSocketRoomClient<Intent, Snapshot>({
      url: `ws://127.0.0.1:${port}/`,
      roomId: "socket-room",
      clientId: "host",
    });

    try {
      const join = await host.ready;
      expect(join).toMatchObject({ clientId: "host", snapshot: { joined: ["host"], x: 0 } });
      expect(join.reconnectToken).toMatch(/^socket-room:host:/);
      expect(joinCalls).toBe(1);
      host.sendIntent({ move: 3 });
      await waitForCondition(() => {
        server.tick(1 / 20);
        return host.snapshot().x === 3;
      });
      host.close();

      const resumed = new ZeusWebSocketRoomClient<Intent, Snapshot>({
        url: `ws://127.0.0.1:${port}/`,
        roomId: "socket-room",
        clientId: "host",
        reconnectToken: join.reconnectToken,
      });
      try {
        await expect(resumed.ready).resolves.toEqual({
          roomId: "socket-room",
          clientId: "host",
          reconnectToken: join.reconnectToken,
          snapshot: { joined: ["host"], x: 3 },
        });
        expect(joinCalls).toBe(1);
      } finally {
        resumed.close();
      }
    } finally {
      host.close();
      await server.close();
    }
  });

  it("rejects invalid WebSocket reconnect tokens without taking down the hosted room", async () => {
    const server = new ZeusWebSocketRoomServer<Intent, Snapshot>();
    server.hostRoom("socket-room", createBoundedRoom(1));
    const port = await server.listen();
    const host = new ZeusWebSocketRoomClient<Intent, Snapshot>({
      url: `ws://127.0.0.1:${port}/`,
      roomId: "socket-room",
      clientId: "host",
    });
    const invalid = new ZeusWebSocketRoomClient<Intent, Snapshot>({
      url: `ws://127.0.0.1:${port}/`,
      roomId: "socket-room",
      clientId: "host",
      reconnectToken: "socket-room:host:missing",
    });

    try {
      await expect(host.ready).resolves.toMatchObject({ clientId: "host", snapshot: { joined: ["host"], x: 0 } });
      await expect(invalid.ready).rejects.toThrow(/Invalid reconnect token/);
      expect(host.sendIntent({ move: 2 })).toBe(true);
      await waitForCondition(() => {
        server.tick(1 / 20);
        return host.snapshot().x === 2;
      });
    } finally {
      host.close();
      invalid.close();
      await server.close();
    }
  });

  it("rejects over-capacity joins without taking down the hosted room", async () => {
    const server = new ZeusWebSocketRoomServer<Intent, Snapshot>();
    server.hostRoom("socket-room", createBoundedRoom(1));
    const port = await server.listen();
    const host = new ZeusWebSocketRoomClient<Intent, Snapshot>({
      url: `ws://127.0.0.1:${port}/`,
      roomId: "socket-room",
      clientId: "host",
    });
    const overflow = new ZeusWebSocketRoomClient<Intent, Snapshot>({
      url: `ws://127.0.0.1:${port}/`,
      roomId: "socket-room",
      clientId: "overflow",
    });

    try {
      await expect(host.ready).resolves.toMatchObject({ clientId: "host", snapshot: { joined: ["host"], x: 0 } });
      await expect(overflow.ready).rejects.toThrow(/full/);
      expect(host.sendIntent({ move: 2 })).toBe(true);
      await waitForCondition(() => {
        server.tick(1 / 20);
        return host.snapshot().x === 2;
      });
      expect(host.snapshot()).toEqual({ joined: ["host"], x: 2 });
    } finally {
      host.close();
      overflow.close();
      await server.close();
    }
  });
});

function createBoundedRoom(maxClients: number): AuthoritativeRoom<Intent, Snapshot> {
  let x = 0;
  const clients: string[] = [];
  const snapshot = () => ({ joined: [...clients], x });
  return {
    join(clientId) {
      if (!clients.includes(clientId)) {
        if (clients.length >= maxClients) throw new Error(`Room is full`);
        clients.push(clientId);
      }
      return snapshot();
    },
    receiveIntent(clientId, intent) {
      if (!clients.includes(clientId)) throw new Error(`Client '${clientId}' has not joined`);
      x += intent.move;
    },
    tick() {
      return snapshot();
    },
    snapshot,
  };
}

async function waitForCondition(condition: () => boolean, timeoutMs = 1000) {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error("Timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
