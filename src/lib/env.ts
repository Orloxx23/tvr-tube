import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
  YT_DLP_PATH: z.string().min(1).optional(),
  YT_DLP_COOKIES_PATH: z.string().min(1).optional(),
  YT_DLP_EXTRACTOR_ARGS: z.string().min(1).optional(),
  FFMPEG_PATH: z.string().min(1).optional(),
  REDIS_URL: z.string().url().optional(),
  RATE_LIMIT_REDIS_URL: z.string().url().optional(),
  SIGNED_URL_EXPIRES_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("TVR Tube"),
});

const blankToUndefined = (v: string | undefined) =>
  v && v.length > 0 ? v : undefined;

const parsedServer = serverSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  R2_ACCOUNT_ID: blankToUndefined(process.env.R2_ACCOUNT_ID),
  R2_ACCESS_KEY_ID: blankToUndefined(process.env.R2_ACCESS_KEY_ID),
  R2_SECRET_ACCESS_KEY: blankToUndefined(process.env.R2_SECRET_ACCESS_KEY),
  R2_BUCKET: blankToUndefined(process.env.R2_BUCKET),
  R2_PUBLIC_URL: blankToUndefined(process.env.R2_PUBLIC_URL),
  YT_DLP_PATH: blankToUndefined(process.env.YT_DLP_PATH),
  YT_DLP_COOKIES_PATH: blankToUndefined(process.env.YT_DLP_COOKIES_PATH),
  YT_DLP_EXTRACTOR_ARGS: blankToUndefined(process.env.YT_DLP_EXTRACTOR_ARGS),
  FFMPEG_PATH: blankToUndefined(process.env.FFMPEG_PATH),
  REDIS_URL: blankToUndefined(process.env.REDIS_URL),
  RATE_LIMIT_REDIS_URL: blankToUndefined(process.env.RATE_LIMIT_REDIS_URL),
  SIGNED_URL_EXPIRES_SECONDS: process.env.SIGNED_URL_EXPIRES_SECONDS,
});

if (!parsedServer.success) {
  console.error("Invalid server env:", parsedServer.error.flatten().fieldErrors);
  throw new Error("Invalid server environment variables");
}

const parsedClient = clientSchema.safeParse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});

if (!parsedClient.success) {
  console.error("Invalid client env:", parsedClient.error.flatten().fieldErrors);
  throw new Error("Invalid client environment variables");
}

export const env = {
  ...parsedServer.data,
  ...parsedClient.data,
} as const;

export type Env = typeof env;
