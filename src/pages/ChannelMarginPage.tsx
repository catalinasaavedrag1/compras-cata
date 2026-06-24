import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { FilterBar } from "../components/business/FilterBar";
import { ExportButton } from "../components/business/ExportButton";
import { Badge } from "../components/ui/Badge";
import { DataTable, type Column, type SortState } from "../components/ui/Table";
import { useUrlState, useUrlToggle } from "../utils/useUrlState";
import { useState } from "react";
import { useBuyer } from "../context/BuyerContext";
import { Select } from "../components/ui/Select";
import { channelMargins, CHANNEL_LABELS, MARGIN_STATUS } from "../data/mockChannelMargin";
import { uniqueValues } from "../utils/filters";
import { formatCurrency, formatNumber, formatPercent, formatDelta } from "../utils/formatters";
import { IconSales, IconAlerts, IconBox, IconArrowRight } from "../components/ui/icons";
import type { ChannelMargin } from "../types/purchasing";

export function ChannelMarginPage() {
  const navigate = useNavigate();
  const { buyer, buyers } = useBuyer();
  const [sort, setSort] = useState<SortState>({ key: null, dir: "asc" });
  const [scope, setScope] = useUrlState("alcance", "mias");
  const [query, setQuery] = useUrlState("q");
  const [channel, setChannel] = useUrlState("canal");
  const [estado, setEstado] = useUrlState("estado");
  const [category, setCategory] = useUrlState("cat");
  const [supplier, setSupplier] = useUrlState("prov");
  const [withCommission, toggleCommission] = useUrlToggle("comision");
  const [withDiscount, toggleDiscount] = useUrlToggle("descuento");

  // Alcance: mis categorías (comprador actual), todos, o un comprador específico
  const scoped = useMemo(() => {
    if (scope === "todos") return channelMargins;
    const target = scope === "mias" ? buyer : scope;
    return channelMargins.filter((c) => c.buyer === target);
  }, [scope, buyer]);

  const scopeLabel =
    scope === "todos" ? "Todos los compradores" : scope === "mias" ? `Mis categorías (${buyer})` : `Comprador ${scope}`;

  const filtered = useMemo(() => {
    const res = scoped.filter((c) => {
      if (query.trim() && !`${c.sku} ${c.productName}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (channel && c.channel !== channel) return false;
      if (estado && c.status !== estado) return false;
      if (category && c.category !== category) return false;
      if (supplier && c.supplierName !== supplier) return false;
      if (withCommission && c.commission <= 0) return false;
      if (withDiscount && c.discount <= 0) return false;
      return true;
    });
    if (sort.key) {
      const f = sort.dir === "asc" ? 1 : -1;
      const get = (c: ChannelMargin) =>
        sort.key === "margin" ? c.marginPct : sort.key === "price" ? c.finalPrice : sort.key === "sales" ? c.sales30 : c.marginPct - c.targetMarginPct;
      return [...res].sort((a, b) => (get(a) - get(b)) * f);
    }
    // por defecto: peor margen primero
    return [...res].sort((a, b) => a.marginPct - b.marginPct);
  }, [scoped, query, channel, estado, category, supplier, withCommission, withDiscount, sort]);

  // KPIs según el alcance seleccionado, cliqueables para filtrar
  const low = scoped.filter((c) => c.status === "low").length;
  const negative = scoped.filter((c) => c.status === "negative").length;
  const over = scoped.filter((c) => c.status === "over").length;
  const lowMkt = scoped.filter((c) => c.status === "low" && c.channel === "marketplace").length;
  const lowWeb = scoped.filter((c) => c.status === "low" && c.channel === "web").length;
  const lowStore = scoped.filter((c) => c.status === "low" && c.channel === "store").length;

  const setFilter = (e: string, ch: string) => {
    setEstado(e);
    setChannel(ch);
  };

  const clearFilters = () => {
    setQuery(""); setChannel(""); setEstado(""); setCategory(""); setSupplier("");
    if (withCommission) toggleCommission();
    if (withDiscount) toggleDiscount();
  };

  const columns: Column<ChannelMargin>[] = [
    {
      key: "product",
      header: "Producto",
      render: (c) => (
        <div className="min-w-[180px]">
          <span className="text-xs font-mono text-slate-400">{c.sku}</span>
          <p className="font-medium text-slate-800 leading-snug">{c.productName}</p>
          <p className="text-xs text-slate-500">{c.category}</p>
        </div>
      ),
    },
    { key: "channel", header: "Canal", render: (c) => <Badge tone="neutral">{CHANNEL_LABELS[c.channel]}</Badge> },
    {
      key: "buyer",
      header: "Comprador",
      hideOnMobile: true,
      render: (c) => (
        <button
          onClick={(e) => { e.stopPropagation(); setScope(c.buyer); }}
          className="text-sm text-slate-600 hover:text-brand-600"
          title="Ver solo este comprador"
        >
          {c.buyer}
        </button>
      ),
    },
    { key: "price", header: "Precio final", align: "right", sortable: true, sortValue: (c) => c.finalPrice, render: (c) => formatCurrency(c.finalPrice) },
    { key: "cost", header: "Costo", align: "right", hideOnMobile: true, render: (c) => formatCurrency(c.cost) },
    { key: "commission", header: "Comisión", align: "right", hideOnMobile: true, render: (c) => (c.commission > 0 ? formatCurrency(c.commission) : <span className="text-slate-300">—</span>) },
    {
      key: "margin",
      header: "Margen",
      align: "right",
      sortable: true,
      sortValue: (c) => c.marginPct,
      render: (c) => (
        <div className="text-sm">
          <p className={c.marginPct < 0 ? "text-rose-600 font-semibold" : c.status === "low" ? "text-amber-600 font-medium" : "text-slate-700"}>
            {formatPercent(c.marginPct)}
          </p>
          <p className="text-xs text-slate-400">obj. {formatPercent(c.targetMarginPct, 0)}</p>
        </div>
      ),
    },
    {
      key: "diff",
      header: "Dif. vs obj.",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (c) => c.marginPct - c.targetMarginPct,
      render: (c) => {
        const d = Math.round((c.marginPct - c.targetMarginPct) * 10) / 10;
        return <span className={d < 0 ? "text-rose-600" : "text-emerald-600"}>{formatDelta(d)}</span>;
      },
    },
    { key: "sales", header: "Venta 30d", align: "right", hideOnMobile: true, sortable: true, sortValue: (c) => c.sales30, render: (c) => formatNumber(c.sales30) },
    {
      key: "suggested",
      header: "Precio sugerido",
      align: "right",
      hideOnMobile: true,
      render: (c) =>
        c.status === "low" || c.status === "negative" ? (
          <span className="font-medium text-brand-700">{formatCurrency(c.suggestedPrice)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    { key: "status", header: "Estado", render: (c) => <Badge tone={MARGIN_STATUS[c.status].tone} dot>{MARGIN_STATUS[c.status].label}</Badge> },
    {
      key: "action",
      header: "Acción / Causa",
      hideOnMobile: true,
      render: (c) => (
        <div className="max-w-xs">
          <p className="text-xs text-slate-600 leading-snug">{c.action}</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-snug">{c.cause}</p>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Margen por canal"
        description="Compara precio y margen del mismo SKU entre marketplace, web y tienda. Detecta dónde el margen es bajo, negativo o excesivo y qué lo explica (precio, costo, comisión o descuento)."
        action={
          <ExportButton
            filename="margen-por-canal"
            rows={filtered}
            columns={[
              { label: "SKU", value: (c) => c.sku },
              { label: "Producto", value: (c) => c.productName },
              { label: "Canal", value: (c) => CHANNEL_LABELS[c.channel] },
              { label: "Precio final", value: (c) => c.finalPrice },
              { label: "Costo", value: (c) => c.cost },
              { label: "Comisión", value: (c) => c.commission },
              { label: "Descuento", value: (c) => c.discount },
              { label: "Margen %", value: (c) => c.marginPct },
              { label: "Margen objetivo %", value: (c) => c.targetMarginPct },
              { label: "Precio sugerido", value: (c) => c.suggestedPrice },
              { label: "Estado", value: (c) => MARGIN_STATUS[c.status].label },
            ]}
          />
        }
      />

      {/* Alcance de la vista: mi cartera vs. global */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="sm:w-72">
          <Select
            label="Viendo"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            options={[
              { value: "mias", label: `Mis categorías (${buyer})` },
              { value: "todos", label: "Todos los compradores" },
              ...buyers.filter((b) => b !== buyer).map((b) => ({ value: b, label: `Comprador: ${b}` })),
            ]}
          />
        </div>
        <span className="text-xs text-slate-500 sm:self-end sm:pb-2">
          Alcance activo: <b className="text-slate-700">{scopeLabel}</b> · {scoped.length} registros
        </span>
      </div>

      <HelpNote className="mb-4">
        Un mismo producto deja distinto margen según el canal: el <b>marketplace</b> suele bajar por la
        comisión, la <b>tienda</b> puede quedar sobre marginada. Toca un KPI para filtrar, y abre un SKU
        para ver la comparación por canal y el <b>precio sugerido</b> para alcanzar el objetivo.
      </HelpNote>

      {/* Filtros arriba */}
      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar SKU o producto"
          resultCount={filtered.length}
          summary={`${filtered.length} registros · ${negative} negativos · ${low} bajo margen`}
          onClear={clearFilters}
          selects={[
            { key: "canal", placeholder: "Canal", value: channel, onChange: setChannel, options: Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label })) },
            { key: "estado", placeholder: "Estado margen", value: estado, onChange: setEstado, options: Object.entries(MARGIN_STATUS).map(([value, cfg]) => ({ value, label: cfg.label })) },
            { key: "cat", placeholder: "Categoría", value: category, onChange: setCategory, options: uniqueValues(channelMargins, (c) => c.category).map((c) => ({ value: c, label: c })) },
            { key: "prov", placeholder: "Proveedor", value: supplier, onChange: setSupplier, options: uniqueValues(channelMargins.filter((c) => c.supplierName), (c) => c.supplierName).map((c) => ({ value: c, label: c })) },
          ]}
          toggles={[
            { key: "comision", label: "Con comisión", active: withCommission, onToggle: toggleCommission },
            { key: "descuento", label: "Con descuento", active: withDiscount, onToggle: toggleDiscount },
          ]}
        />
      </div>

      {/* KPIs cliqueables (filtran la vista) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        <KpiCard title="Bajo margen" value={formatNumber(low)} tone="warn" icon={<IconAlerts className="w-4 h-4" />} active={estado === "low" && !channel} onClick={() => setFilter("low", "")} description="Filtrar" />
        <KpiCard title="Margen negativo" value={formatNumber(negative)} tone="bad" icon={<IconAlerts className="w-4 h-4" />} active={estado === "negative"} onClick={() => setFilter("negative", "")} description="Filtrar" />
        <KpiCard title="Sobre marginados" value={formatNumber(over)} tone="warn" icon={<IconBox className="w-4 h-4" />} active={estado === "over"} onClick={() => setFilter("over", "")} description="Filtrar" />
        <KpiCard title="Bajo margen · Marketplace" value={formatNumber(lowMkt)} tone="warn" icon={<IconSales className="w-4 h-4" />} active={estado === "low" && channel === "marketplace"} onClick={() => setFilter("low", "marketplace")} description="Filtrar" />
        <KpiCard title="Bajo margen · Web" value={formatNumber(lowWeb)} tone="warn" icon={<IconSales className="w-4 h-4" />} active={estado === "low" && channel === "web"} onClick={() => setFilter("low", "web")} description="Filtrar" />
        <KpiCard title="Bajo margen · Tienda" value={formatNumber(lowStore)} tone="warn" icon={<IconSales className="w-4 h-4" />} active={estado === "low" && channel === "store"} onClick={() => setFilter("low", "store")} description="Filtrar" />
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(c) => `${c.sku}-${c.channel}`}
          onRowClick={(c) => navigate(`/productos/${c.sku}?tab=margen`)}
          sort={sort}
          onSortChange={(key) => setSort((p) => (p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }))}
          rowClassName={(c) => (c.status === "negative" ? "bg-rose-50/40" : undefined)}
          emptyMessage="No hay registros de margen con estos filtros."
          mobileCard={(c) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-mono text-slate-400">{c.sku}</span>
                  <p className="font-medium text-slate-800 leading-snug">{c.productName}</p>
                  <p className="text-xs text-slate-500">{CHANNEL_LABELS[c.channel]}</p>
                </div>
                <Badge tone={MARGIN_STATUS[c.status].tone} dot>{MARGIN_STATUS[c.status].label}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                <div><p className="text-xs text-slate-400">Precio</p><p className="text-slate-700">{formatCurrency(c.finalPrice)}</p></div>
                <div><p className="text-xs text-slate-400">Margen</p><p className={c.marginPct < 0 ? "text-rose-600 font-semibold" : "text-slate-700"}>{formatPercent(c.marginPct)}</p></div>
                <div><p className="text-xs text-slate-400">Objetivo</p><p className="text-slate-700">{formatPercent(c.targetMarginPct, 0)}</p></div>
              </div>
              {(c.status === "low" || c.status === "negative") && (
                <p className="text-xs text-brand-700 mt-1.5 inline-flex items-center gap-1">
                  Precio sugerido {formatCurrency(c.suggestedPrice)} <IconArrowRight className="w-3 h-3" />
                </p>
              )}
            </div>
          )}
        />
      </Card>
    </div>
  );
}
