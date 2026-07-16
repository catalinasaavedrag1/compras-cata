// ============================================================================
//  Historial y auditoría de decisiones de compra (sección 17 del spec).
//  Cada decisión guarda el sugerido original vs lo comprado, el motivo del
//  cambio, quién compró/aprobó, el resultado posterior y el aprendizaje.
//  Datos mock (solo frontend) para mostrar cómo el equipo aprende de sus compras.
// ============================================================================

export type DecisionOutcome = "bueno" | "sobrestock" | "corto" | "pendiente";

export interface PurchaseDecision {
  id: string;
  date: string;
  sku: string;
  productName: string;
  supplierName: string;
  buyerName: string;
  approvedBy: string;
  suggestedQty: number;
  purchasedQty: number;
  unitCost: number;
  reason: string; // motivo del desvío vs sugerido
  resultDays: number; // a cuántos días se midió el resultado
  outcome: DecisionOutcome;
  resultText: string;
  learning: string;
  // Datos para evaluar la compra (sección 20): previsto vs real. Opcionales
  // porque una compra "en medición" aún no los tiene.
  demandForecast?: number; // venta proyectada en resultDays
  demandActual?: number; // venta real en resultDays
  remainingUnits?: number; // remanente al medir
  marginPlanned?: number; // margen % previsto
  marginActual?: number; // margen % real (tras descuentos/liquidación)
  onTime?: boolean; // el proveedor entregó a tiempo/completo
}

export const OUTCOME_META: Record<
  DecisionOutcome,
  { label: string; tone: "green" | "violet" | "red" | "neutral" }
> = {
  bueno: { label: "Compró bien", tone: "green" },
  sobrestock: { label: "Sobrecompró", tone: "violet" },
  corto: { label: "Compró corto", tone: "red" },
  pendiente: { label: "En medición", tone: "neutral" },
};

export const purchaseDecisions: PurchaseDecision[] = [
  {
    id: "DEC-001",
    date: "2026-03-12",
    sku: "JAR-002",
    productName: "Herbicida jardín concentrado 1 L",
    supplierName: "Agroinsumos Central",
    buyerName: "María González",
    approvedBy: "Catalina Saavedra",
    suggestedQty: 200,
    purchasedQty: 600,
    unitCost: 6490,
    reason: "Descuento por volumen del proveedor (−12%)",
    resultDays: 90,
    outcome: "sobrestock",
    resultText:
      "90 días después quedaron 380 u. sin vender; capital inmovilizado ~$2,5M al pasar la temporada de jardín.",
    learning:
      "Negociar el descuento sin obligar a comprar tan alto, o exigir devolución/campaña de liquidación post-temporada.",
    demandForecast: 210,
    demandActual: 220,
    remainingUnits: 380,
    marginPlanned: 32,
    marginActual: 24,
    onTime: true,
  },
  {
    id: "DEC-002",
    date: "2026-04-02",
    sku: "CON-001",
    productName: "Cemento Polpaico 25 kg",
    supplierName: "Proveedor Andes",
    buyerName: "Catalina Saavedra",
    approvedBy: "—",
    suggestedQty: 300,
    purchasedQty: 100,
    unitCost: 4290,
    reason: "Se priorizó caja del mes, se compró menos",
    resultDays: 8,
    outcome: "corto",
    resultText: "Quiebre 8 días después; venta perdida estimada ~$2,8M y reclamos de tienda.",
    learning:
      "En productos de alta rotación no recortar bajo el sugerido por caja: el costo del quiebre supera el ahorro.",
    demandForecast: 300,
    demandActual: 100,
    remainingUnits: 0,
    marginPlanned: 28,
    marginActual: 28,
    onTime: true,
  },
  {
    id: "DEC-003",
    date: "2026-05-15",
    sku: "HER-001",
    productName: "Taladro percutor Bosch 800W",
    supplierName: "Herramientas Global",
    buyerName: "Felipe Rojas",
    approvedBy: "Catalina Saavedra",
    suggestedQty: 40,
    purchasedQty: 45,
    unitCost: 42990,
    reason: "Ajuste por campaña Cyber herramientas",
    resultDays: 60,
    outcome: "bueno",
    resultText:
      "Cobertura saludable durante la campaña, sin quiebre y sin sobrestock; margen sostenido en 38%.",
    learning:
      "Comprar dentro del rango objetivo + pequeño colchón para campañas funciona bien con este proveedor.",
    demandForecast: 42,
    demandActual: 44,
    remainingUnits: 1,
    marginPlanned: 38,
    marginActual: 38,
    onTime: true,
  },
  {
    id: "DEC-004",
    date: "2026-05-28",
    sku: "GAS-001",
    productName: "Tubería PVC sanitaria 110 mm",
    supplierName: "FerrePro Chile",
    buyerName: "Juan Pérez",
    approvedBy: "—",
    suggestedQty: 240,
    purchasedQty: 240,
    unitCost: 5490,
    reason: "Sin desvío: se compró el sugerido",
    resultDays: 30,
    outcome: "corto",
    resultText:
      "Igual hubo quiebre: el proveedor despachó solo 180 de 240 (fill 75%). Causa: proveedor, no la decisión de compra.",
    learning:
      "El sugerido fue correcto; el problema fue el fill rate del proveedor. Exigir 95% o asegurar proveedor alternativo.",
    demandForecast: 200,
    demandActual: 180,
    remainingUnits: 0,
    marginPlanned: 30,
    marginActual: 30,
    onTime: false,
  },
  {
    id: "DEC-005",
    date: "2026-06-05",
    sku: "PIN-001",
    productName: "Pintura látex blanco 1 galón",
    supplierName: "Pinturas Nacionales",
    buyerName: "María González",
    approvedBy: "—",
    suggestedQty: 120,
    purchasedQty: 130,
    unitCost: 8990,
    reason: "Sin desvío relevante",
    resultDays: 30,
    outcome: "bueno",
    resultText: "Rotación dentro de lo esperado, cobertura ~45 días, sin quiebres.",
    learning: "Compra alineada al sugerido y a la regla de la categoría: resultado saludable.",
    demandForecast: 95,
    demandActual: 98,
    remainingUnits: 22,
    marginPlanned: 34,
    marginActual: 34,
    onTime: true,
  },
  {
    id: "DEC-006",
    date: "2026-06-18",
    sku: "JAR-003",
    productName: "Carretilla reforzada 90 litros",
    supplierName: "Industrial del Sur",
    buyerName: "María González",
    approvedBy: "Catalina Saavedra",
    suggestedQty: 40,
    purchasedQty: 80,
    unitCost: 28990,
    reason: "Pre-temporada de jardín + alza de costo anunciada",
    resultDays: 0,
    outcome: "pendiente",
    resultText:
      "Compra reciente, resultado en medición. Se justificó por temporada y alza de costo.",
    learning: "—",
  },
];
