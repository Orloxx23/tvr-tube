import "server-only";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

let cachedClient: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET
  );
}

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY
  ) {
    throw new Error("R2 no está configurado: faltan variables de entorno.");
  }
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return cachedClient;
}

export interface UploadFileInput {
  filePath: string;
  key: string;
  contentType: string;
  downloadFileName: string;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

export interface UploadFileResult {
  key: string;
  sizeBytes: number;
}

export async function uploadFile({
  filePath,
  key,
  contentType,
  downloadFileName,
  signal,
  onProgress,
}: UploadFileInput): Promise<UploadFileResult> {
  const client = getClient();
  const bucket = env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET no configurado.");

  const stats = await stat(filePath);
  const body = createReadStream(filePath);

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentDisposition: `attachment; filename="${encodeRFC5987(
        downloadFileName
      )}"`,
    },
    queueSize: 4,
    partSize: 8 * 1024 * 1024,
    leavePartsOnError: false,
  });

  let lastEmitted = -1;
  upload.on("httpUploadProgress", (progress) => {
    if (!onProgress) return;
    const loaded = progress.loaded ?? 0;
    const total = progress.total ?? stats.size;
    if (total <= 0) return;
    const pct = Math.floor((loaded / total) * 100);
    if (pct !== lastEmitted) {
      lastEmitted = pct;
      onProgress(pct);
    }
  });

  if (signal) {
    const onAbort = () => upload.abort();
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  await upload.done();
  return { key, sizeBytes: stats.size };
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = env.SIGNED_URL_EXPIRES_SECONDS
): Promise<{ url: string; expiresAt: number }> {
  const client = getClient();
  const bucket = env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET no configurado.");

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn }
  );

  return { url, expiresAt: Date.now() + expiresIn * 1000 };
}

function encodeRFC5987(value: string): string {
  return encodeURIComponent(value)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A")
    .replace(/%(?:7C|60|5E)/g, decodeURIComponent);
}
