export type VideoQuality = "360p" | "480p" | "720p" | "1080p" | "1440p" | "2160p";
export type AudioBitrate = "128" | "192" | "256" | "320";
export type AudioFormat = "mp3" | "m4a";
export type DownloadMode = "video" | "audio";

export const VIDEO_QUALITIES: ReadonlyArray<{
  value: VideoQuality;
  label: string;
  height: number;
  badge?: string;
}> = [
  { value: "360p", label: "360p", height: 360 },
  { value: "480p", label: "480p", height: 480 },
  { value: "720p", label: "720p HD", height: 720 },
  { value: "1080p", label: "1080p Full HD", height: 1080 },
  { value: "1440p", label: "1440p 2K", height: 1440, badge: "2K" },
  { value: "2160p", label: "2160p Ultra HD", height: 2160, badge: "4K" },
];

export const AUDIO_BITRATES: ReadonlyArray<{ value: AudioBitrate; label: string }> = [
  { value: "128", label: "128 kbps" },
  { value: "192", label: "192 kbps" },
  { value: "256", label: "256 kbps" },
  { value: "320", label: "320 kbps" },
];

export const AUDIO_FORMATS: ReadonlyArray<{ value: AudioFormat; label: string }> = [
  { value: "mp3", label: "MP3" },
  { value: "m4a", label: "M4A" },
];

export const DEFAULT_QUALITY: VideoQuality = "1080p";
export const DEFAULT_AUDIO_BITRATE: AudioBitrate = "192";
export const DEFAULT_AUDIO_FORMAT: AudioFormat = "mp3";

export const HISTORY_STORAGE_KEY = "ytv:download-history";
export const HISTORY_MAX_ENTRIES = 25;
