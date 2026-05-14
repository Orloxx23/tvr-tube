import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/features/site-header";
import { SiteFooter } from "@/components/features/site-footer";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Términos de uso de TVR Tube — herramienta de descarga personal.",
};

export default function TermsPage() {
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
          <h1 className="text-3xl font-semibold tracking-tight">Términos de uso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Última actualización: <span className="font-mono">2026-05-14</span>
          </p>

          <div className="prose prose-invert mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
            <section>
              <h2 className="text-lg font-semibold tracking-tight">1. Naturaleza del servicio</h2>
              <p className="mt-2 text-muted-foreground">
                TVR Tube es una herramienta personal de aprendizaje que permite a su usuario
                obtener copias locales de contenido público de YouTube para fines no comerciales.
                TVR Tube no aloja contenido de terceros: cada archivo se genera bajo petición y se
                elimina tras la descarga o expiración del enlace.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold tracking-tight">
                2. Responsabilidad del usuario
              </h2>
              <p className="mt-2 text-muted-foreground">
                El uso de TVR Tube implica que descargás únicamente contenido del que sos
                propietario, contenido bajo licencia Creative Commons, o contenido cuyo uso no
                viole los Términos de Servicio de YouTube ni las leyes de propiedad intelectual
                aplicables en tu jurisdicción.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold tracking-tight">3. Sin garantías</h2>
              <p className="mt-2 text-muted-foreground">
                El servicio se entrega &ldquo;tal cual&rdquo;, sin garantías de disponibilidad,
                exactitud o adecuación a un fin particular. YouTube puede cambiar su API o
                bloquear el acceso en cualquier momento, lo que puede afectar el funcionamiento.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold tracking-tight">4. Sin afiliación</h2>
              <p className="mt-2 text-muted-foreground">
                TVR Tube no está afiliado, asociado, autorizado, respaldado por ni de ninguna forma
                conectado oficialmente con YouTube, Google LLC, o cualquiera de sus
                subsidiarias.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold tracking-tight">5. Cambios</h2>
              <p className="mt-2 text-muted-foreground">
                Estos términos pueden actualizarse sin previo aviso. La fecha de última
                actualización se muestra al inicio de este documento.
              </p>
            </section>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
