import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/features/site-header";
import { SiteFooter } from "@/components/features/site-footer";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo trata TVR Tube tus datos.",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Volver
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Política de privacidad</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Última actualización: <span className="font-mono">2026-05-14</span>
          </p>

          <div className="prose prose-invert mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
            <section>
              <h2 className="text-lg font-semibold tracking-tight">1. Qué datos recopilamos</h2>
              <p className="mt-2 text-muted-foreground">
                TVR Tube procesa únicamente el enlace de YouTube que pegás y, durante el
                procesamiento, los metadatos públicos del video. No se requiere registro ni se
                recopila información personal identificable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold tracking-tight">
                2. Archivos generados
              </h2>
              <p className="mt-2 text-muted-foreground">
                Los archivos descargados se almacenan temporalmente en Cloudflare R2 y se
                eliminan automáticamente al expirar el enlace pre-firmado (entre 15 y 30 minutos
                desde su generación). No se conservan copias permanentes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold tracking-tight">3. Almacenamiento local</h2>
              <p className="mt-2 text-muted-foreground">
                El historial de descargas se guarda exclusivamente en el{" "}
                <span className="font-mono text-foreground">localStorage</span> de tu navegador.
                Nunca abandona tu dispositivo. Podés borrarlo en cualquier momento desde el panel
                de historial.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold tracking-tight">4. Logs y telemetría</h2>
              <p className="mt-2 text-muted-foreground">
                Para prevenir abuso, se conservan logs mínimos de operación (timestamp, IP
                hasheada, tipo de descarga) por un máximo de 7 días. No se utilizan para
                publicidad ni se comparten con terceros.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold tracking-tight">5. Cookies</h2>
              <p className="mt-2 text-muted-foreground">
                TVR Tube no usa cookies de seguimiento. La única información persistente del lado
                del cliente es la preferencia de tema (claro/oscuro) y el historial mencionado.
              </p>
            </section>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
