import { VALUE_TONE } from "../../utils/tone";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { IconCheck, IconPlus } from "../../components/ui/icons";
import type { ProductFichaData } from "../../services/purchaseBff";
import { formatCurrency, formatDays, formatNumber } from "../../utils/formatters";
import { productPriorityUi } from "./helpers";

// ============================================================================
//  Piezas de la ficha de producto (F11) sobre datos reales del BFF.
// ============================================================================

export function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass = tone ? VALUE_TONE[tone] : "text-slate-700";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`${strong ? "font-semibold" : ""} ${toneClass}`}>{value}</span>
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-800">{value}</p>
    </div>
  );
}

/**
 * Banner "Decisión recomendada" sobre la recomendación real del motor:
 * qué hacer y por qué, con la acción a un clic. Sin recomendación pendiente,
 * lo dice tal cual (no se inventa una decisión).
 */
export function DecisionBanner({
  data,
  added,
  onAdd,
}: {
  data: ProductFichaData;
  added: boolean;
  onAdd: () => void;
}) {
  const rec = data.recommendation;
  const cover =
    rec?.coverageDays ??
    (data.stock.available !== null && data.sales.dailyVelocity !== null && data.sales.dailyVelocity > 0
      ? Math.round(data.stock.available / data.sales.dailyVelocity)
      : null);

  // Caso 1: hay recomendación de compra pendiente del motor
  if (rec && rec.suggestedQty > 0) {
    const urgent = rec.priority === "stockout_imminent";
    const prio = productPriorityUi(rec.priority);
    return (
      <div
        className={`mb-5 rounded-xl border p-4 ${
          urgent ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Decisión recomendada
              </span>
              <Badge tone={prio.tone} dot>
                {prio.label}
              </Badge>
            </div>
            <p className="text-base font-semibold text-slate-900">
              Comprar {formatNumber(rec.suggestedQty)} unidades
              {data.supplier.name && <> a {data.supplier.name}</>}
              {data.cost.unitCostClp !== null && (
                <> · {formatCurrency(rec.suggestedQty * data.cost.unitCostClp)}</>
              )}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              {cover !== null && <>El stock disponible cubre {formatDays(cover)}. </>}
              {data.terms.leadTimeDays !== null && (
                <>El proveedor demora {formatDays(data.terms.leadTimeDays)} en entregar. </>
              )}
              {rec.reason}
            </p>
            {rec.risk && (
              <p className="text-sm text-rose-700 mt-0.5">
                <span className="font-medium">Riesgo si no compras: </span>
                {rec.risk}
              </p>
            )}
          </div>
          <Button
            onClick={onAdd}
            disabled={added}
            variant={added ? "secondary" : "primary"}
            icon={added ? <IconCheck className="w-4 h-4" /> : <IconPlus className="w-4 h-4" />}
          >
            {added ? "Agregado a OC" : "Agregar a OC"}
          </Button>
        </div>
      </div>
    );
  }

  // Caso 2: sin recomendación pendiente del motor
  return (
    <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Decisión recomendada
      </span>
      <p className="text-base font-semibold text-slate-900 mt-1">Sin acción por ahora</p>
      <p className="text-sm text-slate-600 mt-0.5">
        El motor de reposición no tiene una recomendación pendiente para este SKU
        {cover !== null && <> (cobertura estimada {formatDays(cover)})</>}.
      </p>
    </div>
  );
}
