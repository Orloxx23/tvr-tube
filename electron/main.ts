import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import path from "node:path";
import {
  ensureBinaries,
  type BinariesStatus,
} from "./bin-manager";
import { createYtDlp, type YtDlpRunner } from "./ytdlp";
import { fetchVideoMetadata, MetadataError } from "./metadata";
import {
  DownloadService,
  type DownloadPayload,
  type DownloadProgressEvent,
} from "./download-service";
import {
  getSettings,
  onSettingsChange,
  resetSettings,
  setSettings,
  type Settings,
} from "./settings-store";
import {
  checkForUpdates,
  getUpdaterStatus,
  initUpdater,
  quitAndInstall,
} from "./updater";

const isDev = !app.isPackaged;

const RENDERER_DEV_URL = "http://localhost:3000";
const RENDERER_PROD_PATH = path.join(__dirname, "..", "out", "index.html");

let mainWindow: BrowserWindow | null = null;
let lastBinariesStatus: BinariesStatus = { state: "checking" };
let runner: YtDlpRunner | null = null;
let downloadService: DownloadService | null = null;

function broadcastBinariesStatus(status: BinariesStatus): void {
  lastBinariesStatus = status;
  mainWindow?.webContents.send("binaries:status", status);
}

function emitDownloadProgress(event: DownloadProgressEvent): void {
  mainWindow?.webContents.send("download:progress", event);
}

function buildRuntimeServices(ytdlpPath: string, ffmpegPath: string): void {
  runner = createYtDlp({
    ytdlpPath,
    ffmpegPath,
    cookiesPath: process.env.YT_DLP_COOKIES_PATH || undefined,
    extractorArgs: process.env.YT_DLP_EXTRACTOR_ARGS || undefined,
  });
  downloadService = new DownloadService(
    runner,
    emitDownloadProgress,
    async () => (await getSettings()).downloadsDir
  );
}

function broadcastSettings(settings: Settings): void {
  mainWindow?.webContents.send("settings:changed", settings);
}

async function startBinariesBootstrap(): Promise<void> {
  try {
    const { ytdlpPath, ffmpegPath } = await ensureBinaries({
      onStatus: broadcastBinariesStatus,
    });
    buildRuntimeServices(ytdlpPath, ffmpegPath);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al preparar binarios.";
    broadcastBinariesStatus({ state: "error", message });
  }
}

function ensureReady<T>(value: T | null, name: string): T {
  if (!value) {
    throw new Error(`${name} todavía no está listo. Esperá a que terminen los binarios.`);
  }
  return value;
}

function registerIpcHandlers(): void {
  ipcMain.handle("binaries:get-status", () => lastBinariesStatus);

  ipcMain.handle("binaries:retry", () => {
    void startBinariesBootstrap();
  });

  ipcMain.handle("settings:get", async () => getSettings());

  ipcMain.handle("settings:set", async (_e, partial: Partial<Settings>) =>
    setSettings(partial)
  );

  ipcMain.handle("settings:reset", async () => resetSettings());

  ipcMain.handle("settings:choose-directory", async () => {
    const win = mainWindow;
    if (!win) return null;
    const current = (await getSettings()).downloadsDir;
    const result = await dialog.showOpenDialog(win, {
      title: "Elegí la carpeta de descargas",
      defaultPath: current,
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("metadata:get", async (_e, url: string) => {
    const r = ensureReady(runner, "yt-dlp");
    try {
      return await fetchVideoMetadata(url, r);
    } catch (err) {
      if (err instanceof MetadataError) throw new Error(err.message);
      throw err;
    }
  });

  ipcMain.handle("download:start", async (_e, payload: DownloadPayload) => {
    const svc = ensureReady(downloadService, "Servicio de descarga");
    const jobId = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return svc.run(jobId, payload);
  });

  ipcMain.handle("download:cancel", async (_e, jobId: string) => {
    downloadService?.cancel(jobId);
  });

  ipcMain.handle("shell:reveal", async (_e, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle("updater:get-status", () => getUpdaterStatus());
  ipcMain.handle("updater:check", async () => checkForUpdates());
  ipcMain.handle("updater:quit-and-install", () => quitAndInstall());
}

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 500,
    backgroundColor: "#0a0a0a",
    show: false,
    title: "TVR Tube",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow = win;

  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("did-finish-load", () => {
    win.webContents.send("binaries:status", lastBinariesStatus);
  });

  if (isDev) {
    await win.loadURL(RENDERER_DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(RENDERER_PROD_PATH);
  }
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  registerIpcHandlers();
  onSettingsChange(broadcastSettings);
  await getSettings();
  await createWindow();
  void startBinariesBootstrap();
  initUpdater({ getWindow: () => mainWindow });
  if (app.isPackaged) {
    setTimeout(() => {
      void checkForUpdates();
    }, 4000);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
