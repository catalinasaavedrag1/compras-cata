import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
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
import {
  SupplierTermsAgreements,
  SupplierNegotiationRecord,
  SupplierMaster,
} from "./SupplierDetailSections";
import { useSupplierFicha } from "../hooks/useFichas";
import {
  formatCurrencyCompact,
  formatDays,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { IconOrders, IconInventory, IconSuppliers } from "../components/ui/icons";
import {
  SUPPLIER_PENDING_WARN_CLP,
  SUPPLIER_COMPLIANCE_CRITICAL,
  SUPPLIER_COMPLIANCE_WARN,
  SUPPLIER_LEAD_TIME_WARN_DAYS,
} from "../utils/constants";
import { supplierScoreFromFicha } from "../utils/supplierScore";

// ============================================================================
//  Ficha de proveedor (F11) conectada al purchase-bff-service: el :id de la
//  ruta es el supplierId real de la relación (SUP-…). Todo sale de
//  GET /suppliers/:id (relación indispensable, resto degradable); Órdenes y
//  Recepciones se piden aparte con su filtro supplierId. Regla de oro: dato
//  sin fuente real ⇒ "—" o estado vacío honesto, nunca cifras inventadas.
// ============================================================================

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") ?? "ficha");

  const { data, loading, error, notFound, configured, refetch } = useSupplierFicha(id);

  const pageTitle = data?.name ?? id ?? "Proveedor";
  const breadcrumbs = [{ label: "Proveedores", to: "/proveedores" }, { label: pageTitle }];

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, cargando, error y 404 (patrón F1).
  // --------------------------------------------------------------------------
  if (!configured) {
    return (
      <div>
        <PageHeader breadcrumbs={breadcrumbs} title={pageTitle} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver la ficha real del proveedor.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div>
        <PageHeader breadcrumbs={breadcrumbs} title={pageTitle} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando ficha del proveedor">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="py-10">
        <EmptyState
          title="Proveedor no encontrado"
          description={`No existe una relación comercial "${id}" en el servicio de compras.`}
          action={<Button onClick={() => navigate("/proveedores")}>Volver a proveedores</Button>}
        />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader breadcrumbs={breadcrumbs} title={pageTitle} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudo cargar la ficha del proveedor
            </p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!data || !id) return null;

  const { metrics, summary, catalog } = data;
  const score = supplierScoreFromFicha(data);

  // Catálogo: más vendidos (unidades 30d) y detenidos (stock sin venta).
  const topSold = catalog.items
    .filter((p) => (p.salesLast30d ?? 0) > 0)
    .sort((a, b) => (b.salesLast30d ?? 0) - (a.salesLast30d ?? 0))
    .slice(0, 5);
  const detenidos = catalog.items.filter(
    (p) => p.salesLast30d === 0 && (p.stockAvailable ?? 0) > 0
  );
  // Capital inmovilizado a costo de los detenidos (solo con costo conocido).
  const stalledWithCost = detenidos.filter(
    (p) => p.unitCostClp !== null && p.stockAvailable !== null
  );
  const stalledCapital =
    stalledWithCost.length > 0
      ? stalledWithCost.reduce((a, p) => a + (p.stockAvailable ?? 0) * (p.unitCostClp ?? 0), 0)
      : null;

  // Importancia y poder de negociación: derivación simple y orientativa de la
  // participación real en la compra 90d (sin señales inventadas).
  const share = summary.purchased90Share;
  const importance =
    share !== null && share >= 0.3
      ? { label: "Estratégico", tone: "violet" as const }
      : share !== null && share >= 0.1
        ? { label: "Importante", tone: "blue" as const }
        : { label: "Secundario", tone: "neutral" as const };
  const negotiationPower =
    share === null ? "—" : share > 0.3 ? "Media-alta" : share > 0.1 ? "Media" : "Baja";

  return (
    <div>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={data.name}
        description={[data.rut, data.sapCardCode].filter(Boolean).join(" · ") || undefined}
        action={<StatusBadge kind="supplier" value={data.status} />}
      />

      {/* Aviso discreto de composición parcial (secciones degradadas del BFF) */}
      {data.warnings && data.warnings.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Ficha con datos parciales: {data.warnings.map((w) => w.message).join(" · ")}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Cumplimiento"
          value={metrics.compliancePct !== null ? formatPercent(metrics.compliancePct, 0) : "—"}
          tone={
            metrics.compliancePct === null
              ? "neutral"
              : metrics.compliancePct < SUPPLIER_COMPLIANCE_CRITICAL
                ? "bad"
                : metrics.compliancePct < SUPPLIER_COMPLIANCE_WARN
                  ? "warn"
                  : "good"
          }
          icon={<IconSuppliers className="w-4 h-4" />}
          description="Entregas a tiempo"
          info={<MetricHint metric="cumplimiento" />}
        />
        <KpiCard
          title="Lead time"
          value={
            metrics.leadTimeDaysObserved !== null ? formatDays(metrics.leadTimeDaysObserved) : "—"
          }
          tone={
            metrics.leadTimeDaysObserved !== null &&
            metrics.leadTimeDaysObserved >= SUPPLIER_LEAD_TIME_WARN_DAYS
              ? "warn"
              : "neutral"
          }
          icon={<IconInventory className="w-4 h-4" />}
          description="Promedio observado"
          info={<MetricHint metric="leadTime" />}
        />
        <KpiCard
          title="OC abiertas"
          value={summary.ordersOpen !== null ? formatNumber(summary.ordersOpen) : "—"}
          tone="info"
          icon={<IconOrders className="w-4 h-4" />}
          description="Ver órdenes"
          onClick={() => setTab("ordenes")}
          active={tab === "ordenes"}
        />
        <KpiCard
          title="Monto pendiente"
          value={
            metrics.pendingAmountClp !== null
              ? formatCurrencyCompact(metrics.pendingAmountClp)
              : "—"
          }
          tone={
            metrics.pendingAmountClp !== null && metrics.pendingAmountClp > SUPPLIER_PENDING_WARN_CLP
              ? "warn"
              : "neutral"
          }
          icon={<IconOrders className="w-4 h-4" />}
          info={<MetricHint metric="pendiente" />}
        />
      </div>

      {/* Reclamos: el desempeño operativo también pesa en la evaluación */}
      <SupplierClaimsAlert
        totalClaims={summary.claimsTotal ?? 0}
        openCount={summary.claimsOpen ?? 0}
        onNavigate={() => navigate("/reclamos")}
      />

      {/* Evaluación de desempeño (cumplimiento, período y reclamos) */}
      <PerformanceScoreCard score={score} hasEvaluation={data.evaluation !== null} />

      {/* Motivo de revisión si aplica */}
      <SupplierReviewBanner data={data} />

      {/* Resumen para atender al proveedor */}
      <SupplierSummaryStrip
        importance={importance}
        sales30Units={catalog.sales30Units}
        avgMarginPct={catalog.avgMarginPct}
        delayedCount={summary.ordersDelayed}
        onOpenOrders={() => setTab("ordenes")}
      />

      <NegotiationCockpit
        stalledCount={catalog.stalledCount}
        stalledCapital={stalledCapital}
        compliancePct={metrics.compliancePct}
        delayedCount={summary.ordersDelayed}
        negotiationPower={negotiationPower}
        skuCount={catalog.skuCount}
        purchased90Clp={summary.purchased90Clp}
        purchased90Share={summary.purchased90Share}
      />

      {/* Más vendidos / Productos detenidos */}
      <SupplierTopProducts topSold={topSold} detenidos={detenidos} />

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "ficha", label: "Ficha" },
          { value: "negociacion", label: "Negociación", count: data.negotiations.length },
          { value: "temporadas", label: "Temporadas" },
          { value: "productos", label: "Catálogo", count: catalog.items.length },
          { value: "ordenes", label: "Órdenes", count: summary.ordersTotal ?? undefined },
          { value: "recepciones", label: "Recepciones", count: summary.receptionsTotal ?? undefined },
          { value: "alertas", label: "Alertas", count: data.alerts.length },
        ]}
      />

      {tab === "ficha" && <SupplierMaster data={data} />}

      {tab === "negociacion" && (
        <div className="space-y-4">
          <SupplierNegotiationRecord
            supplierId={id}
            negotiations={data.negotiations}
            onCreated={refetch}
          />
          <SupplierTermsAgreements
            supplierId={id}
            terms={data.terms}
            agreements={data.agreements}
            onCreated={refetch}
          />
        </div>
      )}

      {tab === "temporadas" && (
        <Card>
          <EmptyState
            title="Temporadas"
            description="Las temporadas se conectan en su propio flujo; esta ficha no las compone todavía."
          />
        </Card>
      )}

      {tab === "productos" && <SupplierCatalogTab items={catalog.items} />}

      {tab === "ordenes" && <SupplierOrdersTab supplierId={id} />}

      {tab === "recepciones" && <SupplierReceptionsTab supplierId={id} />}

      {tab === "alertas" && <SupplierAlertsTab alerts={data.alerts} />}
    </div>
  );
}
