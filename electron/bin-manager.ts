import { app, net } from "electron";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { chmod, mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

export type BinariesStatus =
  | { state: "checking" }
  | {
      state: "downloading";
      bin: "yt-dlp";
      percent: number;
      receivedBytes: number;
      totalBytes: number | null;
    }
  | { state: "verifying"; bin: "yt-dlp" }
  | { state: "ready"; ytdlpPath: string; ffmpegPath: string }
  | { state: "error"; message: string };

const YTDLP_FILENAMES: Record<NodeJS.Platform, string | null> = {
  win32: "yt-dlp.exe",
  darwin: "yt-dlp_macos",
  linux: "yt-dlp_linux",
  aix: null,
  android: null,
  freebsd: null,
  haiku: null,
  openbsd: null,
  sunos: null,
  cygwin: null,
  netbsd: null,
};

const YTDLP_RELEASE_BASE =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
const YTDLP_SUMS_URL = `${YTDLP_RELEASE_BASE}/SHA2-256SUMS`;

export function getBinDir(): string {
  return path.join(app.getPath("userData"), "bin");
}

export function getYtDlpPath(): string {
  const filename = YTDLP_FILENAMES[process.platform];
  return path.join(getBinDir(), filename ?? "yt-dlp");
}

export function getFfmpegPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: string | null = require("ffmpeg-static");
  if (!raw) {
    throw new Error("ffmpeg-static no devolvió path. ¿Plataforma soportada?");
  }
  return raw.replace("app.asar", "app.asar.unpacked");
}

async function fileSizeOrZero(p: string): Promise<number> {
  try {
    const s = await stat(p);
    return s.size;
  } catch {
    return 0;
  }
}

async function runVersionCheck(binaryPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(binaryPath, ["--version"], { windowsHide: true });
    let ok = false;
    child.stdout.on("data", () => {
      ok = true;
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(ok && code === 0));
  });
}

const YTDLP_SELF_UPDATE_TIMEOUT_MS = 180_000;

// Los extractores de Instagram/X/Facebook se rompen con frecuencia; un binario
// de meses atrás falla aunque siga respondiendo a --version. Best-effort: si no
// hay red o el update falla, seguimos con el binario actual.
function selfUpdateYtDlp(binaryPath: string): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(binaryPath, ["-U"], { windowsHide: true });
    const timer = setTimeout(() => child.kill(), YTDLP_SELF_UPDATE_TIMEOUT_MS);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    child.on("error", finish);
    child.on("close", finish);
  });
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, redirect: "follow" });
    let body = "";
    request.on("response", (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`HTTP ${response.statusCode} al pedir ${url}`));
        request.abort();
        return;
      }
      response.on("data", (chunk: Buffer) => {
        body += chunk.toString("utf8");
      });
      response.on("end", () => resolve(body));
      response.on("error", reject);
    });
    request.on("error", reject);
    request.end();
  });
}

function parseSumsFor(sums: string, filename: string): string | null {
  for (const line of sums.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
    if (!match) continue;
    if (match[2] === filename) return match[1].toLowerCase();
  }
  return null;
}

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex").toLowerCase()));
    stream.on("error", reject);
  });
}

function downloadToFile(
  url: string,
  destPath: string,
  onProgress: (received: number, total: number | null) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, redirect: "follow" });
    request.on("response", (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`HTTP ${response.statusCode} al descargar ${url}`));
        request.abort();
        return;
      }
      const totalHeader = response.headers["content-length"];
      const total =
        typeof totalHeader === "string"
          ? parseInt(totalHeader, 10)
          : Array.isArray(totalHeader)
            ? parseInt(totalHeader[0] ?? "0", 10)
            : null;
      const file = createWriteStream(destPath);
      let received = 0;

      response.on("data", (chunk: Buffer) => {
        received += chunk.length;
        file.write(chunk);
        onProgress(received, total ?? null);
      });
      response.on("end", () => {
        file.end(() => resolve());
      });
      response.on("error", (err) => {
        file.destroy();
        reject(err);
      });
    });
    request.on("error", reject);
    request.end();
  });
}

export interface EnsureBinariesOptions {
  onStatus: (status: BinariesStatus) => void;
}

export async function ensureBinaries({
  onStatus,
}: EnsureBinariesOptions): Promise<{
  ytdlpPath: string;
  ffmpegPath: string;
}> {
  onStatus({ state: "checking" });

  const binDir = getBinDir();
  await mkdir(binDir, { recursive: true });

  const ytdlpPath = getYtDlpPath();
  const ffmpegPath = getFfmpegPath();

  if (!existsSync(ffmpegPath)) {
    throw new Error(
      `No se encontró ffmpeg empaquetado en ${ffmpegPath}. ¿Falló el unpack de ffmpeg-static?`
    );
  }

  const ytdlpFilename = YTDLP_FILENAMES[process.platform];
  if (!ytdlpFilename) {
    throw new Error(
      `yt-dlp no tiene build oficial para esta plataforma (${process.platform}).`
    );
  }
  const ytdlpUrl = `${YTDLP_RELEASE_BASE}/${ytdlpFilename}`;

  const ytdlpSize = await fileSizeOrZero(ytdlpPath);
  if (ytdlpSize > 1_000_000) {
    onStatus({ state: "verifying", bin: "yt-dlp" });
    if (await runVersionCheck(ytdlpPath)) {
      await selfUpdateYtDlp(ytdlpPath);
      if (await runVersionCheck(ytdlpPath)) {
        onStatus({ state: "ready", ytdlpPath, ffmpegPath });
        return { ytdlpPath, ffmpegPath };
      }
    }
    await unlink(ytdlpPath).catch(() => undefined);
  }

  const tmpPath = `${ytdlpPath}.downloading`;
  await unlink(tmpPath).catch(() => undefined);

  await downloadToFile(ytdlpUrl, tmpPath, (received, total) => {
    onStatus({
      state: "downloading",
      bin: "yt-dlp",
      percent: total ? Math.floor((received / total) * 100) : 0,
      receivedBytes: received,
      totalBytes: total,
    });
  });

  onStatus({ state: "verifying", bin: "yt-dlp" });

  // Verificación SHA-256 contra el manifiesto oficial de yt-dlp.
  let expectedHash: string | null = null;
  try {
    const sums = await fetchText(YTDLP_SUMS_URL);
    expectedHash = parseSumsFor(sums, ytdlpFilename);
  } catch {
    expectedHash = null;
  }

  if (expectedHash) {
    const actualHash = await hashFile(tmpPath);
    if (actualHash !== expectedHash) {
      await unlink(tmpPath).catch(() => undefined);
      throw new Error(
        `Checksum SHA-256 de yt-dlp no coincide (esperado ${expectedHash.slice(0, 12)}…, obtenido ${actualHash.slice(0, 12)}…).`
      );
    }
  }

  if (process.platform !== "win32") {
    await chmod(tmpPath, 0o755);
  }
  await rename(tmpPath, ytdlpPath);

  if (!(await runVersionCheck(ytdlpPath))) {
    throw new Error(
      "yt-dlp se descargó pero no pasa el check de versión. Probá borrar la carpeta y reintentar."
    );
  }

  onStatus({ state: "ready", ytdlpPath, ffmpegPath });
  return { ytdlpPath, ffmpegPath };
}
