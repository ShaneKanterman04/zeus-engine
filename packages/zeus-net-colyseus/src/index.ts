export type ColyseusLikeRoom<State, Intent> = {
  roomId: string;
  sessionId: string;
  state: State;
  send(type: "intent", intent: Intent): void;
  onStateChange(callback: (state: State) => void): void;
  leave(): Promise<void> | void;
};

export type ColyseusJoiner<State, Intent> = (
  roomName: string,
  options: { roomId?: string; clientId: string },
) => Promise<ColyseusLikeRoom<State, Intent>>;

export class ZeusColyseusClient<State, Intent> {
  private room?: ColyseusLikeRoom<State, Intent>;
  private latestSnapshot?: State;

  constructor(private readonly joiner: ColyseusJoiner<State, Intent>) {}

  async join(roomName: string, clientId: string, roomId?: string) {
    this.room = await this.joiner(roomName, { roomId, clientId });
    this.latestSnapshot = structuredClone(this.room.state);
    this.room.onStateChange((state) => {
      this.latestSnapshot = structuredClone(state);
    });
    return {
      roomId: this.room.roomId,
      clientId,
      sessionId: this.room.sessionId,
      snapshot: this.snapshot(),
    };
  }

  sendIntent(intent: Intent) {
    if (!this.room) throw new Error("Join a Colyseus room before sending intents");
    this.room.send("intent", intent);
  }

  snapshot() {
    if (!this.latestSnapshot) throw new Error("No Colyseus snapshot available");
    return structuredClone(this.latestSnapshot);
  }

  async leave() {
    await this.room?.leave();
    this.room = undefined;
    this.latestSnapshot = undefined;
  }
}
