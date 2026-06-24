import { Badge, type BadgeTone } from "../ui/Badge";
import type { RecommendationStatus } from "../../types/purchasing";

// Etiqueta de "acción recomendada" en lenguaje de decisión de compra.
const config: Record<RecommendationStatus, { label: string; tone: BadgeTone }> = {
  critical: { label: "Comprar urgente", tone: "red" },
  buy_now: { label: "Comprar ahora", tone: "amber" },
  review: { label: "Revisar compra", tone: "blue" },
  normal: { label: "Sin acción", tone: "green" },
  overstock: { label: "No comprar", tone: "violet" },
};

export function RecommendationBadge({ status }: { status: RecommendationStatus }) {
  const cfg = config[status];
  return (
    <Badge tone={cfg.tone} dot>
      {cfg.label}
    </Badge>
  );
}
