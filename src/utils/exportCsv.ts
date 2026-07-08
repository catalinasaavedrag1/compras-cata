// ============================================================================
//  Exportación a CSV compatible con Excel en español.
//  Usa separador ";" (estándar Excel es-CL) y BOM UTF-8 para acentos.
// ============================================================================

export interface CsvColumn<T> {
  /** Encabezado de la columna en el archivo. */
  label: string;
  /** Valor de la celda para una fila. */
  value: (row: T) => string | number;
}

function escapeCell(value: string | number): string {
  const s = String(value ?? "");
  // Si contiene separador, comillas o salto de línea, se envuelve en comillas.
  if (/[";\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportToCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const header = columns.map((c) => escapeCell(c.label)).join(";");
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(";")).join("\n");
  const csv = `${header}\n${body}`;

  // BOM para que Excel detecte UTF-8 (acentos, ñ, $).
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
