import type { BadgeTone } from "../../components/ui/Badge";
import type { ConfidenceLevel, ScenarioKey, SeasonRisk } from "../../utils/seasonPlan";

export const CONFIDENCE_META: Record<ConfidenceLevel, { label: string; tone: BadgeTone }> = {
  alta: { label: "Confianza alta", tone: "green" },
  media: { label: "Confianza media", tone: "amber" },
  baja: { label: "Confianza baja", tone: "red" },
};

export const RISK_META: Record<SeasonRisk, { label: string; tone: BadgeTone }> = {
  alto_quiebre: { label: "Alto quiebre", tone: "red" },
  medio: { label: "Riesgo medio", tone: "amber" },
  sobrestock: { label: "Sobrestock", tone: "violet" },
  normal: { label: "Normal", tone: "green" },
};

export const SCENARIO_ORDER: ScenarioKey[] = ["conservador", "probable", "agresivo"];

