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
};

contextBridge.exposeInMainWorld("tvr", api);

export type TvrApi = typeof api;
