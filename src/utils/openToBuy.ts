import type { OcDraftItem } from "../context/OcDraftContext";
import { lineNet } from "../context/OcDraftContext";
import type { PurchaseOrder, PurchaseOrderStatus } from "../types/purchasing";
import { getProductBySku } from "../data/mockProducts";
import { getBudgetViews, type BudgetStatus } from "../data/mockBudgets";

// ============================================================================
//  Open-to-Buy (OTB) — presupuesto disponible para comprar
//  ---------------------------------------------------------------------------
//  Conecta el presupuesto por categoría con lo que realmente se está comprando:
//    · comprometido = base del mes + OC creadas en la sesión (on-order),
//    · en borrador  = lo que el comprador está armando ahora mismo,
//    · disponible   = presupuesto − comprometido − en borrador.
//  Así el borrador "consume" presupuesto en vivo y la app avisa antes de
//  emitir una OC que deja una categoría sobregirada. Todo se deriva de datos
//  que ya existen (presupuesto semilla + OC en localStorage + borrador).
// ============================================================================

/** Estados de OC que reservan caja (cuentan como comprometido / on-order). */
const COMMITTED_STATUSES: ReadonlySet<PurchaseOrderStatus> = new Set([
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "confirmed",
  "partially_received",
  "with_difference",
  "delayed",
]);

export interface CategoryOtb {
  categoria: string;
  presupuesto: number;
  /** OC comprometidas: base del mes + órdenes creadas en la sesión. */
  comprometido: number;
  /** Mercadería ya recepcionada (subconjunto de lo comprometido). */
  recibido: number;
  /** Lo que el borrador en curso sumaría a esta categoría. */
  enBorrador: number;
  /** Presupuesto − comprometido (antes de sumar el borrador actual). */
  disponibleAntesBorrador: number;
  /** Presupuesto − comprometido − en borrador (Open-to-Buy real). */
  disponible: number;
  /** % del presupuesto usado contando comprometido + borrador. */
  usadoPct: number;
  estado: BudgetStatus;
}

function categoryOfSku(sku: string): string | undefined {
  return getProductBySku(sku)?.category;
}

/** Suma, por categoría, el neto de las líneas del borrador. */
function draftByCategory(draftItems: OcDraftItem[]): Map<string, number> {
  const acc = new Map<string, number>();
  for (const it of draftItems) {
    const cat = categoryOfSku(it.sku);
    if (!cat) continue;
    acc.set(cat, (acc.get(cat) ?? 0) + lineNet(it));
  }
  return acc;
}

/** Suma, por categoría, las OC creadas en la sesión que reservan caja este mes. */
function createdByCategory(
  createdOrders: PurchaseOrder[],
  monthPrefix: string
): Map<string, number> {
  const acc = new Map<string, number>();
  for (const o of createdOrders) {
    if (!o.createdAt.startsWith(monthPrefix)) continue;
    if (!COMMITTED_STATUSES.has(o.status)) continue;
    for (const l of o.lines ?? []) {
      const cat = categoryOfSku(l.sku);
      if (!cat) continue;
      acc.set(cat, (acc.get(cat) ?? 0) + l.quantity * l.unitCost);
    }
  }
  return acc;
}

function deriveStatus(usadoPct: number): BudgetStatus {
  if (usadoPct > 100) return "excedido";
  if (usadoPct >= 85) return "ajustado";
  return "ok";
}

/**
 * Calcula el Open-to-Buy por categoría para un mes, sumando las OC creadas en
 * la sesión y el borrador en curso al presupuesto base.
 */
export function computeOtb(
  month: string,
  draftItems: OcDraftItem[],
  createdOrders: PurchaseOrder[]
): CategoryOtb[] {
  const base = getBudgetViews(month);
  const draftCat = draftByCategory(draftItems);
  const createdCat = createdByCategory(createdOrders, month);

  return base.map((b) => {
    const comprometido = b.comprometido + (createdCat.get(b.categoria) ?? 0);
    const enBorrador = draftCat.get(b.categoria) ?? 0;
    const disponibleAntesBorrador = b.presupuesto - comprometido;
    const disponible = disponibleAntesBorrador - enBorrador;
    const usadoPct = b.presupuesto > 0 ? ((comprometido + enBorrador) / b.presupuesto) * 100 : 0;
    return {
      categoria: b.categoria,
      presupuesto: b.presupuesto,
      comprometido,
      recibido: b.recibido,
      enBorrador,
      disponibleAntesBorrador,
      disponible,
      usadoPct,
      estado: deriveStatus(usadoPct),
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
 */
export function draftBudgetImpact(
  month: string,
  draftItems: OcDraftItem[],
  createdOrders: PurchaseOrder[]
): DraftBudgetImpact {
  const otb = computeOtb(month, draftItems, createdOrders);
  const touched = new Set(
    draftItems.map((i) => categoryOfSku(i.sku)).filter((c): c is string => !!c)
  );
  const categories = otb.filter((o) => touched.has(o.categoria));
  const availableBefore = categories.reduce(
    (a, o) => a + Math.max(0, o.disponibleAntesBorrador),
    0
  );
  const draftAmount = categories.reduce((a, o) => a + o.enBorrador, 0);
  const overCategories = categories.filter((o) => o.disponible < 0);
  const over = overCategories.reduce((a, o) => a + Math.abs(o.disponible), 0);
  return { categories, availableBefore, draftAmount, over, overCategories };
}
