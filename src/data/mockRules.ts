import type { PurchaseRule } from "../types/purchasing";

/** Presupuesto de compra del mes (referencia para la reposición). */
export const monthlyPurchaseBudget = 28000000;

export const purchaseRules: PurchaseRule[] = [
  { id: "RUL-00", scope: "Global (por defecto)", targetInventoryDays: 45, minStock: 0, maxStock: 0, minMargin: 25, leadTimeDays: 10, notes: "Regla base cuando la categoría no define una propia.", updatedAt: "2026-01-15", updatedBy: "Gerencia comercial" },
  { id: "RUL-01", scope: "Construcción", targetInventoryDays: 30, minStock: 200, maxStock: 800, minMargin: 22, leadTimeDays: 7, notes: "Alta rotación. Mantener cobertura ajustada para no inmovilizar capital.", updatedAt: "2026-06-10", updatedBy: "Catalina Saavedra" },
  { id: "RUL-02", scope: "Ferretería", targetInventoryDays: 45, minStock: 30, maxStock: 300, minMargin: 28, leadTimeDays: 12, notes: "Muchos SKUs de bajo costo. Tolerar algo de sobrestock por costo de quiebre bajo.", updatedAt: "2026-05-28", updatedBy: "Juan Pérez" },
  { id: "RUL-03", scope: "Herramientas eléctricas", targetInventoryDays: 40, minStock: 6, maxStock: 40, minMargin: 32, leadTimeDays: 16, notes: "Ticket alto. Cuidar capital inmovilizado y proveedores con lead time largo.", updatedAt: "2026-06-02", updatedBy: "Felipe Rojas" },
  { id: "RUL-04", scope: "Pinturas", targetInventoryDays: 50, minStock: 25, maxStock: 220, minMargin: 25, leadTimeDays: 9, notes: "Vida útil limitada en algunos productos. Evitar sobrestock.", updatedAt: "2026-04-18", updatedBy: "María González" },
  { id: "RUL-05", scope: "Electricidad", targetInventoryDays: 45, minStock: 30, maxStock: 420, minMargin: 30, leadTimeDays: 6, notes: "Lead time corto permite cobertura menor.", updatedAt: "2026-06-15", updatedBy: "Andrea Muñoz" },
  { id: "RUL-06", scope: "Gasfitería", targetInventoryDays: 35, minStock: 40, maxStock: 260, minMargin: 28, leadTimeDays: 12, notes: "Alta rotación con lead time medio. Vigilar quiebres.", updatedAt: "2026-05-30", updatedBy: "Juan Pérez" },
  { id: "RUL-07", scope: "Jardín", targetInventoryDays: 60, minStock: 8, maxStock: 80, minMargin: 30, leadTimeDays: 11, notes: "Estacional. Comprar fuerte solo en pre-temporada.", updatedAt: "2026-03-15", updatedBy: "María González" },
];

export interface SpecialRule {
  title: string;
  description: string;
}

export const specialRules: SpecialRule[] = [
  { title: "Productos nuevos", description: "Sin historial de venta: compra inicial conservadora basada en categoría similar. Revisar a las 4 semanas." },
  { title: "Productos de temporada", description: "Reposición concentrada en pre-temporada. Fuera de temporada se marca 'No comprar' aunque baje el stock." },
  { title: "Productos de baja venta", description: "Si la rotación es menor a 1 vez al año, no se sugiere compra y se evalúa descontinuar." },
  { title: "Sobrestock", description: "Si la cobertura supera el máximo de la categoría, la sugerencia se fija en 0 y se alerta capital inmovilizado." },
  { title: "Proveedores atrasados", description: "Si el cumplimiento del proveedor es menor a 70%, se prioriza buscar proveedor alternativo para SKUs críticos." },
];
