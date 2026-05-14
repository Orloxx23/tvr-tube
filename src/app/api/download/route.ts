import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { canonicalUrl, extractVideoId } from "@/lib/youtube";
import {
  downloadAudio,
  downloadVideo,
  YtDlpError,
  type YtDlpPhase,
} from "@/lib/ytdlp";
import { getPresignedDownloadUrl, isR2Configured, uploadFile } from "@/lib/r2";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

const videoSchema = z.object({
  mode: z.literal("video"),
  url: z.string().min(1, "URL requerida"),
  quality: z.enum(["360p", "480p", "720p", "1080p", "1440p", "2160p"]),
  title: z.string().max(500).optional(),
});

const audioSchema = z.object({
  mode: z.literal("audio"),
  url: z.string().min(1, "URL requerida"),
  audioFormat: z.enum(["mp3", "m4a"]),
  audioBitrate: z.enum(["128", "192", "256", "320"]),
  title: z.string().max(500).optional(),
});

const bodySchema = z.discriminatedUnion("mode", [videoSchema, audioSchema]);

const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  opus: "audio/ogg",
};

export type ProgressPhase = YtDlpPhase | "probing" | "uploading";

export type StreamEvent =
  | { type: "phase"; phase: ProgressPhase }
  | { type: "progress"; phase: ProgressPhase; percent: number }
  | {
      type: "completed";
      downloadUrl: string;
      fileName: string;
      sizeBytes: number;
      expiresAt: number;
      contentType: string;
    }
  | { type: "failed"; message: string; code: string };

function jsonError(message: string, status: number, code: string, extra?: Record<string, unknown>) {
  return Response.json(
    { error: { message, code, ...extra } },
    { status, headers: extra?.retryAfterSeconds ? { "Retry-After": String(extra.retryAfterSeconds) } : undefined }
  );
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

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`download:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return jsonError(
      `Demasiadas descargas. Reintentá en ${rl.retryAfterSeconds}s.`,
      429,
      "rate_limited",
      { retryAfterSeconds: rl.retryAfterSeconds }
    );
  }

  if (!isR2Configured()) {
    return jsonError(
      "Cloudflare R2 no está configurado. Definí R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET en .env.",
      503,
      "r2_not_configured"
    );
  }

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Body inválido.",
      400,
      "bad_request"
    );
  }
  const body = parsed.data;

  const videoId = extractVideoId(body.url);
  if (!videoId) {
    return jsonError(
      "El enlace no es un video válido de YouTube.",
      400,
      "invalid_url"
    );
  }
  const canonical = canonicalUrl(videoId);

  const slug = sanitizeForFilename(body.title ?? videoId);
  const outputBase = `${videoId}-${randomUUID().slice(0, 8)}`;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "snatch-"));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (event: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      try {
        send({ type: "phase", phase: "probing" });

        const produced =
          body.mode === "video"
            ? await downloadVideo({
                url: canonical,
                outputDir: tempDir,
                outputBase,
                quality: body.quality,
                signal: request.signal,
                onProgress: (e) =>
                  send({
                    type: "progress",
                    phase: e.phase,
                    percent: e.percent ?? 0,
                  }),
              })
            : await downloadAudio({
                url: canonical,
                outputDir: tempDir,
                outputBase,
                format: body.audioFormat,
                bitrate: body.audioBitrate,
                signal: request.signal,
                onProgress: (e) =>
                  send({
                    type: "progress",
                    phase: e.phase,
                    percent: e.percent ?? 0,
                  }),
              });

        const ext = produced.ext.toLowerCase();
        const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
        const downloadFileName = `${slug}.${ext}`;
        const objectKey = `downloads/${videoId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

        send({ type: "phase", phase: "uploading" });
        const upload = await uploadFile({
          filePath: produced.filePath,
          key: objectKey,
          contentType,
          downloadFileName,
          signal: request.signal,
          onProgress: (pct) =>
            send({ type: "progress", phase: "uploading", percent: pct }),
        });

        const presigned = await getPresignedDownloadUrl(objectKey);

        send({
          type: "completed",
          downloadUrl: presigned.url,
          fileName: downloadFileName,
          sizeBytes: upload.sizeBytes,
          expiresAt: presigned.expiresAt,
          contentType,
        });
      } catch (err) {
        if (err instanceof YtDlpError) {
          send({ type: "failed", message: err.message, code: err.code });
        } else if (request.signal.aborted) {
          send({
            type: "failed",
            message: "Descarga cancelada por el cliente.",
            code: "aborted",
          });
        } else {
          const message =
            err instanceof Error ? err.message : "Error desconocido";
          send({ type: "failed", message, code: "internal" });
        }
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {
          /* ignore cleanup error */
        });
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
