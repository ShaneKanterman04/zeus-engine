import { InputContext, type InputLayer } from "./InputContext";

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
      this.context.pointerMove({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    });
  }

  capture(layer: InputLayer) {
    this.context.capture(layer);
  }

  release(layer: InputLayer) {
    this.context.release(layer);
  }
}
