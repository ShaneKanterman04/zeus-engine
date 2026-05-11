export type FpsOverlayState = {
  fps: number;
  messages: string[];
};

export function formatFpsOverlay(state: FpsOverlayState) {
  return [`FPS ${state.fps}`, ...state.messages].join("\n");
}
