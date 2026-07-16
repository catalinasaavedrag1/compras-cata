import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { DataTable, type Column } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Drawer } from "../components/ui/Drawer";
import { Tabs } from "../components/ui/Tabs";
import { HelpNote } from "../components/business/HelpNote";

import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { seasons, getSeasonById } from "../data/mockSeasons";
import { CHANNEL_META } from "../utils/channelDemand";
import { planSeason, seasonHeadline, type ScenarioKey, type SeasonProductPlan } from "../utils/seasonPlan";
import { trackSeason } from "../utils/seasonTracking";
import { formatCurrencyCompact, formatDate, formatNumber, formatPercent } from "../utils/formatters";

import { IconCalendar, IconCart, IconInfo } from "../components/ui/icons";
import { CONFIDENCE_META, RISK_META } from "./seasonPlanner/constants";
import { ChipRow, CompareCell, HeaderField, MiniStat, OriginBar, ProductDetail, ScenarioComparator, SectionTitle, SeasonTrackingView } from "./seasonPlanner/components";

export function SeasonPlannerPage() {
  const { addItem, hasItem } = useOcDraft();
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
    const already = buyable.filter((p) => hasItem(p.sku)).length;
    const added = buyable.length - already;
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
      `${added} propuesta(s) al borrador · ${formatCurrencyCompact(plan.summary.compraPropuesta)}` +
        (already > 0 ? ` · ${already} ya estaban` : ""),
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
              mobileCard={(p) => (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400">
                        {p.sku} · {p.category}
                      </p>
                    </div>
                    <Badge tone={RISK_META[p.risk].tone}>{RISK_META[p.risk].label}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Demanda</p>
                      <p className="text-slate-700">{formatNumber(p.needTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Stock + tránsito</p>
                      <p className="text-slate-700">
                        {formatNumber(p.available)} + {formatNumber(p.inTransit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Compra sugerida</p>
                      <p className="font-semibold text-slate-900">{formatNumber(p.suggested)}</p>
                    </div>
                  </div>
                </div>
              )}
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
            {plan.prior && (
              <HeaderField
                label="Precisión pronóstico ant."
                value={`${Math.max(0, Math.round(100 - plan.prior.quiebrePct - plan.prior.sobrestockPct))}%`}
              />
            )}
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs">
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
