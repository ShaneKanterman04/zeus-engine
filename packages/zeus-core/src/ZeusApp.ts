import { FixedStepLoop } from "./simulation/FixedStepLoop";

export type ZeusRenderableScene = {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
};

export type ZeusAppOptions = {
  width?: number;
  height?: number;
  ariaLabel?: string;
  fixedStepSeconds?: number;
  now?: () => number;
};

export class ZeusApp {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private animation = 0;
  private last: number;
  private readonly loop: FixedStepLoop;
  private readonly width: number;
  private readonly height: number;

  constructor(
    private readonly root: HTMLElement,
    private readonly scene: ZeusRenderableScene,
    options: ZeusAppOptions = {},
  ) {
    this.width = options.width ?? 1280;
    this.height = options.height ?? 720;
    this.last = options.now?.() ?? performance.now();
    this.loop = new FixedStepLoop({ stepSeconds: options.fixedStepSeconds ?? 1 / 20 });
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.setAttribute("aria-label", options.ariaLabel ?? "Zeus game canvas");
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;
    this.root.append(this.canvas);
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  start() {
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.loop.advance(dt, (stepSeconds) => this.scene.update(stepSeconds));
      this.scene.render(this.ctx);
      this.animation = requestAnimationFrame(tick);
    };
    this.animation = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.animation);
  }

  resize() {
    const scale = Math.min(window.innerWidth / this.width, window.innerHeight / this.height);
    this.canvas.style.width = `${Math.floor(this.width * scale)}px`;
    this.canvas.style.height = `${Math.floor(this.height * scale)}px`;
  }
}
