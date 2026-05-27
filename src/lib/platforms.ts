export type Platform =
  | "youtube"
  | "instagram"
  | "tiktok"
  | "threads"
  | "facebook"
  | "pinterest"
  | "twitter"
  | "reddit"
  | "vimeo"
  | "dailymotion"
  | "twitch"
  | "generic";

export interface PlatformInfo {
  id: Platform;
  label: string;
  hosts: ReadonlyArray<string | RegExp>;
}

export const PLATFORMS: ReadonlyArray<PlatformInfo> = [
  {
    id: "youtube",
    label: "YouTube",
    hosts: ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"],
  },
  {
    id: "instagram",
    label: "Instagram",
    hosts: ["instagram.com", "www.instagram.com", "m.instagram.com"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    hosts: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "m.tiktok.com"],
  },
  {
    id: "threads",
    label: "Threads",
    hosts: ["threads.net", "www.threads.net", "threads.com", "www.threads.com"],
  },
  {
    id: "facebook",
    label: "Facebook",
    hosts: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.watch", "fb.com"],
  },
  {
    id: "pinterest",
    label: "Pinterest",
    hosts: [/(^|\.)pinterest\.[a-z.]+$/i, "pin.it"],
  },
  {
    id: "twitter",
    label: "X / Twitter",
    hosts: ["twitter.com", "www.twitter.com", "x.com", "www.x.com", "mobile.twitter.com"],
  },
  {
    id: "reddit",
    label: "Reddit",
    hosts: ["reddit.com", "www.reddit.com", "old.reddit.com", "v.redd.it"],
  },
  {
    id: "vimeo",
    label: "Vimeo",
    hosts: ["vimeo.com", "www.vimeo.com", "player.vimeo.com"],
  },
  {
    id: "dailymotion",
    label: "Dailymotion",
    hosts: ["dailymotion.com", "www.dailymotion.com", "dai.ly"],
  },
  {
    id: "twitch",
    label: "Twitch",
    hosts: ["twitch.tv", "www.twitch.tv", "clips.twitch.tv"],
  },
];

export function detectPlatform(input: string): Platform {
  const trimmed = input.trim();
  if (!trimmed) return "generic";
  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return "generic";
  }
  const host = url.hostname.toLowerCase();
  for (const platform of PLATFORMS) {
    for (const matcher of platform.hosts) {
      if (typeof matcher === "string") {
        if (host === matcher) return platform.id;
      } else if (matcher.test(host)) {
        return platform.id;
      }
    }
  }
  return "generic";
}

export function getPlatformLabel(platform: Platform): string {
  if (platform === "generic") return "Otro sitio";
  return PLATFORMS.find((p) => p.id === platform)?.label ?? "Otro sitio";
}

export function isProbablyValidUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
