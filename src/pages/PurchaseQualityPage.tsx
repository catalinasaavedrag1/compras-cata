import { useUrlState } from "../utils/useUrlState";
import { Link } from "react-router-dom";
import { supplierPath } from "../utils/entityLinks";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { KpiCard } from "../components/business/KpiCard";
import { FilterBar } from "../components/business/FilterBar";
import { InfoHint } from "../components/business/InfoHint";
import { Badge } from "../components/ui/Badge";
import { DataTable, type Column } from "../components/ui/Table";
import {
  PURCHASE_CLASS,
  type PurchaseClass,
  type PurchaseQualityLine,
} from "../utils/purchaseQuality";
import { usePurchaseQuality } from "../hooks/usePurchaseQuality";
import { IconOrders, IconCheck, IconAlerts } from "../components/ui/icons";
import { formatCurrencyCompact, formatDays, formatNumber } from "../utils/formatters";

export function PurchaseQualityPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { lines, loading, error, configured, refetch } = usePurchaseQuality();
  const [query, setQuery] = useUrlState("q");
  const [klass, setKlass] = useUrlState("tipo");

  const filtered = lines.filter((l) => {
    if (
      query.trim() &&
      !`${l.productName} ${l.sku} ${l.categoryName} ${l.supplierName}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
      return false;
    if (klass && l.klass !== klass) return false;
    return true;
  });

  const countOf = (k: PurchaseClass) => lines.filter((l) => l.klass === k).length;
  const conVenta = lines.filter((l) => l.klass !== "sin_venta").length;
  const saludablePct = conVenta > 0 ? Math.round((countOf("saludable") / conVenta) * 100) : 0;

  const pageTitle = "Calidad de compra";
  const pageDescription =
    "Mide si el surtido está bien cubierto: la cobertura actual de cada SKU (dato del motor) frente al rango objetivo de la regla de compra aplicable. Detecta coberturas cortas y sobrestock.";

  // --------------------------------------------------------------------------
  //  Estados de conexión (patrón flujo 1): sin configurar, cargando, error.
  // --------------------------------------------------------------------------
  if (!configured) {
    return (
      <div>
        {!embedded && <PageHeader title={pageTitle} description={pageDescription} />}
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              evaluar la calidad de compra con datos reales del motor y las reglas.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && lines.length === 0) {
    return (
      <div>
        {!embedded && <PageHeader title={pageTitle} description={pageDescription} />}
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando calidad de compra">
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

  if (error && lines.length === 0) {
    return (
      <div>
        {!embedded && <PageHeader title={pageTitle} description={pageDescription} />}
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudo cargar la calidad de compra
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

  const columns: Column<PurchaseQualityLine>[] = [
    {
      key: "product",
      header: "Producto",
      render: (l) => (
        <div className="min-w-0">
          <Link
            to={`/productos/${l.sku}`}
            className="text-sm font-medium text-slate-800 hover:text-brand-700 truncate block"
          >
            {l.productName}
          </Link>
          <p className="text-xs text-slate-400">
            {l.sku} · {l.categoryName}
          </p>
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Proveedor",
      hideOnMobile: true,
      render: (l) => (
        <Link
          to={supplierPath(l.supplierName)}
          className="text-sm text-slate-600 hover:text-brand-700 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {l.supplierName}
        </Link>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      render: (l) => (
        <span className="text-sm">
          {l.stockUnits != null ? `${formatNumber(l.stockUnits)} u.` : "—"}
        </span>
      ),
    },
    {
      key: "coverage",
      header: "Cobertura actual",
      align: "right",
      render: (l) => (
        <span className="text-sm font-semibold text-slate-800">
          {l.klass === "sin_venta" || l.coverageDays == null ? "—" : formatDays(l.coverageDays)}
        </span>
      ),
    },
    {
      key: "obj",
      header: "Objetivo",
      align: "right",
      hideOnMobile: true,
      render: (l) => (
        <span className="text-xs text-slate-400">
          {l.objMin}–{l.objMax} d
        </span>
      ),
    },
    {
      key: "value",
      header: "Valor a costo",
      align: "right",
      hideOnMobile: true,
      render: (l) => (
        <span className="text-sm text-slate-600">
          {l.stockValueClp != null ? formatCurrencyCompact(l.stockValueClp) : "—"}
        </span>
      ),
    },
    {
      key: "klass",
      header: "Resultado",
      render: (l) => (
        <Badge tone={PURCHASE_CLASS[l.klass].tone}>{PURCHASE_CLASS[l.klass].label}</Badge>
      ),
    },
  ];

  return (
    <div>
      {!embedded && (
        <PageHeader
          title={pageTitle}
          description={pageDescription}
          help={
            <InfoHint label="Qué es la cobertura actual">
              <p>
                <b>Cobertura actual</b> = stock disponible ÷ venta diaria esperada (días), calculada
                por el motor con datos reales.
              </p>
              <p>
                Si el objetivo es 30–45 días y la cobertura es 8, hay <b>cobertura corta</b> (riesgo
                de quiebre). Si es 150, hay <b>sobrestock</b> (capital inmovilizado).
              </p>
              <p>El objetivo sale de la regla de compra aplicable a cada producto o categoría.</p>
            </InfoHint>
          }
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <KpiCard
          title="SKU evaluados"
          value={formatNumber(lines.length)}
          tone="neutral"
          icon={<IconOrders className="w-4 h-4" />}
        />
        <KpiCard
          title="Coberturas saludables"
          value={formatNumber(countOf("saludable"))}
          tone="good"
          icon={<IconCheck className="w-4 h-4" />}
          description={`${saludablePct}% de los con venta`}
        />
        <KpiCard
          title="Coberturas cortas"
          value={formatNumber(countOf("corta"))}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
        />
        <KpiCard
          title="Coberturas altas"
          value={formatNumber(countOf("alta"))}
          tone="warn"
          icon={<IconAlerts className="w-4 h-4" />}
        />
        <KpiCard
          title="Sobrestock"
          value={formatNumber(countOf("sobrecompra"))}
          tone="warn"
          icon={<IconAlerts className="w-4 h-4" />}
        />
      </div>

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar producto, SKU, categoría o proveedor"
          resultCount={filtered.length}
          summary={`${filtered.length} SKU${filtered.length === 1 ? "" : "s"}`}
          onClear={() => {
            setQuery("");
            setKlass("");
          }}
          selects={[
            {
              key: "klass",
              placeholder: "Resultado",
              value: klass,
              onChange: setKlass,
              options: (Object.keys(PURCHASE_CLASS) as PurchaseClass[]).map((k) => ({
                value: k,
                label: PURCHASE_CLASS[k].label,
              })),
            },
          ]}
        />
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(l) => l.sku}
          mobileCard={(l) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{l.productName}</p>
                  <p className="text-xs text-slate-400">
                    {l.sku} · {l.categoryName}
                  </p>
                </div>
                <Badge tone={PURCHASE_CLASS[l.klass].tone} dot={false}>
                  {PURCHASE_CLASS[l.klass].label}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Stock</p>
                  <p className="text-slate-700">
                    {l.stockUnits != null ? `${formatNumber(l.stockUnits)} u.` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Cobertura</p>
                  <p className="text-slate-700">
                    {l.klass === "sin_venta" || l.coverageDays == null
                      ? "—"
                      : formatDays(l.coverageDays)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Objetivo</p>
                  <p className="text-slate-700">
                    {l.objMin}–{l.objMax} d
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
