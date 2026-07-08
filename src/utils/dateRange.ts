// ============================================================================
//  Utilidades de rango de fechas para filtros y comparaciones.
//  Trabajamos con strings ISO "aaaa-mm-dd" (lo que usan los datos y la URL) y
//  convertimos a/desde Date en horario LOCAL para evitar corrimientos de día.
// ============================================================================
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subYears,
  subDays,
} from "date-fns";
import { TODAY_ISO } from "./constants";
import { formatDate } from "./formatters";

export interface IsoRange {
  from: string;
  to: string;
}

export const EMPTY_RANGE: IsoRange = { from: "", to: "" };

/** "2026-06-30" -> Date local (medianoche local), sin corrimiento por zona horaria. */
export function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** Date -> "aaaa-mm-dd" leyendo los componentes locales. */
export function dateToIso(date: Date | undefined | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "Hoy" de la plataforma = fecha mock fija (coherente con los datos de demo).
const TODAY = isoToDate(TODAY_ISO) ?? new Date();

export interface DatePreset {
  key: string;
  label: string;
  range: () => IsoRange;
}

/** Atajos de período. La semana empieza el lunes (weekStartsOn: 1). */
export const DATE_PRESETS: DatePreset[] = [
  { key: "today", label: "Hoy", range: () => ({ from: dateToIso(TODAY), to: dateToIso(TODAY) }) },
  {
    key: "7d",
    label: "Últimos 7 días",
    range: () => ({ from: dateToIso(subDays(TODAY, 6)), to: dateToIso(TODAY) }),
  },
  {
    key: "30d",
    label: "Últimos 30 días",
    range: () => ({ from: dateToIso(subDays(TODAY, 29)), to: dateToIso(TODAY) }),
  },
  {
    key: "thisWeek",
    label: "Esta semana",
    range: () => ({
      from: dateToIso(startOfWeek(TODAY, { weekStartsOn: 1 })),
      to: dateToIso(endOfWeek(TODAY, { weekStartsOn: 1 })),
    }),
  },
  {
    key: "thisMonth",
    label: "Este mes",
    range: () => ({ from: dateToIso(startOfMonth(TODAY)), to: dateToIso(endOfMonth(TODAY)) }),
  },
  {
    key: "lastMonth",
    label: "Mes pasado",
    range: () => {
      const d = subMonths(TODAY, 1);
      return { from: dateToIso(startOfMonth(d)), to: dateToIso(endOfMonth(d)) };
    },
  },
  {
    key: "thisYear",
    label: "Este año",
    range: () => ({ from: dateToIso(startOfYear(TODAY)), to: dateToIso(endOfYear(TODAY)) }),
  },
  {
    key: "lastYear",
    label: "Año pasado",
    range: () => {
      const d = subYears(TODAY, 1);
      return { from: dateToIso(startOfYear(d)), to: dateToIso(endOfYear(d)) };
    },
  },
];

/** ¿El rango actual coincide exactamente con algún atajo? Devuelve su key. */
export function activePresetKey(range: IsoRange): string | undefined {
  if (!range.from && !range.to) return undefined;
  return DATE_PRESETS.find((p) => {
    const r = p.range();
    return r.from === range.from && r.to === range.to;
  })?.key;
}

/** Texto legible del rango para el botón disparador. */
export function formatRangeLabel(range: IsoRange): string {
  const preset = activePresetKey(range);
  if (preset) return DATE_PRESETS.find((p) => p.key === preset)!.label;
  if (range.from && range.to) {
    if (range.from === range.to) return formatDate(range.from);
    return `${formatDate(range.from)} – ${formatDate(range.to)}`;
  }
  if (range.from) return `Desde ${formatDate(range.from)}`;
  if (range.to) return `Hasta ${formatDate(range.to)}`;
  return "";
}

/** ¿La fecha ISO de un registro cae dentro del rango (inclusive)? */
export function inRange(dateIso: string | undefined, range: IsoRange): boolean {
  if (!dateIso) return !range.from && !range.to;
  const d = dateIso.slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}
