"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Download,
  Loader2,
  RefreshCcw,
  RocketIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatBytes, cn } from "@/lib/utils";
import type { UpdaterStatus } from "@/types/tvr-api";

const DISMISSED_KEY = "tvr:update-dismissed-version";

export function UpdateNotifier() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    const api = typeof window !== "undefined" ? window.tvr : undefined;
    if (!api) return;

    try {
      setDismissedVersion(window.localStorage.getItem(DISMISSED_KEY));
    } catch {
      setDismissedVersion(null);
    }

    void api.getUpdaterStatus().then(setStatus).catch(() => undefined);
    const unsubscribe = api.onUpdaterStatus(setStatus);
    return () => unsubscribe();
  }, []);

  const visibleStatus = useMemo<UpdaterStatus | null>(() => {
    if (!status) return null;
    if (
      dismissedVersion &&
      (status.state === "available" || status.state === "downloading") &&
      "version" in status &&
      status.version === dismissedVersion
    ) {
      return null;
    }
    if (
      status.state === "idle" ||
      status.state === "checking" ||
      status.state === "not-available"
    ) {
      return null;
    }
    return status;
  }, [status, dismissedVersion]);

  const onDismiss = () => {
    if (status && "version" in status) {
      try {
        window.localStorage.setItem(DISMISSED_KEY, status.version);
      } catch {
        // ignore
      }
      setDismissedVersion(status.version);
    } else {
      setStatus(null);
    }
  };

  const onInstall = () => {
    void window.tvr?.quitAndInstallUpdate();
  };

  const onRetry = () => {
    void window.tvr?.checkForUpdates();
  };

  return (
    <AnimatePresence>
      {visibleStatus ? (
        <motion.div
          key={visibleStatus.state}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={cn(
            "fixed bottom-4 right-4 z-40 w-[min(360px,calc(100vw-2rem))]",
            "rounded-xl border border-border/60 bg-background/95 backdrop-blur",
            "shadow-lg"
          )}
          role="status"
          aria-live="polite"
        >
          <UpdateBody
            status={visibleStatus}
            onDismiss={onDismiss}
            onInstall={onInstall}
            onRetry={onRetry}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function UpdateBody({
  status,
  onDismiss,
  onInstall,
  onRetry,
}: {
  status: UpdaterStatus;
  onDismiss: () => void;
  onInstall: () => void;
  onRetry: () => void;
}) {
  switch (status.state) {
    case "available":
      return (
        <Shell
          icon={<RocketIcon className="h-4 w-4 text-accent" aria-hidden="true" />}
          title={`Nueva versión disponible (${status.version})`}
          description="La descarga inicia automáticamente en segundo plano."
          onDismiss={onDismiss}
        />
      );
    case "downloading":
      return (
        <Shell
          icon={<Download className="h-4 w-4 text-accent" aria-hidden="true" />}
          title="Descargando actualización"
          description={`${formatBytes(status.transferred)} / ${formatBytes(
            status.total
          )} · ${formatBytes(status.bytesPerSecond)}/s`}
          onDismiss={onDismiss}
        >
          <ProgressBar percent={status.percent} />
        </Shell>
      );
    case "downloaded":
      return (
        <Shell
          icon={<RocketIcon className="h-4 w-4 text-accent" aria-hidden="true" />}
          title={`Listo para instalar ${status.version}`}
          description="Reiniciá la app para aplicar la actualización."
          onDismiss={onDismiss}
        >
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onInstall}>
              Reiniciar e instalar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
              Más tarde
            </Button>
          </div>
        </Shell>
      );
    case "error":
      return (
        <Shell
          icon={<X className="h-4 w-4 text-destructive" aria-hidden="true" />}
          title="No se pudo actualizar"
          description={status.message}
          onDismiss={onDismiss}
        >
          <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
        </Shell>
      );
    case "checking":
      return (
        <Shell
          icon={<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          title="Buscando actualizaciones"
          description="Consultando GitHub Releases…"
          onDismiss={onDismiss}
        />
      );
    default:
      return null;
  }
}

function Shell({
  icon,
  title,
  description,
  children,
  onDismiss,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5">{icon}</span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Descartar"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {children ? <div className="pl-7">{children}</div> : null}
    </div>
  );
}
