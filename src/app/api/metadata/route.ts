import { z } from "zod";
import { extractVideoId, canonicalUrl, thumbnailUrl } from "@/lib/youtube";
import { probeAvailableQualities } from "@/lib/ytdlp";
import type { VideoMetadata } from "@/types/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  url: z.string().min(1, "URL requerida"),
});

const oembedSchema = z.object({
  title: z.string(),
  author_name: z.string(),
  author_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  provider_url: z.string().url().optional(),
});

function jsonError(message: string, status: number, code?: string) {
  return Response.json({ error: { message, code: code ?? "unknown" } }, { status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ url: searchParams.get("url") });
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Parámetros inválidos", 400, "bad_request");
  }

  const videoId = extractVideoId(parsed.data.url);
  if (!videoId) {
    return jsonError(
      "El enlace no es de YouTube o no contiene un ID de video válido.",
      400,
      "invalid_url"
    );
  }

  const watchUrl = canonicalUrl(videoId);
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

  let res: Response;
  try {
    res = await fetch(oembedUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "TVR Tube/0.1 (+metadata-preview)" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return jsonError(`No se pudo contactar a YouTube (${msg}).`, 502, "upstream_unreachable");
  }

  if (res.status === 401 || res.status === 403) {
    return jsonError(
      "Video privado, restringido por edad, o no embebible.",
      403,
      "restricted"
    );
  }
  if (res.status === 404 || res.status === 400) {
    return jsonError(
      "El video no existe, fue eliminado o el ID es inválido.",
      404,
      "not_found"
    );
  }
  if (!res.ok) {
    return jsonError(`YouTube respondió con estado ${res.status}.`, 502, "upstream_error");
  }

  const raw = await res.json().catch(() => null);
  const data = oembedSchema.safeParse(raw);
  if (!data.success) {
    return jsonError("Respuesta inesperada de YouTube.", 502, "parse_error");
  }

  const availableQualities = await probeAvailableQualities(
    watchUrl,
    request.signal
  );

  const metadata: VideoMetadata = {
    id: videoId,
    title: data.data.title,
    author: data.data.author_name,
    authorUrl: data.data.author_url,
    thumbnailUrl: data.data.thumbnail_url ?? thumbnailUrl(videoId, "max"),
    providerUrl: data.data.provider_url ?? "https://www.youtube.com",
    ...(availableQualities ? { availableQualities } : {}),
  };

  return Response.json({ metadata });
}
