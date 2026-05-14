"use client";

import { Music2, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUDIO_BITRATES,
  AUDIO_FORMATS,
  VIDEO_QUALITIES,
  type AudioBitrate,
  type AudioFormat,
  type DownloadMode,
  type VideoQuality,
} from "@/lib/constants";

interface QualitySelectorProps {
  mode: DownloadMode;
  quality: VideoQuality;
  audioBitrate: AudioBitrate;
  audioFormat: AudioFormat;
  onModeChange: (mode: DownloadMode) => void;
  onQualityChange: (q: VideoQuality) => void;
  onAudioBitrateChange: (b: AudioBitrate) => void;
  onAudioFormatChange: (f: AudioFormat) => void;
  disabled?: boolean;
  availableQualities?: VideoQuality[];
}

export function QualitySelector({
  mode,
  quality,
  audioBitrate,
  audioFormat,
  onModeChange,
  onQualityChange,
  onAudioBitrateChange,
  onAudioFormatChange,
  disabled,
  availableQualities,
}: QualitySelectorProps) {
  const qualityOptions = availableQualities
    ? VIDEO_QUALITIES.filter((q) => availableQualities.includes(q.value))
    : VIDEO_QUALITIES;
  return (
    <Tabs
      value={mode}
      onValueChange={(v) => onModeChange(v as DownloadMode)}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2 sm:w-fit sm:inline-flex">
        <TabsTrigger value="video" disabled={disabled}>
          <Video className="h-3.5 w-3.5" aria-hidden="true" />
          Video
        </TabsTrigger>
        <TabsTrigger value="audio" disabled={disabled}>
          <Music2 className="h-3.5 w-3.5" aria-hidden="true" />
          Solo audio
        </TabsTrigger>
      </TabsList>

      <TabsContent value="video" className="space-y-2">
        <Label htmlFor="quality-select" className="text-xs uppercase tracking-wide text-muted-foreground">
          Calidad
        </Label>
        <Select
          value={quality}
          onValueChange={(v) => onQualityChange(v as VideoQuality)}
          disabled={disabled}
        >
          <SelectTrigger id="quality-select" className="h-11">
            <SelectValue placeholder="Seleccionar calidad" />
          </SelectTrigger>
          <SelectContent>
            {qualityOptions.map((q) => (
              <SelectItem key={q.value} value={q.value}>
                <span className="inline-flex items-center gap-2">
                  {q.label}
                  {q.badge ? <Badge variant="accent">{q.badge}</Badge> : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {availableQualities
            ? `Sólo se listan las calidades disponibles para este video.`
            : `A partir de 1080p, video y audio se descargan por separado y se combinan con ffmpeg.`}
        </p>
      </TabsContent>

      <TabsContent value="audio" className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label
              htmlFor="bitrate-select"
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              Bitrate
            </Label>
            <Select
              value={audioBitrate}
              onValueChange={(v) => onAudioBitrateChange(v as AudioBitrate)}
              disabled={disabled}
            >
              <SelectTrigger id="bitrate-select" className="h-11">
                <SelectValue placeholder="Bitrate" />
              </SelectTrigger>
              <SelectContent>
                {AUDIO_BITRATES.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="format-select"
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              Formato
            </Label>
            <Select
              value={audioFormat}
              onValueChange={(v) => onAudioFormatChange(v as AudioFormat)}
              disabled={disabled}
            >
              <SelectTrigger id="format-select" className="h-11">
                <SelectValue placeholder="Formato" />
              </SelectTrigger>
              <SelectContent>
                {AUDIO_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          M4A preserva la calidad original sin re-encodear. MP3 es más compatible pero implica
          reconversión.
        </p>
      </TabsContent>
    </Tabs>
  );
}
