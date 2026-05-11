import type { ClientId, RoomId } from "./inMemoryTransport.js";

export type ZeusSocketMessage<TIntent, TSnapshot> =
  | { type: "join"; roomId: RoomId; clientId: ClientId; snapshot: TSnapshot }
  | { type: "snapshot"; roomId: RoomId; snapshot: TSnapshot }
  | { type: "intent"; intent: TIntent }
  | { type: "error"; message: string };

export function parseZeusSocketMessage<TIntent, TSnapshot>(text: string): ZeusSocketMessage<TIntent, TSnapshot> {
  const message = JSON.parse(text) as unknown;
  if (!isRecord(message) || typeof message.type !== "string") {
    throw new Error("Invalid Zeus socket message");
  }
  if (message.type === "intent" && "intent" in message) return message as ZeusSocketMessage<TIntent, TSnapshot>;
  if (message.type === "error" && typeof message.message === "string") return message as ZeusSocketMessage<TIntent, TSnapshot>;
  if (
    message.type === "join" &&
    typeof message.roomId === "string" &&
    typeof message.clientId === "string" &&
    "snapshot" in message
  ) {
    return message as ZeusSocketMessage<TIntent, TSnapshot>;
  }
  if (message.type === "snapshot" && typeof message.roomId === "string" && "snapshot" in message) {
    return message as ZeusSocketMessage<TIntent, TSnapshot>;
  }
  throw new Error(`Invalid Zeus socket '${message.type}' message`);
}

export function stringifyZeusSocketMessage<TIntent, TSnapshot>(message: ZeusSocketMessage<TIntent, TSnapshot>) {
  return JSON.stringify(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
