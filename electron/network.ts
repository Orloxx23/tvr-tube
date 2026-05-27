import { session } from "electron";

const REFERER_BY_HOST: Array<{ match: RegExp; referer: string; origin?: string }> = [
  {
    match: /(?:^|\.)cdninstagram\.com$|(?:^|\.)fbcdn\.net$/i,
    referer: "https://www.instagram.com/",
    origin: "https://www.instagram.com",
  },
  {
    match: /(?:^|\.)threads\.net$/i,
    referer: "https://www.threads.net/",
    origin: "https://www.threads.net",
  },
  {
    match: /(?:^|\.)facebook\.com$/i,
    referer: "https://www.facebook.com/",
    origin: "https://www.facebook.com",
  },
  {
    match: /(?:^|\.)tiktokcdn\.com$|(?:^|\.)tiktok\.com$|(?:^|\.)muscdn\.com$/i,
    referer: "https://www.tiktok.com/",
    origin: "https://www.tiktok.com",
  },
  {
    match: /(?:^|\.)pinimg\.com$|(?:^|\.)pinterest\.com$/i,
    referer: "https://www.pinterest.com/",
    origin: "https://www.pinterest.com",
  },
  {
    match: /(?:^|\.)redditmedia\.com$|(?:^|\.)redd\.it$/i,
    referer: "https://www.reddit.com/",
    origin: "https://www.reddit.com",
  },
];

function pickReferer(host: string): { referer: string; origin: string } | null {
  for (const rule of REFERER_BY_HOST) {
    if (rule.match.test(host)) {
      return { referer: rule.referer, origin: rule.origin ?? rule.referer };
    }
  }
  return null;
}

export function installThumbnailRefererFix(): void {
  const ses = session.defaultSession;
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    let host: string;
    try {
      host = new URL(details.url).host;
    } catch {
      callback({ requestHeaders: details.requestHeaders });
      return;
    }
    const override = pickReferer(host);
    if (!override) {
      callback({ requestHeaders: details.requestHeaders });
      return;
    }
    const headers = { ...details.requestHeaders };
    headers["Referer"] = override.referer;
    headers["Origin"] = override.origin;
    callback({ requestHeaders: headers });
  });
}
