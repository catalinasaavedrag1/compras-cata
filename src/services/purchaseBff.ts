// ============================================================================
//  Cliente tipado del purchase-bff-service (API real de recomendaciones).
//  - Base URL: import.meta.env.VITE_PURCHASE_BFF_URL (vacío = no configurado).
//  - Token: sesión de `compras:auth` si trae `token`; si no, el token de
//    desarrollo VITE_PURCHASE_BFF_TOKEN.
//  - Envoltorios según docs/contratos-api/00-convenciones.md §2 (éxito) y §4
//    (errores). Fallo de red ⇒ error tipado { code: "NETWORK", retryable: true }.
// ============================================================================

const BASE_URL = (import.meta.env.VITE_PURCHASE_BFF_URL ?? "").replace(/\/$/, "");
const API_PREFIX = "/api/purchase-bff/v1";
const AUTH_STORAGE_KEY = "compras:auth";

/** ¿Está configurada la URL del purchase-bff-service? */
export function isPurchaseBffConfigured(): boolean {
  return BASE_URL.length > 0;
}

// ----------------------------------------------------------------------------
//  Tipos del contrato
// ----------------------------------------------------------------------------

export type BffPriority = "stockout_imminent" | "low_stock" | "opportunity";

export type BffRecommendationStatus = "pending" | "in_cart" | "ordered" | "ignored" | "snoozed";

export interface BffWarning {
  code: string;
  scope: string;
  message: string;
  retryable: boolean;
}

export interface ReplenishmentMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  partial?: boolean;
  warnings?: BffWarning[];
}

export interface ReplenishmentRow {
  recommendationId: string;
  sku: string;
  name: string;
  brand: string | null;
  category: { id: string | null; name: string | null };
  supplier: { id: string | null; name: string | null; sapCardCode: string | null };
  stock: {
    available: number | null;
    inTransit: number | null;
    security: number | null;
    asOf: string | null;
  } | null;
  stockOnHand: number | null;
  stockReserved: number | null;
  sales: { dailyVelocity: number | null; source: "analytics" | "materialized"; stale: boolean };
  salesLast30d: number | null;
  salesLast90d: number | null;
  rotation: number | null;
  marginPct: number | null;
  coverageDays: number | null;
  reorderPoint: number | null;
  minStock: number | null;
  maxStock: number | null;
  leadTimeDays: number | null;
  priority: BffPriority;
  /** Cantidad sugerida con override ya aplicado por el motor. */
  suggestedQty: number;
  suggestedQtyOriginal: number;
  overrideQty: number | null;
  suggestedAmountClp: number | null;
  packMultiple: number | null;
  moq: number | null;
  cost: { unitCost: number; currency: "CLP"; priceListId: string; asOf: string } | null;
  reason: string | null;
  risk: string | null;
  flags: string[];
  status: BffRecommendationStatus;
  version: number;
}

export interface ReplenishmentSearchFilters {
  q?: string;
  categoryIds?: string[];
  supplierIds?: string[];
  priority?: BffPriority[];
  status?: string[];
}

export interface ReplenishmentSearchBody {
  filters: ReplenishmentSearchFilters;
  scope: "mine" | "all";
  page: number;
  pageSize: number;
  sort: { field: string; order: "asc" | "desc" }[];
}

export interface ReplenishmentSearchData {
  items: ReplenishmentRow[];
  meta: ReplenishmentMeta;
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Propuestas de compra (F3) y aprobaciones
// ----------------------------------------------------------------------------

/** Meta de paginación estándar del BFF (buildPageMeta). */
export interface BffPageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export type ProposalStatus =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "cancelled"
  | "converted";

export type ApprovalState = "pending" | "approved" | "rejected" | "observed";

/** Criterio de gobernanza roto (high_amount / excessive_coverage). */
export interface ProposalCriterion {
  code: string;
  threshold: unknown;
  actual: unknown;
  sku: string | null;
}

export interface ProposalLine {
  lineId: string;
  sku: string;
  skuName: string | null;
  supplierId: string;
  categoryId: string | null;
  qty: number;
  packMultiple: number | null;
  moq: number | null;
  unitCostClp: number | null;
  landedUnitCostClp: number | null;
  subtotalClp: number | null;
  recommendationId: string | null;
  version: number;
}

export interface ProposalSupplierGroup {
  supplierId: string;
  supplierName: string | null;
  sapCardCode: string | null;
  netTotalClp: number;
  lines: ProposalLine[];
}

export interface ProposalTotals {
  netClp: number | null;
  landedClp: number | null;
  lineCount: number | null;
  supplierCount: number | null;
}

export interface ProposalApprovalInfo {
  id: string;
  state: ApprovalState;
  version: number;
  criteria?: ProposalCriterion[];
}

/** Vista de propuesta que entrega el BFF (proposals.mapper → F3). */
export interface ProposalView {
  id: string;
  status: ProposalStatus;
  version: number;
  buyerId: string | null;
  title: string | null;
  note: string | null;
  netTotalClp: number | null;
  landedTotalClp: number | null;
  lineCount: number | null;
  supplierCount: number | null;
  /** Solo presente en el detalle (la lista viene sin líneas). */
  supplierGroups?: ProposalSupplierGroup[];
  totals?: ProposalTotals;
  approvalId?: string | null;
  approval?: ProposalApprovalInfo | null;
  submittedAt?: string | null;
  decidedAt?: string | null;
  cancelReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ProposalListData {
  items: ProposalView[];
  meta: BffPageMeta;
}

/** Nueva línea: desde una recomendación o manual (con snapshot de proveedor). */
export type NewProposalLineBody =
  | { sku: string; qty: number; recommendationId: string }
  | { sku: string; qty: number; supplierId: string; categoryId: string; skuName?: string };

/** Ítem de la bandeja de aprobaciones (approval.mapper de purchase-service). */
export interface ApprovalItem {
  id: string;
  proposalId: string;
  state: ApprovalState;
  version: number;
  requestedByUserId: string;
  decidedByUserId: string | null;
  decidedAt: string | null;
  note: string | null;
  reason: string | null;
  criteria?: ProposalCriterion[];
  proposal?: {
    id: string;
    status: ProposalStatus;
    buyerId: string | null;
    title: string | null;
    netTotalClp: number;
    version: number;
  };
  createdAt: string;
}

export interface ApprovalListData {
  items: ApprovalItem[];
  meta: BffPageMeta;
}

export type ApprovalAction = "approve" | "reject" | "request-changes";

// ----------------------------------------------------------------------------
//  Tipos del contrato — Órdenes de compra y sincronización SAP (F6/F7)
// ----------------------------------------------------------------------------

/** Estados de sincronización SAP (05-integracion-sap §6). */
export type SapSyncStatus =
  | "pending"
  | "processing"
  | "posted"
  | "failed"
  | "rejected"
  | "cancelled";

/** Única ventana a SAP expuesta al frontend (bloque sapSync saneado del BFF). */
export interface SapSyncView {
  status: SapSyncStatus | null;
  docEntry: number | string | null;
  docNum: number | string | null;
  attempts: number;
  lastError: string | null;
  postedAt: string | null;
}

/** Estados de negocio de una OC del dominio purchase-service. */
export type PurchaseOrderBffStatus =
  | "approved"
  | "sent"
  | "confirmed"
  | "partially_received"
  | "received"
  | "closed"
  | "cancelled";

export interface PurchaseOrderLineView {
  lineId: string;
  proposalLineId: string | null;
  sku: string;
  skuName: string | null;
  categoryId: string | null;
  qty: number;
  unitCostClp: number | null;
  landedUnitCostClp: number | null;
  subtotalClp: number | null;
  qtyReceivedTotal: number | null;
}

/** OC en vista BFF (toPurchaseOrderResponse + sapSync saneado). */
export interface PurchaseOrderView {
  id: string;
  number: string;
  proposalId: string | null;
  approvalId: string | null;
  buyerId: string | null;
  supplierId: string | null;
  sapCardCode: string | null;
  status: PurchaseOrderBffStatus;
  version: number;
  netTotalClp: number | null;
  landedTotalClp: number | null;
  currency: string | null;
  expectedDate: string | null;
  sentAt: string | null;
  closedAt: string | null;
  cancelReason: string | null;
  otbBucketId?: string | null;
  /** Solo presente en el detalle (la lista viene sin líneas). */
  lines?: PurchaseOrderLineView[];
  sapSync?: SapSyncView | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PurchaseOrderListData {
  items: PurchaseOrderView[];
  meta: BffPageMeta;
}

/** GET /purchase-orders/:id/sap-status — polling liviano (nunca cacheado). */
export interface SapStatusData {
  purchaseOrderId: string;
  sapSync: SapSyncView | null;
}

/** OC resumida que devuelve el convert (C13). */
export interface ConvertedPurchaseOrderView {
  id: string;
  number: string;
  supplierId: string | null;
  sapCardCode?: string | null;
  status: string;
  netTotalClp: number | null;
  landedTotalClp?: number | null;
  sapSync?: SapSyncView | null;
}

/** Respuesta de POST /proposals/:id/convert (202). */
export interface ConvertResultView {
  proposalId: string;
  status: "converted";
  purchaseOrders: ConvertedPurchaseOrderView[];
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Recepciones (F4)
// ----------------------------------------------------------------------------

/** Máquina de estados real de una recepción (01-modelo-dominio §2). */
export type ReceptionBffStatus =
  | "expected"
  | "in_transit"
  | "arrived"
  | "checking"
  | "completed"
  | "discrepancy"
  | "rejected";

/** Acciones del PATCH C21 (transiciones de la máquina). */
export type ReceptionTransitionAction =
  | "mark_in_transit"
  | "mark_arrived"
  | "start_checking"
  | "complete"
  | "reject";

/** Condición de una línea recibida (create-reception.dto del dominio). */
export type ReceptionItemCondition = "ok" | "damaged" | "wrong_item";

/** Fila resumen del listado (toReceptionSummary del dominio). */
export interface ReceptionSummaryView {
  id: string;
  displayId: string;
  purchaseOrderId: string;
  poNumber: string | null;
  supplierRef: string | null;
  warehouseId: string;
  status: ReceptionBffStatus;
  expectedDate: string | null;
  hasDiscrepancy: boolean;
  itemCount: number;
  version: number;
}

/** Línea del detalle: pedido-vs-recibido con condición y nota. */
export interface ReceptionItemView {
  itemId: string;
  purchaseOrderLineId: string;
  sku: string | null;
  skuName: string | null;
  qtyExpected: number | null;
  qtyReceived: number | null;
  condition: string;
  note: string | null;
}

/** Cumplimiento congelado al completar la recepción. */
export interface ReceptionComplianceSnap {
  expected: number;
  received: number;
  pct: number;
}

/** Detalle (toReceptionResponse): items + bloque OC resumido + compliance. */
export interface ReceptionDetailView {
  id: string;
  displayId: string;
  purchaseOrderId: string;
  warehouseId: string;
  packingSlip: string | null;
  status: ReceptionBffStatus;
  expectedDate: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  hasDiscrepancy: boolean;
  complianceSnap: ReceptionComplianceSnap | null;
  version: number;
  items?: ReceptionItemView[];
  purchaseOrder: { id: string; number: string; supplierRef: string; status: string } | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ReceptionListData {
  items: ReceptionSummaryView[];
  meta: BffPageMeta;
}

export interface CreateReceptionItemBody {
  purchaseOrderLineId: string;
  qtyReceived: number;
  condition?: ReceptionItemCondition;
  note?: string;
}

/** Cuerpo del POST /receptions (C21: registro manual; nace en `checking`). */
export interface CreateReceptionBody {
  purchaseOrderId: string;
  warehouseId: string;
  packingSlip?: string;
  items: CreateReceptionItemBody[];
}

/** Cuerpo del PATCH: `reason` es obligatorio solo en reject (auditable). */
export type ReceptionPatchBody =
  | { action: Exclude<ReceptionTransitionAction, "reject"> }
  | { action: "reject"; reason: string };

// ----------------------------------------------------------------------------
//  Tipos del contrato — Reclamos al proveedor (F5)
// ----------------------------------------------------------------------------

/** Máquina de estados real (C22): open → in_review → resolved | rejected. */
export type ClaimStatusBff = "open" | "in_review" | "resolved" | "rejected";

/** Tipos de reclamo del dominio (create-claim.dto). */
export type ClaimType = "quantity" | "quality" | "price" | "other";

/** Resoluciones posibles al resolver (patch-claim.dto). */
export type ClaimResolution = "credit_note" | "replacement" | "return" | "none";

/** Acciones del PATCH C22 (transiciones de la máquina). */
export type ClaimAction = "start_review" | "resolve" | "reject";

/** Fila resumen del listado (toClaimSummary del dominio). */
export interface ClaimSummaryView {
  id: string;
  purchaseOrderId: string;
  poNumber: string | null;
  receptionId: string | null;
  receptionDisplayId: string | null;
  supplierRef: string;
  type: ClaimType;
  status: ClaimStatusBff;
  resolution: ClaimResolution | null;
  creditNoteRef: string | null;
  description: string;
  dateCreated: string | null;
  resolvedAt: string | null;
  version: number;
}

/** Detalle (toClaimResponse): resumen + reason + bloques OC/recepción. */
export interface ClaimDetailView extends ClaimSummaryView {
  reason: string | null;
  purchaseOrder: { id: string; number: string; supplierRef: string; status: string } | null;
  reception: { id: string; displayId: string; status: string } | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ClaimListData {
  items: ClaimSummaryView[];
  meta: BffPageMeta;
}

/** Cuerpo del POST /claims (C22: abrir reclamo contra OC y recepción opcional). */
export interface CreateClaimBody {
  purchaseOrderId: string;
  receptionId?: string;
  type: ClaimType;
  description: string;
}

/**
 * Cuerpo del PATCH /claims/:id. `resolution` es obligatoria en resolve
 * (creditNoteRef solo con credit_note) y `reason` es obligatorio en reject.
 */
export type ClaimPatchBody =
  | { action: "start_review" }
  | { action: "resolve"; resolution: ClaimResolution; creditNoteRef?: string }
  | { action: "reject"; reason: string };

// ----------------------------------------------------------------------------
//  Tipos del contrato — RFQ / Cotizaciones (F8)
// ----------------------------------------------------------------------------

/**
 * Máquina de estados real (rfqs.service): draft → sent → (partially_)responded
 * → awarded | cancelled | expired. `expired` existe en la máquina pero v1 NO lo
 * auto-setea (sin batch de vencimiento): la UI deriva "vencida" de dueDate.
 */
export type RfqStatusBff =
  | "draft"
  | "sent"
  | "partially_responded"
  | "responded"
  | "awarded"
  | "cancelled"
  | "expired";

/** Fila resumen del listado (toRfqSummary del dominio). */
export interface RfqSummaryView {
  id: string;
  number: string;
  title: string;
  buyerId: string;
  status: RfqStatusBff;
  dueDate: string | null;
  lineCount: number;
  supplierCount: number;
  respondedCount: number;
  awardedResponseId: string | null;
  version: number;
  dateCreated: string | null;
}

/** Línea solicitada, con el mejor precio ofertado calculado por el dominio. */
export interface RfqLineView {
  id: string;
  sku: string;
  skuName: string;
  qty: number | null;
  targetUnitCostClp: number | null;
  bestUnitCostClp: number | null;
}

/** Proveedor invitado (supplierRef canónico + nameSnap si se conoce). */
export interface RfqSupplierView {
  id: string;
  supplierRef: string;
  supplierName: string | null;
  invitedAt: string | null;
  respondedAt: string | null;
}

/** Línea cotizada por un proveedor, unida a la solicitada por rfqLineId. */
export interface RfqResponseLineView {
  id: string;
  rfqLineId: string;
  unitCostClp: number | null;
  minQty: number | null;
  comment: string | null;
}

/** Respuesta completa de un proveedor invitado. */
export interface RfqResponseView {
  id: string;
  rfqSupplierId: string;
  supplierRef: string | null;
  receivedAt: string | null;
  validUntil: string | null;
  paymentTermRef: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  version: number;
  lines: RfqResponseLineView[];
}

/** Detalle de comparación (toRfqDetail): resumen + líneas, invitados y ofertas. */
export interface RfqDetailView extends RfqSummaryView {
  lines: RfqLineView[];
  suppliers: RfqSupplierView[];
  responses: RfqResponseView[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RfqListData {
  items: RfqSummaryView[];
  meta: BffPageMeta;
}

/** Línea a cotizar. skuName viaja por contrato pero v1 no lo persiste. */
export interface CreateRfqLineBody {
  sku: string;
  skuName?: string;
  qty: number;
  targetUnitCostClp?: number;
}

/** Cuerpo del POST /rfqs (≥ 1 línea, ≥ 1 proveedor invitado activo). */
export interface CreateRfqBody {
  title: string;
  dueDate?: string;
  lines: CreateRfqLineBody[];
  supplierRefs: string[];
}

/** PATCH de la máquina: `reason` es obligatorio solo en cancel (auditable). */
export type RfqPatchBody = { action: "send" } | { action: "cancel"; reason: string };

export interface RfqResponseLineBody {
  rfqLineId: string;
  unitCostClp: number;
  minQty?: number;
  comment?: string;
}

/** Cuerpo del POST /rfqs/:id/responses (RFQ en sent | partially_responded). */
export interface CreateRfqResponseBody {
  supplierRef: string;
  validUntil?: string;
  paymentTermRef?: string;
  leadTimeDays?: number;
  notes?: string;
  lines: RfqResponseLineBody[];
}

/** C20: adjudicar deja la RFQ awarded y crea una propuesta draft (sourceType rfq). */
export interface AwardRfqResult {
  rfq: RfqDetailView;
  proposalId: string;
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Alertas comerciales y campanita (F7)
// ----------------------------------------------------------------------------

/** Severidades reales del dominio (list-alerts.dto de purchase-service). */
export type AlertSeverityBff = "critical" | "warning" | "info";

/** Máquina de estados C17: active → acknowledged → resolved | dismissed. */
export type AlertStatusBff = "active" | "acknowledged" | "resolved" | "dismissed";

/** Transiciones expuestas por el BFF (POST /alerts/:id/<acción>). */
export type AlertActionBff = "acknowledge" | "resolve" | "dismiss";

/** Alerta comercial del inbox (alert.mapper del dominio vía BFF). */
export interface AlertView {
  id: string;
  dedupeKey: string;
  ruleKey: string;
  /** Tipo emitido por el motor E10 (stockout_imminent, sap_failed, …). */
  type: string;
  severity: AlertSeverityBff;
  title: string;
  /** Entidad referida: recommendation | purchase_order | reception | claim | budget. */
  refEntity: string;
  refId: string;
  /** null = alerta global (visible para toda la mesa de compras). */
  buyerId: string | null;
  status: AlertStatusBff;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  dismissReason: string | null;
  dateCreated: string | null;
  version: number;
}

export interface AlertListData {
  items: AlertView[];
  meta: BffPageMeta;
}

/** Ítem de la campanita compuesta (alertas vivas + flag de lectura). */
export interface NotificationView {
  id: string;
  title: string | null;
  severity: AlertSeverityBff | null;
  type: string | null;
  refEntity: string | null;
  refId: string | null;
  dateCreated: string | null;
  read: boolean;
  status: string | null;
}

/** Meta de la campanita: puede venir `partial` si notification-state degradó. */
export interface NotificationListMeta extends BffPageMeta {
  partial?: boolean;
  warnings?: BffWarning[];
}

export interface NotificationListData {
  items: NotificationView[];
  meta: NotificationListMeta;
}

/** Estado de lectura que devuelve el PATCH (notification-state del dominio). */
export interface NotificationReadState {
  userId?: string;
  ids?: string[];
}

// ----------------------------------------------------------------------------
//  API pública — Alertas comerciales (F7)
// ----------------------------------------------------------------------------

/** GET /alerts — inbox de alertas con filtros del dominio. */
export function listAlerts(params: {
  status?: AlertStatusBff;
  severity?: AlertSeverityBff;
  type?: string;
  /** Filtro por comprador (vistas de equipo del líder, F15). */
  buyerId?: string;
  page?: number;
  pageSize?: number;
}): Promise<AlertListData> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.severity) query.set("severity", params.severity);
  if (params.type) query.set("type", params.type);
  if (params.buyerId) query.set("buyerId", params.buyerId);
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 24));
  return request<AlertListData>(`/alerts?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/**
 * POST /alerts/:id/acknowledge|resolve|dismiss — transición C17. Idempotente
 * por diseño (repetir sobre el estado destino ⇒ 200 sin cambio), por eso NO
 * viaja If-Match ni clave de idempotencia (verificado en el controller BFF).
 * `reason` es obligatorio solo en dismiss (lo valida el dominio).
 */
export function alertAction(
  id: string,
  action: AlertActionBff,
  reason?: string
): Promise<AlertView> {
  return request<AlertView>(`/alerts/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify(action === "dismiss" ? { reason: reason ?? "" } : {}),
  });
}

// ----------------------------------------------------------------------------
//  API pública — Campanita de notificaciones (F7)
// ----------------------------------------------------------------------------

/**
 * GET /notifications — alertas vivas (active + acknowledged) con el estado de
 * lectura del usuario. Si notification-state degrada, todo llega como
 * no-leído y meta trae `partial` + warnings (la campanita nunca se cae).
 */
export function getNotifications(): Promise<NotificationListData> {
  return request<NotificationListData>("/notifications", {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** PATCH /notifications/read — marca ids como leídos (idempotente). */
export function markNotificationsRead(ids: string[]): Promise<NotificationReadState> {
  return request<NotificationReadState>("/notifications/read", {
    method: "PATCH",
    headers: baseHeaders(),
    body: JSON.stringify({ ids }),
  });
}

// ----------------------------------------------------------------------------
//  API pública — Recepciones (F4)
// ----------------------------------------------------------------------------

/** GET /receptions — listado resumen con filtros del dominio (incluye ?rid=). */
export function listReceptions(params: {
  status?: ReceptionBffStatus;
  warehouseId?: string;
  purchaseOrderId?: string;
  supplierId?: string;
  q?: string;
  /** Deep-link: id interno o displayId exactos (manda sobre `q`). */
  rid?: string;
  page?: number;
  pageSize?: number;
}): Promise<ReceptionListData> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.warehouseId) query.set("warehouseId", params.warehouseId);
  if (params.purchaseOrderId) query.set("purchaseOrderId", params.purchaseOrderId);
  if (params.supplierId) query.set("supplierId", params.supplierId);
  if (params.q) query.set("q", params.q);
  if (params.rid) query.set("rid", params.rid);
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 24));
  return request<ReceptionListData>(`/receptions?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /receptions/:id — detalle con items, bloque OC y complianceSnap. */
export function getReception(id: string): Promise<ReceptionDetailView> {
  return request<ReceptionDetailView>(`/receptions/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** POST /receptions — registra una recepción contra una OC emitida (🔑). */
export function createReception(body: CreateReceptionBody): Promise<ReceptionDetailView> {
  return request<ReceptionDetailView>("/receptions", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/**
 * PATCH /receptions/:id — transición de la máquina (If-Match `"<version>"`).
 * `complete` decide completed|discrepancy y actualiza la OC en el dominio.
 */
export function patchReception(
  id: string,
  version: number,
  body: ReceptionPatchBody
): Promise<ReceptionDetailView> {
  return request<ReceptionDetailView>(`/receptions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...baseHeaders(), ...ifMatch(version) },
    body: JSON.stringify(body),
  });
}

// ----------------------------------------------------------------------------
//  API pública — Reclamos al proveedor (F5)
// ----------------------------------------------------------------------------

/** GET /claims — listado resumen con filtros del dominio. */
export function listClaims(params: {
  status?: ClaimStatusBff;
  /** Filtro por proveedor: supplierRef persistido en el reclamo. */
  supplierId?: string;
  purchaseOrderId?: string;
  receptionId?: string;
  /** Búsqueda por descripción o número de OC (contains). */
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<ClaimListData> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.supplierId) query.set("supplierId", params.supplierId);
  if (params.purchaseOrderId) query.set("purchaseOrderId", params.purchaseOrderId);
  if (params.receptionId) query.set("receptionId", params.receptionId);
  if (params.q) query.set("q", params.q);
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 24));
  return request<ClaimListData>(`/claims?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /claims/:id — detalle con reason y bloques OC/recepción (la versión viaja en el cuerpo). */
export function getClaim(id: string): Promise<ClaimDetailView> {
  return request<ClaimDetailView>(`/claims/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** POST /claims — abre un reclamo contra una OC (🔑 idempotente). */
export function createClaim(body: CreateClaimBody): Promise<ClaimDetailView> {
  return request<ClaimDetailView>("/claims", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/**
 * PATCH /claims/:id — transición de la máquina (If-Match `"<version>"`).
 * resolve/reject exigen el permiso purchase:claim:resolve en el dominio.
 */
export function patchClaim(
  id: string,
  version: number,
  body: ClaimPatchBody
): Promise<ClaimDetailView> {
  return request<ClaimDetailView>(`/claims/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...baseHeaders(), ...ifMatch(version) },
    body: JSON.stringify(body),
  });
}

// ----------------------------------------------------------------------------
//  API pública — RFQ / Cotizaciones (F8)
// ----------------------------------------------------------------------------

/** GET /rfqs — listado resumen con filtros del dominio (status, q, buyerId). */
export function listRfqs(params: {
  status?: RfqStatusBff;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<RfqListData> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.q) query.set("q", params.q);
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 24));
  return request<RfqListData>(`/rfqs?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /rfqs/:id — detalle de comparación (la versión viaja en el cuerpo). */
export function getRfq(id: string): Promise<RfqDetailView> {
  return request<RfqDetailView>(`/rfqs/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** POST /rfqs — crea la RFQ en `draft` (🔑 idempotente). */
export function createRfq(body: CreateRfqBody): Promise<RfqDetailView> {
  return request<RfqDetailView>("/rfqs", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/** PATCH /rfqs/:id — send | cancel (If-Match `"<version>"`). */
export function patchRfq(id: string, version: number, body: RfqPatchBody): Promise<RfqDetailView> {
  return request<RfqDetailView>(`/rfqs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...baseHeaders(), ...ifMatch(version) },
    body: JSON.stringify(body),
  });
}

/** POST /rfqs/:id/responses — registra la oferta de UN invitado (🔑 + If-Match). */
export function registerRfqResponse(
  id: string,
  version: number,
  body: CreateRfqResponseBody
): Promise<RfqDetailView> {
  return request<RfqDetailView>(`/rfqs/${encodeURIComponent(id)}/responses`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency(), ...ifMatch(version) },
    body: JSON.stringify(body),
  });
}

/**
 * POST /rfqs/:id/award — C20: adjudica la oferta elegida. La RFQ queda
 * `awarded` y en la misma transacción nace una propuesta `draft` que sigue el
 * circuito normal de Governance (🔑 + If-Match; exige purchase:rfq:award).
 */
export function awardRfq(id: string, version: number, responseId: string): Promise<AwardRfqResult> {
  return request<AwardRfqResult>(`/rfqs/${encodeURIComponent(id)}/award`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency(), ...ifMatch(version) },
    body: JSON.stringify({ responseId }),
  });
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Dashboard de Inicio (F6: bandeja diaria compuesta)
// ----------------------------------------------------------------------------

/** Sección degradada: el BFF no pudo componerla pero la vista sigue viva. */
export interface DashboardDegradedSection {
  status: "degraded";
  warning: BffWarning;
}

/** Sección señales (F13): conteo de señales nuevas, fresca y degradable. */
export interface DashboardSignalsOkSection {
  status: "ok";
  newCount: number;
}

export type DashboardSignalsSection = DashboardSignalsOkSection | DashboardDegradedSection;

/** Recomendación destacada de la bandeja (top 3 del motor de reposición). */
export interface DashboardTopRecommendation {
  recommendationId: string;
  sku: string;
  skuName: string | null;
  /** Prioridad cruda del motor (stockout_imminent | low_stock | opportunity). */
  priority: string;
  coverageDays: number | null;
  suggestedQty: number | null;
}

/** Sección indispensable: si el motor cae, el GET /dashboard responde 502. */
export interface DashboardReplenishmentSection {
  status: "ok";
  pendingCount: number;
  stockoutImminent: number;
  lowStock: number;
  opportunity: number;
  suggestedAmountClp: number | null;
  top: DashboardTopRecommendation[];
}

export interface DashboardApprovalsOkSection {
  status: "ok";
  pendingCount: number;
  oldestAt: string | null;
}

export type DashboardApprovalsSection = DashboardApprovalsOkSection | DashboardDegradedSection;

/** Bucket OTB del mes (lista de /budget del dominio, esparcida en la sección). */
export interface DashboardBudgetBucket {
  id: string;
  month: string;
  categoryId: string;
  amountClp: number;
  availableClp: number;
  version: number;
}

/** Sección budget: `{status:'ok'}` + el resultado paginado de /budget?month=. */
export interface DashboardBudgetOkSection {
  status: "ok";
  items?: DashboardBudgetBucket[];
  total?: number;
}

export type DashboardBudgetSection = DashboardBudgetOkSection | DashboardDegradedSection;

export interface DashboardAgendaReceptionItem {
  type: "reception_due";
  /** displayId legible de la recepción (REC-…). */
  refId: string | null;
  receptionId: string | null;
  poNumber: string | null;
  dueDate: string;
}

export interface DashboardAgendaSapItem {
  type: "sap_attention";
  /** Número legible de la OC (OC-…). */
  refId: string | null;
  purchaseOrderId: string | null;
  detail: string | null;
}

export type DashboardAgendaItem = DashboardAgendaReceptionItem | DashboardAgendaSapItem;

export interface DashboardAgendaOkSection {
  status: "ok";
  items: DashboardAgendaItem[];
  claimsOpenCount: number | null;
  /** Presente solo si alguna sub-fuente degradó (datos parciales). */
  warnings?: BffWarning[];
}

export type DashboardAgendaSection = DashboardAgendaOkSection | DashboardDegradedSection;

/** Sección alertas (F7): conteo de activas por severidad, fresca y degradable. */
export interface DashboardAlertsOkSection {
  status: "ok";
  activeCount: number;
  bySeverity: { critical: number; warning: number; info: number };
}

export type DashboardAlertsSection = DashboardAlertsOkSection | DashboardDegradedSection;

export interface DashboardSections {
  replenishment: DashboardReplenishmentSection;
  /** Solo viene si la sesión tiene purchase:proposal:approve. */
  approvals?: DashboardApprovalsSection;
  budget: DashboardBudgetSection;
  agenda: DashboardAgendaSection;
  alerts: DashboardAlertsSection;
  signals: DashboardSignalsSection;
}

export interface DashboardData {
  asOf: string;
  sections: DashboardSections;
}

/** GET /context: sesión, permisos purchase:* y cartera asignada. */
export interface PurchaseContextData {
  userId: string;
  name: string | null;
  buyerId: string | null;
  role: string | null;
  permissions: string[];
  assignedCategories: string[];
  warnings?: BffWarning[];
}

/** Etiquetas en español de los códigos de criterio de gobernanza. */
export const CRITERION_LABEL_ES: Record<string, string> = {
  high_amount: "Monto alto",
  excessive_coverage: "Cobertura excesiva",
};

export function criterionLabelEs(code: string): string {
  return CRITERION_LABEL_ES[code] ?? code;
}

/** Cuerpo del PATCH de recomendación. `reason` es obligatorio (auditable). */
export type RecommendationPatchBody =
  | { action: "override"; qty: number; reason: string }
  | { action: "ignore"; reason: string }
  | { action: "snooze"; snoozeUntil: string; reason: string };

/**
 * Respuesta del PATCH: recomendación cruda actualizada. Se tipa de forma
 * defensiva (solo los campos que el front necesita para refrescar la fila).
 */
export interface PatchedRecommendation {
  id: string;
  status?: BffRecommendationStatus;
  overrideQty?: number | null;
  suggestedQty?: number;
  version?: number;
}

export interface PurchaseBffError {
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
  correlationId?: string;
  details?: unknown;
}

/** Error tipado del cliente: siempre transporta un PurchaseBffError. */
export class PurchaseBffApiError extends Error {
  readonly info: PurchaseBffError;

  constructor(info: PurchaseBffError) {
    super(info.message);
    this.name = "PurchaseBffApiError";
    this.info = info;
  }
}

/** Normaliza cualquier excepción del cliente a un PurchaseBffError. */
export function toPurchaseBffError(err: unknown): PurchaseBffError {
  if (err instanceof PurchaseBffApiError) return err.info;
  return NETWORK_ERROR;
}

const NETWORK_ERROR: PurchaseBffError = {
  code: "NETWORK",
  message: "No se pudo conectar con el servicio de compras.",
  statusCode: 0,
  retryable: true,
};

// ----------------------------------------------------------------------------
//  Mensajes legibles para errores de negocio (422/409 del catálogo del BFF)
// ----------------------------------------------------------------------------

function detailsRecord(details: unknown): Record<string, unknown> {
  return isRecord(details) ? details : {};
}

function detailString(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

/**
 * Traduce un PurchaseBffError a un mensaje accionable en español, incluyendo
 * el detalle de negocio (SKUs bajo MOQ, líneas sin costo, presupuesto, etc.).
 */
export function describePurchaseBffError(info: PurchaseBffError): string {
  const d = detailsRecord(info.details);
  switch (info.code) {
    case "MOQ_NOT_MET": {
      if (Array.isArray(d.lines)) {
        const skus = d.lines
          .map((l) => {
            const line = detailsRecord(l);
            const sku = detailString(line.sku);
            const qty = detailString(line.qty);
            const moq = detailString(line.moq);
            return sku ? `${sku} (${qty} u. / mín. ${moq})` : "";
          })
          .filter((s) => s.length > 0);
        if (skus.length > 0) {
          return `Hay líneas bajo el mínimo de compra del proveedor: ${skus.join(", ")}.`;
        }
      }
      const suggested = detailString(d.suggestedQty);
      if (suggested) {
        return `La cantidad no respeta el múltiplo de compra; prueba con ${suggested} u.`;
      }
      return "Hay líneas bajo el mínimo de compra del proveedor.";
    }
    case "COST_MISSING": {
      const skus = Array.isArray(d.skus) ? d.skus.map(detailString).filter(Boolean) : [];
      return skus.length > 0
        ? `Hay líneas sin costo vigente: ${skus.join(", ")}.`
        : "Hay líneas sin costo vigente; no se puede enviar a revisión.";
    }
    case "OTB_EXCEEDED": {
      const category = detailString(d.categoryId);
      return category
        ? `La compra excede el presupuesto abierto (OTB) de la categoría ${category}.`
        : "La compra excede el presupuesto abierto (OTB).";
    }
    case "SUPPLIER_INACTIVE": {
      const supplier = detailString(d.supplierId);
      return supplier
        ? `El proveedor ${supplier} está inactivo o bloqueado.`
        : "Hay un proveedor inactivo o bloqueado en la propuesta.";
    }
    case "PURCHASE_PROPOSAL_INVALID_STATE":
      return "La propuesta cambió de estado y esta acción ya no aplica.";
    case "PURCHASE_ORDER_INVALID_STATE":
      return "La orden de compra cambió de estado y esta acción ya no aplica.";
    case "SAP_VALIDATION_ERROR": {
      const lastError =
        detailString(d.lastError) || detailString(d.sapMessage) || detailString(d.message);
      return lastError
        ? `SAP rechazó el documento: ${lastError}`
        : "SAP rechazó el documento de compra; corrige los datos y reintenta el envío.";
    }
    case "VERSION_CONFLICT":
      return "El registro cambió en otra sesión; se recargaron los datos.";
    case "FORBIDDEN":
      return info.message || "No tienes permiso para realizar esta acción.";
    default:
      return info.message || "Error del servicio de compras.";
  }
}

/** Clave de idempotencia para comandos POST (🔑 según contrato). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

// ----------------------------------------------------------------------------
//  Resolución de token
// ----------------------------------------------------------------------------

function resolveToken(): string {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === "object" && "token" in parsed) {
        const token = (parsed as { token: unknown }).token;
        if (typeof token === "string" && token.length > 0) return token;
      }
    }
  } catch {
    // Sesión ilegible: cae al token de desarrollo.
  }
  return import.meta.env.VITE_PURCHASE_BFF_TOKEN ?? "";
}

// ----------------------------------------------------------------------------
//  Envoltorios y request base
// ----------------------------------------------------------------------------

interface SuccessEnvelope {
  success: true;
  data: unknown;
  correlationId?: string;
}

interface ErrorEnvelope {
  success: false;
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
  retryable: boolean;
  correlationId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuccessEnvelope(payload: unknown): payload is SuccessEnvelope {
  return isRecord(payload) && payload.success === true && "data" in payload;
}

function isErrorEnvelope(payload: unknown): payload is ErrorEnvelope {
  return isRecord(payload) && payload.success === false && typeof payload.code === "string";
}

function parseErrorPayload(payload: unknown, httpStatus: number): PurchaseBffError {
  if (isErrorEnvelope(payload)) {
    return {
      code: payload.code,
      message: payload.message,
      statusCode: typeof payload.statusCode === "number" ? payload.statusCode : httpStatus,
      retryable: payload.retryable === true,
      correlationId: typeof payload.correlationId === "string" ? payload.correlationId : undefined,
      details: payload.details,
    };
  }
  return {
    code: httpStatus === 401 ? "UNAUTHENTICATED" : httpStatus >= 500 ? "INTERNAL_ERROR" : "UNKNOWN",
    message: `Error ${httpStatus} del servicio de compras.`,
    statusCode: httpStatus,
    retryable: httpStatus >= 500,
  };
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${API_PREFIX}${path}`, init);
  } catch {
    throw new PurchaseBffApiError(NETWORK_ERROR);
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok || isErrorEnvelope(payload)) {
    throw new PurchaseBffApiError(parseErrorPayload(payload, res.status));
  }
  // Envoltorio de éxito del BFF (§2); si viniera crudo, se usa tal cual.
  if (isSuccessEnvelope(payload)) return payload.data as T;
  return payload as T;
}

function baseHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${resolveToken()}`,
    "Content-Type": "application/json",
  };
}

// ----------------------------------------------------------------------------
//  API pública
// ----------------------------------------------------------------------------

/** POST /replenishment/search — página de recomendaciones compuesta. */
export function searchReplenishment(body: ReplenishmentSearchBody): Promise<ReplenishmentSearchData> {
  return request<ReplenishmentSearchData>("/replenishment/search", {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify(body),
  });
}

/** PATCH /replenishment/recommendations/:id — override / ignore / snooze. */
export function patchRecommendation(
  id: string,
  version: number,
  body: RecommendationPatchBody
): Promise<PatchedRecommendation> {
  return request<PatchedRecommendation>(`/replenishment/recommendations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...baseHeaders(), "If-Match": `"${version}"` },
    body: JSON.stringify(body),
  });
}

// ----------------------------------------------------------------------------
//  API pública — Propuestas de compra (F3)
// ----------------------------------------------------------------------------

function ifMatch(version: number): Record<string, string> {
  return { "If-Match": `"${version}"` };
}

function idempotency(): Record<string, string> {
  return { "idempotency-key": newIdempotencyKey() };
}

/** POST /proposals — crea una propuesta (🔑 idempotente). */
export function createProposal(body: {
  title?: string;
  note?: string;
  lines?: NewProposalLineBody[];
}): Promise<ProposalView> {
  return request<ProposalView>("/proposals", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/** GET /proposals?status=&page=&pageSize= — lista (sin líneas). */
export function listProposals(params: {
  status?: ProposalStatus;
  page?: number;
  pageSize?: number;
}): Promise<ProposalListData> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 24));
  return request<ProposalListData>(`/proposals?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /proposals/:id — detalle con supplierGroups y totals. */
export function getProposal(id: string): Promise<ProposalView> {
  return request<ProposalView>(`/proposals/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** POST /proposals/:id/lines — agrega una línea (🔑 + If-Match propuesta). */
export function addProposalLine(
  id: string,
  proposalVersion: number,
  body: NewProposalLineBody
): Promise<ProposalView> {
  return request<ProposalView>(`/proposals/${encodeURIComponent(id)}/lines`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency(), ...ifMatch(proposalVersion) },
    body: JSON.stringify(body),
  });
}

/** PATCH /proposals/:id/lines/:lineId — cantidad (If-Match con versión de LÍNEA). */
export function updateProposalLine(
  id: string,
  lineId: string,
  lineVersion: number,
  qty: number
): Promise<ProposalView> {
  return request<ProposalView>(
    `/proposals/${encodeURIComponent(id)}/lines/${encodeURIComponent(lineId)}`,
    {
      method: "PATCH",
      headers: { ...baseHeaders(), ...ifMatch(lineVersion) },
      body: JSON.stringify({ qty }),
    }
  );
}

/** DELETE /proposals/:id/lines/:lineId — elimina la línea (If-Match de línea). */
export function deleteProposalLine(
  id: string,
  lineId: string,
  lineVersion: number
): Promise<ProposalView> {
  return request<ProposalView>(
    `/proposals/${encodeURIComponent(id)}/lines/${encodeURIComponent(lineId)}`,
    {
      method: "DELETE",
      headers: { ...baseHeaders(), ...ifMatch(lineVersion) },
    }
  );
}

/** POST /proposals/:id/submit — envía a revisión (🔑 + If-Match). */
export function submitProposal(id: string, version: number): Promise<ProposalView> {
  return request<ProposalView>(`/proposals/${encodeURIComponent(id)}/submit`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency(), ...ifMatch(version) },
    body: JSON.stringify({}),
  });
}

/** POST /proposals/:id/cancel — cancela con motivo (🔑 + If-Match). */
export function cancelProposal(id: string, version: number, reason: string): Promise<ProposalView> {
  return request<ProposalView>(`/proposals/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency(), ...ifMatch(version) },
    body: JSON.stringify({ reason }),
  });
}

/**
 * POST /proposals/:id/convert — convierte la propuesta aprobada en OC reales
 * (una por proveedor) y encola su envío a SAP (🔑 + If-Match). Responde 202.
 */
export function convertProposal(id: string, version: number): Promise<ConvertResultView> {
  return request<ConvertResultView>(`/proposals/${encodeURIComponent(id)}/convert`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency(), ...ifMatch(version) },
    body: JSON.stringify({}),
  });
}

// ----------------------------------------------------------------------------
//  API pública — Órdenes de compra y sincronización SAP
// ----------------------------------------------------------------------------

/** GET /purchase-orders?status=&page=&pageSize= — lista (sin líneas). */
export function listPurchaseOrders(params: {
  status?: PurchaseOrderBffStatus;
  /** Filtro por proveedor (ficha F11): referenceId de comerce. */
  supplierId?: string;
  /** Filtro por SKU en líneas (ficha de producto). */
  sku?: string;
  /** Match por contención sobre el número real (búsqueda global). */
  number?: string;
  page?: number;
  pageSize?: number;
}): Promise<PurchaseOrderListData> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.supplierId) query.set("supplierId", params.supplierId);
  if (params.sku) query.set("sku", params.sku);
  if (params.number) query.set("number", params.number);
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 24));
  return request<PurchaseOrderListData>(`/purchase-orders?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /purchase-orders/:id — detalle con líneas y bloque sapSync. */
export function getPurchaseOrder(id: string): Promise<PurchaseOrderView> {
  return request<PurchaseOrderView>(`/purchase-orders/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /purchase-orders/:id/sap-status — polling liviano de sincronización. */
export function getSapStatus(id: string): Promise<SapStatusData> {
  return request<SapStatusData>(`/purchase-orders/${encodeURIComponent(id)}/sap-status`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/**
 * POST /purchase-orders/:id/send — envía la OC al proveedor y re-encola el
 * job SAP si estaba en `failed` (🔑 + If-Match). Responde 202.
 */
export function sendPurchaseOrder(id: string, version: number): Promise<PurchaseOrderView> {
  return request<PurchaseOrderView>(`/purchase-orders/${encodeURIComponent(id)}/send`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency(), ...ifMatch(version) },
    body: JSON.stringify({}),
  });
}

/** POST /purchase-orders/:id/cancel — cancela con motivo (🔑 + If-Match). */
export function cancelPurchaseOrder(
  id: string,
  version: number,
  reason: string
): Promise<PurchaseOrderView> {
  return request<PurchaseOrderView>(`/purchase-orders/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency(), ...ifMatch(version) },
    body: JSON.stringify({ reason }),
  });
}

// ----------------------------------------------------------------------------
//  API pública — Aprobaciones
// ----------------------------------------------------------------------------

/** GET /approvals?state=&page=&pageSize= — bandeja de aprobaciones. */
export function listApprovals(params: {
  state?: ApprovalState;
  page?: number;
  pageSize?: number;
}): Promise<ApprovalListData> {
  const query = new URLSearchParams();
  query.set("state", params.state ?? "pending");
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 24));
  return request<ApprovalListData>(`/approvals?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /approvals/:id — detalle de una aprobación. */
export function getApproval(id: string): Promise<ApprovalItem> {
  return request<ApprovalItem>(`/approvals/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/**
 * POST /approvals/:id/approve|reject|request-changes — decide (🔑 + If-Match).
 * `reason` es obligatorio en reject/request-changes (lo valida el dominio).
 */
export function decideApproval(
  id: string,
  action: ApprovalAction,
  version: number,
  body: { reason?: string; note?: string }
): Promise<ApprovalItem> {
  return request<ApprovalItem>(`/approvals/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency(), ...ifMatch(version) },
    body: JSON.stringify(body),
  });
}

// ----------------------------------------------------------------------------
//  API pública — Contexto de sesión
// ----------------------------------------------------------------------------

/** GET /context — sesión, permisos purchase:* y cartera asignada. */
export function getContext(): Promise<PurchaseContextData> {
  return request<PurchaseContextData>("/context", {
    method: "GET",
    headers: baseHeaders(),
  });
}

// ----------------------------------------------------------------------------
//  API pública — Dashboard de Inicio (F6)
// ----------------------------------------------------------------------------

/**
 * GET /dashboard?scope=mine|all — bandeja diaria compuesta: reposición
 * (indispensable; sin motor ⇒ 502 DOWNSTREAM_SERVICE_ERROR), aprobaciones
 * (solo con permiso), presupuesto OTB y agenda, con degradación por sección.
 */
export function getDashboard(scope: "mine" | "all"): Promise<DashboardData> {
  return request<DashboardData>(`/dashboard?scope=${scope}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Presupuesto / Open-to-Buy (F9)
// ----------------------------------------------------------------------------

/**
 * Bucket OTB del mes en vista BFF: números netos por categoría. El semáforo y
 * el % usado los deriva la página, porque el borrador en curso (local) también
 * consume presupuesto en vivo.
 */
export interface BudgetBucketView {
  bucketId: string;
  month: string;
  categoryId: string;
  /** Nombre desde el snapshot materializado; fallback = categoryId. */
  categoryName: string;
  budgetClp: number;
  /** Comprometido: neto de consumos (OC emitidas) menos reintegros. */
  committedClp: number;
  availableClp: number;
  version: number;
}

export interface BudgetTotals {
  budgetClp: number;
  committedClp: number;
  availableClp: number;
}

/** GET /budget: mes efectivo + selector de meses + buckets + totales. */
export interface BudgetOverviewData {
  /** null cuando no hay presupuesto configurado (estado vacío). */
  month: string | null;
  /** Meses con presupuesto, más reciente primero. */
  months: string[];
  items: BudgetBucketView[];
  totals: BudgetTotals;
}

export interface SupplierSpendItem {
  supplierId: string;
  supplierName: string;
  totalClp: number;
  orderCount: number;
  /** Participación sobre el total de la ventana (0..1). */
  share: number;
}

/** GET /budget/supplier-spend: compra agregada por proveedor (ventana móvil). */
export interface SupplierSpendData {
  windowDays: number;
  totalClp: number;
  items: SupplierSpendItem[];
  /** Presente si comerce degradó (nombres desde la referencia interna). */
  warnings?: BffWarning[];
}

// ----------------------------------------------------------------------------
//  API pública — Presupuesto / Open-to-Buy (F9)
// ----------------------------------------------------------------------------

/** GET /budget?month= — vista OTB del mes (sin mes: el más reciente). */
export function getBudgetOverview(month?: string): Promise<BudgetOverviewData> {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<BudgetOverviewData>(`/budget${query}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /budget/supplier-spend?days= — compra por proveedor de la ventana. */
export function getSupplierSpend(days = 90): Promise<SupplierSpendData> {
  return request<SupplierSpendData>(`/budget/supplier-spend?days=${days}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Fichas de proveedor / producto / categoría (F11)
// ----------------------------------------------------------------------------

/** Versión de condiciones comerciales (historia append-only, vigente primero). */
export interface SupplierTermsVersion {
  id: string;
  validFrom?: string;
  paymentTermRef?: string | null;
  discountPct?: number | null;
  freightPolicy?: string | null;
  currency?: string;
  notes?: string | null;
  version?: number;
  userCreated?: string;
}

export interface SupplierSkuTermsRow {
  id: string;
  sku: string;
  moq?: number | null;
  packMultiple?: number | null;
  leadTimeDays?: number | null;
  agreedUnitCostClp?: number | null;
  validFrom?: string;
}

export interface SupplierAgreementRow {
  id: string;
  title?: string;
  kind?: string;
  validFrom?: string;
  validTo?: string | null;
  docRef?: string | null;
  status?: string;
  dateCreated?: string;
  userCreated?: string;
}

export interface SupplierNegotiationRow {
  id: string;
  status?: string;
  topic?: string;
  minutes?: string;
  outcome?: Record<string, unknown> | null;
  authorUserId?: string;
  version?: number;
  dateCreated?: string;
}

/** Fila del catálogo conocido del proveedor (materialización del motor). */
export interface SupplierCatalogRow {
  recommendationId: string;
  sku: string;
  name: string | null;
  brand: string | null;
  categoryId: string | null;
  categoryName: string | null;
  stockAvailable: number | null;
  dailyVelocity: number | null;
  coverageDays: number | null;
  unitCostClp: number | null;
  moq: number | null;
  packMultiple: number | null;
  leadTimeDays: number | null;
  salesLast30d: number | null;
  marginPct: number | null;
  priority: string;
  status: string;
}

export interface SupplierFichaAlert {
  id: string;
  title: string | null;
  severity: string | null;
  status: string | null;
  refEntity: string | null;
  refId: string | null;
  dateCreated: string | null;
}

/** GET /suppliers/:id — ficha compuesta (relación indispensable; resto degradable). */
export interface SupplierFichaData {
  supplierId: string;
  name: string;
  rut: string | null;
  sapCardCode: string | null;
  status: string;
  metrics: {
    compliancePct: number | null;
    leadTimeDaysObserved: number | null;
    pendingAmountClp: number | null;
    asOf: string | null;
  };
  evaluation: { period: string; dimensions: Record<string, number> } | null;
  terms: SupplierTermsVersion[];
  skuTerms: SupplierSkuTermsRow[];
  agreements: SupplierAgreementRow[];
  negotiations: SupplierNegotiationRow[];
  summary: {
    ordersTotal: number | null;
    ordersOpen: number | null;
    ordersDelayed: number | null;
    receptionsTotal: number | null;
    claimsTotal: number | null;
    claimsOpen: number | null;
    purchased90Clp: number | null;
    purchased90Share: number | null;
    alertsActive: number | null;
  };
  catalog: {
    items: SupplierCatalogRow[];
    skuCount: number;
    sales30Units: number | null;
    avgMarginPct: number | null;
    stalledCount: number;
  };
  alerts: SupplierFichaAlert[];
  warnings?: BffWarning[];
}

export interface SupplierRelationRow {
  id: string;
  supplierId: string;
  sapCardCode: string | null;
  document: string | null;
  name: string;
  status: string;
  compliancePct: number | null;
  leadTimeDaysObserved: number | null;
  pendingAmountClp: number | null;
  metricsAsOf: string | null;
  version: number;
}

export interface ProductOrderRow {
  purchaseOrderId: string | null;
  number: string | null;
  status: string | null;
  supplierId: string | null;
  createdAt: string | null;
  expectedDate: string | null;
  qty: number | null;
  unitCostClp: number | null;
}

/** GET /products/:sku — SKU 360 compuesto. */
export interface ProductFichaData {
  sku: string;
  name: string | null;
  brand: string | null;
  category: { id: string | null; name: string | null };
  supplier: { id: string | null; name: string | null };
  stock: {
    available: number | null;
    inTransit: number | null;
    security: number | null;
    asOf: string | null;
    /** true = saldo del snapshot del motor (feed vivo caído). */
    fromSnapshot: boolean;
  };
  cost: { unitCostClp: number | null; priceListId: string | null; asOf: string | null };
  sales: {
    dailyVelocity: number | null;
    salesLast30d: number | null;
    salesLast90d: number | null;
    rotation: number | null;
    marginPct: number | null;
  };
  terms: { moq: number | null; packMultiple: number | null; leadTimeDays: number | null };
  recommendation: {
    id: string;
    status: string;
    priority: string;
    suggestedQty: number;
    overrideQty?: number | null;
    coverageDays?: number | null;
    version: number;
    reason?: string | null;
    risk?: string | null;
  } | null;
  orders: ProductOrderRow[];
  alerts: Array<{
    id: string;
    title: string | null;
    severity: string | null;
    status: string | null;
    dateCreated: string | null;
  }>;
  warnings?: BffWarning[];
}

export interface CategoryProductRow {
  recommendationId: string;
  sku: string;
  name: string | null;
  brand: string | null;
  supplierId: string | null;
  supplierName: string | null;
  stockAvailable: number | null;
  coverageDays: number | null;
  salesLast30d: number | null;
  marginPct: number | null;
  suggestedAmountClp: number | null;
  priority: string;
  status: string;
}

export interface CategorySupplierRow {
  supplierId: string;
  supplierName: string | null;
  skuCount: number;
  suggestedAmountClp: number;
}

/** GET /categories/:id — ficha de categoría en alcance de compras. */
export interface CategoryFichaData {
  categoryId: string;
  name: string;
  buyerId: string | null;
  replenishment: {
    pendingCount: number;
    byPriority: { stockout_imminent: number; low_stock: number; opportunity: number };
    suggestedAmountClp: number;
    sales30Units: number | null;
    avgMarginPct: number | null;
  };
  budget: {
    month: string;
    budgetClp: number;
    committedClp: number;
    availableClp: number;
  } | null;
  suppliers: CategorySupplierRow[];
  products: CategoryProductRow[];
  warnings?: BffWarning[];
}

// ----------------------------------------------------------------------------
//  API pública — Fichas de proveedor / producto / categoría (F11)
// ----------------------------------------------------------------------------

/** GET /suppliers — panel liviano de relaciones (búsqueda q). */
export function listSupplierRelations(params?: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: SupplierRelationRow[]; meta: ReplenishmentMeta }> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  query.set("page", String(params?.page ?? 1));
  query.set("pageSize", String(params?.pageSize ?? 50));
  return request<{ items: SupplierRelationRow[]; meta: ReplenishmentMeta }>(
    `/suppliers?${query.toString()}`,
    { method: "GET", headers: baseHeaders() }
  );
}

/** GET /suppliers/:id — ficha compuesta del proveedor. */
export function getSupplierFicha(supplierId: string): Promise<SupplierFichaData> {
  return request<SupplierFichaData>(`/suppliers/${encodeURIComponent(supplierId)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** PUT /suppliers/:id/terms — C15b: nueva versión de condiciones (+ SKU terms). */
export function putSupplierTerms(
  supplierId: string,
  body: {
    paymentTermRef?: string;
    discountPct?: number;
    freightPolicy?: string;
    notes?: string;
    skuTerms?: Array<{
      sku: string;
      moq?: number;
      packMultiple?: number;
      leadTimeDays?: number;
      agreedUnitCostClp?: number;
    }>;
  }
): Promise<{ terms: SupplierTermsVersion; skuTerms: SupplierSkuTermsRow[] }> {
  return request<{ terms: SupplierTermsVersion; skuTerms: SupplierSkuTermsRow[] }>(
    `/suppliers/${encodeURIComponent(supplierId)}/terms`,
    { method: "PUT", headers: baseHeaders(), body: JSON.stringify(body) }
  );
}

/** POST /suppliers/:id/negotiations — C15: registrar ronda de negociación. */
export function createSupplierNegotiation(
  supplierId: string,
  body: { topic: string; minutes: string; status?: string; outcome?: Record<string, unknown> }
): Promise<SupplierNegotiationRow> {
  return request<SupplierNegotiationRow>(
    `/suppliers/${encodeURIComponent(supplierId)}/negotiations`,
    { method: "POST", headers: { ...baseHeaders(), ...idempotency() }, body: JSON.stringify(body) }
  );
}

/** POST /suppliers/:id/agreements — registrar acuerdo comercial. */
export function createSupplierAgreement(
  supplierId: string,
  body: { title: string; kind: string; validFrom: string; validTo?: string; docRef?: string }
): Promise<SupplierAgreementRow> {
  return request<SupplierAgreementRow>(
    `/suppliers/${encodeURIComponent(supplierId)}/agreements`,
    { method: "POST", headers: { ...baseHeaders(), ...idempotency() }, body: JSON.stringify(body) }
  );
}

/** GET /products/:sku — ficha de producto (SKU 360). */
export function getProductFicha(sku: string): Promise<ProductFichaData> {
  return request<ProductFichaData>(`/products/${encodeURIComponent(sku)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /categories/:id — ficha de categoría (alcance de compras). */
export function getCategoryFicha(categoryId: string): Promise<CategoryFichaData> {
  return request<CategoryFichaData>(`/categories/${encodeURIComponent(categoryId)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Paneles de proveedores y categorías (F12)
// ----------------------------------------------------------------------------

/** Fila del panel de proveedores (GET /suppliers). null = sub-lectura degradada. */
export interface SupplierPanelRow {
  supplierId: string;
  name: string;
  rut: string | null;
  sapCardCode: string | null;
  status: string;
  compliancePct: number | null;
  leadTimeDaysObserved: number | null;
  pendingAmountClp: number | null;
  purchased90Clp: number | null;
  openOrders: number | null;
  skuCount: number | null;
  categories: string[];
}

export interface SuppliersPanelData {
  items: SupplierPanelRow[];
  meta: ReplenishmentMeta;
}

/** Fila del panel de categorías (GET /categories). */
export interface CategoryPanelRow {
  categoryId: string;
  name: string;
  buyerId: string | null;
  skuCount: number;
  pendingCount: number;
  byPriority: { stockout_imminent: number; low_stock: number; opportunity: number };
  suggestedAmountClp: number;
  sales30Units: number | null;
  avgMarginPct: number | null;
  budget: {
    month: string;
    budgetClp: number;
    committedClp: number;
    availableClp: number;
  } | null;
}

export interface CategoriesPanelData {
  items: CategoryPanelRow[];
  warnings?: BffWarning[];
}

// ----------------------------------------------------------------------------
//  API pública — Paneles de proveedores y categorías (F12)
// ----------------------------------------------------------------------------

/** GET /suppliers?q=&status= — panel compuesto de proveedores. */
export function getSuppliersPanel(params?: {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<SuppliersPanelData> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.status) query.set("status", params.status);
  query.set("page", String(params?.page ?? 1));
  query.set("pageSize", String(params?.pageSize ?? 50));
  return request<SuppliersPanelData>(`/suppliers?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /categories — panel de categorías (motor + OTB + cartera). */
export function getCategoriesPanel(): Promise<CategoriesPanelData> {
  return request<CategoriesPanelData>("/categories", {
    method: "GET",
    headers: baseHeaders(),
  });
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Señales de venta (F13)
// ----------------------------------------------------------------------------

export type SignalBffStatus = "new" | "in_review" | "actioned" | "dismissed";

export type SignalBffPriority = "high" | "medium" | "low";

export interface SignalMessageView {
  id: string;
  authorUserId: string;
  authorName: string | null;
  role: "seller" | "buyer";
  body: string;
  dateCreated: string;
}

/** Detalle estructurado sin estado propio (canal, evidencia, solicitud formal). */
export interface SignalDetails {
  channel?: string;
  recommendedAction?: string;
  customersAsking?: number;
  estimatedLostSale?: number;
  evidenceNote?: string;
  request?: {
    customerName?: string;
    requestedQty?: number;
    requiredDate?: string;
    targetPrice?: number;
    suggestedSupplier?: string;
    quotedCost?: number;
  };
}

export interface SignalView {
  id: string;
  kind: string;
  body: string;
  sku: string | null;
  supplierId: string | null;
  storeRef: string | null;
  priority: SignalBffPriority;
  status: SignalBffStatus;
  reporterUserId: string;
  reporterName: string | null;
  assignedBuyerId: string | null;
  resolution: string | null;
  details: SignalDetails | null;
  version: number;
  dateCreated: string;
  dateModified: string;
  messageCount?: number;
}

/** Bloque de apoyo del detalle (motor + stock vivo, degradable). */
export interface SignalSupportView {
  skuName: string | null;
  stockAvailable: number | null;
  stockInTransit: number | null;
  stockFromSnapshot: boolean;
  dailyVelocity: number | null;
  coverageDays: number | null;
  salesLast30d: number | null;
  rotation: number | null;
  marginPct: number | null;
  unitCostClp: number | null;
  supplierId: string | null;
  supplierName: string | null;
  recommendationId: string | null;
}

export interface SignalDetailData extends SignalView {
  messages: SignalMessageView[];
  support: SignalSupportView | null;
  warnings?: BffWarning[];
}

export interface SignalListData {
  items: SignalView[];
  meta: ReplenishmentMeta;
}

// ----------------------------------------------------------------------------
//  API pública — Señales de venta (F13)
// ----------------------------------------------------------------------------

/** GET /signals — bandeja con filtros. */
export function listSignals(params?: {
  status?: SignalBffStatus;
  kind?: string;
  sku?: string;
  supplierId?: string;
  assignedBuyerId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<SignalListData> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.kind) query.set("kind", params.kind);
  if (params?.sku) query.set("sku", params.sku);
  if (params?.supplierId) query.set("supplierId", params.supplierId);
  if (params?.assignedBuyerId) query.set("assignedBuyerId", params.assignedBuyerId);
  if (params?.q) query.set("q", params.q);
  query.set("page", String(params?.page ?? 1));
  query.set("pageSize", String(params?.pageSize ?? 50));
  return request<SignalListData>(`/signals?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /signals/:id — detalle con hilo y bloque de apoyo. */
export function getSignal(id: string): Promise<SignalDetailData> {
  return request<SignalDetailData>(`/signals/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** POST /signals — reportar señal (🔑). */
export function createSignal(body: {
  kind: string;
  body: string;
  sku?: string;
  supplierRef?: string;
  storeRef?: string;
  priority?: SignalBffPriority;
  reporterName?: string;
  details?: SignalDetails;
}): Promise<SignalView> {
  return request<SignalView>("/signals", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/** PATCH /signals/:id — máquina new→in_review→actioned|dismissed (If-Match). */
export function patchSignal(
  id: string,
  version: number,
  body: {
    status?: "in_review" | "actioned" | "dismissed";
    reason?: string;
    priority?: SignalBffPriority;
    assignedBuyerId?: string;
  }
): Promise<SignalView> {
  return request<SignalView>(`/signals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...baseHeaders(), "If-Match": `"${version}"` },
    body: JSON.stringify(body),
  });
}

/** POST /signals/:id/comments — comentario del hilo (🔑). */
export function addSignalComment(
  id: string,
  body: { body: string; authorName?: string }
): Promise<SignalMessageView> {
  return request<SignalMessageView>(`/signals/${encodeURIComponent(id)}/comments`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Decisiones y aprendizaje (F14)
// ----------------------------------------------------------------------------

export type DecisionBffOutcome = "pending" | "hit" | "miss" | "mixed";

/** Línea de la proyección: qué se compró vs qué sugería el motor al decidir. */
export interface DecisionProjectionLine {
  sku?: string;
  skuName?: string | null;
  supplierId?: string | null;
  boughtQty?: number | null;
  unitCostClp?: number | null;
  recommendationId?: string | null;
  suggestedQtyAtDecision?: number | null;
  coverageAtDecision?: number | null;
}

export interface DecisionProjection {
  netTotalClp?: number | null;
  lineCount?: number;
  supplierCount?: number;
  lines?: DecisionProjectionLine[];
  asOf?: string;
}

/** Resultado del evaluador E8 (estado fresco del motor a windowDays). */
export interface DecisionResult {
  evaluatedWith?: string;
  asOf?: string;
  skuCount?: number;
  backInCritical?: string[];
  backInLowStock?: string[];
  note?: string;
}

export interface DecisionView {
  id: string;
  proposalId: string;
  approvalId: string | null;
  buyerId: string;
  summary: string;
  projection: DecisionProjection | null;
  result: DecisionResult | null;
  windowDays: number;
  outcome: DecisionBffOutcome;
  evaluatedAt: string | null;
  dateCreated: string;
}

export interface DecisionListData {
  items: DecisionView[];
  meta: ReplenishmentMeta;
}

// ----------------------------------------------------------------------------
//  API pública — Decisiones y aprendizaje (F14)
// ----------------------------------------------------------------------------

/** GET /decisions — historial (scope mine/all, filtros outcome/q). */
export function listDecisions(params?: {
  outcome?: DecisionBffOutcome;
  q?: string;
  buyerId?: string;
  scope?: "mine" | "all";
  page?: number;
  pageSize?: number;
}): Promise<DecisionListData> {
  const query = new URLSearchParams();
  if (params?.outcome) query.set("outcome", params.outcome);
  if (params?.q) query.set("q", params.q);
  if (params?.buyerId) query.set("buyerId", params.buyerId);
  if (params?.scope) query.set("scope", params.scope);
  query.set("page", String(params?.page ?? 1));
  query.set("pageSize", String(params?.pageSize ?? 50));
  return request<DecisionListData>(`/decisions?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** POST /decisions — registro manual anotado sobre una propuesta (🔑). */
export function createDecision(body: {
  proposalId: string;
  summary: string;
  windowDays?: number;
  projection?: DecisionProjection;
}): Promise<DecisionView> {
  return request<DecisionView>("/decisions", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Equipo del líder (F15)
// ----------------------------------------------------------------------------

export interface BuyerWorkloadCounts {
  recommendationsPending: number;
  criticalPending: number;
  proposalsOpen: number;
  ordersOpen: number;
  receptionsPending: number;
  claimsOpen: number;
  alertsActive: number;
  signalsOpen: number;
  decisionsPending: number;
}

export interface BuyerWorkloadRow {
  buyerId: string;
  displayName: string | null;
  active: boolean;
  categories: string[];
  counts: BuyerWorkloadCounts;
}

export interface TeamWorkloadData {
  items: BuyerWorkloadRow[];
  asOf: string;
}

// ----------------------------------------------------------------------------
//  API pública — Equipo del líder (F15)
// ----------------------------------------------------------------------------

/** GET /team/workload — carga viva por comprador (permiso team:read, líder). */
export function getTeamWorkload(): Promise<TeamWorkloadData> {
  return request<TeamWorkloadData>("/team/workload", {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** PUT /team/assignments/:categoryId — C18: reasignar cartera (líder). */
export function reassignCategory(
  categoryId: string,
  body: { buyerId: string; reason?: string },
  version?: number
): Promise<{ categoryId: string; buyerId: string; since: string; version: number }> {
  return request(`/team/assignments/${encodeURIComponent(categoryId)}`, {
    method: "PUT",
    headers: {
      ...baseHeaders(),
      ...(version !== undefined ? { "If-Match": `"${version}"` } : {}),
    },
    body: JSON.stringify(body),
  });
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Importaciones y documentos (F16)
// ----------------------------------------------------------------------------

export type ImportStage = "po" | "production" | "shipping" | "customs" | "warehouse";

export interface ImportDocRow {
  id: string;
  kind: string;
  dmsRef: string;
  uploadedByUserId: string;
  dateCreated: string;
}

export interface ImportView {
  id: string;
  purchaseOrderId: string | null;
  poNumber: string | null;
  supplierId: string | null;
  buyerId: string | null;
  stage: ImportStage;
  etaDate: string | null;
  forwarderRef: string | null;
  stageHistory: Array<{ stage: string; at: string; byUserId: string }>;
  version: number;
  dateCreated: string;
  dateModified: string;
  docs?: ImportDocRow[];
}

export interface ImportListData {
  items: ImportView[];
  meta: ReplenishmentMeta;
}

export interface ProcurementDocView {
  id: string;
  kind: string;
  title: string;
  refEntity: string | null;
  refId: string | null;
  supplierId: string | null;
  dmsRef: string;
  uploadedByUserId: string;
  dateCreated: string;
}

export interface DocumentListData {
  items: ProcurementDocView[];
  meta: ReplenishmentMeta;
}

// ----------------------------------------------------------------------------
//  API pública — Importaciones y documentos (F16)
// ----------------------------------------------------------------------------

/** GET /imports — pipeline de importaciones (filtros stage/q). */
export function listImports(params?: {
  stage?: ImportStage;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<ImportListData> {
  const query = new URLSearchParams();
  if (params?.stage) query.set("stage", params.stage);
  if (params?.q) query.set("q", params.q);
  query.set("page", String(params?.page ?? 1));
  query.set("pageSize", String(params?.pageSize ?? 50));
  return request<ImportListData>(`/imports?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /imports/:id — detalle con historia de etapas y documentos. */
export function getImport(id: string): Promise<ImportView> {
  return request<ImportView>(`/imports/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** POST /imports — abrir seguimiento (🔑; OC opcional). */
export function createImport(body: {
  purchaseOrderId?: string;
  etaDate?: string;
  forwarderRef?: string;
}): Promise<ImportView> {
  return request<ImportView>("/imports", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/** PATCH /imports/:id — avanzar etapa / ETA / forwarder (If-Match). */
export function patchImport(
  id: string,
  version: number,
  body: { stage?: Exclude<ImportStage, "po">; etaDate?: string | null; forwarderRef?: string | null }
): Promise<ImportView> {
  return request<ImportView>(`/imports/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...baseHeaders(), "If-Match": `"${version}"` },
    body: JSON.stringify(body),
  });
}

/** POST /imports/:id/docs — registrar documento (referencia DMS, 🔑). */
export function addImportDoc(
  id: string,
  body: { kind: string; dmsRef: string }
): Promise<ImportView> {
  return request<ImportView>(`/imports/${encodeURIComponent(id)}/docs`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/** GET /documents — repositorio documental (filtros kind/ref/supplier/q). */
export function listDocuments(params?: {
  kind?: string;
  refEntity?: string;
  refId?: string;
  supplierId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<DocumentListData> {
  const query = new URLSearchParams();
  if (params?.kind) query.set("kind", params.kind);
  if (params?.refEntity) query.set("refEntity", params.refEntity);
  if (params?.refId) query.set("refId", params.refId);
  if (params?.supplierId) query.set("supplierId", params.supplierId);
  if (params?.q) query.set("q", params.q);
  query.set("page", String(params?.page ?? 1));
  query.set("pageSize", String(params?.pageSize ?? 50));
  return request<DocumentListData>(`/documents?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** POST /documents — registrar referencia DMS (🔑). */
export function createDocument(body: {
  kind: string;
  title: string;
  refEntity?: string;
  refId?: string;
  supplierId?: string;
  dmsRef: string;
}): Promise<ProcurementDocView> {
  return request<ProcurementDocView>("/documents", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Exports E13 (F17)
// ----------------------------------------------------------------------------

export type ExportJobStatus = "pending" | "running" | "done" | "failed";

export interface ExportCatalogItem {
  reportId: string;
  title: string;
}

export interface ExportJobView {
  id: string;
  reportId: string;
  title: string;
  status: ExportJobStatus;
  rowCount: number | null;
  error: string | null;
  /** Solo viaja cuando status === "done" (GET por id). */
  resultCsv?: string;
  dateCreated: string;
  finishedAt: string | null;
  expiresAt: string | null;
}

// ----------------------------------------------------------------------------
//  API pública — Exports E13 (F17)
// ----------------------------------------------------------------------------

/** GET /exports/catalog — reportes disponibles. */
export function getExportCatalog(): Promise<{ items: ExportCatalogItem[] }> {
  return request<{ items: ExportCatalogItem[] }>("/exports/catalog", {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /exports — mis jobs recientes. */
export function listExports(): Promise<{ items: ExportJobView[] }> {
  return request<{ items: ExportJobView[] }>("/exports", {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /exports/:id — polling; en done incluye el CSV. */
export function getExport(id: string): Promise<ExportJobView> {
  return request<ExportJobView>(`/exports/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** POST /exports — encola la exportación (202, 🔑). */
export function createExport(reportId: string): Promise<ExportJobView> {
  return request<ExportJobView>("/exports", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify({ reportId }),
  });
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Temporadas y campañas (F18)
// ----------------------------------------------------------------------------

export type SeasonStatus = "planned" | "buying" | "selling" | "closed";

export type SeasonScenario = "base" | "optimista" | "conservador";

export interface SeasonPlanTracking {
  computedAt: string;
  orderCount: number;
  totalCommittedClp: number;
  byCategory: Record<string, number>;
}

export interface SeasonPlanView {
  id: string;
  scenario: SeasonScenario;
  /** Estructura del plan (byCategory.plannedClp, notes) — la fija el planner. */
  plan: {
    byCategory?: Record<string, { plannedClp?: number }>;
    notes?: string;
  } | null;
  tracking: SeasonPlanTracking | null;
  version: number;
  dateModified: string;
}

export interface SeasonView {
  id: string;
  code: string;
  name: string;
  salesFrom: string;
  salesTo: string;
  buyFrom: string;
  buyTo: string;
  status: SeasonStatus;
  plans: SeasonPlanView[];
}

export interface ForecastAdjustmentView {
  id: string;
  sku: string;
  seasonId: string | null;
  adjustmentPct: number | null;
  reason: string;
  authorUserId: string;
  dateCreated: string;
}

export type CampaignOpportunityStatus =
  | "detected"
  | "planned"
  | "active"
  | "closed"
  | "dismissed";

export interface CampaignOpportunityView {
  id: string;
  kind: string;
  sku: string | null;
  categoryId: string | null;
  channelRef: string | null;
  windowFrom: string;
  windowTo: string;
  evidence: Record<string, unknown> | null;
  status: CampaignOpportunityStatus;
  campaignCount: number;
  version: number;
  dateCreated: string;
  dateModified: string;
}

export type CampaignStatus = "planned" | "active" | "closed" | "cancelled";

export type CampaignType = "ad_space" | "opportunity";

export interface CampaignView {
  id: string;
  type: CampaignType;
  opportunityId: string | null;
  title: string;
  channelRef: string | null;
  budgetClp: number | null;
  startsAt: string;
  endsAt: string;
  status: CampaignStatus;
  version: number;
  dateCreated: string;
  userCreated: string;
}

// ----------------------------------------------------------------------------
//  API pública — Temporadas y campañas (F18)
// ----------------------------------------------------------------------------

/** GET /seasons — temporadas con sus planes por escenario. */
export function listSeasons(): Promise<{ items: SeasonView[]; total: number }> {
  return request<{ items: SeasonView[]; total: number }>("/seasons", {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /seasons/:id — detalle con planes. */
export function getSeason(id: string): Promise<SeasonView> {
  return request<SeasonView>(`/seasons/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** POST /seasons — crear temporada (🔑; código único ⇒ 409). */
export function createSeason(body: {
  code: string;
  name: string;
  salesFrom: string;
  salesTo: string;
  buyFrom: string;
  buyTo: string;
}): Promise<SeasonView> {
  return request<SeasonView>("/seasons", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/** PATCH /seasons/:id — avanzar ciclo y/o fechas (retroceder ⇒ 409). */
export function patchSeason(
  id: string,
  body: {
    status?: Exclude<SeasonStatus, "planned">;
    salesFrom?: string;
    salesTo?: string;
    buyFrom?: string;
    buyTo?: string;
  }
): Promise<SeasonView> {
  return request<SeasonView>(`/seasons/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: baseHeaders(),
    body: JSON.stringify(body),
  });
}

/** PUT /seasons/:id/plans/:scenario — upsert del plan (If-Match si existe). */
export function putSeasonPlan(
  id: string,
  scenario: SeasonScenario,
  plan: NonNullable<SeasonPlanView["plan"]>,
  version?: number
): Promise<SeasonPlanView> {
  const headers =
    version !== undefined
      ? { ...baseHeaders(), "If-Match": `"${version}"` }
      : baseHeaders();
  return request<SeasonPlanView>(
    `/seasons/${encodeURIComponent(id)}/plans/${encodeURIComponent(scenario)}`,
    { method: "PUT", headers, body: JSON.stringify({ plan }) }
  );
}

/** GET /seasons/forecast-adjustments — ajustes auditados (filtros sku/seasonId). */
export function listForecastAdjustments(params?: {
  sku?: string;
  seasonId?: string;
}): Promise<{ items: ForecastAdjustmentView[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.sku) query.set("sku", params.sku);
  if (params?.seasonId) query.set("seasonId", params.seasonId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<{ items: ForecastAdjustmentView[]; total: number }>(
    `/seasons/forecast-adjustments${suffix}`,
    { method: "GET", headers: baseHeaders() }
  );
}

/** POST /seasons/forecast-adjustments — ajuste por SKU con motivo (🔑). */
export function createForecastAdjustment(body: {
  sku: string;
  seasonId?: string;
  adjustmentPct: number;
  reason: string;
}): Promise<ForecastAdjustmentView> {
  return request<ForecastAdjustmentView>("/seasons/forecast-adjustments", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/** GET /campaign-opportunities — oportunidades (filtros status/kind). */
export function listCampaignOpportunities(params?: {
  status?: CampaignOpportunityStatus;
  kind?: string;
}): Promise<{ items: CampaignOpportunityView[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.kind) query.set("kind", params.kind);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<{ items: CampaignOpportunityView[]; total: number }>(
    `/campaign-opportunities${suffix}`,
    { method: "GET", headers: baseHeaders() }
  );
}

/** POST /campaign-opportunities — registrar oportunidad (🔑; duplicada ⇒ 409). */
export function createCampaignOpportunity(body: {
  kind: string;
  sku?: string;
  categoryId?: string;
  channelRef?: string;
  windowFrom: string;
  windowTo: string;
  evidence: Record<string, unknown>;
}): Promise<CampaignOpportunityView> {
  return request<CampaignOpportunityView>("/campaign-opportunities", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/** PATCH /campaign-opportunities/:id — ciclo (If-Match; descartar exige motivo). */
export function patchCampaignOpportunity(
  id: string,
  version: number,
  body: { status: Exclude<CampaignOpportunityStatus, "detected">; reason?: string }
): Promise<CampaignOpportunityView> {
  return request<CampaignOpportunityView>(
    `/campaign-opportunities/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...baseHeaders(), "If-Match": `"${version}"` },
      body: JSON.stringify(body),
    }
  );
}

/** GET /campaigns — campañas (filtros status/type). */
export function listCampaigns(params?: {
  status?: CampaignStatus;
  type?: CampaignType;
}): Promise<{ items: CampaignView[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.type) query.set("type", params.type);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<{ items: CampaignView[]; total: number }>(`/campaigns${suffix}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** POST /campaigns — crear campaña (🔑; opportunity exige opportunityId). */
export function createCampaign(body: {
  type: CampaignType;
  title: string;
  opportunityId?: string;
  channelRef?: string;
  budgetClp?: number;
  startsAt: string;
  endsAt: string;
}): Promise<CampaignView> {
  return request<CampaignView>("/campaigns", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/** PATCH /campaigns/:id — ciclo/presupuesto/fecha fin (If-Match). */
export function patchCampaign(
  id: string,
  version: number,
  body: {
    status?: Exclude<CampaignStatus, "planned">;
    budgetClp?: number;
    endsAt?: string;
  }
): Promise<CampaignView> {
  return request<CampaignView>(`/campaigns/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...baseHeaders(), "If-Match": `"${version}"` },
    body: JSON.stringify(body),
  });
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Desempeño y gamificación (F19)
// ----------------------------------------------------------------------------

export interface ScoreComponentsView {
  ordersIssued: number;
  orderValueClp: number;
  receptionsCompleted: number;
  claimsResolved: number;
  signalsActioned: number;
  decisionsEvaluated: number;
  decisionHits: number;
  decisionMixed: number;
  /** null cuando el mes no tiene decisiones evaluadas (sin calidad medible). */
  hitRatePct: number | null;
}

export interface ScoreMetricsView {
  formulaVersion: string;
  score: number;
  activityPoints: number;
  qualityPoints: number;
  components: ScoreComponentsView;
}

export interface ScoreSnapshotView {
  buyerId: string;
  displayName: string | null;
  period: string;
  metrics: ScoreMetricsView | null;
  computedAt: string;
}

export type GoalStatus = "on_track" | "at_risk" | "off_track" | "achieved";

export type GoalKind =
  | "order_count"
  | "hit_rate"
  | "claims_resolved"
  | "signals_actioned";

export interface GoalView {
  id: string;
  buyerId: string;
  /** Mes ("2026-07") o trimestre ("2026-Q3"). */
  period: string;
  kind: GoalKind;
  target: { value?: number } | null;
  progress: { value?: number; updatedAt?: string } | null;
  status: GoalStatus;
  version: number;
  dateModified: string;
}

export interface MyPerformanceView {
  buyerId: string;
  displayName: string | null;
  period: string;
  current: ScoreSnapshotView | null;
  previous: ScoreSnapshotView | null;
  goals: GoalView[];
}

export interface RankingRowView {
  position: number;
  buyerId: string;
  displayName: string | null;
  score: number;
  metrics: ScoreMetricsView | null;
  previousScore: number | null;
  computedAt: string;
}

export interface RewardView {
  id: string;
  title: string;
  description: string;
  criteria: Record<string, unknown> | null;
  active: boolean;
}

// ----------------------------------------------------------------------------
//  API pública — Desempeño y gamificación (F19)
// ----------------------------------------------------------------------------

/** GET /performance/me — mi score del mes, delta vs mes anterior y metas. */
export function getMyPerformance(): Promise<MyPerformanceView> {
  return request<MyPerformanceView>("/performance/me", {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /performance/ranking — ranking del equipo (mes en curso). */
export function getPerformanceRanking(): Promise<{
  period: string;
  items: RankingRowView[];
  total: number;
}> {
  return request<{ period: string; items: RankingRowView[]; total: number }>(
    "/performance/ranking",
    { method: "GET", headers: baseHeaders() }
  );
}

/** GET /performance/rewards — recompensas activas con criterios explícitos. */
export function listRewards(): Promise<{ items: RewardView[]; total: number }> {
  return request<{ items: RewardView[]; total: number }>("/performance/rewards", {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /performance/goals — metas (el comprador ve las suyas; líder filtra). */
export function listGoals(params?: {
  buyerId?: string;
  period?: string;
}): Promise<{ items: GoalView[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.buyerId) query.set("buyerId", params.buyerId);
  if (params?.period) query.set("period", params.period);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<{ items: GoalView[]; total: number }>(
    `/performance/goals${suffix}`,
    { method: "GET", headers: baseHeaders() }
  );
}

/** POST /performance/goals — alta de meta (líder, 🔑; duplicada ⇒ 409). */
export function createGoal(body: {
  buyerId: string;
  period: string;
  kind: GoalKind;
  targetValue: number;
}): Promise<GoalView> {
  return request<GoalView>("/performance/goals", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/** PATCH /performance/goals/:id — ajustar objetivo (líder, If-Match). */
export function patchGoal(
  id: string,
  version: number,
  body: { targetValue: number }
): Promise<GoalView> {
  return request<GoalView>(`/performance/goals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...baseHeaders(), "If-Match": `"${version}"` },
    body: JSON.stringify(body),
  });
}

// ----------------------------------------------------------------------------
//  Tipos del contrato — Reglas de compra (F20)
// ----------------------------------------------------------------------------

export type RuleScopeType = "global" | "category" | "supplier" | "buyer";

export interface RuleView {
  id: string;
  scopeType: RuleScopeType;
  /** null en scope global; categoryId / supplierRef / buyerId en el resto. */
  scopeRef: string | null;
  /** Clave namespaced (ej: replenishment.target_coverage_days). */
  key: string;
  value: unknown;
  active: boolean;
  validFrom: string;
  reason: string;
  dateModified: string;
  userModified: string;
}

// ----------------------------------------------------------------------------
//  API pública — Reglas de compra (F20)
// ----------------------------------------------------------------------------

export interface RuleListData {
  items: RuleView[];
  meta: BffPageMeta;
}

/** GET /rules — reglas con valor parseado (filtro scopeType opcional). */
export function listRules(params?: {
  scopeType?: RuleScopeType;
  page?: number;
  pageSize?: number;
}): Promise<RuleListData> {
  const query = new URLSearchParams();
  if (params?.scopeType) query.set("scopeType", params.scopeType);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<RuleListData>(`/rules${suffix}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** POST /rules — alta (líder, 🔑; activa duplicada por alcance+clave ⇒ 409). */
export function createRule(body: {
  scopeType: RuleScopeType;
  scopeRef?: string;
  key: string;
  value: unknown;
  reason: string;
}): Promise<RuleView> {
  return request<RuleView>("/rules", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/** PATCH /rules/:id — cambiar valor y/o activar-desactivar (motivo obligatorio). */
export function patchRule(
  id: string,
  body: { value?: unknown; active?: boolean; reason: string }
): Promise<RuleView> {
  return request<RuleView>(`/rules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: baseHeaders(),
    body: JSON.stringify(body),
  });
}
