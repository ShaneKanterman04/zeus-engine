export type ZeusAudioBus = "master" | "music" | "ambience" | "sfx" | "ui";

export class ZeusAudioService {
  private context?: AudioContext;
  private readonly samples = new Map<string, AudioBuffer>();
  private readonly volumes = new Map<ZeusAudioBus, number>([
    ["master", 0.65],
    ["music", 0.5],
    ["ambience", 0.5],
    ["sfx", 0.8],
    ["ui", 0.7],
  ]);

  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  setVolume(bus: ZeusAudioBus, volume: number) {
    this.volumes.set(bus, Math.max(0, Math.min(1, volume)));
  }

  getVolume(bus: ZeusAudioBus) {
    return this.volumes.get(bus) ?? 1;
  }

  async loadSample(id: string, url: string) {
    await this.unlock();
    if (!this.context) throw new Error("Audio context was not created");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load audio sample '${id}': ${response.status}`);
    const data = await response.arrayBuffer();
    this.samples.set(id, await this.context.decodeAudioData(data));
  }

  hasSample(id: string) {
    return this.samples.has(id);
  }

  playSample(bus: ZeusAudioBus, id: string) {
    if (!this.context || this.context.state !== "running") return false;
    const sample = this.samples.get(id);
    if (!sample) return false;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = sample;
    gain.gain.value = this.getVolume("master") * this.getVolume(bus);
    source.connect(gain);
    gain.connect(this.context.destination);
    source.start();
    return true;
  }

  playTone(bus: ZeusAudioBus, frequency: number, durationSeconds = 0.08) {
    if (!this.context || this.context.state !== "running") return false;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.getVolume("master") * this.getVolume(bus) * 0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + durationSeconds);
    return true;
  }
}
