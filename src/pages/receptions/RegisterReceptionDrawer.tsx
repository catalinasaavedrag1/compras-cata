import { useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../context/ToastContext";
import { usePurchaseOrders } from "../../hooks/usePurchaseOrders";
import type { ReceptionActionResult } from "../../hooks/useReceptions";
import {
  describePurchaseBffError,
  getPurchaseOrder,
  toPurchaseBffError,
  type CreateReceptionBody,
  type CreateReceptionItemBody,
  type PurchaseOrderBffStatus,
  type PurchaseOrderView,
  type ReceptionDetailView,
  type ReceptionItemCondition,
} from "../../services/purchaseBff";
import { formatNumber } from "../../utils/formatters";
import { CONDITION_LABEL_ES, PO_STATUS_LABEL_ES } from "./helpers";

// ============================================================================
//  Registro manual de recepción (C21): formulario mínimo contra una OC real.
//  - Selector de OC receivable (sent / confirmed / partially_received) desde
//    usePurchaseOrders; las líneas se traen bajo demanda con el detalle.
//  - Cantidades recibidas por línea + condición + nota; bodega y guía.
//  - El dominio crea la recepción directamente en `checking`.
// ============================================================================

/** Estados de OC contra los que el dominio acepta registrar recepción. */
const RECEIVABLE_PO_STATUSES: PurchaseOrderBffStatus[] = [
  "sent",
  "confirmed",
  "partially_received",
];

const CONDITION_OPTIONS = (Object.keys(CONDITION_LABEL_ES) as ReceptionItemCondition[]).map(
  (value) => ({ value, label: CONDITION_LABEL_ES[value] })
);

interface LineInput {
  qty: string;
  condition: ReceptionItemCondition;
  note: string;
}

/** Línea de la OC con lo que resta por recibir (parciales previos descontados). */
interface PendingLine {
  lineId: string;
  sku: string;
  skuName: string;
  remaining: number;
}

export function RegisterReceptionDrawer({
  onClose,
  onRegister,
  onRegistered,
}: {
  onClose: () => void;
  onRegister: (body: CreateReceptionBody) => Promise<ReceptionActionResult>;
  onRegistered: (reception: ReceptionDetailView) => void;
}) {
  const toast = useToast();
  const { orders, loading, error, configured, refetch } = usePurchaseOrders();

  const [selectedId, setSelectedId] = useState("");
  const [poDetail, setPoDetail] = useState<PurchaseOrderView | null>(null);
  const [linesLoading, setLinesLoading] = useState(false);
  const [linesError, setLinesError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, LineInput>>({});
  const [warehouseId, setWarehouseId] = useState("");
  const [packingSlip, setPackingSlip] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const receivable = useMemo(
    () => orders.filter((o) => RECEIVABLE_PO_STATUSES.includes(o.status)),
    [orders]
  );

  const pendingLines = useMemo<PendingLine[]>(() => {
    if (!poDetail?.lines) return [];
    return poDetail.lines
      .map((line) => ({
        lineId: line.lineId,
        sku: line.sku,
        skuName: line.skuName ?? line.sku,
        remaining: Math.max(0, line.qty - (line.qtyReceivedTotal ?? 0)),
      }))
      .filter((line) => line.remaining > 0);
  }, [poDetail]);

  const selectOrder = async (id: string) => {
    setSelectedId(id);
    setPoDetail(null);
    setLinesError(null);
    setInputs({});
    if (!id) return;
    setLinesLoading(true);
    try {
      const detail = await getPurchaseOrder(id);
      setPoDetail(detail);
      const next: Record<string, LineInput> = {};
      detail.lines?.forEach((line) => {
        const remaining = Math.max(0, line.qty - (line.qtyReceivedTotal ?? 0));
        if (remaining > 0) {
          next[line.lineId] = { qty: String(remaining), condition: "ok", note: "" };
        }
      });
      setInputs(next);
    } catch (err) {
      setLinesError(describePurchaseBffError(toPurchaseBffError(err)));
    } finally {
      setLinesLoading(false);
    }
  };

  const setLine = (lineId: string, patch: Partial<LineInput>) => {
    setInputs((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));
  };

  const warehouse = warehouseId.trim();
  const items: CreateReceptionItemBody[] = pendingLines.flatMap((line) => {
    const input = inputs[line.lineId];
    const raw = input?.qty ?? "";
    const qty = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(qty) || qty < 0) return [];
    return [
      {
        purchaseOrderLineId: line.lineId,
        qtyReceived: qty,
        ...(input && input.condition !== "ok" ? { condition: input.condition } : {}),
        ...(input && input.note.trim().length > 0 ? { note: input.note.trim() } : {}),
      },
    ];
  });
  const canSubmit =
    poDetail !== null && warehouse.length > 0 && pendingLines.length > 0 &&
    items.length === pendingLines.length && !submitting;

  const submit = async () => {
    if (!poDetail || !canSubmit) return;
    setSubmitting(true);
    const result = await onRegister({
      purchaseOrderId: poDetail.id,
      warehouseId: warehouse,
      ...(packingSlip.trim().length > 0 ? { packingSlip: packingSlip.trim() } : {}),
      items,
    });
    setSubmitting(false);
    if (result.ok) {
      toast.success(
        `Recepción ${result.reception.displayId} registrada — queda en revisión`
      );
      onRegistered(result.reception);
      return;
    }
    // El 409 del dominio trae mensaje legible (OC no receivable); el resto
    // pasa por el traductor de errores común de los flujos previos.
    toast.error(describePurchaseBffError(result.error));
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Registrar recepción"
      description="La mercadería llegó: regístrala contra su OC. Queda en revisión para completar o rechazar."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canSubmit} onClick={() => void submit()}>
            {submitting ? "Registrando…" : "Registrar recepción"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!configured ? (
          <p className="text-sm text-slate-500">
            Conexión no configurada: define{" "}
            <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para registrar
            recepciones reales.
          </p>
        ) : loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Cargando órdenes de compra">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : error ? (
          <div className="text-sm">
            <p className="text-slate-600">No se pudieron cargar las órdenes de compra.</p>
            <Button className="mt-2" size="sm" variant="secondary" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        ) : receivable.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay OC enviadas, confirmadas o parcialmente recibidas contra las que registrar una
            recepción.
          </p>
        ) : (
          <>
            <Select
              label="Orden de compra"
              value={selectedId}
              onChange={(e) => void selectOrder(e.target.value)}
              placeholder="Selecciona una OC emitida…"
              options={receivable.map((o) => ({
                value: o.id,
                label: `${o.number} · ${o.supplierId ?? o.sapCardCode ?? "—"} · ${
                  PO_STATUS_LABEL_ES[o.status] ?? o.status
                }`,
              }))}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Bodega (código)"
                placeholder="Ej: CD-01"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              />
              <Input
                label="Guía de despacho (opcional)"
                placeholder="N° de guía"
                value={packingSlip}
                onChange={(e) => setPackingSlip(e.target.value)}
              />
            </div>

            {linesLoading && (
              <div className="space-y-2" aria-busy="true" aria-label="Cargando líneas de la OC">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            )}
            {linesError && <p className="text-sm text-rose-600">{linesError}</p>}

            {poDetail && !linesLoading && (
              pendingLines.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Esta OC no tiene cantidades pendientes por recibir.
                </p>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">
                    Cantidades recibidas por línea ({pendingLines.length})
                  </p>
                  <div className="space-y-2">
                    {pendingLines.map((line) => {
                      const input = inputs[line.lineId];
                      return (
                        <div key={line.lineId} className="rounded-lg border border-slate-200 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">
                                {line.skuName}
                              </p>
                              <p className="text-xs text-slate-400 font-mono">{line.sku}</p>
                            </div>
                            <Badge tone="neutral">
                              pendiente {formatNumber(line.remaining)} u.
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <Input
                              label="Recibido"
                              type="number"
                              min={0}
                              value={input?.qty ?? ""}
                              onChange={(e) => setLine(line.lineId, { qty: e.target.value })}
                            />
                            <Select
                              label="Condición"
                              value={input?.condition ?? "ok"}
                              onChange={(e) =>
                                setLine(line.lineId, {
                                  condition: e.target.value as ReceptionItemCondition,
                                })
                              }
                              options={CONDITION_OPTIONS}
                            />
                          </div>
                          <div className="mt-2">
                            <Input
                              label="Nota (opcional)"
                              placeholder="Ej: caja mojada, pallet incompleto…"
                              value={input?.note ?? ""}
                              onChange={(e) => setLine(line.lineId, { note: e.target.value })}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
