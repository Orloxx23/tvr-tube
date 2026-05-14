"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, RefreshCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatBytes } from "@/lib/utils";
import type { BinariesStatus } from "@/types/tvr-api";

type Props = {
  children: React.ReactNode;
};

const HANDSHAKE_TIMEOUT_MS = 3000;

export function BinariesGate({ children }: Props) {
  const [status, setStatus] = useState<BinariesStatus | null>(null);
  const [hasBridge, setHasBridge] = useState<boolean | null>(null);
  const [handshakeTimedOut, setHandshakeTimedOut] = useState(false);

  useEffect(() => {
    console.log("[BinariesGate] mount, checking window.tvr");
    const api = typeof window !== "undefined" ? window.tvr : undefined;
    if (!api) {
      console.warn("[BinariesGate] no window.tvr");
      setHasBridge(false);
      return;
    }
    setHasBridge(true);

    const timer = window.setTimeout(() => {
      console.warn("[BinariesGate] handshake timeout (no status received)");
      setHandshakeTimedOut(true);
    }, HANDSHAKE_TIMEOUT_MS);

    void api
      .getBinariesStatus()
      .then((s) => {
        console.log("[BinariesGate] initial status:", s);
        window.clearTimeout(timer);
        setHandshakeTimedOut(false);
        setStatus(s);
      })
      .catch((err) => {
        console.error("[BinariesGate] getBinariesStatus failed:", err);
        window.clearTimeout(timer);
        setStatus({
          state: "error",
          message:
            err instanceof Error
              ? err.message
              : "No se pudo consultar el estado de los binarios.",
        });
      });
    const unsubscribe = api.onBinariesStatus((s) => {
      console.log("[BinariesGate] broadcast status:", s);
      window.clearTimeout(timer);
      setHandshakeTimedOut(false);
      setStatus(s);
    });
    return () => {
      console.log("[BinariesGate] cleanup");
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  console.log("[BinariesGate] render", { status, hasBridge, handshakeTimedOut });

  const isReady = status?.state === "ready";

  return (
    <>
      {children}
      {!isReady ? (
        <BinariesOverlay
          status={status}
          hasBridge={hasBridge}
          handshakeTimedOut={handshakeTimedOut}
        />
      ) : null}
    </>
  );
}

function BinariesOverlay({
  status,
  hasBridge,
  handshakeTimedOut,
}: {
  status: BinariesStatus | null;
  hasBridge: boolean | null;
  handshakeTimedOut: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="binaries-gate-title"
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4"
    >
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6">
          {renderBody(status, hasBridge, handshakeTimedOut)}
          <DebugFooter
            status={status}
            hasBridge={hasBridge}
            handshakeTimedOut={handshakeTimedOut}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function renderBody(
  status: BinariesStatus | null,
  hasBridge: boolean | null,
  handshakeTimedOut: boolean
) {
  if (hasBridge === false) {
    return <NoBridgeMessage />;
  }
  if (!status) {
    if (handshakeTimedOut) {
      return <HandshakeTimeout />;
    }
    return (
      <Pending
        icon={<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        title="Preparando TVR Tube"
        description="Conectando con el proceso principal…"
      />
    );
  }

  switch (status.state) {
    case "checking":
      return (
        <Pending
          icon={<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          title="Preparando TVR Tube"
          description="Comprobando que tengas todo lo necesario para descargar videos."
        />
      );
    case "downloading": {
      const total = status.totalBytes;
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-accent" aria-hidden="true" />
            <h2 id="binaries-gate-title" className="text-base font-semibold">
              Descargando yt-dlp
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Esto pasa una sola vez. El binario queda guardado en tu equipo.
          </p>
          <ProgressBar
            percent={status.percent}
            label={`${formatBytes(status.receivedBytes)}${total ? ` / ${formatBytes(total)}` : ""}`}
            indeterminate={total === null}
          />
        </div>
      );
    }
    case "verifying":
      return (
        <Pending
          icon={<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          title="Verificando binario"
          description="Comprobando que yt-dlp ande correctamente…"
        />
      );
    case "error":
      return <ErrorState message={status.message} />;
    case "ready":
      return null;
  }
}

function Pending({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-foreground">
        {icon}
        <h2 id="binaries-gate-title" className="text-base font-semibold">
          {title}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  const onRetry = () => {
    void window.tvr?.retryBinaries();
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-destructive">
        <X className="h-5 w-5" aria-hidden="true" />
        <h2 id="binaries-gate-title" className="text-base font-semibold">
          No se pudo preparar la app
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button type="button" size="sm" onClick={onRetry}>
        <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        Reintentar
      </Button>
    </div>
  );
}

function HandshakeTimeout() {
  const onRetry = () => {
    void window.tvr?.retryBinaries();
    window.location.reload();
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-foreground">
        <X className="h-5 w-5 text-destructive" aria-hidden="true" />
        <h2 id="binaries-gate-title" className="text-base font-semibold">
          No llegó respuesta del proceso principal
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        El bridge IPC está expuesto pero <code>binaries:get-status</code> no
        contestó en {Math.floor(HANDSHAKE_TIMEOUT_MS / 1000)}s. Revisá la
        terminal de Electron por errores en <code>ensureBinaries</code>.
      </p>
      <Button type="button" size="sm" onClick={onRetry}>
        <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        Reintentar y recargar
      </Button>
    </div>
  );
}

function DebugFooter({
  status,
  hasBridge,
  handshakeTimedOut,
}: {
  status: BinariesStatus | null;
  hasBridge: boolean | null;
  handshakeTimedOut: boolean;
}) {
  return (
    <pre className="mt-2 max-h-32 overflow-auto rounded-md border border-border/40 bg-muted/30 p-2 text-[10px] leading-tight text-muted-foreground">
      {JSON.stringify({ hasBridge, handshakeTimedOut, status }, null, 2)}
    </pre>
  );
}

function NoBridgeMessage() {
  return (
    <div className="space-y-3">
      <h2 id="binaries-gate-title" className="text-base font-semibold">
        Esta app debe correr en Electron
      </h2>
      <p className="text-sm text-muted-foreground">
        No hay bridge IPC disponible. Si abriste el HTML directo en un browser,
        cerralo y abrí la app de escritorio en su lugar.
      </p>
    </div>
  );
}
