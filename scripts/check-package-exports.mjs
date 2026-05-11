const packages = [
  "@zeus/assets",
  "@zeus/audio",
  "@zeus/core",
  "@zeus/debug",
  "@zeus/input",
  "@zeus/net",
  "@zeus/net/web-socket-room-client",
  "@zeus/net/web-socket-room-server",
  "@zeus/net-colyseus",
  "@zeus/renderer-pixi",
  "@zeus/tools",
];

for (const packageName of packages) {
  await import(packageName);
}

console.log("package-exports-ok");
