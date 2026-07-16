import { Button } from "../ui/Button";
import { IconTruck, IconCheck, IconClock, IconPlus, IconInfo } from "../ui/icons";
import { cn } from "../../utils/cn";
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber } from "../../utils/formatters";
import type {
  ConsolidationCandidate,
  OrderBySignal,
  SupplierMinimumStatus,
} from "../../utils/orderConsolidation";

interface SupplierOrderCoachProps {
  supplierName: string;
  minimum: SupplierMinimumStatus | null;
  candidates: ConsolidationCandidate[];
  orderBy: OrderBySignal | null;
  onAdd: (candidate: ConsolidationCandidate) => void;
}

/**
 * Coach de compra por proveedor dentro del borrador de OC. Convierte datos en
 * decisiones: ¿alcanza el mínimo?, ¿qué conviene consolidar para no pagar otro
 * flete?, ¿hasta cuándo puedo emitir sin quebrar?
 */
export function SupplierOrderCoach({
  supplierName,
  minimum,
  candidates,
  orderBy,
  onAdd,
}: SupplierOrderCoachProps) {
  const showOrderBy =
    orderBy && orderBy.orderByDate && (orderBy.status === "overdue" || orderBy.status === "urgent" || orderBy.status === "soon");
  const showMinimum = !!minimum;
  const showCandidates = candidates.length > 0;

  // Si no hay nada que aportar, no ensuciamos la interfaz.
  if (!showOrderBy && !showMinimum && !showCandidates) return null;

  return (
    <div className="border-t border-slate-100 bg-slate-50/60">
      {/* Fecha límite de emisión */}
      {showOrderBy && (
        <div
          className={cn(
            "flex items-start gap-2 px-3 py-2 text-xs",
            orderBy!.status === "overdue"
              ? "text-rose-700"
              : orderBy!.status === "urgent"
                ? "text-amber-700"
                : "text-slate-600"
          )}
        >
          <IconClock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {orderBy!.status === "overdue" ? (
              <>
                <b>Emite hoy:</b> con el lead time del proveedor, esta reposición ya llegaría con
                quiebre.
              </>
            ) : (
              <>
                <b>Emitir antes del {formatDate(orderBy!.orderByDate!)}</b> para que llegue antes del
                quiebre (faltan {orderBy!.daysToOrderBy} d).
              </>
            )}
          </span>
        </div>
      )}

      {/* Mínimo de compra del proveedor */}
      {showMinimum && (
        <div className="px-3 py-2">
          {minimum!.meets ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <IconCheck className="h-3.5 w-3.5 flex-shrink-0" />
              Cumple el mínimo del proveedor ({formatCurrencyCompact(minimum!.target)})
            </p>
          ) : (
            <div>
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <IconInfo className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  Faltan <b>{formatCurrency(minimum!.shortfall)}</b> para el mínimo de{" "}
                  {supplierName} ({formatCurrencyCompact(minimum!.target)}). Consolida más ítems o el
                  proveedor puede rechazar la OC o cobrar flete.
                </span>
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${Math.round(minimum!.pct * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Consolidación: otros SKU del mismo proveedor por quebrar */}
      {showCandidates && (
        <div className="px-3 pb-2.5 pt-1">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <IconTruck className="h-3.5 w-3.5 text-brand-500" />
            Aprovecha el flete · otros de {supplierName} por quebrar
          </p>
          <div className="space-y-1">
            {candidates.map((c) => (
              <div
                key={c.sku}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-800">{c.productName}</p>
                  <p className="text-[11px] text-slate-500">
                    <span className={c.daysToStockout <= 0 ? "font-semibold text-rose-600" : "text-amber-600"}>
                      {c.reason}
                    </span>{" "}
                    · sugerido {formatNumber(c.suggestedQty)} u · {formatCurrencyCompact(c.lineValue)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onAdd(c)}
                  icon={<IconPlus className="h-3.5 w-3.5" />}
                >
                  Agregar
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
            Sumarlos a esta OC evita emitir otra orden (y otro flete) a {supplierName} en pocos días.
          </p>
        </div>
      )}
    </div>
  );
}
