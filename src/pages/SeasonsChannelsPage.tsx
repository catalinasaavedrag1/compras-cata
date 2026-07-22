import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { DataTable, type Column } from "../components/ui/Table";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { InfoHint } from "../components/business/InfoHint";
import { useSeasons } from "../hooks/useSeasons";
import type { SeasonView } from "../services/purchaseBff";
import { hasPlanContent, planForScenario } from "../utils/seasonPlan";
import { formatCurrencyCompact, formatDate, formatNumber } from "../utils/formatters";
import { IconCalendar, IconCart, IconSales, IconBox } from "../components/ui/icons";
import { SCENARIO_ORDER, SEASON_STATUS_META } from "./seasonPlanner/constants";

// ============================================================================
//  Temporadas conectadas al purchase-bff-service (F18): calendario comercial
//  real (ventana de venta, ventana de compra y estado del ciclo por temporada),
//  con el comprometido real del escenario base cuando existe tracking.
//  La mezcla de demanda por canal, los peaks mensuales y la compra sugerida por
//  canal del mock se eliminaron: no existe una fuente real por canal en el
//  contrato, así que no se muestran números inventados.
// ============================================================================

const fmtDay = (iso: string) => formatDate(iso.slice(0, 10));

export function SeasonsChannelsPage() {
  const { seasons, loading, error, configured, refetch } = useSeasons();

  const kpis = useMemo(
    () => ({
      total: seasons.length,
      buying: seasons.filter((s) => s.status === "buying").length,
      selling: seasons.filter((s) => s.status === "selling").length,
      planned: seasons.filter((s) => s.status === "planned").length,
    }),
    [seasons]
  );

  const pageTitle = "Temporadas y canales";
  const pageDescription =
    "Calendario comercial de las temporadas: cuándo se vende, cuándo hay que comprar y en qué punto del ciclo está cada una.";

  // --------------------------------------------------------------------------
  //  Estados de conexión (patrón ClaimsPage)
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
              ver el calendario comercial real de temporadas del servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && seasons.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando temporadas">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error && seasons.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las temporadas
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

  const columns: Column<SeasonView>[] = [
    {
      key: "season",
      header: "Temporada",
      render: (s) => (
        <div className="min-w-[170px]">
          <p className="font-medium text-slate-800">{s.name}</p>
          <p className="text-xs text-slate-400">{s.code}</p>
        </div>
      ),
    },
    {
      key: "sales",
      header: "Ventana de venta",
      render: (s) => (
        <span className="text-slate-700">
          {fmtDay(s.salesFrom)} → {fmtDay(s.salesTo)}
        </span>
      ),
    },
    {
      key: "buy",
      header: "Ventana de compra",
      hideOnMobile: true,
      render: (s) => (
        <span className="text-slate-700">
          {fmtDay(s.buyFrom)} → {fmtDay(s.buyTo)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado del ciclo",
      align: "center",
      render: (s) => (
        <Badge tone={SEASON_STATUS_META[s.status].tone}>
          {SEASON_STATUS_META[s.status].label}
        </Badge>
      ),
    },
    {
      key: "plans",
      header: "Escenarios con plan",
      align: "right",
      hideOnMobile: true,
      render: (s) => {
        const withPlan = SCENARIO_ORDER.filter((sc) =>
          hasPlanContent(planForScenario(s, sc))
        ).length;
        return withPlan > 0 ? (
          <span className="text-slate-700">
            {formatNumber(withPlan)} de {SCENARIO_ORDER.length}
          </span>
        ) : (
          <span className="text-slate-400" title="Sin plan en ningún escenario">
            —
          </span>
        );
      },
    },
    {
      key: "committed",
      header: "Comprometido (base)",
      align: "right",
      render: (s) => {
        const tracking = planForScenario(s, "base")?.tracking ?? null;
        return tracking ? (
          <span className="font-semibold text-slate-900">
            {formatCurrencyCompact(tracking.totalCommittedClp)}
          </span>
        ) : (
          <span className="text-slate-400" title="Aún sin tracking de OC">
            —
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={
          <Link to="/comprar/temporada">
            <Button icon={<IconCart className="w-4 h-4" />}>Planificar temporada</Button>
          </Link>
        }
        help={
          <InfoHint label="Temporadas y canales">
            <p>
              Cada temporada define una <b>ventana de venta</b> (cuándo se espera vender) y una{" "}
              <b>ventana de compra</b> (cuándo hay que emitir las OC para llegar a tiempo). El
              ciclo avanza: planificada → en compra → en venta → cerrada.
            </p>
            <p>
              Este es el <b>calendario</b>; para asignar presupuesto por categoría y escenario, usa{" "}
              <Link to="/comprar/temporada" className="font-medium text-brand-700 hover:underline">
                Planificar temporada
              </Link>
              .
            </p>
          </InfoHint>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Temporadas"
          value={formatNumber(kpis.total)}
          tone="info"
          icon={<IconCalendar className="w-4 h-4" />}
          description="registradas en el servicio"
        />
        <KpiCard
          title="En compra"
          value={formatNumber(kpis.buying)}
          tone={kpis.buying > 0 ? "warn" : "neutral"}
          icon={<IconCart className="w-4 h-4" />}
          description="ventana de compra activa"
        />
        <KpiCard
          title="En venta"
          value={formatNumber(kpis.selling)}
          tone={kpis.selling > 0 ? "good" : "neutral"}
          icon={<IconSales className="w-4 h-4" />}
          description="ventana de venta activa"
        />
        <KpiCard
          title="Planificadas"
          value={formatNumber(kpis.planned)}
          tone="neutral"
          icon={<IconBox className="w-4 h-4" />}
          description="aún sin comprar"
        />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Calendario comercial"
          description="Ventanas reales de venta y compra por temporada, estado del ciclo y comprometido en OC del escenario base"
        />
        {seasons.length === 0 ? (
          <EmptyState
            icon={<IconCalendar className="h-6 w-6" />}
            title="Sin temporadas registradas"
            description="Cuando existan temporadas en el servicio de compras aparecerán aquí con sus ventanas de venta y compra."
          />
        ) : (
          <DataTable
            columns={columns}
            data={seasons}
            rowKey={(s) => s.id}
            emptyMessage="Sin temporadas registradas."
            mobileCard={(s) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.code}</p>
                  </div>
                  <Badge tone={SEASON_STATUS_META[s.status].tone}>
                    {SEASON_STATUS_META[s.status].label}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Venta</p>
                    <p className="text-slate-700">
                      {fmtDay(s.salesFrom)} → {fmtDay(s.salesTo)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Compra</p>
                    <p className="text-slate-700">
                      {fmtDay(s.buyFrom)} → {fmtDay(s.buyTo)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          />
        )}
      </Card>

      <HelpNote>
        La mezcla de demanda por canal (tienda, ecommerce, marketplace, empresa y licitaciones),
        los peaks mensuales y la compra sugerida por canal aún no tienen fuente en el servicio de
        compras, por lo que dejaron de mostrarse aquí. Cuando exista esa señal real, volverá a esta
        pantalla.
      </HelpNote>
    </div>
  );
}
