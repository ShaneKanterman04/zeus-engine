export type ZeusRoomSnapshot = {
  roomId: string;
  clientId: string;
  state: unknown;
};

export type ZeusRoomHandler<TIntent, TState> = {
  join(clientId: string): TState;
  receiveIntent(clientId: string, intent: TIntent): void;
  tick(dt: number): TState;
};

type HostedRoom<TIntent, TState> = {
  handler: ZeusRoomHandler<TIntent, TState>;
  clients: Set<string>;
};

export class InMemoryRoomHost<TIntent, TState> {
  private rooms = new Map<string, HostedRoom<TIntent, TState>>();

  createRoom(roomId: string, handler: ZeusRoomHandler<TIntent, TState>) {
    if (this.rooms.has(roomId)) throw new Error(`Room already exists: ${roomId}`);
    this.rooms.set(roomId, { handler, clients: new Set() });
  }

  join(roomId: string, clientId: string): ZeusRoomSnapshot {
    const room = this.getRoom(roomId);
    room.clients.add(clientId);
    return { roomId, clientId, state: room.handler.join(clientId) };
  }

  sendIntent(roomId: string, clientId: string, intent: TIntent) {
    const room = this.getRoom(roomId);
    if (!room.clients.has(clientId)) throw new Error(`Client '${clientId}' has not joined '${roomId}'`);
    room.handler.receiveIntent(clientId, intent);
  }

  tick(roomId: string, dt: number) {
    return this.getRoom(roomId).handler.tick(dt);
  }

  hasRoom(roomId: string) {
    return this.rooms.has(roomId);
  }

  private getRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error(`Unknown room: ${roomId}`);
    return room;
  }
}
