import { SiteHeader } from "@/components/features/site-header";
import { SiteFooter } from "@/components/features/site-footer";
import { Downloader } from "@/components/features/downloader";
import { DownloadHistoryPanel } from "@/components/features/download-history";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="relative overflow-x-hidden">
        <div className="glow-orb" aria-hidden="true" />
        <div className="absolute inset-0 bg-grid" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
          <Badge variant="outline" className="mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-gradient" aria-hidden="true" />
            Hasta 2160p · MP3 · M4A
          </Badge>
          <h1 className="max-w-3xl text-balance text-center text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Descarga videos de YouTube{" "}
            <span className="text-accent-gradient">sin fricción</span>.
          </h1>
          <p className="mt-4 max-w-xl text-balance text-center text-base text-muted-foreground sm:text-lg">
            Pegá el enlace, elegí la calidad y obtené el archivo. Resoluciones hasta 4K, audio
            limpio y procesamiento server-side.
          </p>
          <div className="mt-10 w-full">
            <Downloader />
          </div>
          {/* <div className="mt-8 w-full max-w-2xl">
            <Disclaimer />
          </div> */}
        </div>

        <section
          aria-labelledby="history-heading"
          className="relative mx-auto w-full max-w-2xl px-4 pb-24 sm:px-6"
        >
          <h2 id="history-heading" className="sr-only">
            Descargas recientes
          </h2>
          <DownloadHistoryPanel />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
