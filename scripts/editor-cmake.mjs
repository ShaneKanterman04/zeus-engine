import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const action = process.argv[2] ?? "build";
const root = resolve(import.meta.dirname, "..");
const sourceDir = join(root, "apps", "zeus-editor");
const buildDir = join(root, "build", "zeus-editor");
const installDir = join(root, "dist", "zeus-editor");
const restartExec = valueFor("--restart-exec");
const restartArgs = valueFor("--restart-args-json");

switch (action) {
  case "configure":
    await mkdir(buildDir, { recursive: true });
    await run("cmake", ["-S", sourceDir, "-B", buildDir, "-G", "Ninja", ...qt6DirArgs()]);
    break;
  case "build":
    await ensureConfigured();
    await run("cmake", ["--build", buildDir]);
    break;
  case "run":
    await ensureConfigured();
    await run("cmake", ["--build", buildDir]);
    await run(join(buildDir, "zeus-editor"), process.argv.slice(3), { stdio: "inherit" });
    break;
  case "package":
    await ensureConfigured();
    await run("cmake", ["--build", buildDir]);
    await run("cmake", ["--install", buildDir, "--prefix", installDir]);
    break;
  case "update":
    await run("git", ["pull", "--ff-only"]);
    await run("npm", ["install"]);
    await ensureConfigured();
    await run("cmake", ["--build", buildDir]);
    if (restartExec) {
      const parsedArgs = restartArgs ? JSON.parse(restartArgs) : [];
      await runDetached(restartExec, Array.isArray(parsedArgs) ? parsedArgs : []);
    }
    break;
  default:
    throw new Error(`Unknown editor action: ${action}`);
}

async function ensureConfigured() {
  await mkdir(buildDir, { recursive: true });
  await resetStaleQtCache();
  await run("cmake", ["-S", sourceDir, "-B", buildDir, "-G", "Ninja", ...qt6DirArgs()]);
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: options.stdio ?? "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
      }
    });
  });
}

function runDetached(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      detached: true,
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.unref();
    resolveRun();
  });
}

function valueFor(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function qt6DirArgs() {
  const configuredDir = process.env.ZEUS_QT6_DIR?.trim();
  if (configuredDir) {
    return [`-DQt6_DIR=${configuredDir}`];
  }

  const systemQtDir = "/usr/lib/x86_64-linux-gnu/cmake/Qt6";
  if (existsSync(join(systemQtDir, "Qt6Config.cmake"))) {
    return [`-DQt6_DIR=${systemQtDir}`];
  }

  return [];
}

async function resetStaleQtCache() {
  const cachePath = join(buildDir, "CMakeCache.txt");
  let cacheText = "";
  try {
    cacheText = await readFile(cachePath, "utf8");
  } catch {
    return;
  }

  const selectedDir = process.env.ZEUS_QT6_DIR?.trim() || "/usr/lib/x86_64-linux-gnu/cmake/Qt6";
  const qtDirLines = cacheText
    .split("\n")
    .filter((line) => /^Qt6[A-Za-z0-9_]*_DIR:PATH=/.test(line));

  const cacheUsesSelectedQt = qtDirLines.every((line) => line.slice(line.indexOf("=") + 1).startsWith(selectedDir));
  if (cacheUsesSelectedQt) return;

  await rm(cachePath, { force: true });
  await rm(join(buildDir, "CMakeFiles"), { recursive: true, force: true });
}
