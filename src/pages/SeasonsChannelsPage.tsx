import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { ScopeToggle, useCategoryScope } from "../components/business/ScopeToggle";
import {
  MonthlyBars,
  StackedChannelBars,
  ChannelLegend,
} from "../components/business/SeasonalityChart";
import { categories as allCategories } from "../data/mockCategories";
import { products as allProducts } from "../data/mockProducts";
import {
  channelDemandForCategory,
  splitPurchaseByChannel,
  CHANNEL_META,
} from "../utils/channelDemand";
import { seasonalFactor, demandType } from "../utils/seasonality";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { IconSales, IconCampaign, IconBox, IconSuppliers } from "../components/ui/icons";

const DEMAND_TYPE_LABEL: Record<
  ReturnType<typeof demandType>,
  { label: string; tone: "slate" | "blue" | "violet" }
> = {
  constante: { label: "Demanda constante", tone: "slate" },
  estacional: { label: "Demanda estacional", tone: "violet" },
  permanente_peak: { label: "Permanente con peak", tone: "blue" },
};

export function SeasonsChannelsPage() {
  const { scope, setScope, inScope, myCategories } = useCategoryScope();

  const categories = useMemo(() => allCategories.filter((c) => inScope(c.name)), [inScope]);
  const [categoria, setCategoria] = useState<string>("");
  const selected = categories.find((c) => c.name === categoria) ?? categories[0];

  const products = useMemo(
    () => (selected ? allProducts.filter((p) => p.category === selected.name) : []),
    [selected]
  );

  const demand = useMemo(
    () => (selected ? channelDemandForCategory(selected.name, products) : null),
    [selected, products]
  );

  if (!selected || !demand) {
    return (
      <div>
        <PageHeader
          title="Temporadas y canales"
          description="Cuándo sube la demanda y por qué canal se compra: tienda, ecommerce, marketplace, empresa y licitaciones."
          action={<ScopeToggle scope={scope} onChange={setScope} myCount={myCategories.length} />}
        />
        <Card>
          <CardBody className="text-center text-sm text-slate-500">
            No hay categorías en tu alcance. Cambia a “Todas” para explorar la demanda por canal.
          </CardBody>
        </Card>
      </div>
    );
  }

  const factor = seasonalFactor(selected.name);
  const dtype = demandType(selected.name);
  const seasonUp = factor >= 1.05;
  const seasonDown = factor <= 0.95;

  const totalMonthly = demand.monthly.map((m) => ({
    label: m.label,
    value: m.total,
    highlight: m.label === demand.peakMonth,
  }));

  const purchaseSplit = splitPurchaseByChannel(demand, selected.suggestedPurchase);

  return (
    <div>
      <PageHeader
        title="Temporadas y canales"
        description="Cuándo sube la demanda y por qué canal se compra: tienda, ecommerce, marketplace, empresa (B2B) y licitaciones."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ScopeToggle scope={scope} onChange={setScope} myCount={myCategories.length} />
            <Select
              aria-label="Categoría"
              value={selected.name}
              onChange={(e) => setCategoria(e.target.value)}
              options={categories.map((c) => ({ value: c.name, label: c.name }))}
              className="sm:w-56"
            />
          </div>
        }
      />

      <HelpNote className="mb-4">
        La misma categoría se vende por varios canales y cada uno tiene su propia temporada: el{" "}
        <b>ecommerce</b> y el <b>marketplace</b> suben en CyberDay y fin de año, las{" "}
        <b>licitaciones</b> se concentran cuando se ejecuta presupuesto (marzo-abril, oct-nov) y la{" "}
        <b>venta empresa</b> sigue la temporada de obra. Verlo así explica <b>cuánto</b> comprar y{" "}
        <b>por qué</b>, no solo el total.
      </HelpNote>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Demanda mensual"
          value={`${formatNumber(demand.baseUnitsPerMonth)} u.`}
          tone="info"
          icon={<IconBox className="w-4 h-4" />}
          description={selected.name}
        />
        <KpiCard
          title="Mes peak"
          value={demand.peakMonth}
          tone={seasonUp ? "warn" : "neutral"}
          icon={<IconSales className="w-4 h-4" />}
          description={
            seasonUp
              ? `Entra en temporada (×${factor.toFixed(2)})`
              : seasonDown
                ? `Sale de temporada (×${factor.toFixed(2)})`
                : "Demanda pareja"
          }
        />
        <KpiCard
          title="Canales digitales"
          value={formatPercent(demand.digitalPct, 0)}
          tone="neutral"
          icon={<IconCampaign className="w-4 h-4" />}
          description="Ecommerce + marketplace"
        />
        <KpiCard
          title="Proyectos"
          value={formatPercent(demand.projectPct, 0)}
          tone="neutral"
          icon={<IconSuppliers className="w-4 h-4" />}
          description="Empresa + licitaciones"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Temporada: demanda total por mes */}
        <Card>
          <CardHeader
            title="Temporada del año"
            description="Demanda total por mes (unidades). Barra oscura = mes peak."
            action={
              <Badge tone={DEMAND_TYPE_LABEL[dtype].tone}>{DEMAND_TYPE_LABEL[dtype].label}</Badge>
            }
          />
          <CardBody>
            <MonthlyBars data={totalMonthly} format={(n) => `${formatNumber(n)} u.`} />
          </CardBody>
        </Card>

        {/* Mezcla de canales por mes (apilado) */}
        <Card>
          <CardHeader
            title="Demanda por canal y mes"
            description="Por qué sube cada mes: qué canal aporta la demanda."
          />
          <CardBody>
            <StackedChannelBars
              monthly={demand.monthly}
              formatUnits={(n) => `${formatNumber(n)} u.`}
            />
            <ChannelLegend className="mt-3" />
          </CardBody>
        </Card>
      </div>

      {/* Mezcla de canales: participación + timing */}
      <Card className="mb-4">
        <CardHeader
          title="Mezcla de canales"
          description="Cuánto pesa cada canal en la demanda anual y cuándo es su peak"
        />
        <CardBody>
          <div className="space-y-3">
            {demand.channels.map((c) => (
              <div
                key={c.channel}
                className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
              >
                <div className="flex w-full items-center gap-2 sm:w-56">
                  <span
                    className="h-3 w-3 flex-shrink-0 rounded-sm"
                    style={{ background: CHANNEL_META[c.channel].color }}
                  />
                  <span className="text-sm font-medium text-slate-800">
                    {CHANNEL_META[c.channel].label}
                  </span>
                </div>
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(c.mixPct)}%`,
                      background: CHANNEL_META[c.channel].color,
                    }}
                  />
                </div>
                <div className="flex flex-shrink-0 items-center gap-3 text-xs text-slate-500 sm:w-72 sm:justify-end">
                  <span className="font-semibold text-slate-800">{formatPercent(c.mixPct, 0)}</span>
                  <span>{formatNumber(c.unitsPerMonth)} u./mes</span>
                  <span className="hidden sm:inline">
                    peak {c.peakMonths.length ? c.peakMonths.join(", ") : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {CHANNEL_META[demand.channels[0].channel].description}
          </p>
        </CardBody>
      </Card>

      {/* Cuánto comprar y por qué */}
      <Card>
        <CardHeader
          title="Compra sugerida por canal"
          description="Cómo se reparte la compra sugerida de la categoría según la demanda de cada canal"
        />
        <CardBody>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <span className="text-sm text-slate-500">Compra sugerida del mes</span>
            <span className="text-lg font-semibold text-slate-900">
              {formatCurrency(selected.suggestedPurchase)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {purchaseSplit.map((s) => (
              <div key={s.channel} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: CHANNEL_META[s.channel].color }}
                  />
                  <span className="text-xs text-slate-500">{CHANNEL_META[s.channel].short}</span>
                </div>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {formatCurrencyCompact((selected.suggestedPurchase * s.pct) / 100)}
                </p>
                <p className="text-[11px] text-slate-400">{formatPercent(s.pct, 0)} de la compra</p>
              </div>
            ))}
          </div>
          <HelpNote variant="tip" className="mt-4">
            Considera el canal al decidir: para{" "}
            <b>{demand.channels[0] && CHANNEL_META[demand.channels[0].channel].label}</b> (tu canal
            principal) asegura stock antes de su peak; la demanda de <b>licitaciones</b> es
            escalonada, así que confírmala antes de comprar contra ella.
          </HelpNote>
        </CardBody>
      </Card>
    </div>
  );
}
