"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, RefreshCcw, TriangleAlert, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
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
    const api = typeof window !== "undefined" ? window.tvr : undefined;
    if (!api) {
      setHasBridge(false);
      return;
    }
    setHasBridge(true);

    const timer = window.setTimeout(() => {
      setHandshakeTimedOut(true);
    }, HANDSHAKE_TIMEOUT_MS);

    void api
      .getBinariesStatus()
      .then((s) => {
        window.clearTimeout(timer);
        setHandshakeTimedOut(false);
        setStatus(s);
      })
      .catch((err) => {
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
      window.clearTimeout(timer);
      setHandshakeTimedOut(false);
      setStatus(s);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const isReady = status?.state === "ready";

  return (
    <>
      {children}
      <AnimatePresence>
        {!isReady ? (
          <BinariesOverlay
            status={status}
            hasBridge={hasBridge}
            handshakeTimedOut={handshakeTimedOut}
          />
        ) : null}
      </AnimatePresence>
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
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="binaries-gate-title"
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-background p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-120 w-120 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-gradient opacity-[0.12] blur-[120px]"
      />
      <div className="relative w-full max-w-sm text-center">
        <BrandMark pulse={hasBridge !== false} />
        {renderBody(status, hasBridge, handshakeTimedOut)}
      </div>
    </motion.div>
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
      return <SlowStart />;
    }
    return (
      <Pending
        title="Preparando tu espacio"
        description="Estamos dejando todo listo para que empieces a descargar. Tardará solo un momento."
      />
    );
  }

  switch (status.state) {
    case "checking":
      return (
        <Pending
          title="Preparando tu espacio"
          description="Estamos dejando todo listo para que empieces a descargar. Tardará solo un momento."
        />
      );
    case "downloading":
      return (
        <Body
          title="Casi listo"
          description="Terminando de configurar la app por primera vez. Esto pasa una sola vez."
        >
          <ProgressBar
            percent={status.percent}
            label="Descargando lo necesario"
            indeterminate={status.totalBytes === null}
            className="mt-2 text-left"
          />
        </Body>
      );
    case "verifying":
      return (
        <Pending
          title="Ya casi estamos"
          description="Dando los últimos toques antes de empezar."
        />
      );
    case "error":
      return <ErrorState message={status.message} />;
    case "ready":
      return null;
  }
}

function BrandMark({ pulse }: { pulse: boolean }) {
  return (
    <div className="relative mx-auto mb-8 grid h-20 w-20 place-items-center">
      {pulse ? (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-3xl bg-accent-gradient blur-xl"
          animate={{ opacity: [0.35, 0.75, 0.35], scale: [0.9, 1.08, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
      <span
        className="relative grid h-16 w-16 place-items-center rounded-3xl bg-accent-gradient text-white shadow-lg shadow-accent-from/30"
        aria-hidden="true"
      >
        <Download className="h-7 w-7" strokeWidth={2.5} />
      </span>
    </div>
  );
}

function Body({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2
        id="binaries-gate-title"
        className="text-xl font-semibold tracking-tight text-foreground"
      >
        {title}
      </h2>
      <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children}
    </div>
  );
}

function Pending({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Body title={title} description={description}>
      <LoadingDots />
    </Body>
  );
}

function LoadingDots() {
  return (
    <div
      className="flex items-center justify-center gap-1.5 pt-2"
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-accent-gradient"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.18,
          }}
        />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  const onRetry = () => {
    void window.tvr?.retryBinaries();
  };
  return (
    <div className="space-y-4">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-destructive/12">
        <TriangleAlert className="h-5 w-5 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2
          id="binaries-gate-title"
          className="text-xl font-semibold tracking-tight text-foreground"
        >
          No pudimos preparar la app
        </h2>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>
      <Button type="button" onClick={onRetry}>
        <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        Reintentar
      </Button>
    </div>
  );
}

function SlowStart() {
  const onRetry = () => {
    void window.tvr?.retryBinaries();
    window.location.reload();
  };
  return (
    <div className="space-y-4">
      <h2
        id="binaries-gate-title"
        className="text-xl font-semibold tracking-tight text-foreground"
      >
        Esto está tardando más de lo normal
      </h2>
      <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
        No pudimos terminar de iniciar la app. Probá reintentar; si sigue igual,
        cerrala y volvé a abrirla.
      </p>
      <Button type="button" onClick={onRetry}>
        <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        Reintentar
      </Button>
    </div>
  );
}

function NoBridgeMessage() {
  return (
    <div className="space-y-4">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted">
        <Wifi className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2
          id="binaries-gate-title"
          className="text-xl font-semibold tracking-tight text-foreground"
        >
          Abrí la app de escritorio
        </h2>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
          Parece que estás viendo esto en un navegador. Cerrá esta ventana y abrí
          TVR Tube desde la app instalada en tu equipo.
        </p>
      </div>
    </div>
  );
}
