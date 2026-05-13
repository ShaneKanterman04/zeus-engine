import { spawn } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const remote = args.remote ?? "shane@10.0.0.194";
const port = Number(args.port ?? "5173");

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid port: ${args.port}`);
}

const remoteCommand = [
  `pids=$(command -v lsof >/dev/null 2>&1 && lsof -tiTCP:${port} -sTCP:LISTEN || true)`,
  `if [ -z "$pids" ] && command -v ss >/dev/null 2>&1; then pids=$(ss -ltnp 'sport = :${port}' 2>/dev/null | sed -n 's/.*pid=\\([0-9][0-9]*\\).*/\\1/p' | sort -u); fi`,
  `if [ -z "$pids" ]; then echo 'No process listening on port ${port}'; exit 0; fi`,
  `echo "Stopping process(es) on port ${port}: $pids"`,
  `kill $pids 2>/dev/null || true`,
  `sleep 1`,
  `alive=''`,
  `for pid in $pids; do if kill -0 "$pid" 2>/dev/null; then alive="$alive $pid"; fi; done`,
  `if [ -n "$alive" ]; then echo "Force stopping:$alive"; kill -9 $alive 2>/dev/null || true; fi`,
].join("; ");

await run("ssh", [remote, remoteCommand]);

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--remote") parsed.remote = rawArgs[++index];
    else if (arg === "--port") parsed.port = rawArgs[++index];
  }
  return parsed;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}
