import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusBadge } from "../components/business/StatusBadge";
import { MetricHint } from "../components/business/supplierMetricHelp";
import {
  SupplierCatalogTab,
  SupplierOrdersTab,
  SupplierReceptionsTab,
  SupplierAlertsTab,
} from "./supplierDetail/tabs";
import {
  SupplierClaimsAlert,
  PerformanceScoreCard,
  SupplierReviewBanner,
  SupplierSummaryStrip,
} from "./supplierDetail/overview";
import { suppliers } from "../data/mockSuppliers";
import { products } from "../data/mockProducts";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { receptions } from "../data/mockReceptions";
import { alerts } from "../data/mockAlerts";
import {
  SupplierNegotiation,
  SeasonView,
  SupplierTermsAgreements,
  SupplierNegotiationRecord,
  SupplierMaster,
} from "./SupplierDetailSections";
import {
  formatCurrencyCompact,
  formatDays,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import {
  IconOrders,
  IconInventory,
  IconSuppliers,
  IconSales,
  IconBox,
} from "../components/ui/icons";
import { useClaims } from "../context/ClaimsContext";
import { CLAIM_OPEN_STATES } from "../data/mockClaims";
import { supplierScore } from "../utils/supplierScore";
import {
  SUPPLIER_PENDING_WARN_CLP,
  SUPPLIER_COMPLIANCE_CRITICAL,
  SUPPLIER_COMPLIANCE_WARN,
  SUPPLIER_LEAD_TIME_WARN_DAYS,
} from "../utils/constants";

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") ?? "ficha");
  const { forSupplier } = useClaims();

  const supplier = suppliers.find((s) => s.id === id);

  if (!supplier) {
    return (
      <div className="py-10">
        <EmptyState
          title="Proveedor no encontrado"
          description={`No existe el proveedor "${id}".`}
          action={<Button onClick={() => navigate("/proveedores")}>Volver a proveedores</Button>}
        />
      </div>
    );
  }

  const supClaims = forSupplier(supplier.name);
  const openStates = new Set(CLAIM_OPEN_STATES);
  const openClaims = supClaims.filter((c) => openStates.has(c.estado));
  const claimsValue = openClaims.reduce((a, c) => a + c.valorReclamado, 0);
  const score = supplierScore(supplier, supClaims);

  const supProducts = products.filter((p) => p.supplierName === supplier.name);
  const supSkus = new Set(supProducts.map((p) => p.sku));
  const supPOs = purchaseOrders.filter((o) => o.supplierName === supplier.name);
  const openPOs = supPOs.filter((o) => !["received", "cancelled"].includes(o.status));
  const supReceptions = receptions.filter((r) => r.supplierName === supplier.name);
  const supAlerts = alerts.filter(
    (a) => a.relatedEntity === supplier.name || (a.relatedSku && supSkus.has(a.relatedSku))
  );
  const riskProducts = supProducts.filter(
    (p) => p.availableStock <= 0 && p.salesLast30Days > 0
  ).length;

  // ---- Resumen comercial para atender al proveedor ----
  const sales30Amount = (p: (typeof supProducts)[number]) => p.salesLast30Days * p.price;
  const utility30 = (p: (typeof supProducts)[number]) => p.salesLast30Days * (p.price - p.cost);
  const ventas30 = supProducts.reduce((a, p) => a + sales30Amount(p), 0);
  const utilidad30 = supProducts.reduce((a, p) => a + utility30(p), 0);
  const margenProm = ventas30 > 0 ? (utilidad30 / ventas30) * 100 : 0;

  const topSold = [...supProducts]
    .filter((p) => p.salesLast30Days > 0)
    .sort((a, b) => sales30Amount(b) - sales30Amount(a))
    .slice(0, 5);
  const detenidos = supProducts.filter(
    (p) => p.purchaseStatus === "overstock" || (p.salesLast30Days === 0 && p.availableStock > 0)
  );
  const delayedPOs = supPOs.filter((o) => o.status === "delayed" || o.delayedDays > 0);
  const topSupplierProducts = [...supProducts]
    .map((p) => {
      const expected30 = p.salesLast90Days / 3;
      const growth = expected30 > 0 ? (p.salesLast30Days - expected30) / expected30 : 0;
      const inventoryValue = p.availableStock * p.cost;
      return {
        product: p,
        sales: sales30Amount(p),
        profit: utility30(p),
        growth,
        inventoryValue,
      };
    })
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 10);
  const topSalesShare =
    ventas30 > 0 ? topSupplierProducts.reduce((sum, p) => sum + p.sales, 0) / ventas30 : 0;
  const topProfitShare =
    utilidad30 > 0 ? topSupplierProducts.reduce((sum, p) => sum + p.profit, 0) / utilidad30 : 0;
  const stalledCapital = detenidos.reduce((sum, p) => sum + p.availableStock * p.cost, 0);
  const costIncreaseProducts = supProducts.filter(
    (p) => p.costoAnterior && p.cost > p.costoAnterior * 1.05
  );
  const alternativeProducts = supProducts.filter((p) => (p.equivalencias?.length ?? 0) > 0);
  const growingConstrained = topSupplierProducts.filter(
    (r) =>
      r.growth >= 0.25 &&
      r.product.salesLast30Days > 0 &&
      r.product.availableStock / (r.product.salesLast30Days / 30) <=
        r.product.supplierLeadTimeDays * 2
  );
  const negotiationPower =
    alternativeProducts.length / Math.max(1, supProducts.length) >= 0.45
      ? "Media-alta"
      : supplier.purchasedAmountLast90Days > 120000000
        ? "Media"
        : "Baja";

  // Nivel de importancia: combina compra (90d) vs el mayor del panel y tamaño del surtido
  const maxBuy = Math.max(1, ...suppliers.map((s) => s.purchasedAmountLast90Days));
  const share = supplier.purchasedAmountLast90Days / maxBuy;
  const importance =
    share >= 0.6 || supplier.associatedSkus >= 200
      ? { label: "Estratégico", tone: "violet" as const }
      : share >= 0.3 || supplier.associatedSkus >= 100
        ? { label: "Importante", tone: "blue" as const }
        : { label: "Secundario", tone: "neutral" as const };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Proveedores", to: "/proveedores" }, { label: supplier.name }]}
        title={supplier.name}
        description={`${supplier.rut} · ${supplier.categories.join(", ")}`}
        action={<StatusBadge kind="supplier" value={supplier.status} />}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Cumplimiento"
          value={formatPercent(supplier.deliveryCompliance, 0)}
          tone={
            supplier.deliveryCompliance < SUPPLIER_COMPLIANCE_CRITICAL
              ? "bad"
              : supplier.deliveryCompliance < SUPPLIER_COMPLIANCE_WARN
                ? "warn"
                : "good"
          }
          icon={<IconSuppliers className="w-4 h-4" />}
          description="Entregas a tiempo"
          info={<MetricHint metric="cumplimiento" />}
        />
        <KpiCard
          title="Lead time"
          value={formatDays(supplier.averageLeadTimeDays)}
          tone={supplier.averageLeadTimeDays >= SUPPLIER_LEAD_TIME_WARN_DAYS ? "warn" : "neutral"}
          icon={<IconInventory className="w-4 h-4" />}
          description="Promedio de entrega"
          info={<MetricHint metric="leadTime" />}
        />
        <KpiCard
          title="OC abiertas"
          value={formatNumber(openPOs.length)}
          tone="info"
          icon={<IconOrders className="w-4 h-4" />}
          description="Ver órdenes"
          onClick={() => setTab("ordenes")}
          active={tab === "ordenes"}
        />
        <KpiCard
          title="Monto pendiente"
          value={formatCurrencyCompact(supplier.pendingAmount)}
          tone={supplier.pendingAmount > SUPPLIER_PENDING_WARN_CLP ? "warn" : "neutral"}
          icon={<IconOrders className="w-4 h-4" />}
          info={<MetricHint metric="pendiente" />}
        />
      </div>

      {/* Reclamos: el desempeño operativo también pesa en la evaluación */}
      <SupplierClaimsAlert
        totalClaims={supClaims.length}
        openCount={openClaims.length}
        claimsValue={claimsValue}
        onNavigate={() => navigate("/reclamos")}
      />

      {/* Evaluación de desempeño (OTIF, lead time prometido vs real, reclamos) */}
      <PerformanceScoreCard score={score} />

      {/* Motivo de revisión si aplica */}
      <SupplierReviewBanner supplier={supplier} riskProducts={riskProducts} />

      {/* Resumen para atender al proveedor */}
      <SupplierSummaryStrip
        importance={importance}
        ventas30={ventas30}
        margenProm={margenProm}
        utilidad30={utilidad30}
        delayedCount={delayedPOs.length}
        onOpenOrders={() => setTab("ordenes")}
      />

      <div className="grid grid-cols-1 gap-4 mb-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader
            title="Cockpit de negociación"
            description="Lo que conviene llevar preparado a la reunión con este proveedor."
          />
          <CardBody className="space-y-3">
            <NegotiationAgendaItem
              index={1}
              title="Costo"
              detail={`${costIncreaseProducts.length} SKU subieron más de 5%. Impacto potencial en margen: ${formatCurrencyCompact(costIncreaseProducts.reduce((sum, p) => sum + p.salesLast30Days * (p.cost - (p.costoAnterior ?? p.cost)), 0))}.`}
              ask="Pedir recuperación de margen, descuento por volumen o lista escalonada."
              tone={costIncreaseProducts.length > 0 ? "amber" : "green"}
            />
            <NegotiationAgendaItem
              index={2}
              title="Productos detenidos"
              detail={`${detenidos.length} SKU · ${formatCurrencyCompact(stalledCapital)} inmovilizados.`}
              ask="Solicitar devolución, nota de crédito, apoyo promocional o cambio por otros SKU."
              tone={detenidos.length > 0 ? "red" : "green"}
            />
            <NegotiationAgendaItem
              index={3}
              title="Cumplimiento"
              detail={`OTIF ${formatPercent(supplier.deliveryCompliance, 0)} · ${delayedPOs.length} OC atrasadas.`}
              ask="Acordar objetivo de servicio, lead time realista y plan para atrasos."
              tone={delayedPOs.length > 0 || supplier.deliveryCompliance < SUPPLIER_COMPLIANCE_WARN ? "amber" : "green"}
            />
            <NegotiationAgendaItem
              index={4}
              title="Oportunidad"
              detail={`${growingConstrained.length} SKU crecen sobre 25% con cobertura corta.`}
              ask="Negociar capacidad, prioridad de despacho y precio por volumen."
              tone={growingConstrained.length > 0 ? "blue" : "neutral"}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Posición negociadora"
            description="Dependencia, alternativas y concentración real del proveedor."
          />
          <CardBody className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Posición
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-xl font-semibold text-slate-900">{negotiationPower}</p>
                <Badge tone={negotiationPower === "Media-alta" ? "green" : "amber"}>
                  {formatPercent(
                    (alternativeProducts.length / Math.max(1, supProducts.length)) * 100,
                    0
                  )}{" "}
                  con alternativa
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {topSupplierProducts.length} productos concentran{" "}
                {formatPercent(topSalesShare * 100, 0)} de la venta y{" "}
                {formatPercent(topProfitShare * 100, 0)} de la utilidad del proveedor.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SupplierCockpitMetric
                label="Compras 90d"
                value={formatCurrencyCompact(supplier.purchasedAmountLast90Days)}
              />
              <SupplierCockpitMetric
                label="Productos activos"
                value={formatNumber(supProducts.length)}
              />
              <SupplierCockpitMetric
                label="Alternativas"
                value={formatNumber(alternativeProducts.length)}
              />
              <SupplierCockpitMetric label="Detenidos" value={formatNumber(detenidos.length)} />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Más vendidos / Productos detenidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardBody>
            <div className="flex items-center gap-2 mb-2.5">
              <IconSales className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-semibold text-slate-800">Más vendidos (30 días)</p>
            </div>
            {topSold.length === 0 ? (
              <p className="text-sm text-slate-400">Sin ventas registradas.</p>
            ) : (
              <div className="space-y-1.5">
                {topSold.map((p, i) => (
                  <Link
                    key={p.sku}
                    to={`/productos/${p.sku}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  >
                    <span className="w-5 text-center text-xs font-bold text-slate-400">
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">
                        {p.name}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {formatNumber(p.salesLast30Days)} u. · margen {formatPercent(p.margin, 0)}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-slate-700 flex-shrink-0">
                      {formatCurrencyCompact(sales30Amount(p))}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-2 mb-2.5">
              <IconBox className="w-4 h-4 text-violet-600" />
              <p className="text-sm font-semibold text-slate-800">Productos detenidos</p>
              {detenidos.length > 0 && <Badge tone="violet">{detenidos.length}</Badge>}
            </div>
            {detenidos.length === 0 ? (
              <p className="text-sm text-slate-400">Sin sobrestock ni productos sin venta. 👍</p>
            ) : (
              <div className="space-y-1.5">
                {detenidos.slice(0, 5).map((p) => (
                  <Link
                    key={p.sku}
                    to={`/productos/${p.sku}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">
                        {p.name}
                      </span>
                      <span className="block text-xs text-slate-400">
                        disp. {formatNumber(p.availableStock)} · vende{" "}
                        {formatNumber(p.salesLast30Days)}/mes
                      </span>
                    </span>
                    <Badge tone={p.salesLast30Days === 0 ? "red" : "violet"}>
                      {p.salesLast30Days === 0 ? "Sin venta" : "Sobrestock"}
                    </Badge>
                  </Link>
                ))}
                {detenidos.length > 5 && (
                  <p className="text-xs text-slate-400 pt-0.5">
                    +{detenidos.length - 5} más · ver pestaña Productos
                  </p>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "ficha", label: "Ficha" },
          { value: "negociacion", label: "Negociación" },
          { value: "temporadas", label: "Temporadas" },
          { value: "productos", label: "Catálogo", count: supProducts.length },
          { value: "ordenes", label: "Órdenes", count: supPOs.length },
          { value: "recepciones", label: "Recepciones", count: supReceptions.length },
          { value: "alertas", label: "Alertas", count: supAlerts.length },
        ]}
      />

      {tab === "ficha" && <SupplierMaster supplier={supplier} />}

      {tab === "negociacion" && (
        <div className="space-y-4">
          <SupplierNegotiation supplier={supplier} />
          <SupplierNegotiationRecord supplier={supplier} />
          <SupplierTermsAgreements supplier={supplier} />
        </div>
      )}

      {tab === "temporadas" && <SeasonView supplier={supplier} />}

      {tab === "productos" && <SupplierCatalogTab products={supProducts} />}

      {tab === "ordenes" && <SupplierOrdersTab orders={supPOs} />}

      {tab === "recepciones" && <SupplierReceptionsTab receptions={supReceptions} />}

      {tab === "alertas" && <SupplierAlertsTab alerts={supAlerts} />}
    </div>
  );
}

function NegotiationAgendaItem({
  index,
  title,
  detail,
  ask,
  tone,
}: {
  index: number;
  title: string;
  detail: string;
  ask: string;
  tone: "green" | "amber" | "red" | "blue" | "neutral";
}) {
  const toneClass = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-brand-200 bg-brand-50 text-brand-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold">
          {index}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 text-sm text-slate-700">{detail}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">Pedir: {ask}</p>
        </div>
      </div>
    </div>
  );
}

function SupplierCockpitMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

