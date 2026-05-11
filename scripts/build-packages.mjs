import { rm, writeFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const packages = [
  "zeus-core",
  "zeus-assets",
  "zeus-audio",
  "zeus-debug",
  "zeus-net",
  "zeus-tools",
  "zeus-input",
  "zeus-net-colyseus",
  "zeus-renderer-pixi",
];

for (const packageName of packages) {
  const packageDir = join("packages", packageName);
  const configPath = join(packageDir, "tsconfig.build.json");
  await rm(join(packageDir, "dist"), { recursive: true, force: true });
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        extends: "../../tsconfig.json",
        compilerOptions: {
          noEmit: false,
          allowImportingTsExtensions: false,
          declaration: true,
          declarationMap: true,
          sourceMap: true,
          rootDir: "src",
          outDir: "dist",
          tsBuildInfoFile: "dist/.tsbuildinfo",
        },
        include: ["src"],
      },
      null,
      2,
    )}\n`,
  );
  try {
    await runTsc(configPath);
  } finally {
    await unlink(configPath).catch(() => undefined);
  }
}

function runTsc(configPath) {
  const executable = process.platform === "win32" ? "tsc.cmd" : "tsc";
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ["-p", configPath], { stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tsc failed for ${configPath} with exit code ${code}`));
      }
    });
  });
}
