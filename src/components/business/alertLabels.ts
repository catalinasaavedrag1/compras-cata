import type { AlertType } from "../../types/purchasing";

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  stockout: "Quiebre de stock",
  stockout_risk: "Riesgo de quiebre",
  overstock: "Sobrestock",
  low_margin: "Margen bajo",
  cost_increase: "Costo aumentado",
  supplier_delay: "Proveedor atrasado",
  no_sales: "Producto sin venta",
  unexpected_demand: "Alta demanda inesperada",
  no_supplier: "Producto sin proveedor",
  po_delayed: "OC atrasada",
  high_suggested_purchase: "Compra sugerida alta",
  dead_stock: "Stock muerto",
  outdated_cost: "Costo sin actualizar",
  no_recent_purchase: "Sin compra reciente",
  season_approaching: "Temporada próxima",
  lost_opportunity: "Oportunidad no capturada",
};
