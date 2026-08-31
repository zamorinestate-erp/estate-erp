import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const backendDir = path.resolve(rootDir, "backend");

console.log("================================================================================");
console.log("             ZAMORIN CAFE ERP — FULL APPLICATION STARTUP                         ");
console.log("================================================================================");

// 1. Start Backend Dev Server (with in-memory MongoDB and initial seed)
console.log("[Launcher] Starting Backend API Server (Port 4000)...");
const backendProcess = spawn("node", ["src/scripts/startDev.js"], {
  cwd: backendDir,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: "4000" },
});

backendProcess.on("error", (err) => {
  console.error("[Launcher] Backend failed to start:", err);
});

// 2. Start Frontend Server (Port 3000)
console.log("[Launcher] Starting Frontend Server (Port 3000)...");
const frontendProcess = spawn("node", ["scripts/serve_frontend.js"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: "3000", BACKEND_URL: "http://localhost:4000" },
});

frontendProcess.on("error", (err) => {
  console.error("[Launcher] Frontend failed to start:", err);
});

process.on("SIGINT", () => {
  console.log("\n[Launcher] Gracefully shutting down services...");
  backendProcess.kill();
  frontendProcess.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  backendProcess.kill();
  frontendProcess.kill();
  process.exit(0);
});
