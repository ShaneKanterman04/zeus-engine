import type { ClientId, RoomId } from "./inMemoryTransport";
import type { ZeusSocketMessage } from "./webSocketRoomServer";

export type ZeusWebSocketRoomClientOptions = {
  url: string | URL;
  roomId: RoomId;
  clientId: ClientId;
  webSocket?: typeof WebSocket;
};

export type ZeusWebSocketRoomJoin<TSnapshot> = {
  roomId: RoomId;
  clientId: ClientId;
  snapshot: TSnapshot;
};

export class ZeusWebSocketRoomClient<TIntent, TSnapshot> {
  readonly ready: Promise<ZeusWebSocketRoomJoin<TSnapshot>>;
  readonly roomId: RoomId;
  readonly clientId: ClientId;
  private readonly socket: WebSocket;
  private latest?: TSnapshot;

  constructor(options: ZeusWebSocketRoomClientOptions) {
    this.roomId = options.roomId;
    this.clientId = options.clientId;
    const WebSocketCtor = options.webSocket ?? WebSocket;
    this.socket = new WebSocketCtor(buildRoomUrl(options.url, options.roomId, options.clientId));
    this.ready = new Promise((resolve, reject) => {
      const failBeforeJoin = () => {
        if (!this.latest) reject(new Error(`WebSocket room connection closed before joining '${this.roomId}'`));
      };
      this.socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as ZeusSocketMessage<TIntent, TSnapshot>;
        if (message.type === "join") {
          this.latest = structuredClone(message.snapshot);
          resolve({ roomId: message.roomId, clientId: message.clientId, snapshot: this.snapshot() });
        } else if (message.type === "snapshot") {
          this.latest = structuredClone(message.snapshot);
        } else if (message.type === "error") {
          reject(new Error(message.message));
        }
      });
      this.socket.addEventListener("error", () => {
        if (!this.latest) reject(new Error(`WebSocket room connection failed for '${this.roomId}'`));
      });
      this.socket.addEventListener("close", failBeforeJoin);
    });
  }

  sendIntent(intent: TIntent) {
    if (this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type: "intent", intent } satisfies ZeusSocketMessage<TIntent, TSnapshot>));
    return true;
  }

  snapshot() {
    if (!this.latest) throw new Error("No WebSocket room snapshot has been received");
    return structuredClone(this.latest);
  }

  close() {
    this.socket.close();
  }
}

function buildRoomUrl(url: string | URL, roomId: RoomId, clientId: ClientId) {
  const roomUrl = new URL(url);
  roomUrl.searchParams.set("roomId", roomId);
  roomUrl.searchParams.set("clientId", clientId);
  return roomUrl;
}
