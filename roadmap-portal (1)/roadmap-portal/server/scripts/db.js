/**
 * Starts / stops the MongoDB instance this project owns.
 *
 * The data lives in <repo>/.data/db and the server listens on 27018, so the project's database
 * is completely separate from any system-wide MongoDB service on 27017: starting one never
 * disturbs the other, and dropping this one deletes nothing else.
 *
 *   node scripts/db.js start | stop | status
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const dataDir = path.join(repoRoot, ".data", "db");
const logDir = path.join(repoRoot, ".data", "log");
const logFile = path.join(logDir, "mongod.log");
const port = Number(process.env.DB_PORT ?? 27018);

const WINDOWS_INSTALL_ROOT = "C:\\Program Files\\MongoDB\\Server";
const KNOWN_VERSIONS = ["8.3", "8.2", "8.1", "8.0", "7.0", "6.0"];

/** mongod is rarely on the PATH on Windows, so fall back to the standard install location. */
function mongodPath() {
  if (process.env.MONGOD_PATH) return process.env.MONGOD_PATH;

  const lookup = process.platform === "win32" ? "where" : "which";
  const onPath = spawnSync(lookup, ["mongod"], { encoding: "utf8" });
  const first = (onPath.stdout ?? "").split(/\r?\n/)[0].trim();
  if (onPath.status === 0 && first) return first;

  if (process.platform === "win32") {
    for (const version of KNOWN_VERSIONS) {
      const candidate = path.join(WINDOWS_INSTALL_ROOT, version, "bin", "mongod.exe");
      if (existsSync(candidate)) return candidate;
    }
  }
  return "mongod";
}

function isListening() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitFor(state, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    if ((await isListening()) === state) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function tailLog(lines = 15) {
  if (!existsSync(logFile)) return "(no log file yet)";
  return readFileSync(logFile, "utf8").split(/\r?\n/).slice(-lines).join("\n");
}

async function start() {
  if (await isListening()) {
    console.log(`MongoDB is already listening on 127.0.0.1:${port}.`);
    return;
  }

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });

  const binary = mongodPath();
  const child = spawn(
    binary,
    ["--dbpath", dataDir, "--port", String(port), "--bind_ip", "127.0.0.1", "--logpath", logFile, "--logappend"],
    { detached: true, stdio: "ignore" },
  );
  child.on("error", (err) => {
    console.error(`Could not launch mongod (${binary}): ${err.message}`);
    console.error("Install MongoDB Community Server, or set MONGOD_PATH to the mongod binary.");
    process.exit(1);
  });
  child.unref();

  if (!(await waitFor(true))) {
    console.error(`mongod did not come up on port ${port}. Last log lines:\n${tailLog()}`);
    process.exit(1);
  }
  console.log(`MongoDB listening on 127.0.0.1:${port} (data: ${dataDir})`);
}

async function stop() {
  if (!(await isListening())) {
    console.log(`Nothing listening on 127.0.0.1:${port}.`);
    return;
  }
  // Ask the server to shut down through its own admin command rather than killing the process,
  // so WiredTiger gets to close its files cleanly.
  const { default: mongoose } = await import("mongoose");
  await mongoose.connect(`mongodb://127.0.0.1:${port}/admin`, { serverSelectionTimeoutMS: 5000 });
  try {
    await mongoose.connection.db.admin().command({ shutdown: 1 });
  } catch {
    // The connection drops as the server exits — that is the expected outcome, not a failure.
  }
  await mongoose.disconnect().catch(() => {});
  await waitFor(false);
  console.log("MongoDB stopped.");
}

const command = process.argv[2] ?? "start";
if (command === "start") await start();
else if (command === "stop") await stop();
else if (command === "status") console.log((await isListening()) ? `up on 127.0.0.1:${port}` : `down (port ${port})`);
else {
  console.error(`Unknown command "${command}". Use start, stop or status.`);
  process.exit(1);
}
