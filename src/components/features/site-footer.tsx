import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">TVR Tube</span> · Herramienta de uso
          personal · No afiliada con YouTube ni con Google.
        </p>
        <nav className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link href="/legal/terms" className="hover:text-foreground transition-colors">
            Términos
          </Link>
          <Link href="/legal/privacy" className="hover:text-foreground transition-colors">
            Privacidad
          </Link>
          <span aria-hidden="true">·</span>
          <span className="font-mono">v0.1</span>
        </nav>
      </div>
    </footer>
  );
}
