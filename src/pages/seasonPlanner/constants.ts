import type { BadgeTone } from "../../components/ui/Badge";
import type { SeasonScenario, SeasonStatus } from "../../services/purchaseBff";

// ============================================================================
//  Metadatos de presentación de las temporadas reales (F18): escenarios del
//  plan (base/optimista/conservador) y ciclo de vida de la temporada.
// ============================================================================

export const SCENARIO_ORDER: SeasonScenario[] = ["base", "optimista", "conservador"];

export const SCENARIO_META: Record<SeasonScenario, { label: string; description: string }> = {
  base: {
    label: "Base",
    description: "Escenario de referencia: el presupuesto con el que se compra la temporada.",
  },
  optimista: {
    label: "Optimista",
    description: "Si la demanda supera lo esperado: más presupuesto por categoría.",
  },
  conservador: {
    label: "Conservador",
    description: "Si la demanda es prudente: compromete menos presupuesto.",
  },
};

export const SEASON_STATUS_META: Record<
  SeasonStatus,
  { label: string; tone: BadgeTone; description: string }
> = {
  planned: {
    label: "Planificada",
    tone: "slate",
    description: "La temporada está definida pero aún no se compra.",
  },
  buying: {
    label: "En compra",
    tone: "blue",
    description: "Ventana de compra activa: las OC alimentan el comprometido.",
  },
  selling: {
    label: "En venta",
    tone: "green",
    description: "Ventana de venta activa.",
  },
  closed: {
    label: "Cerrada",
    tone: "neutral",
    description: "Temporada terminada.",
  },
};
