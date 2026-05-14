import type { YtDlpRunner, VideoQuality } from "./ytdlp";

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

const YT_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

export function extractVideoId(input: string): string | null {
  const cleaned = input.trim();
  if (!cleaned) return null;
  if (YT_ID_REGEX.test(cleaned)) return cleaned;
  try {
    const url = new URL(cleaned);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return id && YT_ID_REGEX.test(id) ? id : null;
    }
    if (/(^|\.)youtube\.com$/i.test(url.hostname)) {
      const v = url.searchParams.get("v");
      if (v && YT_ID_REGEX.test(v)) return v;
      const segs = url.pathname.split("/").filter(Boolean);
      if (
        (segs[0] === "shorts" || segs[0] === "embed" || segs[0] === "live") &&
        segs[1] &&
        YT_ID_REGEX.test(segs[1])
      ) {
        return segs[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function canonicalUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

export interface VideoMetadata {
  id: string;
  title: string;
  author: string;
  authorUrl?: string;
  thumbnailUrl: string;
  providerUrl: string;
  availableQualities?: VideoQuality[];
}

interface OembedResponse {
  title: string;
  author_name: string;
  author_url?: string;
  thumbnail_url?: string;
  provider_url?: string;
}

function isOembedResponse(value: unknown): value is OembedResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.title === "string" && typeof v.author_name === "string";
}

export async function fetchVideoMetadata(
  rawUrl: string,
  runner: YtDlpRunner,
  signal?: AbortSignal
): Promise<VideoMetadata> {
  const videoId = extractVideoId(rawUrl);
  if (!videoId) {
    throw new MetadataError(
      "El enlace no es de YouTube o no contiene un ID de video válido.",
      "invalid_url",
      400
    );
  }

  const watchUrl = canonicalUrl(videoId);
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    watchUrl
  )}&format=json`;

  let res: Response;
  try {
    res = await fetch(oembedUrl, {
      cache: "no-store",
      signal: signal ?? AbortSignal.timeout(8000),
      headers: { "User-Agent": "TVR Tube/0.1" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    throw new MetadataError(
      `No se pudo contactar a YouTube (${msg}).`,
      "upstream_unreachable",
      502
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new MetadataError(
      "Video privado, restringido por edad, o no embebible.",
      "restricted",
      403
    );
  }
  if (res.status === 404 || res.status === 400) {
    throw new MetadataError(
      "El video no existe, fue eliminado o el ID es inválido.",
      "not_found",
      404
    );
  }
  if (!res.ok) {
    throw new MetadataError(
      `YouTube respondió con estado ${res.status}.`,
      "upstream_error",
      502
    );
  }

  const raw = await res.json().catch(() => null);
  if (!isOembedResponse(raw)) {
    throw new MetadataError(
      "Respuesta inesperada de YouTube.",
      "parse_error",
      502
    );
  }

  const availableQualities = await runner.probeAvailableQualities(
    watchUrl,
    signal
  );

  return {
    id: videoId,
    title: raw.title,
    author: raw.author_name,
    authorUrl: raw.author_url,
    thumbnailUrl: raw.thumbnail_url ?? thumbnailUrl(videoId),
    providerUrl: raw.provider_url ?? "https://www.youtube.com",
    ...(availableQualities ? { availableQualities } : {}),
  };
}
