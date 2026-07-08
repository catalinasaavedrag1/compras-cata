import { useMemo } from "react";
import { useUrlState } from "../utils/useUrlState";
import { Link } from "react-router-dom";
import { supplierPath } from "../utils/entityLinks";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { FilterBar } from "../components/business/FilterBar";
import { HelpNote } from "../components/business/HelpNote";
import { Badge } from "../components/ui/Badge";
import { DataTable, type Column } from "../components/ui/Table";
import {
  purchaseQualityLines,
  PURCHASE_CLASS,
  type PurchaseClass,
  type PurchaseQualityLine,
} from "../utils/purchaseQuality";
import { useBuyer } from "../context/BuyerContext";
import { useRole } from "../context/RoleContext";
import { IconOrders, IconCheck, IconAlerts } from "../components/ui/icons";
import { formatCurrencyCompact, formatNumber } from "../utils/formatters";

export function PurchaseQualityPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { buyer } = useBuyer();
  const { role } = useRole();
  const all = useMemo(() => {
    const lines = purchaseQualityLines();
    // El comprador solo evalúa SUS compras; el líder ve las de todo el equipo.
    return role === "lider" ? lines : lines.filter((l) => l.buyerName === buyer);
  }, [role, buyer]);
  const [query, setQuery] = useUrlState("q");
  const [klass, setKlass] = useUrlState("tipo");

  const filtered = all.filter((l) => {
    if (
      query.trim() &&
      !`${l.productName} ${l.sku} ${l.poNumber} ${l.buyerName} ${l.supplierName}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
      return false;
    if (klass && l.klass !== klass) return false;
    return true;
  });

  const countOf = (k: PurchaseClass) => all.filter((l) => l.klass === k).length;
  const conVenta = all.filter((l) => l.klass !== "sin_venta").length;
  const saludablePct = conVenta > 0 ? Math.round((countOf("saludable") / conVenta) * 100) : 0;

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
            {l.poNumber} · {l.buyerName}
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
      key: "qty",
      header: "Comprado",
      align: "right",
      render: (l) => <span className="text-sm">{formatNumber(l.quantity)} u.</span>,
    },
    {
      key: "dias",
      header: "Días comprados",
      align: "right",
      render: (l) => (
        <div className="text-sm">
          <span className="font-semibold text-slate-800">
            {l.klass === "sin_venta" ? "—" : `${l.diasComprados} d`}
          </span>
        </div>
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
      key: "amount",
      header: "Monto",
      align: "right",
      hideOnMobile: true,
      render: (l) => (
        <span className="text-sm text-slate-600">{formatCurrencyCompact(l.amount)}</span>
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
          title="Calidad de compra"
          description="Mide si se compró bien: los 'días comprados' (cantidad ÷ venta diaria) frente al rango objetivo de cobertura de cada producto. Detecta compras cortas y sobrecompras."
        />
      )}

      <HelpNote className="mb-4">
        <b>Días comprados</b> = cantidad comprada ÷ venta diaria esperada. Si el objetivo es 30–45
        días y se compró para 8, fue una <b>compra corta</b> (riesgo de quiebre). Si se compró para
        150, fue una <b>sobrecompra</b> (capital inmovilizado). El objetivo sale de la regla de
        compra aplicable a cada producto.
      </HelpNote>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <KpiCard
          title="Líneas evaluadas"
          value={formatNumber(all.length)}
          tone="neutral"
          icon={<IconOrders className="w-4 h-4" />}
        />
        <KpiCard
          title="Compras saludables"
          value={formatNumber(countOf("saludable"))}
          tone="good"
          icon={<IconCheck className="w-4 h-4" />}
          description={`${saludablePct}% del total`}
        />
        <KpiCard
          title="Compras cortas"
          value={formatNumber(countOf("corta"))}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
        />
        <KpiCard
          title="Compras altas"
          value={formatNumber(countOf("alta"))}
          tone="warn"
          icon={<IconAlerts className="w-4 h-4" />}
        />
        <KpiCard
          title="Sobrecompras"
          value={formatNumber(countOf("sobrecompra"))}
          tone="warn"
          icon={<IconAlerts className="w-4 h-4" />}
        />
      </div>

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar producto, OC, comprador o proveedor"
          resultCount={filtered.length}
          summary={`${filtered.length} línea${filtered.length === 1 ? "" : "s"} de compra`}
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
          rowKey={(l) => `${l.poId}-${l.sku}`}
          mobileCard={(l) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{l.productName}</p>
                  <p className="text-xs text-slate-400">
                    {l.poNumber} · {l.buyerName}
                  </p>
                </div>
                <Badge tone={PURCHASE_CLASS[l.klass].tone} dot={false}>
                  {PURCHASE_CLASS[l.klass].label}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Comprado</p>
                  <p className="text-slate-700">{formatNumber(l.quantity)} u.</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Días</p>
                  <p className="text-slate-700">
                    {l.klass === "sin_venta" ? "—" : `${l.diasComprados} d`}
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
