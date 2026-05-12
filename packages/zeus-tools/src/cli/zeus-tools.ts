#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { realpathSync } from "node:fs";
import { generatePixelSprites, type PixelSpriteGeneratorConfig } from "../sprites/PixelSpriteGenerator.js";

type CliIO = {
  cwd?: string;
  stdout?: Pick<Console, "log">;
  stderr?: Pick<Console, "error">;
};

export async function runZeusToolsCli(args = process.argv.slice(2), io: CliIO = {}) {
  const stdout = io.stdout ?? console;
  const stderr = io.stderr ?? console;
  const cwd = io.cwd ?? process.cwd();
  try {
    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
      stdout.log(helpText());
      return 0;
    }
    const [command, ...commandArgs] = args;
    if (command === "generate-pixels") {
      const configPath = readOption(commandArgs, "--config") ?? readOption(commandArgs, "-c");
      if (!configPath) throw new Error("generate-pixels requires --config <path>");
      const config = await loadGeneratorConfig(resolve(cwd, configPath));
      const results = await generatePixelSprites(config);
      stdout.log(`generated-pixel-sprites ${results.length}`);
      return 0;
    }
    throw new Error(`Unknown zeus-tools command: ${command ?? ""}`);
  } catch (error) {
    stderr.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function loadGeneratorConfig(configPath: string): Promise<PixelSpriteGeneratorConfig> {
  const module = await import(pathToFileURL(configPath).href) as {
    default?: unknown;
    pixelSpriteGeneratorConfig?: unknown;
    config?: unknown;
  };
  const config = module.default ?? module.pixelSpriteGeneratorConfig ?? module.config;
  if (!config || typeof config !== "object") throw new Error(`Pixel generator config '${configPath}' did not export a config object`);
  return config as PixelSpriteGeneratorConfig;
}

function readOption(args: string[], name: string) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

function helpText() {
  return [
    "zeus-tools",
    "",
    "Commands:",
    "  generate-pixels --config <path>  Generate deterministic loose pixel PNGs from an ESM config",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exitCode = await runZeusToolsCli();
}
