import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  AudioBitrate,
  AudioFormat,
  VideoQuality,
  YtDlpProgressEvent,
  YtDlpRunner,
} from "./ytdlp";
import { canonicalUrl, extractVideoId } from "./metadata";

export type DownloadPayload =
  | { mode: "video"; url: string; quality: VideoQuality; title?: string }
  | {
      mode: "audio";
      url: string;
      audioFormat: AudioFormat;
      audioBitrate: AudioBitrate;
      title?: string;
    };

export type DownloadPhase =
  | "probing"
  | "downloading-video"
  | "downloading-audio"
  | "merging"
  | "saving";

export interface DownloadProgressEvent {
  jobId: string;
  phase: DownloadPhase;
  percent?: number;
}

export interface DownloadResult {
  filePath: string;
  fileName: string;
  sizeBytes: number;
}

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]", "g");
const WINDOWS_FORBIDDEN = /[<>:"/\\|?*]+/g;

function sanitizeForFilename(input: string): string {
  const cleaned = input
    .replace(CONTROL_CHARS, "")
    .replace(WINDOWS_FORBIDDEN, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return cleaned || "video";
}

async function moveUnique(src: string, destDir: string, baseName: string, ext: string): Promise<string> {
  await mkdir(destDir, { recursive: true });
  let candidate = path.join(destDir, `${baseName}.${ext}`);
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await stat(candidate);
      n += 1;
      candidate = path.join(destDir, `${baseName} (${n}).${ext}`);
    } catch {
      break;
    }
  }
  await rename(src, candidate);
  return candidate;
}

interface InternalJob {
  controller: AbortController;
}

export class DownloadService {
  private readonly jobs = new Map<string, InternalJob>();

  constructor(
    private readonly runner: YtDlpRunner,
    private readonly emitProgress: (event: DownloadProgressEvent) => void,
    private readonly resolveDownloadsDir: () => string | Promise<string>
  ) {}

  cancel(jobId: string): void {
    const job = this.jobs.get(jobId);
    job?.controller.abort();
  }

  async run(jobId: string, payload: DownloadPayload): Promise<DownloadResult> {
    const videoId = extractVideoId(payload.url);
    if (!videoId) {
      throw new Error("La URL no parece un video válido de YouTube.");
    }
    const watchUrl = canonicalUrl(videoId);
    const slug = sanitizeForFilename(payload.title ?? videoId);
    const outputBase = `${videoId}-${randomUUID().slice(0, 8)}`;
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "tvrtube-"));

    const controller = new AbortController();
    this.jobs.set(jobId, { controller });

    const emit = (phase: DownloadPhase, percent?: number) =>
      this.emitProgress({ jobId, phase, percent });

    const ytdlpProgress = (e: YtDlpProgressEvent) =>
      emit(e.phase, e.percent);

    try {
      emit("probing");

      const produced =
        payload.mode === "video"
          ? await this.runner.downloadVideo({
              url: watchUrl,
              outputDir: tempDir,
              outputBase,
              quality: payload.quality,
              signal: controller.signal,
              onProgress: ytdlpProgress,
            })
          : await this.runner.downloadAudio({
              url: watchUrl,
              outputDir: tempDir,
              outputBase,
              format: payload.audioFormat,
              bitrate: payload.audioBitrate,
              signal: controller.signal,
              onProgress: ytdlpProgress,
            });

      emit("saving");
      const downloadsDir = await this.resolveDownloadsDir();
      const finalPath = await moveUnique(
        produced.filePath,
        downloadsDir,
        slug,
        produced.ext.toLowerCase()
      );
      const stats = await stat(finalPath);

      return {
        filePath: finalPath,
        fileName: path.basename(finalPath),
        sizeBytes: stats.size,
      };
    } finally {
      this.jobs.delete(jobId);
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
