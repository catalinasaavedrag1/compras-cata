import { Badge, type BadgeTone } from "../ui/Badge";
import type { AlertSeverity, Priority } from "../../types/purchasing";

const priorityConfig: Record<Priority, { label: string; tone: BadgeTone }> = {
  high: { label: "Alta", tone: "red" },
  medium: { label: "Media", tone: "amber" },
  low: { label: "Baja", tone: "neutral" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = priorityConfig[priority];
  return (
    <Badge tone={cfg.tone} dot>
      {cfg.label}
    </Badge>
  );
}

const severityConfig: Record<AlertSeverity, { label: string; tone: BadgeTone }> = {
  high: { label: "Alta", tone: "red" },
  medium: { label: "Media", tone: "amber" },
  low: { label: "Baja", tone: "neutral" },
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const cfg = severityConfig[severity];
  return (
    <Badge tone={cfg.tone} dot>
      {cfg.label}
    </Badge>
  );
}
