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
  page?: number;
  pageSize?: number;
}): Promise<AlertListData> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.severity) query.set("severity", params.severity);
  if (params.type) query.set("type", params.type);
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
//  Tipos del contrato — Dashboard de Inicio (F6: bandeja diaria compuesta)
// ----------------------------------------------------------------------------

/** Sección degradada: el BFF no pudo componerla pero la vista sigue viva. */
export interface DashboardDegradedSection {
  status: "degraded";
  warning: BffWarning;
}

/** Módulo aún no construido en v1 (alerts / signals). */
export interface DashboardUnavailableSection {
  status: "unavailable";
}

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
  signals: DashboardUnavailableSection;
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
  page?: number;
  pageSize?: number;
}): Promise<PurchaseOrderListData> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
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
