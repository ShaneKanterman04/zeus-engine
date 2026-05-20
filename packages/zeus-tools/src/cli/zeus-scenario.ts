import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { loadZeusScenarioRegistry } from "../scenarios/ScenarioRegistry.js";

export type ZeusScenarioCliOptions = {
  cwd?: string;
  stdout?: Pick<Console, "log">;
};

type PackageJson = {
  name?: unknown;
  zeus?: unknown;
};

export async function runZeusScenarioCli(args: string[], options: ZeusScenarioCliOptions = {}) {
  const stdout = options.stdout ?? console;
  const cwd = resolve(options.cwd ?? process.cwd());
  const [command, ...commandArgs] = args;
  if (!command || command === "--help" || command === "-h") {
    stdout.log(helpText());
    return 0;
  }
  const directory = await resolveScenarioDirectory(cwd, readOption(commandArgs, "--dir") ?? readOption(commandArgs, "-d"));
  const registry = await loadZeusScenarioRegistry({ directory });
  if (command === "validate") {
    for (const warning of registry.validation.warnings) stdout.log(`warning ${warning}`);
    if (!registry.validation.ok) {
      for (const error of registry.validation.errors) stdout.log(`error ${error}`);
      return 1;
    }
    stdout.log(`zeus scenario validate: ${registry.scenarios.length} scenario(s) ok`);
    return 0;
  }
  if (command === "list") {
    const tag = readOption(commandArgs, "--tag");
    const scenarios = registry.list({ tag });
    for (const scenario of scenarios) stdout.log(`${scenario.id}\t${scenario.title}\t${scenario.tags?.join(",") ?? ""}`);
    stdout.log(`zeus scenario list: ${scenarios.length} scenario(s)`);
    return registry.validation.ok ? 0 : 1;
  }
  if (command === "show") {
    const id = commandArgs.find((arg) => !arg.startsWith("-"));
    if (!id) throw new Error("zeus scenario show requires <id>");
    const scenario = registry.require(id);
    if (commandArgs.includes("--json")) stdout.log(JSON.stringify(scenario, null, 2));
    else stdout.log([scenario.id, scenario.title, scenario.description ?? "", `tags: ${scenario.tags?.join(", ") ?? ""}`].filter(Boolean).join("\n"));
    return registry.validation.ok ? 0 : 1;
  }
  throw new Error(`Unknown zeus scenario command: ${command}`);
}

export async function resolveScenarioDirectory(cwd: string, requestedDirectory?: string) {
  if (requestedDirectory) return resolve(cwd, requestedDirectory);
  const packageDir = findPackageRoot(cwd);
  if (!packageDir) throw new Error(`No package.json found from ${cwd}; pass --dir <scenarios-dir>`);
  const packageJson = await readPackageJson(join(packageDir, "package.json"));
  const configured = configuredScenarioDir(packageJson);
  if (configured) return resolve(packageDir, configured);

  const packageName = typeof packageJson.name === "string" ? packageJson.name.split("/").at(-1) ?? packageJson.name : basename(packageDir);
  const candidates = [
    join(packageDir, "content", "scenarios"),
    join(packageDir, "games", packageName, "content", "scenarios"),
    ...(await gameScenarioDirectories(join(packageDir, "games"))),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`No scenario directory found for ${packageDir}; pass --dir <scenarios-dir> or set zeus.scenarioDir`);
  return found;
}

function findPackageRoot(start: string) {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, "package.json"))) return current;
    const parent = resolve(current, "..");
    if (parent === current) return undefined;
    current = parent;
  }
}

async function readPackageJson(path: string): Promise<PackageJson> {
  return JSON.parse(await readFile(path, "utf8")) as PackageJson;
}

function configuredScenarioDir(packageJson: PackageJson) {
  if (!packageJson.zeus || typeof packageJson.zeus !== "object") return undefined;
  const value = (packageJson.zeus as { scenarioDir?: unknown }).scenarioDir;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function gameScenarioDirectories(gamesDir: string) {
  if (!existsSync(gamesDir)) return [];
  const entries = await readdir(gamesDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => join(gamesDir, entry.name, "content", "scenarios"));
}

function readOption(args: string[], name: string) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

function helpText() {
  return [
    "zeus scenario",
    "",
    "Commands:",
    "  scenario list [--dir <path>] [--tag <tag>]",
    "  scenario validate [--dir <path>]",
    "  scenario show <id> [--dir <path>] [--json]",
  ].join("\n");
}
