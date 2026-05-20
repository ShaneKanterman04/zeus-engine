import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { execFile, spawn, type ChildProcess } from "node:child_process";

export type ZeusDevOptions = {
  cwd?: string;
  script?: string;
  dryRun?: boolean;
  killTimeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<Console, "log">;
};

export type ZeusProjectInfo = {
  projectDir: string;
  packageName: string;
  devScript: string;
  devPorts: number[];
  command: string;
  args: string[];
};

type PackageJson = {
  name?: unknown;
  scripts?: unknown;
  zeus?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
  peerDependencies?: unknown;
  optionalDependencies?: unknown;
};

type DevServerRecord = {
  pid: number;
  projectDir: string;
  packageName: string;
  devScript: string;
  command: string;
  args: string[];
  startedAt: string;
};

export async function runZeusDev(options: ZeusDevOptions = {}) {
  const stdout = options.stdout ?? console;
  const project = await resolveZeusProject(options.cwd ?? process.cwd(), options.script);
  const recordPath = devRecordPath(project.projectDir, options.env);
  const previous = await readDevServerRecord(recordPath);
  const killed = await stopPreviousDevServer(previous, recordPath, options.killTimeoutMs);
  if (previous && killed) stdout.log(`zeus dev: stopped previous ${previous.packageName} dev server pid ${previous.pid}`);
  if (previous && !killed) stdout.log(`zeus dev: cleared stale ${previous.packageName} dev server record`);
  if (options.dryRun) {
    stdout.log(`zeus dev: would run '${project.command} ${project.args.join(" ")}' in ${project.projectDir}`);
    return 0;
  }
  for (const stopped of await stopDevPortListeners(project.devPorts, options.killTimeoutMs)) {
    stdout.log(`zeus dev: stopped process ${stopped.pid} listening on port ${stopped.port}`);
  }

  const child = spawn(project.command, project.args, {
    cwd: project.projectDir,
    env: options.env ?? process.env,
    stdio: "inherit",
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  });
  await writeDevServerRecord(recordPath, {
    pid: child.pid ?? 0,
    projectDir: project.projectDir,
    packageName: project.packageName,
    devScript: project.devScript,
    command: project.command,
    args: project.args,
    startedAt: new Date().toISOString(),
  });
  stdout.log(`zeus dev: started ${project.packageName} with npm run ${project.devScript}`);
  return waitForDevServer(child, recordPath);
}

export async function resolveZeusProject(cwd: string, requestedScript?: string): Promise<ZeusProjectInfo> {
  const projectDir = findPackageRoot(resolve(cwd));
  if (!projectDir) throw new Error(`No package.json found from ${cwd}`);
  const packageJson = await readPackageJson(join(projectDir, "package.json"));
  if (!usesZeus(packageJson)) throw new Error(`${projectDir} does not look like a Zeus project; add an @zeus/* dependency first`);
  const scripts = packageJson.scripts && typeof packageJson.scripts === "object" ? packageJson.scripts as Record<string, unknown> : {};
  const configuredScript = configuredZeusDevScript(packageJson);
  const devScript = requestedScript ?? configuredScript ?? firstExistingScript(scripts, ["dev", "dev:lan", "dev:local"]);
  if (!devScript || typeof scripts[devScript] !== "string") {
    throw new Error(`No Zeus dev script found in ${join(projectDir, "package.json")}; add scripts.dev or zeus.devScript`);
  }
  return {
    projectDir,
    packageName: typeof packageJson.name === "string" ? packageJson.name : basename(projectDir),
    devScript,
    devPorts: configuredZeusDevPorts(packageJson),
    command: npmCommand(),
    args: ["run", devScript],
  };
}

export function devRecordPath(projectDir: string, env: NodeJS.ProcessEnv = process.env) {
  const stateDir = env.ZEUS_STATE_DIR ?? join(homedir(), ".zeus", "dev-servers");
  const key = createHash("sha1").update(resolve(projectDir)).digest("hex").slice(0, 16);
  return join(stateDir, `${key}.json`);
}

async function stopPreviousDevServer(record: DevServerRecord | undefined, recordPath: string, killTimeoutMs = 4000) {
  if (!record) return false;
  if (!isProcessAlive(record.pid)) {
    await rm(recordPath, { force: true });
    return false;
  }
  killDevProcess(record.pid, "SIGTERM");
  const exited = await waitForExit(record.pid, killTimeoutMs);
  if (!exited && isProcessAlive(record.pid)) killDevProcess(record.pid, "SIGKILL");
  await rm(recordPath, { force: true });
  return true;
}

function findPackageRoot(start: string) {
  let current = start;
  while (true) {
    if (existsSync(join(current, "package.json"))) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

async function readPackageJson(path: string): Promise<PackageJson> {
  return JSON.parse(await readFile(path, "utf8")) as PackageJson;
}

function usesZeus(packageJson: PackageJson) {
  return [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies,
  ].some((section) => Boolean(section && typeof section === "object" && Object.keys(section).some((name) => name.startsWith("@zeus/"))));
}

function configuredZeusDevScript(packageJson: PackageJson) {
  if (!packageJson.zeus || typeof packageJson.zeus !== "object") return undefined;
  const value = (packageJson.zeus as { devScript?: unknown }).devScript;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function configuredZeusDevPorts(packageJson: PackageJson) {
  if (!packageJson.zeus || typeof packageJson.zeus !== "object") return [];
  const value = (packageJson.zeus as { devPorts?: unknown }).devPorts;
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((port): port is number => Number.isInteger(port) && port > 0 && port <= 65535))];
}

function firstExistingScript(scripts: Record<string, unknown>, names: string[]) {
  return names.find((name) => typeof scripts[name] === "string");
}

async function stopDevPortListeners(ports: number[], killTimeoutMs = 4000) {
  const stopped: { port: number; pid: number }[] = [];
  for (const port of ports) {
    for (const pid of await listenerPidsForPort(port)) {
      if (pid === process.pid || stopped.some((record) => record.pid === pid)) continue;
      if (!isProcessAlive(pid)) continue;
      killDevProcess(pid, "SIGTERM");
      const exited = await waitForExit(pid, killTimeoutMs);
      if (!exited && isProcessAlive(pid)) killDevProcess(pid, "SIGKILL");
      stopped.push({ port, pid });
    }
  }
  return stopped;
}

function listenerPidsForPort(port: number) {
  return new Promise<number[]>((resolvePids) => {
    execFile("ss", ["-ltnp", `sport = :${port}`], (error, stdout) => {
      if (error) {
        resolvePids([]);
        return;
      }
      const pids = new Set<number>();
      for (const match of stdout.matchAll(/pid=(\d+)/g)) pids.add(Number(match[1]));
      resolvePids([...pids]);
    });
  });
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function readDevServerRecord(path: string) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<DevServerRecord>;
    if (
      typeof parsed.pid === "number" &&
      typeof parsed.projectDir === "string" &&
      typeof parsed.packageName === "string" &&
      typeof parsed.devScript === "string" &&
      typeof parsed.command === "string" &&
      Array.isArray(parsed.args)
    ) {
      return parsed as DevServerRecord;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function writeDevServerRecord(path: string, record: DevServerRecord) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
}

function isProcessAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killDevProcess(pid: number, signal: NodeJS.Signals) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  if (process.platform !== "win32") {
    try {
      process.kill(-pid, signal);
      return;
    } catch {
      // Fall back to the direct process for records from older CLI versions.
    }
  }
  process.kill(pid, signal);
}

async function waitForExit(pid: number, timeoutMs: number) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!isProcessAlive(pid)) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  return !isProcessAlive(pid);
}

function waitForDevServer(child: ChildProcess, recordPath: string) {
  return new Promise<number>((resolveWait) => {
    const forwardSignal = async (signal: NodeJS.Signals) => {
      if (child.pid) killDevProcess(child.pid, signal);
      await rm(recordPath, { force: true });
      resolveWait(1);
    };
    process.once("SIGINT", forwardSignal);
    process.once("SIGTERM", forwardSignal);
    const cleanupSignalHandlers = () => {
      process.off("SIGINT", forwardSignal);
      process.off("SIGTERM", forwardSignal);
    };
    child.on("error", async (error) => {
      cleanupSignalHandlers();
      await rm(recordPath, { force: true });
      console.error(error.message);
      resolveWait(1);
    });
    child.on("exit", async (code, signal) => {
      cleanupSignalHandlers();
      await rm(recordPath, { force: true });
      if (signal) resolveWait(1);
      else resolveWait(code ?? 0);
    });
  });
}
