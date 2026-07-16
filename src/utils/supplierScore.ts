import type { Supplier, SupplierClaim } from "../types/purchasing";
import { supplierFulfillment } from "./supplierPerf";

// ============================================================================
//  Evaluación de desempeño del proveedor (sección 19).
//  Combina despacho (OTIF), lead time prometido vs real y la tasa de reclamos
//  para clasificar al proveedor. Un buen precio no compensa pérdidas operativas.
// ============================================================================

export type SupplierClass =
  | "estrategico"
  | "confiable"
  | "en_desarrollo"
  | "riesgoso"
  | "critico"
  | "sustituible"
  | "bloqueado";

export const SUPPLIER_CLASS: Record<
  SupplierClass,
  { label: string; tone: "green" | "blue" | "violet" | "amber" | "red" | "neutral" }
> = {
  estrategico: { label: "Estratégico", tone: "violet" },
  confiable: { label: "Confiable", tone: "green" },
  en_desarrollo: { label: "En desarrollo", tone: "blue" },
  riesgoso: { label: "Riesgoso", tone: "amber" },
  critico: { label: "Crítico", tone: "red" },
  sustituible: { label: "Sustituible", tone: "neutral" },
  bloqueado: { label: "Bloqueado", tone: "neutral" },
};

export interface SupplierScore {
  otif: number; // % on-time in-full
  fillRate: number;
  compliance: number | null;
  leadPromised: number | null; // días comprometidos (maestro)
  leadReal: number; // días reales (promedio)
  leadGap: number; // real − prometido
  claimsOpen: number;
  claimsValue: number;
  classification: SupplierClass;
  reasons: string[];
}

export function supplierScore(supplier: Supplier, claims: SupplierClaim[]): SupplierScore {
  const perf = supplierFulfillment(supplier.name);
  const compliance = perf.compliance; // % a tiempo
  const fillRate = perf.fillRate;
  const otif = Math.round(((compliance ?? 100) / 100) * (fillRate / 100) * 100);

  const leadPromised = supplier.plazoEntregaDias ?? null;
  const leadReal = supplier.averageLeadTimeDays;
  const leadGap = leadPromised !== null ? leadReal - leadPromised : 0;

  const open = claims.filter((c) => c.estado !== "resuelto" && c.estado !== "rechazado");
  const claimsOpen = open.length;
  const claimsValue = open.reduce((a, c) => a + c.valorReclamado, 0);

  // Volumen y dependencia como señal de "estratégico".
  const highVolume = supplier.purchasedAmountLast90Days >= 60_000_000;

  const reasons: string[] = [];
  let classification: SupplierClass;

  if (supplier.status === "blocked") {
    classification = "bloqueado";
    reasons.push("Proveedor bloqueado en el maestro.");
  } else if (otif < 70 || (claimsOpen >= 2 && claimsValue > 800_000)) {
    classification = "critico";
    if (otif < 70) reasons.push(`OTIF bajo (${otif}%).`);
    if (claimsOpen >= 2) reasons.push(`${claimsOpen} reclamos abiertos por pérdidas operativas.`);
  } else if (otif < 85 || (leadGap >= 5) || claimsOpen >= 1) {
    classification = "riesgoso";
    if (otif < 85) reasons.push(`OTIF a mejorar (${otif}%).`);
    if (leadGap >= 5) reasons.push(`Entrega ${leadGap} días más lento que lo comprometido.`);
    if (claimsOpen >= 1) reasons.push("Tiene reclamos abiertos.");
  } else if (highVolume && otif >= 90) {
    classification = "estrategico";
    reasons.push("Alto volumen de compra y buen desempeño: cuidar la relación.");
  } else if (otif >= 92) {
    classification = "confiable";
    reasons.push("Cumple a tiempo y completo de forma consistente.");
  } else {
    classification = "en_desarrollo";
    reasons.push("Desempeño aceptable; volumen o historial aún en formación.");
  }

  return {
    otif,
    fillRate,
    compliance,
    leadPromised,
    leadReal,
    leadGap,
    claimsOpen,
    claimsValue,
    classification,
    reasons,
  };
}
