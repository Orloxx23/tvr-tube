const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (ID_REGEX.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return ID_REGEX.test(id) ? id : null;
  }

  if (url.pathname === "/watch") {
    const v = url.searchParams.get("v");
    return v && ID_REGEX.test(v) ? v : null;
  }

  const shortsMatch = url.pathname.match(/^\/(shorts|embed|v|live)\/([A-Za-z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[2];

  return null;
}

export function canonicalUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function thumbnailUrl(id: string, quality: "default" | "hq" | "max" = "max"): string {
  const map = {
    default: "default",
    hq: "hqdefault",
    max: "maxresdefault",
  } as const;
  return `https://i.ytimg.com/vi/${id}/${map[quality]}.jpg`;
}
