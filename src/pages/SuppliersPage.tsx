import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUrlState } from "../utils/useUrlState";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { StatusBadge } from "../components/business/StatusBadge";
import { KpiCard } from "../components/business/KpiCard";
import { FilterBar } from "../components/business/FilterBar";
import { MetricHint } from "../components/business/supplierMetricHelp";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { useSuppliersPanel } from "../hooks/useSuppliersPanel";
import { supplierPath } from "../utils/entityLinks";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDays,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { IconSuppliers, IconAlerts, IconOrders } from "../components/ui/icons";
import {
  SUPPLIER_PENDING_WARN_CLP,
  SUPPLIER_COMPLIANCE_CRITICAL,
  SUPPLIER_COMPLIANCE_WARN,
} from "../utils/constants";
import type { SupplierPanelRow } from "../services/purchaseBff";

// ============================================================================
//  Proveedores conectados al purchase-bff (GET /suppliers, flujo 12).
//  - Búsqueda (nombre/RUT/cardCode) y filtro de estado se resuelven en el
//    backend; KPIs y rankings se derivan de las filas reales.
//  - null en una métrica = sub-lectura degradada → se muestra "—" (no 0).
//  - La sección "entran en temporada" (seasonality mock) se eliminó: el flujo
//    de temporadas aún no tiene fuente real.
// ============================================================================

/** Umbral de cumplimiento bajo para el KPI del panel real. */
const PANEL_COMPLIANCE_LOW = 80;

/** Suma de una métrica anulable: "—" si ninguna fila trajo el dato. */
function sumOrNull(rows: SupplierPanelRow[], pick: (s: SupplierPanelRow) => number | null) {
  const values = rows.map(pick).filter((v): v is number => v !== null);
  return values.length === 0 ? null : values.reduce((a, v) => a + v, 0);
}

export function SuppliersPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useUrlState("q");
  const [status, setStatus] = useUrlState("estado");
  const { rows, meta, loading, error, configured, refetch } = useSuppliersPanel(query, status);

  // KPIs desde las filas reales (ya filtradas por el backend con q/estado).
  const watched = rows.filter((s) => s.status === "on_watch" || s.status === "blocked").length;
  const lowCompliance = rows.filter(
    (s) => s.compliancePct !== null && s.compliancePct < PANEL_COMPLIANCE_LOW
  ).length;
  const totalPending = useMemo(() => sumOrNull(rows, (s) => s.pendingAmountClp), [rows]);
  const openOCs = useMemo(() => sumOrNull(rows, (s) => s.openOrders), [rows]);

  // Rankings derivados de las filas reales (solo filas con el dato presente).
  const mostDelayed = rows
    .filter((s) => s.compliancePct !== null)
    .sort((a, b) => a.compliancePct! - b.compliancePct!)
    .slice(0, 4);
  const biggestBuy = rows
    .filter((s) => s.purchased90Clp !== null)
    .sort((a, b) => b.purchased90Clp! - a.purchased90Clp!)
    .slice(0, 4);
  const highLeadTime = rows
    .filter((s) => s.leadTimeDaysObserved !== null)
    .sort((a, b) => b.leadTimeDaysObserved! - a.leadTimeDaysObserved!)
    .slice(0, 4);

  const pageTitle = "Proveedores";
  const pageDescription =
    "Gestión de proveedores con foco en cumplimiento, lead time y monto pendiente. Información para decidir si seguir comprando a cada uno.";

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, primera carga y error (patrón flujo 1).
  //  meta === null distingue "nunca cargó" de una recarga por búsqueda/filtro.
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
              ver el panel real de proveedores del servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && meta === null && !error) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando proveedores">
            {Array.from({ length: 6 }).map((_, i) => (
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

  if (error && meta === null) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar los proveedores
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

  const columns: Column<SupplierPanelRow>[] = [
    {
      key: "name",
      header: "Proveedor",
      render: (s) => (
        <div>
          <p className="font-medium text-slate-800">{s.name}</p>
          <p className="text-xs text-slate-400 font-mono">{s.rut ?? s.sapCardCode ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "categories",
      header: "Categorías",
      hideOnMobile: true,
      render: (s) => (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {s.categories.length === 0 ? (
            <span className="text-xs text-slate-300">—</span>
          ) : (
            s.categories.map((c) => (
              <Badge key={c} tone="neutral">
                {c}
              </Badge>
            ))
          )}
        </div>
      ),
    },
    {
      key: "skus",
      header: "SKUs conocidos",
      align: "right",
      hideOnMobile: true,
      render: (s) => (s.skuCount === null ? "—" : formatNumber(s.skuCount)),
    },
    {
      key: "openOc",
      header: "OC abiertas",
      align: "right",
      render: (s) => (s.openOrders === null ? "—" : formatNumber(s.openOrders)),
    },
    {
      key: "compliance",
      header: (
        <span className="inline-flex items-center gap-1">
          Cumplimiento
          <MetricHint metric="cumplimiento" />
        </span>
      ),
      align: "right",
      render: (s) =>
        s.compliancePct === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span
            className={
              s.compliancePct < SUPPLIER_COMPLIANCE_CRITICAL
                ? "text-rose-600 font-semibold"
                : s.compliancePct < SUPPLIER_COMPLIANCE_WARN
                  ? "text-amber-600 font-medium"
                  : "text-emerald-600 font-medium"
            }
          >
            {formatPercent(s.compliancePct, 0)}
          </span>
        ),
    },
    {
      key: "leadTime",
      header: (
        <span className="inline-flex items-center gap-1">
          Lead time observado
          <MetricHint metric="leadTime" />
        </span>
      ),
      align: "right",
      hideOnMobile: true,
      render: (s) => (s.leadTimeDaysObserved === null ? "—" : formatDays(s.leadTimeDaysObserved)),
    },
    {
      key: "buy90",
      header: "Compra 90 días",
      align: "right",
      hideOnMobile: true,
      render: (s) => (s.purchased90Clp === null ? "—" : formatCurrencyCompact(s.purchased90Clp)),
    },
    {
      key: "pending",
      header: (
        <span className="inline-flex items-center gap-1">
          Monto pendiente
          <MetricHint metric="pendiente" />
        </span>
      ),
      align: "right",
      render: (s) =>
        s.pendingAmountClp === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span
            className={
              s.pendingAmountClp > SUPPLIER_PENDING_WARN_CLP
                ? "text-amber-600 font-medium"
                : "text-slate-700"
            }
          >
            {formatCurrency(s.pendingAmountClp)}
          </span>
        ),
    },
    {
      key: "status",
      header: "Estado",
      render: (s) => <StatusBadge kind="supplier" value={s.status} />,
    },
  ];

  return (
    <div>
      <PageHeader title={pageTitle} description={pageDescription} />

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por nombre, RUT o código SAP"
          resultCount={rows.length}
          summary={`${rows.length} proveedor${rows.length === 1 ? "" : "es"} · ${watched} en observación o bloqueados · ${lowCompliance} con cumplimiento bajo`}
          onClear={() => {
            setQuery("");
            setStatus("");
          }}
          selects={[
            {
              key: "status",
              placeholder: "Estado",
              value: status,
              onChange: setStatus,
              options: [
                { value: "active", label: "Activo" },
                { value: "on_watch", label: "En observación" },
                { value: "blocked", label: "Bloqueado" },
              ],
            },
          ]}
        />
      </div>

      {meta?.partial && (meta.warnings?.length ?? 0) > 0 && (
        <Card className="mb-3 border-amber-200 bg-amber-50/60">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-xs text-amber-800">
            <Badge tone="amber">Datos parciales</Badge>
            {meta.warnings!.map((w) => (
              <span key={w.code}>{w.message}</span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="En observación / bloqueados"
          value={formatNumber(watched)}
          tone={watched > 0 ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
        />
        <KpiCard
          title={`Cumplimiento bajo (<${PANEL_COMPLIANCE_LOW}%)`}
          value={formatNumber(lowCompliance)}
          tone="warn"
          icon={<IconSuppliers className="w-4 h-4" />}
          info={<MetricHint metric="cumplimiento" />}
        />
        <KpiCard
          title="OC abiertas (total)"
          value={openOCs === null ? "—" : formatNumber(openOCs)}
          tone="neutral"
          icon={<IconOrders className="w-4 h-4" />}
        />
        <KpiCard
          title="Monto pendiente total"
          value={totalPending === null ? "—" : formatCurrencyCompact(totalPending)}
          tone="info"
          icon={<IconSuppliers className="w-4 h-4" />}
          info={<MetricHint metric="pendiente" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <MiniRank
          title="Peor cumplimiento"
          items={mostDelayed.map((s) => ({
            name: s.name,
            value: formatPercent(s.compliancePct!, 0),
            tone: "red" as const,
            sub: s.openOrders === null ? "OC abiertas s/d" : `${s.openOrders} OC abiertas`,
          }))}
        />
        <MiniRank
          title="Mayor compra (90 días)"
          items={biggestBuy.map((s) => ({
            name: s.name,
            value: formatCurrencyCompact(s.purchased90Clp!),
            tone: "green" as const,
            sub: s.skuCount === null ? "SKUs s/d" : `${formatNumber(s.skuCount)} SKUs`,
          }))}
        />
        <MiniRank
          title="Lead time más alto"
          items={highLeadTime.map((s) => ({
            name: s.name,
            value: formatDays(s.leadTimeDaysObserved!),
            tone: "amber" as const,
            sub:
              s.compliancePct === null
                ? "Cumplimiento s/d"
                : `Cumple ${formatPercent(s.compliancePct, 0)}`,
          }))}
        />
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(s) => s.supplierId}
          onRowClick={(s) => navigate(supplierPath(s.supplierId))}
          emptyMessage="Sin proveedores que coincidan con la búsqueda o el estado."
          mobileCard={(s) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400 font-mono">
                    {s.rut ?? s.sapCardCode ?? "—"}
                  </p>
                </div>
                <StatusBadge kind="supplier" value={s.status} dot={false} />
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-2 mt-2 text-sm">
                <div>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    Cumple
                    <MetricHint metric="cumplimiento" />
                  </p>
                  <p
                    className={
                      s.compliancePct !== null && s.compliancePct < SUPPLIER_COMPLIANCE_CRITICAL
                        ? "text-rose-600 font-semibold"
                        : "text-slate-700"
                    }
                  >
                    {s.compliancePct === null ? "—" : formatPercent(s.compliancePct, 0)}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    Lead time
                    <MetricHint metric="leadTime" />
                  </p>
                  <p className="text-slate-700">
                    {s.leadTimeDaysObserved === null ? "—" : formatDays(s.leadTimeDaysObserved)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">OC abiertas</p>
                  <p className="text-slate-700">
                    {s.openOrders === null ? "—" : formatNumber(s.openOrders)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Pendiente</p>
                  <p className="text-slate-700">
                    {s.pendingAmountClp === null ? "—" : formatCurrencyCompact(s.pendingAmountClp)}
                  </p>
                </div>
              </div>
            </div>
          )}
        />
      </Card>
    </div>
  );
}

function MiniRank({
  title,
  items,
}: {
  title: string;
  items: { name: string; value: string; sub: string; tone: "red" | "green" | "amber" }[];
}) {
  const toneText = { red: "text-rose-600", green: "text-emerald-600", amber: "text-amber-600" };
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-slate-400">Sin datos suficientes para este ranking.</p>
        ) : (
          items.map((it) => (
            <div
              key={it.name}
              className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{it.name}</p>
                <p className="text-xs text-slate-400">{it.sub}</p>
              </div>
              <span className={`text-sm font-semibold flex-shrink-0 ${toneText[it.tone]}`}>
                {it.value}
              </span>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
