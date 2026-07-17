import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Tabs } from "../components/ui/Tabs";
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
  NegotiationCockpit,
  SupplierTopProducts,
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
import { IconOrders, IconInventory, IconSuppliers } from "../components/ui/icons";
import { isOpenClaim, useClaims } from "../context/ClaimsContext";
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

  // Reclamos reales del servicio de compras (flujo 5), filtrados por el
  // supplierRef persistido en el reclamo. Mientras la ficha siga sobre el
  // maestro mock, la referencia real normalmente no coincide con el nombre y
  // la lista degrada en silencio a vacía (la ficha se conecta en un flujo
  // posterior). El contrato no expone montos: el valor en juego queda en 0.
  const supClaims = forSupplier(supplier.name);
  const openClaims = supClaims.filter((c) => isOpenClaim(c.status));
  const claimsValue = 0;
  const score = supplierScore(
    supplier,
    // Adaptador al shape que evalúa el score: estado mock equivalente, sin monto.
    supClaims.map((c) => ({
      estado:
        c.status === "resolved"
          ? ("resuelto" as const)
          : c.status === "rejected"
            ? ("rechazado" as const)
            : ("abierto" as const),
      valorReclamado: 0,
    }))
  );

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

      <NegotiationCockpit
        costIncreaseCount={costIncreaseProducts.length}
        costImpact={costIncreaseProducts.reduce(
          (sum, p) => sum + p.salesLast30Days * (p.cost - (p.costoAnterior ?? p.cost)),
          0
        )}
        detenidosCount={detenidos.length}
        stalledCapital={stalledCapital}
        compliance={supplier.deliveryCompliance}
        delayedCount={delayedPOs.length}
        growingCount={growingConstrained.length}
        negotiationPower={negotiationPower}
        altCount={alternativeProducts.length}
        activeCount={supProducts.length}
        purchased90={supplier.purchasedAmountLast90Days}
        topCount={topSupplierProducts.length}
        topSalesShare={topSalesShare}
        topProfitShare={topProfitShare}
        complianceWarn={SUPPLIER_COMPLIANCE_WARN}
      />

      {/* Más vendidos / Productos detenidos */}
      <SupplierTopProducts topSold={topSold} detenidos={detenidos} />

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


