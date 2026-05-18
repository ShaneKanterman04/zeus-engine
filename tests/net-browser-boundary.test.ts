import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("@zeus/net browser boundary", () => {
  it("keeps the Node-only WebSocket server off the browser-safe root entry", async () => {
    const rootEntry = await readFile(new URL("../packages/zeus-net/src/index.ts", import.meta.url), "utf8");
    const packageJson = JSON.parse(await readFile(new URL("../packages/zeus-net/package.json", import.meta.url), "utf8"));

    expect(rootEntry).not.toContain("ZeusWebSocketRoomServer");
    expect(rootEntry).not.toContain("webSocketRoomServer");
    expect(packageJson.exports["./web-socket-room-server"]).toEqual({
      types: "./dist/webSocketRoomServer.d.ts",
      import: "./dist/webSocketRoomServer.js",
    });
  });
});
