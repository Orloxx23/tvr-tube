import type {
  AudioBitrate,
  AudioFormat,
  DownloadMode,
  VideoQuality,
} from "@/lib/constants";
import type { Platform } from "@/lib/platforms";

export interface VideoMetadata {
  id: string;
  sourceUrl: string;
  platform: Platform;
  title: string;
  author: string;
  authorUrl?: string;
  thumbnailUrl: string;
  durationSeconds?: number;
  providerUrl: string;
  availableQualities?: VideoQuality[];
}

export interface DownloadOptions {
  mode: DownloadMode;
  quality?: VideoQuality;
  audioBitrate?: AudioBitrate;
  audioFormat?: AudioFormat;
}

export interface DownloadHistoryEntry {
  id: string;
  videoId: string;
  sourceUrl?: string;
  platform?: Platform;
  title: string;
  author: string;
  thumbnailUrl: string;
  options: DownloadOptions;
  createdAt: number;
  filePath?: string;
  fileName?: string;
  sizeBytes?: number;
  status: "pending" | "processing" | "ready" | "failed";
  errorMessage?: string;
}

export type DownloadJobPhase =
  | "queued"
  | "analyzing"
  | "downloading-video"
  | "downloading-audio"
  | "merging"
  | "saving"
  | "completed"
  | "failed";

export interface DownloadProgress {
  phase: DownloadJobPhase;
  percent: number;
  label: string;
  detail?: string;
}
