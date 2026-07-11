import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { DataTable, type Column } from "../components/ui/Table";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Drawer } from "../components/ui/Drawer";
import { Tabs } from "../components/ui/Tabs";
import { HelpNote } from "../components/business/HelpNote";
import { MonthlyBars } from "../components/business/SeasonalityChart";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { seasons, getSeasonById } from "../data/mockSeasons";
import { CHANNEL_META } from "../utils/channelDemand";
import {
  planSeason,
  seasonHeadline,
  SCENARIOS,
  type ScenarioKey,
  type SeasonProductPlan,
  type ConfidenceLevel,
  type SeasonRisk,
} from "../utils/seasonPlan";
import {
  trackSeason,
  type SeasonTracking,
  type ChannelTracking,
  type ProductTracking,
  type AlertTone,
} from "../utils/seasonTracking";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { cn } from "../utils/cn";
import { IconCalendar, IconTruck, IconCart, IconInfo } from "../components/ui/icons";

const CONFIDENCE_META: Record<ConfidenceLevel, { label: string; tone: BadgeTone }> = {
  alta: { label: "Confianza alta", tone: "green" },
  media: { label: "Confianza media", tone: "amber" },
  baja: { label: "Confianza baja", tone: "red" },
};

const RISK_META: Record<SeasonRisk, { label: string; tone: BadgeTone }> = {
  alto_quiebre: { label: "Alto quiebre", tone: "red" },
  medio: { label: "Riesgo medio", tone: "amber" },
  sobrestock: { label: "Sobrestock", tone: "violet" },
  normal: { label: "Normal", tone: "green" },
};

const SCENARIO_ORDER: ScenarioKey[] = ["conservador", "probable", "agresivo"];

export function SeasonPlannerPage() {
  const { addItem } = useOcDraft();
  const toast = useToast();
  const navigate = useNavigate();

  const [seasonId, setSeasonId] = useState(seasons[0].id);
  const [scenario, setScenario] = useState<ScenarioKey>("probable");
  const [detailSku, setDetailSku] = useState<string | null>(null);
  const [tab, setTab] = useState("plan");

  const season = getSeasonById(seasonId) ?? seasons[0];

  // Un plan por escenario (para el comparador) y el activo.
  const plansByScenario = useMemo(
    () => ({
      conservador: planSeason(season, "conservador"),
      probable: planSeason(season, "probable"),
      agresivo: planSeason(season, "agresivo"),
    }),
    [season]
  );
  const plan = plansByScenario[scenario];
  const tracking = useMemo(() => trackSeason(plan), [plan]);
  const detail = plan.products.find((p) => p.sku === detailSku) ?? null;

  const addAllToDraft = () => {
    const buyable = plan.products.filter((p) => p.suggested > 0);
    buyable.forEach((p) =>
      addItem({
        sku: p.sku,
        productName: p.name,
        supplierName: p.supplierName,
        quantity: p.suggested,
        unitCost: p.cost,
      })
    );
    toast.success(
      `${buyable.length} propuesta(s) agregada(s) al borrador de OC (${formatNumber(
        plan.summary.unitsTotal
      )} u.)`,
      { label: "Ir al borrador", onClick: () => navigate("/comprar/borradores") }
    );
  };

  const columns: Column<SeasonProductPlan>[] = [
    {
      key: "product",
      header: "Producto",
      render: (p) => (
        <div className="min-w-[190px]">
          <p className="font-medium text-slate-800">{p.name}</p>
          <p className="text-xs text-slate-400">
            {p.sku} · {p.category}
          </p>
        </div>
      ),
    },
    {
      key: "origin",
      header: "Origen (tienda/ecom/mkt/empresa/licit)",
      hideOnMobile: true,
      render: (p) => (
        <span className="text-xs text-slate-500">
          {formatNumber(p.histAdjusted + p.growth)} / {formatNumber(p.ecommerce)} /{" "}
          {formatNumber(p.mercadoLibre + p.falabella)} / {formatNumber(p.empresaConfirmed)} /{" "}
          {formatNumber(p.licitConfirmed + p.licitWeighted)}
        </span>
      ),
    },
    {
      key: "need",
      header: "Demanda",
      align: "right",
      render: (p) => (
        <span className="font-medium text-slate-800">{formatNumber(p.needTotal)}</span>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      hideOnMobile: true,
      render: (p) => formatNumber(p.available),
    },
    {
      key: "transit",
      header: "Tránsito",
      align: "right",
      hideOnMobile: true,
      render: (p) => (p.inTransit > 0 ? formatNumber(p.inTransit) : "—"),
    },
    {
      key: "suggested",
      header: "Compra sugerida",
      align: "right",
      render: (p) => (
        <span className="font-semibold text-slate-900">{formatNumber(p.suggested)}</span>
      ),
    },
    {
      key: "cover",
      header: "Cobertura post",
      align: "right",
      hideOnMobile: true,
      render: (p) => `${formatNumber(p.coverageAfterDays)} d`,
    },
    {
      key: "confidence",
      header: "Confianza",
      align: "center",
      hideOnMobile: true,
      render: (p) => <Badge tone={CONFIDENCE_META[p.confidence].tone}>{p.confidence}</Badge>,
    },
    {
      key: "risk",
      header: "Riesgo",
      align: "center",
      render: (p) => <Badge tone={RISK_META[p.risk].tone}>{RISK_META[p.risk].label}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Planificador de temporada"
        description="Planifica la compra por temporada: qué demanda se espera, de qué canal viene, qué está comprometido y qué riesgo hay si compras de más o de menos."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Temporada"
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              options={seasons.map((s) => ({ value: s.id, label: s.name }))}
              className="sm:w-52"
            />
            <Button icon={<IconCart className="w-4 h-4" />} onClick={addAllToDraft}>
              Generar propuestas OC
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { value: "plan", label: "Planificación" },
            { value: "track", label: "Seguimiento", count: tracking.alerts.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* Encabezado de la temporada (común a ambas pestañas) */}
      <SeasonHeader />

      {tab === "track" ? (
        <SeasonTrackingView tracking={tracking} onOpenProduct={setDetailSku} />
      ) : (
        <>
          {/* Recomendación en lenguaje natural */}
          <HelpNote className="mb-4">{seasonHeadline(plan)}</HelpNote>

          {/* Nivel 1 · Resumen ejecutivo */}
          <SectionTitle n={1} title="Resumen ejecutivo" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <KpiCard
              title="Venta proyectada"
              value={formatCurrencyCompact(plan.summary.ventaProyectada)}
              tone="info"
              icon={<IconCalendar className="w-4 h-4" />}
              description="demanda × precio"
            />
            <KpiCard
              title="Compra propuesta"
              value={formatCurrencyCompact(plan.summary.compraPropuesta)}
              tone="neutral"
              icon={<IconCart className="w-4 h-4" />}
              description={`${formatNumber(plan.summary.unitsTotal)} u.`}
            />
            <KpiCard
              title="Margen esperado"
              value={formatPercent(plan.summary.margenEsperado, 1)}
              tone="good"
              icon={<IconInfo className="w-4 h-4" />}
              description="de la temporada"
            />
            <KpiCard
              title="Presupuesto usado"
              value={formatPercent(plan.summary.presupuestoUtilizadoPct, 0)}
              tone={plan.summary.presupuestoUtilizadoPct > 100 ? "bad" : "info"}
              icon={<IconInfo className="w-4 h-4" />}
              description={formatCurrencyCompact(season.budget)}
            />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <MiniStat
              label="Inventario inicial"
              value={formatCurrencyCompact(plan.summary.inventarioInicial)}
            />
            <MiniStat
              label="Inventario final proy."
              value={formatCurrencyCompact(plan.summary.inventarioFinal)}
            />
            <MiniStat
              label="Riesgo de quiebre"
              value={formatPercent(plan.summary.riesgoQuiebrePct, 0)}
              tone={plan.summary.riesgoQuiebrePct > 15 ? "bad" : "ok"}
            />
            <MiniStat
              label="Nivel de servicio"
              value={`${plan.summary.nivelServicio}%`}
              tone={plan.summary.nivelServicio >= 95 ? "ok" : "warn"}
            />
          </div>

          {/* vs temporada anterior */}
          <Card className="mb-5">
            <CardHeader
              title="Temporada anterior vs actual"
              description="Cómo se compara el plan con la temporada pasada"
            />
            <CardBody>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <CompareCell
                  label="Compra"
                  prev={formatCurrencyCompact(plan.prior.compra)}
                  now={formatCurrencyCompact(plan.summary.compraPropuesta)}
                />
                <CompareCell
                  label="Venta"
                  prev={formatCurrencyCompact(plan.prior.venta)}
                  now={formatCurrencyCompact(plan.summary.ventaPotencial)}
                />
                <CompareCell
                  label="Margen"
                  prev={formatPercent(plan.prior.margen, 1)}
                  now={formatPercent(plan.summary.margenEsperado, 1)}
                  good={plan.summary.margenEsperado >= plan.prior.margen}
                />
                <CompareCell
                  label="Quiebres"
                  prev={formatPercent(plan.prior.quiebrePct, 1)}
                  now={formatPercent(plan.summary.riesgoQuiebrePct, 1)}
                  good={plan.summary.riesgoQuiebrePct <= plan.prior.quiebrePct}
                />
                <CompareCell
                  label="Sobrestock"
                  prev={formatPercent(plan.prior.sobrestockPct, 1)}
                  now={formatPercent(plan.summary.riesgoSobrestockPct, 1)}
                  good={plan.summary.riesgoSobrestockPct <= plan.prior.sobrestockPct}
                />
              </div>
            </CardBody>
          </Card>

          {/* Nivel 2 · Distribución por origen */}
          <SectionTitle n={2} title="Distribución de la demanda por origen" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <Card>
              <CardHeader
                title="Demanda segura vs incierta"
                description="De dónde viene la demanda que sustenta la compra"
              />
              <CardBody>
                <OriginBar plan={plan} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Demanda por canal y origen"
                description="Unidades estimadas por cada fuente"
              />
              <CardBody>
                <div className="space-y-1.5">
                  {plan.origin.byChannel.map((o) => (
                    <div key={o.label} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-slate-600">{o.label}</span>
                      <span className="tabular-nums font-medium text-slate-800">
                        {formatNumber(o.units)}{" "}
                        <span className="text-xs text-slate-400">
                          ({formatPercent((o.units / (plan.origin.total || 1)) * 100, 0)})
                        </span>
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5 text-sm">
                    <span className="font-semibold text-slate-700">Demanda total estimada</span>
                    <span className="font-semibold text-slate-900">
                      {formatNumber(plan.origin.total)}
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Escenarios */}
          <SectionTitle n={3} title="Escenarios de compra" />
          <ScenarioComparator
            plansByScenario={plansByScenario}
            active={scenario}
            onSelect={setScenario}
          />

          {/* Nivel 3 · Tabla de productos */}
          <SectionTitle n={4} title="Detalle por producto" />
          <Card>
            <DataTable
              columns={columns}
              data={plan.products}
              rowKey={(p) => p.sku}
              onRowClick={(p) => setDetailSku(p.sku)}
              rowClassName={(p) => (p.risk === "alto_quiebre" ? "bg-rose-50/40" : undefined)}
              emptyMessage="No hay productos en las categorías de esta temporada."
            />
          </Card>
        </>
      )}

      {/* Nivel 4 · Detalle explicativo del producto */}
      <Drawer
        open={!!detail}
        onClose={() => setDetailSku(null)}
        title={detail?.name ?? ""}
        description={detail ? `${detail.sku} · ${detail.category} · ${detail.supplierName}` : ""}
      >
        {detail && <ProductDetail p={detail} />}
      </Drawer>
    </div>
  );

  function SeasonHeader() {
    return (
      <Card className="mb-4">
        <CardBody>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
            <HeaderField
              label="Venta esperada"
              value={`${formatDate(season.saleFrom)} → ${formatDate(season.saleTo)}`}
            />
            <HeaderField
              label="Ventana de compra"
              value={`${formatDate(season.buyFrom)} → ${formatDate(season.buyTo)}`}
            />
            <HeaderField label="Deadline OC" value={formatDate(season.ocDeadline)} highlight />
            <HeaderField label="Lead time" value={`${season.leadTimeDays} días`} />
            <HeaderField label="Presupuesto" value={formatCurrencyCompact(season.budget)} />
            <HeaderField label="Crecimiento esp." value={`+${season.expectedGrowthPct}%`} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-xs">
            <ChipRow label="Categorías" items={season.categories} />
            <ChipRow label="Canales" items={season.channels.map((c) => CHANNEL_META[c].short)} />
            <ChipRow label="Bodegas" items={season.warehouses} />
          </div>
        </CardBody>
      </Card>
    );
  }
}

// ----------------------------------------------------------------------------
//  Piezas de presentación
// ----------------------------------------------------------------------------

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
        {n}
      </span>
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
    </div>
  );
}

function HeaderField({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold",
          highlight ? "text-rose-600" : "text-slate-800"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ChipRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{label}:</span>
      <span className="flex flex-wrap gap-1">
        {items.map((it) => (
          <Badge key={it} tone="neutral">
            {it}
          </Badge>
        ))}
      </span>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  const color =
    tone === "bad" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("mt-0.5 text-base font-semibold", color)}>{value}</p>
    </div>
  );
}

function CompareCell({
  label,
  prev,
  now,
  good,
}: {
  label: string;
  prev: string;
  now: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xs text-slate-400 line-through">{prev}</p>
      <p
        className={cn(
          "text-base font-semibold",
          good === undefined ? "text-slate-900" : good ? "text-emerald-600" : "text-rose-600"
        )}
      >
        {now}
      </p>
    </div>
  );
}

function OriginBar({ plan }: { plan: ReturnType<typeof planSeason> }) {
  const o = plan.origin;
  const segments = [
    { label: "Confirmada", units: o.confirmada, color: "#10b981" },
    { label: "Histórica proyectada", units: o.historicaProyectada, color: "#1f49d6" },
    { label: "Probable ponderada", units: o.probablePonderada, color: "#f59e0b" },
    { label: "Campañas", units: o.campanas, color: "#8b5cf6" },
    { label: "Stock estratégico", units: o.stockEstrategico, color: "#64748b" },
  ].filter((s) => s.units > 0);
  const total = o.total || 1;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.units / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${formatNumber(s.units)}`}
          />
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular-nums font-medium text-slate-800">
              {formatNumber(s.units)}{" "}
              <span className="text-xs text-slate-400">
                ({formatPercent((s.units / total) * 100, 0)})
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScenarioComparator({
  plansByScenario,
  active,
  onSelect,
}: {
  plansByScenario: Record<ScenarioKey, ReturnType<typeof planSeason>>;
  active: ScenarioKey;
  onSelect: (s: ScenarioKey) => void;
}) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
      {SCENARIO_ORDER.map((key) => {
        const s = plansByScenario[key].summary;
        const meta = SCENARIOS[key];
        const isActive = key === active;
        const overBudget = s.presupuestoUtilizadoPct > 100;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors",
              isActive
                ? "border-brand-400 bg-brand-50/50 ring-1 ring-brand-200"
                : "border-slate-200 bg-white hover:border-brand-200"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">{meta.label}</span>
              {isActive && <Badge tone="blue">Activo</Badge>}
            </div>
            <p className="mt-1 text-xs text-slate-500">{meta.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <ScStat label="Compra" value={formatCurrencyCompact(s.compraPropuesta)} />
              <ScStat label="Venta pot." value={formatCurrencyCompact(s.ventaPotencial)} />
              <ScStat label="Margen" value={formatPercent(s.margenEsperado, 1)} />
              <ScStat label="Quiebre" value={formatPercent(s.riesgoQuiebrePct, 0)} />
              <ScStat label="Sobrestock" value={formatPercent(s.riesgoSobrestockPct, 0)} />
              <ScStat
                label="Presupuesto"
                value={formatPercent(s.presupuestoUtilizadoPct, 0)}
                warn={overBudget}
              />
            </div>
            {key === "agresivo" && (
              <p className="mt-2 text-[11px] text-amber-600">
                Más disponibilidad, pero mayor capital inmovilizado.
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ScStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={cn("font-semibold", warn ? "text-rose-600" : "text-slate-800")}>{value}</p>
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Detalle del producto (nivel 4)
// ----------------------------------------------------------------------------

function ProductDetail({ p }: { p: SeasonProductPlan }) {
  // Fórmula con total corriente.
  let running = 0;
  const rows = p.components.map((c) => {
    running += c.deduct ? -c.units : c.units;
    return { ...c, running };
  });

  const stockoutWeek = p.weekly.find((w) => w.stock <= 0)?.week;

  return (
    <div className="space-y-5">
      {/* Confianza + riesgo */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={CONFIDENCE_META[p.confidence].tone}>
          {CONFIDENCE_META[p.confidence].label}
        </Badge>
        <Badge tone={RISK_META[p.risk].tone}>{RISK_META[p.risk].label}</Badge>
        <span className="text-xs text-slate-500">{p.confidenceReasons.join(" · ")}</span>
      </div>

      {/* Fórmula explicable */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cómo se calcula la compra sugerida
        </p>
        <div className="rounded-lg border border-slate-200 divide-y divide-slate-50">
          {rows.map((c) => (
            <div
              key={c.key}
              className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
            >
              <span className={cn(c.deduct ? "text-slate-500" : "text-slate-700")}>
                {c.deduct ? "−" : "+"} {c.label}
              </span>
              <span className={cn("tabular-nums", c.deduct ? "text-rose-600" : "text-slate-800")}>
                {c.deduct ? "−" : ""}
                {formatNumber(c.units)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 text-sm">
            <span className="font-semibold text-slate-700">Compra sugerida</span>
            <span className="font-semibold text-slate-900">
              {formatNumber(p.suggested)} u.{" "}
              {p.multiplo > 1 && (
                <span className="text-xs text-slate-400">(múltiplo {p.multiplo})</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Origen de la demanda */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Origen de la demanda
        </p>
        <div className="space-y-1">
          {p.origin.map((o) => (
            <div key={o.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-600">{o.label}</span>
              <span className="tabular-nums font-medium text-slate-800">
                {formatNumber(o.units)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Evolución semanal */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Evolución semanal (pronóstico y stock proyectado)
        </p>
        <MonthlyBars
          data={p.weekly.map((w) => ({
            label: `S${w.week}`,
            value: w.forecast,
            highlight: w.week === stockoutWeek,
          }))}
          format={(n) => `${formatNumber(n)} u.`}
          height={110}
        />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>
            Cobertura actual <b className="text-slate-700">{formatNumber(p.coverageNowDays)} d</b>
          </span>
          <span>
            Post-compra <b className="text-slate-700">{formatNumber(p.coverageAfterDays)} d</b> ·{" "}
            {formatNumber(p.weeksCovered)} sem.
          </span>
          {stockoutWeek ? (
            <span className="text-rose-600">
              Quiebre proyectado sin compra: semana {stockoutWeek}
            </span>
          ) : (
            <span className="text-emerald-600">Sin quiebre proyectado en la temporada</span>
          )}
        </div>
      </div>

      {/* Datos de compra */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Margen" value={formatPercent(p.margin, 0)} />
        <MiniStat label="Rotación" value={`${formatNumber(p.rotation)}x`} />
        <MiniStat label="Lead time" value={`${p.leadTimeDays} d`} />
        <MiniStat label="Llegada estimada" value={formatDate(p.etaDate)} />
        <MiniStat label="Múltiplo compra" value={formatNumber(p.multiplo)} />
        <MiniStat label="Pedido mínimo" value={formatNumber(p.moq)} />
        <MiniStat
          label="Venta perdida est."
          value={p.lostSaleEstimate > 0 ? formatCurrencyCompact(p.lostSaleEstimate) : "—"}
          tone={p.lostSaleEstimate > 0 ? "bad" : undefined}
        />
        <MiniStat label="Costo unit." value={formatCurrency(p.cost)} />
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <IconTruck className="h-4 w-4 flex-shrink-0 text-brand-500" />
        En tránsito {formatNumber(p.inTransit)} u. · transferible desde otra sucursal{" "}
        {formatNumber(p.transfer)} u.
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Seguimiento durante la temporada (sección 7)
// ----------------------------------------------------------------------------

const ALERT_STYLE: Record<AlertTone, string> = {
  high: "border-rose-200 bg-rose-50 text-rose-900",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
  low: "border-slate-200 bg-slate-50 text-slate-700",
};

function VarianceBadge({ pct }: { pct: number }) {
  const over = pct > 8;
  const under = pct < -8;
  const tone: BadgeTone = over ? "blue" : under ? "amber" : "green";
  const sign = pct > 0 ? "+" : "";
  return (
    <Badge tone={tone}>
      {sign}
      {formatPercent(pct, 0)}
    </Badge>
  );
}

function SeasonTrackingView({
  tracking,
  onOpenProduct,
}: {
  tracking: SeasonTracking;
  onOpenProduct: (sku: string) => void;
}) {
  const toast = useToast();

  const columns: Column<ProductTracking>[] = [
    {
      key: "product",
      header: "Producto",
      render: (p) => (
        <div className="min-w-[170px]">
          <p className="font-medium text-slate-800">{p.name}</p>
          <p className="text-xs text-slate-400">
            {p.sku} · {p.category}
          </p>
        </div>
      ),
    },
    { key: "plan", header: "Plan", align: "right", render: (p) => formatNumber(p.plan) },
    {
      key: "emitido",
      header: "Emitido",
      align: "right",
      hideOnMobile: true,
      render: (p) => formatNumber(p.emitido),
    },
    {
      key: "recibido",
      header: "Recibido",
      align: "right",
      hideOnMobile: true,
      render: (p) => formatNumber(p.recibido),
    },
    {
      key: "venta",
      header: "Venta real",
      align: "right",
      render: (p) => formatNumber(p.ventaReal),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      render: (p) => (
        <span className={p.stockActual <= 0 ? "font-semibold text-rose-600" : "text-slate-700"}>
          {formatNumber(p.stockActual)}
        </span>
      ),
    },
    {
      key: "pron",
      header: "Pronóstico act.",
      align: "right",
      hideOnMobile: true,
      render: (p) => formatNumber(p.pronosticoActual),
    },
    {
      key: "estado",
      header: "Estado",
      align: "center",
      render: (p) =>
        p.stockoutWeek !== null ? (
          <Badge tone="red">Quiebre ~S{p.stockoutWeek}</Badge>
        ) : p.overMax ? (
          <Badge tone="violet">Sobre máx.</Badge>
        ) : p.delayDays > 0 ? (
          <Badge tone="amber">Atraso {p.delayDays}d</Badge>
        ) : (
          <Badge tone="green">En línea</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Avance */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Avance de la temporada</p>
              <p className="text-xs text-slate-500">
                Comparación de plan inicial vs venta real, pronóstico y recepción.
              </p>
            </div>
            <span className="text-lg font-semibold text-brand-700">{tracking.progressPct}%</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${tracking.progressPct}%` }}
            />
          </div>
        </CardBody>
      </Card>

      {/* Comparativa por canal */}
      <Card>
        <CardHeader
          title="Canal: plan vs real"
          description="Venta esperada a la fecha vs venta real por canal"
        />
        <CardBody>
          <div className="space-y-2.5">
            {tracking.channels.map((c: ChannelTracking) => (
              <div key={c.channel} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex w-40 items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                  <span className="text-sm font-medium text-slate-800">{c.label}</span>
                </span>
                <span className="text-xs text-slate-500">
                  esperado <b className="text-slate-700">{formatNumber(c.expectedToDate)}</b> · real{" "}
                  <b className="text-slate-800">{formatNumber(c.actualToDate)}</b>
                </span>
                <span className="ml-auto">
                  <VarianceBadge pct={c.variancePct} />
                </span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Alertas */}
      <Card>
        <CardHeader
          title="Alertas de la temporada"
          description="Qué se desvió del plan y qué acción tomar"
        />
        <CardBody>
          {tracking.alerts.length === 0 ? (
            <p className="text-sm text-slate-500">
              Sin desvíos relevantes: la temporada va en línea.
            </p>
          ) : (
            <div className="space-y-2">
              {tracking.alerts.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between",
                    ALERT_STYLE[a.tone]
                  )}
                >
                  <span className="text-sm">{a.message}</span>
                  <span className="text-xs font-medium opacity-90">→ {a.action}</span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Replanificación */}
      <Card>
        <CardHeader title="Replanificar" description="Ajusta la temporada según la venta real" />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {tracking.replanActions.map((action) => (
              <Button
                key={action}
                size="sm"
                variant="secondary"
                onClick={() => toast.success(`Acción de replanificación: ${action} (simulada)`)}
              >
                {action}
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Tabla de seguimiento por producto */}
      <Card>
        <CardHeader
          title="Seguimiento por producto"
          description="Plan vs emitido, recibido, venta real, stock y pronóstico actualizado"
        />
        <DataTable
          columns={columns}
          data={tracking.products}
          rowKey={(p) => p.sku}
          onRowClick={(p) => onOpenProduct(p.sku)}
          rowClassName={(p) => (p.stockoutWeek !== null ? "bg-rose-50/40" : undefined)}
          emptyMessage="Sin productos en seguimiento."
        />
      </Card>
    </div>
  );
}
