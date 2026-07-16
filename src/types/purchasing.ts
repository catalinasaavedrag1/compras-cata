// ============================================================================
//  Tipos centrales de la Plataforma de Compras
//  Todo el dominio de negocio (productos, proveedores, OC, alertas, etc.)
// ============================================================================

export type ProductStatus = "active" | "new" | "discontinued" | "no_sales" | "seasonal" | "blocked";

export type PurchaseStatus = "buy" | "do_not_buy" | "review" | "on_demand" | "overstock";

export type RecommendationStatus = "critical" | "buy_now" | "review" | "normal" | "overstock";

export type Priority = "high" | "medium" | "low";

export type PurchaseOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "confirmed"
  | "partially_received"
  | "received"
  | "with_difference"
  | "closed"
  | "delayed"
  | "cancelled";

export type AlertSeverity = "high" | "medium" | "low";

export type AlertStatus = "new" | "in_review" | "resolved" | "ignored";

export type SupplierStatus = "active" | "review" | "delayed" | "blocked" | "inactive";

export type CategoryStatus = "healthy" | "review" | "critical" | "overstock" | "low_rotation";

export type AlertType =
  | "stockout"
  | "stockout_risk"
  | "overstock"
  | "low_margin"
  | "cost_increase"
  | "supplier_delay"
  | "no_sales"
  | "unexpected_demand"
  | "no_supplier"
  | "po_delayed"
  | "high_suggested_purchase"
  | "dead_stock"
  | "outdated_cost"
  | "no_recent_purchase"
  | "season_approaching"
  | "lost_opportunity";

export interface StockByLocation {
  locationName: string;
  stock: number;
  available: number;
  committed: number;
}

export interface Product {
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  supplierId: string;
  supplierName: string;
  cost: number;
  price: number;
  margin: number; // porcentaje 0-100
  totalStock: number;
  availableStock: number;
  committedStock: number;
  monthlySales: number;
  salesLast30Days: number;
  salesLast90Days: number;
  salesLast180Days: number;
  rotation: number; // veces al año
  inventoryDays: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  supplierLeadTimeDays: number;
  costUpdatedAt: string; // fecha ISO
  productStatus: ProductStatus;
  purchaseStatus: PurchaseStatus;
  stockByLocation: StockByLocation[];
  // -------------------------------------------------------------------------
  //  Catálogo del proveedor (opcional para no romper datos existentes)
  // -------------------------------------------------------------------------
  codigoProveedor?: string; // código del producto en el catálogo del proveedor
  codigoBarras?: string; // EAN-13 / código de barras
  unidadCompra?: string; // unidad en que se compra (ej. "pallet", "caja")
  unidadVenta?: string; // unidad en que se vende (ej. "saco", "unidad")
  multiploCompra?: number; // múltiplo / cantidad por unidad de compra
  costoAnterior?: number; // costo anterior (para mostrar el delta)
  descuentoVigentePct?: number; // descuento vigente del proveedor %
  equivalencias?: ProductEquivalence[]; // mismo producto en proveedores alternativos
  marcaPropia?: boolean; // marca propia / private label (si no viene, se deriva de la marca)
  esImportado?: boolean; // producto de importación (si no viene, se deriva de la marca)
  arancelPct?: number; // arancel de importación % (si aplica)
  // -------------------------------------------------------------------------
  //  Logística de retiro (opcional). Si no viene explícita, se deriva de la
  //  categoría con `productLogistics()` (src/data/logistics.ts). En materiales
  //  de construcción el retiro físico es parte de la decisión de compra.
  // -------------------------------------------------------------------------
  logistica?: ProductLogistics;
}

// ============================================================================
//  Logística de retiro — datos físicos del producto para planificar el retiro
//  (peso, volumen, manipulación, vehículo, centro y disponibilidad).
// ============================================================================

/** Cómo se manipula/carga el producto en el proveedor. */
export type HandlingType =
  | "manual" // a mano
  | "horquilla" // grúa horquilla
  | "pluma" // camión pluma / brazo hidráulico
  | "grua" // grúa / carga especial
  | "rampla"; // rampla / carga lateral

/** Clase de vehículo requerido para retirar la carga. */
export type VehicleClass =
  | "camioneta"
  | "camion_3_4"
  | "camion_simple"
  | "camion_rampla"
  | "camion_pluma";

/**
 * Ficha logística del producto. Los pesos y volúmenes son por **unidad de la
 * línea de compra** (la misma unidad en que se ingresa la cantidad en la OC),
 * para poder estimar directamente peso y volumen totales de la compra.
 */
export interface ProductLogistics {
  pesoUnitarioKg: number; // peso por unidad
  volumenM3: number; // volumen por unidad (m³)
  unidadesPorPallet?: number; // cuántas unidades entran por pallet
  apilable: boolean; // se puede apilar carga encima
  fragil: boolean; // requiere cuidado / no soporta peso encima
  sobredimensionado: boolean; // excede medidas estándar (largo/alto/ancho)
  cargaPesada: boolean; // material pesado (cemento, áridos, fierro)
  manipulacion: HandlingType; // cómo se carga en el proveedor
  vehiculoMinimo: VehicleClass; // vehículo mínimo que puede transportarlo
  centroRetiro: string; // centro/planta desde donde se despacha
  fechaDisponible: string; // fecha ISO en que estará listo para retiro
  tiempoCargaMin?: number; // tiempo estimado de carga (min)
  /** Grupo de carga (para reglas de compatibilidad entre productos). */
  grupoCarga?: string;
  /** Grupos de carga con los que NO puede compartir camión. */
  incompatibleCon?: string[];
}

/** Equivalencia: el mismo producto ofrecido por un proveedor alternativo. */
export interface ProductEquivalence {
  sku: string; // código del equivalente (del proveedor alternativo)
  supplierName: string;
  costo: number;
}

export interface PurchaseRecommendation {
  id: string;
  sku: string;
  productName: string;
  category: string;
  brand: string;
  supplierName: string;
  currentStock: number;
  committedStock: number;
  availableStock: number;
  salesLast30Days: number;
  salesLast90Days: number;
  rotation: number;
  inventoryDays: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  supplierLeadTimeDays: number;
  suggestedQuantity: number;
  unitCost: number;
  suggestedPurchaseAmount: number;
  margin: number;
  priority: Priority;
  status: RecommendationStatus;
  reason: string;
  risk: string;
}

/** Contacto de una de las áreas del proveedor (comercial, logística, cobranza). */
export interface SupplierContact {
  nombre: string;
  email: string;
  telefono: string;
}

/** Documento tributario / habilitante del proveedor (vigencia incluida). */
export interface SupplierDocument {
  tipo: string; // "Inicio de actividades", "Boletín comercial", "Certificado SII", etc.
  numero: string;
  vigente: boolean;
  vence?: string; // fecha ISO de vencimiento (opcional)
}

/** Acuerdo comercial marco vigente con el proveedor. */
export interface SupplierAgreementSummary {
  titulo: string;
  detalle: string;
}

export interface Supplier {
  id: string;
  name: string;
  rut: string;
  categories: string[];
  associatedSkus: number;
  openPurchaseOrders: number;
  deliveryCompliance: number; // porcentaje 0-100
  averageLeadTimeDays: number;
  lastPurchaseDate: string;
  purchasedAmountLast90Days: number;
  pendingAmount: number;
  status: SupplierStatus;
  // -------------------------------------------------------------------------
  //  Maestro del proveedor (opcional para no romper datos existentes)
  // -------------------------------------------------------------------------
  contactoComercial?: SupplierContact;
  contactoLogistica?: SupplierContact;
  contactoCobranza?: SupplierContact;
  condicionPago?: string; // ej. "30 días fecha factura"
  plazoEntregaDias?: number; // plazo de entrega comprometido (puede diferir del lead time real)
  minimoCompra?: number; // mínimo de compra (CLP)
  minimoCompraTipo?: "monto" | "unidades"; // cómo interpretar minimoCompra
  marcas?: string[]; // marcas que representa / distribuye
  documentosTributarios?: SupplierDocument[];
  acuerdosComerciales?: SupplierAgreementSummary[];
}

export interface PurchaseOrderLine {
  sku: string;
  productName: string;
  quantity: number;
  unitCost: number;
  receivedQty?: number; // recibido (para diferencias)
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierName: string;
  createdAt: string;
  expectedDate: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  skuCount: number;
  destinationWarehouse: string;
  buyerName: string;
  delayedDays: number;
  lines?: PurchaseOrderLine[];
  // Datos comerciales y de gestión (opcionales)
  discountPct?: number; // descuento negociado %
  paymentTerms?: string; // condiciones de pago
  comments?: string; // comentarios de la OC
  documents?: string[]; // documentos adjuntos (nombres)
  confirmedDate?: string; // fecha confirmada por el proveedor
}

export interface CommercialAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  relatedEntity: string;
  relatedSku?: string;
  description: string;
  recommendation: string;
  date: string;
  responsible: string;
  status: AlertStatus;
}

export interface Category {
  id: string;
  name: string;
  buyer: string;
  activeSkus: number;
  salesLast30Days: number;
  salesLast90Days: number;
  averageMargin: number;
  inventoryValue: number;
  stockoutSkus: number;
  riskSkus: number;
  overstockSkus: number;
  averageRotation: number;
  suggestedPurchase: number;
  status: CategoryStatus;
}

export interface SalesPoint {
  category: string;
  last30Days: number;
  last90Days: number;
  last180Days: number;
  growth: number; // variación % vs período anterior
}

export interface TopProduct {
  sku: string;
  name: string;
  category: string;
  unitsLast30Days: number;
  amountLast30Days: number;
  growth: number;
}

export interface InventoryByGroup {
  label: string;
  inventoryValue: number;
  availableStock: number;
  deadStock: number;
  overstockValue: number;
}

export type RuleScopeType = "global" | "category" | "supplier" | "brand" | "channel";

export interface PurchaseRule {
  id: string;
  scope: string; // etiqueta legible del ámbito
  scopeType: RuleScopeType;
  scopeValue?: string; // valor concreto (nombre de categoría/proveedor/marca/canal)
  targetInventoryDays: number;
  minStock: number;
  maxStock: number;
  minMargin: number; // %
  leadTimeDays: number;
  notes: string;
  updatedAt?: string; // última modificación (ISO)
  updatedBy?: string;
}

// ============================================================================
//  Campañas y oportunidades comerciales
// ============================================================================

export type CampaignChannel =
  | "web"
  | "marketplace"
  | "store"
  | "omnichannel"
  | "b2b"
  | "social"
  | "email";

export type CampaignOpportunityType =
  | "planned_campaign"
  | "liquidation_suggested"
  | "accelerated_growth"
  | "stockout_risk"
  | "star_product"
  | "review_before_campaign"
  | "not_recommended";

export type CampaignOpportunityStatus =
  | "ready_for_campaign"
  | "buy_before_campaign"
  | "stockout_risk"
  | "liquidate"
  | "boost"
  | "review_margin"
  | "review_supplier"
  | "not_recommended";

// ----------------------------------------------------------------------------
//  Campañas creadas por el comprador (con productos en descuento y canales)
// ----------------------------------------------------------------------------

export type PromoChannel =
  | "web"
  | "marketplace"
  | "store"
  | "omnichannel"
  | "b2b"
  | "social"
  | "email"
  | "google_ads"
  | "meta"
  | "tiktok";

export type CreatedCampaignStatus = "draft" | "scheduled" | "active";

export interface CampaignProductLine {
  sku: string;
  productName: string;
  basePrice: number;
  discountPct: number;
  campaignPrice: number;
  availableStock: number;
}

export interface CreatedCampaign {
  id: string;
  name: string;
  channels: PromoChannel[];
  startDate: string;
  endDate: string;
  status: CreatedCampaignStatus;
  products: CampaignProductLine[];
  createdAt: string;
}

// ----------------------------------------------------------------------------
//  Recepciones de mercadería (vista del comprador, no logística pesada)
// ----------------------------------------------------------------------------

export type ReceptionStatus =
  | "scheduled" // programada, aún no despachada
  | "in_transit" // en tránsito
  | "received" // recibida completa
  | "partial" // recibida parcial
  | "with_issues" // recibida con problemas de calidad
  | "delayed"; // debió llegar y no llegó

export interface ReceptionItem {
  sku: string;
  productName: string;
  expected: number;
  received: number;
  issue?: string;
}

export interface Reception {
  id: string;
  poNumber: string;
  supplierName: string;
  buyer: string;
  warehouse: string;
  createdAt: string;
  expectedDate: string;
  receivedDate?: string;
  status: ReceptionStatus;
  skuCount: number;
  unitsExpected: number;
  unitsReceived: number;
  qualityOk: boolean;
  qualityNote: string;
  items?: ReceptionItem[];
}

// ----------------------------------------------------------------------------
//  Reclamos al proveedor (faltantes, daños, calidad, costo, etc.)
//  Cierran el ciclo recepción → diferencia → reclamo → evaluación del proveedor.
// ----------------------------------------------------------------------------

export type ClaimType =
  | "faltante" // llegó menos de lo pedido
  | "dano" // mercadería dañada
  | "calidad" // calidad insuficiente
  | "vencimiento" // fecha de vencimiento inadecuada
  | "costo" // costo facturado distinto al pactado
  | "empaque" // empaque diferente
  | "sobrante" // llegó de más
  | "documento"; // documento incorrecto

export type ClaimStatus =
  | "abierto" // recién creado
  | "en_gestion" // en conversación con el proveedor
  | "aceptado" // el proveedor aceptó el reclamo
  | "resuelto" // cerrado con una resolución
  | "rechazado"; // el proveedor rechazó el reclamo

export type ClaimResolution =
  | "pendiente"
  | "nota_credito"
  | "reposicion"
  | "descuento"
  | "aceptado_sin_ajuste";

export interface SupplierClaim {
  id: string;
  poNumber: string;
  receptionId?: string;
  supplierName: string;
  sku: string;
  productName: string;
  tipo: ClaimType;
  cantidad: number;
  motivo: string;
  valorReclamado: number; // CLP en juego
  responsable: string;
  fecha: string; // ISO
  fechaLimite?: string; // compromiso del proveedor
  estado: ClaimStatus;
  resolucion: ClaimResolution;
  notaCredito?: string; // N° de nota de crédito si aplica
  evidencia?: string; // nombre del documento adjunto
}

// ----------------------------------------------------------------------------
//  Margen por canal de venta (marketplace / web / tienda)
// ----------------------------------------------------------------------------

export type MarginChannelKey = "marketplace" | "web" | "store";

export type MarginStatus = "negative" | "low" | "normal" | "over";

export interface ChannelMargin {
  sku: string;
  productName: string;
  category: string;
  supplierName: string;
  buyer: string;
  channel: MarginChannelKey;
  listPrice: number;
  finalPrice: number;
  cost: number;
  commission: number; // comisión del canal (marketplace)
  discount: number; // descuento aplicado
  marginPct: number; // margen actual %
  targetMarginPct: number; // margen objetivo %
  sales30: number;
  stock: number;
  suggestedPrice: number; // precio para alcanzar el objetivo
  status: MarginStatus;
  cause: string; // causa principal del resultado
  action: string; // acción recomendada
}

export interface CampaignOpportunity {
  id: string;
  sku: string;
  productName: string;
  category: string;
  brand: string;
  supplierName: string;
  opportunityType: CampaignOpportunityType;
  channel: CampaignChannel;
  campaignName: string;
  campaignDate: string; // fecha ISO
  daysToCampaign: number; // días hasta la campaña
  availableStock: number;
  salesLast30Days: number;
  previousPeriodSales: number;
  growthRate: number; // % vs período anterior
  estimatedCampaignSales: number;
  requiredStock: number;
  stockGap: number; // requiredStock - availableStock (positivo = falta)
  suggestedPurchaseQuantity: number;
  unitCost: number;
  margin: number;
  status: CampaignOpportunityStatus;
  risk: string;
  recommendation: string;
  actionLabel: string;
}

// ============================================================================
//  Señales de Ventas — colaboración vendedor ↔ comprador
//  El equipo de ventas detecta antes que nadie quiebres, demanda y oportunidades
//  en el terreno. Esta capa captura esas señales de forma ordenada para que el
//  comprador las reciba, analice, decida y deje trazabilidad de la decisión.
// ============================================================================

export type SignalType =
  | "stockout" // Quiebre detectado en sala
  | "asked_no_stock" // Cliente preguntó por producto sin stock
  | "high_demand" // Producto muy solicitado
  | "restock" // Recomendado para reponer
  | "campaign" // Candidato para campaña
  | "liquidation" // Candidato para liquidación
  | "price_error" // Posible error de precio
  | "low_rotation" // Baja rotación / no se mueve
  | "unexpected_demand" // Alta demanda inesperada
  | "customer_suggested"; // Producto sugerido por cliente (aún no en surtido)

export type SignalChannel = "store" | "web" | "marketplace" | "call_center";

export type SignalPriority = "high" | "medium" | "low";

export type SignalStatus =
  | "new" // solicitado, sin revisar
  | "in_review" // el comprador lo está mirando
  | "sourcing" // consultando proveedor
  | "quoted" // cotizado
  | "awaiting_customer" // esperando respuesta del cliente
  | "accepted" // aprobado / lo tomará
  | "purchased" // comprado
  | "rejected" // rechazado con motivo
  | "resolved"; // resuelto / cerrado

export type SignalAuthorRole = "seller" | "buyer";

/** Mensaje del hilo de conversación comprador ↔ vendedor. */
export interface SignalMessage {
  id: string;
  role: SignalAuthorRole;
  author: string;
  date: string; // ISO datetime
  text: string;
}

export type SignalEventKind =
  | "created"
  | "status"
  | "assigned"
  | "priority"
  | "comment"
  | "converted";

/** Evento de auditoría: deja trazabilidad de cada cambio de la señal. */
export interface SignalEvent {
  id: string;
  date: string; // ISO datetime
  actor: string;
  kind: SignalEventKind;
  text: string;
}

/** Datos de apoyo simulados que el comprador ve para decidir rápido. */
export interface SignalSupport {
  stock: number; // stock disponible actual
  sales30: number; // unidades vendidas últimos 30 días
  rotation: number; // veces al año
  marginPct: number; // margen %
  stockoutEvents30: number; // quiebres en los últimos 30 días
  affectedStores: string[]; // tiendas afectadas
}

export interface SalesSignal {
  id: string;
  type: SignalType;
  priority: SignalPriority;
  status: SignalStatus;
  // Producto (sku opcional: el cliente puede sugerir algo que no está en el surtido)
  sku?: string;
  productName: string;
  category: string;
  brand?: string;
  // Origen de la señal
  channel: SignalChannel;
  store: string; // tienda o canal donde se detectó
  reportedBy: string; // vendedor que reporta
  date: string; // fecha de reporte (ISO datetime)
  // Contenido
  comment: string; // comentario del vendedor
  recommendedAction: string; // qué sugiere el vendedor hacer
  // Evidencia opcional
  customersAsking?: number; // cuántos clientes preguntaron
  estimatedLostSale?: number; // venta perdida estimada (CLP)
  evidenceNote?: string; // foto, link o comentario de apoyo
  // Gestión por el comprador
  assignedBuyer?: string; // comprador asignado
  rejectionReason?: string; // motivo si fue rechazada
  // Solicitud formal de compra (vendedor → comprador)
  customerName?: string; // cliente que la solicita
  requestedQty?: number; // cantidad requerida
  requiredDate?: string; // fecha requerida (ISO)
  targetPrice?: number; // precio objetivo del cliente (CLP)
  suggestedSupplier?: string; // proveedor sugerido
  quotedCost?: number; // costo cotizado por el proveedor (CLP)
  // Apoyo + colaboración + trazabilidad
  support: SignalSupport;
  messages: SignalMessage[];
  timeline: SignalEvent[];
}
