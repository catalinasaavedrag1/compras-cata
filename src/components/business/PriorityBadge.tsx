import { Badge, type BadgeTone } from "../ui/Badge";
import type { AlertSeverity, Priority } from "../../types/purchasing";

// Prioridad y severidad comparten los mismos niveles (high/medium/low) y la
// misma presentación, así que ambos badges leen de una sola tabla.
const levelConfig: Record<Priority | AlertSeverity, { label: string; tone: BadgeTone }> = {
  high: { label: "Alta", tone: "red" },
  medium: { label: "Media", tone: "amber" },
  low: { label: "Baja", tone: "neutral" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = levelConfig[priority];
  return (
    <Badge tone={cfg.tone} dot>
      {cfg.label}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const cfg = levelConfig[severity];
  return (
    <Badge tone={cfg.tone} dot>
      {cfg.label}
    </Badge>
  );
}
