import type { InMemoryRoomHost, ZeusRoomSnapshot } from "./InMemoryRoomHost.js";

export class InMemoryRoomClient<TIntent, TState> {
  private joined = false;

  constructor(
    private readonly host: InMemoryRoomHost<TIntent, TState>,
    readonly roomId: string,
    readonly clientId: string,
  ) {}

  join(): ZeusRoomSnapshot {
    const snapshot = this.host.join(this.roomId, this.clientId);
    this.joined = true;
    return snapshot;
  }

  sendIntent(intent: TIntent) {
    if (!this.joined) throw new Error("Cannot send intent before joining a room");
    this.host.sendIntent(this.roomId, this.clientId, intent);
  }

  tick(dt: number) {
    if (!this.joined) throw new Error("Cannot tick before joining a room");
    return this.host.tick(this.roomId, dt);
  }
}
