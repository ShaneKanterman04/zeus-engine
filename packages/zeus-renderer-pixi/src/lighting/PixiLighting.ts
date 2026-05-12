import { Graphics } from "pixi.js";
import type { Vec2, ZeusAmbientLight, ZeusResolvedLightSource } from "@zeus/core";

export type PixiLightingOptions = {
  camera: Vec2;
  viewport: { width: number; height: number };
  ambient?: ZeusAmbientLight;
  lights: readonly ZeusResolvedLightSource[];
  qualityMode?: "standard" | "low";
};

export function createPixiLightingGraphics(options: PixiLightingOptions) {
  const graphics = new Graphics();
  const ambient = options.ambient ?? { color: "#000000", alpha: 0 };
  if (ambient.alpha > 0) {
    graphics
      .rect(options.camera.x, options.camera.y, options.viewport.width, options.viewport.height)
      .fill({ color: ambient.color, alpha: clamp01(ambient.alpha) });
  }

  const ringCount = options.qualityMode === "low" ? 3 : 6;
  for (const light of options.lights) {
    drawLight(graphics, light, ringCount);
  }

  return graphics;
}

function drawLight(graphics: Graphics, light: ZeusResolvedLightSource, ringCount: number) {
  const radius = Math.max(0, light.radius);
  const intensity = clamp01(light.intensity);
  for (let index = ringCount; index >= 1; index -= 1) {
    const t = index / ringCount;
    const alpha = intensity * 0.1 * (1 - t * 0.72);
    graphics.circle(light.position.x, light.position.y, radius * t).fill({ color: light.color, alpha });
  }
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
