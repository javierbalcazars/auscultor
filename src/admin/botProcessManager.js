import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { AUTH_SESSION_PATH, INSTANCE_LOCK_PATH, PROJECT_ROOT } from "../config.js";
import { readBotStatus } from "../botStatus.js";

const BOT_ENTRYPOINT = path.join(PROJECT_ROOT, "src", "index.js");

export function whatsappSessionIsLinked(
  authSessionPath = AUTH_SESSION_PATH,
  { status = readBotStatus() } = {}
) {
  if (status?.whatsappLoggedOut === true) return false;
  try {
    const credentials = JSON.parse(fs.readFileSync(path.join(authSessionPath, "creds.json"), "utf8"));
    return Boolean(credentials?.me?.id);
  } catch {
    return false;
  }
}

function readProcessLock(lockPath = INSTANCE_LOCK_PATH) {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    return Number.isInteger(lock.processId) && lock.processId > 0 ? lock : null;
  } catch {
    return null;
  }
}

function processIsAlive(processId) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function processMatchesBot(processId) {
  const procRoot = `/proc/${processId}`;
  try {
    const commandLine = fs.readFileSync(path.join(procRoot, "cmdline"), "utf8").replace(/\0/g, "\n");
    const workingDirectory = fs.readlinkSync(path.join(procRoot, "cwd"));
    return workingDirectory === PROJECT_ROOT && (
      commandLine.includes(BOT_ENTRYPOINT) ||
      commandLine.includes("src/index.js")
    );
  } catch (error) {
    // En sistemas sin /proc, o sin permiso para inspeccionarlo, preferimos no
    // matar procesos desde el panel. El lock del bot seguirá impidiendo dobles
    // instancias cuando el proceso real esté activo.
    if (error?.code === "ENOENT" || error?.code === "EACCES" || error?.code === "EPERM") return false;
    return false;
  }
}

function runningBotLock(lockPath = INSTANCE_LOCK_PATH) {
  const lock = readProcessLock(lockPath);
  if (!lock || !processIsAlive(lock.processId)) return null;
  if (!processMatchesBot(lock.processId)) return null;
  return lock;
}

export function botIsRunning({ lockPath = INSTANCE_LOCK_PATH } = {}) {
  return Boolean(runningBotLock(lockPath));
}

export function currentBotStatus() {
  const status = readBotStatus();
  const linked = whatsappSessionIsLinked(AUTH_SESSION_PATH, { status });
  const lock = runningBotLock();
  if (!lock) return { running: false, state: "stopped", whatsappState: linked ? "linked" : "unlinked" };
  const { processId } = lock;
  if (!status || status.processId !== processId) {
    return { running: true, state: "starting", whatsappState: linked ? "linked" : "connecting" };
  }
  const state = ["starting", "qr", "connected", "reconnecting"].includes(status.state)
    ? status.state
    : "starting";
  return {
    running: true,
    state,
    whatsappState: state === "qr" ? "qr" : (linked || state === "connected" ? "linked" : "connecting"),
    ...(status.state === "qr" && typeof status.qrDisplay === "string"
      ? { qrDisplay: status.qrDisplay }
      : {}),
  };
}

export function stopBotProcess({ lockPath = INSTANCE_LOCK_PATH } = {}) {
  const lock = runningBotLock(lockPath);
  if (!lock) return false;
  const { processId } = lock;
  process.kill(processId, "SIGINT");
  return true;
}

export function startBotProcess() {
  if (botIsRunning()) return false;
  const localDirectory = path.join(PROJECT_ROOT, ".local");
  const logPath = path.join(localDirectory, "bot.log");
  fs.mkdirSync(localDirectory, { recursive: true, mode: 0o700 });
  fs.chmodSync(localDirectory, 0o700);
  fs.closeSync(fs.openSync(logPath, "a", 0o600));
  fs.chmodSync(logPath, 0o600);

  const result = spawnSync("systemd-run", [
    "--user", "--collect", `--unit=whatsapp-bot-${Date.now()}`,
    `--property=WorkingDirectory=${PROJECT_ROOT}`,
    `--property=StandardOutput=append:${logPath}`,
    `--property=StandardError=append:${logPath}`,
    process.execPath, path.join(PROJECT_ROOT, "src", "index.js"),
  ], { encoding: "utf8" });
  if (result.status === 0) return true;

  const logDescriptor = fs.openSync(logPath, "a", 0o600);
  try {
    const child = spawn(process.execPath, [BOT_ENTRYPOINT], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: ["ignore", logDescriptor, logDescriptor],
    });
    child.unref();
  } catch (error) {
    const detail = String(result.stderr || result.error?.message || error.message).trim().slice(0, 240);
    throw new Error(`No se pudo iniciar el bot. Detalle: ${detail}`);
  } finally {
    fs.closeSync(logDescriptor);
  }
  return true;
}

export async function resetWhatsAppSession({
  authSessionPath = AUTH_SESSION_PATH,
  isRunning = botIsRunning,
  stop = stopBotProcess,
  start = startBotProcess,
} = {}) {
  if (isRunning()) {
    stop();
    for (let attempt = 0; attempt < 50 && isRunning(); attempt += 1) await wait(100);
    if (isRunning()) throw new Error("El bot no se detuvo a tiempo. Inténtalo nuevamente.");
  }
  fs.rmSync(authSessionPath, { recursive: true, force: true });
  start();
  return true;
}
