import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Modal } from "../components/ui/Modal";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Drawer } from "../components/ui/Drawer";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { EmptyState } from "../components/ui/EmptyState";
import { DataTable, type Column } from "../components/ui/Table";
import { StatusBadge } from "../components/business/StatusBadge";
import { KpiCard } from "../components/business/KpiCard";
import { SupplierOrderCoach } from "../components/business/SupplierOrderCoach";
import {
  LogisticsInlineSummary,
  LogisticsSummary,
  LogisticsAdvice,
  TruckOptimizer,
} from "../components/business/LogisticsPlan";
import { DraftLineContext, DraftMetric, DraftWarning } from "./purchaseOrders/DraftLineContext";
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber } from "../utils/formatters";
import {
  IconOrders,
  IconReplenish,
  IconPlus,
  IconSearch,
  IconClose,
  IconTruck,
} from "../components/ui/icons";
import { Skeleton } from "../components/ui/Skeleton";
import { lineNet, type OcDraftItem, type OcDraftMeta } from "../context/OcDraftContext";
import {
  getPurchaseOrder,
  toPurchaseBffError,
  type ProposalStatus,
  type ProposalView,
  type PurchaseBffError,
  type PurchaseOrderView,
  type SapSyncView,
} from "../services/purchaseBff";
import { type PurchaseOrderRow } from "../hooks/usePurchaseOrders";
import { getProductBySku, products as allProducts } from "../data/mockProducts";
import { recommendations } from "../data/mockRecommendations";
import {
  supplierMinimumStatus,
  consolidationCandidates,
  earliestOrderBy,
  type ConsolidationCandidate,
} from "../utils/orderConsolidation";
import { TODAY_ISO } from "../utils/constants";
import type { PickupPlan } from "../utils/logistics";
import type { PurchaseOrder, Supplier } from "../types/purchasing";

// ----------------------------------------------------------------------------
//  Sincronización SAP: chip de estado (única ventana a SAP para el usuario)
// ----------------------------------------------------------------------------

/** Estados de sapSync en que la OC sigue viajando hacia SAP. */
export const SAP_IN_FLIGHT_STATUSES = ["pending", "processing"];

/** Chip del estado de sincronización SAP; lastError va en el tooltip. */
export function SapSyncChip({ sap }: { sap: SapSyncView | null | undefined }) {
  switch (sap?.status) {
    case "pending":
    case "processing":
      return <Badge tone="blue">Enviando a SAP…</Badge>;
    case "posted":
      return <Badge tone="green">N° SAP {sap.docNum ?? "—"}</Badge>;
    case "failed":
      return (
        <span title={sap.lastError ?? undefined}>
          <Badge tone="red">Error de envío (reintentar)</Badge>
        </span>
      );
    case "rejected":
      return (
        <span title={sap.lastError ?? undefined}>
          <Badge tone="red">Rechazada por SAP</Badge>
        </span>
      );
    case "cancelled":
      return <Badge tone="neutral">Cancelada</Badge>;
    default:
      return <span className="text-slate-300">—</span>;
  }
}

/** Estados de OC desde los que se puede cancelar (dominio: approved/sent/confirmed). */
export const CANCELLABLE_ORDER_STATUSES = ["approved", "sent", "confirmed"];

/**
 * Detalle de una orden de compra real: datos de cabecera, líneas del contrato
 * y bloque de integración SAP, con acciones Enviar/Reintentar y Cancelar.
 */
export function OrderDetailModal({
  order,
  busy,
  onClose,
  onSend,
  onCancelRequest,
}: {
  order: PurchaseOrderRow | null;
  busy: boolean;
  onClose: () => void;
  onSend: (order: PurchaseOrderRow, version: number) => void;
  onCancelRequest: (order: PurchaseOrderRow, version: number) => void;
}) {
  const [detail, setDetail] = useState<PurchaseOrderView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const id = order?.id ?? null;

  useEffect(() => {
    if (!id) {
      setDetail(null);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    getPurchaseOrder(id)
      .then((view) => {
        if (active) setDetail(view);
      })
      .catch((err) => {
        if (active) setError(toPurchaseBffError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  // sapSync vivo: el de la fila lo actualiza el polling; el detalle es snapshot.
  const sap = order?.sapSync ?? detail?.sapSync ?? null;
  const version = detail?.version ?? order?.version ?? 0;
  const sapFailed = sap?.status === "failed";
  const lines = detail?.lines ?? [];

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title={order?.number ?? ""}
      description={order ? `Proveedor ${order.supplierName}` : ""}
      footer={
        order && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
            {CANCELLABLE_ORDER_STATUSES.includes(order.status) && (
              <Button
                variant="ghost"
                disabled={busy || loading}
                onClick={() => onCancelRequest(order, version)}
              >
                Cancelar OC
              </Button>
            )}
            {order.status === "approved" && (
              <Button disabled={busy || loading} onClick={() => onSend(order, version)}>
                {busy ? "Enviando…" : sapFailed ? "Reintentar envío" : "Enviar al proveedor"}
              </Button>
            )}
          </>
        )
      }
    >
      {order && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <DetailField
              label="Estado"
              value={<StatusBadge kind="purchaseOrder" value={order.status} />}
            />
            <DetailField label="Comprador" value={order.buyerName} />
            <DetailField label="Creación" value={formatDate(order.createdAt)} />
            <DetailField
              label="Fecha esperada"
              value={order.expectedDate ? formatDate(order.expectedDate) : "Por confirmar"}
            />
            <DetailField
              label="Monto neto"
              value={<span className="font-semibold">{formatCurrency(order.totalAmount)}</span>}
            />
            <DetailField
              label="Líneas"
              value={loading ? "…" : formatNumber(lines.length || order.skuCount)}
            />
          </div>

          {/* Bloque de integración SAP: única ventana al avance del documento. */}
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Integración SAP
              </p>
              <SapSyncChip sap={sap} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <DetailField label="N° SAP" value={sap?.docNum != null ? String(sap.docNum) : "—"} />
              <DetailField
                label="Referencia técnica"
                value={sap?.docEntry != null ? String(sap.docEntry) : "—"}
              />
              <DetailField label="Intentos" value={formatNumber(sap?.attempts ?? 0)} />
              <DetailField
                label="Contabilizada"
                value={sap?.postedAt ? formatDate(sap.postedAt.slice(0, 10)) : "—"}
              />
            </div>
            {(sap?.status === "failed" || sap?.status === "rejected") && sap.lastError && (
              <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {sap.status === "rejected"
                  ? "SAP rechazó el documento: "
                  : "Último error de envío: "}
                {sap.lastError}
              </div>
            )}
            {SAP_IN_FLIGHT_STATUSES.includes(sap?.status ?? "") && (
              <p className="mt-2 text-xs text-slate-500">
                El documento está en cola hacia SAP; el estado se actualiza automáticamente.
              </p>
            )}
          </div>

          {order.status === "cancelled" && order.cancelReason && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="text-xs text-slate-400">Motivo de cancelación: </span>
              {order.cancelReason}
            </div>
          )}

          {loading ? (
            <div className="space-y-2.5" aria-busy="true" aria-label="Cargando líneas">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-slate-200 px-3 py-3 text-center">
              <p className="text-sm text-slate-600">
                No se pudo cargar el detalle de líneas: {error.message}
              </p>
              <Button
                className="mt-2"
                size="sm"
                variant="secondary"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                Reintentar
              </Button>
            </div>
          ) : lines.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Productos
              </p>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {lines.map((l) => (
                  <div key={l.lineId} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <span className="text-xs font-mono text-slate-400">{l.sku}</span>
                      <p className="text-sm text-slate-700 truncate">{l.skuName ?? l.sku}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-slate-800">
                        {formatNumber(l.qty)} u.
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatCurrency(l.unitCostClp ?? 0)} c/u ·{" "}
                        {formatCurrency(l.subtotalClp ?? (l.unitCostClp ?? 0) * l.qty)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Esta orden no tiene líneas registradas.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="text-sm text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}

interface DraftSummaryData {
  mainSupplier: string;
  avgCoverage: number;
  critical: number;
  openOverlap: number;
  overSuggested: number;
  highCoverage: number;
}

interface DraftBudgetData {
  availableBefore: number;
  over: number;
  overCategories: { categoria: string }[];
}

/**
 * Tarjeta "Compra en curso": resumen del borrador (proveedor, cobertura, OTB) y
 * observaciones antes de formalizar. (Extraído de PurchaseOrdersPage.)
 */
export function DraftSummaryCard({
  draftSummary,
  count,
  totalAmount,
  pickupPlan,
  budget,
  onOpenPlan,
  onContinue,
}: {
  draftSummary: DraftSummaryData;
  count: number;
  totalAmount: number;
  pickupPlan: PickupPlan;
  budget: DraftBudgetData;
  onOpenPlan: () => void;
  onContinue: () => void;
}) {
  return (
    <Card className="mb-4 border-brand-200">
      <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Compra en curso
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            Borrador · {draftSummary.mainSupplier}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {count} SKU · {formatCurrency(totalAmount)} · cobertura futura promedio{" "}
            {draftSummary.avgCoverage > 0 ? `${draftSummary.avgCoverage} días` : "sin venta"}
          </p>
          {pickupPlan.truckCount > 0 && (
            <button
              type="button"
              onClick={onOpenPlan}
              className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-left hover:border-brand-200 hover:bg-brand-50/40"
            >
              <LogisticsInlineSummary plan={pickupPlan} />
              <span className="flex-shrink-0 text-xs font-medium text-brand-600">
                Ver plan de retiro →
              </span>
            </button>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Link to="/presupuesto" className="block" title="Ver Open-to-Buy por categoría">
              <DraftMetric
                label="Presupuesto disp. (OTB)"
                value={formatCurrencyCompact(budget.availableBefore)}
              />
            </Link>
            <DraftMetric
              label="Cobertura futura"
              value={draftSummary.avgCoverage > 0 ? `${draftSummary.avgCoverage} d` : "n/a"}
            />
            <DraftMetric label="SKU críticos" value={formatNumber(draftSummary.critical)} />
            <DraftMetric label="Valor OC" value={formatCurrencyCompact(totalAmount)} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Observaciones antes de formalizar
          </p>
          <div className="mt-2 space-y-2 text-sm">
            <DraftWarning count={draftSummary.openOverlap} text="productos tienen OC abiertas" />
            <DraftWarning
              count={draftSummary.overSuggested}
              text="cantidades superan la recomendación"
            />
            <DraftWarning
              count={draftSummary.highCoverage}
              text="productos quedarían con cobertura mayor a 90 días"
            />
            <DraftWarning
              count={budget.over}
              text={
                budget.overCategories.length > 0
                  ? `sobre OTB en ${budget.overCategories.map((c) => c.categoria).join(", ")}`
                  : "sobre presupuesto disponible (OTB)"
              }
              currency
            />
          </div>
          <Button className="mt-3 w-full" size="sm" onClick={onContinue}>
            Continuar trabajando
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Fila de KPIs de órdenes (monto en curso, atrasadas, borradores, total) que
 * también actúan como selector de pestaña. (Extraído de PurchaseOrdersPage.)
 */
export function OrdersKpiRow({
  totalOpenAmount,
  delayedCount,
  draftCount,
  totalCount,
  tab,
  onTabChange,
}: {
  totalOpenAmount: number;
  delayedCount: number;
  draftCount: number;
  totalCount: number;
  tab: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <KpiCard
        title="Monto en curso"
        value={formatCurrencyCompact(totalOpenAmount)}
        tone="info"
        icon={<IconOrders className="w-4 h-4" />}
        description="Ver en curso"
        active={tab === "open"}
        onClick={() => onTabChange("open")}
      />
      <KpiCard
        title="Atrasadas"
        value={formatNumber(delayedCount)}
        tone="bad"
        icon={<IconReplenish className="w-4 h-4" />}
        description="Ver atrasadas"
        active={tab === "delayed"}
        onClick={() => onTabChange("delayed")}
      />
      <KpiCard
        title="Borradores"
        value={formatNumber(draftCount)}
        tone="warn"
        icon={<IconPlus className="w-4 h-4" />}
        description="Ver borradores"
        active={tab === "draft"}
        onClick={() => onTabChange("draft")}
      />
      <KpiCard
        title="Total OC"
        value={formatNumber(totalCount)}
        tone="neutral"
        icon={<IconOrders className="w-4 h-4" />}
        description="Ver todas"
        active={tab === "all"}
        onClick={() => onTabChange("all")}
      />
    </div>
  );
}

interface OrderRisk {
  value: number;
  skus: number;
}

/**
 * Tabla de órdenes de compra reales (lista + mobileCard) con columna SAP y
 * estados de carga/vacío/error/no-configurado. Construye las columnas dentro y
 * recibe el acceso al riesgo y las acciones de detalle y reintento de envío.
 */
export function OrdersTable({
  orders,
  riskOf,
  tab,
  loading,
  error,
  configured,
  busyId,
  onRetry,
  onOpenDetail,
  onRetrySend,
}: {
  orders: PurchaseOrderRow[];
  riskOf: (id: string) => OrderRisk | undefined;
  tab: string;
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  busyId: string | null;
  onRetry: () => void;
  onOpenDetail: (o: PurchaseOrderRow) => void;
  onRetrySend: (o: PurchaseOrderRow) => void;
}) {
  if (!configured) {
    return (
      <Card>
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
          <p className="mt-1 text-sm text-slate-500">
            Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
            ver las órdenes de compra reales y su sincronización con SAP.
          </p>
        </div>
      </Card>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <Card>
        <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando órdenes de compra">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error && orders.length === 0) {
    return (
      <Card>
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-slate-800">
            No se pudieron cargar las órdenes de compra
          </p>
          <p className="mt-1 text-sm text-slate-500">{error.message}</p>
          <Button className="mt-4" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  const columns: Column<PurchaseOrderRow>[] = [
    {
      key: "number",
      header: "N° OC",
      render: (o) => (
        <div>
          <p className="font-medium text-slate-800">{o.number}</p>
          <p className="text-xs text-slate-400">{o.buyerName}</p>
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Proveedor",
      render: (o) => <span className="text-sm text-slate-700">{o.supplierName}</span>,
    },
    {
      key: "dates",
      header: "Creación / Esperada",
      hideOnMobile: true,
      render: (o) => (
        <div className="text-sm">
          <p className="text-slate-700">{formatDate(o.createdAt)}</p>
          <p className="text-xs text-slate-400">
            {o.expectedDate ? `espera ${formatDate(o.expectedDate)}` : "sin fecha esperada"}
          </p>
        </div>
      ),
    },
    {
      key: "sap",
      header: "SAP",
      hideOnMobile: true,
      render: (o) => <SapSyncChip sap={o.sapSync} />,
    },
    {
      key: "amount",
      header: "Monto total",
      align: "right",
      render: (o) => (
        <span className="font-semibold text-slate-900">{formatCurrency(o.totalAmount)}</span>
      ),
    },
    {
      key: "delay",
      header: "Atraso",
      align: "center",
      render: (o) =>
        o.delayedDays > 0 ? (
          <Badge tone="red">{o.delayedDays} d</Badge>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: "risk",
      header: "Venta en riesgo",
      align: "right",
      sortable: true,
      sortValue: (o) => riskOf(o.id)?.value ?? 0,
      render: (o) => {
        const r = riskOf(o.id);
        if (!r || r.value <= 0) return <span className="text-slate-300">—</span>;
        return (
          <div className="text-sm">
            <p className="font-semibold text-rose-600">{formatCurrencyCompact(r.value)}/mes</p>
            <p className="text-xs text-slate-400">{formatNumber(r.skus)} SKU por quebrar</p>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Estado",
      render: (o) => <StatusBadge kind="purchaseOrder" value={o.status} />,
    },
    {
      key: "actions",
      header: "",
      render: (o) => (
        <div className="flex items-center justify-end gap-2">
          {o.sapSync?.status === "failed" && o.status === "approved" && (
            <Button
              size="sm"
              disabled={busyId === o.id}
              onClick={(e) => {
                e.stopPropagation();
                onRetrySend(o);
              }}
            >
              {busyId === o.id ? "Enviando…" : "Reintentar envío"}
            </Button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(o);
            }}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Ver detalle
          </button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <DataTable
        columns={columns}
        data={orders}
        rowKey={(o) => o.id}
        onRowClick={(o) => onOpenDetail(o)}
        rowClassName={(o) => (o.delayedDays > 0 ? "bg-rose-50/40" : undefined)}
        emptyMessage={
          tab === "delayed"
            ? "No hay órdenes de compra atrasadas. Todas están dentro de su fecha esperada de entrega."
            : tab === "open"
              ? "No hay OC en seguimiento. Convierte una propuesta aprobada para generar OC reales."
              : "No hay órdenes de compra en esta vista."
        }
        mobileCard={(o) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-800">{o.number}</p>
                <p className="text-xs text-slate-400">
                  {o.supplierName} · {o.buyerName}
                </p>
              </div>
              <StatusBadge kind="purchaseOrder" value={o.status} dot={false} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
              <div>
                <p className="text-xs text-slate-400">Esperada</p>
                <p className="text-slate-700">
                  {o.expectedDate ? formatDate(o.expectedDate) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">SAP</p>
                <SapSyncChip sap={o.sapSync} />
              </div>
              <div>
                <p className="text-xs text-slate-400">Monto</p>
                <p className="text-slate-700">{formatCurrencyCompact(o.totalAmount)}</p>
              </div>
            </div>
            {(() => {
              const r = riskOf(o.id);
              if (!r || r.value <= 0) return null;
              return (
                <p className="mt-2 text-xs font-medium text-rose-600">
                  Venta en riesgo: {formatCurrencyCompact(r.value)}/mes · {formatNumber(r.skus)} SKU
                  por quebrar
                  {o.delayedDays > 0 ? ` · atraso ${o.delayedDays} d` : ""}
                </p>
              );
            })()}
          </div>
        )}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------
//  Pestaña Borradores: propuestas reales del purchase-bff-service
// ----------------------------------------------------------------------------

/** Estado de la propuesta → Badge en español. */
export const PROPOSAL_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Borrador", tone: "amber" },
  in_review: { label: "En revisión", tone: "blue" },
  changes_requested: { label: "Con observaciones", tone: "violet" },
  approved: { label: "Aprobada", tone: "green" },
  rejected: { label: "Rechazada", tone: "red" },
  cancelled: { label: "Cancelada", tone: "neutral" },
  converted: { label: "Convertida", tone: "green" },
};

export function proposalStatusMeta(status: ProposalStatus) {
  return PROPOSAL_STATUS_META[status] ?? { label: status, tone: "neutral" as const };
}

/** Estados desde los que se puede enviar a revisión. */
const SUBMITTABLE_STATUSES: ProposalStatus[] = ["draft", "changes_requested"];
/** Estados desde los que se puede cancelar (flujo 2: sin approved/converted). */
const CANCELLABLE_STATUSES: ProposalStatus[] = ["draft", "changes_requested", "in_review"];
/** Estados desde los que se puede convertir en OC (flujo 3). */
const CONVERTIBLE_STATUSES: ProposalStatus[] = ["approved"];

/**
 * Tabla de propuestas en trabajo (borrador / en revisión / con observaciones /
 * aprobadas) con acciones Enviar a revisión, Cancelar y Convertir en OC.
 * Reemplaza el listado mock de OCs en la pestaña Borradores.
 */
export function ProposalDraftsTable({
  proposals,
  loading,
  error,
  configured,
  busyId,
  onRetry,
  onSubmit,
  onCancel,
  onConvert,
}: {
  proposals: ProposalView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  busyId: string | null;
  onRetry: () => void;
  onSubmit: (p: ProposalView) => void;
  onCancel: (p: ProposalView) => void;
  onConvert: (p: ProposalView) => void;
}) {
  if (!configured) {
    return (
      <Card>
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
          <p className="mt-1 text-sm text-slate-500">
            Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
            ver las propuestas de compra reales.
          </p>
        </div>
      </Card>
    );
  }

  if (loading && proposals.length === 0) {
    return (
      <Card>
        <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando propuestas">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error && proposals.length === 0) {
    return (
      <Card>
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-slate-800">
            No se pudieron cargar las propuestas
          </p>
          <p className="mt-1 text-sm text-slate-500">{error.message}</p>
          <Button className="mt-4" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  const columns: Column<ProposalView>[] = [
    {
      key: "title",
      header: "Propuesta",
      render: (p) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-slate-800">{p.title ?? "Borrador de compra"}</p>
          <p className="text-xs text-slate-400 font-mono">{p.id}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (p) => {
        const meta = proposalStatusMeta(p.status);
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      key: "lines",
      header: "Líneas",
      align: "right",
      hideOnMobile: true,
      render: (p) => formatNumber(p.lineCount ?? 0),
    },
    {
      key: "suppliers",
      header: "Proveedores",
      align: "right",
      hideOnMobile: true,
      render: (p) => formatNumber(p.supplierCount ?? 0),
    },
    {
      key: "net",
      header: "Neto",
      align: "right",
      render: (p) => (
        <span className="font-semibold text-slate-900">
          {formatCurrency(p.netTotalClp ?? p.totals?.netClp ?? 0)}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Actualizada",
      hideOnMobile: true,
      render: (p) => (
        <span className="text-sm text-slate-600">
          {p.updatedAt ? formatDate(p.updatedAt.slice(0, 10)) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (p) => {
        const busy = busyId === p.id;
        return (
          <div className="flex justify-end gap-2">
            {SUBMITTABLE_STATUSES.includes(p.status) && (
              <Button size="sm" disabled={busy} onClick={() => onSubmit(p)}>
                {busy ? "Enviando…" : "Enviar a revisión"}
              </Button>
            )}
            {CONVERTIBLE_STATUSES.includes(p.status) && (
              <Button size="sm" disabled={busy} onClick={() => onConvert(p)}>
                {busy ? "Convirtiendo…" : "Convertir en OC"}
              </Button>
            )}
            {CANCELLABLE_STATUSES.includes(p.status) && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onCancel(p)}>
                Cancelar
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Card>
      <DataTable
        columns={columns}
        data={proposals}
        rowKey={(p) => p.id}
        emptyMessage="Sin propuestas en borrador. Agrega productos desde Reposición sugerida para crear una."
        mobileCard={(p) => {
          const meta = proposalStatusMeta(p.status);
          const busy = busyId === p.id;
          return (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">
                    {p.title ?? "Borrador de compra"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatNumber(p.lineCount ?? 0)} líneas ·{" "}
                    {formatCurrencyCompact(p.netTotalClp ?? p.totals?.netClp ?? 0)}
                  </p>
                </div>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>
              <div className="mt-2 flex gap-2">
                {SUBMITTABLE_STATUSES.includes(p.status) && (
                  <Button size="sm" disabled={busy} onClick={() => onSubmit(p)}>
                    {busy ? "Enviando…" : "Enviar a revisión"}
                  </Button>
                )}
                {CONVERTIBLE_STATUSES.includes(p.status) && (
                  <Button size="sm" disabled={busy} onClick={() => onConvert(p)}>
                    {busy ? "Convirtiendo…" : "Convertir en OC"}
                  </Button>
                )}
                {CANCELLABLE_STATUSES.includes(p.status) && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => onCancel(p)}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          );
        }}
      />
    </Card>
  );
}

const WAREHOUSES = [
  "Centro de Distribución",
  "Bodega Santiago",
  "Bodega Norte",
  "Bodega Sur",
  "Tienda Central",
];
const PAYMENT_TERMS = [
  "Contado",
  "15 días fecha factura",
  "30 días fecha factura",
  "60 días fecha factura",
  "90 días fecha factura",
];

/**
 * Editor (Drawer) del borrador de orden de compra: buscar/agregar productos,
 * cabecera, análisis de línea, líneas agrupadas por proveedor con su coach,
 * totales, plan de retiro en vivo y sugerencias. (Extraído de PurchaseOrdersPage.)
 */
export function OrderDraftDrawer({
  open,
  onClose,
  navigate,
  onSubmitDraft,
  submitting,
  configured,
  count,
  supplierGroups,
  subtotal,
  discountAmount,
  totalAmount,
  prodSearch,
  setProdSearch,
  searchResults,
  hasItem,
  addProduct,
  meta,
  setMeta,
  selectedDraftItem,
  orders,
  draftContextTab,
  setDraftContextTab,
  updateQuantity,
  updateItem,
  removeItem,
  setDraftContextSku,
  items,
  supplierByName,
  addCandidate,
  pickupPlan,
  pendingSuggestions,
}: {
  open: boolean;
  onClose: () => void;
  navigate: (to: string) => void;
  onSubmitDraft: () => void;
  submitting: boolean;
  configured: boolean;
  count: number;
  supplierGroups: [string, OcDraftItem[]][];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  prodSearch: string;
  setProdSearch: (value: string) => void;
  searchResults: (typeof allProducts)[number][];
  hasItem: (sku: string) => boolean;
  addProduct: (sku: string) => void;
  meta: OcDraftMeta;
  setMeta: (patch: Partial<OcDraftMeta>) => void;
  selectedDraftItem: OcDraftItem | null;
  orders: PurchaseOrder[];
  draftContextTab: string;
  setDraftContextTab: (tab: string) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  updateItem: (sku: string, patch: Partial<OcDraftItem>) => void;
  removeItem: (sku: string) => void;
  setDraftContextSku: (sku: string) => void;
  items: OcDraftItem[];
  supplierByName: Map<string, Supplier>;
  addCandidate: (supplierName: string, c: ConsolidationCandidate) => void;
  pickupPlan: PickupPlan;
  pendingSuggestions: (typeof recommendations)[number][];
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Borrador de propuesta de compra"
      description="Agrega productos, ajusta cantidades y envía la propuesta a revisión."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={onSubmitDraft} disabled={count === 0 || submitting || !configured}>
            {submitting ? "Enviando…" : "Enviar a revisión"} · {formatCurrency(totalAmount)}
          </Button>
        </>
      }
    >
      {!configured ? (
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
          <p className="mt-1 text-sm text-slate-500">
            Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
            trabajar el borrador real de la propuesta de compra.
          </p>
        </div>
      ) : (
      <div className="space-y-4">
        {/* Buscar y agregar cualquier producto */}
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
            Agregar productos
          </p>
          <Input
            icon={<IconSearch className="w-4 h-4" />}
            placeholder="Buscar producto por nombre o SKU…"
            value={prodSearch}
            onChange={(e) => setProdSearch(e.target.value)}
          />
          {prodSearch.trim().length >= 2 && (
            <div className="mt-1.5 rounded-lg border border-slate-200 divide-y divide-slate-50 max-h-56 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-400">Sin coincidencias.</p>
              ) : (
                searchResults.map((p) => {
                  const added = hasItem(p.sku);
                  return (
                    <button
                      key={p.sku}
                      disabled={added}
                      onClick={() => addProduct(p.sku)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-60 disabled:cursor-default"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800 truncate">
                          {p.name}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {p.sku} · {p.supplierName || "Sin proveedor"} · {formatCurrency(p.cost)}
                        </span>
                      </span>
                      <span
                        className={`text-xs font-semibold flex-shrink-0 ${added ? "text-slate-400" : "text-brand-600"}`}
                      >
                        {added ? "En borrador" : "Agregar"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {count === 0 ? (
          <EmptyState
            title="El borrador está vacío"
            description="Busca un producto arriba, o agrégalos desde Reposición sugerida o las sugerencias de abajo."
            action={
              <Button
                onClick={() => {
                  onClose();
                  navigate("/comprar/decisiones");
                }}
              >
                Ir a reposición
              </Button>
            }
          />
        ) : (
          <>
            {/* Datos de cabecera de la orden */}
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2.5">
                Datos de la orden
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Bodega destino"
                  value={meta.destinationWarehouse}
                  onChange={(e) => setMeta({ destinationWarehouse: e.target.value })}
                  options={WAREHOUSES.map((w) => ({ value: w, label: w }))}
                />
                <Select
                  label="Condición de pago"
                  value={meta.paymentTerms}
                  onChange={(e) => setMeta({ paymentTerms: e.target.value })}
                  options={PAYMENT_TERMS.map((t) => ({ value: t, label: t }))}
                />
                <Input
                  label="Fecha esperada"
                  type="date"
                  value={meta.expectedDate}
                  onChange={(e) => setMeta({ expectedDate: e.target.value })}
                />
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Observaciones
                  </label>
                  <textarea
                    value={meta.notes}
                    onChange={(e) => setMeta({ notes: e.target.value })}
                    rows={2}
                    placeholder="Notas para el proveedor o internas…"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>
            </div>

            {selectedDraftItem && (
              <DraftLineContext
                item={selectedDraftItem}
                orders={orders}
                tab={draftContextTab}
                onTabChange={setDraftContextTab}
                onQuantityChange={(quantity) => updateQuantity(selectedDraftItem.sku, quantity)}
                onOpenProduct={() => navigate(`/productos/${selectedDraftItem.sku}`)}
              />
            )}

            {/* Líneas agrupadas por proveedor */}
            {supplierGroups.map(([supplierName, groupItems]) => {
              const net = groupItems.reduce((a, i) => a + lineNet(i), 0);
              const units = groupItems.reduce((a, i) => a + i.quantity, 0);
              const supplier = supplierByName.get(supplierName);
              const leadTime =
                supplier?.averageLeadTimeDays ??
                getProductBySku(groupItems[0]?.sku)?.supplierLeadTimeDays ??
                7;
              const minimum = supplierMinimumStatus(supplier, net, units);
              const candidates = consolidationCandidates({
                supplierName,
                draftSkus: new Set(items.map((i) => i.sku)),
                products: allProducts,
                recommendations,
                horizonDays: leadTime + 30,
                todayISO: TODAY_ISO,
                limit: 3,
              });
              const orderBy = earliestOrderBy(
                groupItems
                  .map((i) => getProductBySku(i.sku))
                  .filter((p): p is NonNullable<typeof p> => !!p)
                  .map((p) => ({
                    availableStock: p.availableStock,
                    salesLast30Days: p.salesLast30Days,
                    leadTimeDays: p.supplierLeadTimeDays,
                  })),
                TODAY_ISO
              );
              return (
                <div
                  key={supplierName}
                  className="rounded-lg border border-slate-200 overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 border-b border-slate-100">
                    <span className="text-sm font-semibold text-slate-800 truncate">
                      {supplierName}
                    </span>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {groupItems.length} línea{groupItems.length === 1 ? "" : "s"} ·{" "}
                      <b className="text-slate-700">{formatCurrency(net)}</b>
                    </span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {groupItems.map((it) => (
                      <div key={it.sku} className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {it.productName}
                            </p>
                            <p className="text-xs text-slate-400 font-mono">{it.sku}</p>
                          </div>
                          <button
                            onClick={() => removeItem(it.sku)}
                            aria-label={`Quitar ${it.productName}`}
                            className="text-slate-300 hover:text-rose-600 flex-shrink-0"
                          >
                            <IconClose className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <label className="block text-[11px] text-slate-500">
                            Cantidad
                            <Input
                              type="number"
                              min={0}
                              value={it.quantity}
                              onChange={(e) => updateQuantity(it.sku, Number(e.target.value))}
                            />
                          </label>
                          <label className="block text-[11px] text-slate-500">
                            Costo unit.
                            <Input
                              type="number"
                              min={0}
                              value={it.unitCost}
                              onChange={(e) =>
                                updateItem(it.sku, {
                                  unitCost: Math.max(0, Number(e.target.value)),
                                })
                              }
                            />
                          </label>
                          <label className="block text-[11px] text-slate-500">
                            Desc. %
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={it.discountPct ?? 0}
                              onChange={(e) =>
                                updateItem(it.sku, {
                                  discountPct: Math.max(0, Math.min(100, Number(e.target.value))),
                                })
                              }
                            />
                          </label>
                        </div>
                        <div className="flex justify-end items-baseline gap-2 mt-1.5 text-sm">
                          <button
                            type="button"
                            onClick={() => setDraftContextSku(it.sku)}
                            className="mr-auto text-xs font-medium text-brand-600 hover:text-brand-700"
                          >
                            Analizar línea
                          </button>
                          <span className="text-xs text-slate-400">Total línea</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(lineNet(it))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <SupplierOrderCoach
                    supplierName={supplierName}
                    minimum={minimum}
                    candidates={candidates}
                    orderBy={orderBy}
                    onAdd={(c) => addCandidate(supplierName, c)}
                  />
                </div>
              );
            })}

            {/* Totales */}
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-700">{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Descuento</span>
                  <span className="text-emerald-600">− {formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-sm font-medium text-slate-600">Total</span>
                <span className="text-base font-semibold text-slate-900">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              {supplierGroups.length > 1 && (
                <p className="text-[11px] text-slate-400 pt-0.5">
                  Se generarán {supplierGroups.length} órdenes (una por proveedor).
                </p>
              )}
            </div>

            {/* Plan de retiro en vivo: cómo se retirará físicamente la mercadería */}
            {pickupPlan.truckCount > 0 && (
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <IconTruck className="w-4 h-4 text-brand-600" />
                    Plan de retiro
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate("/comprar/plan-retiro");
                    }}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    Ver detalle por camión →
                  </button>
                </div>
                <TruckOptimizer plan={pickupPlan} />
                <div className="mt-3">
                  <LogisticsSummary plan={pickupPlan} />
                </div>
                <div className="mt-3">
                  <LogisticsAdvice plan={pickupPlan} />
                </div>
              </div>
            )}
          </>
        )}

        {pendingSuggestions.length > 0 && (
          <div className="pt-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Sugerencias para agregar
            </p>
            <div className="space-y-2">
              {pendingSuggestions.slice(0, 6).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.productName}</p>
                    <p className="text-xs text-slate-500">
                      {r.supplierName} · {formatNumber(r.suggestedQuantity)} u. ·{" "}
                      {formatCurrency(r.suggestedPurchaseAmount)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<IconPlus className="w-3.5 h-3.5" />}
                    onClick={() => addProduct(r.sku)}
                  >
                    Agregar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}
    </Drawer>
  );
}
