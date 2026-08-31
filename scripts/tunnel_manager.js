import { spawn } from "node:child_process";

function startTunnel() {
  console.log("[TunnelManager] Launching localhost.run tunnel...");
  const child = spawn("ssh", [
    "-R", "80:localhost:3000",
    "-o", "StrictHostKeyChecking=no",
    "-o", "ServerAliveInterval=15",
    "-o", "ServerAliveCountMax=5",
    "nokey@localhost.run"
  ], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (data) => {
    const text = data.toString();
    process.stdout.write(text);
    const match = text.match(/https:\/\/[a-z0-9]+\.lhr\.life/i);
    if (match) {
      console.log("\n========================================================");
      console.log(`[TunnelManager] LIVE MOBILE URL: ${match[0]}`);
      console.log("========================================================\n");
    }
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(data.toString());
  });

  child.on("close", (code) => {
    console.log(`[TunnelManager] Tunnel closed (exit code ${code}). Reconnecting in 3 seconds...`);
    setTimeout(startTunnel, 3000);
  });

  child.on("error", (err) => {
    console.error("[TunnelManager] Tunnel spawn error:", err);
    setTimeout(startTunnel, 5000);
  });
}

startTunnel();
