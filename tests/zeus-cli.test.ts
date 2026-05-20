import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { devRecordPath, resolveZeusProject, runZeusDev } from "../packages/zeus-tools/src/cli/zeus-dev";
import { runZeusCli } from "../packages/zeus-tools/src/cli/zeus";

async function makeProject(packageJson: object) {
  const dir = await mkdtemp(join(tmpdir(), "zeus-cli-test-"));
  await writeFile(join(dir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
  return dir;
}

async function cleanup(dir: string) {
  await rm(dir, { recursive: true, force: true });
}

describe("zeus cli", () => {
  it("resolves a Zeus project and defaults to the dev script", async () => {
    const projectDir = await makeProject({
      name: "sample-zeus-game",
      scripts: { dev: "vite --host 0.0.0.0", "dev:lan": "node scripts/lan-server.mjs" },
      dependencies: { "@zeus/core": "file:../zeus-engine/packages/zeus-core" },
    });
    try {
      const nested = join(projectDir, "src", "game");
      await mkdir(nested, { recursive: true });

      await expect(resolveZeusProject(nested)).resolves.toMatchObject({
        projectDir,
        packageName: "sample-zeus-game",
        devScript: "dev",
        devPorts: [],
        command: process.platform === "win32" ? "npm.cmd" : "npm",
        args: ["run", "dev"],
      });
    } finally {
      await cleanup(projectDir);
    }
  });

  it("honors zeus.devScript and explicit script overrides", async () => {
    const projectDir = await makeProject({
      name: "lan-zeus-game",
      zeus: { devScript: "dev:lan", devPorts: [5173, 8787, 8787, -1, "bad"] },
      scripts: { dev: "vite", "dev:lan": "node scripts/lan-server.mjs" },
      devDependencies: { "@zeus/tools": "file:../zeus-engine/packages/zeus-tools" },
    });
    try {
      await expect(resolveZeusProject(projectDir)).resolves.toMatchObject({ devScript: "dev:lan", devPorts: [5173, 8787], args: ["run", "dev:lan"] });
      await expect(resolveZeusProject(projectDir, "dev")).resolves.toMatchObject({ devScript: "dev", devPorts: [5173, 8787], args: ["run", "dev"] });
    } finally {
      await cleanup(projectDir);
    }
  });

  it("rejects non-Zeus projects before starting a dev server", async () => {
    const projectDir = await makeProject({
      name: "plain-vite-game",
      scripts: { dev: "vite" },
      dependencies: { vite: "^5.0.0" },
    });
    try {
      await expect(resolveZeusProject(projectDir)).rejects.toThrow("does not look like a Zeus project");
    } finally {
      await cleanup(projectDir);
    }
  });

  it("clears stale dev server records in dry-run mode", async () => {
    const projectDir = await makeProject({
      name: "stale-zeus-game",
      scripts: { dev: "vite" },
      dependencies: { "@zeus/core": "file:../zeus-engine/packages/zeus-core" },
    });
    const stateDir = await mkdtemp(join(tmpdir(), "zeus-cli-state-"));
    const env = { ...process.env, ZEUS_STATE_DIR: stateDir };
    try {
      const recordPath = devRecordPath(projectDir, env);
      await mkdir(join(stateDir), { recursive: true });
      await writeFile(
        recordPath,
        `${JSON.stringify({
          pid: 99999999,
          projectDir,
          packageName: "stale-zeus-game",
          devScript: "dev",
          command: "npm",
          args: ["run", "dev"],
          startedAt: new Date().toISOString(),
        })}\n`,
      );

      const lines: string[] = [];
      const code = await runZeusDev({ cwd: projectDir, dryRun: true, env, stdout: { log: (line) => lines.push(line) } });
      expect(code).toBe(0);
      expect(lines.some((line) => line.includes("cleared stale stale-zeus-game dev server record"))).toBe(true);
      await expect(readFile(recordPath, "utf8")).rejects.toThrow();
    } finally {
      await cleanup(projectDir);
      await cleanup(stateDir);
    }
  });

  it("kills the previous tracked dev server before starting a new one", async () => {
    const projectDir = await makeProject({
      name: "restart-zeus-game",
      scripts: { dev: "vite" },
      dependencies: { "@zeus/core": "file:../zeus-engine/packages/zeus-core" },
    });
    const stateDir = await mkdtemp(join(tmpdir(), "zeus-cli-state-"));
    const env = { ...process.env, ZEUS_STATE_DIR: stateDir };
    const previous = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    try {
      if (!previous.pid) throw new Error("test process did not start");
      const recordPath = devRecordPath(projectDir, env);
      await mkdir(join(stateDir), { recursive: true });
      await writeFile(
        recordPath,
        `${JSON.stringify({
          pid: previous.pid,
          projectDir,
          packageName: "restart-zeus-game",
          devScript: "dev",
          command: "npm",
          args: ["run", "dev"],
          startedAt: new Date().toISOString(),
        })}\n`,
      );

      const lines: string[] = [];
      const code = await runZeusDev({
        cwd: projectDir,
        dryRun: true,
        env,
        killTimeoutMs: 1000,
        stdout: { log: (line) => lines.push(line) },
      });
      expect(code).toBe(0);
      expect(lines.some((line) => line.includes(`stopped previous restart-zeus-game dev server pid ${previous.pid}`))).toBe(true);
      if (previous.exitCode === null && previous.signalCode === null) {
        await new Promise((resolveWait) => {
          const timeout = setTimeout(resolveWait, 500);
          previous.once("exit", () => {
            clearTimeout(timeout);
            resolveWait(undefined);
          });
        });
      }
      await expect(readFile(recordPath, "utf8")).rejects.toThrow();
    } finally {
      if (previous.pid && previous.exitCode === null) previous.kill("SIGKILL");
      await cleanup(projectDir);
      await cleanup(stateDir);
    }
  });

  it("prints top-level help for zeus", async () => {
    const lines: string[] = [];
    await expect(runZeusCli(["--help"], { stdout: { log: (line) => lines.push(line) } })).resolves.toBe(0);
    expect(lines.join("\n")).toContain("zeus");
    expect(lines.join("\n")).toContain("dev");
  });
});
