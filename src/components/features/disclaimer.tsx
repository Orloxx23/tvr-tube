import { ShieldAlert } from "lucide-react";

export function Disclaimer() {
  return (
    <aside
      role="note"
      aria-label="Aviso de uso"
      className="mx-auto max-w-2xl rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-200/90 sm:text-sm"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
        <p className="leading-relaxed">
          <span className="font-medium text-amber-100">Uso personal únicamente.</span> Descarga
          solo contenido del que seas propietario o que esté bajo una licencia que lo permita.
          Respeta los derechos de autor y los términos de servicio de YouTube.
        </p>
      </div>
    </aside>
  );
}
