import { app, BrowserWindow, dialog, Menu, shell, Tray } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.AUSCULTOR_DATA_DIR ||= dataDirectory();
app.setPath("userData", path.join(process.env.AUSCULTOR_DATA_DIR, ".desktop"));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let mainWindow = null;
let serverProcess = null;
let tray = null;
let quitting = false;
let stopBot = null;

function dataDirectory() {
  const base = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(base, "Auscultor");
}

function startAdminServer() {
  return new Promise((resolve, reject) => {
    const entrypoint = path.join(app.getAppPath(), "src", "admin", "server.js");
    const localDirectory = path.join(process.env.AUSCULTOR_DATA_DIR, ".local");
    fs.mkdirSync(localDirectory, { recursive: true, mode: 0o700 });
    const logPath = path.join(localDirectory, "desktop.log");
    const log = fs.createWriteStream(logPath, { flags: "a", mode: 0o600 });
    serverProcess = spawn(process.execPath, [entrypoint], {
      cwd: process.env.AUSCULTOR_DATA_DIR,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", ADMIN_PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) reject(new Error("El panel local no respondió a tiempo"));
    }, 15_000);
    const inspect = (chunk) => {
      const text = chunk.toString();
      log.write(text);
      const match = text.match(/Panel de configuración disponible en (http:\/\/127\.0\.0\.1:\d+)/);
      if (match && !settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(match[1]);
      }
    };
    serverProcess.stdout.on("data", inspect);
    serverProcess.stderr.on("data", (chunk) => log.write(chunk));
    serverProcess.on("error", (error) => {
      if (!settled) { settled = true; clearTimeout(timeout); reject(error); }
    });
    serverProcess.on("exit", (code) => {
      log.end();
      if (!settled) { settled = true; clearTimeout(timeout); reject(new Error(`El panel local terminó con código ${code}`)); }
    });
  });
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 860,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#08110e",
    icon: path.join(app.getAppPath(), "assets", "auscultor.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https:\/\//.test(target)) shell.openExternal(target);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (!target.startsWith(url)) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
  mainWindow.loadURL(url);
}

function createTray() {
  tray = new Tray(path.join(app.getAppPath(), "assets", "auscultor.png"));
  tray.setToolTip("Auscultor");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Mostrar Auscultor", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: "separator" },
    { label: "Salir", click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on("double-click", () => { mainWindow?.show(); mainWindow?.focus(); });
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  try {
    const { initializeUserData } = await import("../initializeUserData.js");
    initializeUserData();
    ({ stopBotProcess: stopBot } = await import("../admin/botProcessManager.js"));
    const url = await startAdminServer();
    createWindow(url);
    createTray();
  } catch (error) {
    dialog.showErrorBox("Auscultor no pudo iniciarse", error.message);
    app.quit();
  }
});

app.on("window-all-closed", () => {});
app.on("before-quit", () => {
  quitting = true;
  try { stopBot?.(); } catch {}
  if (serverProcess && serverProcess.exitCode === null) serverProcess.kill("SIGTERM");
});
