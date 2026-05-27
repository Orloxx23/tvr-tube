"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FolderOpen,
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
import { isProbablyValidUrl } from "@/lib/platforms";
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
    .min(1, "Pegá el enlace del video")
    .refine((v) => isProbablyValidUrl(v), {
      message: "El enlace no parece una URL válida",
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
  | "saving";

const PHASE_LABEL: Record<ProgressPhase, string> = {
  probing: "Analizando video",
  "downloading-video": "Descargando video",
  "downloading-audio": "Descargando audio",
  merging: "Combinando video y audio",
  saving: "Guardando archivo",
};

const INDETERMINATE_PHASES: ReadonlySet<ProgressPhase> = new Set([
  "probing",
  "merging",
  "saving",
]);

type DownloadState =
  | { status: "idle" }
  | { status: "running"; phase: ProgressPhase; percent: number }
  | {
      status: "success";
      filePath: string;
      fileName: string;
      sizeBytes: number;
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

function getTvrApi() {
  if (typeof window === "undefined" || !window.tvr) return null;
  return window.tvr;
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
    const api = getTvrApi();
    if (!api) {
      setState({
        status: "error",
        message:
          "Esta app necesita correr dentro de Electron (no hay bridge IPC disponible).",
      });
      return;
    }
    try {
      const metadata = await api.getMetadata(url);
      setState({ status: "ready", metadata });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo obtener la información del video.";
      setState({ status: "error", message });
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
    const api = getTvrApi();
    if (!api) {
      toast.error("Bridge IPC no disponible.");
      return;
    }
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
      sourceUrl: m.sourceUrl,
      platform: m.platform,
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
            url: m.sourceUrl,
            quality: effectiveQuality,
            title: m.title,
          }
        : {
            mode: "audio",
            url: m.sourceUrl,
            audioFormat,
            audioBitrate,
            title: m.title,
          };

    const unsubscribe = api.onDownloadProgress((evt) => {
      setDownload({
        status: "running",
        phase: evt.phase,
        percent: evt.percent ?? 0,
      });
    });

    try {
      const result = await api.startDownload(payload);
      update(historyId, {
        status: "ready",
        filePath: result.filePath,
        fileName: result.fileName,
        sizeBytes: result.sizeBytes,
      });
      setDownload({
        status: "success",
        filePath: result.filePath,
        fileName: result.fileName,
        sizeBytes: result.sizeBytes,
      });
      toast.success("Descarga lista", { description: result.fileName });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error desconocido en la descarga.";
      update(historyId, { status: "failed", errorMessage: message });
      setDownload({ status: "failed", message });
      toast.error("Error en la descarga", { description: message });
    } finally {
      unsubscribe();
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
          Enlace del video
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
            placeholder="Pegá un enlace de YouTube, TikTok, Instagram…"
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
            Compatible con YouTube, Instagram, TikTok, Threads, Facebook, Pinterest y +1000 sitios.
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
                    filePath={download.filePath}
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
  filePath,
}: {
  fileName: string;
  sizeBytes: number;
  filePath: string;
}) {
  const onReveal = () => {
    void window.tvr?.revealInFolder(filePath);
  };
  return (
    <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/6 p-4">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-success/15">
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(sizeBytes)} · guardado en tu equipo
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onReveal}
          className="-ml-2 mt-1 h-7 px-2 text-xs"
        >
          <FolderOpen className="h-3 w-3" aria-hidden="true" />
          Mostrar en carpeta
        </Button>
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
