// ============================================================================
//  Formateadores con formato chileno (CLP, fechas dd/mm/aaaa, % con coma)
// ============================================================================

/** Formatea un valor como moneda CLP: 1250000 -> "$1.250.000" */
export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

/** Formatea moneda de forma compacta para KPIs grandes: 87500000 -> "$87,5M" */
export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000)
    return `$${(value / 1_000_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}MM`;
  if (abs >= 1_000_000)
    return `$${(value / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000)
    return `$${(value / 1_000).toLocaleString("es-CL", { maximumFractionDigits: 0 })}K`;
  return formatCurrency(value);
}

/** Convierte una fecha ISO (aaaa-mm-dd) a formato chileno dd/mm/aaaa */
export function formatDate(value: string): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

/** Formatea un porcentaje: 32.5 -> "32,5%" */
export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toLocaleString("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Formatea un número con separador de miles chileno: 1250 -> "1.250" */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("es-CL", { maximumFractionDigits: 0 });
}

/** Formatea una variación con signo: 12.4 -> "+12,4%", -3 -> "-3,0%" */
export function formatDelta(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Días en texto legible: 5 -> "5 días" */
export function formatDays(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value === 1 ? "1 día" : `${formatNumber(value)} días`;
}
