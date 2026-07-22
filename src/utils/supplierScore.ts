import type { SupplierFichaData } from "../services/purchaseBff";

// ============================================================================
//  Evaluación de desempeño del proveedor sobre la ficha real (F11).
//  Combina el cumplimiento observado (metrics.compliancePct), la evaluación
//  del período (evaluation.dimensions: calidad / factura / documentos /
//  estabilidad_precio, 0–100) y los reclamos abiertos (summary.claimsOpen)
//  para clasificar al proveedor. Nada se inventa: cada dimensión ausente
//  simplemente no aporta al score y la tarjeta la muestra como no disponible.
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

/** Etiquetas de las dimensiones que publica la evaluación del período. */
export const EVALUATION_DIMENSION_LABEL: Record<string, string> = {
  calidad: "Calidad",
  factura: "Exactitud de factura",
  documentos: "Exactitud documental",
  estabilidad_precio: "Estabilidad de precios",
};

export interface SupplierScoreDimension {
  key: string;
  label: string;
  /** 0–100 según la evaluación del período. */
  value: number;
}

export interface SupplierScore {
  /** Score ponderado 0–100; null cuando no hay ningún insumo real. */
  score: number | null;
  compliancePct: number | null;
  leadTimeDays: number | null;
  claimsOpen: number | null;
  /** Dimensiones reales de la evaluación del período (vacío si no hay). */
  dimensions: SupplierScoreDimension[];
  /** Período de la evaluación (null cuando no está publicada). */
  period: string | null;
  classification: SupplierClass;
  reasons: string[];
}

// Pesos: el cumplimiento observado manda; las dimensiones del período reparten
// el resto. Si falta un insumo, su peso se redistribuye (promedio ponderado
// solo sobre lo disponible).
const COMPLIANCE_WEIGHT = 0.4;
const DIMENSION_WEIGHT: Record<string, number> = {
  calidad: 0.2,
  factura: 0.15,
  documentos: 0.1,
  estabilidad_precio: 0.15,
};
/** Castigo por reclamo abierto (pérdidas operativas), acotado. */
const CLAIM_PENALTY = 4;
const CLAIM_PENALTY_MAX = 20;

/** Computa la evaluación de desempeño desde la ficha real del proveedor. */
export function supplierScoreFromFicha(data: SupplierFichaData): SupplierScore {
  const compliancePct = data.metrics.compliancePct;
  const leadTimeDays = data.metrics.leadTimeDaysObserved;
  const claimsOpen = data.summary.claimsOpen;

  const dimensions: SupplierScoreDimension[] = data.evaluation
    ? Object.entries(data.evaluation.dimensions)
        .filter(([, v]) => Number.isFinite(v))
        .map(([key, value]) => ({
          key,
          label: EVALUATION_DIMENSION_LABEL[key] ?? key,
          value: Math.max(0, Math.min(100, value)),
        }))
    : [];

  // Promedio ponderado sobre los insumos disponibles.
  let weighted = 0;
  let weightSum = 0;
  if (compliancePct !== null) {
    weighted += compliancePct * COMPLIANCE_WEIGHT;
    weightSum += COMPLIANCE_WEIGHT;
  }
  for (const d of dimensions) {
    const w = DIMENSION_WEIGHT[d.key] ?? 0.1;
    weighted += d.value * w;
    weightSum += w;
  }
  let score: number | null = null;
  if (weightSum > 0) {
    const base = weighted / weightSum;
    const penalty = Math.min(CLAIM_PENALTY_MAX, (claimsOpen ?? 0) * CLAIM_PENALTY);
    score = Math.round(Math.max(0, Math.min(100, base - penalty)));
  }

  const reasons: string[] = [];
  let classification: SupplierClass;
  const share = data.summary.purchased90Share;

  if (data.status === "blocked") {
    classification = "bloqueado";
    reasons.push("Proveedor bloqueado en el maestro.");
  } else if (compliancePct === null && dimensions.length === 0) {
    classification = "en_desarrollo";
    reasons.push("Sin métricas del período todavía; historial en formación.");
  } else if ((compliancePct !== null && compliancePct < 70) || (claimsOpen ?? 0) >= 2) {
    classification = "critico";
    if (compliancePct !== null && compliancePct < 70)
      reasons.push(`Cumplimiento bajo (${Math.round(compliancePct)}%).`);
    if ((claimsOpen ?? 0) >= 2)
      reasons.push(`${claimsOpen} reclamos abiertos por pérdidas operativas.`);
  } else if ((compliancePct !== null && compliancePct < 85) || (claimsOpen ?? 0) >= 1) {
    classification = "riesgoso";
    if (compliancePct !== null && compliancePct < 85)
      reasons.push(`Cumplimiento a mejorar (${Math.round(compliancePct)}%).`);
    if ((claimsOpen ?? 0) >= 1) reasons.push("Tiene reclamos abiertos.");
  } else if (share !== null && share > 0.3 && (compliancePct ?? 0) >= 90) {
    classification = "estrategico";
    reasons.push("Alta participación de compra y buen desempeño: cuidar la relación.");
  } else if ((compliancePct ?? 0) >= 92) {
    classification = "confiable";
    reasons.push("Cumple a tiempo de forma consistente.");
  } else {
    classification = "en_desarrollo";
    reasons.push("Desempeño aceptable; volumen o historial aún en formación.");
  }

  return {
    score,
    compliancePct,
    leadTimeDays,
    claimsOpen,
    dimensions,
    period: data.evaluation?.period ?? null,
    classification,
    reasons,
  };
}
