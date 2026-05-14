import type {
  AudioBitrate,
  AudioFormat,
  DownloadMode,
  VideoQuality,
} from "@/lib/constants";

export interface VideoMetadata {
  id: string;
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
  title: string;
  author: string;
  thumbnailUrl: string;
  options: DownloadOptions;
  createdAt: number;
  downloadUrl?: string;
  expiresAt?: number;
  status: "pending" | "processing" | "ready" | "failed" | "expired";
  errorMessage?: string;
}

export type DownloadJobPhase =
  | "queued"
  | "analyzing"
  | "downloading-video"
  | "downloading-audio"
  | "merging"
  | "uploading"
  | "completed"
  | "failed";

export interface DownloadProgress {
  phase: DownloadJobPhase;
  percent: number;
  label: string;
  detail?: string;
}
