// ============================================================================
//  Clases Tailwind por "tono" semántico, compartidas por badges/píldoras y
//  puntos indicadores. Fuente única para evitar mapas duplicados por vista.
//  Tonos: red | amber | blue (= marca) | green | violet | neutral | slate.
// ============================================================================

/** Píldora/badge: fondo claro + texto. */
export const PILL_TONE: Record<string, string> = {
  red: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-brand-100 text-brand-700",
  green: "bg-emerald-100 text-emerald-700",
  violet: "bg-violet-100 text-violet-700",
  neutral: "bg-slate-100 text-slate-600",
  slate: "bg-slate-100 text-slate-600",
};

/** Punto/indicador: fondo sólido. */
export const DOT_TONE: Record<string, string> = {
  red: "bg-rose-500",
  amber: "bg-amber-500",
  blue: "bg-brand-500",
  green: "bg-emerald-500",
  violet: "bg-violet-500",
  neutral: "bg-slate-400",
  slate: "bg-slate-500",
};

/** Fondo/tono claro (bg-50) para chips e íconos de canal de campaña. */
export const CHANNEL_BG: Record<string, string> = {
  violet: "bg-violet-50 text-violet-700",
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-brand-50 text-brand-700",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-rose-50 text-rose-700",
  neutral: "bg-slate-100 text-slate-600",
};
