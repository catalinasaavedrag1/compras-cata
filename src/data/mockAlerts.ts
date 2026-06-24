import type { CommercialAlert } from "../types/purchasing";

// ============================================================================
//  Alertas comerciales. Cada una explica el problema y la acción recomendada.
// ============================================================================

export const alerts: CommercialAlert[] = [
  {
    id: "ALR-001",
    type: "stockout",
    severity: "high",
    relatedEntity: "Tubería PVC sanitaria 110 mm",
    relatedSku: "GAS-001",
    description:
      "SKU GAS-001 tiene stock disponible 0 y venta promedio de 130 unidades/mes en las 3 ubicaciones.",
    recommendation:
      "Comprar 240 unidades al proveedor FerrePro Chile (lead time 12 días). Priorizar por venta perdida.",
    date: "2026-06-24",
    responsible: "Juan Pérez",
    status: "new",
  },
  {
    id: "ALR-002",
    type: "stockout",
    severity: "high",
    relatedEntity: "Cemento Polpaico 25 kg",
    relatedSku: "CON-001",
    description:
      "SKU CON-001 con stock disponible 6 y venta de 540/mes. Cobertura menor a 1 día.",
    recommendation:
      "Comprar 700 unidades a Proveedor Andes. Es el producto más vendido de Construcción.",
    date: "2026-06-24",
    responsible: "Catalina Saavedra",
    status: "new",
  },
  {
    id: "ALR-003",
    type: "stockout_risk",
    severity: "high",
    relatedEntity: "Cable eléctrico THHN 2.5 mm",
    relatedSku: "ELE-001",
    description:
      "SKU ELE-001 cubre solo 2,2 días de venta y el proveedor demora 6 días en entregar.",
    recommendation:
      "Generar OC por 96 unidades a Distribuidora Maule antes de 48 horas.",
    date: "2026-06-24",
    responsible: "Andrea Muñoz",
    status: "new",
  },
  {
    id: "ALR-004",
    type: "supplier_delay",
    severity: "high",
    relatedEntity: "Industrial del Sur",
    description:
      "Proveedor con cumplimiento de entrega de 62% y 2 órdenes atrasadas (OC-0141 y OC-0133, hasta 22 días).",
    recommendation:
      "Contactar al proveedor y evaluar compra alternativa para SKUs críticos de Herramientas eléctricas.",
    date: "2026-06-23",
    responsible: "Felipe Rojas",
    status: "in_review",
  },
  {
    id: "ALR-005",
    type: "overstock",
    severity: "medium",
    relatedEntity: "Guantes de seguridad anticorte",
    relatedSku: "SEG-001",
    description:
      "SKU SEG-001 tiene 416 días de inventario. Stock 305 contra venta de 22/mes.",
    recommendation:
      "No comprar. Evaluar promoción o redistribución. Capital inmovilizado: $511.190.",
    date: "2026-06-22",
    responsible: "Felipe Rojas",
    status: "new",
  },
  {
    id: "ALR-006",
    type: "dead_stock",
    severity: "medium",
    relatedEntity: "Herbicida jardín concentrado 1 L",
    relatedSku: "JAR-002",
    description:
      "SKU JAR-002 sin ventas en 30 días y solo 6 unidades en 90 días. Stock 58.",
    recommendation:
      "Stock muerto. Revisar con jefatura comercial si se descontinúa o se liquida.",
    date: "2026-06-21",
    responsible: "María González",
    status: "new",
  },
  {
    id: "ALR-007",
    type: "low_margin",
    severity: "medium",
    relatedEntity: "Esmalte sintético negro 1/4 galón",
    relatedSku: "PIN-002",
    description:
      "SKU PIN-002 con margen 21,9%, bajo el mínimo esperado de 25% para Pinturas.",
    recommendation:
      "Revisar costo con Pinturas Nacionales o ajustar precio de venta.",
    date: "2026-06-20",
    responsible: "María González",
    status: "in_review",
  },
  {
    id: "ALR-008",
    type: "no_supplier",
    severity: "high",
    relatedEntity: "Adhesivo montaje fuerte 300 ml",
    relatedSku: "CON-002",
    description:
      "SKU CON-002 no tiene proveedor asignado y mantiene venta activa (38/mes).",
    recommendation:
      "Asignar proveedor para poder generar reposición. Sin proveedor no se puede comprar.",
    date: "2026-06-20",
    responsible: "Catalina Saavedra",
    status: "new",
  },
  {
    id: "ALR-009",
    type: "outdated_cost",
    severity: "medium",
    relatedEntity: "Adhesivo montaje fuerte 300 ml",
    relatedSku: "CON-002",
    description:
      "El costo de CON-002 no se actualiza desde el 01/02/2026 (más de 4 meses).",
    recommendation:
      "Solicitar lista de precios vigente al proveedor antes de comprar.",
    date: "2026-06-19",
    responsible: "Catalina Saavedra",
    status: "new",
  },
  {
    id: "ALR-010",
    type: "po_delayed",
    severity: "high",
    relatedEntity: "OC-2026-0133 · Industrial del Sur",
    description:
      "Orden de compra con 22 días de atraso sobre la fecha esperada (02/06/2026).",
    recommendation:
      "Escalar con el proveedor. Productos comprometidos para Centro de Distribución.",
    date: "2026-06-24",
    responsible: "Felipe Rojas",
    status: "new",
  },
  {
    id: "ALR-011",
    type: "unexpected_demand",
    severity: "medium",
    relatedEntity: "Teflón gasfitería 12 mm",
    relatedSku: "GAS-004",
    description:
      "Venta de GAS-004 subió 28% sobre el promedio histórico. Cobertura cayó a 1,7 días.",
    recommendation:
      "Adelantar reposición de 155 unidades y revisar punto de reposición al alza.",
    date: "2026-06-23",
    responsible: "Juan Pérez",
    status: "new",
  },
  {
    id: "ALR-012",
    type: "high_suggested_purchase",
    severity: "low",
    relatedEntity: "Construcción",
    description:
      "La compra sugerida de Construcción supera $18.700.000 este mes por reposición de cemento y OSB.",
    recommendation:
      "Validar presupuesto de la categoría antes de confirmar las órdenes de compra.",
    date: "2026-06-22",
    responsible: "Catalina Saavedra",
    status: "in_review",
  },
  {
    id: "ALR-013",
    type: "no_sales",
    severity: "low",
    relatedEntity: "Malla raschel 80%",
    relatedSku: "JAR-001",
    description:
      "SKU JAR-001 (temporada) con solo 3 ventas en 30 días y 400 días de inventario.",
    recommendation:
      "Producto estacional fuera de temporada. No reponer hasta primavera.",
    date: "2026-06-18",
    responsible: "María González",
    status: "ignored",
  },
  {
    id: "ALR-014",
    type: "overstock",
    severity: "low",
    relatedEntity: "Ampolleta LED 12W luz fría",
    relatedSku: "ELE-002",
    description:
      "SKU ELE-002 con 84 días de inventario, sobre el máximo (420 unidades).",
    recommendation:
      "Pausar compra hasta normalizar stock. Buena venta pero exceso de inventario.",
    date: "2026-06-17",
    responsible: "Andrea Muñoz",
    status: "resolved",
  },
  {
    id: "ALR-015",
    type: "cost_increase",
    severity: "medium",
    relatedEntity: "Cable eléctrico THHN 2.5 mm",
    relatedSku: "ELE-001",
    description:
      "El costo de ELE-001 subió de $30.490 a $32.990 (+8,2%), reduciendo el margen a 26,7%.",
    recommendation:
      "Evaluar ajuste de precio de venta para proteger el margen objetivo.",
    date: "2026-06-15",
    responsible: "Andrea Muñoz",
    status: "in_review",
  },
];
