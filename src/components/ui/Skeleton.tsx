import { cn } from "../../utils/cn";

/** Bloque base con animación de carga (shimmer). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/70", className)} />;
}

/**
 * Esqueleto de página usado como fallback mientras carga una vista (lazy route).
 * Imita la estructura típica: encabezado + fila de KPIs + tabla, para que la
 * navegación se sienta instantánea y ordenada en lugar de un texto "Cargando…".
 */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando">
      {/* Encabezado */}
      <div className="mb-5">
        <Skeleton className="h-6 w-56 mb-2" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Fila de KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-7 w-24 mb-2" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Bloque de contenido / tabla */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-9 w-full mb-3" />
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16 flex-shrink-0" />
              <Skeleton className="h-4 w-12 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
