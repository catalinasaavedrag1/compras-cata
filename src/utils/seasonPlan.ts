import type {
  SeasonPlanView,
  SeasonScenario,
  SeasonView,
} from "../services/purchaseBff";

// ============================================================================
//  Helpers puros sobre el contrato real de temporadas (F18).
//  ---------------------------------------------------------------------------
//  El plan por escenario del BFF es presupuesto por categoría en CLP
//  (plan.byCategory[catId].plannedClp + notes) y el seguimiento (tracking) son
//  montos CLP reales comprometidos en OC dentro de la ventana de compra
//  (totalCommittedClp / byCategory). Aquí no se inventa ningún número: solo se
//  combinan ambas vistas para la tabla plan vs comprometido del planner.
// ============================================================================

/** Vista del plan para un escenario, si la temporada la trae. */
export function planForScenario(
  season: SeasonView | null,
  scenario: SeasonScenario
): SeasonPlanView | null {
  return season?.plans.find((p) => p.scenario === scenario) ?? null;
}

/** ¿El escenario tiene contenido planificado (alguna categoría o notas)? */
export function hasPlanContent(view: SeasonPlanView | null): boolean {
  if (!view?.plan) return false;
  const byCategory = view.plan.byCategory ?? {};
  return Object.keys(byCategory).length > 0 || Boolean(view.plan.notes?.trim());
}

/** Total planificado del escenario (suma de plannedClp por categoría). */
export function planTotalClp(view: SeasonPlanView | null): number {
  const byCategory = view?.plan?.byCategory ?? {};
  return Object.values(byCategory).reduce((acc, c) => acc + (c.plannedClp ?? 0), 0);
}

/** Nº de categorías con presupuesto planificado en el escenario. */
export function plannedCategoryCount(view: SeasonPlanView | null): number {
  return Object.keys(view?.plan?.byCategory ?? {}).length;
}

/** Fila plan vs comprometido por categoría (unión de ambas fuentes). */
export interface PlanCategoryRow {
  categoryId: string;
  /** Presupuesto planificado (CLP); null si la categoría solo aparece en tracking. */
  plannedClp: number | null;
  /** Comprometido real en OC (CLP); null si aún no hay tracking para la categoría. */
  committedClp: number | null;
}

export function planCategoryRows(view: SeasonPlanView | null): PlanCategoryRow[] {
  const planned = view?.plan?.byCategory ?? {};
  const committed = view?.tracking?.byCategory ?? {};
  const ids = new Set([...Object.keys(planned), ...Object.keys(committed)]);
  return [...ids]
    .map((categoryId) => ({
      categoryId,
      plannedClp: planned[categoryId]?.plannedClp ?? null,
      committedClp: categoryId in committed ? committed[categoryId] : null,
    }))
    .sort((a, b) => (b.plannedClp ?? 0) - (a.plannedClp ?? 0));
}

/** % comprometido sobre el plan del escenario; null si no hay ambas fuentes. */
export function committedPct(view: SeasonPlanView | null): number | null {
  const total = planTotalClp(view);
  const committed = view?.tracking?.totalCommittedClp ?? null;
  if (committed === null || total <= 0) return null;
  return (committed / total) * 100;
}
