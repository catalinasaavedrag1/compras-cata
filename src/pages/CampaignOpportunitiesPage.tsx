import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supplierPath, categoryPath, productPath } from "../utils/entityLinks";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column, type SortState } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";

import { ConfirmModal } from "../components/ui/ConfirmModal";
import { ExportButton } from "../components/business/ExportButton";
import { CampaignBuilderModal } from "../components/business/CampaignBuilderModal";
import { ScopeToggle, useCategoryScope } from "../components/business/ScopeToggle";
import { uniqueValues } from "../utils/filters";
import { formatCurrency, formatCurrencyCompact, formatDate, formatDays, formatNumber, formatPercent, formatDelta } from "../utils/formatters";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { useLocalStorage } from "../utils/useLocalStorage";
import { campaignOpportunities as all } from "../data/mockCampaignOpportunities";
import { getSupplierByName } from "../data/mockSuppliers";
import { CHANNEL_LABELS, OPPORTUNITY_TYPE_LABELS, CAMPAIGN_STATUS, TYPE_TONE, STATUS_URGENCY } from "../components/business/campaignLabels";
import { IconReplenish, IconAlerts, IconBox, IconCheck, IconPlus } from "../components/ui/icons";
import type { CampaignOpportunity, CreatedCampaign } from "../types/purchasing";
import { CreatedCampaignsView } from "./campaignOpportunities/CreatedCampaignsView";

export function CampaignOpportunitiesPage() {
  const navigate = useNavigate();
  const { addItem, hasItem } = useOcDraft();
  const toast = useToast();
  const { scope, setScope, inScope, myCategories } = useCategoryScope();

  // Alcance del comprador: por defecto solo oportunidades de sus categorías.
  const scopedOpps = useMemo(() => all.filter((o) => inScope(o.category)), [inScope]);

  const [view, setView] = useState<"oportunidades" | "campanas">("oportunidades");
  const [createdCampaigns, setCreatedCampaigns] = useLocalStorage<CreatedCampaign[]>(
    "compras:campaigns",
    []
  );
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderTemplate, setBuilderTemplate] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

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
    const result = scopedOpps.filter((o) => {
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!`${o.sku} ${o.productName} ${o.campaignName}`.toLowerCase().includes(q)) return false;
      }
      if (channel && o.channel !== channel) return false;
      if (type && o.opportunityType !== type) return false;
      if (status && o.status !== status) return false;
      if (category && o.category !== category) return false;
      if (supplier && o.supplierName !== supplier) return false;
      if (toggles.risk && o.status !== "stockout_risk" && o.status !== "buy_before_campaign")
        return false;
      if (toggles.growth && o.opportunityType !== "accelerated_growth") return false;
      if (toggles.liquidation && o.status !== "liquidate") return false;
      if (toggles.lowMargin && o.margin >= 25) return false;
      return true;
    });
    return [...result].sort(
      (a, b) =>
        STATUS_URGENCY[a.status] - STATUS_URGENCY[b.status] || a.daysToCampaign - b.daysToCampaign
    );
  }, [scopedOpps, query, channel, type, status, category, supplier, toggles]);

  // KPIs
  const stockoutRisk = scopedOpps.filter((o) => o.status === "stockout_risk").length;
  const buyBefore = scopedOpps.filter((o) => o.status === "buy_before_campaign").length;
  const toLiquidateList = scopedOpps.filter((o) => o.status === "liquidate");
  const suggestedBuyTotal = scopedOpps.reduce(
    (a, o) => a + o.suggestedPurchaseQuantity * o.unitCost,
    0
  );

  // Campañas próximas (agrupadas)
  const upcoming = useMemo(() => {
    const map = new Map<
      string,
      { name: string; days: number; date: string; count: number; channels: Set<string> }
    >();
    for (const o of scopedOpps) {
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
  }, [scopedOpps]);

  // Consolidación de compras de campaña por proveedor (una OC por proveedor),
  // con alerta de lead time crítico (no alcanza a llegar antes de la campaña).
  const bySupplier = useMemo(() => {
    const map = new Map<
      string,
      {
        supplier: string;
        items: CampaignOpportunity[];
        units: number;
        amount: number;
        minDays: number;
        leadTime: number;
      }
    >();
    for (const o of scopedOpps) {
      if (o.suggestedPurchaseQuantity <= 0) continue;
      const e = map.get(o.supplierName);
      if (e) {
        e.items.push(o);
        e.units += o.suggestedPurchaseQuantity;
        e.amount += o.suggestedPurchaseQuantity * o.unitCost;
        e.minDays = Math.min(e.minDays, o.daysToCampaign);
      } else {
        map.set(o.supplierName, {
          supplier: o.supplierName,
          items: [o],
          units: o.suggestedPurchaseQuantity,
          amount: o.suggestedPurchaseQuantity * o.unitCost,
          minDays: o.daysToCampaign,
          leadTime: getSupplierByName(o.supplierName)?.averageLeadTimeDays ?? 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const ar = a.leadTime >= a.minDays ? 0 : 1;
      const br = b.leadTime >= b.minDays ? 0 : 1;
      return ar - br || a.minDays - b.minDays;
    });
  }, [scopedOpps]);
  const ocCount = bySupplier.length;
  const criticalLeadCount = bySupplier.filter((s) => s.leadTime >= s.minDays).length;

  const createSupplierOc = (group: (typeof bySupplier)[number]) => {
    let added = 0;
    for (const o of group.items) {
      if (hasItem(o.sku)) continue;
      addItem({
        sku: o.sku,
        productName: o.productName,
        supplierName: o.supplierName,
        quantity: o.suggestedPurchaseQuantity,
        unitCost: o.unitCost,
      });
      added++;
    }
    toast.success(
      added > 0
        ? `${added} producto${added === 1 ? "" : "s"} de ${group.supplier} agregado${added === 1 ? "" : "s"} al borrador de OC`
        : `Ya estaban en el borrador`,
      { label: "Ver borrador OC", onClick: () => navigate("/comprar/borradores") }
    );
  };

  const handleAction = (o: CampaignOpportunity) => {
    if (o.suggestedPurchaseQuantity > 0 && o.actionLabel === "Agregar a OC") {
      addItem({
        sku: o.sku,
        productName: o.productName,
        supplierName: o.supplierName,
        quantity: o.suggestedPurchaseQuantity,
        unitCost: o.unitCost,
      });
      toast.success(`${o.productName} agregado al borrador de OC`, {
        label: "Ver borrador OC",
        onClick: () => navigate("/comprar/borradores"),
      });
      return;
    }
    if (o.actionLabel === "Revisar proveedor") return navigate("/proveedores");
    // Resto (potenciar, liquidación, excluir, revisar margen): se marca como gestionado
    setDone((prev) => (prev.includes(o.id) ? prev : [...prev, o.id]));
    toast.success(`${o.actionLabel}: ${o.productName}`);
  };

  const saveCampaign = (c: CreatedCampaign) => {
    setCreatedCampaigns((prev) => [c, ...prev]);
    setBuilderOpen(false);
    setView("campanas");
    toast.success(
      `Campaña "${c.name}" creada con ${c.products.length} producto${c.products.length === 1 ? "" : "s"}`
    );
  };

  const deleteCampaign = (id: string) => {
    setCreatedCampaigns((prev) => prev.filter((x) => x.id !== id));
    toast.info("Campaña eliminada");
  };

  const openBuilder = (template = "") => {
    setBuilderTemplate(template);
    setBuilderOpen(true);
  };

  const handleSort = (key: string) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );

  const clearFilters = () => {
    setQuery("");
    setChannel("");
    setType("");
    setStatus("");
    setCategory("");
    setSupplier("");
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
          <Link
            to={productPath(o.sku)}
            className="font-medium text-slate-800 leading-snug hover:text-brand-700 hover:underline block"
            onClick={(e) => e.stopPropagation()}
          >
            {o.productName}
          </Link>
          <p className="text-xs text-slate-500">
            <Link
              to={categoryPath(o.category)}
              className="hover:text-brand-700 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {o.category}
            </Link>{" "}
            ·{" "}
            {o.supplierName ? (
              <Link
                to={supplierPath(o.supplierName)}
                className="hover:text-brand-700 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {o.supplierName}
              </Link>
            ) : (
              "Sin proveedor"
            )}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Oportunidad",
      render: (o) => (
        <Badge tone={TYPE_TONE[o.opportunityType]}>
          {OPPORTUNITY_TYPE_LABELS[o.opportunityType]}
        </Badge>
      ),
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
      render: (o) => (
        <span className="text-slate-700">{formatNumber(o.estimatedCampaignSales)} u.</span>
      ),
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
            <p className="font-semibold text-slate-900">
              {formatNumber(o.suggestedPurchaseQuantity)} u.
            </p>
            <p className="text-xs text-slate-400">
              {formatCurrency(o.suggestedPurchaseQuantity * o.unitCost)}
            </p>
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
      render: (o) => (
        <Badge tone={CAMPAIGN_STATUS[o.status].tone} dot>
          {CAMPAIGN_STATUS[o.status].label}
        </Badge>
      ),
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
              icon={
                added || gestionado ? (
                  <IconCheck className="w-3.5 h-3.5" />
                ) : isOc ? (
                  <IconPlus className="w-3.5 h-3.5" />
                ) : undefined
              }
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
        title="Anticipación de campañas"
        description="Comprar antes del peak, liquidar y detectar crecimiento por canal: productos que irán a campañas, oportunidades de liquidación, crecimiento acelerado y riesgos de quiebre."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ScopeToggle scope={scope} onChange={setScope} myCount={myCategories.length} />
            <ExportButton
              filename="campanas-oportunidades"
              rows={filtered}
              columns={[
                { label: "SKU", value: (o) => o.sku },
                { label: "Producto", value: (o) => o.productName },
                { label: "Categoría", value: (o) => o.category },
                { label: "Proveedor", value: (o) => o.supplierName },
                { label: "Oportunidad", value: (o) => OPPORTUNITY_TYPE_LABELS[o.opportunityType] },
                { label: "Canal", value: (o) => CHANNEL_LABELS[o.channel] },
                { label: "Campaña", value: (o) => o.campaignName },
                { label: "Fecha campaña", value: (o) => o.campaignDate },
                { label: "Stock disponible", value: (o) => o.availableStock },
                { label: "Venta 30 días", value: (o) => o.salesLast30Days },
                { label: "Crecimiento %", value: (o) => o.growthRate },
                { label: "Venta estimada campaña", value: (o) => o.estimatedCampaignSales },
                { label: "Brecha stock", value: (o) => o.stockGap },
                { label: "Compra sugerida", value: (o) => o.suggestedPurchaseQuantity },
                { label: "Margen %", value: (o) => o.margin },
                { label: "Estado", value: (o) => CAMPAIGN_STATUS[o.status].label },
              ]}
            />
            <Button onClick={() => openBuilder("")} icon={<IconPlus className="w-4 h-4" />}>
              Crear campaña
            </Button>
          </div>
        }
      />

      {/* Plantillas rápidas de campaña */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-medium text-slate-500">Plantillas rápidas:</span>
        {[
          "Cyber herramientas",
          "Especial construcción",
          "Liquidación stock lento",
          "Campaña jardín primavera",
        ].map((t) => (
          <button
            key={t}
            onClick={() => openBuilder(t)}
            className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <IconPlus className="w-3 h-3" /> {t}
          </button>
        ))}
      </div>

      <Tabs
        className="mb-5"
        value={view}
        onChange={(v) => setView(v as typeof view)}
        tabs={[
          { value: "oportunidades", label: "Oportunidades detectadas", count: scopedOpps.length },
          { value: "campanas", label: "Mis campañas", count: createdCampaigns.length },
        ]}
      />

      {view === "campanas" ? (
        <CreatedCampaignsView
          campaigns={createdCampaigns}
          onCreate={() => openBuilder("")}
          onDelete={setPendingDelete}
          onAddToOc={(sku) => navigate(`/productos/${sku}`)}
        />
      ) : (
        <>
          {/* Campañas próximas (chips compactos) */}
          <div className="flex flex-wrap items-center gap-2 -mx-1 px-1 mb-3">
            <span className="text-xs font-medium text-slate-500 flex-shrink-0">Próximas:</span>
            {upcoming.map((c) => (
              <span
                key={c.name}
                className="whitespace-nowrap flex-shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600"
              >
                {c.name} · {c.count} SKU ·{" "}
                <span className={c.days <= 7 ? "text-rose-600 font-medium" : "text-amber-600"}>
                  en {formatDays(c.days)}
                </span>
              </span>
            ))}
          </div>

          {/* KPIs compactos (escritorio), cliqueables → filtran */}
          <div className="hidden md:grid md:grid-cols-4 gap-3 mb-4">
            <KpiCard
              title="Riesgo de quiebre"
              value={formatNumber(stockoutRisk)}
              tone="bad"
              icon={<IconAlerts className="w-4 h-4" />}
              description="Campaña sin stock"
              active={status === "stockout_risk"}
              onClick={() => setStatus(status === "stockout_risk" ? "" : "stockout_risk")}
            />
            <KpiCard
              title="Comprar antes"
              value={formatNumber(buyBefore)}
              tone="warn"
              icon={<IconReplenish className="w-4 h-4" />}
              description="Abastecer evento"
              active={status === "buy_before_campaign"}
              onClick={() =>
                setStatus(status === "buy_before_campaign" ? "" : "buy_before_campaign")
              }
            />
            <KpiCard
              title="Sugeridos para liquidar"
              value={formatNumber(toLiquidateList.length)}
              tone="warn"
              icon={<IconBox className="w-4 h-4" />}
              description="Sobrestock"
              active={status === "liquidate"}
              onClick={() => setStatus(status === "liquidate" ? "" : "liquidate")}
            />
            <KpiCard
              title="Compra sugerida campañas"
              value={formatCurrencyCompact(suggestedBuyTotal)}
              tone="info"
              icon={<IconReplenish className="w-4 h-4" />}
              description="Total a comprar"
            />
          </div>

          {/* Consolidación de OC por proveedor para las campañas */}
          {bySupplier.length > 0 && (
            <Card className="mb-4">
              <CardHeader
                title={`OC a generar por proveedor (${ocCount})`}
                description={`Consolida las compras de campaña en una OC por proveedor.${criticalLeadCount > 0 ? ` ${criticalLeadCount} con lead time crítico: no alcanza a llegar antes de la campaña.` : ""}`}
              />
              <CardBody className="space-y-2">
                {bySupplier.map((g) => {
                  const critical = g.leadTime >= g.minDays;
                  return (
                    <div
                      key={g.supplier}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            to={supplierPath(g.supplier)}
                            className="text-sm font-medium text-slate-800 truncate hover:text-brand-700 hover:underline"
                          >
                            {g.supplier}
                          </Link>
                          <Badge tone={critical ? "red" : "green"}>
                            {critical
                              ? `Lead ${formatDays(g.leadTime)} ≥ ${formatDays(g.minDays)} a campaña`
                              : `Lead ${formatDays(g.leadTime)} OK`}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {g.items.length} SKU · {formatNumber(g.units)} u. ·{" "}
                          {formatCurrencyCompact(g.amount)} · campaña en {formatDays(g.minDays)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={critical ? "primary" : "secondary"}
                        icon={<IconPlus className="w-4 h-4" />}
                        onClick={() => createSupplierOc(g)}
                      >
                        Crear OC
                      </Button>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}

          {/* Foco por estado (reduce el listado con un clic) */}
          <Tabs
            className="mb-4"
            value={status || "all"}
            onChange={(v) => setStatus(v === "all" ? "" : v)}
            tabs={[
              { value: "all", label: "Todos", count: scopedOpps.length },
              { value: "buy_before_campaign", label: "Comprar antes", count: buyBefore },
              { value: "stockout_risk", label: "Riesgo de quiebre", count: stockoutRisk },
              { value: "liquidate", label: "Liquidar", count: toLiquidateList.length },
              {
                value: "boost",
                label: "Potenciar",
                count: scopedOpps.filter((o) => o.status === "boost").length,
              },
              {
                value: "not_recommended",
                label: "No recomendado",
                count: scopedOpps.filter((o) => o.status === "not_recommended").length,
              },
            ]}
          />

          {/* Tabla principal */}
          <div id="tabla" className="mb-4">
            <FilterBar
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder="Buscar por SKU, producto o campaña"
              resultCount={filtered.length}
              onClear={clearFilters}
              selects={[
                {
                  key: "channel",
                  placeholder: "Canal",
                  value: channel,
                  onChange: setChannel,
                  options: Object.entries(CHANNEL_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                },
                {
                  key: "type",
                  placeholder: "Tipo de oportunidad",
                  value: type,
                  onChange: setType,
                  options: Object.entries(OPPORTUNITY_TYPE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                },
                {
                  key: "status",
                  placeholder: "Estado",
                  value: status,
                  onChange: setStatus,
                  options: Object.entries(CAMPAIGN_STATUS).map(([value, cfg]) => ({
                    value,
                    label: cfg.label,
                  })),
                },
                {
                  key: "cat",
                  placeholder: "Categoría",
                  value: category,
                  onChange: setCategory,
                  options: uniqueValues(scopedOpps, (o) => o.category).map((c) => ({
                    value: c,
                    label: c,
                  })),
                },
                {
                  key: "sup",
                  placeholder: "Proveedor",
                  value: supplier,
                  onChange: setSupplier,
                  options: uniqueValues(
                    scopedOpps.filter((o) => o.supplierName),
                    (o) => o.supplierName
                  ).map((c) => ({ value: c, label: c })),
                },
              ]}
              toggles={[
                {
                  key: "risk",
                  label: "Riesgo de quiebre",
                  active: toggles.risk,
                  onToggle: () => setToggles((t) => ({ ...t, risk: !t.risk })),
                },
                {
                  key: "growth",
                  label: "Crecimiento acelerado",
                  active: toggles.growth,
                  onToggle: () => setToggles((t) => ({ ...t, growth: !t.growth })),
                },
                {
                  key: "liq",
                  label: "Sobrestock / liquidar",
                  active: toggles.liquidation,
                  onToggle: () => setToggles((t) => ({ ...t, liquidation: !t.liquidation })),
                },
                {
                  key: "lm",
                  label: "Margen bajo",
                  active: toggles.lowMargin,
                  onToggle: () => setToggles((t) => ({ ...t, lowMargin: !t.lowMargin })),
                },
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
              mobileCard={(o) => (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-mono text-slate-400">{o.sku}</span>
                      <p className="font-medium text-slate-800 leading-snug">{o.productName}</p>
                      <p className="text-xs text-slate-500">
                        {CHANNEL_LABELS[o.channel]} · {o.campaignName} · en{" "}
                        {formatDays(o.daysToCampaign)}
                      </p>
                    </div>
                    <Badge tone={CAMPAIGN_STATUS[o.status].tone} dot>
                      {CAMPAIGN_STATUS[o.status].label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Stock</p>
                      <p
                        className={
                          o.availableStock <= 0 ? "text-rose-600 font-semibold" : "text-slate-700"
                        }
                      >
                        {formatNumber(o.availableStock)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Brecha</p>
                      <p className={o.stockGap > 0 ? "text-rose-600" : "text-emerald-600"}>
                        {o.stockGap > 0 ? `-${formatNumber(o.stockGap)}` : "OK"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Sugerido</p>
                      <p className="font-semibold text-slate-900">
                        {o.suggestedPurchaseQuantity > 0
                          ? `${formatNumber(o.suggestedPurchaseQuantity)} u.`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">{o.recommendation}</p>
                </div>
              )}
            />
          </Card>
        </>
      )}

      <CampaignBuilderModal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSave={saveCampaign}
        initialName={builderTemplate}
      />

      {(() => {
        const c = createdCampaigns.find((x) => x.id === pendingDelete);
        return (
          <ConfirmModal
            open={pendingDelete !== null}
            title="Eliminar campaña"
            message={
              c
                ? `Vas a eliminar la campaña "${c.name}" con ${c.products.length} producto${c.products.length === 1 ? "" : "s"} y ${c.channels.length} canal${c.channels.length === 1 ? "" : "es"}. Esta acción no se puede deshacer.`
                : "Esta acción no se puede deshacer."
            }
            confirmLabel="Eliminar campaña"
            danger
            onCancel={() => setPendingDelete(null)}
            onConfirm={() => {
              if (pendingDelete) deleteCampaign(pendingDelete);
              setPendingDelete(null);
            }}
          />
        );
      })()}
    </div>
  );
}

/** Vista "Mis campañas": campañas creadas por el comprador. */
