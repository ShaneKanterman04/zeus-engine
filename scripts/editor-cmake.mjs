import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const action = process.argv[2] ?? "build";
const root = resolve(import.meta.dirname, "..");
const sourceDir = join(root, "apps", "zeus-editor");
const buildDir = join(root, "build", "zeus-editor");
const installDir = join(root, "dist", "zeus-editor");

switch (action) {
  case "configure":
    await mkdir(buildDir, { recursive: true });
    await run("cmake", ["-S", sourceDir, "-B", buildDir, "-G", "Ninja"]);
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
  default:
    throw new Error(`Unknown editor action: ${action}`);
}

async function ensureConfigured() {
  await mkdir(buildDir, { recursive: true });
  await run("cmake", ["-S", sourceDir, "-B", buildDir, "-G", "Ninja"]);
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
