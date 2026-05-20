#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { runZeusDev } from "./zeus-dev.js";

type CliIO = {
  cwd?: string;
  stdout?: Pick<Console, "log">;
  stderr?: Pick<Console, "error">;
};

export async function runZeusCli(args = process.argv.slice(2), io: CliIO = {}) {
  const stdout = io.stdout ?? console;
  const stderr = io.stderr ?? console;
  try {
    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
      stdout.log(helpText());
      return 0;
    }
    const [command, ...commandArgs] = args;
    if (command === "dev") {
      const script = readOption(commandArgs, "--script") ?? readOption(commandArgs, "-s");
      const dryRun = commandArgs.includes("--dry-run");
      return await runZeusDev({ cwd: io.cwd, script, dryRun, stdout });
    }
    throw new Error(`Unknown zeus command: ${command ?? ""}`);
  } catch (error) {
    stderr.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function readOption(args: string[], name: string) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

function helpText() {
  return [
    "zeus",
    "",
    "Commands:",
    "  dev [--script <npm-script>] [--dry-run]  Kill this project's prior dev server and run its Zeus dev script",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exitCode = await runZeusCli();
}
