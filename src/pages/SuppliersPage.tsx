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
import { suppliers as mockSuppliers } from "../data/mockSuppliers";
import { useCollection } from "../context/DataContext";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDays,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { IconSuppliers, IconAlerts, IconOrders } from "../components/ui/icons";
import { supplierFulfillment } from "../utils/supplierPerf";
import { supplierSeasonality } from "../utils/seasonality";
import { Link } from "react-router-dom";
import type { Supplier } from "../types/purchasing";

export function SuppliersPage() {
  const navigate = useNavigate();
  const suppliers = useCollection<Supplier>("suppliers", mockSuppliers);
  const [query, setQuery] = useUrlState("q");
  const [status, setStatus] = useUrlState("estado");

  const filtered = useMemo(
    () =>
      suppliers.filter((s) => {
        if (query.trim() && !`${s.name} ${s.rut}`.toLowerCase().includes(query.toLowerCase()))
          return false;
        if (status && s.status !== status) return false;
        return true;
      }),
    [suppliers, query, status]
  );

  // KPIs según el resultado filtrado
  const delayed = filtered.filter((s) => s.status === "delayed").length;
  const lowCompliance = filtered.filter((s) => s.deliveryCompliance < 70).length;
  const totalPending = filtered.reduce((a, s) => a + s.pendingAmount, 0);
  const openOCs = filtered.reduce((a, s) => a + s.openPurchaseOrders, 0);

  const mostDelayed = [...suppliers]
    .sort((a, b) => a.deliveryCompliance - b.deliveryCompliance)
    .slice(0, 4);
  const biggestBuy = [...suppliers]
    .sort((a, b) => b.purchasedAmountLast90Days - a.purchasedAmountLast90Days)
    .slice(0, 4);
  const highLeadTime = [...suppliers]
    .sort((a, b) => b.averageLeadTimeDays - a.averageLeadTimeDays)
    .slice(0, 4);

  // Proveedores que entran en temporada alta pronto (negociar antes)
  const entranTemporada = suppliers
    .filter((s) => s.status !== "inactive")
    .map((s) => ({ s, seas: supplierSeasonality(s.name) }))
    .filter((x) => x.seas.preSeason !== null)
    .sort((a, b) => {
      const ra = (a.seas.classification.risky ? 0 : 1) - (b.seas.classification.risky ? 0 : 1);
      return ra !== 0 ? ra : a.seas.preSeason!.days - b.seas.preSeason!.days;
    });

  const columns: Column<Supplier>[] = [
    {
      key: "name",
      header: "Proveedor",
      render: (s) => (
        <div>
          <p className="font-medium text-slate-800">{s.name}</p>
          <p className="text-xs text-slate-400 font-mono">{s.rut}</p>
        </div>
      ),
    },
    {
      key: "categories",
      header: "Categorías",
      hideOnMobile: true,
      render: (s) => (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {s.categories.map((c) => (
            <Badge key={c} tone="neutral">
              {c}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "skus",
      header: "SKUs",
      align: "right",
      hideOnMobile: true,
      render: (s) => formatNumber(s.associatedSkus),
    },
    {
      key: "openOc",
      header: "OC abiertas",
      align: "right",
      render: (s) => formatNumber(s.openPurchaseOrders),
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
      render: (s) => (
        <span
          className={
            s.deliveryCompliance < 70
              ? "text-rose-600 font-semibold"
              : s.deliveryCompliance < 85
                ? "text-amber-600 font-medium"
                : "text-emerald-600 font-medium"
          }
        >
          {formatPercent(s.deliveryCompliance, 0)}
        </span>
      ),
    },
    {
      key: "fill",
      header: (
        <span className="inline-flex items-center gap-1">
          Despacho
          <MetricHint metric="despacho" />
        </span>
      ),
      align: "right",
      render: (s) => {
        const f = supplierFulfillment(s.name);
        const tone =
          f.tone === "red"
            ? "text-rose-600 font-semibold"
            : f.tone === "amber"
              ? "text-amber-600 font-medium"
              : "text-emerald-600 font-medium";
        return (
          <div className="text-sm min-w-[96px]">
            <span className={tone}>{f.arrivedOrders > 0 ? `${f.fillRate}%` : "—"}</span>
            {f.undeliveredSkus > 0 && (
              <p className="text-[11px] text-rose-500">{f.undeliveredSkus} SKU sin despachar</p>
            )}
          </div>
        );
      },
    },
    {
      key: "leadTime",
      header: (
        <span className="inline-flex items-center gap-1">
          Lead time
          <MetricHint metric="leadTime" />
        </span>
      ),
      align: "right",
      hideOnMobile: true,
      render: (s) => formatDays(s.averageLeadTimeDays),
    },
    {
      key: "lastPurchase",
      header: "Última compra",
      align: "right",
      hideOnMobile: true,
      render: (s) => formatDate(s.lastPurchaseDate),
    },
    {
      key: "buy90",
      header: "Compra 90 días",
      align: "right",
      hideOnMobile: true,
      render: (s) => formatCurrencyCompact(s.purchasedAmountLast90Days),
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
      render: (s) => (
        <span
          className={s.pendingAmount > 20000000 ? "text-amber-600 font-medium" : "text-slate-700"}
        >
          {formatCurrency(s.pendingAmount)}
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
      <PageHeader
        title="Proveedores"
        description="Gestión de proveedores con foco en cumplimiento, lead time y monto pendiente. Información para decidir si seguir comprando a cada uno."
      />

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por nombre o RUT"
          resultCount={filtered.length}
          summary={`${filtered.length} proveedor${filtered.length === 1 ? "" : "es"} · ${delayed} atrasado${delayed === 1 ? "" : "s"} · ${lowCompliance} por revisar`}
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
                { value: "review", label: "Revisar" },
                { value: "delayed", label: "Atrasado" },
                { value: "blocked", label: "Bloqueado" },
                { value: "inactive", label: "Sin compras" },
              ],
            },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Proveedores atrasados"
          value={formatNumber(delayed)}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
        />
        <KpiCard
          title="Bajo cumplimiento (<70%)"
          value={formatNumber(lowCompliance)}
          tone="warn"
          icon={<IconSuppliers className="w-4 h-4" />}
          info={<MetricHint metric="cumplimiento" />}
        />
        <KpiCard
          title="OC abiertas (total)"
          value={formatNumber(openOCs)}
          tone="neutral"
          icon={<IconOrders className="w-4 h-4" />}
        />
        <KpiCard
          title="Monto pendiente total"
          value={formatCurrencyCompact(totalPending)}
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
            value: formatPercent(s.deliveryCompliance, 0),
            tone: "red" as const,
            sub: `${s.openPurchaseOrders} OC abiertas`,
          }))}
        />
        <MiniRank
          title="Mayor compra (90 días)"
          items={biggestBuy.map((s) => ({
            name: s.name,
            value: formatCurrencyCompact(s.purchasedAmountLast90Days),
            tone: "green" as const,
            sub: `${formatNumber(s.associatedSkus)} SKUs`,
          }))}
        />
        <MiniRank
          title="Lead time más alto"
          items={highLeadTime.map((s) => ({
            name: s.name,
            value: formatDays(s.averageLeadTimeDays),
            tone: "amber" as const,
            sub: `Cumple ${formatPercent(s.deliveryCompliance, 0)}`,
          }))}
        />
      </div>

      {entranTemporada.length > 0 && (
        <Card className="mb-5">
          <CardHeader
            title="Entran en temporada próximamente"
            description="Negocia antes del peak: stock reservado, fill mínimo y despacho anticipado"
          />
          <CardBody className="space-y-2">
            {entranTemporada.map(({ s, seas }) => (
              <Link
                key={s.id}
                to={`/proveedores/${s.id}?tab=temporadas`}
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-slate-800 truncate">
                    {s.name}
                  </span>
                  <span className="block text-xs text-slate-400">
                    Temporada alta {seas.preSeason!.month} (~{seas.preSeason!.days} días) · fill{" "}
                    {seas.fill}% · lead {formatDays(s.averageLeadTimeDays)}
                  </span>
                </span>
                <Badge tone={seas.classification.risky ? "red" : "amber"}>
                  {seas.classification.risky ? "Riesgo de quiebre" : "Preparar compra"}
                </Badge>
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(s) => s.id}
          onRowClick={(s) => navigate(`/proveedores/${s.id}`)}
          mobileCard={(s) => {
            const f = supplierFulfillment(s.name);
            return (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{s.rut}</p>
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
                        s.deliveryCompliance < 70 ? "text-rose-600 font-semibold" : "text-slate-700"
                      }
                    >
                      {formatPercent(s.deliveryCompliance, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      Despacho
                      <MetricHint metric="despacho" />
                    </p>
                    <p
                      className={
                        f.tone === "red"
                          ? "text-rose-600 font-semibold"
                          : f.tone === "amber"
                            ? "text-amber-600 font-medium"
                            : "text-slate-700"
                      }
                    >
                      {f.arrivedOrders > 0 ? `${f.fillRate}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      Lead time
                      <MetricHint metric="leadTime" />
                    </p>
                    <p className="text-slate-700">{formatDays(s.averageLeadTimeDays)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">OC abiertas</p>
                    <p className="text-slate-700">{formatNumber(s.openPurchaseOrders)}</p>
                  </div>
                </div>
              </div>
            );
          }}
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
        {items.map((it) => (
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
        ))}
      </CardBody>
    </Card>
  );
}
