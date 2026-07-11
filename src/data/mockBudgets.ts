// ============================================================================
//  Presupuesto por categoría (mock determinista)
//  Modela el presupuesto mensual de compra por categoría y su consumo:
//   - comprometido = OC aprobadas (caja ya comprometida aunque no haya llegado)
//   - recibido      = mercadería ya recepcionada (subconjunto de lo comprometido)
//  Se derivan disponible, proyección de cierre y estado del semáforo.
//  Las categorías se importan de mockCategories para mantener un único origen.
// ============================================================================
import { categories } from "./mockCategories";

export type BudgetStatus = "ok" | "ajustado" | "excedido";

export interface CategoryBudget {
  categoria: string;
  /** Mes del presupuesto en formato "aaaa-mm" (ej. "2026-06"). */
  mes: string;
  /** Presupuesto de compra asignado a la categoría para el mes (CLP). */
  presupuesto: number;
  /** OC aprobadas: caja comprometida (CLP), haya llegado o no la mercadería. */
  ocAprobadas: number;
  /** OC recibidas: mercadería ya recepcionada (CLP). Subconjunto de lo comprometido. */
  ocRecibidas: number;
}

/** Vista enriquecida con los valores derivados que consume la página. */
export interface CategoryBudgetView extends CategoryBudget {
  /** Lo comprometido (alias legible de ocAprobadas). */
  comprometido: number;
  /** Lo recibido (alias legible de ocRecibidas). */
  recibido: number;
  /** Saldo aún disponible = presupuesto - comprometido. Puede ser negativo. */
  disponible: number;
  /** % del presupuesto ya comprometido. */
  usadoPct: number;
  /**
   * Proyección de cierre de mes: extrapola el gasto comprometido al ritmo del
   * mes transcurrido. Permite anticipar si la categoría terminará excedida.
   */
  proyeccionCierre: number;
  estado: BudgetStatus;
}

/** Meses disponibles en el mock (más reciente primero). */
export const BUDGET_MONTHS = ["2026-06", "2026-05"] as const;

/** Mes por defecto al abrir la página. */
export const DEFAULT_BUDGET_MONTH = BUDGET_MONTHS[0];

/** Etiqueta legible de un mes "aaaa-mm" -> "Junio 2026". */
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

/**
 * Fracción del mes transcurrida (determinista, sin Date.now): asumimos el día
 * 24 sobre 30 para junio (mes en curso) y mes completo para meses cerrados.
 */
const MONTH_PROGRESS: Record<string, number> = {
  "2026-06": 24 / 30,
  "2026-05": 1,
};

// --- Semilla determinista por categoría -----------------------------------
// Cada categoría tiene un presupuesto base y un "perfil" de ejecución estable.
// Sin Math.random ni Date.now: todo deriva de índices y valores fijos.
interface BudgetSeed {
  /** Presupuesto base del mes corriente (CLP). */
  presupuesto: number;
  /** Proporción del presupuesto comprometida (OC aprobadas). */
  committedRatio: number;
  /** Proporción de lo comprometido que ya fue recibido. */
  receivedRatio: number;
}

// Presupuestos ligados al tamaño de cada categoría (compra sugerida + holgura).
// Nota: los committedRatio se mantienen por debajo de 1 en las categorías del
// comprador por defecto (Construcción, Maderas) para que el estado base sea
// sano y el rojo de "sobre OTB" aparezca solo cuando el borrador realmente
// sobregira. Se deja una categoría por sobre 1 (Agrícola) para seguir
// demostrando el semáforo "excedido" sin castigar la vista inicial.
const SEEDS: Record<string, BudgetSeed> = {
  Construcción: { presupuesto: 22000000, committedRatio: 0.74, receivedRatio: 0.62 },
  Ferretería: { presupuesto: 12000000, committedRatio: 0.78, receivedRatio: 0.71 },
  "Herramientas eléctricas": { presupuesto: 24000000, committedRatio: 0.91, receivedRatio: 0.58 },
  Pinturas: { presupuesto: 5000000, committedRatio: 0.62, receivedRatio: 0.8 },
  Electricidad: { presupuesto: 8500000, committedRatio: 0.83, receivedRatio: 0.66 },
  Gasfitería: { presupuesto: 13000000, committedRatio: 0.96, receivedRatio: 0.74 },
  Jardín: { presupuesto: 2200000, committedRatio: 0.41, receivedRatio: 0.9 },
  Agrícola: { presupuesto: 7000000, committedRatio: 1.08, receivedRatio: 0.63 },
  Maderas: { presupuesto: 11000000, committedRatio: 0.8, receivedRatio: 0.55 },
  "Seguridad industrial": { presupuesto: 1800000, committedRatio: 0.34, receivedRatio: 0.95 },
};

// Ajuste por mes: el mes cerrado (mayo) tuvo presupuestos algo menores y, al
// estar cerrado, una ejecución más completa.
const MONTH_FACTOR: Record<string, { budget: number; committed: number; received: number }> = {
  "2026-06": { budget: 1, committed: 1, received: 1 },
  "2026-05": { budget: 0.94, committed: 0.97, received: 1.18 },
};

/** Redondea a la centena de mil más cercana para CLP "limpios". */
function roundClp(value: number): number {
  return Math.round(value / 100000) * 100000;
}

function buildBudget(categoria: string, mes: string): CategoryBudget {
  const seed = SEEDS[categoria];
  const mf = MONTH_FACTOR[mes] ?? MONTH_FACTOR["2026-06"];
  const presupuesto = roundClp(seed.presupuesto * mf.budget);
  const ocAprobadas = roundClp(presupuesto * seed.committedRatio * mf.committed);
  // Lo recibido nunca supera lo comprometido.
  const ocRecibidas = roundClp(
    Math.min(ocAprobadas, ocAprobadas * seed.receivedRatio * mf.received)
  );
  return { categoria, mes, presupuesto, ocAprobadas, ocRecibidas };
}

/** Datos base: todas las categorías reales × todos los meses sembrados. */
export const categoryBudgets: CategoryBudget[] = BUDGET_MONTHS.flatMap((mes) =>
  categories.map((c) => buildBudget(c.name, mes))
);

/** Deriva el estado del semáforo según el % comprometido y la proyección. */
function deriveStatus(usadoPct: number, proyeccionPct: number): BudgetStatus {
  if (usadoPct > 100 || proyeccionPct > 105) return "excedido";
  if (usadoPct >= 85 || proyeccionPct >= 95) return "ajustado";
  return "ok";
}

/** Convierte un CategoryBudget en su vista con valores derivados. */
export function toBudgetView(b: CategoryBudget): CategoryBudgetView {
  const comprometido = b.ocAprobadas;
  const recibido = b.ocRecibidas;
  const disponible = b.presupuesto - comprometido;
  const usadoPct = b.presupuesto > 0 ? (comprometido / b.presupuesto) * 100 : 0;
  const progress = MONTH_PROGRESS[b.mes] ?? 1;
  const proyeccionCierre = roundClp(progress > 0 ? comprometido / progress : comprometido);
  const proyeccionPct = b.presupuesto > 0 ? (proyeccionCierre / b.presupuesto) * 100 : 0;
  return {
    ...b,
    comprometido,
    recibido,
    disponible,
    usadoPct,
    proyeccionCierre,
    estado: deriveStatus(usadoPct, proyeccionPct),
  };
}

/** Vistas derivadas de un mes concreto, ordenadas por presupuesto desc. */
export function getBudgetViews(mes: string): CategoryBudgetView[] {
  return categoryBudgets
    .filter((b) => b.mes === mes)
    .map(toBudgetView)
    .sort((a, b) => b.presupuesto - a.presupuesto);
}
