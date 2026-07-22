import type { BadgeTone } from "../../components/ui/Badge";

// ---------------------------------------------------------------------------
//  Helpers de la ficha de producto (F11), fuera de los componentes para no
//  romper el fast refresh.
// ---------------------------------------------------------------------------

/** Prioridad del motor → chip (misma semántica que la lista de reposición). */
const PRODUCT_PRIORITY_UI: Record<string, { label: string; tone: BadgeTone }> = {
  stockout_imminent: { label: "Quiebre inminente", tone: "red" },
  low_stock: { label: "Stock bajo", tone: "amber" },
  opportunity: { label: "Oportunidad", tone: "blue" },
};

/** Chip de prioridad, tolerante a valores nuevos del motor. */
export function productPriorityUi(priority: string): { label: string; tone: BadgeTone } {
  return PRODUCT_PRIORITY_UI[priority] ?? { label: priority, tone: "neutral" };
}
