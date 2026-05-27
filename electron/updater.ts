import { app, BrowserWindow } from "electron";
import { autoUpdater, type ProgressInfo, type UpdateInfo } from "electron-updater";

export type UpdaterStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; version: string; releaseNotes?: string | null }
  | { state: "not-available"; version: string }
  | { state: "downloading"; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { state: "downloaded"; version: string; releaseNotes?: string | null }
  | { state: "error"; message: string };

type UpdaterDeps = {
  getWindow: () => BrowserWindow | null;
};

let lastStatus: UpdaterStatus = { state: "idle" };
let initialized = false;

function send(win: BrowserWindow | null, status: UpdaterStatus): void {
  lastStatus = status;
  win?.webContents.send("updater:status", status);
}

function normalizeNotes(notes: UpdateInfo["releaseNotes"]): string | null {
  if (!notes) return null;
  if (typeof notes === "string") return notes;
  return notes
    .map((entry) => (typeof entry === "string" ? entry : entry.note ?? ""))
    .filter(Boolean)
    .join("\n\n");
}

export function initUpdater({ getWindow }: UpdaterDeps): void {
  if (initialized) return;
  initialized = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on("checking-for-update", () => {
    send(getWindow(), { state: "checking" });
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    send(getWindow(), {
      state: "available",
      version: info.version,
      releaseNotes: normalizeNotes(info.releaseNotes),
    });
  });

  autoUpdater.on("update-not-available", (info: UpdateInfo) => {
    send(getWindow(), { state: "not-available", version: info.version });
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    send(getWindow(), {
      state: "downloading",
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    send(getWindow(), {
      state: "downloaded",
      version: info.version,
      releaseNotes: normalizeNotes(info.releaseNotes),
    });
  });

  autoUpdater.on("error", (err) => {
    const message = err instanceof Error ? err.message : String(err);
    send(getWindow(), { state: "error", message });
  });
}

export function getUpdaterStatus(): UpdaterStatus {
  return lastStatus;
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    lastStatus = {
      state: "error",
      message: "Las actualizaciones automáticas solo funcionan en la app empaquetada.",
    };
    return;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    lastStatus = {
      state: "error",
      message: err instanceof Error ? err.message : "Error desconocido al buscar actualizaciones.",
    };
  }
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall(false, true);
}
