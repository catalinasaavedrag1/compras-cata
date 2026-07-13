import type { ReceptionItem } from "../../types/purchasing";

export function lineStatus(it: ReceptionItem): { label: string; tone: "green" | "amber" | "red" } {
  if (it.received >= it.expected) return { label: "Completo", tone: "green" };
  if (it.received === 0) return { label: "No despachado", tone: "red" };
  return { label: "Parcial", tone: "amber" };
}

