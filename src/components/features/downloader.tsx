"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Link2,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VideoPreview } from "@/components/features/video-preview";
import { QualitySelector } from "@/components/features/quality-selector";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useDownloadHistory } from "@/hooks/use-download-history";
import { canonicalUrl, extractVideoId } from "@/lib/youtube";
import { formatBytes } from "@/lib/utils";
import {
  DEFAULT_AUDIO_BITRATE,
  DEFAULT_AUDIO_FORMAT,
  DEFAULT_QUALITY,
  type AudioBitrate,
  type AudioFormat,
  type DownloadMode,
  type VideoQuality,
} from "@/lib/constants";
import type { VideoMetadata } from "@/types/video";

const formSchema = z.object({
  url: z
    .string()
    .min(1, "Pegá un enlace de YouTube")
    .refine((v) => extractVideoId(v) !== null, {
      message: "El enlace no parece de YouTube o el ID es inválido",
    }),
});

type FormValues = z.infer<typeof formSchema>;

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; metadata: VideoMetadata }
  | { status: "error"; message: string };

type ProgressPhase =
  | "probing"
  | "downloading-video"
  | "downloading-audio"
  | "merging"
  | "uploading";

const PHASE_LABEL: Record<ProgressPhase, string> = {
  probing: "Analizando video",
  "downloading-video": "Descargando video",
  "downloading-audio": "Descargando audio",
  merging: "Combinando video y audio",
  uploading: "Subiendo al almacenamiento",
};

const INDETERMINATE_PHASES: ReadonlySet<ProgressPhase> = new Set([
  "probing",
  "merging",
]);

type StreamEvent =
  | { type: "phase"; phase: ProgressPhase }
  | { type: "progress"; phase: ProgressPhase; percent: number }
  | {
      type: "completed";
      downloadUrl: string;
      fileName: string;
      sizeBytes: number;
      expiresAt: number;
      contentType: string;
    }
  | { type: "failed"; message: string; code: string };

type DownloadState =
  | { status: "idle" }
  | { status: "running"; phase: ProgressPhase; percent: number }
  | {
      status: "success";
      downloadUrl: string;
      fileName: string;
      sizeBytes: number;
      expiresAt: number;
    }
  | { status: "failed"; message: string };

type DownloadPayload =
  | { mode: "video"; url: string; quality: VideoQuality; title?: string }
  | {
      mode: "audio";
      url: string;
      audioFormat: AudioFormat;
      audioBitrate: AudioBitrate;
      title?: string;
    };

function triggerBrowserDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function Downloader() {
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [download, setDownload] = useState<DownloadState>({ status: "idle" });
  const [mode, setMode] = useState<DownloadMode>("video");
  const [quality, setQuality] = useState<VideoQuality>(DEFAULT_QUALITY);
  const [audioBitrate, setAudioBitrate] = useState<AudioBitrate>(DEFAULT_AUDIO_BITRATE);
  const [audioFormat, setAudioFormat] = useState<AudioFormat>(DEFAULT_AUDIO_FORMAT);
  const { add, update } = useDownloadHistory();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: "" },
    mode: "onSubmit",
  });

  const fetchMetadata = useCallback(async (url: string) => {
    setState({ status: "loading" });
    setDownload({ status: "idle" });
    try {
      const res = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => null)) as
        | { metadata?: VideoMetadata; error?: { message: string } }
        | null;
      if (!res.ok || !payload?.metadata) {
        const message =
          payload?.error?.message ?? "No se pudo obtener la información del video.";
        setState({ status: "error", message });
        return;
      }
      setState({ status: "ready", metadata: payload.metadata });
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error
            ? `Error de red: ${err.message}`
            : "Error de red desconocido.",
      });
    }
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    await fetchMetadata(values.url.trim());
  });

  const onPasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error("El portapapeles está vacío.");
        return;
      }
      setValue("url", text.trim(), { shouldValidate: true });
      await fetchMetadata(text.trim());
    } catch {
      toast.error("No se pudo acceder al portapapeles.");
    }
  }, [fetchMetadata, setValue]);

  const onStartOver = useCallback(() => {
    setState({ status: "idle" });
    setDownload({ status: "idle" });
    reset({ url: "" });
    setMode("video");
    setQuality(DEFAULT_QUALITY);
    setAudioBitrate(DEFAULT_AUDIO_BITRATE);
    setAudioFormat(DEFAULT_AUDIO_FORMAT);
  }, [reset]);

  const onDownload = useCallback(async () => {
    if (state.status !== "ready") return;
    const m = state.metadata;
    const effectiveQuality =
      m.availableQualities && !m.availableQualities.includes(quality)
        ? m.availableQualities[m.availableQualities.length - 1] ?? quality
        : quality;
    const historyId = crypto.randomUUID();
    const options =
      mode === "video"
        ? ({ mode, quality: effectiveQuality } as const)
        : ({ mode, audioBitrate, audioFormat } as const);

    add({
      id: historyId,
      videoId: m.id,
      title: m.title,
      author: m.author,
      thumbnailUrl: m.thumbnailUrl,
      options,
      createdAt: Date.now(),
      status: "processing",
    });
    setDownload({ status: "running", phase: "probing", percent: 0 });

    const payload: DownloadPayload =
      mode === "video"
        ? {
            mode: "video",
            url: canonicalUrl(m.id),
            quality: effectiveQuality,
            title: m.title,
          }
        : {
            mode: "audio",
            url: canonicalUrl(m.id),
            audioFormat,
            audioBitrate,
            title: m.title,
          };

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok || !res.body) {
        const errPayload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        const message =
          errPayload?.error?.message ?? `Error HTTP ${res.status}.`;
        update(historyId, { status: "failed", errorMessage: message });
        setDownload({ status: "failed", message });
        toast.error("Error en la descarga", { description: message });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final:
        | Extract<StreamEvent, { type: "completed" }>
        | Extract<StreamEvent, { type: "failed" }>
        | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const dataLine = chunk
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          let event: StreamEvent;
          try {
            event = JSON.parse(dataLine.slice(6)) as StreamEvent;
          } catch {
            continue;
          }
          if (event.type === "phase") {
            setDownload({ status: "running", phase: event.phase, percent: 0 });
          } else if (event.type === "progress") {
            setDownload({
              status: "running",
              phase: event.phase,
              percent: event.percent,
            });
          } else if (event.type === "completed" || event.type === "failed") {
            final = event;
          }
        }
      }

      if (!final || final.type === "failed") {
        const message =
          final?.type === "failed"
            ? final.message
            : "La conexión se cerró antes de completar la descarga.";
        update(historyId, { status: "failed", errorMessage: message });
        setDownload({ status: "failed", message });
        toast.error("Error en la descarga", { description: message });
        return;
      }

      update(historyId, {
        status: "ready",
        downloadUrl: final.downloadUrl,
        expiresAt: final.expiresAt,
      });
      setDownload({
        status: "success",
        downloadUrl: final.downloadUrl,
        fileName: final.fileName,
        sizeBytes: final.sizeBytes,
        expiresAt: final.expiresAt,
      });
      triggerBrowserDownload(final.downloadUrl, final.fileName);
      toast.success("Descarga lista", { description: final.fileName });
    } catch (err) {
      const message =
        err instanceof Error ? `Error de red: ${err.message}` : "Error de red.";
      update(historyId, { status: "failed", errorMessage: message });
      setDownload({ status: "failed", message });
      toast.error("Error en la descarga", { description: message });
    }
  }, [add, audioBitrate, audioFormat, mode, quality, state, update]);

  const isLoading = state.status === "loading" || isSubmitting;
  const isReady = state.status === "ready";
  const isDownloading = download.status === "running";

  const availableQualities =
    state.status === "ready" ? state.metadata.availableQualities : undefined;
  const displayedQuality =
    availableQualities && !availableQualities.includes(quality)
      ? availableQualities[availableQualities.length - 1] ?? quality
      : quality;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <form onSubmit={onSubmit} noValidate className="space-y-2">
        <Label htmlFor="url" className="sr-only">
          Enlace de YouTube
        </Label>
        <div className="relative">
          <Link2
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="https://www.youtube.com/watch?v=..."
            aria-invalid={!!errors.url}
            aria-describedby={errors.url ? "url-error" : undefined}
            className="h-14 pl-11 pr-36 text-base sm:text-lg"
            disabled={isLoading || isDownloading}
            {...register("url")}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onPasteFromClipboard}
              disabled={isLoading || isDownloading}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Pegar
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-9"
              disabled={isLoading || isDownloading}
              aria-label="Buscar video"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <span className="hidden sm:inline">Buscar</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </div>
        {errors.url ? (
          <p id="url-error" role="alert" className="px-1 text-sm text-destructive">
            {errors.url.message}
          </p>
        ) : (
          <p className="px-1 text-xs text-muted-foreground">
            Soporta enlaces de <span className="font-mono">youtube.com</span>,{" "}
            <span className="font-mono">youtu.be</span> y Shorts.
          </p>
        )}
      </form>

      <AnimatePresence mode="popLayout">
        {state.status === "loading" ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card>
              <CardContent className="p-5">
                <VideoPreview loading />
              </CardContent>
            </Card>
          </motion.div>
        ) : null}

        {state.status === "error" ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/6 p-4"
          >
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-destructive/15">
              <X className="h-4 w-4 text-destructive" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">No pude analizar el video</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{state.message}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setState({ status: "idle" })}
            >
              Cerrar
            </Button>
          </motion.div>
        ) : null}

        {isReady ? (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            <Card>
              <CardContent className="p-5">
                <VideoPreview metadata={state.metadata} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-5 p-5">
                <QualitySelector
                  mode={mode}
                  quality={displayedQuality}
                  audioBitrate={audioBitrate}
                  audioFormat={audioFormat}
                  onModeChange={setMode}
                  onQualityChange={setQuality}
                  onAudioBitrateChange={setAudioBitrate}
                  onAudioFormatChange={setAudioFormat}
                  disabled={isDownloading}
                  availableQualities={availableQualities}
                />

                {download.status === "running" ? (
                  <ProgressBar
                    percent={download.percent}
                    label={PHASE_LABEL[download.phase]}
                    indeterminate={INDETERMINATE_PHASES.has(download.phase)}
                  />
                ) : null}

                {download.status === "success" ? (
                  <DownloadSuccessPanel
                    fileName={download.fileName}
                    sizeBytes={download.sizeBytes}
                    expiresAt={download.expiresAt}
                    downloadUrl={download.downloadUrl}
                  />
                ) : download.status === "failed" ? (
                  <DownloadErrorPanel
                    message={download.message}
                    onRetry={() => setDownload({ status: "idle" })}
                  />
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
                  <Button
                    type="button"
                    size="lg"
                    className="flex-1 sm:flex-none sm:min-w-48"
                    onClick={onDownload}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Procesando…
                      </>
                    ) : download.status === "success" ? (
                      <>
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Descargar de nuevo
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" aria-hidden="true" />
                        {mode === "video"
                          ? `Descargar ${displayedQuality}`
                          : `Descargar audio ${audioFormat.toUpperCase()}`}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={onStartOver}
                    disabled={isDownloading}
                    className="sm:mr-auto"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Otro video
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function DownloadSuccessPanel({
  fileName,
  sizeBytes,
  expiresAt,
  downloadUrl,
}: {
  fileName: string;
  sizeBytes: number;
  expiresAt: number;
  downloadUrl: string;
}) {
  const expiresAtLabel = new Date(expiresAt).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/6 p-4">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-success/15">
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(sizeBytes)} · enlace válido hasta {expiresAtLabel}
        </p>
        <a
          href={downloadUrl}
          className="inline-flex text-xs font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
          rel="noopener"
        >
          Abrir enlace directo
        </a>
      </div>
    </div>
  );
}

function DownloadErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/6 p-4"
    >
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-destructive/15">
        <X className="h-4 w-4 text-destructive" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">La descarga falló</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{message}</p>
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={onRetry}>
        Cerrar
      </Button>
    </div>
  );
}
