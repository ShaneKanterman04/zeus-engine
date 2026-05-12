import {
  drawDeterministicSpeckles,
  drawEllipse,
  drawLine,
  drawPolygon,
  drawRasterLine,
  drawRect,
  drawTriangle,
  setPixel,
  fillPixelCanvas,
  type PixelCanvas,
  type RgbaColor,
} from "./PixelCanvas.js";
import type { PixelSpritePalette, PixelSpriteTemplateRegistry } from "./PixelSpriteGenerator.js";

export const defaultPixelSpritePalette = {
  transparent: [0, 0, 0, 0],
  outline: [31, 29, 24, 255],
  outlineSoft: [61, 52, 42, 255],
  furDark: [95, 79, 58, 255],
  fur: [139, 112, 78, 255],
  furLight: [181, 151, 102, 255],
  rabbit: [174, 166, 143, 255],
  rabbitLight: [213, 204, 180, 255],
  coat: [67, 86, 82, 255],
  coatDark: [41, 55, 54, 255],
  skin: [168, 118, 84, 255],
  leather: [96, 61, 38, 255],
  woodDark: [76, 47, 30, 255],
  wood: [116, 75, 44, 255],
  woodLight: [157, 105, 58, 255],
  roof: [74, 66, 57, 255],
  stone: [93, 91, 83, 255],
  stoneLight: [134, 130, 115, 255],
  canvas: [131, 118, 88, 255],
  ember: [245, 161, 66, 255],
  flame: [255, 218, 107, 255],
  track: [82, 68, 54, 255],
  blood: [126, 24, 20, 255],
  snow: [217, 226, 218, 255],
  snowShade: [181, 197, 190, 255],
  ice: [136, 177, 188, 255],
  dirt: [96, 78, 52, 255],
  dirtLight: [140, 113, 72, 255],
  grass: [91, 116, 73, 255],
  grassDry: [149, 137, 89, 255],
  reed: [142, 124, 78, 255],
  bark: [84, 61, 42, 255],
  barkLight: [126, 91, 57, 255],
  pine: [58, 96, 66, 255],
  pineDark: [34, 65, 47, 255],
  berry: [146, 42, 47, 255],
} satisfies PixelSpritePalette;

export const builtinPixelSpriteTemplates: PixelSpriteTemplateRegistry = {
  "humanoid.down": ({ canvas, palette }) => drawHumanoid(canvas, mergedPalette(palette), "down"),
  "humanoid.up": ({ canvas, palette }) => drawHumanoid(canvas, mergedPalette(palette), "up"),
  "humanoid.left": ({ canvas, palette }) => drawHumanoid(canvas, mergedPalette(palette), "left"),
  "humanoid.right": ({ canvas, palette }) => drawHumanoid(canvas, mergedPalette(palette), "right"),
  "animal.rabbit.down": ({ canvas, palette }) => drawRabbit(canvas, mergedPalette(palette), "down"),
  "animal.rabbit.up": ({ canvas, palette }) => drawRabbit(canvas, mergedPalette(palette), "up"),
  "animal.rabbit.left": ({ canvas, palette }) => drawRabbit(canvas, mergedPalette(palette), "left"),
  "animal.rabbit.right": ({ canvas, palette }) => drawRabbit(canvas, mergedPalette(palette), "right"),
  "animal.deer.down": ({ canvas, palette }) => drawDeer(canvas, mergedPalette(palette), "down"),
  "animal.deer.up": ({ canvas, palette }) => drawDeer(canvas, mergedPalette(palette), "up"),
  "animal.deer.left": ({ canvas, palette }) => drawDeer(canvas, mergedPalette(palette), "left"),
  "animal.deer.right": ({ canvas, palette }) => drawDeer(canvas, mergedPalette(palette), "right"),
  "structure.cabin": ({ canvas, palette }) => drawCabin(canvas, mergedPalette(palette)),
  "prop.hearth": ({ canvas, palette }) => drawHearth(canvas, mergedPalette(palette)),
  "prop.woodpile": ({ canvas, palette }) => drawWoodpile(canvas, mergedPalette(palette)),
  "prop.cache": ({ canvas, palette }) => drawCache(canvas, mergedPalette(palette)),
  "sign.track.rabbit": ({ canvas, palette }) => drawRabbitTracks(canvas, mergedPalette(palette)),
  "sign.track.deer": ({ canvas, palette }) => drawDeerTracks(canvas, mergedPalette(palette)),
  "sign.track.blood": ({ canvas, palette }) => drawBloodTracks(canvas, mergedPalette(palette)),
  "tile.snow": ({ canvas, palette }) => drawSnowTile(canvas, mergedPalette(palette)),
  "tile.packed-snow": ({ canvas, palette }) => drawPackedSnowTile(canvas, mergedPalette(palette)),
  "tile.dirt-path": ({ canvas, palette }) => drawDirtPathTile(canvas, mergedPalette(palette)),
  "tile.cabin-clearing": ({ canvas, palette }) => drawCabinClearingTile(canvas, mergedPalette(palette)),
  "tile.creek-edge": ({ canvas, palette }) => drawCreekEdgeTile(canvas, mergedPalette(palette)),
  "plant.winter-grass": ({ canvas, palette }) => drawWinterGrass(canvas, mergedPalette(palette)),
  "plant.dead-stalks": ({ canvas, palette }) => drawDeadStalks(canvas, mergedPalette(palette)),
  "plant.reeds": ({ canvas, palette }) => drawReeds(canvas, mergedPalette(palette)),
  "bush.bare": ({ canvas, palette }) => drawBareBush(canvas, mergedPalette(palette)),
  "bush.berry": ({ canvas, palette }) => drawBerryBush(canvas, mergedPalette(palette)),
  "bush.scrub": ({ canvas, palette }) => drawScrubBush(canvas, mergedPalette(palette)),
  "tree.pine": ({ canvas, palette }) => drawPineTree(canvas, mergedPalette(palette)),
  "tree.bare": ({ canvas, palette }) => drawBareTree(canvas, mergedPalette(palette)),
  "prop.stump": ({ canvas, palette }) => drawStump(canvas, mergedPalette(palette)),
  "prop.stones": ({ canvas, palette }) => drawStones(canvas, mergedPalette(palette)),
  "prop.snow-mound": ({ canvas, palette }) => drawSnowMound(canvas, mergedPalette(palette)),
};

function mergedPalette(palette: PixelSpritePalette) {
  return { ...defaultPixelSpritePalette, ...palette };
}

function c(palette: PixelSpritePalette, name: keyof typeof defaultPixelSpritePalette): RgbaColor {
  return palette[name] ?? defaultPixelSpritePalette[name];
}

function drawHumanoid(canvas: PixelCanvas, palette: PixelSpritePalette, direction: "up" | "down" | "left" | "right") {
  const side = direction === "left" || direction === "right";
  const facingUp = direction === "up";
  const flip = direction === "left" ? -1 : 1;
  const cx = Math.floor(canvas.width / 2);
  drawRect(canvas, cx - 9, 21, 18, 23, c(palette, "outline"));
  drawRect(canvas, cx - 8, 22, 16, 20, c(palette, "coatDark"));
  drawRect(canvas, cx - 6, 23, 12, 17, c(palette, "coat"));
  drawRect(canvas, cx - 5, 43, 4, 9, c(palette, "outline"));
  drawRect(canvas, cx + 1, 43, 4, 9, c(palette, "outline"));
  drawRect(canvas, cx - 4, 43, 3, 7, c(palette, "leather"));
  drawRect(canvas, cx + 1, 43, 3, 7, c(palette, "leather"));
  drawRect(canvas, cx - 5, 11, 10, 9, c(palette, "outline"));
  drawRect(canvas, cx - 4, 12, 8, 7, c(palette, "skin"));
  drawRect(canvas, cx - 6, 8, 12, 5, c(palette, "outline"));
  drawRect(canvas, cx - 5, 7, 10, 4, c(palette, "furDark"));
  drawRect(canvas, cx - 3, 6, 6, 2, c(palette, "fur"));
  if (side) {
    drawRect(canvas, cx + flip * 7 - (flip < 0 ? 3 : 0), 13, 3, 5, c(palette, "skin"));
    drawRect(canvas, cx - flip * 10 - (flip < 0 ? 0 : 2), 26, 3, 14, c(palette, "outline"));
    drawRect(canvas, cx - flip * 9 - (flip < 0 ? 0 : 2), 27, 2, 12, c(palette, "leather"));
    drawRect(canvas, cx + flip * 8 - (flip < 0 ? 3 : 0), 25, 3, 14, c(palette, "outline"));
    drawRect(canvas, cx + flip * 8 - (flip < 0 ? 2 : 0), 26, 2, 12, c(palette, "coat"));
  } else {
    drawRect(canvas, cx - 12, 24, 4, 15, c(palette, "outline"));
    drawRect(canvas, cx + 8, 24, 4, 15, c(palette, "outline"));
    drawRect(canvas, cx - 11, 25, 2, 12, c(palette, "coat"));
    drawRect(canvas, cx + 9, 25, 2, 12, c(palette, "coat"));
    if (!facingUp) {
      setPixel(canvas, cx - 3, 16, c(palette, "outline"));
      setPixel(canvas, cx + 3, 16, c(palette, "outline"));
    }
  }
  drawRect(canvas, cx - 2, 28, 4, 10, c(palette, "leather"));
  if (facingUp) drawRect(canvas, cx - 5, 14, 10, 5, c(palette, "furDark"));
  addFootAnchor(canvas);
}

function drawCabin(canvas: PixelCanvas, palette: PixelSpritePalette) {
  const cx = Math.floor(canvas.width / 2);
  drawRect(canvas, cx - 57, 34, 114, 53, c(palette, "outline"));
  drawRect(canvas, cx - 53, 38, 106, 45, c(palette, "woodDark"));
  for (let y = 42; y <= 78; y += 8) {
    drawRect(canvas, cx - 51, y, 102, 3, c(palette, "wood"));
    drawRect(canvas, cx - 51, y + 3, 102, 1, c(palette, "outlineSoft"));
  }
  drawPolygon(canvas, [[cx - 66, 35], [cx, 9], [cx + 66, 35], [cx + 56, 45], [cx, 23], [cx - 56, 45]], c(palette, "outline"));
  drawPolygon(canvas, [[cx - 58, 33], [cx, 12], [cx + 58, 33], [cx + 49, 39], [cx, 22], [cx - 49, 39]], c(palette, "roof"));
  drawRect(canvas, cx - 10, 58, 20, 29, c(palette, "outline"));
  drawRect(canvas, cx - 7, 61, 14, 26, c(palette, "leather"));
  drawRect(canvas, cx - 42, 50, 19, 15, c(palette, "outline"));
  drawRect(canvas, cx - 39, 53, 13, 9, c(palette, "flame"));
  drawRect(canvas, cx + 28, 50, 19, 15, c(palette, "outline"));
  drawRect(canvas, cx + 31, 53, 13, 9, c(palette, "flame"));
  drawRect(canvas, cx + 37, 16, 13, 20, c(palette, "outline"));
  drawRect(canvas, cx + 40, 13, 8, 22, c(palette, "stone"));
  drawRect(canvas, cx + 41, 15, 6, 3, c(palette, "stoneLight"));
  addFootAnchor(canvas);
}

function drawRabbit(canvas: PixelCanvas, palette: PixelSpritePalette, direction: "up" | "down" | "left" | "right") {
  const cx = Math.floor(canvas.width / 2);
  const cy = Math.floor(canvas.height / 2) + 2;
  const side = direction === "left" || direction === "right";
  const flip = direction === "left" ? -1 : 1;
  if (side) {
    drawEllipse(canvas, cx - flip * 2, cy + 3, 13, 8, c(palette, "outline"));
    drawEllipse(canvas, cx - flip * 2, cy + 3, 11, 6, c(palette, "rabbit"));
    drawEllipse(canvas, cx + flip * 10, cy - 2, 7, 6, c(palette, "outline"));
    drawEllipse(canvas, cx + flip * 10, cy - 2, 5, 4, c(palette, "rabbitLight"));
    drawRect(canvas, cx + flip * 12 - (flip < 0 ? 2 : 0), cy - 12, 2, 11, c(palette, "outline"));
    drawRect(canvas, cx + flip * 15 - (flip < 0 ? 2 : 0), cy - 11, 2, 10, c(palette, "outline"));
    setPixel(canvas, cx + flip * 14, cy - 2, c(palette, "outline"));
    drawEllipse(canvas, cx - flip * 13, cy + 2, 4, 4, c(palette, "rabbitLight"));
  } else {
    drawEllipse(canvas, cx, cy + 3, 9, 10, c(palette, "outline"));
    drawEllipse(canvas, cx, cy + 3, 7, 8, c(palette, "rabbit"));
    drawEllipse(canvas, cx, cy - 5, 7, 6, c(palette, "outline"));
    drawEllipse(canvas, cx, cy - 5, 5, 4, c(palette, "rabbitLight"));
    drawRect(canvas, cx - 5, cy - 16, 2, 11, c(palette, "outline"));
    drawRect(canvas, cx + 3, cy - 16, 2, 11, c(palette, "outline"));
    if (direction === "down") {
      setPixel(canvas, cx - 2, cy - 5, c(palette, "outline"));
      setPixel(canvas, cx + 2, cy - 5, c(palette, "outline"));
    }
  }
  addFootAnchor(canvas);
}

function drawHearth(canvas: PixelCanvas, palette: PixelSpritePalette) {
  const cx = Math.floor(canvas.width / 2);
  const cy = Math.floor(canvas.height / 2) + 5;
  for (let i = 0; i < 9; i += 1) {
    const angle = (Math.PI * 2 * i) / 9;
    drawEllipse(canvas, cx + Math.round(Math.cos(angle) * 19), cy + Math.round(Math.sin(angle) * 12), 8, 6, c(palette, "outline"));
    drawEllipse(canvas, cx + Math.round(Math.cos(angle) * 19), cy + Math.round(Math.sin(angle) * 12), 6, 4, i % 2 ? c(palette, "stone") : c(palette, "stoneLight"));
  }
  drawRect(canvas, cx - 4, cy - 13, 8, 22, c(palette, "ember"));
  drawRect(canvas, cx - 8, cy - 8, 16, 13, c(palette, "flame"));
  drawRect(canvas, cx - 2, cy - 18, 4, 15, c(palette, "flame"));
  drawRect(canvas, cx - 13, cy + 3, 26, 5, c(palette, "woodDark"));
  addFootAnchor(canvas);
}

function drawDeer(canvas: PixelCanvas, palette: PixelSpritePalette, direction: "up" | "down" | "left" | "right") {
  const cx = Math.floor(canvas.width / 2);
  const cy = Math.floor(canvas.height / 2) + 4;
  const side = direction === "left" || direction === "right";
  const flip = direction === "left" ? -1 : 1;
  if (side) {
    drawEllipse(canvas, cx - flip * 3, cy + 2, 24, 12, c(palette, "outline"));
    drawEllipse(canvas, cx - flip * 3, cy + 2, 21, 9, c(palette, "fur"));
    drawEllipse(canvas, cx + flip * 22, cy - 4, 9, 7, c(palette, "outline"));
    drawEllipse(canvas, cx + flip * 21, cy - 4, 7, 5, c(palette, "furLight"));
    drawRect(canvas, cx - flip * 18, cy + 11, 3, 17, c(palette, "outline"));
    drawRect(canvas, cx - flip * 4, cy + 11, 3, 17, c(palette, "outline"));
    drawRect(canvas, cx + flip * 9, cy + 10, 3, 18, c(palette, "outline"));
    drawRect(canvas, cx + flip * 20, cy + 5, 3, 17, c(palette, "outline"));
    drawRasterLine(canvas, cx + flip * 24, cy - 9, cx + flip * 30, cy - 18, c(palette, "outline"));
    drawRasterLine(canvas, cx + flip * 24, cy - 9, cx + flip * 18, cy - 18, c(palette, "outline"));
    drawRasterLine(canvas, cx + flip * 29, cy - 17, cx + flip * 33, cy - 20, c(palette, "furLight"));
    setPixel(canvas, cx + flip * 24, cy - 5, c(palette, "outline"));
  } else {
    drawEllipse(canvas, cx, cy + 4, 14, 19, c(palette, "outline"));
    drawEllipse(canvas, cx, cy + 4, 11, 16, c(palette, "fur"));
    drawEllipse(canvas, cx, cy - 15, 10, 9, c(palette, "outline"));
    drawEllipse(canvas, cx, cy - 15, 7, 6, c(palette, "furLight"));
    drawRect(canvas, cx - 10, cy + 14, 3, 18, c(palette, "outline"));
    drawRect(canvas, cx + 7, cy + 14, 3, 18, c(palette, "outline"));
    drawRasterLine(canvas, cx - 3, cy - 21, cx - 13, cy - 31, c(palette, "outline"));
    drawRasterLine(canvas, cx + 3, cy - 21, cx + 13, cy - 31, c(palette, "outline"));
    drawRasterLine(canvas, cx - 11, cy - 30, cx - 17, cy - 32, c(palette, "furLight"));
    drawRasterLine(canvas, cx + 11, cy - 30, cx + 17, cy - 32, c(palette, "furLight"));
    if (direction === "down") {
      setPixel(canvas, cx - 3, cy - 14, c(palette, "outline"));
      setPixel(canvas, cx + 3, cy - 14, c(palette, "outline"));
    }
  }
  addFootAnchor(canvas);
}

function drawWoodpile(canvas: PixelCanvas, palette: PixelSpritePalette) {
  const cx = Math.floor(canvas.width / 2);
  const cy = Math.floor(canvas.height / 2) + 7;
  for (let row = 0; row < 3; row += 1) {
    const y = cy + row * 8 - 14;
    const count = row === 1 ? 4 : 3;
    const start = cx - count * 9;
    for (let i = 0; i < count; i += 1) {
      drawRect(canvas, start + i * 18, y, 17, 7, c(palette, "outline"));
      drawRect(canvas, start + i * 18 + 1, y + 1, 15, 5, i % 2 ? c(palette, "wood") : c(palette, "woodLight"));
      setPixel(canvas, start + i * 18 + 3, y + 3, c(palette, "woodDark"));
    }
  }
  addFootAnchor(canvas);
}

function drawCache(canvas: PixelCanvas, palette: PixelSpritePalette) {
  const cx = Math.floor(canvas.width / 2);
  const cy = Math.floor(canvas.height / 2) + 7;
  drawRect(canvas, cx - 28, cy - 18, 56, 33, c(palette, "outline"));
  drawRect(canvas, cx - 25, cy - 15, 50, 27, c(palette, "woodDark"));
  drawRect(canvas, cx - 20, cy - 25, 40, 12, c(palette, "outline"));
  drawRect(canvas, cx - 18, cy - 23, 36, 8, c(palette, "canvas"));
  drawRect(canvas, cx - 24, cy - 5, 48, 3, c(palette, "woodLight"));
  drawRect(canvas, cx - 4, cy - 15, 8, 27, c(palette, "leather"));
  drawRect(canvas, cx + 18, cy - 27, 12, 27, c(palette, "outline"));
  drawRect(canvas, cx + 20, cy - 25, 8, 23, c(palette, "stone"));
  addFootAnchor(canvas);
}

function drawRabbitTracks(canvas: PixelCanvas, palette: PixelSpritePalette) {
  const cx = Math.floor(canvas.width / 2);
  for (let step = 0; step < 3; step += 1) {
    const y = 6 + step * 10;
    drawEllipse(canvas, cx - 5, y + 4, 2, 3, c(palette, "track"));
    drawEllipse(canvas, cx + 5, y + 2, 2, 3, c(palette, "track"));
    drawEllipse(canvas, cx - 1, y + 7, 3, 2, c(palette, "track"));
  }
}

function drawDeerTracks(canvas: PixelCanvas, palette: PixelSpritePalette) {
  const cx = Math.floor(canvas.width / 2);
  for (let step = 0; step < 3; step += 1) {
    const y = 5 + step * 10;
    drawPolygon(canvas, [[cx - 7, y], [cx - 2, y + 7], [cx - 5, y + 9]], c(palette, "track"));
    drawPolygon(canvas, [[cx + 7, y + 2], [cx + 2, y + 9], [cx + 5, y + 11]], c(palette, "track"));
  }
}

function drawBloodTracks(canvas: PixelCanvas, palette: PixelSpritePalette) {
  drawEllipse(canvas, 14, 10, 5, 4, c(palette, "blood"));
  drawEllipse(canvas, 24, 16, 4, 6, c(palette, "blood"));
  drawEllipse(canvas, 18, 25, 7, 4, c(palette, "blood"));
  setPixel(canvas, 31, 26, c(palette, "blood"));
  setPixel(canvas, 9, 21, c(palette, "blood"));
}

function addFootAnchor(canvas: PixelCanvas) {
  drawRect(canvas, Math.floor(canvas.width / 2) - 3, canvas.height - 4, 6, 1, [0, 0, 0, 42]);
}

function drawSnowTile(canvas: PixelCanvas, palette: PixelSpritePalette) {
  fillPixelCanvas(canvas, c(palette, "snow"));
  drawDeterministicSpeckles(canvas, c(palette, "snowShade"), 18, 7);
  drawLine(canvas, 6, 44, 25, 41, c(palette, "snowShade"));
  drawLine(canvas, 38, 18, 58, 20, c(palette, "snowShade"));
}

function drawPackedSnowTile(canvas: PixelCanvas, palette: PixelSpritePalette) {
  fillPixelCanvas(canvas, c(palette, "snow"));
  drawEllipse(canvas, 20, 42, 14, 5, c(palette, "snowShade"));
  drawEllipse(canvas, 45, 28, 13, 5, c(palette, "snowShade"));
  drawEllipse(canvas, 34, 50, 9, 4, c(palette, "snowShade"));
  drawDeterministicSpeckles(canvas, c(palette, "dirtLight"), 9, 11);
}

function drawDirtPathTile(canvas: PixelCanvas, palette: PixelSpritePalette) {
  fillPixelCanvas(canvas, c(palette, "snow"));
  for (let y = 0; y < canvas.height; y += 1) {
    const center = 32 + Math.sin(y / 10) * 8;
    for (let x = 0; x < canvas.width; x += 1) {
      if (Math.abs(x - center) < 14 + Math.sin(y / 6) * 2) setPixel(canvas, x, y, y % 5 === 0 ? c(palette, "dirtLight") : c(palette, "dirt"));
    }
  }
  drawDeterministicSpeckles(canvas, c(palette, "snowShade"), 8, 13);
}

function drawCabinClearingTile(canvas: PixelCanvas, palette: PixelSpritePalette) {
  fillPixelCanvas(canvas, [190, 198, 174, 255]);
  drawDeterministicSpeckles(canvas, c(palette, "snow"), 22, 5);
  drawDeterministicSpeckles(canvas, c(palette, "dirtLight"), 12, 9);
  drawLine(canvas, 0, 52, 64, 48, [120, 104, 72, 255]);
}

function drawCreekEdgeTile(canvas: PixelCanvas, palette: PixelSpritePalette) {
  fillPixelCanvas(canvas, c(palette, "snow"));
  drawRect(canvas, 0, 0, 64, 24, c(palette, "ice"));
  drawRect(canvas, 0, 20, 64, 6, [93, 139, 155, 255]);
  drawDeterministicSpeckles(canvas, c(palette, "snowShade"), 15, 6);
  drawLine(canvas, 4, 28, 60, 34, c(palette, "reed"));
}

function drawWinterGrass(canvas: PixelCanvas, palette: PixelSpritePalette) {
  for (let i = 0; i < 9; i += 1) {
    const x = 8 + i * 4;
    drawLine(canvas, x, 34, x - 3 + (i % 3), 12 + (i % 4) * 3, c(palette, "grassDry"));
  }
  drawEllipse(canvas, 22, 36, 18, 5, c(palette, "snowShade"));
}

function drawDeadStalks(canvas: PixelCanvas, palette: PixelSpritePalette) {
  for (let i = 0; i < 6; i += 1) {
    const x = 10 + i * 5;
    drawLine(canvas, x, 36, x + (i % 2 ? 3 : -3), 8 + i, c(palette, "reed"));
    setPixel(canvas, x + (i % 2 ? 4 : -4), 9 + i, c(palette, "grassDry"));
  }
}

function drawReeds(canvas: PixelCanvas, palette: PixelSpritePalette) {
  for (let i = 0; i < 8; i += 1) {
    const x = 7 + i * 4;
    drawLine(canvas, x, 38, x + (i % 3) - 1, 8, c(palette, "reed"));
    drawRect(canvas, x - 1, 8 + (i % 4), 3, 7, c(palette, "barkLight"));
  }
}

function drawBareBush(canvas: PixelCanvas, palette: PixelSpritePalette) {
  drawEllipse(canvas, 27, 34, 22, 8, c(palette, "snowShade"));
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    drawLine(canvas, 27, 32, 27 + Math.round(Math.cos(angle) * 20), 31 + Math.round(Math.sin(angle) * 13), c(palette, "bark"));
  }
}

function drawBerryBush(canvas: PixelCanvas, palette: PixelSpritePalette) {
  drawBareBush(canvas, palette);
  for (const point of [[18, 25], [35, 23], [29, 31], [42, 33]]) drawRect(canvas, point[0] ?? 0, point[1] ?? 0, 3, 3, c(palette, "berry"));
}

function drawScrubBush(canvas: PixelCanvas, palette: PixelSpritePalette) {
  drawEllipse(canvas, 27, 34, 24, 10, c(palette, "outline"));
  drawEllipse(canvas, 27, 31, 22, 12, c(palette, "grass"));
  drawEllipse(canvas, 18, 30, 10, 8, c(palette, "pineDark"));
  drawEllipse(canvas, 39, 31, 11, 8, c(palette, "pineDark"));
}

function drawPineTree(canvas: PixelCanvas, palette: PixelSpritePalette) {
  drawRect(canvas, 36, 58, 8, 28, c(palette, "bark"));
  drawTriangle(canvas, 40, 6, 12, 62, 68, 62, c(palette, "outline"));
  drawTriangle(canvas, 40, 10, 16, 60, 64, 60, c(palette, "pineDark"));
  drawTriangle(canvas, 40, 20, 18, 72, 62, 72, c(palette, "pine"));
  drawRect(canvas, 34, 84, 12, 8, c(palette, "snowShade"));
}

function drawBareTree(canvas: PixelCanvas, palette: PixelSpritePalette) {
  drawRect(canvas, 35, 34, 9, 54, c(palette, "outline"));
  drawRect(canvas, 37, 35, 5, 52, c(palette, "bark"));
  drawLine(canvas, 39, 48, 19, 21, c(palette, "outline"));
  drawLine(canvas, 40, 48, 59, 20, c(palette, "outline"));
  drawLine(canvas, 39, 36, 29, 12, c(palette, "bark"));
  drawLine(canvas, 41, 39, 50, 10, c(palette, "bark"));
  drawLine(canvas, 23, 25, 15, 17, c(palette, "barkLight"));
  drawLine(canvas, 56, 24, 64, 16, c(palette, "barkLight"));
  drawEllipse(canvas, 39, 88, 17, 6, c(palette, "snowShade"));
}

function drawStump(canvas: PixelCanvas, palette: PixelSpritePalette) {
  drawEllipse(canvas, 26, 28, 18, 10, c(palette, "outline"));
  drawRect(canvas, 12, 24, 28, 13, c(palette, "bark"));
  drawEllipse(canvas, 26, 24, 15, 8, c(palette, "barkLight"));
  drawEllipse(canvas, 26, 24, 8, 4, c(palette, "dirt"));
  drawEllipse(canvas, 26, 37, 19, 5, c(palette, "snowShade"));
}

function drawStones(canvas: PixelCanvas, palette: PixelSpritePalette) {
  drawEllipse(canvas, 18, 30, 11, 8, c(palette, "outline"));
  drawEllipse(canvas, 18, 29, 9, 6, c(palette, "stone"));
  drawEllipse(canvas, 32, 28, 13, 10, c(palette, "outline"));
  drawEllipse(canvas, 32, 27, 10, 7, c(palette, "stoneLight"));
  drawEllipse(canvas, 40, 35, 8, 6, c(palette, "stone"));
}

function drawSnowMound(canvas: PixelCanvas, palette: PixelSpritePalette) {
  drawEllipse(canvas, 26, 30, 24, 10, c(palette, "snowShade"));
  drawEllipse(canvas, 25, 26, 21, 9, c(palette, "snow"));
  drawLine(canvas, 12, 31, 39, 34, c(palette, "snowShade"));
}
