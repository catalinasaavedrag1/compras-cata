import { useMemo } from "react";
import { useUrlState } from "../utils/useUrlState";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { FilterBar } from "../components/business/FilterBar";
import { HelpNote } from "../components/business/HelpNote";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { lostOpportunities } from "../utils/lostOpportunities";
import { supplierPath, categoryPath } from "../utils/entityLinks";
import { getProductBySku } from "../data/mockProducts";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { IconBulb, IconCheck, IconPlus } from "../components/ui/icons";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../utils/formatters";

export function LostOpportunitiesPage() {
  const all = useMemo(() => lostOpportunities(), []);
  const { addItem, hasItem } = useOcDraft();
  const toast = useToast();
  const [query, setQuery] = useUrlState("q");
  const [motivo, setMotivo] = useUrlState("motivo");

  const motivos = useMemo(() => [...new Set(all.map((o) => o.motivo))], [all]);

  const filtered = all.filter((o) => {
    if (query.trim() && !`${o.name} ${o.sku} ${o.category}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (motivo && o.motivo !== motivo) return false;
    return true;
  });

  const ventaPerdidaTotal = all.reduce((a, o) => a + o.ventaPerdida, 0);

  const reponer = (sku: string, name: string, supplierName: string, histMonthly: number) => {
    const p = getProductBySku(sku);
    addItem({ sku, productName: name, supplierName, quantity: histMonthly, unitCost: p?.cost ?? 0 });
    toast.success(`${name} agregado al borrador de OC (${formatNumber(histMonthly)} u.)`);
  };

  return (
    <div>
      <PageHeader
        title="Oportunidades no capturadas"
        description="Productos que vendían, quedaron sin stock y no se volvieron a comprar — mientras la categoría siguió vendiendo. Venta que se está perdiendo por no comprar, no por falta de demanda."
      />

      <HelpNote className="mb-4">
        Venta cero no siempre es falta de demanda. Si un producto <b>vendía históricamente</b>, <b>quedó sin stock</b>,
        <b> no se volvió a comprar</b> y la <b>categoría siguió vendiendo</b>, es una oportunidad no capturada. La venta
        perdida estimada es lo que dejas de vender cada mes mientras no repones.
      </HelpNote>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <KpiCard title="Oportunidades detectadas" value={formatNumber(all.length)} tone="warn" icon={<IconBulb className="w-4 h-4" />} />
        <KpiCard title="Venta perdida estimada" value={`${formatCurrencyCompact(ventaPerdidaTotal)}/mes`} tone="bad" icon={<IconBulb className="w-4 h-4" />} />
        <KpiCard title="Por reponer urgente" value={formatNumber(all.filter((o) => o.tone === "red").length)} tone="bad" icon={<IconBulb className="w-4 h-4" />} />
      </div>

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar producto, SKU o categoría"
          resultCount={filtered.length}
          summary={`${filtered.length} oportunidad${filtered.length === 1 ? "" : "es"} · ${formatCurrencyCompact(filtered.reduce((a, o) => a + o.ventaPerdida, 0))}/mes en juego`}
          onClear={() => { setQuery(""); setMotivo(""); }}
          selects={[
            { key: "motivo", placeholder: "Motivo", value: motivo, onChange: setMotivo, options: motivos.map((m) => ({ value: m, label: m })) },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody><EmptyState title="Sin oportunidades no capturadas" description="No hay productos que cumplan el patrón con los filtros actuales." /></CardBody></Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((o) => (
            <Card key={o.sku}>
              <CardBody>
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link to={`/productos/${o.sku}`} className="text-sm font-semibold text-slate-900 hover:text-brand-700 truncate">{o.name}</Link>
                      <Badge tone={o.tone}>{o.motivo}</Badge>
                    </div>
                    <p className="text-xs text-slate-500"><Link to={categoryPath(o.category)} className="hover:text-brand-600 hover:underline">{o.category}</Link> · <Link to={supplierPath(o.supplierName)} className="hover:text-brand-600 hover:underline">{o.supplierName}</Link> · vendía ~{formatNumber(o.histMonthly)}/mes · ahora {formatNumber(o.recent)}/mes</p>
                    <p className="text-xs text-slate-500 mt-1">{o.insight}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Venta perdida</p>
                      <p className="text-base font-semibold text-rose-600">{formatCurrency(o.ventaPerdida)}<span className="text-xs font-normal text-slate-400">/mes</span></p>
                    </div>
                    <Button
                      size="sm"
                      variant={hasItem(o.sku) ? "secondary" : "primary"}
                      disabled={hasItem(o.sku)}
                      icon={hasItem(o.sku) ? <IconCheck className="w-4 h-4" /> : <IconPlus className="w-4 h-4" />}
                      onClick={() => reponer(o.sku, o.name, o.supplierName, o.histMonthly)}
                    >
                      {hasItem(o.sku) ? "En OC" : "Reponer"}
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
