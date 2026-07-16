
import { VALUE_TONE } from "../../utils/tone";
import { RecommendationBadge } from "../../components/business/RecommendationBadge";
import { Button } from "../../components/ui/Button";
import { IconPlus } from "../../components/ui/icons";
import { coverageDays } from "../../utils/calculations";
import { IconCheck } from "../../components/ui/icons";
import type { Product, PurchaseRecommendation } from "../../types/purchasing";
import { formatCurrency, formatDays, formatNumber } from "../../utils/formatters";
import { buildNegotiationData } from "./negotiationData";
import {
  NegKpiRow,
  NegCostPriceRow,
  NegStockQualityRow,
  NegDemandRow,
  NegAltObjectivesRow,
} from "./negotiation";

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
 * Panel de negociación: reúne lo que el comprador necesita para llegar a la
 * reunión con argumentos — venta, margen, inventario, proveedor, alternativas,
 * objetivos sugeridos y la próxima decisión.
 */
export function NegotiationPanel({ product, rec }: { product: Product; rec?: PurchaseRecommendation }) {
  const data = buildNegotiationData(product, rec);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
        <b>Panel de negociación.</b> Todo lo que necesitas para llegar a la reunión con argumentos:
        cuánto vende, cuánto rinde, qué stock hay, qué tan confiable es el proveedor y qué
        alternativas tienes.
      </div>
      <NegKpiRow product={product} data={data} />
      <NegCostPriceRow product={product} data={data} />
      <NegStockQualityRow product={product} data={data} />
      <NegDemandRow product={product} data={data} />
      <NegAltObjectivesRow data={data} />
    </div>
  );
}

/**
 * Banner "Decisión recomendada": resume en una frase qué hacer y por qué,
 * con la acción a un clic. Es lo primero que debe ver el comprador.
 */
export function DecisionBanner({
  product,
  rec,
  added,
  onAdd,
}: {
  product: Product;
  rec?: PurchaseRecommendation;
  added: boolean;
  onAdd: () => void;
}) {
  const cover = coverageDays(product.availableStock, product.salesLast30Days);
  const lead = product.supplierLeadTimeDays;

  // Caso 1: hay recomendación de compra
  if (rec && rec.suggestedQuantity > 0) {
    const urgent = rec.status === "critical";
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
              <RecommendationBadge status={rec.status} />
            </div>
            <p className="text-base font-semibold text-slate-900">
              Comprar {formatNumber(rec.suggestedQuantity)} unidades a {rec.supplierName} ·{" "}
              {formatCurrency(rec.suggestedPurchaseAmount)}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              El stock disponible cubre {product.salesLast30Days > 0 ? formatDays(cover) : "—"} y el
              proveedor demora {formatDays(lead)} en entregar. {rec.reason}
            </p>
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

  // Caso 2: sobrestock — no comprar
  if (product.purchaseStatus === "overstock" || (rec && rec.status === "overstock")) {
    return (
      <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Decisión recomendada
        </span>
        <p className="text-base font-semibold text-slate-900 mt-1">No comprar — hay sobrestock</p>
        <p className="text-sm text-slate-600 mt-0.5">
          Hay {formatNumber(product.availableStock)} unidades disponibles para{" "}
          {formatNumber(product.inventoryDays)} días de venta. Conviene esperar y, si la rotación
          sigue baja, evaluar promoción o redistribución.
        </p>
      </div>
    );
  }

  // Caso 3: sin proveedor con venta activa
  if (!product.supplierName && product.salesLast30Days > 0) {
    return (
      <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Decisión recomendada
        </span>
        <p className="text-base font-semibold text-slate-900 mt-1">Asignar proveedor</p>
        <p className="text-sm text-slate-600 mt-0.5">
          Este producto vende {formatNumber(product.salesLast30Days)} unidades al mes pero no tiene
          proveedor asignado, por lo que no se puede generar reposición.
        </p>
      </div>
    );
  }

  // Caso 4: todo en orden
  return (
    <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Decisión recomendada
      </span>
      <p className="text-base font-semibold text-slate-900 mt-1">Sin acción por ahora</p>
      <p className="text-sm text-slate-600 mt-0.5">
        El stock disponible cubre la venta esperada{" "}
        {product.salesLast30Days > 0 && `(${formatDays(cover)} de cobertura)`}. No requiere compra.
      </p>
    </div>
  );
}
