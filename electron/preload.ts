import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";

type DownloadPayload =
  | {
      mode: "video";
      url: string;
      quality: "360p" | "480p" | "720p" | "1080p" | "1440p" | "2160p";
      title?: string;
    }
  | {
      mode: "audio";
      url: string;
      audioFormat: "mp3" | "m4a";
      audioBitrate: "128" | "192" | "256" | "320";
      title?: string;
    };

type ProgressPhase =
  | "probing"
  | "downloading-video"
  | "downloading-audio"
  | "merging"
  | "saving";

type ProgressEvent = {
  jobId: string;
  phase: ProgressPhase;
  percent?: number;
};

type DownloadResult = {
  filePath: string;
  fileName: string;
  sizeBytes: number;
};

type BinariesStatus =
  | { state: "checking" }
  | {
      state: "downloading";
      bin: "yt-dlp";
      percent: number;
      receivedBytes: number;
      totalBytes: number | null;
    }
  | { state: "verifying"; bin: "yt-dlp" }
  | { state: "ready"; ytdlpPath: string; ffmpegPath: string }
  | { state: "error"; message: string };

type Settings = {
  downloadsDir: string;
};

type UpdaterStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; version: string; releaseNotes?: string | null }
  | { state: "not-available"; version: string }
  | {
      state: "downloading";
      percent: number;
      transferred: number;
      total: number;
      bytesPerSecond: number;
    }
  | { state: "downloaded"; version: string; releaseNotes?: string | null }
  | { state: "error"; message: string };

const api = {
  getBinariesStatus(): Promise<BinariesStatus> {
    return ipcRenderer.invoke("binaries:get-status");
  },
  retryBinaries(): Promise<void> {
    return ipcRenderer.invoke("binaries:retry");
  },
  onBinariesStatus(handler: (status: BinariesStatus) => void): () => void {
    const listener = (_e: IpcRendererEvent, status: BinariesStatus) =>
      handler(status);
    ipcRenderer.on("binaries:status", listener);
    return () => ipcRenderer.off("binaries:status", listener);
  },
  getMetadata(url: string): Promise<unknown> {
    return ipcRenderer.invoke("metadata:get", url);
  },
  startDownload(payload: DownloadPayload): Promise<DownloadResult> {
    return ipcRenderer.invoke("download:start", payload);
  },
  cancelDownload(jobId: string): Promise<void> {
    return ipcRenderer.invoke("download:cancel", jobId);
  },
  onDownloadProgress(
    handler: (event: ProgressEvent) => void
  ): () => void {
    const listener = (_e: IpcRendererEvent, evt: ProgressEvent) => handler(evt);
    ipcRenderer.on("download:progress", listener);
    return () => ipcRenderer.off("download:progress", listener);
  },
  revealInFolder(filePath: string): Promise<void> {
    return ipcRenderer.invoke("shell:reveal", filePath);
  },
  getSettings(): Promise<Settings> {
    return ipcRenderer.invoke("settings:get");
  },
  setSettings(partial: Partial<Settings>): Promise<Settings> {
    return ipcRenderer.invoke("settings:set", partial);
  },
  resetSettings(): Promise<Settings> {
    return ipcRenderer.invoke("settings:reset");
  },
  chooseDownloadsDirectory(): Promise<string | null> {
    return ipcRenderer.invoke("settings:choose-directory");
  },
  onSettingsChange(handler: (settings: Settings) => void): () => void {
    const listener = (_e: IpcRendererEvent, s: Settings) => handler(s);
    ipcRenderer.on("settings:changed", listener);
    return () => ipcRenderer.off("settings:changed", listener);
  },
  getUpdaterStatus(): Promise<UpdaterStatus> {
    return ipcRenderer.invoke("updater:get-status");
  },
  checkForUpdates(): Promise<void> {
    return ipcRenderer.invoke("updater:check");
  },
  quitAndInstallUpdate(): Promise<void> {
    return ipcRenderer.invoke("updater:quit-and-install");
  },
  onUpdaterStatus(handler: (status: UpdaterStatus) => void): () => void {
    const listener = (_e: IpcRendererEvent, status: UpdaterStatus) =>
      handler(status);
    ipcRenderer.on("updater:status", listener);
    return () => ipcRenderer.off("updater:status", listener);
  },
};

contextBridge.exposeInMainWorld("tvr", api);

export type TvrApi = typeof api;
