import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Modal } from "../components/ui/Modal";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { StatusBadge } from "../components/business/StatusBadge";
import { KpiCard } from "../components/business/KpiCard";
import { LogisticsInlineSummary } from "../components/business/LogisticsPlan";
import { DraftMetric, DraftWarning } from "./purchaseOrders/DraftLineContext";
import { buildOcAudit } from "../data/mockOcHistory";
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber } from "../utils/formatters";
import { IconOrders, IconReplenish, IconPlus } from "../components/ui/icons";
import type { PickupPlan } from "../utils/logistics";
import type { PurchaseOrder } from "../types/purchasing";

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
