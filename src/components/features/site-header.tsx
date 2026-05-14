import Link from "next/link";
import { Download } from "lucide-react";
import { SettingsTrigger } from "./settings-trigger";

export function SiteHeader() {
  return (
    <header className="w-full border-b border-border/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="TVR Tube — Inicio"
        >
          <span
            className="grid h-7 w-7 place-items-center rounded-md bg-accent-gradient text-white"
            aria-hidden="true"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <span className="font-semibold tracking-tight">TVR Tube</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/legal/terms"
            className="hidden sm:inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Términos
          </Link>
          <Link
            href="/legal/privacy"
            className="hidden sm:inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacidad
          </Link>
          <SettingsTrigger />
        </nav>
      </div>
    </header>
  );
}
