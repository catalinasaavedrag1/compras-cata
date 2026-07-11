import { landedCost } from "../../utils/landedCost";
import { formatCurrency, formatDelta, formatPercent } from "../../utils/formatters";
import { Badge } from "../ui/Badge";
import { cn } from "../../utils/cn";
import type { Product } from "../../types/purchasing";

// ============================================================================
//  Desglose de costo puesto en bodega (landed cost)
//  Muestra cómo el flete + arancel + manejo elevan el costo de factura y qué le
//  hacen al margen real. Ayuda a decidir por costo total, no solo por precio.
// ============================================================================

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={cn("text-xs", muted ? "text-slate-400" : "text-slate-500")}>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "text-sm font-semibold text-slate-900" : "text-sm text-slate-700"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function LandedCostBreakdown({
  product,
  unitCost,
  className,
}: {
  product: Product;
  unitCost?: number;
  className?: string;
}) {
  const lc = landedCost(product, unitCost);
  const marginDrop = lc.nominalMargin - lc.landedMargin;

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Costo puesto en bodega
        </p>
        {lc.isImported && <Badge tone="violet">Importado</Badge>}
      </div>
      <div className="space-y-1">
        <Row label="Costo factura" value={formatCurrency(lc.productCost)} />
        <Row label="+ Flete" value={formatCurrency(lc.freight)} muted={lc.freight === 0} />
        <Row label="+ Arancel" value={formatCurrency(lc.duty)} muted={lc.duty === 0} />
        <Row label="+ Manejo" value={formatCurrency(lc.handling)} muted={lc.handling === 0} />
        <div className="mt-1 border-t border-slate-100 pt-1">
          <Row label="Costo puesto" value={formatCurrency(lc.landed)} strong />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1.5">
        <span className="text-xs text-slate-500">
          Sobrecosto logístico <b className="text-slate-700">+{formatPercent(lc.extraPct, 0)}</b>
        </span>
        <span className="text-xs text-slate-500">
          Margen{" "}
          <b className={lc.landedMargin < 0 ? "text-rose-600" : "text-slate-700"}>
            {formatPercent(lc.landedMargin, 0)}
          </b>{" "}
          <span className="text-slate-400">
            (nominal {formatPercent(lc.nominalMargin, 0)}, {formatDelta(-marginDrop, 0)})
          </span>
        </span>
      </div>
    </div>
  );
}
