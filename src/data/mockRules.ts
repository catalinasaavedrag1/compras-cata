import type { PurchaseRule } from "../types/purchasing";

/** Presupuesto de compra del mes (referencia para la reposición). */
export const monthlyPurchaseBudget = 28000000;

export const purchaseRules: PurchaseRule[] = [
  {
    id: "RUL-00",
    scope: "Global (por defecto)",
    scopeType: "global",
    targetInventoryDays: 45,
    minStock: 0,
    maxStock: 0,
    minMargin: 25,
    leadTimeDays: 10,
    notes: "Regla base cuando no aplica una más específica.",
    updatedAt: "2026-01-15",
    updatedBy: "Gerencia comercial",
  },
  {
    id: "RUL-01",
    scope: "Construcción",
    scopeType: "category",
    scopeValue: "Construcción",
    targetInventoryDays: 30,
    minStock: 200,
    maxStock: 800,
    minMargin: 22,
    leadTimeDays: 7,
    notes: "Alta rotación. Mantener cobertura ajustada para no inmovilizar capital.",
    updatedAt: "2026-06-10",
    updatedBy: "Catalina Saavedra",
  },
  {
    id: "RUL-02",
    scope: "Ferretería",
    scopeType: "category",
    scopeValue: "Ferretería",
    targetInventoryDays: 45,
    minStock: 30,
    maxStock: 300,
    minMargin: 28,
    leadTimeDays: 12,
    notes: "Muchos SKUs de bajo costo. Tolerar algo de sobrestock por costo de quiebre bajo.",
    updatedAt: "2026-05-28",
    updatedBy: "Juan Pérez",
  },
  {
    id: "RUL-03",
    scope: "Herramientas eléctricas",
    scopeType: "category",
    scopeValue: "Herramientas eléctricas",
    targetInventoryDays: 40,
    minStock: 6,
    maxStock: 40,
    minMargin: 32,
    leadTimeDays: 16,
    notes: "Ticket alto. Cuidar capital inmovilizado y proveedores con lead time largo.",
    updatedAt: "2026-06-02",
    updatedBy: "Felipe Rojas",
  },
  {
    id: "RUL-04",
    scope: "Pinturas",
    scopeType: "category",
    scopeValue: "Pinturas",
    targetInventoryDays: 50,
    minStock: 25,
    maxStock: 220,
    minMargin: 25,
    leadTimeDays: 9,
    notes: "Vida útil limitada en algunos productos. Evitar sobrestock.",
    updatedAt: "2026-04-18",
    updatedBy: "María González",
  },
  {
    id: "RUL-05",
    scope: "Electricidad",
    scopeType: "category",
    scopeValue: "Electricidad",
    targetInventoryDays: 45,
    minStock: 30,
    maxStock: 420,
    minMargin: 30,
    leadTimeDays: 6,
    notes: "Lead time corto permite cobertura menor.",
    updatedAt: "2026-06-15",
    updatedBy: "Andrea Muñoz",
  },
  {
    id: "RUL-06",
    scope: "Gasfitería",
    scopeType: "category",
    scopeValue: "Gasfitería",
    targetInventoryDays: 35,
    minStock: 40,
    maxStock: 260,
    minMargin: 28,
    leadTimeDays: 12,
    notes: "Alta rotación con lead time medio. Vigilar quiebres.",
    updatedAt: "2026-05-30",
    updatedBy: "Juan Pérez",
  },
  {
    id: "RUL-07",
    scope: "Jardín",
    scopeType: "category",
    scopeValue: "Jardín",
    targetInventoryDays: 60,
    minStock: 8,
    maxStock: 80,
    minMargin: 30,
    leadTimeDays: 11,
    notes: "Estacional. Comprar fuerte solo en pre-temporada.",
    updatedAt: "2026-03-15",
    updatedBy: "María González",
  },
  // Reglas por proveedor (precedencia sobre categoría)
  {
    id: "RUL-20",
    scope: "Industrial del Sur",
    scopeType: "supplier",
    scopeValue: "Industrial del Sur",
    targetInventoryDays: 50,
    minStock: 0,
    maxStock: 0,
    minMargin: 30,
    leadTimeDays: 18,
    notes: "Proveedor con lead time largo y bajo cumplimiento: comprar con más anticipación.",
    updatedAt: "2026-06-18",
    updatedBy: "Felipe Rojas",
  },
  {
    id: "RUL-21",
    scope: "FerrePro Chile",
    scopeType: "supplier",
    scopeValue: "FerrePro Chile",
    targetInventoryDays: 40,
    minStock: 0,
    maxStock: 0,
    minMargin: 28,
    leadTimeDays: 12,
    notes: "Cumplimiento 71%: mantener stock de seguridad mayor.",
    updatedAt: "2026-06-12",
    updatedBy: "Juan Pérez",
  },
  // Regla por marca
  {
    id: "RUL-30",
    scope: "Bosch",
    scopeType: "brand",
    scopeValue: "Bosch",
    targetInventoryDays: 45,
    minStock: 0,
    maxStock: 0,
    minMargin: 35,
    leadTimeDays: 15,
    notes: "Marca premium: proteger margen mínimo alto.",
    updatedAt: "2026-06-05",
    updatedBy: "Felipe Rojas",
  },
  // Reglas por canal de venta
  {
    id: "RUL-40",
    scope: "Marketplace",
    scopeType: "channel",
    scopeValue: "Marketplace",
    targetInventoryDays: 30,
    minStock: 0,
    maxStock: 0,
    minMargin: 30,
    leadTimeDays: 10,
    notes:
      "La comisión reduce el margen: exigir margen mínimo más alto antes de comprar para campaña.",
    updatedAt: "2026-06-20",
    updatedBy: "Andrea Muñoz",
  },
  {
    id: "RUL-41",
    scope: "Tienda física",
    scopeType: "channel",
    scopeValue: "Tienda física",
    targetInventoryDays: 35,
    minStock: 0,
    maxStock: 0,
    minMargin: 25,
    leadTimeDays: 10,
    notes: "Sin comisión: margen objetivo estándar.",
    updatedAt: "2026-06-20",
    updatedBy: "Andrea Muñoz",
  },
];

import type { Product } from "../types/purchasing";

/** Precedencia: proveedor > marca > categoría > global (la más específica gana). */
export function resolveRuleForProduct(p: Product, rules: PurchaseRule[]): PurchaseRule {
  return (
    rules.find((r) => r.scopeType === "supplier" && r.scopeValue === p.supplierName) ??
    rules.find((r) => r.scopeType === "brand" && r.scopeValue === p.brand) ??
    rules.find((r) => r.scopeType === "category" && r.scopeValue === p.category) ??
    rules.find((r) => r.scopeType === "global") ??
    rules[0]
  );
}

export interface SpecialRule {
  title: string;
  description: string;
}

export const specialRules: SpecialRule[] = [
  {
    title: "Productos nuevos",
    description:
      "Sin historial de venta: compra inicial conservadora basada en categoría similar. Revisar a las 4 semanas.",
  },
  {
    title: "Productos de temporada",
    description:
      "Reposición concentrada en pre-temporada. Fuera de temporada se marca 'No comprar' aunque baje el stock.",
  },
  {
    title: "Productos de baja venta",
    description:
      "Si la rotación es menor a 1 vez al año, no se sugiere compra y se evalúa descontinuar.",
  },
  {
    title: "Sobrestock",
    description:
      "Si la cobertura supera el máximo de la categoría, la sugerencia se fija en 0 y se alerta capital inmovilizado.",
  },
  {
    title: "Proveedores atrasados",
    description:
      "Si el cumplimiento del proveedor es menor a 70%, se prioriza buscar proveedor alternativo para SKUs críticos.",
  },
];
