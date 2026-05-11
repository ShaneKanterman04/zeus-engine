export class ZeusDebug {
  private samples: number[] = [];
  messages: string[] = [];

  frame(dt: number) {
    this.samples.push(dt);
    if (this.samples.length > 40) this.samples.shift();
  }

  get fps() {
    const average = this.samples.reduce((sum, sample) => sum + sample, 0) / Math.max(1, this.samples.length);
    return Math.round(1 / Math.max(0.001, average));
  }

  log(message: string) {
    this.messages.unshift(message);
    this.messages = this.messages.slice(0, 5);
  }
}
