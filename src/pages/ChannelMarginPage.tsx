import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { FilterBar } from "../components/business/FilterBar";
import { ExportButton } from "../components/business/ExportButton";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Tabs } from "../components/ui/Tabs";
import { useUrlState, useUrlToggle } from "../utils/useUrlState";
import { useBuyer } from "../context/BuyerContext";
import { useToast } from "../context/ToastContext";
import { channelMargins, CHANNEL_LABELS, MARGIN_STATUS } from "../data/mockChannelMargin";
import { uniqueValues } from "../utils/filters";
import { formatCurrency, formatNumber, formatPercent } from "../utils/formatters";
import { IconSales, IconAlerts, IconBox } from "../components/ui/icons";
import type { ChannelMargin, MarginChannelKey } from "../types/purchasing";

const CHANNEL_ORDER: MarginChannelKey[] = ["marketplace", "web", "store"];

type GeneralStatus = "negative" | "review" | "spread" | "over" | "ok";

const GENERAL_STATUS: Record<GeneralStatus, { label: string; tone: BadgeTone }> = {
  negative: { label: "Margen negativo", tone: "red" },
  review: { label: "Requiere revisión", tone: "amber" },
  spread: { label: "Diferencia entre canales", tone: "violet" },
  over: { label: "Sobre marginado", tone: "violet" },
  ok: { label: "Correcto", tone: "green" },
};

interface SkuGroup {
  sku: string;
  productName: string;
  category: string;
  supplierName: string;
  buyer: string;
  target: number;
  channels: (ChannelMargin | undefined)[];
  present: ChannelMargin[];
  minMargin: number;
  maxMargin: number;
  minPrice: number;
  maxPrice: number;
  general: GeneralStatus;
  conclusion: string;
}

function generalStatusFor(rows: ChannelMargin[]): GeneralStatus {
  if (rows.some((r) => r.status === "negative")) return "negative";
  if (rows.some((r) => r.status === "low")) return "review";
  const margins = rows.map((r) => r.marginPct);
  if (Math.max(...margins) - Math.min(...margins) >= 15) return "spread";
  if (rows.every((r) => r.status === "over")) return "over";
  return rows.some((r) => r.status === "over") ? "spread" : "ok";
}

export function ChannelMarginPage() {
  const navigate = useNavigate();
  const { buyer, buyers } = useBuyer();
  const toast = useToast();

  const [scope, setScope] = useUrlState("alcance", "mias");
  const [tab, setTab] = useUrlState("tab", "all");
  const [query, setQuery] = useUrlState("q");
  const [channel, setChannel] = useUrlState("canal");
  const [estado, setEstado] = useUrlState("estado");
  const [category, setCategory] = useUrlState("cat");
  const [supplier, setSupplier] = useUrlState("prov");
  const [withCommission, toggleCommission] = useUrlToggle("comision");
  const [withDiscount, toggleDiscount] = useUrlToggle("descuento");

  const scoped = useMemo(() => {
    if (scope === "todos") return channelMargins;
    const target = scope === "mias" ? buyer : scope;
    return channelMargins.filter((c) => c.buyer === target);
  }, [scope, buyer]);

  const scopeLabel =
    scope === "todos" ? "Todos los compradores" : scope === "mias" ? `Mis categorías (${buyer})` : `Comprador ${scope}`;

  // Agrupar por SKU
  const allGroups = useMemo<SkuGroup[]>(() => {
    const map = new Map<string, ChannelMargin[]>();
    for (const c of scoped) {
      if (query.trim() && !`${c.sku} ${c.productName}`.toLowerCase().includes(query.toLowerCase())) continue;
      if (category && c.category !== category) continue;
      if (supplier && c.supplierName !== supplier) continue;
      const arr = map.get(c.sku) ?? [];
      arr.push(c);
      map.set(c.sku, arr);
    }
    const result: SkuGroup[] = [];
    for (const [sku, rows] of map) {
      const matches = rows.some(
        (c) =>
          (!channel || c.channel === channel) &&
          (!estado || c.status === estado) &&
          (!withCommission || c.commission > 0) &&
          (!withDiscount || c.discount > 0)
      );
      if (!matches) continue;
      const first = rows[0];
      const margins = rows.map((r) => r.marginPct);
      const prices = rows.map((r) => r.finalPrice);
      const general = generalStatusFor(rows);
      const worst = [...rows].sort((a, b) => a.marginPct - b.marginPct)[0];
      result.push({
        sku,
        productName: first.productName,
        category: first.category,
        supplierName: first.supplierName,
        buyer: first.buyer,
        target: first.targetMarginPct,
        channels: CHANNEL_ORDER.map((ch) => rows.find((r) => r.channel === ch)),
        present: rows,
        minMargin: Math.min(...margins),
        maxMargin: Math.max(...margins),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        general,
        conclusion:
          general === "ok"
            ? "Márgenes dentro del objetivo en todos los canales."
            : `${CHANNEL_LABELS[worst.channel]}: ${worst.action}`,
      });
    }
    return result.sort((a, b) => a.minMargin - b.minMargin);
  }, [scoped, query, channel, estado, category, supplier, withCommission, withDiscount]);

  // Tabs por estado general
  const tabCounts = {
    all: allGroups.length,
    review: allGroups.filter((g) => g.general === "review").length,
    over: allGroups.filter((g) => g.general === "over").length,
    negative: allGroups.filter((g) => g.general === "negative").length,
    spread: allGroups.filter((g) => g.general === "spread").length,
  };

  const groups = useMemo(() => {
    if (tab === "all") return allGroups;
    return allGroups.filter((g) => g.general === tab);
  }, [allGroups, tab]);

  // KPIs según alcance
  const low = scoped.filter((c) => c.status === "low").length;
  const negative = scoped.filter((c) => c.status === "negative").length;
  const over = scoped.filter((c) => c.status === "over").length;
  const lowMkt = scoped.filter((c) => c.status === "low" && c.channel === "marketplace").length;
  const lowWeb = scoped.filter((c) => c.status === "low" && c.channel === "web").length;
  const lowStore = scoped.filter((c) => c.status === "low" && c.channel === "store").length;

  const setFilter = (e: string, ch: string) => { setEstado(e); setChannel(ch); };
  const clearFilters = () => {
    setQuery(""); setChannel(""); setEstado(""); setCategory(""); setSupplier("");
    if (withCommission) toggleCommission();
    if (withDiscount) toggleDiscount();
  };

  return (
    <div>
      <PageHeader
        title="Margen por canal"
        description="Compara, por producto, el precio y el margen en marketplace, web y tienda. Cada producto se muestra una sola vez con sus canales lado a lado."
        action={
          <ExportButton
            filename="margen-por-canal"
            rows={scoped}
            columns={[
              { label: "SKU", value: (c) => c.sku },
              { label: "Producto", value: (c) => c.productName },
              { label: "Canal", value: (c) => CHANNEL_LABELS[c.channel] },
              { label: "Precio final", value: (c) => c.finalPrice },
              { label: "Costo", value: (c) => c.cost },
              { label: "Comisión", value: (c) => c.commission },
              { label: "Margen %", value: (c) => c.marginPct },
              { label: "Objetivo %", value: (c) => c.targetMarginPct },
              { label: "Diferencia pts", value: (c) => Math.round((c.marginPct - c.targetMarginPct) * 10) / 10 },
              { label: "Precio sugerido", value: (c) => c.suggestedPrice },
              { label: "Estado", value: (c) => MARGIN_STATUS[c.status].label },
            ]}
          />
        }
      />

      {/* Alcance */}
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
          Alcance: <b className="text-slate-700">{scopeLabel}</b>
        </span>
      </div>

      {/* Filtros */}
      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar SKU o producto"
          resultCount={groups.length}
          summary={`${groups.length} productos · ${negative} con margen negativo · ${low} bajo margen`}
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

      {/* KPIs cliqueables (solo escritorio; en móvil se usan las pestañas compactas) */}
      <div className="hidden md:grid md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        <KpiCard title="Bajo margen" value={formatNumber(low)} tone="warn" icon={<IconAlerts className="w-4 h-4" />} active={estado === "low" && !channel} onClick={() => setFilter("low", "")} description="Filtrar" />
        <KpiCard title="Margen negativo" value={formatNumber(negative)} tone="bad" icon={<IconAlerts className="w-4 h-4" />} active={estado === "negative"} onClick={() => setFilter("negative", "")} description="Filtrar" />
        <KpiCard title="Sobre marginados" value={formatNumber(over)} tone="warn" icon={<IconBox className="w-4 h-4" />} active={estado === "over"} onClick={() => setFilter("over", "")} description="Filtrar" />
        <KpiCard title="Bajo margen · Marketplace" value={formatNumber(lowMkt)} tone="warn" icon={<IconSales className="w-4 h-4" />} active={estado === "low" && channel === "marketplace"} onClick={() => setFilter("low", "marketplace")} description="Filtrar" />
        <KpiCard title="Bajo margen · Web" value={formatNumber(lowWeb)} tone="warn" icon={<IconSales className="w-4 h-4" />} active={estado === "low" && channel === "web"} onClick={() => setFilter("low", "web")} description="Filtrar" />
        <KpiCard title="Bajo margen · Tienda" value={formatNumber(lowStore)} tone="warn" icon={<IconSales className="w-4 h-4" />} active={estado === "low" && channel === "store"} onClick={() => setFilter("low", "store")} description="Filtrar" />
      </div>

      {/* Tabs por estado general del SKU */}
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "all", label: "Todos", count: tabCounts.all },
          { value: "review", label: "Requieren revisión", count: tabCounts.review },
          { value: "negative", label: "Margen negativo", count: tabCounts.negative },
          { value: "spread", label: "Diferencia entre canales", count: tabCounts.spread },
          { value: "over", label: "Sobre marginados", count: tabCounts.over },
        ]}
      />

      <HelpNote className="mb-4">
        Cada tarjeta es un producto con sus 3 canales <b>lado a lado</b>. Verde = mejor margen, rojo = peor.
        Cuando un canal está bajo el objetivo se muestra el <b>precio sugerido</b> y la acción.
      </HelpNote>

      {groups.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState title="Sin resultados" description="No hay productos con estos filtros." />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <SkuCard
              key={g.sku}
              group={g}
              onOpen={() => navigate(`/productos/${g.sku}?tab=margen`)}
              onTask={() => toast.success(`Tarea de revisión de margen creada para ${g.productName}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkuCard({ group, onOpen, onTask }: { group: SkuGroup; onOpen: () => void; onTask: () => void }) {
  const gen = GENERAL_STATUS[group.general];
  const worst = [...group.present].sort((a, b) => a.marginPct - b.marginPct)[0];
  const worstDiff = Math.round((worst.marginPct - worst.targetMarginPct) * 10) / 10;
  const mainIssue =
    group.general === "ok"
      ? null
      : `${CHANNEL_LABELS[worst.channel]}: ${MARGIN_STATUS[worst.status].label.toLowerCase()} · ${worstDiff} pts vs objetivo`;
  return (
    <Card>
      <div className="p-3.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-slate-500">{group.sku}</span>
              <Badge tone={gen.tone} dot>{gen.label}</Badge>
            </div>
            <p className="font-semibold text-slate-800 leading-snug">{group.productName}</p>
            <p className="text-xs text-slate-500">
              {group.category} · {group.supplierName || "Sin proveedor"} · objetivo {formatPercent(group.target, 0)} · {group.buyer}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" variant="secondary" onClick={onTask}>Crear tarea</Button>
            <Button size="sm" onClick={onOpen}>Ver detalle</Button>
          </div>
        </div>

        {/* Problema principal */}
        {mainIssue && (
          <p className="text-sm font-medium text-amber-700 mb-1">⚠ Problema: {mainIssue}</p>
        )}

        {/* Resumen comparativo */}
        <p className="text-xs text-slate-500 mb-2.5">
          Precio {formatCurrency(group.minPrice)}–{formatCurrency(group.maxPrice)} · margen {formatPercent(group.minMargin)}–{formatPercent(group.maxMargin)}
          {group.maxPrice > group.minPrice && <> · dif. {formatCurrency(group.maxPrice - group.minPrice)} entre canales</>}
        </p>

        {/* Canales lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {group.channels.map((c, i) => {
            if (!c) return <div key={i} className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-300">Sin canal</div>;
            const diff = Math.round((c.marginPct - c.targetMarginPct) * 10) / 10;
            const isBest = c.marginPct === group.maxMargin && group.maxMargin !== group.minMargin;
            const isWorst = c.marginPct === group.minMargin && group.maxMargin !== group.minMargin;
            const cfg = MARGIN_STATUS[c.status];
            return (
              <div
                key={i}
                className={`rounded-lg border p-2.5 ${
                  isBest ? "border-emerald-200 bg-emerald-50/60" : isWorst ? "border-rose-200 bg-rose-50/60" : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-700">{CHANNEL_LABELS[c.channel]}</span>
                  <Badge tone={cfg.tone}>{cfg.label}</Badge>
                </div>
                <p className="text-lg font-semibold text-slate-900 leading-tight">{formatCurrency(c.finalPrice)}</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-sm font-semibold ${c.marginPct < 0 ? "text-rose-600" : c.status === "low" ? "text-amber-600" : "text-slate-700"}`}>
                    {formatPercent(c.marginPct)}
                  </span>
                  <span className={`text-xs ${diff < 0 ? "text-rose-500" : "text-emerald-600"}`}>
                    {diff >= 0 ? "+" : ""}{diff.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts
                  </span>
                </div>
                {c.commission > 0 && <p className="text-xs text-slate-500 mt-0.5">comisión {formatCurrency(c.commission)}</p>}
                {(c.status === "low" || c.status === "negative") && (
                  <p className="text-xs text-brand-700 mt-1">Sugerido: <b>{formatCurrency(c.suggestedPrice)}</b></p>
                )}
              </div>
            );
          })}
        </div>

        {/* Conclusión / acción */}
        {group.general !== "ok" && (
          <div className="mt-2.5 flex gap-2 rounded-lg bg-brand-50/60 border border-brand-100 px-3 py-2">
            <IconAlerts className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-700"><span className="font-medium">Acción: </span>{group.conclusion}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
