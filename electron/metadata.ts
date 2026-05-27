import type { YtDlpRunner, VideoQuality } from "./ytdlp";
import { detectPlatform, normalizeUrl, type Platform } from "./platforms";

export class MetadataError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "MetadataError";
    this.code = code;
    this.status = status;
  }
}

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

const PLATFORM_PROVIDER_URL: Record<Platform, string> = {
  youtube: "https://www.youtube.com",
  instagram: "https://www.instagram.com",
  tiktok: "https://www.tiktok.com",
  threads: "https://www.threads.net",
  facebook: "https://www.facebook.com",
  pinterest: "https://www.pinterest.com",
  twitter: "https://x.com",
  reddit: "https://www.reddit.com",
  vimeo: "https://vimeo.com",
  dailymotion: "https://www.dailymotion.com",
  twitch: "https://www.twitch.tv",
  generic: "",
};

function isValidHttpUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function fallbackThumbnail(platform: Platform, id: string | null): string {
  if (platform === "youtube" && id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
    return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  }
  // SVG placeholder transparente — la UI ya tiene fondo neutral.
  return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'/>";
}

export async function fetchVideoMetadata(
  rawUrl: string,
  runner: YtDlpRunner,
  signal?: AbortSignal
): Promise<VideoMetadata> {
  const normalized = normalizeUrl(rawUrl);
  if (!isValidHttpUrl(normalized)) {
    throw new MetadataError(
      "El enlace no parece una URL válida.",
      "invalid_url",
      400
    );
  }

  const platform = detectPlatform(normalized);
  const info = await runner.fetchInfo(normalized, signal);

  if (!info) {
    throw new MetadataError(
      platform === "generic"
        ? "No se pudo extraer información de esta URL. Puede no ser soportada o requerir cookies."
        : "No se pudo extraer información del video. Puede ser privado, requerir login o estar caído.",
      "fetch_failed",
      502
    );
  }

  const sourceUrl = info.webpageUrl ?? normalized;
  const idCandidate = info.id ?? sourceUrl;

  return {
    id: idCandidate,
    sourceUrl,
    platform,
    title: info.title,
    author: info.uploader,
    authorUrl: info.uploaderUrl ?? undefined,
    thumbnailUrl: info.thumbnail ?? fallbackThumbnail(platform, info.id),
    durationSeconds: info.durationSeconds ?? undefined,
    providerUrl: PLATFORM_PROVIDER_URL[platform] || sourceUrl,
    ...(info.availableQualities
      ? { availableQualities: info.availableQualities }
      : {}),
  };
}
