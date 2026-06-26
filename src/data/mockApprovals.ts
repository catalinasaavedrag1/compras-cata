// ============================================================================
//  Aprobaciones de compra (sección 11 del spec).
//  Cuando una compra se sale de criterio (monto, cobertura, margen, proveedor,
//  desvío vs sugerido, fuera de temporada) requiere aprobación. El comprador
//  justifica el desvío y el líder aprueba o rechaza. Datos mock (frontend).
// ============================================================================

export type ApprovalCriterion =
  | "monto_alto"
  | "cobertura_excesiva"
  | "margen_bajo"
  | "desvio_sugerido"
  | "proveedor_revision"
  | "fuera_temporada"
  | "producto_nuevo";

export const CRITERION_LABEL: Record<ApprovalCriterion, string> = {
  monto_alto: "Monto sobre límite",
  cobertura_excesiva: "Cobertura excesiva",
  margen_bajo: "Margen bajo el mínimo",
  desvio_sugerido: "Muy distinta al sugerido",
  proveedor_revision: "Proveedor en revisión",
  fuera_temporada: "Compra fuera de temporada",
  producto_nuevo: "Producto nuevo",
};

// Motivos válidos para justificar un desvío
export const JUSTIFICATION_OPTIONS = [
  "Descuento por volumen",
  "Alza de costo anunciada",
  "Campaña futura",
  "Compra de importación",
  "Pedido especial de cliente",
  "Acuerdo con proveedor",
] as const;

export interface ApprovalRequest {
  id: string;
  date: string;
  sku: string;
  productName: string;
  supplierName: string;
  buyerName: string;
  suggestedQty: number;
  requestedQty: number;
  unitCost: number;
  amount: number;
  coberturaResultante: number; // días
  coberturaObjetivo: number; // días
  margin: number; // %
  minMargin: number; // %
  criteria: ApprovalCriterion[];
  justification: string; // motivo precargado del comprador
}

export const approvalRequests: ApprovalRequest[] = [
  {
    id: "APR-001",
    date: "2026-06-22",
    sku: "JAR-003",
    productName: "Cloro piscina 5 L",
    supplierName: "Distribuidora Maule",
    buyerName: "María González",
    suggestedQty: 300,
    requestedQty: 500,
    unitCost: 5200,
    amount: 2600000,
    coberturaResultante: 95,
    coberturaObjetivo: 60,
    margin: 31,
    minMargin: 30,
    criteria: ["desvio_sugerido", "cobertura_excesiva"],
    justification: "Pre-temporada de verano + alza de costo anunciada",
  },
  {
    id: "APR-002",
    date: "2026-06-23",
    sku: "HER-002",
    productName: "Sierra circular Makita 7 1/4",
    supplierName: "Industrial del Sur",
    buyerName: "Felipe Rojas",
    suggestedQty: 22,
    requestedQty: 22,
    unitCost: 58990,
    amount: 1297780,
    coberturaResultante: 50,
    coberturaObjetivo: 50,
    margin: 26,
    minMargin: 32,
    criteria: ["margen_bajo", "proveedor_revision"],
    justification: "Acuerdo con proveedor (rebate trimestral compensa el margen)",
  },
  {
    id: "APR-003",
    date: "2026-06-24",
    sku: "CON-001",
    productName: "Cemento Polpaico 25 kg",
    supplierName: "Proveedor Andes",
    buyerName: "Catalina Saavedra",
    suggestedQty: 700,
    requestedQty: 1800,
    unitCost: 4290,
    amount: 7722000,
    coberturaResultante: 100,
    coberturaObjetivo: 30,
    margin: 28,
    minMargin: 22,
    criteria: ["monto_alto", "desvio_sugerido", "cobertura_excesiva"],
    justification: "Descuento por volumen (−9%) e importación programada",
  },
  {
    id: "APR-004",
    date: "2026-06-25",
    sku: "JAR-002",
    productName: "Piscina estructural 3,6 m",
    supplierName: "Distribuidora Maule",
    buyerName: "María González",
    suggestedQty: 0,
    requestedQty: 120,
    unitCost: 89990,
    amount: 10798800,
    coberturaResultante: 0,
    coberturaObjetivo: 60,
    margin: 30,
    minMargin: 30,
    criteria: ["monto_alto", "fuera_temporada", "desvio_sugerido"],
    justification: "Pedido especial de cliente (proyecto inmobiliario)",
  },
];
