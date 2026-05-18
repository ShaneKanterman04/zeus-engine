import { InputContext, type InputLayer } from "./InputContext.js";

export class ZeusInput {
  readonly context = new InputContext();
  readonly state = this.context.state;

  attach(target: HTMLElement) {
    window.addEventListener("keydown", (event) => {
      if (this.context.keyDown(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener("keyup", (event) => {
      this.context.keyUp(event.code);
    });
    target.addEventListener("pointermove", (event) => {
      const rect = target.getBoundingClientRect();
      const width = target instanceof HTMLCanvasElement ? target.width : rect.width;
      const height = target instanceof HTMLCanvasElement ? target.height : rect.height;
      this.context.pointerMove({
        x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * width,
        y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * height,
      });
    });
  }

  capture(layer: InputLayer) {
    this.context.capture(layer);
  }

  release(layer: InputLayer) {
    this.context.release(layer);
  }
}
