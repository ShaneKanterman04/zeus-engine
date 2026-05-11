export type RoomId = string;
export type ClientId = string;
export type ReconnectToken = string;

export type RoomJoinResult<TSnapshot> = {
  roomId: RoomId;
  clientId: ClientId;
  reconnectToken: ReconnectToken;
  snapshot: TSnapshot;
};

export type AuthoritativeRoom<TIntent, TSnapshot> = {
  join(clientId: ClientId): TSnapshot;
  receiveIntent(clientId: ClientId, intent: TIntent): void;
  tick(dt: number): TSnapshot;
  snapshot(): TSnapshot;
};

export type RoomTransport<TIntent, TSnapshot> = {
  createRoom(roomId: RoomId, room: AuthoritativeRoom<TIntent, TSnapshot>): void;
  joinRoom(roomId: RoomId, clientId: ClientId): RoomJoinResult<TSnapshot>;
  reconnect(roomId: RoomId, reconnectToken: ReconnectToken): RoomJoinResult<TSnapshot>;
  sendIntent(roomId: RoomId, clientId: ClientId, intent: TIntent): void;
  tick(roomId: RoomId, dt: number): TSnapshot;
  snapshot(roomId: RoomId): TSnapshot;
  disposeRoom(roomId: RoomId): void;
};

type ClientRecord = {
  clientId: ClientId;
  reconnectToken: ReconnectToken;
};

type HostedRoom<TIntent, TSnapshot> = {
  room: AuthoritativeRoom<TIntent, TSnapshot>;
  clients: Map<ClientId, ClientRecord>;
  tokens: Map<ReconnectToken, ClientId>;
};

export class InMemoryRoomTransport<TIntent, TSnapshot> implements RoomTransport<TIntent, TSnapshot> {
  private rooms = new Map<RoomId, HostedRoom<TIntent, TSnapshot>>();

  createRoom(roomId: RoomId, room: AuthoritativeRoom<TIntent, TSnapshot>) {
    if (this.rooms.has(roomId)) throw new Error(`Room already exists: ${roomId}`);
    this.rooms.set(roomId, { room, clients: new Map(), tokens: new Map() });
  }

  joinRoom(roomId: RoomId, clientId: ClientId) {
    const hosted = this.getRoom(roomId);
    const reconnectToken = `${roomId}:${clientId}:${hosted.clients.size + 1}`;
    const record = { clientId, reconnectToken };
    hosted.clients.set(clientId, record);
    hosted.tokens.set(reconnectToken, clientId);
    return {
      roomId,
      clientId,
      reconnectToken,
      snapshot: cloneSnapshot(hosted.room.join(clientId)),
    };
  }

  reconnect(roomId: RoomId, reconnectToken: ReconnectToken) {
    const hosted = this.getRoom(roomId);
    const clientId = hosted.tokens.get(reconnectToken);
    if (!clientId) throw new Error(`Invalid reconnect token for room: ${roomId}`);
    return {
      roomId,
      clientId,
      reconnectToken,
      snapshot: cloneSnapshot(hosted.room.snapshot()),
    };
  }

  sendIntent(roomId: RoomId, clientId: ClientId, intent: TIntent) {
    const hosted = this.getRoom(roomId);
    if (!hosted.clients.has(clientId)) throw new Error(`Client '${clientId}' has not joined '${roomId}'`);
    hosted.room.receiveIntent(clientId, intent);
  }

  tick(roomId: RoomId, dt: number) {
    return cloneSnapshot(this.getRoom(roomId).room.tick(dt));
  }

  snapshot(roomId: RoomId) {
    return cloneSnapshot(this.getRoom(roomId).room.snapshot());
  }

  disposeRoom(roomId: RoomId) {
    this.rooms.delete(roomId);
  }

  private getRoom(roomId: RoomId) {
    const hosted = this.rooms.get(roomId);
    if (!hosted) throw new Error(`Unknown room: ${roomId}`);
    return hosted;
  }
}

function cloneSnapshot<TSnapshot>(snapshot: TSnapshot): TSnapshot {
  return structuredClone(snapshot);
}
