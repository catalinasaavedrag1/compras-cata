import type { OcDraftItem } from "../context/OcDraftContext";
import { lineNet } from "../context/OcDraftContext";
import type { BudgetBucketView } from "../services/purchaseBff";

// ============================================================================
//  Open-to-Buy (OTB) — presupuesto disponible para comprar (flujo 9)
//  ---------------------------------------------------------------------------
//  Combina los buckets reales del BFF (GET /budget: presupuesto y comprometido
//  del dominio, donde convert consume y cancel reintegra) con el borrador en
//  curso, que es local al cliente:
//    · comprometido = neto de entries del bucket (OC emitidas − reintegros),
//    · en borrador  = líneas del borrador real, mapeadas por su categoryId
//                     (snapshot de la propuesta; sin categoría no consumen),
//    · disponible   = presupuesto − comprometido − en borrador.
//  Así el borrador "consume" presupuesto en vivo y la app avisa antes de
//  emitir una OC que deja una categoría sobregirada.
// ============================================================================

export type BudgetStatus = "ok" | "ajustado" | "excedido";

export interface CategoryOtb {
  categoryId: string;
  /** Nombre para la UI (snapshot materializado; fallback = categoryId). */
  categoria: string;
  presupuesto: number;
  /** Neto consumido en el dominio (OC emitidas − reintegros). */
  comprometido: number;
  /** Lo que el borrador en curso sumaría a esta categoría. */
  enBorrador: number;
  /** Presupuesto − comprometido (antes de sumar el borrador actual). */
  disponibleAntesBorrador: number;
  /** Presupuesto − comprometido − en borrador (Open-to-Buy real). */
  disponible: number;
  /** % del presupuesto usado contando comprometido + borrador. */
  usadoPct: number;
  estado: BudgetStatus;
  version: number;
}

/** Suma, por categoryId, el neto de las líneas del borrador con categoría. */
function draftByCategory(draftItems: OcDraftItem[]): Map<string, number> {
  const acc = new Map<string, number>();
  for (const it of draftItems) {
    if (!it.categoryId) continue;
    acc.set(it.categoryId, (acc.get(it.categoryId) ?? 0) + lineNet(it));
  }
  return acc;
}

function deriveStatus(usadoPct: number): BudgetStatus {
  if (usadoPct > 100) return "excedido";
  if (usadoPct >= 85) return "ajustado";
  return "ok";
}

/**
 * Cruza los buckets reales del mes con el borrador en curso y deriva el
 * Open-to-Buy por categoría (semáforo incluido).
 */
export function computeOtb(
  buckets: BudgetBucketView[],
  draftItems: OcDraftItem[]
): CategoryOtb[] {
  const draftCat = draftByCategory(draftItems);

  return buckets.map((b) => {
    const enBorrador = draftCat.get(b.categoryId) ?? 0;
    const disponibleAntesBorrador = b.budgetClp - b.committedClp;
    const disponible = disponibleAntesBorrador - enBorrador;
    const usadoPct =
      b.budgetClp > 0 ? ((b.committedClp + enBorrador) / b.budgetClp) * 100 : 0;
    return {
      categoryId: b.categoryId,
      categoria: b.categoryName,
      presupuesto: b.budgetClp,
      comprometido: b.committedClp,
      enBorrador,
      disponibleAntesBorrador,
      disponible,
      usadoPct,
      estado: deriveStatus(usadoPct),
      version: b.version,
    };
  });
}

export interface DraftBudgetImpact {
  /** Categorías tocadas por el borrador, con su OTB. */
  categories: CategoryOtb[];
  /** OTB disponible (antes del borrador) sumado sobre esas categorías. */
  availableBefore: number;
  /** Monto que el borrador agrega a esas categorías. */
  draftAmount: number;
  /** Cuánto se pasa el borrador del presupuesto disponible (0 si cabe). */
  over: number;
  /** Categorías que quedarían excedidas al emitir este borrador. */
  overCategories: CategoryOtb[];
}

/**
 * Impacto del borrador actual sobre el presupuesto: cuánto OTB hay disponible
 * en las categorías que toca, cuánto consume y si deja alguna sobregirada.
 * Con buckets vacíos (presupuesto no configurado o BFF caído) el impacto es
 * neutro: sin categorías, sin sobregiro — la UI no inventa datos.
 */
export function draftBudgetImpact(
  buckets: BudgetBucketView[],
  draftItems: OcDraftItem[]
): DraftBudgetImpact {
  const otb = computeOtb(buckets, draftItems);
  const touched = new Set(
    draftItems.map((i) => i.categoryId).filter((c): c is string => !!c)
  );
  const categories = otb.filter((o) => touched.has(o.categoryId));
  const availableBefore = categories.reduce(
    (a, o) => a + Math.max(0, o.disponibleAntesBorrador),
    0
  );
  const draftAmount = categories.reduce((a, o) => a + o.enBorrador, 0);
  const overCategories = categories.filter((o) => o.disponible < 0);
  const over = overCategories.reduce((a, o) => a + Math.abs(o.disponible), 0);
  return { categories, availableBefore, draftAmount, over, overCategories };
}

/** Etiqueta legible de un mes "aaaa-mm" → "Junio 2026". */
const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function formatBudgetMonth(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return mes;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
