import { useMemo } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { useCategoriesPanel } from "../hooks/useCategoriesPanel";
import { buyerInitials, buyerLabel, totalOpenItems, useTeamWorkload } from "../hooks/useTeam";
import { PILL_TONE } from "../utils/tone";
import { formatNumber } from "../utils/formatters";

// ============================================================================
//  Compradores (líder) conectados al purchase-bff-service (F15): la lista sale
//  de GET /team/workload (nombre, estado, cartera y contadores reales). El
//  score, la tendencia y las ligas del mock no existen en el contrato: se
//  muestran como "—" hasta que llegue el flujo de desempeño.
// ============================================================================

const AVATAR_TONES = ["blue", "violet", "green", "amber", "red"];

export function BuyersPage() {
  const { rows, loading, error, configured, refetch } = useTeamWorkload();
  const categoriesPanel = useCategoriesPanel();

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoriesPanel.rows) map.set(c.categoryId, c.name);
    return map;
  }, [categoriesPanel.rows]);

  const list = useMemo(
    () => [...rows].sort((a, b) => totalOpenItems(b.counts) - totalOpenItems(a.counts)),
    [rows]
  );

  const pageTitle = "Compradores";
  const pageDescription =
    "Ficha ejecutiva de cada comprador: su cartera y su trabajo abierto hoy, con datos reales del servicio de compras.";

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, cargando y error (patrón flujo 1).
  // --------------------------------------------------------------------------
  if (!configured) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver los compradores reales del equipo.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <div
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5"
          aria-busy="true"
          aria-label="Cargando compradores"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar los compradores
            </p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={pageTitle} description={pageDescription} />

      {list.length === 0 ? (
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Sin compradores</p>
            <p className="mt-1 text-sm text-slate-500">
              El servicio aún no reporta compradores con carga en el equipo.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {list.map((b, idx) => (
            <div
              key={b.buyerId}
              className="text-left bg-white border border-slate-200 rounded-xl shadow-card p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${PILL_TONE[AVATAR_TONES[idx % AVATAR_TONES.length]]}`}
                >
                  {buyerInitials(b)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-slate-800">{buyerLabel(b)}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {b.categories.length === 0
                      ? "Sin categorías asignadas"
                      : b.categories.map((c) => categoryNames.get(c) ?? c).join(" · ")}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {/* Score de desempeño: sin fuente en el contrato del BFF. */}
                  <p className="text-2xl font-bold leading-none text-slate-300">—</p>
                  <p className="text-[11px] font-semibold text-slate-400">Score</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={b.active ? "green" : "neutral"}>
                  {b.active ? "Activo" : "Inactivo"}
                </Badge>
                <Badge tone="blue">{formatNumber(totalOpenItems(b.counts))} ítems abiertos</Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 border-t border-slate-100 pt-3">
                <div>
                  <p className="text-base font-semibold text-slate-800">
                    {formatNumber(b.counts.recommendationsPending)}
                  </p>
                  <p className="text-[10.5px] text-slate-400">Pendientes</p>
                </div>
                <div>
                  <p className="text-base font-semibold text-rose-700">
                    {formatNumber(b.counts.criticalPending)}
                  </p>
                  <p className="text-[10.5px] text-slate-400">Críticas</p>
                </div>
                <div>
                  <p className="text-base font-semibold text-amber-700">
                    {formatNumber(b.counts.ordersOpen)}
                  </p>
                  <p className="text-[10.5px] text-slate-400">OC abiertas</p>
                </div>
                <div>
                  <p className="text-base font-semibold text-rose-600">
                    {formatNumber(b.counts.alertsActive)}
                  </p>
                  <p className="text-[10.5px] text-slate-400">Alertas</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
