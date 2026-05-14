import "server-only";
import { spawn } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import type { AudioBitrate, AudioFormat, VideoQuality } from "@/lib/constants";

const QUALITY_TO_HEIGHT: Record<VideoQuality, number> = {
  "360p": 360,
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
  "1440p": 1440,
  "2160p": 2160,
};

export class YtDlpError extends Error {
  readonly code: string;
  readonly stderr: string;
  constructor(message: string, code: string, stderr: string) {
    super(message);
    this.name = "YtDlpError";
    this.code = code;
    this.stderr = stderr;
  }
}

function getYtDlpBinary(): string {
  return env.YT_DLP_PATH || "yt-dlp";
}

function getFfmpegLocation(): string | undefined {
  return env.FFMPEG_PATH || undefined;
}

function getCommonArgs(): string[] {
  const args: string[] = [];
  if (env.YT_DLP_COOKIES_PATH) {
    args.push("--cookies", env.YT_DLP_COOKIES_PATH);
  }
  if (env.YT_DLP_EXTRACTOR_ARGS) {
    args.push("--extractor-args", env.YT_DLP_EXTRACTOR_ARGS);
  }
  return args;
}

function classifyError(stderr: string): { code: string; message: string } {
  if (/Sign in to confirm|confirm you.?re not a bot/i.test(stderr)) {
    return {
      code: "youtube_bot_check",
      message:
        "YouTube exige autenticación desde esta IP (típico en VPS). Subí un cookies.txt al servidor y configurá YT_DLP_COOKIES_PATH apuntando al archivo.",
    };
  }
  if (/Private video/i.test(stderr)) {
    return { code: "private", message: "Este video es privado." };
  }
  if (/Video unavailable/i.test(stderr)) {
    return {
      code: "unavailable",
      message: "El video no está disponible, fue eliminado o tiene restricción regional.",
    };
  }
  if (/age.?restricted|inappropriate for some users/i.test(stderr)) {
    return {
      code: "age_restricted",
      message: "Video con restricción de edad — requiere cookies de una cuenta verificada.",
    };
  }
  if (/HTTP Error 429|Too Many Requests/i.test(stderr)) {
    return {
      code: "youtube_rate_limit",
      message: "YouTube rate-limiteó esta IP. Esperá unos minutos o configurá un proxy.",
    };
  }
  return {
    code: "non_zero_exit",
    message: `yt-dlp terminó con error: ${extractLastErrorLine(stderr)}`,
  };
}

interface RunOptions {
  signal?: AbortSignal;
  onLine?: (line: string) => void;
}

function makeLineSplitter(callback: (line: string) => void) {
  let buf = "";
  return (chunk: string) => {
    buf += chunk;
    let idx: number;
    while ((idx = buf.search(/\r?\n/)) >= 0) {
      const line = buf.slice(0, idx);
      callback(line);
      buf = buf.slice(idx).replace(/^\r?\n/, "");
    }
  };
}

async function runYtDlp(
  args: string[],
  options?: RunOptions
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const bin = getYtDlpBinary();
    const ffmpegLocation = getFfmpegLocation();
    const fullArgs = [
      ...(ffmpegLocation ? ["--ffmpeg-location", ffmpegLocation] : []),
      ...getCommonArgs(),
      ...args,
    ];
    const signal = options?.signal;

    const child = spawn(bin, fullArgs, {
      windowsHide: true,
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    const onStdoutLine = options?.onLine
      ? makeLineSplitter(options.onLine)
      : null;
    const onStderrLine = options?.onLine
      ? makeLineSplitter(options.onLine)
      : null;

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      onStdoutLine?.(text);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      onStderrLine?.(text);
    });

    const onAbort = () => {
      child.kill("SIGTERM");
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    child.on("error", (err) => {
      signal?.removeEventListener("abort", onAbort);
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new YtDlpError(
            "No se encontró el binario yt-dlp en el servidor. Instalalo o configurá YT_DLP_PATH en el .env apuntando al ejecutable.",
            "binary_missing",
            err.message
          )
        );
      } else {
        reject(
          new YtDlpError(
            `Error al ejecutar yt-dlp: ${err.message}`,
            "spawn_error",
            err.message
          )
        );
      }
    });

    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else if (signal?.aborted) {
        reject(new YtDlpError("Descarga cancelada.", "aborted", stderr));
      } else {
        const { code: errCode, message } = classifyError(stderr);
        reject(new YtDlpError(message, errCode, stderr));
      }
    });
  });
}

function extractLastErrorLine(stderr: string): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const errLine = [...lines].reverse().find((l) => /ERROR/i.test(l));
  return errLine ?? lines[lines.length - 1] ?? "error desconocido";
}

export type YtDlpPhase =
  | "downloading-video"
  | "downloading-audio"
  | "merging";

export interface YtDlpProgressEvent {
  phase: YtDlpPhase;
  percent?: number;
}

function makeProgressParser(
  initialPhase: YtDlpPhase,
  hasVideoAndAudio: boolean,
  onProgress: (e: YtDlpProgressEvent) => void
) {
  let phase: YtDlpPhase = initialPhase;
  let destinationCount = 0;
  let lastEmitted = -1;

  return (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.startsWith("[download] Destination:")) {
      destinationCount += 1;
      if (hasVideoAndAudio && destinationCount === 2) {
        phase = "downloading-audio";
        lastEmitted = -1;
      }
      onProgress({ phase, percent: 0 });
      return;
    }
    if (
      trimmed.startsWith("[Merger]") ||
      trimmed.startsWith("[ExtractAudio]") ||
      trimmed.startsWith("[FixupM4a]") ||
      trimmed.startsWith("[FixupBitstream]")
    ) {
      phase = "merging";
      onProgress({ phase });
      return;
    }
    const m = trimmed.match(/^\[download\]\s+(\d+(?:\.\d+)?)%/);
    if (m && m[1]) {
      const pct = Math.floor(parseFloat(m[1]));
      if (pct !== lastEmitted) {
        lastEmitted = pct;
        onProgress({ phase, percent: pct });
      }
    }
  };
}

export interface DownloadVideoInput {
  url: string;
  outputDir: string;
  outputBase: string;
  quality: VideoQuality;
  signal?: AbortSignal;
  onProgress?: (e: YtDlpProgressEvent) => void;
}

export async function downloadVideo({
  url,
  outputDir,
  outputBase,
  quality,
  signal,
  onProgress,
}: DownloadVideoInput): Promise<{ filePath: string; ext: string }> {
  const height = QUALITY_TO_HEIGHT[quality];
  const outputTemplate = path.join(outputDir, `${outputBase}.%(ext)s`);
  const args = [
    "-f",
    `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`,
    "--merge-output-format",
    "mp4",
    "--no-playlist",
    "--no-warnings",
    "--newline",
    "-o",
    outputTemplate,
    url,
  ];
  const onLine = onProgress
    ? makeProgressParser("downloading-video", true, onProgress)
    : undefined;
  await runYtDlp(args, { signal, onLine });
  return findProducedFile(outputDir, outputBase);
}

export interface DownloadAudioInput {
  url: string;
  outputDir: string;
  outputBase: string;
  format: AudioFormat;
  bitrate: AudioBitrate;
  signal?: AbortSignal;
  onProgress?: (e: YtDlpProgressEvent) => void;
}

export async function downloadAudio({
  url,
  outputDir,
  outputBase,
  format,
  bitrate,
  signal,
  onProgress,
}: DownloadAudioInput): Promise<{ filePath: string; ext: string }> {
  const outputTemplate = path.join(outputDir, `${outputBase}.%(ext)s`);
  const args = [
    "-f",
    format === "m4a" ? "bestaudio[ext=m4a]/bestaudio" : "bestaudio",
    "-x",
    "--audio-format",
    format,
    "--audio-quality",
    `${bitrate}K`,
    "--no-playlist",
    "--no-warnings",
    "--newline",
    "-o",
    outputTemplate,
    url,
  ];
  const onLine = onProgress
    ? makeProgressParser("downloading-audio", false, onProgress)
    : undefined;
  await runYtDlp(args, { signal, onLine });
  return findProducedFile(outputDir, outputBase);
}

async function findProducedFile(
  outputDir: string,
  outputBase: string
): Promise<{ filePath: string; ext: string }> {
  const files = await readdir(outputDir);
  const match = files.find((f) => f.startsWith(`${outputBase}.`));
  if (!match) {
    throw new YtDlpError(
      "yt-dlp terminó sin generar archivo de salida.",
      "no_output",
      ""
    );
  }
  const filePath = path.join(outputDir, match);
  await access(filePath, fsConstants.R_OK);
  const ext = path.extname(match).replace(/^\./, "");
  return { filePath, ext };
}

export async function isYtDlpAvailable(): Promise<boolean> {
  try {
    await runYtDlp(["--version"]);
    return true;
  } catch {
    return false;
  }
}

function heightToQuality(height: number): VideoQuality | null {
  if (height >= 2160) return "2160p";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  if (height >= 360) return "360p";
  return null;
}

const QUALITY_ORDER: VideoQuality[] = [
  "360p",
  "480p",
  "720p",
  "1080p",
  "1440p",
  "2160p",
];

interface YtDlpFormat {
  height?: number | null;
  vcodec?: string | null;
}

export async function probeAvailableQualities(
  url: string,
  signal?: AbortSignal
): Promise<VideoQuality[] | null> {
  let stdout: string;
  try {
    const result = await runYtDlp(
      ["-J", "--no-warnings", "--no-playlist", "--skip-download", url],
      { signal }
    );
    stdout = result.stdout;
  } catch {
    return null;
  }
  let parsed: { formats?: unknown };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }
  const formats = Array.isArray(parsed.formats) ? parsed.formats : [];
  const buckets = new Set<VideoQuality>();
  for (const fmt of formats as YtDlpFormat[]) {
    if (!fmt || typeof fmt.height !== "number") continue;
    if (fmt.vcodec === "none") continue;
    const bucket = heightToQuality(fmt.height);
    if (bucket) buckets.add(bucket);
  }
  if (buckets.size === 0) return null;
  return QUALITY_ORDER.filter((q) => buckets.has(q));
}
