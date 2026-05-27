"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ExternalLink, Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatformLabel } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import type { VideoMetadata } from "@/types/video";

interface VideoPreviewProps {
  metadata?: VideoMetadata;
  loading?: boolean;
}

export function VideoPreview({ metadata, loading }: VideoPreviewProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start" aria-busy="true">
        <Skeleton className="aspect-video w-full shrink-0 sm:w-64 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    );
  }

  if (!metadata) return null;

  const platformLabel = getPlatformLabel(metadata.platform);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4 sm:flex-row sm:items-start"
    >
      <a
        href={metadata.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative aspect-video w-full shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2 sm:w-64 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Abrir "${metadata.title}" en ${platformLabel}`}
      >
        <Image
          src={metadata.thumbnailUrl}
          alt=""
          fill
          sizes="(min-width: 640px) 256px, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          unoptimized
        />
        <div className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/95 text-black shadow-lg">
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
          </span>
        </div>
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <PlatformChip platform={metadata.platform} label={platformLabel} />
        <h2 className="text-base font-semibold leading-snug tracking-tight text-balance sm:text-lg">
          {metadata.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {metadata.authorUrl ? (
            <a
              href={metadata.authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              {metadata.author}
              <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />
            </a>
          ) : (
            metadata.author
          )}
        </p>
      </div>
    </motion.div>
  );
}

function PlatformChip({
  platform,
  label,
}: {
  platform: VideoMetadata["platform"];
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
      )}
    >
      <PlatformIcon platform={platform} size={12} />
      {label}
    </span>
  );
}
