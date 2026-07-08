import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { StatusBadge } from "../components/business/StatusBadge";
import { buildOcAudit } from "../data/mockOcHistory";
import { formatCurrency, formatDate, formatNumber } from "../utils/formatters";
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
              <Button variant="primary" onClick={() => navigate("/aprobaciones")}>
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
