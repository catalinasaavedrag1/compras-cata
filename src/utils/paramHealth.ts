import type { Product, PurchaseRule } from "../types/purchasing";
import { DEFAULT_TARGET_COVERAGE_DAYS } from "./constants";

// ============================================================================
//  Diagnóstico de parámetros de reposición.
//  Detecta reglas mal configuradas COMPARÁNDOLAS con la realidad de los
//  productos del ámbito (lead time real, demanda, estacionalidad), no solo con
//  sus propios números. Un parámetro malo silencioso causa quiebres o
//  sobrestock por meses.
// ============================================================================

export type ParamIssueKind =
  | "lead_time" // lead time configurado << real
  | "moq_demand" // MOQ / múltiplo mayor que la demanda mensual
  | "seasonal_permanent" // estacionales bajo una regla de cobertura constante
  | "coverage_high" // cobertura objetivo demasiado alta
  | "safety_low"; // sin stock de seguridad con lead time largo

export interface ParamIssue {
  kind: ParamIssueKind;
  severity: "high" | "medium";
  title: string;
  detail: string;
  suggestion: string;
  /** Corrección aplicable directamente a la regla (si existe). */
  fix?: Partial<PurchaseRule>;
}

export function ruleParamIssues(rule: PurchaseRule, scopeProducts: Product[]): ParamIssue[] {
  const issues: ParamIssue[] = [];
  // Las reglas de canal gobiernan precio/margen, no parámetros de inventario:
  // no tiene sentido diagnosticar su lead time o stock de seguridad.
  if (rule.scopeType === "channel") return issues;
  const selling = scopeProducts.filter((p) => p.salesLast30Days > 0);
  const leadTimes = scopeProducts.map((p) => p.supplierLeadTimeDays).filter((n) => n > 0);
  const sortedLead = [...leadTimes].sort((a, b) => a - b);
  const realMax = sortedLead.length ? sortedLead[sortedLead.length - 1] : 0;
  // Referencia robusta a outliers (p90): la sugerencia cubre al 90% de los
  // proveedores del ámbito sin inflar el parámetro por un único caso extremo.
  const realP90 = sortedLead.length
    ? sortedLead[Math.min(sortedLead.length - 1, Math.floor(sortedLead.length * 0.9))]
    : 0;

  // 1 · Lead time configurado muy por debajo del real.
  if (rule.leadTimeDays > 0 && realP90 >= rule.leadTimeDays + 5 && realP90 >= rule.leadTimeDays * 1.3) {
    issues.push({
      kind: "lead_time",
      severity: "high",
      title: "Lead time subestimado",
      detail: `Configurado en ${rule.leadTimeDays} días, pero los proveedores del ámbito tardan hasta ${realMax} días. La reposición se emite tarde y llega con quiebre.`,
      suggestion: `Subir lead time a ${realP90} días (cubre al 90%)`,
      fix: { leadTimeDays: realP90 },
    });
  }

  // 2 · MOQ / múltiplo de compra mayor que la demanda mensual.
  const moqOffenders = selling.filter(
    (p) => (p.multiploCompra ?? 0) > Math.max(1, p.salesLast30Days)
  );
  if (moqOffenders.length > 0) {
    const ex = moqOffenders[0];
    issues.push({
      kind: "moq_demand",
      severity: "medium",
      title: "MOQ mayor que la demanda",
      detail: `${moqOffenders.length} producto(s) se compran en múltiplos mayores a su venta mensual (ej. ${ex.name}: múltiplo de ${ex.multiploCompra} y vende ~${Math.round(ex.salesLast30Days)}/mes). Fuerza sobrestock en cada compra.`,
      suggestion: "Negociar un MOQ menor o pasar a compra bajo pedido",
    });
  }

  // 3 · Productos estacionales bajo una regla de cobertura permanente.
  const seasonal = scopeProducts.filter((p) => p.productStatus === "seasonal");
  if (seasonal.length > 0) {
    issues.push({
      kind: "seasonal_permanent",
      severity: "medium",
      title: "Estacionales tratados como permanentes",
      detail: `${seasonal.length} producto(s) estacionales usan esta regla de cobertura constante (${rule.targetInventoryDays} días). Fuera de temporada acumulan stock; en el peak se quiebran.`,
      suggestion: "Planificarlos por temporada, no con cobertura fija",
    });
  }

  // 4 · Cobertura objetivo demasiado alta.
  if (rule.targetInventoryDays >= 60 && selling.length > 0) {
    issues.push({
      kind: "coverage_high",
      severity: "medium",
      title: "Cobertura objetivo alta",
      detail: `Objetivo de ${rule.targetInventoryDays} días para ${selling.length} SKU con venta: inmoviliza capital y arriesga sobrestock.`,
      suggestion: `Bajar la cobertura objetivo (p. ej. a ${DEFAULT_TARGET_COVERAGE_DAYS} días)`,
      fix: { targetInventoryDays: DEFAULT_TARGET_COVERAGE_DAYS },
    });
  }

  // 5 · Sin stock de seguridad con lead time largo.
  if (rule.minStock === 0 && selling.length > 0 && realMax >= 12) {
    issues.push({
      kind: "safety_low",
      severity: "medium",
      title: "Sin stock de seguridad",
      detail: `Stock mínimo en 0 con lead time de hasta ${realMax} días y ${selling.length} SKU con venta. Cualquier atraso del proveedor causa quiebre.`,
      suggestion: "Definir un stock de seguridad para el ámbito",
    });
  }

  return issues;
}
