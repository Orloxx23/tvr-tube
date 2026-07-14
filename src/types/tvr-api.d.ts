import type { VideoMetadata } from "@/types/video";

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

interface ProgressEvent {
  jobId: string;
  phase: ProgressPhase;
  percent?: number;
}

interface DownloadResult {
  filePath: string;
  fileName: string;
  sizeBytes: number;
}

export type BinariesStatus =
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

export type CookiesBrowser =
  | "none"
  | "chrome"
  | "edge"
  | "firefox"
  | "brave"
  | "opera"
  | "vivaldi"
  | "chromium";

export type Settings = {
  downloadsDir: string;
  cookiesBrowser: CookiesBrowser;
};

export type UpdaterStatus =
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

interface TvrApi {
  getBinariesStatus(): Promise<BinariesStatus>;
  retryBinaries(): Promise<void>;
  onBinariesStatus(handler: (status: BinariesStatus) => void): () => void;
  getMetadata(url: string): Promise<VideoMetadata>;
  startDownload(payload: DownloadPayload): Promise<DownloadResult>;
  cancelDownload(jobId: string): Promise<void>;
  onDownloadProgress(handler: (event: ProgressEvent) => void): () => void;
  revealInFolder(filePath: string): Promise<void>;
  getSettings(): Promise<Settings>;
  setSettings(partial: Partial<Settings>): Promise<Settings>;
  resetSettings(): Promise<Settings>;
  chooseDownloadsDirectory(): Promise<string | null>;
  onSettingsChange(handler: (settings: Settings) => void): () => void;
  getUpdaterStatus(): Promise<UpdaterStatus>;
  checkForUpdates(): Promise<void>;
  quitAndInstallUpdate(): Promise<void>;
  onUpdaterStatus(handler: (status: UpdaterStatus) => void): () => void;
}

declare global {
  interface Window {
    tvr: TvrApi;
  }
}

export {};
