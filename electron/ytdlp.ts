import { spawn } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";

export type VideoQuality =
  | "360p"
  | "480p"
  | "720p"
  | "1080p"
  | "1440p"
  | "2160p";
export type AudioBitrate = "128" | "192" | "256" | "320";
export type AudioFormat = "mp3" | "m4a";

const QUALITY_TO_HEIGHT: Record<VideoQuality, number> = {
  "360p": 360,
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
  "1440p": 1440,
  "2160p": 2160,
};

const QUALITY_ORDER: VideoQuality[] = [
  "360p",
  "480p",
  "720p",
  "1080p",
  "1440p",
  "2160p",
];

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

export interface YtDlpConfig {
  ytdlpPath: string;
  ffmpegPath: string;
  cookiesPath?: string;
  extractorArgs?: string;
}

export type YtDlpPhase =
  | "downloading-video"
  | "downloading-audio"
  | "merging";

export interface YtDlpProgressEvent {
  phase: YtDlpPhase;
  percent?: number;
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

function classifyError(stderr: string): { code: string; message: string } {
  if (/Sign in to confirm|confirm you.?re not a bot/i.test(stderr)) {
    return {
      code: "youtube_bot_check",
      message:
        "YouTube exige autenticación desde esta IP. Configurá un cookies.txt en Ajustes.",
    };
  }
  if (/login required|requires (?:a )?login|empty media response|Restricted Video/i.test(stderr)) {
    return {
      code: "login_required",
      message:
        "El contenido requiere iniciar sesión. Exportá las cookies de tu navegador (cookies.txt) y configuralas en Ajustes.",
    };
  }
  if (/Private video|This video is private/i.test(stderr)) {
    return { code: "private", message: "Este video es privado." };
  }
  if (/Video unavailable|This video has been removed/i.test(stderr)) {
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
  if (/HTTP Error 429|Too Many Requests|rate.?limit/i.test(stderr)) {
    return {
      code: "rate_limit",
      message: "El sitio limitó las descargas desde esta IP. Esperá unos minutos.",
    };
  }
  if (/Unsupported URL|ERROR: Unsupported/i.test(stderr)) {
    return {
      code: "unsupported_url",
      message: "Esta URL no es soportada por yt-dlp.",
    };
  }
  if (/No video formats found|Requested format is not available/i.test(stderr)) {
    return {
      code: "no_formats",
      message:
        "No se encontró un formato descargable. El contenido puede ser sólo imagen o estar protegido.",
    };
  }
  return {
    code: "non_zero_exit",
    message: `yt-dlp terminó con error: ${extractLastErrorLine(stderr)}`,
  };
}

function extractLastErrorLine(stderr: string): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const errLine = [...lines].reverse().find((l) => /ERROR/i.test(l));
  return errLine ?? lines[lines.length - 1] ?? "error desconocido";
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

export interface DownloadAudioInput {
  url: string;
  outputDir: string;
  outputBase: string;
  format: AudioFormat;
  bitrate: AudioBitrate;
  signal?: AbortSignal;
  onProgress?: (e: YtDlpProgressEvent) => void;
}

interface YtDlpFormat {
  height?: number | null;
  vcodec?: string | null;
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

export function createYtDlp(config: YtDlpConfig) {
  const commonArgs: string[] = [];
  if (config.cookiesPath) commonArgs.push("--cookies", config.cookiesPath);
  if (config.extractorArgs)
    commonArgs.push("--extractor-args", config.extractorArgs);

  function runYtDlp(
    args: string[],
    options?: RunOptions
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const fullArgs = [
        "--ffmpeg-location",
        config.ffmpegPath,
        ...commonArgs,
        ...args,
      ];
      const signal = options?.signal;

      const child = spawn(config.ytdlpPath, fullArgs, {
        windowsHide: true,
        shell: false,
      });

      let stdout = "";
      let stderr = "";
      const splitStdout = options?.onLine
        ? makeLineSplitter(options.onLine)
        : null;
      const splitStderr = options?.onLine
        ? makeLineSplitter(options.onLine)
        : null;

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        splitStdout?.(text);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        splitStderr?.(text);
      });

      const onAbort = () => child.kill("SIGTERM");
      signal?.addEventListener("abort", onAbort, { once: true });

      child.on("error", (err) => {
        signal?.removeEventListener("abort", onAbort);
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          reject(
            new YtDlpError(
              `No se encontró el binario yt-dlp en ${config.ytdlpPath}.`,
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

  async function downloadVideo({
    url,
    outputDir,
    outputBase,
    quality,
    signal,
    onProgress,
  }: DownloadVideoInput): Promise<{ filePath: string; ext: string }> {
    const height = QUALITY_TO_HEIGHT[quality];
    const outputTemplate = path.join(outputDir, `${outputBase}.%(ext)s`);
    // Selector con fallback: primero intenta separar video+audio (YouTube/Vimeo),
    // luego usa el mejor archivo único (TikTok/IG/Pinterest sirven MP4 ya mergeado),
    // y finalmente afloja la restricción de altura por si no hay nada que la cumpla.
    const formatSelector = [
      `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]`,
      `bestvideo[height<=${height}]+bestaudio`,
      `best[height<=${height}][ext=mp4]`,
      `best[height<=${height}]`,
      "best",
    ].join("/");
    const args = [
      "-f",
      formatSelector,
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

  async function downloadAudio({
    url,
    outputDir,
    outputBase,
    format,
    bitrate,
    signal,
    onProgress,
  }: DownloadAudioInput): Promise<{ filePath: string; ext: string }> {
    const outputTemplate = path.join(outputDir, `${outputBase}.%(ext)s`);
    // Fallback a `best` para plataformas que no exponen un stream de audio separado
    // (TikTok, IG, Pinterest); con `-x` yt-dlp extrae el audio del MP4 mergeado.
    const formatSelector =
      format === "m4a"
        ? "bestaudio[ext=m4a]/bestaudio/best"
        : "bestaudio/best";
    const args = [
      "-f",
      formatSelector,
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

  async function probeAvailableQualities(
    url: string,
    signal?: AbortSignal
  ): Promise<VideoQuality[] | null> {
    const info = await fetchInfo(url, signal);
    return info?.availableQualities ?? null;
  }

  async function fetchInfo(
    url: string,
    signal?: AbortSignal
  ): Promise<YtDlpInfo | null> {
    // Deja propagar YtDlpError: el mensaje clasificado (cookies, privado,
    // rate-limit, etc.) tiene que llegar hasta la UI en lugar de un genérico.
    const { stdout } = await runYtDlp(
      ["-J", "--no-warnings", "--no-playlist", "--skip-download", url],
      { signal }
    );
    let parsed: YtDlpRawInfo;
    try {
      parsed = JSON.parse(stdout) as YtDlpRawInfo;
    } catch {
      return null;
    }

    // Algunas plataformas devuelven una "playlist" con un solo entry para posts
    // que contienen un único video (IG carruseles, Threads, Pinterest, etc.).
    const entry: YtDlpRawInfo =
      Array.isArray(parsed.entries) && parsed.entries.length > 0
        ? (parsed.entries[0] as YtDlpRawInfo)
        : parsed;

    const formats = Array.isArray(entry.formats) ? entry.formats : [];
    const buckets = new Set<VideoQuality>();
    for (const fmt of formats as YtDlpFormat[]) {
      if (!fmt || typeof fmt.height !== "number") continue;
      if (fmt.vcodec === "none") continue;
      const bucket = heightToQuality(fmt.height);
      if (bucket) buckets.add(bucket);
    }
    const availableQualities =
      buckets.size > 0 ? QUALITY_ORDER.filter((q) => buckets.has(q)) : null;

    return {
      id: typeof entry.id === "string" ? entry.id : null,
      title: pickTitle(entry),
      uploader: pickUploader(entry),
      uploaderUrl: typeof entry.uploader_url === "string" ? entry.uploader_url : null,
      thumbnail: pickThumbnail(entry),
      webpageUrl:
        typeof entry.webpage_url === "string" ? entry.webpage_url : null,
      durationSeconds: typeof entry.duration === "number" ? entry.duration : null,
      availableQualities,
    };
  }

  return { downloadVideo, downloadAudio, probeAvailableQualities, fetchInfo };
}

interface YtDlpRawInfo {
  id?: unknown;
  title?: unknown;
  fulltitle?: unknown;
  description?: unknown;
  uploader?: unknown;
  uploader_id?: unknown;
  uploader_url?: unknown;
  channel?: unknown;
  creator?: unknown;
  thumbnail?: unknown;
  thumbnails?: unknown;
  webpage_url?: unknown;
  duration?: unknown;
  formats?: unknown;
  entries?: unknown;
}

export interface YtDlpInfo {
  id: string | null;
  title: string;
  uploader: string;
  uploaderUrl: string | null;
  thumbnail: string | null;
  webpageUrl: string | null;
  durationSeconds: number | null;
  availableQualities: VideoQuality[] | null;
}

function pickTitle(entry: YtDlpRawInfo): string {
  for (const key of ["title", "fulltitle"] as const) {
    const v = entry[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const desc = entry.description;
  if (typeof desc === "string" && desc.trim()) {
    return desc.trim().split(/\r?\n/)[0]!.slice(0, 120);
  }
  return "Video";
}

function pickUploader(entry: YtDlpRawInfo): string {
  for (const key of ["uploader", "channel", "creator", "uploader_id"] as const) {
    const v = entry[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "Autor desconocido";
}

function pickThumbnail(entry: YtDlpRawInfo): string | null {
  if (typeof entry.thumbnail === "string" && entry.thumbnail.trim()) {
    return entry.thumbnail;
  }
  if (Array.isArray(entry.thumbnails)) {
    const thumbs = entry.thumbnails as Array<{ url?: unknown; width?: unknown }>;
    let best: { url: string; width: number } | null = null;
    for (const t of thumbs) {
      if (typeof t?.url !== "string") continue;
      const w = typeof t.width === "number" ? t.width : 0;
      if (!best || w > best.width) best = { url: t.url, width: w };
    }
    if (best) return best.url;
  }
  return null;
}

export type YtDlpRunner = ReturnType<typeof createYtDlp>;
