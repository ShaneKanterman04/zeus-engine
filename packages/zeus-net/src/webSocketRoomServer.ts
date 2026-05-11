import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Duplex } from "node:stream";
import type { AuthoritativeRoom, ClientId, RoomId } from "./inMemoryTransport";

export type ZeusSocketMessage<TIntent, TSnapshot> =
  | { type: "join"; roomId: RoomId; clientId: ClientId; snapshot: TSnapshot }
  | { type: "snapshot"; roomId: RoomId; snapshot: TSnapshot }
  | { type: "intent"; intent: TIntent }
  | { type: "error"; message: string };

type SocketClient = {
  socket: Duplex;
  roomId: RoomId;
  clientId: ClientId;
};

export class ZeusWebSocketRoomServer<TIntent, TSnapshot> {
  private readonly server: Server;
  private readonly clients = new Set<SocketClient>();
  private room?: { roomId: RoomId; room: AuthoritativeRoom<TIntent, TSnapshot> };

  constructor() {
    this.server = createServer();
    this.server.on("upgrade", (request, socket) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const clientId = url.searchParams.get("clientId") ?? "socket-client";
      const roomId = url.searchParams.get("roomId") ?? this.room?.roomId;
      if (!roomId || this.room?.roomId !== roomId) {
        socket.destroy();
        return;
      }
      acceptWebSocket(request.headers["sec-websocket-key"], socket);
      const client = { socket, roomId, clientId };
      this.clients.add(client);
      socket.on("data", (data) => this.receive(client, data));
      socket.on("close", () => this.clients.delete(client));
      socket.on("error", () => this.clients.delete(client));
      this.send(client, { type: "join", roomId, clientId, snapshot: this.room.room.join(clientId) });
    });
  }

  hostRoom(roomId: RoomId, room: AuthoritativeRoom<TIntent, TSnapshot>) {
    this.room = { roomId, room };
  }

  async listen(port = 0, host = "127.0.0.1") {
    await new Promise<void>((resolve) => this.server.listen(port, host, resolve));
    return this.port;
  }

  tick(dt: number) {
    if (!this.room) throw new Error("No room hosted");
    const snapshot = this.room.room.tick(dt);
    this.broadcast({ type: "snapshot", roomId: this.room.roomId, snapshot });
    return snapshot;
  }

  async close() {
    for (const client of this.clients) client.socket.destroy();
    this.clients.clear();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  get port() {
    const address = this.server.address() as AddressInfo | null;
    if (!address) throw new Error("WebSocket room server is not listening");
    return address.port;
  }

  private receive(client: SocketClient, data: Buffer) {
    if (!this.room) return;
    const text = decodeTextFrame(data);
    if (!text) return;
    const message = JSON.parse(text) as ZeusSocketMessage<TIntent, TSnapshot>;
    if (message.type === "intent") {
      this.room.room.receiveIntent(client.clientId, message.intent);
    }
  }

  private broadcast(message: ZeusSocketMessage<TIntent, TSnapshot>) {
    for (const client of this.clients) this.send(client, message);
  }

  private send(client: SocketClient, message: ZeusSocketMessage<TIntent, TSnapshot>) {
    client.socket.write(encodeTextFrame(JSON.stringify(message)));
  }
}

function acceptWebSocket(key: string | string[] | undefined, socket: Duplex) {
  const socketKey = Array.isArray(key) ? key[0] : key;
  if (!socketKey) {
    socket.destroy();
    return;
  }
  const accept = createHash("sha1")
    .update(`${socketKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "\r\n",
    ].join("\r\n"),
  );
}

function decodeTextFrame(data: Buffer) {
  const opcode = data[0] & 0x0f;
  if (opcode === 0x8) return "";
  if (opcode !== 0x1) throw new Error("Only text WebSocket frames are supported");
  const masked = (data[1] & 0x80) !== 0;
  let length = data[1] & 0x7f;
  let offset = 2;
  if (length === 126) {
    length = data.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    throw new Error("Large WebSocket frames are not supported");
  }
  const mask = masked ? data.subarray(offset, offset + 4) : undefined;
  if (masked) offset += 4;
  const payload = Buffer.from(data.subarray(offset, offset + length));
  if (mask) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }
  return payload.toString("utf8");
}

function encodeTextFrame(text: string) {
  const payload = Buffer.from(text, "utf8");
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  }
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}
