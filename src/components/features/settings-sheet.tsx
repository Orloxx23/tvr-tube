"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { FolderOpen, Loader2, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { CookiesBrowser, Settings } from "@/types/tvr-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SettingsSheet({ open, onOpenChange }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const api = window.tvr;
    if (!api) return;
    void api.getSettings().then(setSettings);
    const unsubscribe = api.onSettingsChange(setSettings);
    return () => unsubscribe();
  }, [open]);

  const onPickDirectory = useCallback(async () => {
    const api = window.tvr;
    if (!api) return;
    setBusy(true);
    try {
      const picked = await api.chooseDownloadsDirectory();
      if (!picked) return;
      const next = await api.setSettings({ downloadsDir: picked });
      setSettings(next);
      toast.success("Carpeta de descargas actualizada");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo cambiar la carpeta."
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const onCookiesBrowserChange = useCallback(async (value: CookiesBrowser) => {
    const api = window.tvr;
    if (!api) return;
    setBusy(true);
    try {
      const next = await api.setSettings({ cookiesBrowser: value });
      setSettings(next);
      toast.success(
        value === "none"
          ? "Se desactivó el uso de cookies"
          : "Cookies del navegador activadas"
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo cambiar la opción."
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const onReset = useCallback(async () => {
    const api = window.tvr;
    if (!api) return;
    setBusy(true);
    try {
      const next = await api.resetSettings();
      setSettings(next);
      toast.success("Ajustes restablecidos");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo resetear."
      );
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajustes</DialogTitle>
          <DialogDescription>
            Configurá la carpeta de descargas, el acceso a contenido con login y
            la apariencia de la app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <DownloadsSection
            value={settings?.downloadsDir ?? ""}
            busy={busy}
            onPick={onPickDirectory}
          />
          <Separator />
          <CookiesSection
            value={settings?.cookiesBrowser ?? "none"}
            busy={busy}
            onChange={onCookiesBrowserChange}
          />
          <Separator />
          <ThemeSection />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onReset}
            disabled={busy}
            className="sm:mr-auto"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Restablecer
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Listo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DownloadsSection({
  value,
  busy,
  onPick,
}: {
  value: string;
  busy: boolean;
  onPick: () => void;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Carpeta de descargas</h3>
        <p className="text-xs text-muted-foreground">
          Acá se guardan los archivos descargados.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Label htmlFor="downloadsDir" className="sr-only">
          Ruta de descargas
        </Label>
        <Input
          id="downloadsDir"
          value={value}
          readOnly
          spellCheck={false}
          className="font-mono text-xs"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={onPick}
          disabled={busy}
          className="shrink-0"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
          )}
          Elegir…
        </Button>
      </div>
    </section>
  );
}

const COOKIES_BROWSER_OPTIONS: { value: CookiesBrowser; label: string }[] = [
  { value: "none", label: "Sin cookies (solo contenido público)" },
  { value: "firefox", label: "Firefox" },
  { value: "chrome", label: "Chrome" },
  { value: "edge", label: "Edge" },
  { value: "brave", label: "Brave" },
  { value: "opera", label: "Opera" },
  { value: "vivaldi", label: "Vivaldi" },
  { value: "chromium", label: "Chromium" },
];

function CookiesSection({
  value,
  busy,
  onChange,
}: {
  value: CookiesBrowser;
  busy: boolean;
  onChange: (value: CookiesBrowser) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Contenido con inicio de sesión</h3>
        <p className="text-xs text-muted-foreground">
          Para videos privados o restringidos de X, Instagram o Facebook, elegí
          el navegador donde ya tengas iniciada sesión. La app usa esas cookies
          para acceder al contenido. Iniciá sesión en la plataforma desde ese
          navegador antes de descargar.
        </p>
      </div>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as CookiesBrowser)}
        disabled={busy}
      >
        <SelectTrigger className="sm:max-w-xs">
          <SelectValue placeholder="Navegador" />
        </SelectTrigger>
        <SelectContent>
          {COOKIES_BROWSER_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === "chrome" || value === "edge" ? (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          En Windows, Chrome y Edge pueden bloquear la lectura de cookies. Si
          falla, cerrá el navegador por completo y reintentá, o usá Firefox.
        </p>
      ) : null}
    </section>
  );
}

function ThemeSection() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Apariencia</h3>
        <p className="text-xs text-muted-foreground">
          Elegí entre modo claro, oscuro o seguir el sistema.
        </p>
      </div>
      <Select value={theme ?? "system"} onValueChange={setTheme}>
        <SelectTrigger className="sm:max-w-xs" suppressHydrationWarning>
          <SelectValue placeholder="Tema" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">
            <span className="inline-flex items-center gap-2">
              <Sun className="h-4 w-4" aria-hidden="true" />
              Claro
            </span>
          </SelectItem>
          <SelectItem value="dark">
            <span className="inline-flex items-center gap-2">
              <Moon className="h-4 w-4" aria-hidden="true" />
              Oscuro
            </span>
          </SelectItem>
          <SelectItem value="system">
            <span className="inline-flex items-center gap-2">
              <Monitor className="h-4 w-4" aria-hidden="true" />
              Sistema
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </section>
  );
}
