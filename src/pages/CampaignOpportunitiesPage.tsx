import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column, type SortState } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { HelpNote } from "../components/business/HelpNote";
import { PriorityGuide, type GuideStep } from "../components/business/PriorityGuide";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { uniqueValues } from "../utils/filters";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDays,
  formatNumber,
  formatPercent,
  formatDelta,
} from "../utils/formatters";
import { useOcDraft } from "../context/OcDraftContext";
import { campaignOpportunities as all } from "../data/mockCampaignOpportunities";
import {
  CHANNEL_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  CAMPAIGN_STATUS,
  TYPE_TONE,
  STATUS_URGENCY,
} from "../components/business/campaignLabels";
import {
  IconReplenish,
  IconAlerts,
  IconBox,
  IconSales,
  IconArrowUp,
  IconCheck,
  IconPlus,
} from "../components/ui/icons";
import type { CampaignOpportunity } from "../types/purchasing";

/** Precio de venta estimado a partir del costo y el margen. */
function estPrice(o: CampaignOpportunity) {
  return o.margin < 100 ? o.unitCost / (1 - o.margin / 100) : o.unitCost;
}

export function CampaignOpportunitiesPage() {
  const navigate = useNavigate();
  const { addItem, hasItem } = useOcDraft();

  const [done, setDone] = useState<string[]>([]); // acciones simuladas ya gestionadas
  const [sort, setSort] = useState<SortState>({ key: null, dir: "desc" });
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [toggles, setToggles] = useState({
    risk: false,
    growth: false,
    liquidation: false,
    lowMargin: false,
  });

  const filtered = useMemo(() => {
    const result = all.filter((o) => {
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!`${o.sku} ${o.productName} ${o.campaignName}`.toLowerCase().includes(q)) return false;
      }
      if (channel && o.channel !== channel) return false;
      if (type && o.opportunityType !== type) return false;
      if (status && o.status !== status) return false;
      if (category && o.category !== category) return false;
      if (supplier && o.supplierName !== supplier) return false;
      if (toggles.risk && o.status !== "stockout_risk" && o.status !== "buy_before_campaign") return false;
      if (toggles.growth && o.opportunityType !== "accelerated_growth") return false;
      if (toggles.liquidation && o.status !== "liquidate") return false;
      if (toggles.lowMargin && o.margin >= 25) return false;
      return true;
    });
    return [...result].sort(
      (a, b) => STATUS_URGENCY[a.status] - STATUS_URGENCY[b.status] || a.daysToCampaign - b.daysToCampaign
    );
  }, [query, channel, type, status, category, supplier, toggles]);

  // KPIs
  const stockoutRisk = all.filter((o) => o.status === "stockout_risk").length;
  const toLiquidateList = all.filter((o) => o.status === "liquidate");
  const acceleratedList = all.filter((o) => o.opportunityType === "accelerated_growth");
  const estSalesTotal = all.reduce((a, o) => a + o.estimatedCampaignSales * estPrice(o), 0);
  const suggestedBuyTotal = all.reduce((a, o) => a + o.suggestedPurchaseQuantity * o.unitCost, 0);
  const stockGapUnits = all
    .filter((o) => o.status === "stockout_risk" || o.status === "buy_before_campaign")
    .reduce((a, o) => a + Math.max(0, o.stockGap), 0);
  const highMarginOpps = all.filter(
    (o) => (o.status === "ready_for_campaign" || o.status === "boost") && o.margin >= 35
  );

  // "Qué revisar primero"
  const guideSteps: GuideStep[] = [
    {
      title: "Campaña cercana con stock insuficiente",
      detail: "Productos con campaña próxima que pueden quebrar antes del evento.",
      count: all.filter((o) => (o.status === "stockout_risk" || o.status === "buy_before_campaign") && o.daysToCampaign <= 12).length,
      countLabel: `${all.filter((o) => (o.status === "stockout_risk" || o.status === "buy_before_campaign") && o.daysToCampaign <= 12).length} productos`,
      to: "#tabla",
      tone: "red",
    },
    {
      title: "Crecimiento acelerado y bajo inventario",
      detail: "Demanda creciendo fuerte que necesita más stock objetivo.",
      count: acceleratedList.length,
      countLabel: `${acceleratedList.length} productos`,
      to: "#tabla",
      tone: "amber",
    },
    {
      title: "Sobrestock que podría liquidarse",
      detail: "Inventario inmovilizado para empujar por web, marketplace o B2B.",
      count: toLiquidateList.length,
      countLabel: `${toLiquidateList.length} productos`,
      to: "#tabla",
      tone: "violet",
    },
    {
      title: "Alto margen para potenciar",
      detail: "Productos rentables con stock suficiente, listos para impulsar.",
      count: highMarginOpps.length,
      countLabel: `${highMarginOpps.length} productos`,
      to: "#tabla",
      tone: "blue",
    },
    {
      title: "No recomendados para campaña",
      detail: "Riesgo operativo: sin stock, sin proveedor o margen muy bajo.",
      count: all.filter((o) => o.status === "not_recommended" || o.status === "review_margin" || o.status === "review_supplier").length,
      countLabel: `${all.filter((o) => o.status === "not_recommended" || o.status === "review_margin" || o.status === "review_supplier").length} productos`,
      to: "#tabla",
      tone: "neutral",
    },
  ];

  // Campañas próximas (agrupadas)
  const upcoming = useMemo(() => {
    const map = new Map<string, { name: string; days: number; date: string; count: number; channels: Set<string> }>();
    for (const o of all) {
      const e = map.get(o.campaignName);
      if (e) {
        e.count += 1;
        e.channels.add(CHANNEL_LABELS[o.channel]);
        if (o.daysToCampaign < e.days) {
          e.days = o.daysToCampaign;
          e.date = o.campaignDate;
        }
      } else {
        map.set(o.campaignName, {
          name: o.campaignName,
          days: o.daysToCampaign,
          date: o.campaignDate,
          count: 1,
          channels: new Set([CHANNEL_LABELS[o.channel]]),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.days - b.days);
  }, []);

  const handleAction = (o: CampaignOpportunity) => {
    if (o.suggestedPurchaseQuantity > 0 && o.actionLabel === "Agregar a OC") {
      addItem({
        sku: o.sku,
        productName: o.productName,
        supplierName: o.supplierName,
        quantity: o.suggestedPurchaseQuantity,
        unitCost: o.unitCost,
      });
      return;
    }
    if (o.actionLabel === "Revisar proveedor") return navigate("/proveedores");
    // Resto (potenciar, liquidación, excluir, revisar margen): se marca como gestionado
    setDone((prev) => (prev.includes(o.id) ? prev : [...prev, o.id]));
  };

  const handleSort = (key: string) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );

  const clearFilters = () => {
    setQuery(""); setChannel(""); setType(""); setStatus(""); setCategory(""); setSupplier("");
    setToggles({ risk: false, growth: false, liquidation: false, lowMargin: false });
  };

  const columns: Column<CampaignOpportunity>[] = [
    {
      key: "product",
      header: "Producto",
      sortable: true,
      sortValue: (o) => o.productName,
      render: (o) => (
        <div className="min-w-[200px]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">{o.sku}</span>
            <span className="text-xs text-slate-400">{o.brand}</span>
          </div>
          <p className="font-medium text-slate-800 leading-snug">{o.productName}</p>
          <p className="text-xs text-slate-500">{o.category} · {o.supplierName || "Sin proveedor"}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Oportunidad",
      render: (o) => <Badge tone={TYPE_TONE[o.opportunityType]}>{OPPORTUNITY_TYPE_LABELS[o.opportunityType]}</Badge>,
    },
    {
      key: "campaign",
      header: "Canal / Campaña",
      hideOnMobile: true,
      render: (o) => (
        <div className="text-sm min-w-[150px]">
          <p className="text-slate-700">{o.campaignName}</p>
          <p className="text-xs text-slate-400">
            {CHANNEL_LABELS[o.channel]} · {formatDate(o.campaignDate)}
          </p>
        </div>
      ),
    },
    {
      key: "days",
      header: "Falta",
      align: "right",
      sortable: true,
      sortValue: (o) => o.daysToCampaign,
      render: (o) => (
        <span className={o.daysToCampaign <= 7 ? "text-rose-600 font-medium" : "text-slate-600"}>
          {formatDays(o.daysToCampaign)}
        </span>
      ),
    },
    {
      key: "stock",
      header: "Stock disp.",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (o) => o.availableStock,
      render: (o) => (
        <span className={o.availableStock <= 0 ? "text-rose-600 font-semibold" : "text-slate-700"}>
          {formatNumber(o.availableStock)}
        </span>
      ),
    },
    {
      key: "sales",
      header: "Venta 30d / Var.",
      align: "right",
      hideOnMobile: true,
      sortValue: (o) => o.growthRate,
      sortable: true,
      render: (o) => (
        <div className="text-sm">
          <p className="text-slate-700">{formatNumber(o.salesLast30Days)}</p>
          <p className={`text-xs ${o.growthRate >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
            {formatDelta(o.growthRate)}
          </p>
        </div>
      ),
    },
    {
      key: "estimated",
      header: "Venta est. campaña",
      align: "right",
      hideOnMobile: true,
      render: (o) => <span className="text-slate-700">{formatNumber(o.estimatedCampaignSales)} u.</span>,
    },
    {
      key: "gap",
      header: "Brecha stock",
      align: "right",
      sortable: true,
      sortValue: (o) => o.stockGap,
      render: (o) =>
        o.stockGap > 0 ? (
          <span className="text-rose-600 font-medium">-{formatNumber(o.stockGap)} u.</span>
        ) : (
          <span className="text-emerald-600">OK</span>
        ),
    },
    {
      key: "buy",
      header: "Compra sugerida",
      align: "right",
      sortable: true,
      sortValue: (o) => o.suggestedPurchaseQuantity * o.unitCost,
      render: (o) =>
        o.suggestedPurchaseQuantity > 0 ? (
          <div className="text-sm">
            <p className="font-semibold text-slate-900">{formatNumber(o.suggestedPurchaseQuantity)} u.</p>
            <p className="text-xs text-slate-400">{formatCurrency(o.suggestedPurchaseQuantity * o.unitCost)}</p>
          </div>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: "margin",
      header: "Margen",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (o) => o.margin,
      render: (o) => (
        <span className={o.margin < 25 ? "text-amber-600 font-medium" : "text-slate-700"}>
          {formatPercent(o.margin)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (o) => <Badge tone={CAMPAIGN_STATUS[o.status].tone} dot>{CAMPAIGN_STATUS[o.status].label}</Badge>,
    },
    {
      key: "reason",
      header: "Riesgo / Recomendación",
      hideOnMobile: true,
      render: (o) => (
        <div className="max-w-xs">
          <p className="text-xs text-rose-500 leading-snug">⚠ {o.risk}</p>
          <p className="text-xs text-slate-600 mt-1 leading-snug">{o.recommendation}</p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (o) => {
        const isOc = o.actionLabel === "Agregar a OC";
        const added = isOc && hasItem(o.sku);
        const gestionado = done.includes(o.id);
        return (
          <div className="flex flex-col gap-1 items-stretch min-w-[150px]">
            <Button
              size="sm"
              variant={added || gestionado ? "secondary" : "primary"}
              disabled={added || gestionado}
              onClick={(e) => {
                e.stopPropagation();
                handleAction(o);
              }}
              icon={added || gestionado ? <IconCheck className="w-3.5 h-3.5" /> : isOc ? <IconPlus className="w-3.5 h-3.5" /> : undefined}
            >
              {added ? "En OC" : gestionado ? "Gestionado" : o.actionLabel}
            </Button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/productos/${o.sku}`);
              }}
              className="text-xs text-slate-500 hover:text-brand-600 border border-slate-200 rounded-md py-1"
            >
              Ver producto
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Campañas y oportunidades"
        description="Analiza productos que irán a campañas comerciales, oportunidades de liquidación, crecimiento acelerado y riesgos de quiebre para anticipar compras y evitar pérdidas de venta."
      />

      <HelpNote className="mb-4">
        Esta vista cruza <b>campaña, canal, stock disponible, venta reciente, crecimiento, margen y
        venta estimada</b> para recomendar si conviene <b>comprar, liquidar, potenciar o excluir</b> cada
        producto. Sirve para anticiparse: compra antes de la campaña lo que falte y empuja lo que sobra.
      </HelpNote>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard title="Productos en campaña" value={formatNumber(all.length)} tone="info" icon={<IconSales className="w-4 h-4" />} />
        <KpiCard title="Riesgo de quiebre" value={formatNumber(stockoutRisk)} tone="bad" icon={<IconAlerts className="w-4 h-4" />} description="Campaña sin stock suficiente" />
        <KpiCard title="Sugeridos para liquidar" value={formatNumber(toLiquidateList.length)} tone="warn" icon={<IconBox className="w-4 h-4" />} description="Sobrestock a empujar" />
        <KpiCard title="Crecimiento acelerado" value={formatNumber(acceleratedList.length)} tone="good" icon={<IconArrowUp className="w-4 h-4" />} description="Demanda subiendo fuerte" />
        <KpiCard title="Venta estimada campañas" value={formatCurrencyCompact(estSalesTotal)} tone="good" icon={<IconSales className="w-4 h-4" />} />
        <KpiCard title="Compra sugerida campañas" value={formatCurrencyCompact(suggestedBuyTotal)} tone="info" icon={<IconReplenish className="w-4 h-4" />} description="Para abastecer eventos" />
        <KpiCard title="Stock en riesgo" value={`${formatNumber(stockGapUnits)} u.`} tone="bad" icon={<IconAlerts className="w-4 h-4" />} description="Brecha total antes de campañas" />
        <KpiCard title="Oportunidades buen margen" value={formatNumber(highMarginOpps.length)} tone="good" icon={<IconArrowUp className="w-4 h-4" />} description="Listas para potenciar" />
      </div>

      {/* Qué revisar primero */}
      <Card className="mb-5">
        <CardHeader title="Qué revisar primero" description="Acciones ordenadas por urgencia para anticipar las campañas." />
        <PriorityGuide steps={guideSteps} />
      </Card>

      {/* Bloques especiales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card>
          <CardHeader title="Campañas próximas" description="Eventos ordenados por cercanía y productos asociados" />
          <CardBody className="space-y-2">
            {upcoming.map((c) => (
              <div key={c.name} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500">{Array.from(c.channels).join(", ")}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge tone="neutral">{c.count} SKUs</Badge>
                  <Badge tone={c.days <= 7 ? "red" : "amber"}>en {formatDays(c.days)}</Badge>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Riesgos de campaña" description="Tienen campaña pero el stock no alcanza" />
          <CardBody className="space-y-2">
            {all
              .filter((o) => o.status === "stockout_risk" || o.status === "buy_before_campaign")
              .sort((a, b) => a.daysToCampaign - b.daysToCampaign)
              .slice(0, 5)
              .map((o) => (
                <div key={o.id} className="rounded-lg border border-rose-100 bg-rose-50/50 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{o.productName}</p>
                    <Badge tone="red">en {formatDays(o.daysToCampaign)}</Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {o.campaignName} · stock {formatNumber(o.availableStock)} u., faltan{" "}
                    <span className="font-semibold">{formatNumber(o.stockGap)} u.</span>
                  </p>
                </div>
              ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <BlockList
          title="Crecimiento acelerado"
          subtitle="Demanda subiendo fuerte"
          items={acceleratedList.map((o) => ({
            sku: o.sku,
            name: o.productName,
            value: formatDelta(o.growthRate),
            tone: "green" as const,
            note: `Stock ${formatNumber(o.availableStock)} u. · estima ${formatNumber(o.estimatedCampaignSales)} u. en campaña`,
          }))}
          onClick={(sku) => navigate(`/productos/${sku}`)}
        />
        <BlockList
          title="Para liquidar"
          subtitle="Sobrestock o baja rotación"
          items={toLiquidateList.map((o) => ({
            sku: o.sku,
            name: o.productName,
            value: `${formatNumber(o.availableStock)} u.`,
            tone: "violet" as const,
            note: `Vendió ${formatNumber(o.salesLast30Days)} u. en 30 días · ${o.recommendation}`,
          }))}
          onClick={(sku) => navigate(`/productos/${sku}`)}
        />
        <BlockList
          title="Oportunidades de alto margen"
          subtitle="Rentables y con stock para potenciar"
          items={highMarginOpps.map((o) => ({
            sku: o.sku,
            name: o.productName,
            value: formatPercent(o.margin),
            tone: "blue" as const,
            note: `${CHANNEL_LABELS[o.channel]} · ${o.campaignName}`,
          }))}
          onClick={(sku) => navigate(`/productos/${sku}`)}
        />
      </div>

      {/* Tabla principal */}
      <div id="tabla" className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por SKU, producto o campaña"
          resultCount={filtered.length}
          onClear={clearFilters}
          selects={[
            { key: "channel", placeholder: "Canal", value: channel, onChange: setChannel, options: Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label })) },
            { key: "type", placeholder: "Tipo de oportunidad", value: type, onChange: setType, options: Object.entries(OPPORTUNITY_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
            { key: "status", placeholder: "Estado", value: status, onChange: setStatus, options: Object.entries(CAMPAIGN_STATUS).map(([value, cfg]) => ({ value, label: cfg.label })) },
            { key: "cat", placeholder: "Categoría", value: category, onChange: setCategory, options: uniqueValues(all, (o) => o.category).map((c) => ({ value: c, label: c })) },
            { key: "sup", placeholder: "Proveedor", value: supplier, onChange: setSupplier, options: uniqueValues(all.filter((o) => o.supplierName), (o) => o.supplierName).map((c) => ({ value: c, label: c })) },
          ]}
          toggles={[
            { key: "risk", label: "Riesgo de quiebre", active: toggles.risk, onToggle: () => setToggles((t) => ({ ...t, risk: !t.risk })) },
            { key: "growth", label: "Crecimiento acelerado", active: toggles.growth, onToggle: () => setToggles((t) => ({ ...t, growth: !t.growth })) },
            { key: "liq", label: "Sobrestock / liquidar", active: toggles.liquidation, onToggle: () => setToggles((t) => ({ ...t, liquidation: !t.liquidation })) },
            { key: "lm", label: "Margen bajo", active: toggles.lowMargin, onToggle: () => setToggles((t) => ({ ...t, lowMargin: !t.lowMargin })) },
          ]}
        />
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(o) => o.id}
          onRowClick={(o) => navigate(`/productos/${o.sku}`)}
          sort={sort}
          onSortChange={handleSort}
          rowClassName={(o) => (o.status === "stockout_risk" ? "bg-rose-50/40" : undefined)}
          emptyMessage="No hay oportunidades que coincidan con los filtros."
        />
      </Card>
    </div>
  );
}

function BlockList({
  title,
  subtitle,
  items,
  onClick,
}: {
  title: string;
  subtitle: string;
  items: { sku: string; name: string; value: string; note: string; tone: "green" | "violet" | "blue" }[];
  onClick: (sku: string) => void;
}) {
  const toneText = { green: "text-emerald-600", violet: "text-violet-600", blue: "text-brand-600" };
  return (
    <Card>
      <CardHeader title={title} description={subtitle} />
      <CardBody className="space-y-2">
        {items.length > 0 ? (
          items.map((it) => (
            <button
              key={it.sku}
              onClick={() => onClick(it.sku)}
              className="w-full text-left rounded-lg border border-slate-200 px-2.5 py-2 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 truncate">{it.name}</p>
                <span className={`text-sm font-semibold flex-shrink-0 ${toneText[it.tone]}`}>{it.value}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{it.note}</p>
            </button>
          ))
        ) : (
          <p className="text-sm text-slate-400 py-3 text-center">Sin productos en esta categoría.</p>
        )}
      </CardBody>
    </Card>
  );
}
