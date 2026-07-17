import { Link } from "react-router-dom";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

import { formatDate, formatNumber, formatPercent } from "../../utils/formatters";
import { IconPlus } from "../../components/ui/icons";
import type { ReceptionDetailView, ReceptionItemView } from "../../services/purchaseBff";
import {
  PO_STATUS_LABEL_ES,
  RECEPTION_STATUS_UI,
  lineMissing,
  lineStatus,
} from "./helpers";

// ============================================================================
//  Detalle de una recepción real (drawer): pedido-vs-recibido por línea con
//  condición, bloque de la OC de origen y cumplimiento congelado al completar.
//  Las métricas de rendimiento del proveedor que mostraba el mock se degradan
//  a "—" hasta conectar el flujo de proveedores.
// ============================================================================

/** Fecha ISO (con o sin hora) → dd/mm/aaaa. */
const fmtDate = (iso: string | null) => (iso ? formatDate(iso.slice(0, 10)) : "—");

export function ReceptionDetail({
  detail,
  reorder,
  hasItem,
  reorderBusySku,
}: {
  detail: ReceptionDetailView;
  reorder: (item: ReceptionItemView) => void;
  hasItem: (sku: string) => boolean;
  reorderBusySku: string | null;
}) {
  const status = RECEPTION_STATUS_UI[detail.status];
  const items = detail.items ?? [];
  const supplierRef = detail.purchaseOrder?.supplierRef ?? null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-slate-400">Esperada</p>
          <p className="text-sm font-medium text-slate-800">{fmtDate(detail.expectedDate)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Arribada / Completada</p>
          <p className="text-sm font-medium text-slate-800">
            {fmtDate(detail.arrivedAt)}
            {detail.completedAt ? ` · ${fmtDate(detail.completedAt)}` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Estado</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            {detail.hasDiscrepancy && <Badge tone="red">Con diferencias</Badge>}
          </div>
        </div>
      </div>

      {/* OC de origen */}
      {detail.purchaseOrder && (
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs font-semibold text-slate-700">Orden de compra</p>
            <Link
              to={`/comprar/seguimiento?oc=${encodeURIComponent(detail.purchaseOrder.number)}`}
              className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              {detail.purchaseOrder.number}
            </Link>
            <Badge tone="neutral">
              {PO_STATUS_LABEL_ES[detail.purchaseOrder.status] ?? detail.purchaseOrder.status}
            </Badge>
            <span className="text-xs text-slate-500">
              Proveedor{" "}
              <b
                className="text-slate-700"
                title="Ficha de proveedor disponible al conectar proveedores"
              >
                {supplierRef ?? "—"}
              </b>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {detail.displayId} · bodega {detail.warehouseId}
            {detail.packingSlip ? ` · guía ${detail.packingSlip}` : ""}
          </p>
        </div>
      )}

      {/* Cumplimiento congelado al completar (cuando existe) */}
      {detail.complianceSnap && (
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-700 mb-2">
            Cumplimiento de la recepción
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-slate-800">
                {formatNumber(detail.complianceSnap.expected)}
              </p>
              <p className="text-[10.5px] text-slate-400">Unidades esperadas</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">
                {formatNumber(detail.complianceSnap.received)}
              </p>
              <p className="text-[10.5px] text-slate-400">Unidades recibidas</p>
            </div>
            <div>
              <p
                className={`text-lg font-bold ${
                  detail.complianceSnap.pct >= 100 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {formatPercent(detail.complianceSnap.pct, 1)}
              </p>
              <p className="text-[10.5px] text-slate-400">Cumplimiento</p>
            </div>
          </div>
        </div>
      )}

      {/* Rendimiento del proveedor: métricas degradadas hasta conectar proveedores */}
      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-xs font-semibold text-slate-700 mb-2">
          Rendimiento del proveedor — {supplierRef ?? "—"}
        </p>
        <div
          className="grid grid-cols-3 gap-2 text-center"
          title="Disponible al conectar proveedores"
        >
          <div>
            <p className="text-lg font-bold text-slate-300">—</p>
            <p className="text-[10.5px] text-slate-400">Despacho completo</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-300">—</p>
            <p className="text-[10.5px] text-slate-400">Entrega a tiempo</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-300">—</p>
            <p className="text-[10.5px] text-slate-400">SKUs sin despachar (hist.)</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700 mb-2">
          Detalle por producto ({items.length})
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">Esta recepción no tiene desglose por SKU.</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => {
              const st = lineStatus(it);
              const missing = lineMissing(it);
              const sku = it.sku ?? "";
              return (
                <div
                  key={it.itemId}
                  className={`rounded-lg border px-3 py-2.5 ${
                    missing > 0 || it.condition !== "ok"
                      ? "border-rose-200 bg-rose-50/40"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug">
                        {it.skuName ?? sku ?? "—"}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">{sku || "—"}</p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-slate-500">
                      Pedido <b className="text-slate-800">{formatNumber(it.qtyExpected ?? 0)}</b>
                    </span>
                    <span className="text-slate-500">
                      Recibido <b className="text-slate-800">{formatNumber(it.qtyReceived ?? 0)}</b>
                    </span>
                    {missing > 0 && (
                      <span className="text-rose-600 font-semibold">
                        Faltan {formatNumber(missing)}
                      </span>
                    )}
                  </div>
                  {it.note && <p className="text-xs text-rose-600 mt-1">⚠ {it.note}</p>}
                  {missing > 0 && sku.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={hasItem(sku) ? "secondary" : "primary"}
                        disabled={hasItem(sku) || reorderBusySku === sku}
                        icon={<IconPlus className="w-3.5 h-3.5" />}
                        onClick={() => reorder(it)}
                      >
                        {hasItem(sku)
                          ? "En borrador de OC"
                          : reorderBusySku === sku
                            ? "Agregando…"
                            : `Reordenar ${formatNumber(missing)} u.`}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
