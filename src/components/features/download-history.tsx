"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, FolderOpen, Music2, Trash2, Video, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDownloadHistory } from "@/hooks/use-download-history";
import { formatRelativeTime } from "@/lib/utils";
import type { DownloadHistoryEntry } from "@/types/video";

function StatusBadge({ status }: { status: DownloadHistoryEntry["status"] }) {
  switch (status) {
    case "ready":
      return <Badge variant="success">Listo</Badge>;
    case "processing":
      return <Badge variant="default">Procesando</Badge>;
    case "pending":
      return <Badge variant="default">En cola</Badge>;
    case "failed":
      return <Badge variant="destructive">Fallida</Badge>;
  }
}

export function DownloadHistoryPanel() {
  const { entries, remove, clear } = useDownloadHistory();

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-surface-2/40 px-6 py-10 text-center">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-surface-1 text-muted-foreground">
          <Clock className="h-4 w-4" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-foreground">Aún no hay descargas</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tus últimas descargas aparecerán aquí, guardadas solo en este navegador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Descargas recientes</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
          Limpiar
        </Button>
      </div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <motion.li
              key={entry.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
              className="group flex items-center gap-3 rounded-xl border border-border/70 bg-surface-1 p-2.5"
            >
              <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-surface-2">
                <Image
                  src={entry.thumbnailUrl}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-sm font-medium">{entry.title}</p>
                <p className="truncate text-xs text-muted-foreground">{entry.author}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    {entry.options.mode === "video" ? (
                      <Video className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Music2 className="h-3 w-3" aria-hidden="true" />
                    )}
                    {entry.options.mode === "video"
                      ? entry.options.quality
                      : `${entry.options.audioFormat?.toUpperCase()} ${entry.options.audioBitrate}k`}
                  </span>
                  <span className="text-muted-foreground/70" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-muted-foreground">{formatRelativeTime(entry.createdAt)}</span>
                  <StatusBadge status={entry.status} />
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {entry.filePath && entry.status === "ready" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => window.tvr?.revealInFolder(entry.filePath!)}
                    aria-label="Mostrar en carpeta"
                  >
                    <FolderOpen className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(entry.id)}
                  aria-label="Quitar del historial"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
