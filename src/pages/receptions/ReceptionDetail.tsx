
import { Link } from "react-router-dom";
import { productPath } from "../../utils/entityLinks";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

import { RECEPTION_STATUS } from "../../data/mockReceptions";
import { getProductBySku } from "../../data/mockProducts";
import { supplierFulfillment } from "../../utils/supplierPerf";

import { coverageDays } from "../../utils/calculations";

import { formatDate, formatNumber } from "../../utils/formatters";
import { IconPlus } from "../../components/ui/icons";
import type { Reception } from "../../types/purchasing";
import { lineStatus } from "./helpers";

export function ReceptionDetail({
  detail,
  reorder,
  hasItem,
}: {
  detail: Reception;
  reorder: (sku: string, name: string, supplierName: string, missing: number) => void;
  hasItem: (sku: string) => boolean;
}) {
  const perf = supplierFulfillment(detail.supplierName);

  // Impacto de la recepción parcial: SKUs que quedan bajo cobertura mínima
  const impacted = (detail.items ?? [])
    .filter((it) => it.expected - it.received > 0)
    .map((it) => {
      const p = getProductBySku(it.sku);
      if (!p || p.salesLast30Days <= 0) return null;
      const cover = coverageDays(p.availableStock, p.salesLast30Days);
      const limite = Math.max(7, p.supplierLeadTimeDays);
      return { sku: it.sku, name: it.productName, cover, atRisk: cover <= limite };
    })
    .filter(
      (x): x is { sku: string; name: string; cover: number; atRisk: boolean } =>
        x !== null && x.atRisk
    )
    .sort((a, b) => a.cover - b.cover);

  return (
    <div className="space-y-4">
      {impacted.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          ⚠ <b>Impacto:</b> esta recepción {RECEPTION_STATUS[detail.status].label.toLowerCase()}{" "}
          deja {impacted.length} SKU bajo cobertura mínima. El más urgente:{" "}
          <b>{impacted[0].name}</b>, quiebre estimado en ~
          {Math.max(0, Math.round(impacted[0].cover))} días. Reordena lo faltante o busca proveedor
          alternativo.
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-slate-400">Esperada</p>
          <p className="text-sm font-medium text-slate-800">{formatDate(detail.expectedDate)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Recibida</p>
          <p className="text-sm font-medium text-slate-800">
            {detail.receivedDate ? formatDate(detail.receivedDate) : "Pendiente"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Estado</p>
          <Badge tone={RECEPTION_STATUS[detail.status].tone} dot>
            {RECEPTION_STATUS[detail.status].label}
          </Badge>
        </div>
      </div>

      {/* Rendimiento del proveedor */}
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-slate-700">
            Rendimiento del proveedor — {detail.supplierName}
          </p>
          <Badge tone={perf.tone}>{perf.ratingLabel}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-slate-800">{perf.fillRate}%</p>
            <p className="text-[10.5px] text-slate-400">Despacho completo</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">
              {perf.compliance !== null ? `${perf.compliance}%` : "—"}
            </p>
            <p className="text-[10.5px] text-slate-400">Entrega a tiempo</p>
          </div>
          <div>
            <p className="text-lg font-bold text-rose-600">{perf.undeliveredSkus}</p>
            <p className="text-[10.5px] text-slate-400">SKUs sin despachar (hist.)</p>
          </div>
        </div>
        {perf.tone !== "green" && (
          <p className="text-[11px] text-amber-700 mt-2">
            ⚠ Este proveedor no cumple siempre: despachó el {perf.fillRate}% de lo pedido en{" "}
            {perf.arrivedOrders} recepciones. Considera proveedor alternativo para SKUs críticos.
          </p>
        )}
      </div>

      {detail.qualityNote && (
        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
          {detail.qualityNote}
        </p>
      )}

      <div>
        <p className="text-xs font-semibold text-slate-700 mb-2">
          Detalle por producto ({(detail.items ?? []).length})
        </p>
        {(detail.items ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">Esta recepción no tiene desglose por SKU.</p>
        ) : (
          <div className="space-y-2">
            {(detail.items ?? []).map((it) => {
              const st = lineStatus(it);
              const missing = it.expected - it.received;
              return (
                <div
                  key={it.sku}
                  className={`rounded-lg border px-3 py-2.5 ${missing > 0 ? "border-rose-200 bg-rose-50/40" : "border-slate-200"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={productPath(it.sku)}
                        className="text-sm font-medium text-slate-800 leading-snug hover:text-brand-700 hover:underline block"
                      >
                        {it.productName}
                      </Link>
                      <p className="text-xs text-slate-400 font-mono">{it.sku}</p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-slate-500">
                      Pedido <b className="text-slate-800">{formatNumber(it.expected)}</b>
                    </span>
                    <span className="text-slate-500">
                      Recibido <b className="text-slate-800">{formatNumber(it.received)}</b>
                    </span>
                    {missing > 0 && (
                      <span className="text-rose-600 font-semibold">
                        Faltan {formatNumber(missing)}
                      </span>
                    )}
                  </div>
                  {it.issue && <p className="text-xs text-rose-600 mt-1">⚠ {it.issue}</p>}
                  {missing > 0 &&
                    (() => {
                      const p = getProductBySku(it.sku);
                      if (!p || p.salesLast30Days <= 0) return null;
                      const cover = coverageDays(p.availableStock, p.salesLast30Days);
                      return (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Stock actual cubre ~{Math.max(0, Math.round(cover))} días (vende{" "}
                          {formatNumber(p.salesLast30Days)}/mes)
                          {cover <= Math.max(7, p.supplierLeadTimeDays) && (
                            <span className="text-rose-600 font-medium"> · riesgo de quiebre</span>
                          )}
                          .
                        </p>
                      );
                    })()}
                  {missing > 0 && (
                    <Button
                      size="sm"
                      className="mt-2"
                      variant={hasItem(it.sku) ? "secondary" : "primary"}
                      disabled={hasItem(it.sku)}
                      icon={<IconPlus className="w-3.5 h-3.5" />}
                      onClick={() => reorder(it.sku, it.productName, detail.supplierName, missing)}
                    >
                      {hasItem(it.sku)
                        ? "En borrador de OC"
                        : `Reordenar ${formatNumber(missing)} u.`}
                    </Button>
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
