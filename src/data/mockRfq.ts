// ============================================================================
//  Cotizaciones / RFQ (Request for Quotation) — datos mock y tipos locales.
//
//  Flujo: el comprador crea una solicitud de cotización (RFQ) con una lista de
//  productos y los proveedores invitados. Cada proveedor responde por línea
//  (costo unitario, plazo de entrega, mínimo de compra, disponibilidad). El
//  comprador compara y convierte al ganador en un borrador de OC.
//
//  Datos deterministas (sin Math.random/Date.now) para que la demo sea estable.
// ============================================================================

/** Estados del ciclo de vida de una cotización. */
export type RfqStatus =
  | "borrador"
  | "enviada"
  | "respondida_parcial"
  | "respondida"
  | "en_negociacion"
  | "aprobada"
  | "rechazada"
  | "vencida"
  | "convertida";

/** Una línea (producto) solicitado dentro de la cotización. */
export interface RfqLine {
  sku: string;
  productName: string;
  qtyRequested: number;
}

/** Respuesta de un proveedor a una línea de la cotización. */
export interface RfqResponse {
  /** Nombre del proveedor (coincide con los nombres de mockSuppliers). */
  supplierName: string;
  /** SKU de la línea a la que corresponde la respuesta. */
  sku: string;
  /** Costo unitario ofertado (CLP). */
  costoUnitario: number;
  /** Plazo de entrega ofertado, en días. */
  plazoDias: number;
  /** Mínimo de compra exigido por el proveedor (unidades). */
  minimoCompra: number;
  /** Si el proveedor tiene disponibilidad para esa línea. */
  disponible: boolean;
  /** Observación libre del proveedor (opcional). */
  observacion?: string;
}

/** Cotización / RFQ completa. */
export interface Rfq {
  id: string;
  numero: string;
  /** Fecha de creación (ISO aaaa-mm-dd). */
  fecha: string;
  /** Fecha límite para recibir respuestas (ISO aaaa-mm-dd). */
  fechaVencimiento: string;
  /** Comprador que solicita. */
  comprador: string;
  estado: RfqStatus;
  /** Productos solicitados. */
  lines: RfqLine[];
  /** Proveedores invitados (nombres de mockSuppliers). */
  suppliers: string[];
  /** Respuestas recibidas (proveedor × línea). */
  responses: RfqResponse[];
}

// ----------------------------------------------------------------------------
//  Etiquetas y tono (color de badge) por estado, para la UI.
// ----------------------------------------------------------------------------

export const RFQ_STATUS_LABELS: Record<RfqStatus, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  respondida_parcial: "Respuesta parcial",
  respondida: "Respondida",
  en_negociacion: "En negociación",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  vencida: "Vencida",
  convertida: "Convertida a OC",
};

export const RFQ_STATUS_TONE: Record<
  RfqStatus,
  "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate"
> = {
  borrador: "slate",
  enviada: "blue",
  respondida_parcial: "amber",
  respondida: "blue",
  en_negociacion: "violet",
  aprobada: "green",
  rechazada: "red",
  vencida: "red",
  convertida: "green",
};

// ----------------------------------------------------------------------------
//  Helpers de comparación.
// ----------------------------------------------------------------------------

/** Resultado de elegir la mejor respuesta de una línea. */
export interface BestPick {
  /** Respuesta más barata disponible (o null si nadie cotizó disponible). */
  cheapest: RfqResponse | null;
  /** Respuesta más rápida disponible (menor plazo). */
  fastest: RfqResponse | null;
  /**
   * Aviso cuando el más barato NO es necesariamente la mejor opción porque su
   * plazo es bastante mayor que el del proveedor más rápido. null si no aplica.
   */
  tradeoffNote: string | null;
}

/**
 * Elige la mejor respuesta por línea (la más barata disponible) y advierte
 * cuando "lo más barato" no es lo mejor: si existe un proveedor más rápido
 * cuyo plazo es mucho menor, aunque cueste algo más, conviene evaluarlo.
 */
export function pickBestForLine(responses: RfqResponse[]): BestPick {
  const available = responses.filter((r) => r.disponible);
  if (available.length === 0) {
    return { cheapest: null, fastest: null, tradeoffNote: null };
  }

  const cheapest = available.reduce((best, r) => (r.costoUnitario < best.costoUnitario ? r : best));
  const fastest = available.reduce((best, r) => (r.plazoDias < best.plazoDias ? r : best));

  let tradeoffNote: string | null = null;
  if (fastest.supplierName !== cheapest.supplierName) {
    const plazoGap = cheapest.plazoDias - fastest.plazoDias;
    const extraCostPct =
      cheapest.costoUnitario > 0
        ? ((fastest.costoUnitario - cheapest.costoUnitario) / cheapest.costoUnitario) * 100
        : 0;
    // El más rápido demora bastante menos y cuesta solo un poco más.
    if (plazoGap >= 5 && extraCostPct > 0 && extraCostPct <= 8) {
      tradeoffNote = `${fastest.supplierName} entrega ${plazoGap} días antes por solo +${extraCostPct.toFixed(0)}% de costo. Lo más barato no siempre es lo mejor.`;
    }
  }

  return { cheapest, fastest, tradeoffNote };
}

/** Cantidad de respuestas únicas (proveedores) recibidas para una RFQ. */
export function respondedSupplierCount(rfq: Rfq): number {
  return new Set(rfq.responses.map((r) => r.supplierName)).size;
}

// ----------------------------------------------------------------------------
//  Semillas de cotizaciones (deterministas).
// ----------------------------------------------------------------------------

const BUYER = "Catalina Saavedra";

export const rfqs: Rfq[] = [
  // 1) Respondida completa — listo para comparar/convertir. Construcción.
  {
    id: "RFQ-2026-0001",
    numero: "COT-2026-0001",
    fecha: "2026-06-10",
    fechaVencimiento: "2026-06-17",
    comprador: BUYER,
    estado: "respondida",
    lines: [
      { sku: "CON-001", productName: "Cemento Polpaico 25 kg", qtyRequested: 400 },
      { sku: "CON-003", productName: "Fierro estriado 8 mm x 6 m", qtyRequested: 300 },
      { sku: "MAD-001", productName: "Plancha OSB 9,5 mm 1,22x2,44 m", qtyRequested: 80 },
    ],
    suppliers: ["Proveedor Andes", "Materiales del Pacífico"],
    responses: [
      // Andes: caro pero rápido (lead 7).
      {
        supplierName: "Proveedor Andes",
        sku: "CON-001",
        costoUnitario: 4290,
        plazoDias: 7,
        minimoCompra: 200,
        disponible: true,
      },
      {
        supplierName: "Proveedor Andes",
        sku: "CON-003",
        costoUnitario: 4190,
        plazoDias: 7,
        minimoCompra: 150,
        disponible: true,
      },
      {
        supplierName: "Proveedor Andes",
        sku: "MAD-001",
        costoUnitario: 12490,
        plazoDias: 7,
        minimoCompra: 40,
        disponible: true,
        observacion: "Stock asegurado en CD",
      },
      // Pacífico: más barato en cemento pero plazo largo (lead 22) — clásico trade-off.
      {
        supplierName: "Materiales del Pacífico",
        sku: "CON-001",
        costoUnitario: 4090,
        plazoDias: 22,
        minimoCompra: 500,
        disponible: true,
        observacion: "Precio por volumen ≥ 500",
      },
      {
        supplierName: "Materiales del Pacífico",
        sku: "CON-003",
        costoUnitario: 4090,
        plazoDias: 22,
        minimoCompra: 200,
        disponible: true,
      },
      {
        supplierName: "Materiales del Pacífico",
        sku: "MAD-001",
        costoUnitario: 12200,
        plazoDias: 22,
        minimoCompra: 60,
        disponible: false,
        observacion: "Sin stock por ahora",
      },
    ],
  },

  // 2) En negociación — herramientas eléctricas, dos proveedores.
  {
    id: "RFQ-2026-0002",
    numero: "COT-2026-0002",
    fecha: "2026-06-12",
    fechaVencimiento: "2026-06-26",
    comprador: BUYER,
    estado: "en_negociacion",
    lines: [
      { sku: "HER-001", productName: "Taladro percutor Bosch 800W", qtyRequested: 20 },
      { sku: "HER-003", productName: "Disco corte metal 4 1/2 (pack 10)", qtyRequested: 60 },
      { sku: "HER-004", productName: 'Esmeril angular Bosch 4.5" 820W', qtyRequested: 18 },
    ],
    suppliers: ["Herramientas Global", "Industrial del Sur"],
    responses: [
      {
        supplierName: "Herramientas Global",
        sku: "HER-001",
        costoUnitario: 42990,
        plazoDias: 15,
        minimoCompra: 10,
        disponible: true,
      },
      {
        supplierName: "Herramientas Global",
        sku: "HER-003",
        costoUnitario: 7990,
        plazoDias: 15,
        minimoCompra: 40,
        disponible: true,
      },
      {
        supplierName: "Herramientas Global",
        sku: "HER-004",
        costoUnitario: 28990,
        plazoDias: 15,
        minimoCompra: 12,
        disponible: true,
      },
      {
        supplierName: "Industrial del Sur",
        sku: "HER-001",
        costoUnitario: 41500,
        plazoDias: 18,
        minimoCompra: 12,
        disponible: true,
        observacion: "Oferta sujeta a confirmación de stock",
      },
      {
        supplierName: "Industrial del Sur",
        sku: "HER-003",
        costoUnitario: 7790,
        plazoDias: 18,
        minimoCompra: 60,
        disponible: true,
      },
      {
        supplierName: "Industrial del Sur",
        sku: "HER-004",
        costoUnitario: 29500,
        plazoDias: 18,
        minimoCompra: 12,
        disponible: true,
      },
    ],
  },

  // 3) Respuesta parcial — solo un proveedor de dos contestó. Gasfitería.
  {
    id: "RFQ-2026-0003",
    numero: "COT-2026-0003",
    fecha: "2026-06-18",
    fechaVencimiento: "2026-07-02",
    comprador: BUYER,
    estado: "respondida_parcial",
    lines: [
      { sku: "GAS-001", productName: "Tubería PVC sanitaria 110 mm", qtyRequested: 250 },
      { sku: "GAS-005", productName: 'Llave de paso PVC 1/2"', qtyRequested: 300 },
      { sku: "GAS-002", productName: "Silicona transparente multiuso 280 ml", qtyRequested: 150 },
    ],
    suppliers: ["FerrePro Chile", "Distribuidora Maule"],
    responses: [
      {
        supplierName: "FerrePro Chile",
        sku: "GAS-001",
        costoUnitario: 5490,
        plazoDias: 12,
        minimoCompra: 50,
        disponible: true,
      },
      {
        supplierName: "FerrePro Chile",
        sku: "GAS-005",
        costoUnitario: 1290,
        plazoDias: 12,
        minimoCompra: 100,
        disponible: true,
      },
      {
        supplierName: "FerrePro Chile",
        sku: "GAS-002",
        costoUnitario: 1990,
        plazoDias: 12,
        minimoCompra: 40,
        disponible: true,
        observacion: "Despacho parcial posible",
      },
      // Distribuidora Maule aún no responde (sin filas).
    ],
  },

  // 4) Enviada — esperando respuestas, sin ninguna aún. Electricidad.
  {
    id: "RFQ-2026-0004",
    numero: "COT-2026-0004",
    fecha: "2026-06-22",
    fechaVencimiento: "2026-07-06",
    comprador: BUYER,
    estado: "enviada",
    lines: [
      {
        sku: "ELE-001",
        productName: "Cable eléctrico THHN 2.5 mm (rollo 100 m)",
        qtyRequested: 30,
      },
      { sku: "ELE-002", productName: "Ampolleta LED 12W luz fría", qtyRequested: 400 },
    ],
    suppliers: ["Distribuidora Maule"],
    responses: [],
  },

  // 5) Borrador — aún sin enviar. Pinturas.
  {
    id: "RFQ-2026-0005",
    numero: "COT-2026-0005",
    fecha: "2026-06-24",
    fechaVencimiento: "2026-07-08",
    comprador: BUYER,
    estado: "borrador",
    lines: [
      { sku: "PIN-001", productName: "Pintura látex blanco 1 galón", qtyRequested: 120 },
      { sku: "PIN-002", productName: "Esmalte sintético negro 1/4 galón", qtyRequested: 90 },
    ],
    suppliers: ["Pinturas Nacionales"],
    responses: [],
  },

  // 6) Aprobada — ganador elegido, lista para convertir. Construcción/áridos.
  {
    id: "RFQ-2026-0006",
    numero: "COT-2026-0006",
    fecha: "2026-06-05",
    fechaVencimiento: "2026-06-15",
    comprador: BUYER,
    estado: "aprobada",
    lines: [
      { sku: "CON-004", productName: "Arena gruesa saco 25 kg", qtyRequested: 300 },
      { sku: "MAD-002", productName: "Pino cepillado 2x2 x 3,2 m", qtyRequested: 200 },
    ],
    suppliers: ["Proveedor Andes", "Materiales del Pacífico"],
    responses: [
      {
        supplierName: "Proveedor Andes",
        sku: "CON-004",
        costoUnitario: 1190,
        plazoDias: 7,
        minimoCompra: 100,
        disponible: true,
      },
      {
        supplierName: "Proveedor Andes",
        sku: "MAD-002",
        costoUnitario: 1690,
        plazoDias: 7,
        minimoCompra: 80,
        disponible: true,
      },
      {
        supplierName: "Materiales del Pacífico",
        sku: "CON-004",
        costoUnitario: 1150,
        plazoDias: 20,
        minimoCompra: 200,
        disponible: true,
        observacion: "Mejor precio, plazo más largo",
      },
      {
        supplierName: "Materiales del Pacífico",
        sku: "MAD-002",
        costoUnitario: 1620,
        plazoDias: 20,
        minimoCompra: 150,
        disponible: true,
      },
    ],
  },

  // 7) Vencida — pasó la fecha de vencimiento sin cerrar. Jardín.
  {
    id: "RFQ-2026-0007",
    numero: "COT-2026-0007",
    fecha: "2026-05-20",
    fechaVencimiento: "2026-05-30",
    comprador: BUYER,
    estado: "vencida",
    lines: [
      { sku: "JAR-001", productName: "Malla raschel 80% (rollo 4x100 m)", qtyRequested: 20 },
      { sku: "JAR-006", productName: "Fertilizante multipropósito 5 kg", qtyRequested: 60 },
    ],
    suppliers: ["Agroinsumos Central"],
    responses: [
      {
        supplierName: "Agroinsumos Central",
        sku: "JAR-001",
        costoUnitario: 38990,
        plazoDias: 11,
        minimoCompra: 8,
        disponible: true,
      },
      {
        supplierName: "Agroinsumos Central",
        sku: "JAR-006",
        costoUnitario: 4900,
        plazoDias: 11,
        minimoCompra: 20,
        disponible: false,
        observacion: "Reposición a fin de mes",
      },
    ],
  },

  // 8) Convertida — ya generó una OC. Ferretería/seguridad.
  {
    id: "RFQ-2026-0008",
    numero: "COT-2026-0008",
    fecha: "2026-05-28",
    fechaVencimiento: "2026-06-07",
    comprador: BUYER,
    estado: "convertida",
    lines: [
      { sku: "FER-001", productName: "Tornillo volcanita 6x1 (caja 1000)", qtyRequested: 100 },
      { sku: "SEG-001", productName: "Guantes de seguridad anticorte", qtyRequested: 200 },
    ],
    suppliers: ["FerrePro Chile", "Industrial del Sur"],
    responses: [
      {
        supplierName: "FerrePro Chile",
        sku: "FER-001",
        costoUnitario: 6990,
        plazoDias: 12,
        minimoCompra: 30,
        disponible: true,
      },
      {
        supplierName: "FerrePro Chile",
        sku: "SEG-001",
        costoUnitario: 3390,
        plazoDias: 12,
        minimoCompra: 50,
        disponible: true,
      },
      {
        supplierName: "Industrial del Sur",
        sku: "FER-001",
        costoUnitario: 7100,
        plazoDias: 18,
        minimoCompra: 50,
        disponible: true,
      },
      {
        supplierName: "Industrial del Sur",
        sku: "SEG-001",
        costoUnitario: 3290,
        plazoDias: 18,
        minimoCompra: 40,
        disponible: true,
        observacion: "Adjudicado en OC-2026-0140",
      },
    ],
  },
];
