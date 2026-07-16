import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Modal } from "../components/ui/Modal";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Drawer } from "../components/ui/Drawer";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { EmptyState } from "../components/ui/EmptyState";
import { DataTable, type Column } from "../components/ui/Table";
import { supplierPath } from "../utils/entityLinks";
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
import { buildOcAudit } from "../data/mockOcHistory";
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber } from "../utils/formatters";
import {
  IconOrders,
  IconReplenish,
  IconPlus,
  IconSearch,
  IconClose,
  IconTruck,
} from "../components/ui/icons";
import { lineNet, type OcDraftItem, type OcDraftMeta } from "../context/OcDraftContext";
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

/** Detalle de una orden de compra: datos, documentos, líneas, factura e historial. */
export function OcDetailModal({
  detail,
  onClose,
  onMarkSent,
}: {
  detail: PurchaseOrder | null;
  onClose: () => void;
  onMarkSent: (id: string) => void;
}) {
  const navigate = useNavigate();
  return (
    <Modal
      open={!!detail}
      onClose={onClose}
      title={detail?.number ?? ""}
      description={detail ? `${detail.supplierName} · ${detail.destinationWarehouse}` : ""}
      footer={
        detail && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
            {detail.status === "pending_approval" && (
              <Button variant="primary" onClick={() => navigate("/comprar/aprobaciones")}>
                Ver aprobaciones
              </Button>
            )}
            {(detail.status === "draft" ||
              detail.status === "approved" ||
              detail.status === "confirmed") && (
              <Button onClick={() => onMarkSent(detail.id)}>Marcar como enviada</Button>
            )}
          </>
        )
      }
    >
      {detail && (
        <div className="space-y-4">
          {detail.status === "pending_approval" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              ⏳ Esta orden tiene líneas fuera de criterio y <b>requiere aprobación</b> antes de
              enviarse al proveedor. Apruébalas en Aprobaciones.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <DetailField
              label="Estado"
              value={<StatusBadge kind="purchaseOrder" value={detail.status} />}
            />
            <DetailField label="Comprador" value={detail.buyerName} />
            <DetailField label="Creación" value={formatDate(detail.createdAt)} />
            <DetailField label="Fecha esperada" value={formatDate(detail.expectedDate)} />
            {detail.confirmedDate && (
              <DetailField label="Confirmada proveedor" value={formatDate(detail.confirmedDate)} />
            )}
            <DetailField
              label="Monto total"
              value={<span className="font-semibold">{formatCurrency(detail.totalAmount)}</span>}
            />
            <DetailField label="N° de SKUs" value={formatNumber(detail.skuCount)} />
            {detail.discountPct != null && (
              <DetailField label="Descuento" value={`${detail.discountPct}%`} />
            )}
            {detail.paymentTerms && <DetailField label="Pago" value={detail.paymentTerms} />}
          </div>

          {detail.comments && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="text-xs text-slate-400">Comentarios: </span>
              {detail.comments}
            </div>
          )}
          {detail.documents && detail.documents.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                Documentos
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detail.documents.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
                  >
                    📎 {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {detail.lines && detail.lines.length > 0 ? (
            (() => {
              const hasReception = detail.lines.some((l) => l.receivedQty != null);
              return (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    {hasReception ? "Productos y diferencias de recepción" : "Productos"}
                  </p>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {detail.lines.map((l) => {
                      const diff = l.receivedQty != null ? l.receivedQty - l.quantity : null;
                      return (
                        <div
                          key={l.sku}
                          className="flex items-center justify-between gap-2 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-mono text-slate-400">{l.sku}</span>
                            <p className="text-sm text-slate-700 truncate">{l.productName}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {hasReception ? (
                              <>
                                <p className="text-sm text-slate-700">
                                  Pedido {formatNumber(l.quantity)} · Recibido{" "}
                                  <b>{formatNumber(l.receivedQty ?? 0)}</b>
                                </p>
                                <p
                                  className={`text-xs font-medium ${diff != null && diff < 0 ? "text-rose-600" : "text-emerald-600"}`}
                                >
                                  {diff != null && diff < 0
                                    ? `Faltan ${formatNumber(-diff)}`
                                    : "Completo"}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-sm font-medium text-slate-800">
                                  {formatNumber(l.quantity)} u.
                                </p>
                                <p className="text-xs text-slate-400">
                                  {formatCurrency(l.unitCost)} c/u
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-sm text-slate-400">
              El detalle de líneas de esta orden no está disponible en la demo.
            </p>
          )}

          {(() => {
            const audit = buildOcAudit(detail);
            return (
              <>
                {audit.invoice && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                      Factura asociada
                    </p>
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <span className="text-slate-700">
                        📄 {audit.invoice.numero} · {formatDate(audit.invoice.fecha)}
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-medium text-slate-800">
                          {formatCurrency(audit.invoice.monto)}
                        </span>
                        <Badge tone={audit.invoice.estado === "con_diferencia" ? "red" : "green"}>
                          {audit.invoice.estado === "con_diferencia"
                            ? `Dif. ${formatCurrency(audit.invoice.diferencia)}`
                            : "Conciliada"}
                        </Badge>
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Historial y auditoría
                  </p>
                  <ol className="relative border-l border-slate-200 ml-1 space-y-3">
                    {audit.changelog.map((e, i) => (
                      <li key={i} className="ml-4">
                        <span className="absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full bg-brand-400 ring-2 ring-white" />
                        <p className="text-sm text-slate-800">
                          {e.accion}
                          {e.detalle && <span className="text-slate-500"> · {e.detalle}</span>}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDate(e.fecha)} · {e.usuario}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            );
          })()}
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
 * Tabla de órdenes de compra (lista + mobileCard). Construye las columnas dentro
 * y recibe el acceso al riesgo y la acción de abrir detalle. (Extraído de PurchaseOrdersPage.)
 */
export function OrdersTable({
  orders,
  riskOf,
  tab,
  onOpenDetail,
}: {
  orders: PurchaseOrder[];
  riskOf: (id: string) => OrderRisk | undefined;
  tab: string;
  onOpenDetail: (o: PurchaseOrder) => void;
}) {
  const columns: Column<PurchaseOrder>[] = [
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
      render: (o) => (
        <Link
          to={supplierPath(o.supplierName)}
          className="text-sm text-slate-700 hover:text-brand-700 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {o.supplierName}
        </Link>
      ),
    },
    {
      key: "dates",
      header: "Creación / Esperada",
      hideOnMobile: true,
      render: (o) => (
        <div className="text-sm">
          <p className="text-slate-700">{formatDate(o.createdAt)}</p>
          <p className="text-xs text-slate-400">espera {formatDate(o.expectedDate)}</p>
        </div>
      ),
    },
    {
      key: "skus",
      header: "SKUs",
      align: "right",
      hideOnMobile: true,
      render: (o) => formatNumber(o.skuCount),
    },
    {
      key: "warehouse",
      header: "Bodega destino",
      hideOnMobile: true,
      render: (o) => <span className="text-sm text-slate-600">{o.destinationWarehouse}</span>,
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(o);
          }}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Ver detalle
        </button>
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
        rowClassName={(o) => (o.status === "delayed" ? "bg-rose-50/40" : undefined)}
        emptyMessage={
          tab === "delayed"
            ? "No hay órdenes de compra atrasadas. Todas están dentro de su fecha esperada de entrega."
            : tab === "draft"
              ? "No tienes borradores. Crea uno desde las sugerencias de reposición."
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
                <p className="text-slate-700">{formatDate(o.expectedDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">SKUs</p>
                <p className="text-slate-700">{formatNumber(o.skuCount)}</p>
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
  createOrder,
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
  createOrder: () => void;
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
      title="Borrador de orden de compra"
      description="Agrega productos, ajusta cantidad, costo y descuento, completa los datos y genera la OC."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={createOrder} disabled={count === 0}>
            {supplierGroups.length > 1 ? `Crear ${supplierGroups.length} OC` : "Crear borrador"} ·{" "}
            {formatCurrency(totalAmount)}
          </Button>
        </>
      }
    >
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
    </Drawer>
  );
}
