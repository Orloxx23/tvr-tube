import { app } from "electron";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const COOKIES_BROWSERS = [
  "none",
  "chrome",
  "edge",
  "firefox",
  "brave",
  "opera",
  "vivaldi",
  "chromium",
] as const;

export type CookiesBrowser = (typeof COOKIES_BROWSERS)[number];

export const SettingsSchema = z.object({
  downloadsDir: z.string().min(1),
  cookiesBrowser: z.enum(COOKIES_BROWSERS).default("none"),
});

export type Settings = z.infer<typeof SettingsSchema>;

function defaults(): Settings {
  return {
    downloadsDir: path.join(app.getPath("downloads"), "TVR Tube"),
    cookiesBrowser: "none",
  };
}

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

let cached: Settings | null = null;
const listeners = new Set<(s: Settings) => void>();

export async function loadSettings(): Promise<Settings> {
  if (cached) return cached;
  const file = getSettingsPath();
  try {
    const raw = await readFile(file, "utf8");
    const parsed = SettingsSchema.safeParse(JSON.parse(raw));
    cached = parsed.success ? parsed.data : defaults();
  } catch {
    cached = defaults();
  }
  return cached;
}

export async function getSettings(): Promise<Settings> {
  return loadSettings();
}

export async function setSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings();
  const next = SettingsSchema.parse({ ...current, ...partial });
  await persist(next);
  cached = next;
  for (const fn of listeners) fn(next);
  return next;
}

export async function resetSettings(): Promise<Settings> {
  const next = defaults();
  await persist(next);
  cached = next;
  for (const fn of listeners) fn(next);
  return next;
}

export function onSettingsChange(handler: (s: Settings) => void): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

async function persist(settings: Settings): Promise<void> {
  const file = getSettingsPath();
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(settings, null, 2), "utf8");
  await rename(tmp, file);
}
